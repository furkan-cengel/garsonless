-- Reading purchase invoices with the menu reader's provider and worker. A photo
-- or PDF is queued here by the dashboard after RBAC and plan checks; the
-- menu-import-worker reads it and stores structured lines; the dashboard shows
-- them in the receive dialog for the user to check before anything is posted.
-- Nothing in this file touches stock. Sources are erased once read.

create table public.inventory_invoice_reads (
  id uuid primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  source_data text check (octet_length(source_data) <= 4194304),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'queued' check (status in ('queued', 'reading', 'done', 'failed')),
  result jsonb,
  error text,
  lease uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inventory_invoice_read_queue on public.inventory_invoice_reads(created_at) where status in ('queued', 'reading');
create index inventory_invoice_read_tenant on public.inventory_invoice_reads(restaurant_id, created_at desc);
alter table public.inventory_invoice_reads enable row level security;
revoke all on public.inventory_invoice_reads from public, anon, authenticated;
grant all on public.inventory_invoice_reads to service_role;

create or replace function public.inventory_invoice_public(j public.inventory_invoice_reads)
returns jsonb language sql immutable set search_path = public, pg_temp as $$
  select jsonb_build_object('id', j.id, 'status', j.status, 'result', j.result, 'error', j.error);
$$;

-- Unread jobs expire after a day; sources never outlive a day; rows go after a week.
create or replace function public.expire_invoice_reads()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.inventory_invoice_reads set status = 'failed', error = 'expired', source_data = null, lease = null, lease_until = null, updated_at = now()
  where status in ('queued', 'reading') and (created_at < now() - interval '24 hours' or (attempts >= 2 and lease_until < now()));
  update public.inventory_invoice_reads set source_data = null where source_data is not null and created_at < now() - interval '24 hours';
  delete from public.inventory_invoice_reads where created_at < now() - interval '7 days';
end $$;

-- Called only by the dashboard upload route after RBAC and entitlement checks.
create or replace function public.enqueue_invoice_read(p_restaurant uuid, p_actor uuid, p_id uuid, p_mime text, p_source text, p_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare j public.inventory_invoice_reads;
begin
  if not public.inventory_actor(p_restaurant, p_actor) or not public.inventory_allowed(p_restaurant) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('invoice-read-quota', 0));
  select * into j from public.inventory_invoice_reads where id = p_id;
  if found then
    if j.restaurant_id <> p_restaurant or j.actor_id <> p_actor or j.source_hash <> p_hash then raise exception 'request_mismatch'; end if;
    return public.inventory_invoice_public(j);
  end if;
  if nullif(p_source, '') is null or octet_length(p_source) > 4194304 or p_hash !~ '^[a-f0-9]{64}$'
     or p_mime not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp') then raise exception 'invalid_input'; end if;
  -- Each read costs a provider call: 20 per restaurant and 300 in total per day.
  if (select count(*) from public.inventory_invoice_reads where restaurant_id = p_restaurant and created_at > now() - interval '24 hours') >= 20
     or (select count(*) from public.inventory_invoice_reads where created_at > now() - interval '24 hours') >= 300 then raise exception 'quota_exceeded'; end if;
  insert into public.inventory_invoice_reads (id, restaurant_id, actor_id, mime, source_data, source_hash)
  values (p_id, p_restaurant, p_actor, p_mime, p_source, p_hash) returning * into j;
  return public.inventory_invoice_public(j);
end $$;

create or replace function public.read_invoice_read(p_restaurant uuid, p_actor uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare j public.inventory_invoice_reads;
begin
  if not public.inventory_actor(p_restaurant, p_actor) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform public.expire_invoice_reads();
  select * into j from public.inventory_invoice_reads where id = p_id and restaurant_id = p_restaurant;
  if not found then raise exception 'not_found'; end if;
  return public.inventory_invoice_public(j);
end $$;

create or replace function public.claim_invoice_read()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare j public.inventory_invoice_reads;
begin
  perform public.expire_invoice_reads();
  select * into j from public.inventory_invoice_reads
  where (status = 'queued' or (status = 'reading' and lease_until < now())) and attempts < 2
  order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  if not public.inventory_actor(j.restaurant_id, j.actor_id) then
    update public.inventory_invoice_reads set status = 'failed', error = 'forbidden', source_data = null, updated_at = now() where id = j.id;
    return null;
  end if;
  update public.inventory_invoice_reads set status = 'reading', lease = gen_random_uuid(), lease_until = now() + interval '3 minutes',
    attempts = attempts + 1, updated_at = now() where id = j.id returning * into j;
  return jsonb_build_object('id', j.id, 'lease', j.lease, 'mime', j.mime, 'base64', j.source_data);
end $$;

create or replace function public.finish_invoice_read(p_job uuid, p_lease uuid, p_result jsonb default null, p_error text default null)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_error is not null and p_error not in ('provider_busy', 'provider_unavailable', 'incomplete_output', 'unreadable_invoice', 'invalid_output', 'timeout') then p_error := 'provider_unavailable'; end if;
  if p_error is null and (p_result is null or jsonb_typeof(p_result) <> 'object' or jsonb_typeof(p_result -> 'lines') <> 'array'
     or jsonb_array_length(p_result -> 'lines') not between 1 and 60 or octet_length(p_result::text) > 100000) then p_error := 'invalid_output'; end if;
  update public.inventory_invoice_reads set status = case when p_error is null then 'done' else 'failed' end,
    result = case when p_error is null then p_result end, error = p_error, source_data = null,
    lease = null, lease_until = null, updated_at = now()
  where id = p_job and lease = p_lease and status = 'reading' and lease_until > now();
  return found;
end $$;

revoke all on function public.inventory_invoice_public(public.inventory_invoice_reads), public.expire_invoice_reads(),
  public.enqueue_invoice_read(uuid, uuid, uuid, text, text, text), public.read_invoice_read(uuid, uuid, uuid),
  public.claim_invoice_read(), public.finish_invoice_read(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.expire_invoice_reads(), public.enqueue_invoice_read(uuid, uuid, uuid, text, text, text),
  public.read_invoice_read(uuid, uuid, uuid), public.claim_invoice_read(), public.finish_invoice_read(uuid, uuid, jsonb, text) to service_role;
