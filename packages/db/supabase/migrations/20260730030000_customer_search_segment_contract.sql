-- Slice 2: canonical CRM search and built-in segment boundary contract.
-- The RPC remains service-role-only and keeps the existing tenant-scoped
-- candidate CTE. This migration changes only deterministic read behavior.

create or replace function public.normalize_customer_search_text(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select btrim(regexp_replace(
    translate(
      lower(translate(coalesce(p_value, ''), 'ÇĞİIÖŞÜ', 'çğiıöşü')),
      'çğıöşü',
      'cgiosu'
    ),
    '[[:space:]]+',
    ' ',
    'g'
  ));
$$;

create or replace function public.normalize_customer_search_phone(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  with normalized as (
    select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g') as digits
  )
  select case
    when left(digits, 4) = '0090' then substr(digits, 5)
    when left(digits, 2) = '90' and length(digits) >= 12 then substr(digits, 3)
    when left(digits, 1) = '0' then substr(digits, 2)
    else digits
  end
  from normalized;
$$;

create index if not exists customers_search_name_trgm_idx
  on public.customers using gin (public.normalize_customer_search_text(name) gin_trgm_ops);

create index if not exists customers_search_phone_trgm_idx
  on public.customers using gin (public.normalize_customer_search_phone(phone) gin_trgm_ops);

do $migration$
declare
  fn regprocedure := 'public.get_restaurant_customers(uuid,uuid,text,text,text,integer,integer,jsonb)'::regprocedure;
  definition text;
  old_search text := E'    where (p_search is null or p_search = \'\'\n           or lower(name) like \'%\' || lower(p_search) || \'%\'\n           or phone like \'%\' || p_search)';
  new_search text := E'    where (nullif(btrim(p_search), \'\') is null\n           or (public.normalize_customer_search_text(p_search) <> \'\'\n               and public.normalize_customer_search_text(name) like \'%\' || public.normalize_customer_search_text(p_search) || \'%\')\n           or (public.normalize_customer_search_phone(p_search) <> \'\'\n               and public.normalize_customer_search_phone(phone) like \'%\' || public.normalize_customer_search_phone(p_search)))';
  old_new_boundary text := E'(p_segment = \'new\'       and first_seen > now() - interval \'30 days\')';
  new_new_boundary text := E'(p_segment = \'new\'       and first_seen >= now() - interval \'30 days\')';
  old_lapsed_boundary text := E'(p_segment = \'lapsed\'    and last_seen < now() - interval \'60 days\')';
  new_lapsed_boundary text := E'(p_segment = \'lapsed\'    and last_seen <= now() - interval \'60 days\')';
  old_order_tail text := E'    last_seen desc nulls last\n  limit greatest(p_limit, 0) offset greatest(p_offset, 0);';
  new_order_tail text := E'    last_seen desc nulls last,\n    customer_id asc\n  limit least(greatest(p_limit, 0), 100) offset greatest(p_offset, 0);';
begin
  select pg_get_functiondef(fn) into definition;

  if position(new_search in definition) = 0 then
    if position(old_search in definition) = 0 then
      raise exception 'get_restaurant_customers search predicate has unexpected shape';
    end if;
    definition := replace(definition, old_search, new_search);
  end if;

  if position(new_new_boundary in definition) = 0 then
    if position(old_new_boundary in definition) = 0 then
      raise exception 'get_restaurant_customers new boundary has unexpected shape';
    end if;
    definition := replace(definition, old_new_boundary, new_new_boundary);
  end if;

  if position(new_lapsed_boundary in definition) = 0 then
    if position(old_lapsed_boundary in definition) = 0 then
      raise exception 'get_restaurant_customers lapsed boundary has unexpected shape';
    end if;
    definition := replace(definition, old_lapsed_boundary, new_lapsed_boundary);
  end if;

  if position(new_order_tail in definition) = 0 then
    if position(old_order_tail in definition) = 0 then
      raise exception 'get_restaurant_customers order/limit tail has unexpected shape';
    end if;
    definition := replace(definition, old_order_tail, new_order_tail);
  end if;

  -- Refuse to mutate an RPC lineage that lost its explicit tenant association.
  if position('from customer_restaurants' in definition) = 0
     or position('where restaurant_id = p_restaurant_id' in definition) = 0 then
    raise exception 'get_restaurant_customers tenant candidate contract is missing';
  end if;

  execute definition;
end
$migration$;

revoke all on function public.normalize_customer_search_text(text) from public, anon, authenticated;
revoke all on function public.normalize_customer_search_phone(text) from public, anon, authenticated;
grant execute on function public.normalize_customer_search_text(text) to service_role;
grant execute on function public.normalize_customer_search_phone(text) to service_role;

revoke all on function public.get_restaurant_customers(uuid, uuid, text, text, text, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.get_restaurant_customers(uuid, uuid, text, text, text, int, int, jsonb) to service_role;
