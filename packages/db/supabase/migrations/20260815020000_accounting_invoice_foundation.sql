-- Paid SaaS invoices enqueue fiscal-document work without delaying entitlement
-- activation. The queue and its snapshots are service-role only.
create table public.accounting_invoice_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  subscription_invoice_id uuid not null unique,
  status text not null check (status in (
    'pending', 'processing', 'retry', 'needs_profile', 'succeeded', 'failed'
  )),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency = 'TRY'),
  billing_profile_snapshot jsonb not null,
  provider_contact_ref text,
  provider_invoice_ref text,
  provider_task_ref text,
  fiscal_document_type text check (fiscal_document_type is null or fiscal_document_type in ('e_fatura', 'e_arsiv')),
  attempts integer not null default 0 check (attempts between 0 and 25),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text check (locked_by is null or char_length(locked_by) between 1 and 100),
  completed_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, subscription_invoice_id)
    references public.subscription_invoices(restaurant_id, id) on delete restrict
);

create index accounting_invoice_jobs_claim_idx
  on public.accounting_invoice_jobs(status, available_at, created_at)
  where status in ('pending', 'retry');

create table public.accounting_review_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  subscription_id uuid not null,
  reason text not null check (reason in ('subscription_cancelled', 'refund_reported')),
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved')),
  source_key text not null unique check (char_length(source_key) between 1 and 200),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (restaurant_id, subscription_id)
    references public.billing_subscriptions(restaurant_id, id) on delete restrict
);

create or replace function public.enqueue_accounting_invoice_job()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.billing_customers%rowtype;
  v_snapshot jsonb;
  v_ready boolean;
begin
  if new.status <> 'paid' or (tg_op = 'UPDATE' and old.status = 'paid') then
    return new;
  end if;

  select c.* into v_customer
  from public.billing_customers c
  join public.billing_subscriptions s on s.billing_customer_id = c.id
  where s.id = new.subscription_id and c.restaurant_id = new.restaurant_id;

  v_snapshot := jsonb_build_object(
    'legalName', v_customer.legal_name,
    'name', v_customer.contact_name,
    'surname', v_customer.contact_surname,
    'identityNumber', v_customer.identity_number,
    'taxOffice', v_customer.billing_address->>'taxOffice',
    'email', v_customer.contact_email,
    'billingAddress', v_customer.billing_address,
    'periodStart', new.period_start,
    'periodEnd', new.period_end,
    'plan', new.plan,
    'billingInterval', new.billing_interval
  );
  v_ready := found
    and coalesce(char_length(btrim(v_customer.legal_name)), 0) > 0
    and coalesce(char_length(btrim(v_customer.identity_number)), 0) in (10, 11)
    and coalesce(char_length(btrim(v_customer.billing_address->>'taxOffice')), 0) > 0
    and coalesce(char_length(btrim(v_customer.contact_email)), 0) > 0;

  insert into public.accounting_invoice_jobs (
    restaurant_id, subscription_invoice_id, status, amount_minor, currency,
    billing_profile_snapshot
  ) values (
    new.restaurant_id, new.id, case when v_ready then 'pending' else 'needs_profile' end,
    new.amount_paid_minor, new.currency, coalesce(v_snapshot, '{}'::jsonb)
  ) on conflict (subscription_invoice_id) do nothing;
  return new;
end;
$$;

create trigger subscription_invoice_accounting_enqueue
  after insert or update of status on public.subscription_invoices
  for each row execute function public.enqueue_accounting_invoice_job();

create or replace function public.requeue_accounting_jobs_after_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(char_length(btrim(new.billing_address->>'taxOffice')), 0) > 0 then
    update public.accounting_invoice_jobs j
    set status = 'pending', available_at = clock_timestamp(), updated_at = clock_timestamp(),
        billing_profile_snapshot = billing_profile_snapshot || jsonb_build_object(
          'legalName', new.legal_name, 'name', new.contact_name,
          'surname', new.contact_surname, 'identityNumber', new.identity_number,
          'taxOffice', new.billing_address->>'taxOffice', 'email', new.contact_email,
          'billingAddress', new.billing_address
        ), last_error_code = null
    from public.billing_subscriptions s
    where j.restaurant_id = new.restaurant_id
      and j.status = 'needs_profile'
      and s.restaurant_id = new.restaurant_id
      and s.billing_customer_id = new.id
      and s.id = (select i.subscription_id from public.subscription_invoices i where i.id = j.subscription_invoice_id);
  end if;
  return new;
end;
$$;

create trigger billing_customer_accounting_requeue
  after update on public.billing_customers
  for each row execute function public.requeue_accounting_jobs_after_profile_update();

create or replace function public.claim_accounting_invoice_jobs(
  p_worker_id text,
  p_limit integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  if char_length(btrim(p_worker_id)) not between 1 and 100 or p_limit not between 1 and 20 then
    raise exception 'accounting_claim_invalid' using errcode = '22023';
  end if;
  with candidates as (
    select id from public.accounting_invoice_jobs
    where status in ('pending', 'retry') and available_at <= clock_timestamp()
      and (locked_at is null or locked_at < clock_timestamp() - interval '15 minutes')
    order by available_at, created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.accounting_invoice_jobs j
    set status = 'processing', locked_at = clock_timestamp(), locked_by = btrim(p_worker_id),
        attempts = attempts + 1, updated_at = clock_timestamp()
    from candidates c where j.id = c.id
    returning jsonb_build_object(
      'id', j.id, 'restaurantId', j.restaurant_id,
      'subscriptionInvoiceId', j.subscription_invoice_id,
      'amountMinor', j.amount_minor, 'currency', j.currency,
      'profile', j.billing_profile_snapshot, 'attempts', j.attempts,
      'providerContactRef', j.provider_contact_ref,
      'providerInvoiceRef', j.provider_invoice_ref,
      'providerTaskRef', j.provider_task_ref,
      'fiscalDocumentType', j.fiscal_document_type
    ) as row
  ) select coalesce(jsonb_agg(row), '[]'::jsonb) into v_result from claimed;
  return v_result;
end;
$$;

create or replace function public.checkpoint_accounting_invoice_job(
  p_job_id uuid,
  p_worker_id text,
  p_provider_contact_ref text,
  p_provider_invoice_ref text,
  p_provider_task_ref text,
  p_fiscal_document_type text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.accounting_invoice_jobs set
    provider_contact_ref = coalesce(nullif(btrim(p_provider_contact_ref), ''), provider_contact_ref),
    provider_invoice_ref = coalesce(nullif(btrim(p_provider_invoice_ref), ''), provider_invoice_ref),
    provider_task_ref = coalesce(nullif(btrim(p_provider_task_ref), ''), provider_task_ref),
    fiscal_document_type = coalesce(p_fiscal_document_type, fiscal_document_type),
    updated_at = clock_timestamp()
  where id = p_job_id and status = 'processing' and locked_by = btrim(p_worker_id)
    and (p_fiscal_document_type is null or p_fiscal_document_type in ('e_fatura', 'e_arsiv'));
  return found;
end;
$$;

create or replace function public.complete_accounting_invoice_job(
  p_job_id uuid,
  p_worker_id text,
  p_provider_contact_ref text,
  p_provider_invoice_ref text,
  p_fiscal_document_type text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_fiscal_document_type not in ('e_fatura', 'e_arsiv') then
    raise exception 'accounting_document_type_invalid' using errcode = '22023';
  end if;
  update public.accounting_invoice_jobs set
    status = 'succeeded', provider_contact_ref = btrim(p_provider_contact_ref),
    provider_invoice_ref = btrim(p_provider_invoice_ref), fiscal_document_type = p_fiscal_document_type,
    completed_at = clock_timestamp(), locked_at = null, locked_by = null,
    last_error_code = null, updated_at = clock_timestamp()
  where id = p_job_id and status = 'processing' and locked_by = btrim(p_worker_id);
  return found;
end;
$$;

create or replace function public.fail_accounting_invoice_job(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text,
  p_retryable boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if char_length(btrim(p_error_code)) not between 1 and 100 then
    raise exception 'accounting_failure_code_invalid' using errcode = '22023';
  end if;
  update public.accounting_invoice_jobs set
    status = case when p_retryable and attempts < 25 then 'retry' else 'failed' end,
    available_at = case when p_retryable then clock_timestamp() + make_interval(mins => least(360, attempts * attempts * 5)) else available_at end,
    locked_at = null, locked_by = null, last_error_code = btrim(p_error_code), updated_at = clock_timestamp()
  where id = p_job_id and status = 'processing' and locked_by = btrim(p_worker_id);
  return found;
end;
$$;

create or replace function public.enqueue_accounting_cancellation_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    insert into public.accounting_review_jobs (
      restaurant_id, subscription_id, reason, source_key
    ) values (
      new.restaurant_id, new.id, 'subscription_cancelled', 'subscription-cancelled:' || new.id
    ) on conflict (source_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger billing_subscription_accounting_review
  after update of status on public.billing_subscriptions
  for each row execute function public.enqueue_accounting_cancellation_review();

alter table public.accounting_invoice_jobs enable row level security;
alter table public.accounting_review_jobs enable row level security;
revoke all on public.accounting_invoice_jobs, public.accounting_review_jobs from public, anon, authenticated;
grant select, insert, update on public.accounting_invoice_jobs to service_role;
grant select, insert, update on public.accounting_review_jobs to service_role;
revoke all on function public.claim_accounting_invoice_jobs(text,integer) from public, anon, authenticated;
revoke all on function public.complete_accounting_invoice_job(uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.fail_accounting_invoice_job(uuid,text,text,boolean) from public, anon, authenticated;
revoke all on function public.checkpoint_accounting_invoice_job(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_accounting_invoice_jobs(text,integer) to service_role;
grant execute on function public.complete_accounting_invoice_job(uuid,text,text,text,text) to service_role;
grant execute on function public.fail_accounting_invoice_job(uuid,text,text,boolean) to service_role;
grant execute on function public.checkpoint_accounting_invoice_job(uuid,text,text,text,text,text) to service_role;

comment on table public.accounting_invoice_jobs is
  'Service-only Paraşüt fiscal document queue; paid subscriptions remain active while jobs retry.';
