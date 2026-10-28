-- ÖKC (fiscal cash register) integration, first provider TokenX (Token / Beko).
--
-- A restaurant that switches the integration on gets one "fiscal document" per
-- open bill: the device basket. Any change to the bill's orders marks the
-- document pending; a worker (dashboard /api/internal/fiscal-sync) sends the
-- basket and records which orders it contained. The device takes payment and
-- its webhook settles exactly those orders, with settlement_source 'okc' and
-- no settled_by (the cashier is a device operator, not a Masabu user).
-- See docs/okc-integration.md.

alter table public.orders
  add column settlement_source text check (settlement_source in ('okc'));

create table public.restaurant_fiscal_settings (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  provider text not null check (provider in ('tokenx')),
  enabled boolean not null default false,
  merchant_id text check (merchant_id ~ '^[A-Za-z0-9-]{2,64}$'),
  branch_id text check (branch_id ~ '^[A-Za-z0-9-]{2,64}$'),
  terminal_id text check (terminal_id ~ '^[A-Za-z0-9-]{2,64}$'),
  -- Device VAT sections as last read from the device, and owner picks per rate ("1000" → sectionNo).
  sections jsonb not null default '[]' check (jsonb_typeof(sections) = 'array'),
  section_overrides jsonb not null default '{}' check (jsonb_typeof(section_overrides) = 'object'),
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (not enabled or (branch_id is not null and terminal_id is not null and verified_at is not null))
);
alter table public.restaurant_fiscal_settings enable row level security;
revoke all on table public.restaurant_fiscal_settings from public, anon, authenticated;
grant all on table public.restaurant_fiscal_settings to service_role;

create table public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_session_id uuid not null references public.table_sessions(id) on delete cascade,
  provider text not null check (provider in ('tokenx')),
  basket_id uuid not null unique default gen_random_uuid(),
  -- pending: to send · synced: on the device · held: cannot be sent (see held_reason)
  -- deleted: bill closed unpaid, basket removed · completed: paid on the device
  -- voided: receipt cancelled on the device after payment · failed: gave up, needs a person
  status text not null default 'pending'
    check (status in ('pending', 'synced', 'held', 'deleted', 'completed', 'voided', 'failed')),
  revision integer not null default 1,
  synced_revision integer not null default 0,
  synced_order_ids uuid[] not null default '{}',
  held_reason text,
  locked_by text,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 200),
  terminal_id text,
  receipt_no text,
  z_no text,
  payments jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- At most one basket in play per bill; paid, voided or deleted ones are history.
create unique index fiscal_documents_one_open_per_session on public.fiscal_documents(table_session_id)
  where status in ('pending', 'synced', 'held', 'failed');
create index fiscal_documents_due on public.fiscal_documents(next_attempt_at) where status = 'pending';
create index fiscal_documents_restaurant on public.fiscal_documents(restaurant_id, created_at desc);
alter table public.fiscal_documents enable row level security;
revoke all on table public.fiscal_documents from public, anon, authenticated;
grant all on table public.fiscal_documents to service_role;

-- Fires the worker now instead of waiting for the next minute. Never fails the
-- caller: without Vault secrets (DEV, or before setup) the cron fallback or
-- nothing runs, and the order write still succeeds.
create or replace function public.kick_fiscal_sync_worker()
returns void
language plpgsql
security definer
set search_path = public, vault, net, pg_temp
as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'fiscal_sync_worker_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'fiscal_sync_worker_secret';
  if nullif(btrim(v_url), '') is null or nullif(btrim(v_secret), '') is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
exception when others then
  return;
end $$;

-- Marks the bill's open document pending (creating it on the first order).
create or replace function public.mark_fiscal_document_pending(p_restaurant uuid, p_session uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_provider text; v_was text;
begin
  if p_session is null then return; end if;
  select provider into v_provider from public.restaurant_fiscal_settings where restaurant_id = p_restaurant and enabled;
  if v_provider is null then return; end if;
  select status into v_was from public.fiscal_documents
    where table_session_id = p_session and status in ('pending', 'synced', 'held', 'failed') for update;
  if v_was is null then
    insert into public.fiscal_documents (restaurant_id, table_session_id, provider)
    values (p_restaurant, p_session, v_provider)
    on conflict do nothing;
  else
    update public.fiscal_documents
    set status = 'pending', revision = revision + 1, attempts = 0, next_attempt_at = now(), updated_at = now()
    where table_session_id = p_session and status in ('pending', 'synced', 'held', 'failed');
  end if;
  if v_was is distinct from 'pending' then perform public.kick_fiscal_sync_worker(); end if;
end $$;

create or replace function public.fiscal_orders_changed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Settling orders (paid_at) does not change what the basket must contain until
  -- the bill is paid elsewhere, which also removes those orders from it.
  if tg_op = 'UPDATE' and new.table_session_id is not distinct from old.table_session_id
     and new.items is not distinct from old.items and new.total is not distinct from old.total
     and new.status is not distinct from old.status and new.deleted_at is not distinct from old.deleted_at
     and new.paid_at is not distinct from old.paid_at then
    return null;
  end if;
  perform public.mark_fiscal_document_pending(new.restaurant_id, new.table_session_id);
  if tg_op = 'UPDATE' and old.table_session_id is distinct from new.table_session_id then
    perform public.mark_fiscal_document_pending(old.restaurant_id, old.table_session_id);
  end if;
  return null;
end $$;

create trigger fiscal_orders_changed
  after insert or update on public.orders
  for each row execute function public.fiscal_orders_changed();

-- A bill closed before the device took payment: the worker removes its basket.
create or replace function public.fiscal_session_closed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.closed_at is not null and old.closed_at is null then
    update public.fiscal_documents
    set status = 'pending', revision = revision + 1, attempts = 0, next_attempt_at = now(), updated_at = now()
    where table_session_id = new.id and status in ('synced', 'held', 'failed');
    if found then perform public.kick_fiscal_sync_worker(); end if;
  end if;
  return null;
end $$;

create trigger fiscal_session_closed
  after update of closed_at on public.table_sessions
  for each row execute function public.fiscal_session_closed();

-- The worker's batch: due documents with what it needs to build each basket.
create or replace function public.claim_fiscal_documents(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  with due as (
    select d.id from public.fiscal_documents d
    where d.status = 'pending' and d.next_attempt_at <= now() and (d.lease_until is null or d.lease_until < now())
    order by d.next_attempt_at
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
    for update skip locked
  ), leased as (
    update public.fiscal_documents d set lease_until = now() + interval '60 seconds', attempts = d.attempts + 1
    from due where d.id = due.id
    returning d.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'restaurantId', l.restaurant_id, 'basketId', l.basket_id, 'revision', l.revision,
    'attempts', l.attempts, 'provider', l.provider, 'syncedRevision', l.synced_revision,
    'settings', jsonb_build_object('enabled', s.enabled, 'branchId', s.branch_id, 'terminalId', s.terminal_id,
      'sections', s.sections, 'sectionOverrides', s.section_overrides),
    'session', jsonb_build_object('id', ts.id, 'closed', ts.closed_at is not null, 'tableLabel', t.label, 'areaLabel', t.area_label),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'total', o.total, 'items', o.items) order by o.created_at)
      from public.orders o
      where o.table_session_id = l.table_session_id and o.restaurant_id = l.restaurant_id
        and o.deleted_at is null and o.status::text <> 'cancelled' and o.paid_at is null
    ), '[]'::jsonb)
  )), '[]'::jsonb) into result
  from leased l
  join public.table_sessions ts on ts.id = l.table_session_id
  left join public.tables t on t.id = ts.table_id
  left join public.restaurant_fiscal_settings s on s.restaurant_id = l.restaurant_id;
  return result;
end $$;

-- Outcome of one send. A newer revision that arrived meanwhile keeps it pending.
create or replace function public.finish_fiscal_document(
  p_id uuid, p_revision integer, p_outcome text, p_error text, p_order_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_outcome not in ('synced', 'held', 'deleted', 'retry', 'failed') then
    raise exception 'invalid_outcome' using errcode = '22023';
  end if;
  update public.fiscal_documents d set
    status = case
      when d.revision <> p_revision and p_outcome in ('synced', 'held') then 'pending'
      when p_outcome = 'retry' then case when d.attempts >= 8 then 'failed' else 'pending' end
      else p_outcome end,
    synced_revision = case when p_outcome = 'synced' then p_revision else d.synced_revision end,
    synced_order_ids = case when p_outcome = 'synced' then array_remove(coalesce(p_order_ids, '{}'), null) else d.synced_order_ids end,
    held_reason = case when p_outcome = 'held' then left(p_error, 200) else null end,
    last_error = case when p_outcome in ('retry', 'failed') then left(p_error, 200) else null end,
    -- 30s, 1m, 2m … capped at 15 minutes.
    next_attempt_at = case when p_outcome = 'retry' then now() + least(interval '15 minutes', interval '30 seconds' * power(2, greatest(d.attempts - 1, 0))) else now() end,
    lease_until = null,
    updated_at = now()
  where d.id = p_id and d.status = 'pending';
end $$;

-- The orders a device payment covers: the ones in the basket the device saw, still unpaid.
create or replace function public.read_fiscal_payment_scope(p_basket_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'documentId', d.id, 'restaurantId', d.restaurant_id, 'status', d.status, 'provider', d.provider,
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'total', o.total) order by o.created_at)
      from public.orders o
      where o.id = any(d.synced_order_ids) and o.restaurant_id = d.restaurant_id
        and o.deleted_at is null and o.status::text <> 'cancelled' and o.paid_at is null
    ), '[]'::jsonb)
  )
  from public.fiscal_documents d where d.basket_id = p_basket_id;
$$;

-- Settles a device payment once. Replays of the same webhook are no-ops.
create or replace function public.apply_fiscal_payment(
  p_basket_id uuid, p_terminal_id text, p_receipt_no text, p_z_no text, p_payments jsonb, p_allocations jsonb
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_doc public.fiscal_documents; v_session uuid;
begin
  select * into v_doc from public.fiscal_documents where basket_id = p_basket_id for update;
  if not found then return 'not_found'; end if;
  if v_doc.status in ('completed', 'voided') then return 'duplicate'; end if;
  if jsonb_typeof(p_allocations) <> 'array' or exists (
    select 1 from jsonb_to_recordset(p_allocations) a(order_id uuid, method text)
    -- coalesce: "= any" is null, not false, when the id is missing and the array holds a null.
    where a.order_id is null or a.method is null or a.method not in ('cash', 'pos')
       or not coalesce(a.order_id = any(v_doc.synced_order_ids), false)
  ) then
    raise exception 'invalid_allocation' using errcode = '22023';
  end if;

  update public.orders o set paid_at = now(), payment_method = a.method, settled_by = null,
    settlement_source = 'okc', updated_at = now()
  from jsonb_to_recordset(p_allocations) a(order_id uuid, method text)
  where o.id = a.order_id and o.restaurant_id = v_doc.restaurant_id and o.table_session_id = v_doc.table_session_id
    and o.deleted_at is null and o.status::text <> 'cancelled' and o.paid_at is null;

  update public.fiscal_documents set status = 'completed', terminal_id = left(p_terminal_id, 64),
    receipt_no = left(p_receipt_no, 32), z_no = left(p_z_no, 32), payments = p_payments,
    completed_at = now(), locked_by = null, lease_until = null, updated_at = now()
  where id = v_doc.id;

  -- Orders added after the device last saw the basket still need paying: start a new basket.
  v_session := v_doc.table_session_id;
  if exists (select 1 from public.orders o where o.table_session_id = v_session and o.deleted_at is null
             and o.status::text <> 'cancelled' and o.paid_at is null) then
    perform public.mark_fiscal_document_pending(v_doc.restaurant_id, v_session);
  end if;
  return 'applied';
end $$;

-- Lock, unlock and voids from the device. A void never un-settles orders; it is shown for a person to handle.
create or replace function public.record_fiscal_event(p_basket_id uuid, p_kind text, p_terminal_id text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_kind = 'locked' then
    update public.fiscal_documents set locked_by = left(coalesce(p_terminal_id, '?'), 64), updated_at = now()
    where basket_id = p_basket_id and status in ('pending', 'synced');
  elsif p_kind = 'unlocked' then
    update public.fiscal_documents set locked_by = null, updated_at = now() where basket_id = p_basket_id;
  elsif p_kind = 'voided' then
    update public.fiscal_documents set status = 'voided', updated_at = now() where basket_id = p_basket_id and status = 'completed';
  elsif p_kind <> 'cancelled' then
    raise exception 'invalid_event' using errcode = '22023';
  end if;
  return case when found then 'recorded' else 'ignored' end;
end $$;

create or replace function public.invoke_fiscal_sync_worker()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.fiscal_documents where status = 'pending' and next_attempt_at <= now()) then
    perform public.kick_fiscal_sync_worker();
  end if;
end $$;

create or replace function public.configure_fiscal_sync_worker_vault(p_url text, p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public, vault, cron, pg_temp
as $$
declare v_url_id uuid; v_secret_id uuid; v_job_id bigint;
begin
  if p_url !~ '^https://[a-z0-9-]+\.masabu\.co/api/internal/fiscal-sync$' then
    raise exception 'Invalid fiscal worker URL' using errcode = '22023';
  end if;
  if char_length(coalesce(p_secret, '')) < 32 then
    raise exception 'Fiscal worker secret must be at least 32 characters' using errcode = '22023';
  end if;
  select id into v_url_id from vault.decrypted_secrets where name = 'fiscal_sync_worker_url';
  if v_url_id is null then perform vault.create_secret(p_url, 'fiscal_sync_worker_url', 'Masabu ÖKC sync worker URL');
  else perform vault.update_secret(v_url_id, p_url, 'fiscal_sync_worker_url', 'Masabu ÖKC sync worker URL'); end if;
  select id into v_secret_id from vault.decrypted_secrets where name = 'fiscal_sync_worker_secret';
  if v_secret_id is null then perform vault.create_secret(p_secret, 'fiscal_sync_worker_secret', 'Bearer secret for the Masabu ÖKC sync worker');
  else perform vault.update_secret(v_secret_id, p_secret, 'fiscal_sync_worker_secret', 'Bearer secret for the Masabu ÖKC sync worker'); end if;
  select jobid into v_job_id from cron.job where jobname = 'fiscal-sync-worker-every-minute';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule('fiscal-sync-worker-every-minute', '* * * * *', 'select public.invoke_fiscal_sync_worker();');
  return jsonb_build_object('urlConfigured', true, 'secretConfigured', true, 'cronActive', true);
end $$;

revoke all on function public.kick_fiscal_sync_worker(), public.mark_fiscal_document_pending(uuid, uuid),
  public.fiscal_orders_changed(), public.fiscal_session_closed(), public.claim_fiscal_documents(integer),
  public.finish_fiscal_document(uuid, integer, text, text, uuid[]), public.read_fiscal_payment_scope(uuid),
  public.apply_fiscal_payment(uuid, text, text, text, jsonb, jsonb), public.record_fiscal_event(uuid, text, text),
  public.invoke_fiscal_sync_worker(), public.configure_fiscal_sync_worker_vault(text, text)
  from public, anon, authenticated;
grant execute on function public.claim_fiscal_documents(integer), public.finish_fiscal_document(uuid, integer, text, text, uuid[]),
  public.read_fiscal_payment_scope(uuid), public.apply_fiscal_payment(uuid, text, text, text, jsonb, jsonb),
  public.record_fiscal_event(uuid, text, text), public.mark_fiscal_document_pending(uuid, uuid),
  public.invoke_fiscal_sync_worker(), public.configure_fiscal_sync_worker_vault(text, text)
  to service_role;
