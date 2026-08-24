-- Email campaign presentation metadata. The existing atomic queue remains the
-- consent/tenant boundary; this wrapper records the selected email design in
-- the same transaction before the outbox consumer can claim the event.

alter table public.campaigns
  add column if not exists content_mode text not null default 'plain',
  add column if not exists template_id text;

alter table public.campaigns drop constraint if exists campaigns_content_mode_check;
alter table public.campaigns add constraint campaigns_content_mode_check check (
  (channel = 'sms' and content_mode = 'plain' and template_id is null)
  or (channel = 'email' and content_mode = 'plain' and template_id is null)
  or (channel = 'email' and content_mode = 'html' and template_id is null)
  or (channel = 'email' and content_mode = 'template' and template_id in ('minimal', 'announcement', 'offer'))
);

alter table public.campaigns drop constraint if exists campaigns_message_body_check;
alter table public.campaigns add constraint campaigns_message_body_check check (
  char_length(btrim(message_body)) between 1 and case
    when channel = 'sms' then 459
    when content_mode = 'html' then 100000
    else 5000
  end
);

create or replace function public.queue_email_campaign_delivery_atomic(
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
  p_template_id text
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
  if p_content_mode not in ('template', 'html')
     or (p_content_mode = 'template' and p_template_id not in ('minimal', 'announcement', 'offer'))
     or (p_content_mode = 'html' and p_template_id is not null) then
    raise exception 'invalid email campaign design' using errcode = '22023';
  end if;
  if char_length(btrim(p_message_body)) < 5
     or char_length(p_message_body) > (case when p_content_mode = 'html' then 100000 else 5000 end) then
    raise exception 'invalid email campaign content length' using errcode = '22023';
  end if;

  select * into queued
  from public.queue_marketing_campaign_delivery_atomic(
    p_request_id,
    p_request_fingerprint,
    p_restaurant_id,
    p_channel,
    p_name,
    p_subject,
    p_message_body,
    p_segment_kind,
    p_builtin_segment,
    p_custom_segment_id,
    p_segment_definition,
    p_created_by,
    p_contacts,
    p_segment_label
  );

  update public.campaigns campaign
  set content_mode = p_content_mode,
      template_id = p_template_id
  where campaign.id = queued.campaign_id
    and campaign.restaurant_id = p_restaurant_id;

  return query select
    queued.campaign_id::uuid,
    queued.replayed::boolean,
    queued.recipient_count::integer,
    queued.skipped_consent_count::integer,
    queued.skipped_contact_count::integer,
    queued.skipped_duplicate_count::integer;
end
$$;

revoke all on function public.queue_email_campaign_delivery_atomic(
  uuid, text, uuid, text, text, text, text, text, text, uuid, jsonb, uuid, jsonb, text, text, text
) from public, anon, authenticated;
grant execute on function public.queue_email_campaign_delivery_atomic(
  uuid, text, uuid, text, text, text, text, text, text, uuid, jsonb, uuid, jsonb, text, text, text
) to service_role;
