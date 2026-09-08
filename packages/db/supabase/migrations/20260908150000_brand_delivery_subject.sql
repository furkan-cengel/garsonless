-- Match future invoice delivery subjects to the lowercase brand used in outgoing emails.
create or replace function public.record_accounting_invoice_email_delivery(
  p_job_id uuid,
  p_provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.accounting_invoice_jobs%rowtype;
  v_owner_id uuid;
  v_email text;
begin
  if p_job_id is null
    or coalesce(char_length(btrim(p_provider_message_id)), 0) not between 1 and 200 then
    raise exception 'accounting_email_delivery_input_invalid' using errcode = '22023';
  end if;
  select job.*
  into v_job
  from public.accounting_invoice_jobs job
  join public.restaurants restaurant on restaurant.id = job.restaurant_id
  where job.id = p_job_id and job.status = 'processing'
  for update of job;
  if not found then return false; end if;
  select restaurant.owner_id into v_owner_id
  from public.restaurants restaurant
  where restaurant.id = v_job.restaurant_id;
  v_email := nullif(btrim(v_job.billing_profile_snapshot ->> 'email'), '');
  if v_email is null then
    raise exception 'accounting_email_recipient_missing' using errcode = '55000';
  end if;

  insert into public.notification_deliveries (
    outbox_id, restaurant_id, recipient_user_id, channel, category,
    dedupe_key, recipient_address, subject, status, attempts,
    provider_message_id, provider_delivery_status, provider_event_at,
    last_error, sent_at, updated_at
  ) values (
    null, v_job.restaurant_id, v_owner_id, 'email', 'billing',
    'fiscal_document.ready:' || v_job.subscription_invoice_id,
    v_email, 'masabu abonelik faturanız', 'sent', greatest(v_job.attempts, 1),
    btrim(p_provider_message_id), 'sent', clock_timestamp(),
    null, clock_timestamp(), clock_timestamp()
  ) on conflict (recipient_user_id, dedupe_key, channel) do update set
    recipient_address = excluded.recipient_address,
    status = 'sent',
    attempts = greatest(public.notification_deliveries.attempts, excluded.attempts),
    provider_message_id = excluded.provider_message_id,
    provider_delivery_status = coalesce(public.notification_deliveries.provider_delivery_status, 'sent'),
    provider_event_at = coalesce(public.notification_deliveries.provider_event_at, excluded.provider_event_at),
    last_error = null,
    sent_at = coalesce(public.notification_deliveries.sent_at, excluded.sent_at),
    updated_at = clock_timestamp()
  where public.notification_deliveries.restaurant_id = excluded.restaurant_id;
  return true;
end;
$$;
