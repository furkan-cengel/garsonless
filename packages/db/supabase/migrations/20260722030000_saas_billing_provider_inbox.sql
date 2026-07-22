-- Verified SaaS subscription-provider webhook inbox.
-- The HTTP adapter verifies the iyzico signature and sends only an allowlisted
-- projection. This transaction resolves provider references to one tenant and
-- one local invoice before money transitions are allowed to run.

create or replace function public.ingest_subscription_billing_provider_event(
  p_provider_event_id text,
  p_event_type text,
  p_provider_customer_ref text,
  p_provider_subscription_ref text,
  p_provider_invoice_ref text,
  p_payload_sanitized jsonb,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.billing_provider_events%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_customer public.billing_customers%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_duplicate boolean := false;
  v_reason text;
begin
  if char_length(btrim(p_provider_event_id)) not between 1 and 200
    or p_event_type not in ('invoice.payment_succeeded', 'invoice.payment_failed')
    or char_length(btrim(p_provider_subscription_ref)) not between 1 and 200
    or char_length(btrim(p_provider_invoice_ref)) not between 1 and 200
    or char_length(btrim(p_payload_hash)) not between 1 and 200
    or jsonb_typeof(p_payload_sanitized) <> 'object'
    or pg_column_size(p_payload_sanitized) > 65536 then
    raise exception 'billing_provider_event_input_invalid' using errcode = '22023';
  end if;

  select s.* into v_subscription
  from public.billing_subscriptions s
  where s.provider = 'iyzico'
    and s.provider_subscription_ref = p_provider_subscription_ref;

  if found then
    select c.* into v_customer
    from public.billing_customers c
    where c.id = v_subscription.billing_customer_id;

    if p_provider_customer_ref is not null
      and btrim(p_provider_customer_ref) <> ''
      and v_customer.provider_customer_ref is distinct from p_provider_customer_ref then
      v_reason := 'provider_customer_reference_mismatch';
    else
      select i.* into v_invoice
      from public.subscription_invoices i
      where i.subscription_id = v_subscription.id
        and i.provider = 'iyzico'
        and i.provider_invoice_ref = p_provider_invoice_ref;
      if not found then
        v_reason := 'provider_invoice_mapping_missing';
      end if;
    end if;
  else
    v_reason := 'provider_subscription_mapping_missing';
  end if;

  insert into public.billing_provider_events (
    provider, provider_event_id, event_type, restaurant_id, subscription_id,
    payload_sanitized, payload_hash, status, last_error, available_at
  ) values (
    'iyzico', btrim(p_provider_event_id), p_event_type,
    v_subscription.restaurant_id, v_subscription.id,
    p_payload_sanitized, btrim(p_payload_hash),
    case when v_reason is null then 'received' else 'failed' end,
    v_reason, clock_timestamp()
  )
  on conflict (provider, provider_event_id) do nothing
  returning * into v_event;

  if not found then
    v_duplicate := true;
    select * into v_event
    from public.billing_provider_events
    where provider = 'iyzico' and provider_event_id = btrim(p_provider_event_id)
    for update;

    if v_event.event_type <> p_event_type or v_event.payload_hash <> btrim(p_payload_hash) then
      raise exception 'billing_provider_event_idempotency_conflict' using errcode = 'P0001';
    end if;

    -- A retry can become dispatchable after a delayed invoice mapping arrives.
    if v_event.status <> 'processed' and v_reason is null then
      update public.billing_provider_events
      set restaurant_id = v_subscription.restaurant_id,
          subscription_id = v_subscription.id,
          status = 'received',
          last_error = null,
          available_at = clock_timestamp()
      where id = v_event.id
      returning * into v_event;
    end if;
  end if;

  if v_reason is not null and v_event.status <> 'processed' then
    insert into public.billing_reconciliation_jobs (
      restaurant_id, subscription_id, provider, scope, dedupe_key, status,
      scheduled_at, local_snapshot, provider_snapshot_sanitized,
      discrepancy_code, last_error
    ) values (
      v_subscription.restaurant_id, v_subscription.id, 'iyzico', 'provider_event',
      'iyzico-event:' || btrim(p_provider_event_id), 'pending', clock_timestamp(),
      jsonb_strip_nulls(jsonb_build_object(
        'invoiceId', v_invoice.id,
        'providerInvoiceRef', p_provider_invoice_ref
      )),
      p_payload_sanitized, v_reason, v_reason
    )
    on conflict (dedupe_key) do update
    set status = case
          when public.billing_reconciliation_jobs.status = 'resolved' then 'resolved'
          else 'pending'
        end,
        scheduled_at = clock_timestamp(),
        provider_snapshot_sanitized = excluded.provider_snapshot_sanitized,
        discrepancy_code = excluded.discrepancy_code,
        last_error = excluded.last_error;
  end if;

  return jsonb_build_object(
    'providerEventId', v_event.id,
    'restaurantId', v_subscription.restaurant_id,
    'subscriptionId', v_subscription.id,
    'invoiceId', v_invoice.id,
    'amountMinor', v_invoice.amount_due_minor,
    'currency', case when v_invoice.id is null then null else v_invoice.currency end,
    'duplicate', v_duplicate,
    'dispatchable', v_reason is null and v_event.status <> 'processed',
    'alreadyProcessed', v_event.status = 'processed'
  );
end;
$$;

create or replace function public.mark_subscription_billing_provider_event_failed(
  p_provider_event_id uuid,
  p_reason text,
  p_provider_snapshot_sanitized jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.billing_provider_events%rowtype;
begin
  if char_length(btrim(p_reason)) not between 1 and 1000
    or jsonb_typeof(p_provider_snapshot_sanitized) <> 'object'
    or pg_column_size(p_provider_snapshot_sanitized) > 65536 then
    raise exception 'billing_provider_event_failure_input_invalid' using errcode = '22023';
  end if;

  select * into v_event
  from public.billing_provider_events
  where id = p_provider_event_id
  for update;
  if not found then
    raise exception 'billing_provider_event_not_found' using errcode = 'P0002';
  end if;
  if v_event.status = 'processed' then return true; end if;

  update public.billing_provider_events
  set status = case when attempts + 1 >= 10 then 'dead_lettered' else 'failed' end,
      attempts = attempts + 1,
      available_at = clock_timestamp() + make_interval(mins => least(60, attempts + 1)),
      locked_at = null,
      locked_by = null,
      last_error = btrim(p_reason)
  where id = p_provider_event_id;

  insert into public.billing_reconciliation_jobs (
    restaurant_id, subscription_id, provider, scope, dedupe_key, status,
    scheduled_at, local_snapshot, provider_snapshot_sanitized,
    discrepancy_code, last_error
  ) values (
    v_event.restaurant_id, v_event.subscription_id, 'iyzico', 'provider_event',
    'iyzico-event:' || v_event.provider_event_id, 'pending', clock_timestamp(),
    '{}'::jsonb, p_provider_snapshot_sanitized,
    'provider_event_dispatch_failed', btrim(p_reason)
  )
  on conflict (dedupe_key) do update
  set status = case
        when public.billing_reconciliation_jobs.status = 'resolved' then 'resolved'
        else 'pending'
      end,
      scheduled_at = clock_timestamp(),
      provider_snapshot_sanitized = excluded.provider_snapshot_sanitized,
      discrepancy_code = excluded.discrepancy_code,
      last_error = excluded.last_error;
  return true;
end;
$$;

revoke all on function public.ingest_subscription_billing_provider_event(
  text, text, text, text, text, jsonb, text
) from public, anon, authenticated;
revoke all on function public.mark_subscription_billing_provider_event_failed(
  uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function public.ingest_subscription_billing_provider_event(
  text, text, text, text, text, jsonb, text
) to service_role;
grant execute on function public.mark_subscription_billing_provider_event_failed(
  uuid, text, jsonb
) to service_role;

comment on function public.ingest_subscription_billing_provider_event(
  text, text, text, text, text, jsonb, text
) is 'Durably ingests a signature-verified, redacted SaaS billing event and resolves it to one local invoice.';
