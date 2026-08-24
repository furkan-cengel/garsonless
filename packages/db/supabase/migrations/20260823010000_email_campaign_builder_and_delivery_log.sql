-- Store bounded block-builder designs and project verified Resend delivery
-- events without exposing recipient PII through authenticated RLS policies.

alter table public.campaigns
  add column if not exists email_design jsonb;

alter table public.campaigns drop constraint if exists campaigns_content_mode_check;
alter table public.campaigns add constraint campaigns_content_mode_check check (
  (channel = 'sms' and content_mode = 'plain' and template_id is null and email_design is null)
  or (channel = 'email' and content_mode = 'plain' and template_id is null and email_design is null)
  or (channel = 'email' and content_mode = 'html' and template_id is null and email_design is null)
  or (channel = 'email' and content_mode = 'template' and template_id in ('minimal', 'announcement', 'offer') and email_design is null)
  or (channel = 'email' and content_mode = 'builder' and template_id is null
      and jsonb_typeof(email_design) = 'object'
      and octet_length(email_design::text) <= 100000)
);

alter table public.campaign_recipients
  add column if not exists delivery_status text,
  add column if not exists last_event_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists clicked_at timestamptz;

update public.campaign_recipients
set delivery_status = case
  when status = 'sent' then 'accepted'
  when status = 'failed' then 'failed'
  else status
end
where delivery_status is null;

alter table public.campaign_recipients alter column delivery_status set default 'pending';
alter table public.campaign_recipients alter column delivery_status set not null;
alter table public.campaign_recipients drop constraint if exists campaign_recipients_delivery_status_check;
alter table public.campaign_recipients add constraint campaign_recipients_delivery_status_check check (
  delivery_status in ('pending', 'processing', 'accepted', 'delivered', 'delayed', 'opened', 'clicked', 'bounced', 'complained', 'suppressed', 'failed')
);

create or replace function public.sync_campaign_recipient_delivery_status()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'processing' and old.status is distinct from new.status
     and old.delivery_status in ('pending', 'processing') then
    new.delivery_status := 'processing';
  elsif new.status = 'sent' and old.status is distinct from new.status
     and old.delivery_status in ('pending', 'processing') then
    new.delivery_status := 'accepted';
    new.last_event_at := coalesce(new.last_event_at, new.sent_at, now());
  elsif new.status = 'failed' and old.status is distinct from new.status
     and old.delivery_status in ('pending', 'processing') then
    new.delivery_status := 'failed';
    new.last_event_at := coalesce(new.last_event_at, now());
  end if;
  return new;
end
$$;

drop trigger if exists campaign_recipients_delivery_status_sync on public.campaign_recipients;
create trigger campaign_recipients_delivery_status_sync
  before update of status on public.campaign_recipients
  for each row execute function public.sync_campaign_recipient_delivery_status();

create table if not exists public.campaign_email_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  recipient_id uuid not null references public.campaign_recipients(id) on delete cascade,
  webhook_id text not null unique check (char_length(webhook_id) between 1 and 200),
  provider_message_id text not null check (char_length(provider_message_id) between 1 and 200),
  event_type text not null check (event_type in ('sent', 'delivered', 'delivery_delayed', 'opened', 'clicked', 'bounced', 'complained', 'suppressed', 'failed')),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists campaign_email_events_campaign_created_idx
  on public.campaign_email_events(campaign_id, occurred_at desc);
create index if not exists campaign_email_events_recipient_created_idx
  on public.campaign_email_events(recipient_id, occurred_at desc);

alter table public.campaign_email_events enable row level security;
-- Deliberately no anon/authenticated policy. Dashboard owner actions read the
-- projection through the service role after tenant/owner authorization.

create or replace function public.queue_email_campaign_delivery_v2_atomic(
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
  p_segment_label text,
  p_content_mode text,
  p_template_id text,
  p_email_design jsonb
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
  queued record;
begin
  if p_channel <> 'email' then
    raise exception 'email queue only accepts email campaigns' using errcode = '22023';
  end if;
  if p_content_mode not in ('template', 'builder', 'html')
     or (p_content_mode = 'template' and (p_template_id not in ('minimal', 'announcement', 'offer') or p_email_design is not null))
     or (p_content_mode = 'html' and (p_template_id is not null or p_email_design is not null))
     or (p_content_mode = 'builder' and (p_template_id is not null or jsonb_typeof(p_email_design) <> 'object' or octet_length(p_email_design::text) > 100000)) then
    raise exception 'invalid email campaign design' using errcode = '22023';
  end if;
  if char_length(btrim(p_message_body)) < 5
     or char_length(p_message_body) > (case when p_content_mode = 'html' then 100000 else 5000 end) then
    raise exception 'invalid email campaign content length' using errcode = '22023';
  end if;

  select * into queued
  from public.queue_marketing_campaign_delivery_atomic(
    p_request_id, p_request_fingerprint, p_restaurant_id, p_channel, p_name,
    p_subject, p_message_body, p_segment_kind, p_builtin_segment,
    p_custom_segment_id, p_segment_definition, p_created_by, p_contacts,
    p_segment_label
  );

  update public.campaigns campaign
  set content_mode = p_content_mode,
      template_id = p_template_id,
      email_design = p_email_design
  where campaign.id = queued.campaign_id
    and campaign.restaurant_id = p_restaurant_id;

  return query select
    queued.campaign_id::uuid, queued.replayed::boolean,
    queued.recipient_count::integer, queued.skipped_consent_count::integer,
    queued.skipped_contact_count::integer, queued.skipped_duplicate_count::integer;
end
$$;

create or replace function public.record_resend_campaign_event(
  p_webhook_id text,
  p_provider_message_id text,
  p_event_type text,
  p_occurred_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient public.campaign_recipients;
  projected_status text;
begin
  if nullif(btrim(p_webhook_id), '') is null or char_length(p_webhook_id) > 200
     or nullif(btrim(p_provider_message_id), '') is null or char_length(p_provider_message_id) > 200
     or p_event_type not in ('sent', 'delivered', 'delivery_delayed', 'opened', 'clicked', 'bounced', 'complained', 'suppressed', 'failed')
     or p_occurred_at is null then
    raise exception 'invalid Resend campaign event' using errcode = '22023';
  end if;

  select * into recipient
  from public.campaign_recipients item
  where item.provider_message_id = p_provider_message_id
    and item.email is not null
  limit 1;
  if recipient.id is null then return false; end if;

  insert into public.campaign_email_events (
    restaurant_id, campaign_id, recipient_id, webhook_id,
    provider_message_id, event_type, occurred_at
  ) values (
    recipient.restaurant_id, recipient.campaign_id, recipient.id,
    p_webhook_id, p_provider_message_id, p_event_type, p_occurred_at
  ) on conflict (webhook_id) do nothing;
  if not found then return true; end if;

  projected_status := case p_event_type
    when 'sent' then 'accepted'
    when 'delivery_delayed' then 'delayed'
    else p_event_type
  end;
  update public.campaign_recipients item
  set delivery_status = case when item.last_event_at is null or p_occurred_at >= item.last_event_at then projected_status else item.delivery_status end,
      last_event_at = greatest(coalesce(item.last_event_at, p_occurred_at), p_occurred_at),
      opened_at = case when p_event_type = 'opened' then coalesce(item.opened_at, p_occurred_at) else item.opened_at end,
      clicked_at = case when p_event_type = 'clicked' then coalesce(item.clicked_at, p_occurred_at) else item.clicked_at end,
      error = case
        when p_event_type in ('bounced', 'complained', 'suppressed', 'failed') then 'provider_' || p_event_type
        else item.error
      end
  where item.id = recipient.id;
  return true;
end
$$;

revoke all on function public.queue_email_campaign_delivery_v2_atomic(
  uuid, text, uuid, text, text, text, text, text, text, uuid, jsonb, uuid, jsonb, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.queue_email_campaign_delivery_v2_atomic(
  uuid, text, uuid, text, text, text, text, text, text, uuid, jsonb, uuid, jsonb, text, text, text, jsonb
) to service_role;
revoke all on function public.record_resend_campaign_event(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_resend_campaign_event(text, text, text, timestamptz) to service_role;
revoke all on function public.sync_campaign_recipient_delivery_status() from public, anon, authenticated;
