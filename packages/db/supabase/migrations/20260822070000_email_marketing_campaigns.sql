-- Add tenant-safe, consent-gated email campaigns while preserving the dormant
-- SMS transport. Recipient PII remains service-role-only.

alter table public.campaigns add column if not exists subject text;
alter table public.campaigns drop constraint if exists campaigns_channel_check;
alter table public.campaigns add constraint campaigns_channel_check check (channel in ('sms', 'email'));
alter table public.campaigns drop constraint if exists campaigns_message_body_check;
alter table public.campaigns add constraint campaigns_message_body_check check (
  char_length(btrim(message_body)) between 1 and case when channel = 'email' then 5000 else 459 end
);
alter table public.campaigns drop constraint if exists campaigns_subject_check;
alter table public.campaigns add constraint campaigns_subject_check check (
  (channel = 'sms' and subject is null)
  or (channel = 'email' and char_length(btrim(subject)) between 1 and 150)
);

create or replace function public.normalize_marketing_email(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select case
    when length(lower(btrim(coalesce(p_value, '')))) between 3 and 320
      and lower(btrim(p_value)) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    then lower(btrim(p_value))
    else null
  end
$$;

alter table public.campaign_recipients alter column phone drop not null;
alter table public.campaign_recipients
  add column if not exists email text,
  add column if not exists normalized_email text;
alter table public.campaign_recipients drop constraint if exists campaign_recipients_contact_check;
alter table public.campaign_recipients add constraint campaign_recipients_contact_check check (
  (phone is not null and email is null and normalized_email is null)
  or (phone is null and email is not null and normalized_phone is null and normalized_email = public.normalize_marketing_email(email))
);
create unique index if not exists campaign_recipients_campaign_email_uniq
  on public.campaign_recipients (campaign_id, normalized_email)
  where normalized_email is not null;

alter table public.message_events add column if not exists email text;
alter table public.message_events drop constraint if exists message_events_channel_check;
alter table public.message_events add constraint message_events_channel_check check (channel in ('sms', 'email'));

create or replace function public.queue_marketing_campaign_delivery_atomic(
  p_request_id uuid,
  p_request_fingerprint text,
  p_restaurant_id uuid,
  p_channel text,
  p_name text,
  p_subject text,
  p_message_body text,
  p_segment_kind text,
  p_builtin_segment text,
  p_custom_segment_id uuid,
  p_segment_definition jsonb,
  p_created_by uuid,
  p_contacts jsonb,
  p_segment_label text
)
returns table (
  campaign_id uuid,
  replayed boolean,
  recipient_count integer,
  skipped_consent_count integer,
  skipped_contact_count integer,
  skipped_duplicate_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing public.campaigns;
  new_campaign_id uuid;
  candidate_count integer;
  distinct_candidate_count integer;
  eligible_before_dedupe integer;
  v_recipient_count integer;
  v_skipped_consent integer;
  v_skipped_contact integer;
  v_skipped_duplicate integer;
begin
  if p_channel not in ('sms', 'email') then
    raise exception 'invalid campaign channel' using errcode = '22023';
  end if;
  if p_channel = 'email' and (p_subject is null or char_length(btrim(p_subject)) not between 1 and 150) then
    raise exception 'email subject is required' using errcode = '22023';
  end if;
  if p_channel = 'sms' and p_subject is not null then
    raise exception 'sms subject must be null' using errcode = '22023';
  end if;
  if p_request_id is null or p_request_fingerprint is null or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid campaign request identity' using errcode = '22023';
  end if;
  if p_contacts is null or jsonb_typeof(p_contacts) <> 'array' then
    raise exception 'contacts must be an array' using errcode = '22023';
  end if;
  candidate_count := jsonb_array_length(p_contacts);
  if candidate_count < 1 or candidate_count > 100000 then
    raise exception 'campaign candidate count is outside the supported range' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.restaurants restaurant
    where restaurant.id = p_restaurant_id
      and restaurant.owner_id = p_created_by
      and restaurant.deleted_at is null
  ) then
    raise exception 'campaign actor is not the active restaurant owner' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text || ':' || p_request_id::text, 0));
  select * into existing from public.campaigns campaign
  where campaign.restaurant_id = p_restaurant_id and campaign.request_id = p_request_id;
  if existing.id is not null then
    if existing.request_fingerprint <> p_request_fingerprint then
      raise exception 'campaign request id was reused for different input' using errcode = 'GL001';
    end if;
    return query select existing.id, true, existing.recipient_count,
      existing.skipped_consent_count, existing.skipped_phone_count, existing.skipped_duplicate_count;
    return;
  end if;

  if p_segment_kind is null or p_segment_kind not in ('all', 'builtin', 'custom')
     or (p_segment_kind = 'builtin' and p_builtin_segment not in ('new', 'frequent', 'lapsed', 'consented'))
     or (p_segment_kind <> 'builtin' and p_builtin_segment is not null)
     or (p_segment_kind = 'custom' and p_custom_segment_id is null)
     or (p_segment_kind <> 'custom' and p_custom_segment_id is not null) then
    raise exception 'invalid campaign segment' using errcode = '22023';
  end if;
  if p_segment_kind = 'custom' and not exists (
    select 1 from public.customer_segments segment
    where segment.id = p_custom_segment_id
      and segment.restaurant_id = p_restaurant_id
      and segment.deleted_at is null
  ) then
    raise exception 'custom segment does not belong to restaurant' using errcode = '42501';
  end if;

  with requested as (
    select contact."customerId" as customer_id
    from jsonb_to_recordset(p_contacts) as contact("customerId" uuid)
  )
  select count(distinct customer_id)::integer into distinct_candidate_count from requested;
  if distinct_candidate_count <> candidate_count or exists (
    select 1 from jsonb_to_recordset(p_contacts) as contact("customerId" uuid)
    where contact."customerId" is null or not exists (
      select 1 from public.customer_restaurants association
      where association.customer_id = contact."customerId" and association.restaurant_id = p_restaurant_id
    )
  ) then
    raise exception 'campaign candidate does not belong to restaurant' using errcode = '42501';
  end if;

  with requested as (
    select contact."customerId" as customer_id
    from jsonb_to_recordset(p_contacts) as contact("customerId" uuid)
  ), classified as (
    select requested.customer_id,
      exists (
        select 1 from public.customer_consents consent
        where consent.customer_id = requested.customer_id
          and consent.restaurant_id = p_restaurant_id
          and consent.consent_type = 'marketing'
          and consent.granted_at is not null and consent.revoked_at is null
      ) as consented,
      case when customer.merged_into_customer_id is not null then null
        when p_channel = 'email' then public.normalize_marketing_email(customer.email)
        else public.normalize_sms_phone(customer.phone)
      end as contact_value
    from requested join public.customers customer on customer.id = requested.customer_id
  )
  select count(*) filter (where not consented)::integer,
    count(*) filter (where consented and contact_value is null)::integer,
    count(*) filter (where consented and contact_value is not null)::integer,
    count(distinct contact_value) filter (where consented and contact_value is not null)::integer
  into v_skipped_consent, v_skipped_contact, eligible_before_dedupe, v_recipient_count
  from classified;
  v_skipped_consent := coalesce(v_skipped_consent, 0) + greatest(candidate_count - distinct_candidate_count, 0);
  v_skipped_contact := coalesce(v_skipped_contact, 0);
  eligible_before_dedupe := coalesce(eligible_before_dedupe, 0);
  v_recipient_count := coalesce(v_recipient_count, 0);
  v_skipped_duplicate := greatest(eligible_before_dedupe - v_recipient_count, 0);
  if v_recipient_count < 1 then
    raise exception 'no transactionally eligible campaign recipient' using errcode = '22023';
  end if;

  insert into public.campaigns (
    restaurant_id, request_id, request_fingerprint, name, channel, subject, message_body,
    segment_kind, builtin_segment, custom_segment_id, segment_definition, status,
    recipient_count, skipped_count, skipped_consent_count, skipped_phone_count,
    skipped_duplicate_count, created_by
  ) values (
    p_restaurant_id, p_request_id, p_request_fingerprint, p_name, p_channel, p_subject, p_message_body,
    p_segment_kind, p_builtin_segment, p_custom_segment_id, coalesce(p_segment_definition, '{}'::jsonb), 'sending',
    v_recipient_count, v_skipped_consent + v_skipped_contact + v_skipped_duplicate,
    v_skipped_consent, v_skipped_contact, v_skipped_duplicate, p_created_by
  ) returning id into new_campaign_id;

  insert into public.campaign_recipients (
    campaign_id, restaurant_id, customer_id, phone, normalized_phone, email, normalized_email, status
  )
  with requested as (
    select contact."customerId" as customer_id
    from jsonb_to_recordset(p_contacts) as contact("customerId" uuid)
  ), eligible as (
    select requested.customer_id,
      case when p_channel = 'sms' then public.normalize_sms_phone(customer.phone) end as phone,
      case when p_channel = 'email' then public.normalize_marketing_email(customer.email) end as email,
      case when p_channel = 'email' then public.normalize_marketing_email(customer.email)
           else public.normalize_sms_phone(customer.phone) end as contact_value
    from requested join public.customers customer on customer.id = requested.customer_id
    where customer.merged_into_customer_id is null
      and case when p_channel = 'email' then public.normalize_marketing_email(customer.email)
               else public.normalize_sms_phone(customer.phone) end is not null
      and exists (
        select 1 from public.customer_consents consent
        where consent.customer_id = requested.customer_id
          and consent.restaurant_id = p_restaurant_id
          and consent.consent_type = 'marketing'
          and consent.granted_at is not null and consent.revoked_at is null
      )
  ), deduplicated as (
    select distinct on (contact_value) customer_id, phone, email, contact_value
    from eligible order by contact_value, customer_id
  )
  select new_campaign_id, p_restaurant_id, customer_id,
    phone, phone, email, email, 'pending'
  from deduplicated;

  perform public.enqueue_domain_outbox_event(
    p_restaurant_id, 'campaign', new_campaign_id, 'campaign.delivery_requested',
    jsonb_build_object('campaignId', new_campaign_id, 'createdBy', p_created_by,
      'segmentLabel', coalesce(nullif(btrim(p_segment_label), ''), 'Kampanya')),
    'campaign.delivery_requested:' || new_campaign_id::text
  );
  return query select new_campaign_id, false, v_recipient_count,
    v_skipped_consent, v_skipped_contact, v_skipped_duplicate;
end;
$$;

create or replace function public.complete_campaign_recipient(
  p_recipient_id uuid,
  p_restaurant_id uuid,
  p_success boolean,
  p_provider text,
  p_provider_message_id text,
  p_error text,
  p_created_by uuid,
  p_segment_label text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient_row public.campaign_recipients;
  campaign_channel text;
  safe_error text := case
    when p_error in ('provider_unavailable', 'provider_rejected', 'configuration_unavailable', 'delivery_unknown') then p_error
    else 'provider_failure'
  end;
begin
  update public.campaign_recipients recipient
  set status = case when p_success then 'sent' else 'failed' end,
      provider_message_id = case when p_success then left(p_provider_message_id, 160) else null end,
      sent_at = case when p_success then now() else null end,
      error = case when p_success then null else safe_error end,
      locked_at = null
  where recipient.id = p_recipient_id and recipient.restaurant_id = p_restaurant_id
    and recipient.status = 'processing'
  returning recipient.* into recipient_row;
  if recipient_row.id is null then return false; end if;
  select channel into campaign_channel from public.campaigns where id = recipient_row.campaign_id;
  insert into public.message_events (
    restaurant_id, campaign_id, recipient_id, customer_id, channel,
    event_type, phone, email, provider, provider_message_id, error, created_by, metadata
  ) values (
    recipient_row.restaurant_id, recipient_row.campaign_id, recipient_row.id, recipient_row.customer_id, campaign_channel,
    case when p_success then 'sent' else 'failed' end,
    null, null, left(coalesce(p_provider, 'unknown'), 40),
    case when p_success then left(p_provider_message_id, 160) else null end,
    case when p_success then null else safe_error end, p_created_by,
    jsonb_build_object('segment', left(coalesce(nullif(btrim(p_segment_label), ''), 'Kampanya'), 80))
  ) on conflict (recipient_id, event_type)
    where recipient_id is not null and event_type in ('sent', 'failed') do nothing;
  return true;
end;
$$;

revoke all on function public.normalize_marketing_email(text) from public, anon, authenticated;
revoke all on function public.queue_marketing_campaign_delivery_atomic(uuid, text, uuid, text, text, text, text, text, text, uuid, jsonb, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.complete_campaign_recipient(uuid, uuid, boolean, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.normalize_marketing_email(text) to service_role;
grant execute on function public.queue_marketing_campaign_delivery_atomic(uuid, text, uuid, text, text, text, text, text, text, uuid, jsonb, uuid, jsonb, text) to service_role;
grant execute on function public.complete_campaign_recipient(uuid, uuid, boolean, text, text, text, uuid, text) to service_role;

create index if not exists customers_search_email_trgm_idx
  on public.customers using gin (public.normalize_customer_search_text(email) gin_trgm_ops);

do $migration$
declare
  fn regprocedure := 'public.get_restaurant_customers(uuid,uuid,text,text,text,integer,integer,jsonb)'::regprocedure;
  definition text;
  old_projection text := E'      cu.name,\n      cu.phone,';
  new_projection text := E'      cu.name,\n      cu.phone,\n      cu.email as search_email,';
  old_search text := E'    where (nullif(btrim(p_search), \'\') is null\n           or (public.normalize_customer_search_text(p_search) <> \'\'\n               and public.normalize_customer_search_text(name) like \'%\' || public.normalize_customer_search_text(p_search) || \'%\')\n           or (public.normalize_customer_search_phone(p_search) <> \'\'\n               and public.normalize_customer_search_phone(phone) like \'%\' || public.normalize_customer_search_phone(p_search)))';
  new_search text := E'    where (nullif(btrim(p_search), \'\') is null\n           or (public.normalize_customer_search_text(p_search) <> \'\'\n               and public.normalize_customer_search_text(name) like \'%\' || public.normalize_customer_search_text(p_search) || \'%\')\n           or (public.normalize_customer_search_text(p_search) <> \'\'\n               and public.normalize_customer_search_text(search_email) like \'%\' || public.normalize_customer_search_text(p_search) || \'%\')\n           or (public.normalize_customer_search_phone(p_search) <> \'\'\n               and public.normalize_customer_search_phone(phone) like \'%\' || public.normalize_customer_search_phone(p_search)))';
begin
  select pg_get_functiondef(fn) into definition;
  if position('cu.email as search_email' in definition) = 0 then
    if position(old_projection in definition) = 0 then
      raise exception 'get_restaurant_customers contact projection has unexpected shape';
    end if;
    definition := replace(definition, old_projection, new_projection);
  end if;
  if position('normalize_customer_search_text(search_email)' in definition) = 0 then
    if position(old_search in definition) = 0 then
      raise exception 'get_restaurant_customers search predicate has unexpected shape';
    end if;
    definition := replace(definition, old_search, new_search);
  end if;
  if position('where restaurant_id = p_restaurant_id' in definition) = 0 then
    raise exception 'get_restaurant_customers tenant boundary is missing';
  end if;
  execute definition;
end
$migration$;
