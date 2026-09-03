-- Complete the Paraşüt V4 fiscal-document contract. The rotating OAuth refresh
-- token lives in Supabase Vault, while queue rows retain only non-secret
-- provider identities needed to resume asynchronous formalization safely.

begin;

alter table public.accounting_invoice_jobs
  add column provider_document_ref text;

create table public.accounting_provider_oauth_leases (
  provider text primary key check (provider = 'parasut'),
  token_version bigint not null default 0 check (token_version >= 0),
  locked_at timestamptz,
  locked_by text check (locked_by is null or char_length(locked_by) between 1 and 100),
  updated_at timestamptz not null default now(),
  check ((locked_at is null) = (locked_by is null))
);

insert into public.accounting_provider_oauth_leases(provider)
values ('parasut') on conflict (provider) do nothing;

alter table public.accounting_provider_oauth_leases enable row level security;
alter table public.accounting_provider_oauth_leases force row level security;
revoke all on public.accounting_provider_oauth_leases from public, anon, authenticated;
grant select, insert, update on public.accounting_provider_oauth_leases to service_role;

create function public.initialize_parasut_refresh_token(p_refresh_token text)
returns boolean
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare v_secret_id uuid;
begin
  if char_length(coalesce(p_refresh_token, '')) not between 20 and 4000 then
    raise exception 'parasut_refresh_token_invalid' using errcode = '22023';
  end if;
  select id into v_secret_id
  from vault.decrypted_secrets where name = 'parasut_refresh_token';
  if v_secret_id is not null then return false; end if;
  perform vault.create_secret(
    p_refresh_token,
    'parasut_refresh_token',
    'Rotating OAuth refresh token for the central Masabu Paraşüt company'
  );
  return true;
end;
$$;

create function public.configure_parasut_refresh_token(p_refresh_token text)
returns boolean
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare v_secret_id uuid;
begin
  if char_length(coalesce(p_refresh_token, '')) not between 20 and 4000 then
    raise exception 'parasut_refresh_token_invalid' using errcode = '22023';
  end if;
  select id into v_secret_id
  from vault.decrypted_secrets where name = 'parasut_refresh_token';
  if v_secret_id is null then
    perform vault.create_secret(
      p_refresh_token,
      'parasut_refresh_token',
      'Rotating OAuth refresh token for the central Masabu Paraşüt company'
    );
  else
    perform vault.update_secret(
      v_secret_id,
      p_refresh_token,
      'parasut_refresh_token',
      'Rotating OAuth refresh token for the central Masabu Paraşüt company'
    );
  end if;
  update public.accounting_provider_oauth_leases
  set token_version = token_version + 1,
      locked_at = null,
      locked_by = null,
      updated_at = clock_timestamp()
  where provider = 'parasut';
  return true;
end;
$$;

create function public.claim_parasut_refresh_token(
  p_worker_id text,
  p_lease_seconds integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_lease public.accounting_provider_oauth_leases%rowtype;
  v_refresh_token text;
begin
  if char_length(btrim(coalesce(p_worker_id, ''))) not between 1 and 100
    or p_lease_seconds not between 5 and 120 then
    raise exception 'parasut_token_claim_invalid' using errcode = '22023';
  end if;
  update public.accounting_provider_oauth_leases
  set locked_at = clock_timestamp(),
      locked_by = btrim(p_worker_id),
      updated_at = clock_timestamp()
  where provider = 'parasut'
    and (locked_at is null
      or locked_at <= clock_timestamp() - make_interval(secs => p_lease_seconds))
  returning * into v_lease;
  if not found then return null; end if;

  select decrypted_secret into v_refresh_token
  from vault.decrypted_secrets where name = 'parasut_refresh_token';
  if nullif(v_refresh_token, '') is null then
    update public.accounting_provider_oauth_leases
    set locked_at = null, locked_by = null, updated_at = clock_timestamp()
    where provider = 'parasut' and locked_by = btrim(p_worker_id);
    raise exception 'parasut_refresh_token_missing' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'refreshToken', v_refresh_token,
    'version', v_lease.token_version
  );
end;
$$;

create function public.rotate_parasut_refresh_token(
  p_worker_id text,
  p_expected_version bigint,
  p_refresh_token text
)
returns boolean
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare v_secret_id uuid;
begin
  if char_length(btrim(coalesce(p_worker_id, ''))) not between 1 and 100
    or p_expected_version < 0
    or char_length(coalesce(p_refresh_token, '')) not between 20 and 4000 then
    raise exception 'parasut_token_rotation_invalid' using errcode = '22023';
  end if;
  perform 1 from public.accounting_provider_oauth_leases
  where provider = 'parasut'
    and locked_by = btrim(p_worker_id)
    and token_version = p_expected_version
  for update;
  if not found then return false; end if;
  select id into v_secret_id
  from vault.decrypted_secrets where name = 'parasut_refresh_token';
  if v_secret_id is null then
    raise exception 'parasut_refresh_token_missing' using errcode = 'P0002';
  end if;
  perform vault.update_secret(
    v_secret_id,
    p_refresh_token,
    'parasut_refresh_token',
    'Rotating OAuth refresh token for the central Masabu Paraşüt company'
  );
  update public.accounting_provider_oauth_leases
  set token_version = token_version + 1,
      locked_at = null,
      locked_by = null,
      updated_at = clock_timestamp()
  where provider = 'parasut'
    and locked_by = btrim(p_worker_id)
    and token_version = p_expected_version;
  return found;
end;
$$;

create function public.release_parasut_refresh_token(
  p_worker_id text,
  p_expected_version bigint
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.accounting_provider_oauth_leases
  set locked_at = null, locked_by = null, updated_at = clock_timestamp()
  where provider = 'parasut'
    and locked_by = btrim(p_worker_id)
    and token_version = p_expected_version;
  return found;
end;
$$;

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
    'paidAt', new.paid_at,
    'plan', new.plan,
    'addOns', new.add_ons,
    'billingInterval', new.billing_interval
  );
  v_ready := found
    and new.paid_at is not null
    and coalesce(char_length(btrim(v_customer.legal_name)), 0) > 0
    and coalesce(char_length(btrim(v_customer.identity_number)), 0) in (10, 11)
    and coalesce(char_length(btrim(v_customer.billing_address->>'taxOffice')), 0) > 0
    and coalesce(char_length(btrim(v_customer.billing_address->>'address')), 0) > 0
    and coalesce(char_length(btrim(v_customer.billing_address->>'city')), 0) > 0
    and coalesce(char_length(btrim(v_customer.billing_address->>'district')), 0) > 0
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

create or replace function public.requeue_accounting_jobs_after_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(char_length(btrim(new.legal_name)), 0) > 0
    and coalesce(char_length(btrim(new.identity_number)), 0) in (10, 11)
    and coalesce(char_length(btrim(new.billing_address->>'taxOffice')), 0) > 0
    and coalesce(char_length(btrim(new.billing_address->>'address')), 0) > 0
    and coalesce(char_length(btrim(new.billing_address->>'city')), 0) > 0
    and coalesce(char_length(btrim(new.billing_address->>'district')), 0) > 0
    and coalesce(char_length(btrim(new.contact_email)), 0) > 0 then
    update public.accounting_invoice_jobs job
    set status = 'pending',
        available_at = clock_timestamp(),
        updated_at = clock_timestamp(),
        billing_profile_snapshot = billing_profile_snapshot || jsonb_build_object(
          'legalName', new.legal_name,
          'name', new.contact_name,
          'surname', new.contact_surname,
          'identityNumber', new.identity_number,
          'taxOffice', new.billing_address->>'taxOffice',
          'email', new.contact_email,
          'billingAddress', new.billing_address
        ),
        last_error_code = null
    from public.billing_subscriptions subscription
    where job.restaurant_id = new.restaurant_id
      and job.status = 'needs_profile'
      and subscription.restaurant_id = new.restaurant_id
      and subscription.billing_customer_id = new.id
      and subscription.id = (
        select invoice.subscription_id
        from public.subscription_invoices invoice
        where invoice.id = job.subscription_invoice_id
      )
      and nullif(job.billing_profile_snapshot->>'paidAt', '') is not null;
  end if;
  return new;
end;
$$;

update public.accounting_invoice_jobs job
set billing_profile_snapshot = job.billing_profile_snapshot || jsonb_build_object(
      'paidAt', invoice.paid_at,
      'addOns', invoice.add_ons
    ),
    updated_at = clock_timestamp()
from public.subscription_invoices invoice
where invoice.id = job.subscription_invoice_id
  and invoice.restaurant_id = job.restaurant_id;

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
    update public.accounting_invoice_jobs job
    set status = 'processing', locked_at = clock_timestamp(), locked_by = btrim(p_worker_id),
        attempts = attempts + 1, updated_at = clock_timestamp()
    from candidates candidate where job.id = candidate.id
    returning jsonb_build_object(
      'id', job.id, 'restaurantId', job.restaurant_id,
      'subscriptionInvoiceId', job.subscription_invoice_id,
      'amountMinor', job.amount_minor, 'currency', job.currency,
      'profile', job.billing_profile_snapshot, 'attempts', job.attempts,
      'providerContactRef', job.provider_contact_ref,
      'providerInvoiceRef', job.provider_invoice_ref,
      'providerTaskRef', job.provider_task_ref,
      'providerDocumentRef', job.provider_document_ref,
      'fiscalDocumentType', job.fiscal_document_type
    ) as row
  ) select coalesce(jsonb_agg(row), '[]'::jsonb) into v_result from claimed;
  return v_result;
end;
$$;

create function public.checkpoint_accounting_invoice_job(
  p_job_id uuid,
  p_worker_id text,
  p_provider_contact_ref text,
  p_provider_invoice_ref text,
  p_provider_task_ref text,
  p_provider_document_ref text,
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
    provider_document_ref = coalesce(nullif(btrim(p_provider_document_ref), ''), provider_document_ref),
    fiscal_document_type = coalesce(p_fiscal_document_type, fiscal_document_type),
    updated_at = clock_timestamp()
  where id = p_job_id and status = 'processing' and locked_by = btrim(p_worker_id)
    and (p_fiscal_document_type is null or p_fiscal_document_type in ('e_fatura', 'e_arsiv'));
  return found;
end;
$$;

create function public.complete_accounting_invoice_job(
  p_job_id uuid,
  p_worker_id text,
  p_provider_contact_ref text,
  p_provider_invoice_ref text,
  p_provider_document_ref text,
  p_fiscal_document_type text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_job public.accounting_invoice_jobs%rowtype;
begin
  if p_fiscal_document_type not in ('e_fatura', 'e_arsiv')
    or nullif(btrim(p_provider_document_ref), '') is null then
    raise exception 'accounting_document_identity_invalid' using errcode = '22023';
  end if;
  update public.accounting_invoice_jobs set
    status = 'succeeded',
    provider_contact_ref = btrim(p_provider_contact_ref),
    provider_invoice_ref = btrim(p_provider_invoice_ref),
    provider_document_ref = btrim(p_provider_document_ref),
    fiscal_document_type = p_fiscal_document_type,
    completed_at = clock_timestamp(), locked_at = null, locked_by = null,
    last_error_code = null, updated_at = clock_timestamp()
  where id = p_job_id and status = 'processing' and locked_by = btrim(p_worker_id)
  returning * into v_job;
  if not found then return false; end if;

  perform public.enqueue_domain_outbox_event(
    v_job.restaurant_id, 'billing_invoice', v_job.subscription_invoice_id,
    'fiscal_document.ready',
    jsonb_build_object(
      'accountingJobId', v_job.id,
      'invoiceId', v_job.subscription_invoice_id,
      'fiscalDocumentType', v_job.fiscal_document_type,
      'semanticVersion', 1
    ),
    'billing:fiscal-document-ready:v1:' || v_job.subscription_invoice_id
  );
  return true;
end;
$$;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create function public.invoke_accounting_invoice_worker()
returns bigint
language plpgsql
security definer
set search_path = public, vault, net, pg_temp
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'accounting_worker_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'accounting_worker_secret';

  if nullif(btrim(v_url), '') is null then
    raise exception 'Missing Vault secret: accounting_worker_url' using errcode = 'P0001';
  end if;
  if nullif(btrim(v_secret), '') is null then
    raise exception 'Missing Vault secret: accounting_worker_secret' using errcode = 'P0001';
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) into v_request_id;
  return v_request_id;
end;
$$;

create function public.configure_accounting_invoice_worker_vault(
  p_url text,
  p_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault, cron, pg_temp
as $$
declare
  v_url_id uuid;
  v_secret_id uuid;
  v_job_id bigint;
begin
  if p_url !~ '^https://[a-z0-9-]+\.masabu\.co/api/internal/accounting-invoices$' then
    raise exception 'Invalid accounting worker URL' using errcode = '22023';
  end if;
  if char_length(coalesce(p_secret, '')) < 32 then
    raise exception 'Accounting worker secret must be at least 32 characters' using errcode = '22023';
  end if;

  select id into v_url_id
  from vault.decrypted_secrets where name = 'accounting_worker_url';
  if v_url_id is null then
    perform vault.create_secret(
      p_url,
      'accounting_worker_url',
      'Scheduled Masabu accounting invoice worker URL'
    );
  else
    perform vault.update_secret(
      v_url_id,
      p_url,
      'accounting_worker_url',
      'Scheduled Masabu accounting invoice worker URL'
    );
  end if;

  select id into v_secret_id
  from vault.decrypted_secrets where name = 'accounting_worker_secret';
  if v_secret_id is null then
    perform vault.create_secret(
      p_secret,
      'accounting_worker_secret',
      'Bearer secret for the scheduled Masabu accounting invoice worker'
    );
  else
    perform vault.update_secret(
      v_secret_id,
      p_secret,
      'accounting_worker_secret',
      'Bearer secret for the scheduled Masabu accounting invoice worker'
    );
  end if;

  select jobid into v_job_id
  from cron.job where jobname = 'accounting-invoice-worker-every-minute';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'accounting-invoice-worker-every-minute',
    '* * * * *',
    'select public.invoke_accounting_invoice_worker();'
  );

  return jsonb_build_object(
    'urlConfigured', true,
    'secretConfigured', true,
    'cronActive', true
  );
end;
$$;

revoke all on function public.initialize_parasut_refresh_token(text) from public, anon, authenticated;
revoke all on function public.configure_parasut_refresh_token(text) from public, anon, authenticated;
revoke all on function public.claim_parasut_refresh_token(text,integer) from public, anon, authenticated;
revoke all on function public.rotate_parasut_refresh_token(text,bigint,text) from public, anon, authenticated;
revoke all on function public.release_parasut_refresh_token(text,bigint) from public, anon, authenticated;
revoke all on function public.checkpoint_accounting_invoice_job(uuid,text,text,text,text,text,text)
  from public, anon, authenticated;
revoke all on function public.complete_accounting_invoice_job(uuid,text,text,text,text,text)
  from public, anon, authenticated;
revoke all on function public.invoke_accounting_invoice_worker()
  from public, anon, authenticated;
revoke all on function public.configure_accounting_invoice_worker_vault(text,text)
  from public, anon, authenticated;
grant execute on function public.initialize_parasut_refresh_token(text) to service_role;
grant execute on function public.configure_parasut_refresh_token(text) to service_role;
grant execute on function public.claim_parasut_refresh_token(text,integer) to service_role;
grant execute on function public.rotate_parasut_refresh_token(text,bigint,text) to service_role;
grant execute on function public.release_parasut_refresh_token(text,bigint) to service_role;
grant execute on function public.checkpoint_accounting_invoice_job(uuid,text,text,text,text,text,text)
  to service_role;
grant execute on function public.complete_accounting_invoice_job(uuid,text,text,text,text,text)
  to service_role;
grant execute on function public.invoke_accounting_invoice_worker() to service_role;
grant execute on function public.configure_accounting_invoice_worker_vault(text,text)
  to service_role;

comment on column public.accounting_invoice_jobs.provider_document_ref is
  'Paraşüt e_invoices/e_archives identity; distinct from the expiring trackable job identity.';
comment on table public.accounting_provider_oauth_leases is
  'Service-only lease metadata for atomically rotating the Paraşüt refresh token stored in Vault.';

commit;
