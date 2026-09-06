-- The coupon and its target set are one versioned, retry-safe write.
create table public.coupon_write_requests (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  request_id uuid not null,
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (restaurant_id, request_id)
);
alter table public.coupon_write_requests enable row level security;
revoke all on public.coupon_write_requests from public, anon, authenticated;
grant select, insert on public.coupon_write_requests to service_role;

create function public.save_restaurant_coupon_atomic(p_restaurant uuid, p_request_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_previous public.coupon_write_requests;
  v_coupon public.coupons;
  v_id uuid := coalesce((p_input->>'id')::uuid, gen_random_uuid());
  v_expected timestamptz := (p_input->>'expectedUpdatedAt')::timestamptz;
  v_categories uuid[] := array(select distinct value::uuid from jsonb_array_elements_text(coalesce(p_input->'categoryIds','[]'::jsonb)) order by 1);
  v_items uuid[] := array(select distinct value::uuid from jsonb_array_elements_text(coalesce(p_input->'itemIds','[]'::jsonb)) order by 1);
  v_result jsonb;
  v_now timestamptz;
begin
  if p_request_id is null or p_restaurant is null then raise exception 'COUPON_INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant::text || ':' || p_request_id::text,0));
  select * into v_previous from public.coupon_write_requests where restaurant_id=p_restaurant and request_id=p_request_id;
  if found then
    if v_previous.input is distinct from p_input then raise exception 'COUPON_REQUEST_CONFLICT'; end if;
    return v_previous.result;
  end if;
  if not exists(select 1 from public.restaurants where id=p_restaurant and deleted_at is null) then raise exception 'COUPON_FORBIDDEN'; end if;
  if (p_input->>'scope'='category' and cardinality(v_categories)=0) or (p_input->>'scope'='product' and cardinality(v_items)=0)
    or cardinality(v_categories)>100 or cardinality(v_items)>200 then raise exception 'COUPON_INVALID_TARGET'; end if;
  -- Lock targets against deletion or reassignment through the end of the write.
  perform id from public.menu_categories where id=any(v_categories) and restaurant_id=p_restaurant and deleted_at is null for share;
  if (select count(*) from public.menu_categories where id=any(v_categories) and restaurant_id=p_restaurant and deleted_at is null)<>cardinality(v_categories) then raise exception 'COUPON_INVALID_TARGET'; end if;
  perform i.id from public.menu_items i join public.menu_categories c on c.id=i.category_id where i.id=any(v_items) and c.restaurant_id=p_restaurant and i.deleted_at is null and c.deleted_at is null for share of i,c;
  if (select count(*) from public.menu_items i join public.menu_categories c on c.id=i.category_id where i.id=any(v_items) and c.restaurant_id=p_restaurant and i.deleted_at is null and c.deleted_at is null)<>cardinality(v_items) then raise exception 'COUPON_INVALID_TARGET'; end if;
  if p_input->>'id' is not null then
    select * into v_coupon from public.coupons where id=v_id and restaurant_id=p_restaurant and archived_at is null for update;
    if not found or v_expected is null or v_coupon.updated_at is distinct from v_expected then raise exception 'COUPON_VERSION_CONFLICT'; end if;
  end if;
  v_now := greatest(clock_timestamp(),coalesce(v_coupon.updated_at + interval '1 microsecond','-infinity'::timestamptz));
  insert into public.coupons(id,restaurant_id,name,code,enabled,discount_type,discount_value,scope,minimum_amount,maximum_discount_amount,starts_at,ends_at,total_usage_limit,per_customer_limit,audience,stacking_policy,marketing_label,marketing_description,updated_at)
  values(v_id,p_restaurant,btrim(p_input->>'name'),upper(btrim(p_input->>'code')),(p_input->>'enabled')::boolean,p_input->>'discountType',(p_input->>'discountValue')::numeric,p_input->>'scope',(p_input->>'minimumAmount')::numeric,
    case when p_input->>'discountType'='percentage' then (p_input->>'maximumDiscountAmount')::numeric end,
    (p_input->>'startsAt')::timestamptz,(p_input->>'endsAt')::timestamptz,(p_input->>'totalUsageLimit')::integer,
    case when p_input->>'audience'<>'everyone' then (p_input->>'perCustomerLimit')::integer end,
    p_input->>'audience',p_input->>'stackingPolicy',nullif(btrim(p_input->>'marketingLabel'),''),nullif(btrim(p_input->>'marketingDescription'),''),v_now)
  on conflict(id) do update set name=excluded.name,code=excluded.code,enabled=excluded.enabled,discount_type=excluded.discount_type,discount_value=excluded.discount_value,scope=excluded.scope,minimum_amount=excluded.minimum_amount,maximum_discount_amount=excluded.maximum_discount_amount,starts_at=excluded.starts_at,ends_at=excluded.ends_at,total_usage_limit=excluded.total_usage_limit,per_customer_limit=excluded.per_customer_limit,audience=excluded.audience,stacking_policy=excluded.stacking_policy,marketing_label=excluded.marketing_label,marketing_description=excluded.marketing_description,updated_at=excluded.updated_at
  returning * into v_coupon;
  delete from public.coupon_categories where coupon_id=v_id;
  delete from public.coupon_items where coupon_id=v_id;
  if v_coupon.scope='category' then insert into public.coupon_categories(coupon_id,category_id) select v_id,unnest(v_categories); else v_categories:='{}'; end if;
  if v_coupon.scope='product' then insert into public.coupon_items(coupon_id,item_id) select v_id,unnest(v_items); else v_items:='{}'; end if;
  v_result:=jsonb_build_object('coupon',to_jsonb(v_coupon),'categoryIds',to_jsonb(v_categories),'itemIds',to_jsonb(v_items),'redemptionCount',(select count(*) from public.coupon_redemptions where coupon_id=v_id and status='consumed'));
  insert into public.coupon_write_requests(restaurant_id,request_id,input,result) values(p_restaurant,p_request_id,p_input,v_result);
  return v_result;
end;
$$;
revoke all on function public.save_restaurant_coupon_atomic(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_restaurant_coupon_atomic(uuid,uuid,jsonb) to service_role;
