-- The base atomic queue inserts before the email wrapper can stamp
-- content_mode. Allow the email transport maximum at the table boundary;
-- queue_email_campaign_delivery_atomic keeps the stricter 5k template and
-- 100k HTML limits before delegating to the base queue.

alter table public.campaigns drop constraint if exists campaigns_message_body_check;
alter table public.campaigns add constraint campaigns_message_body_check check (
  char_length(btrim(message_body)) between 1 and case
    when channel = 'sms' then 459
    else 100000
  end
);
