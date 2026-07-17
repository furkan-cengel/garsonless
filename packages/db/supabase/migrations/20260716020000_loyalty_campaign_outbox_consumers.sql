-- Loyalty/campaign write-side strangler.
--
-- Existing order/table triggers remain the transactional event source. This
-- migration adds the two explicit application events and makes campaign
-- creation + recipient snapshots + outbox enqueue one transaction. Recipient
-- delivery is claimed before the provider call so a worker lease race cannot
-- send the same row twice.

alter table public.domain_outbox drop constraint if exists domain_outbox_aggregate_type_check;
alter table public.domain_outbox add constraint domain_outbox_aggregate_type_check
  check (aggregate_type in ('order', 'table_session', 'service_request', 'customer', 'campaign'));

alter table public.domain_outbox drop constraint if exists domain_outbox_event_type_check;
alter table public.domain_outbox add constraint domain_outbox_event_type_check
  check (event_type in (
    'order.created',
    'order.status_changed',
    'order.settled',
    'table_session.closed',
    'service_request.created',
    'customer.welcome_bonus_requested',
    'campaign.delivery_requested'
  ));

alter table public.campaign_recipients
  add column if not exists attempts integer not null default 0 check (attempts >= 0),
  add column if not exists locked_at timestamptz;

alter table public.campaign_recipients drop constraint if exists campaign_recipients_status_check;
alter table public.campaign_recipients add constraint campaign_recipients_status_check
  check (status in ('pending', 'processing', 'sent', 'failed'));

create unique index if not exists message_events_recipient_terminal_unique
  on public.message_events(recipient_id, event_type)
  where recipient_id is not null and event_type in ('sent', 'failed');

create or replace function public.queue_campaign_delivery_atomic(
  p_restaurant_id uuid,
  p_name text,
  p_message_body text,
  p_segment_kind text,
  p_builtin_segment text,
  p_custom_segment_id uuid,
  p_segment_definition jsonb,
  p_created_by uuid,
  p_contacts jsonb,
  p_skipped_count integer,
  p_segment_label text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign_id uuid;
  v_recipient_count integer;
begin
  if jsonb_typeof(p_contacts) <> 'array' then
    raise exception 'contacts must be an array' using errcode = '22023';
  end if;
  v_recipient_count := jsonb_array_length(p_contacts);
  if v_recipient_count < 1 then
    raise exception 'at least one recipient is required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_contacts) as contact("customerId" uuid, phone text)
    where contact."customerId" is null
      or nullif(btrim(contact.phone), '') is null
      or not exists (
        select 1 from public.customer_restaurants association
        where association.customer_id = contact."customerId"
          and association.restaurant_id = p_restaurant_id
      )
  ) then
    raise exception 'campaign recipient does not belong to restaurant' using errcode = '42501';
  end if;

  if p_segment_kind = 'custom' and not exists (
    select 1 from public.customer_segments segment
    where segment.id = p_custom_segment_id
      and segment.restaurant_id = p_restaurant_id
      and segment.deleted_at is null
  ) then
    raise exception 'custom segment does not belong to restaurant' using errcode = '42501';
  end if;

  insert into public.campaigns (
    restaurant_id, name, channel, message_body, segment_kind,
    builtin_segment, custom_segment_id, segment_definition, status,
    recipient_count, skipped_count, created_by
  ) values (
    p_restaurant_id, p_name, 'sms', p_message_body, p_segment_kind,
    p_builtin_segment, p_custom_segment_id, coalesce(p_segment_definition, '{}'::jsonb), 'sending',
    v_recipient_count, greatest(coalesce(p_skipped_count, 0), 0), p_created_by
  ) returning id into v_campaign_id;

  insert into public.campaign_recipients (
    campaign_id, restaurant_id, customer_id, phone, status
  )
  select v_campaign_id, p_restaurant_id, contact."customerId", contact.phone, 'pending'
  from jsonb_to_recordset(p_contacts) as contact("customerId" uuid, phone text);

  perform public.enqueue_domain_outbox_event(
    p_restaurant_id,
    'campaign',
    v_campaign_id,
    'campaign.delivery_requested',
    jsonb_build_object(
      'campaignId', v_campaign_id,
      'createdBy', p_created_by,
      'segmentLabel', coalesce(nullif(btrim(p_segment_label), ''), 'Kampanya')
    ),
    'campaign.delivery_requested:' || v_campaign_id::text
  );

  return v_campaign_id;
end;
$$;

create or replace function public.claim_campaign_recipient(
  p_campaign_id uuid,
  p_restaurant_id uuid
)
returns setof public.campaign_recipients
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with candidate as (
    select recipient.id
    from public.campaign_recipients recipient
    where recipient.campaign_id = p_campaign_id
      and recipient.restaurant_id = p_restaurant_id
      and recipient.status = 'pending'
    order by recipient.created_at, recipient.id
    limit 1
    for update skip locked
  )
  update public.campaign_recipients recipient
  set status = 'processing',
      attempts = recipient.attempts + 1,
      locked_at = now(),
      error = null
  from candidate
  where recipient.id = candidate.id
  returning recipient.*;
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
  v_recipient public.campaign_recipients;
begin
  update public.campaign_recipients recipient
  set status = case when p_success then 'sent' else 'failed' end,
      provider_message_id = case when p_success then p_provider_message_id else null end,
      sent_at = case when p_success then now() else null end,
      error = case when p_success then null else left(coalesce(p_error, 'SMS gönderilemedi'), 500) end,
      locked_at = null
  where recipient.id = p_recipient_id
    and recipient.restaurant_id = p_restaurant_id
    and recipient.status = 'processing'
  returning recipient.* into v_recipient;

  if v_recipient.id is null then return false; end if;

  insert into public.message_events (
    restaurant_id, campaign_id, recipient_id, customer_id, channel,
    event_type, phone, provider, provider_message_id, error, created_by, metadata
  ) values (
    v_recipient.restaurant_id, v_recipient.campaign_id, v_recipient.id, v_recipient.customer_id, 'sms',
    case when p_success then 'sent' else 'failed' end,
    v_recipient.phone, p_provider,
    case when p_success then p_provider_message_id else null end,
    case when p_success then null else left(coalesce(p_error, 'SMS gönderilemedi'), 500) end,
    p_created_by,
    jsonb_build_object('segment', coalesce(nullif(btrim(p_segment_label), ''), 'Kampanya'))
  )
  on conflict (recipient_id, event_type)
    where recipient_id is not null and event_type in ('sent', 'failed')
    do nothing;

  return true;
end;
$$;

create or replace function public.finalize_campaign_delivery(
  p_campaign_id uuid,
  p_restaurant_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pending integer;
  v_processing integer;
  v_sent integer;
  v_failed integer;
  v_status text;
begin
  -- A provider call may succeed while the process dies before finalization.
  -- Never auto-resend that row (duplicate marketing SMS is worse than an
  -- explicitly visible unknown outcome); after the lease window it becomes a
  -- failed/reconciliation item and the campaign can finish.
  update public.campaign_recipients recipient
  set status = 'failed',
      error = 'Gönderim sonucu belirsiz; otomatik tekrar gönderilmedi.',
      locked_at = null
  where recipient.campaign_id = p_campaign_id
    and recipient.restaurant_id = p_restaurant_id
    and recipient.status = 'processing'
    and recipient.locked_at < now() - interval '15 minutes';

  select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'processing'),
    count(*) filter (where status = 'sent'),
    count(*) filter (where status = 'failed')
  into v_pending, v_processing, v_sent, v_failed
  from public.campaign_recipients
  where campaign_id = p_campaign_id and restaurant_id = p_restaurant_id;

  if v_processing > 0 then
    return 'processing';
  end if;
  if v_pending > 0 then
    return 'pending';
  end if;

  v_status := case when v_sent > 0 then 'sent' else 'failed' end;
  update public.campaigns
  set status = v_status,
      sent_count = v_sent,
      failed_count = v_failed,
      sent_at = now()
  where id = p_campaign_id and restaurant_id = p_restaurant_id;
  return v_status;
end;
$$;

revoke all on function public.queue_campaign_delivery_atomic(uuid, text, text, text, text, uuid, jsonb, uuid, jsonb, integer, text) from public, anon, authenticated;
revoke all on function public.claim_campaign_recipient(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_campaign_recipient(uuid, uuid, boolean, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.finalize_campaign_delivery(uuid, uuid) from public, anon, authenticated;
grant execute on function public.queue_campaign_delivery_atomic(uuid, text, text, text, text, uuid, jsonb, uuid, jsonb, integer, text) to service_role;
grant execute on function public.claim_campaign_recipient(uuid, uuid) to service_role;
grant execute on function public.complete_campaign_recipient(uuid, uuid, boolean, text, text, text, uuid, text) to service_role;
grant execute on function public.finalize_campaign_delivery(uuid, uuid) to service_role;
