-- Independent Sadakat pilot. Service-only RPCs; no public/customer ledger writes.
create table public.restaurant_product_access (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product text not null check (product = 'sadakat'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  granted_by uuid not null references auth.users(id),
  reason text not null check (length(btrim(reason)) between 10 and 1000),
  primary key (restaurant_id, product),
  check (ends_at > starts_at)
);
create table public.sadakat_programs (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  logo_url text,
  color text not null default '#174C3C' check (color ~ '^#[0-9a-fA-F]{6}$'),
  goal integer not null default 8 check (goal between 2 and 100),
  reward text not null check (length(btrim(reward)) between 1 and 300),
  eligible_products text not null check (length(btrim(eligible_products)) between 1 and 500),
  goal_locked boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.sadakat_memberships (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (restaurant_id, customer_id)
);
create table public.sadakat_codes (
  digest text primary key check (digest ~ '^[a-f0-9]{64}$'),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  expires_at timestamptz not null
);
create index sadakat_codes_customer_idx on public.sadakat_codes(restaurant_id, customer_id);
create table public.sadakat_operations (
  id uuid primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  kind text not null check (kind in ('earn','redeem','reversal')),
  delta integer not null,
  code_digest text,
  reverses_id uuid unique references public.sadakat_operations(id),
  reason text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index sadakat_operations_tenant_idx on public.sadakat_operations(restaurant_id, created_at desc);
alter table public.loyalty_transactions add column sadakat_operation_id uuid unique references public.sadakat_operations(id);
do $$ declare t text; begin
  foreach t in array array['restaurant_product_access','sadakat_programs','sadakat_memberships','sadakat_codes','sadakat_operations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

create function public.sadakat_active(p_restaurant uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.restaurant_product_access a join public.restaurants r on r.id=a.restaurant_id
    where a.restaurant_id=p_restaurant and a.product='sadakat' and a.starts_at<=now() and a.ends_at>now() and r.deleted_at is null);
$$;
create function public.sadakat_actor(p_restaurant uuid, p_actor uuid, p_owner boolean default false) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.restaurants r where r.id=p_restaurant and r.deleted_at is null and
    (r.owner_id=p_actor or (not p_owner and exists(select 1 from public.restaurant_members m
      where m.restaurant_id=r.id and m.user_id=p_actor and m.status='active' and m.permissions @> '["sadakat"]'::jsonb))));
$$;
create function public.grant_sadakat_pilot(p_restaurant uuid,p_actor uuid,p_start timestamptz,p_end timestamptz,p_reason text,p_request uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_role text; v_before jsonb; v_after jsonb;
begin
  select role into v_role from public.platform_admin_users where user_id=p_actor and status='active' and role in ('ops','superadmin');
  if v_role is null then raise exception 'SADAKAT_FORBIDDEN'; end if;
  if p_end<=p_start or length(btrim(p_reason)) not between 10 and 1000 then raise exception 'SADAKAT_INVALID'; end if;
  if not exists(select 1 from public.restaurants where id=p_restaurant and deleted_at is null) then raise exception 'SADAKAT_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext('sadakat-pilot:'||p_restaurant::text));
  select after_state into v_after from public.platform_admin_audit_log where actor_user_id=p_actor and request_id=p_request and action='sadakat.pilot.grant';
  if found then
    if v_after->>'restaurantId'<>p_restaurant::text or (v_after->>'startsAt')::timestamptz<>p_start or (v_after->>'endsAt')::timestamptz<>p_end then raise exception 'SADAKAT_CONFLICT'; end if;
    return v_after;
  end if;
  select to_jsonb(a) into v_before from public.restaurant_product_access a where restaurant_id=p_restaurant and product='sadakat';
  insert into public.restaurant_product_access values(p_restaurant,'sadakat',p_start,p_end,p_actor,btrim(p_reason))
    on conflict(restaurant_id,product) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,granted_by=excluded.granted_by,reason=excluded.reason;
  v_after:=jsonb_build_object('restaurantId',p_restaurant,'startsAt',p_start,'endsAt',p_end);
  insert into public.platform_admin_audit_log(actor_user_id,actor_role,action,target_type,target_id,reason,request_id,before_state,after_state)
    values(p_actor,v_role,'sadakat.pilot.grant','restaurant',p_restaurant::text,p_reason,p_request,v_before,v_after);
  return v_after;
end $$;

-- A shared restaurant lock serializes setup with the first automatic/manual earn.
create function public.guard_sadakat_program() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtext('sadakat-program:'||new.restaurant_id::text));
  if tg_op='UPDATE' and old.goal_locked and (new.goal<>old.goal or not new.goal_locked) then raise exception 'SADAKAT_GOAL_LOCKED'; end if;
  return new;
end $$;
create trigger sadakat_program_guard before insert or update on public.sadakat_programs for each row execute function public.guard_sadakat_program();
create function public.lock_sadakat_goal() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.type='stamp' and new.delta>0 then
    perform pg_advisory_xact_lock(hashtext('sadakat-program:'||new.restaurant_id::text));
    update public.sadakat_programs set goal_locked=true where restaurant_id=new.restaurant_id and not goal_locked;
  end if;
  return new;
end $$;
create trigger sadakat_first_stamp before insert on public.loyalty_transactions for each row execute function public.lock_sadakat_goal();
create function public.guard_sadakat_settings() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare p public.sadakat_programs%rowtype;
begin
  select * into p from public.sadakat_programs where restaurant_id=new.id;
  if found and (coalesce(new.settings->'loyalty'->>'scope','restaurant')<>'restaurant'
    or (new.settings->'loyalty'->>'stamp_goal')::int is distinct from p.goal) then raise exception 'SADAKAT_PROGRAM_SETTINGS'; end if;
  return new;
end $$;
create trigger sadakat_restaurant_settings before update of settings on public.restaurants for each row execute function public.guard_sadakat_settings();

create function public.save_sadakat_program(p_restaurant uuid,p_actor uuid,p_config jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.restaurants%rowtype; p public.sadakat_programs%rowtype; v_goal int; v_locked boolean;
begin
  if not public.sadakat_actor(p_restaurant,p_actor,true) then raise exception 'SADAKAT_FORBIDDEN'; end if;
  if not public.sadakat_active(p_restaurant) then raise exception 'SADAKAT_EXPIRED'; end if;
  select * into r from public.restaurants where id=p_restaurant for update;
  perform pg_advisory_xact_lock(hashtext('sadakat-program:'||p_restaurant::text));
  if coalesce(r.settings->'loyalty'->>'scope','restaurant')<>'restaurant' then raise exception 'SADAKAT_NETWORK_SCOPE'; end if;
  select * into p from public.sadakat_programs where restaurant_id=p_restaurant;
  v_goal:=(p_config->>'goal')::int;
  v_locked:=coalesce(p.goal_locked,false) or exists(select 1 from public.loyalty_transactions where restaurant_id=p_restaurant and scope_key=p_restaurant and type='stamp' and delta>0);
  if v_locked and v_goal<>coalesce(p.goal,(r.settings->'loyalty'->>'stamp_goal')::int,8) then raise exception 'SADAKAT_GOAL_LOCKED'; end if;
  insert into public.sadakat_programs(restaurant_id,name,logo_url,color,goal,reward,eligible_products,goal_locked)
    values(p_restaurant,btrim(p_config->>'name'),nullif(p_config->>'logoUrl',''),p_config->>'color',v_goal,btrim(p_config->>'reward'),btrim(p_config->>'eligibleProducts'),v_locked)
    on conflict(restaurant_id) do update set name=excluded.name,logo_url=excluded.logo_url,color=excluded.color,goal=excluded.goal,reward=excluded.reward,eligible_products=excluded.eligible_products,goal_locked=excluded.goal_locked;
  update public.restaurants set settings=jsonb_set(coalesce(settings,'{}'),'{loyalty}',coalesce(settings->'loyalty','{}')||jsonb_build_object('stamp_goal',v_goal,'stamp_reward_text',p_config->>'reward','stamp_enabled',true,'scope','restaurant')) where id=p_restaurant;
  -- Existing venue members keep their balances and immediately get readable cards.
  insert into public.sadakat_memberships(restaurant_id,customer_id,joined_at)
    select restaurant_id,customer_id,created_at from public.customer_restaurants where restaurant_id=p_restaurant on conflict do nothing;
  return jsonb_build_object('saved',true);
end $$;

create function public.read_sadakat_program(p_slug text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('restaurantId',r.id,'slug',r.slug,'name',p.name,'logoUrl',p.logo_url,'color',p.color,'goal',p.goal,'reward',p.reward,'eligibleProducts',p.eligible_products,'active',public.sadakat_active(r.id))
  from public.sadakat_programs p join public.restaurants r on r.id=p.restaurant_id where r.slug=p_slug and r.deleted_at is null;
$$;
create function public.read_sadakat_card(p_restaurant uuid,p_customer uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('joinedAt',m.joined_at,'stamps',coalesce((select sum(delta) from public.loyalty_transactions where customer_id=p_customer and scope_key=p_restaurant and type='stamp'),0),
    'history',coalesce((select jsonb_agg(to_jsonb(h) order by h."createdAt" desc) from (select id,delta,direction,reason,created_at as "createdAt" from public.loyalty_transactions where customer_id=p_customer and scope_key=p_restaurant and type='stamp' order by created_at desc,id desc limit 30) h),'[]'::jsonb))
  from public.sadakat_memberships m join public.restaurants r on r.id=m.restaurant_id where m.restaurant_id=p_restaurant and m.customer_id=p_customer and r.deleted_at is null;
$$;
create function public.join_sadakat(p_restaurant uuid,p_customer uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.sadakat_active(p_restaurant) then raise exception 'SADAKAT_EXPIRED'; end if;
  if not exists(select 1 from public.sadakat_programs where restaurant_id=p_restaurant) then raise exception 'SADAKAT_NOT_FOUND'; end if;
  if not exists(select 1 from public.customers where id=p_customer and merged_at is null and phone is not null and verified_at is not null) then raise exception 'SADAKAT_PHONE_REQUIRED'; end if;
  insert into public.sadakat_memberships values(p_restaurant,p_customer,now()) on conflict do nothing;
  insert into public.customer_restaurants(customer_id,restaurant_id,source) values(p_customer,p_restaurant,'consent') on conflict do nothing;
  return public.read_sadakat_card(p_restaurant,p_customer);
end $$;
create function public.issue_sadakat_code(p_restaurant uuid,p_customer uuid,p_digest text) returns timestamptz
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_exp timestamptz:=clock_timestamp()+interval '2 minutes';
begin
  if not public.sadakat_active(p_restaurant) then raise exception 'SADAKAT_EXPIRED'; end if;
  if not exists(select 1 from public.sadakat_memberships where restaurant_id=p_restaurant and customer_id=p_customer) then raise exception 'SADAKAT_NOT_JOINED'; end if;
  perform pg_advisory_xact_lock(hashtext('sadakat-code:'||p_customer::text||':'||p_restaurant::text));
  delete from public.sadakat_codes where restaurant_id=p_restaurant and customer_id=p_customer;
  insert into public.sadakat_codes values(p_digest,p_restaurant,p_customer,v_exp);
  return v_exp;
end $$;
create function public.resolve_sadakat_code(p_restaurant uuid,p_actor uuid,p_digest text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_customer uuid;
begin
  if not public.sadakat_actor(p_restaurant,p_actor) then raise exception 'SADAKAT_FORBIDDEN'; end if;
  if not public.sadakat_active(p_restaurant) then raise exception 'SADAKAT_EXPIRED'; end if;
  select customer_id into v_customer from public.sadakat_codes where digest=p_digest and restaurant_id=p_restaurant and expires_at>clock_timestamp();
  if v_customer is null then raise exception 'SADAKAT_CODE_EXPIRED'; end if;
  return jsonb_build_object('name',(select name from public.customers where id=v_customer),'card',public.read_sadakat_card(p_restaurant,v_customer));
end $$;
create function public.mutate_sadakat(p_restaurant uuid,p_actor uuid,p_request uuid,p_kind text,p_digest text default null,p_quantity int default 1,p_reverse uuid default null,p_reason text default '') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_customer uuid; v_delta int; v_balance int; v_goal int; o public.sadakat_operations%rowtype; v_existing public.sadakat_operations%rowtype; v_result jsonb;
begin
  if not public.sadakat_actor(p_restaurant,p_actor,p_kind='reversal') then raise exception 'SADAKAT_FORBIDDEN'; end if;
  if not public.sadakat_active(p_restaurant) then raise exception 'SADAKAT_EXPIRED'; end if;
  if p_kind not in ('earn','redeem','reversal') or p_request is null then raise exception 'SADAKAT_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtext('sadakat-request:'||p_request::text));
  select * into v_existing from public.sadakat_operations where id=p_request;
  if found then
    if v_existing.restaurant_id<>p_restaurant or v_existing.actor_id<>p_actor or v_existing.kind<>p_kind
      or v_existing.code_digest is distinct from p_digest or v_existing.reverses_id is distinct from p_reverse
      or (p_kind='earn' and v_existing.delta<>p_quantity) or (p_kind='reversal' and v_existing.reason<>btrim(p_reason)) then raise exception 'SADAKAT_CONFLICT'; end if;
    return v_existing.result;
  end if;
  if p_kind='reversal' then
    if length(btrim(p_reason)) not between 3 and 500 then raise exception 'SADAKAT_REASON_REQUIRED'; end if;
    select * into o from public.sadakat_operations where id=p_reverse and restaurant_id=p_restaurant and kind in ('earn','redeem');
    if not found then raise exception 'SADAKAT_NOT_FOUND'; end if;
    v_customer:=o.customer_id; v_delta:=-o.delta;
  else
    select customer_id into v_customer from public.sadakat_codes where digest=p_digest and restaurant_id=p_restaurant and expires_at>clock_timestamp();
    if v_customer is null then raise exception 'SADAKAT_CODE_EXPIRED'; end if;
  end if;
  -- Same lock as redeem_loyalty: manual and order redemptions cannot overspend.
  perform pg_advisory_xact_lock(hashtext(v_customer::text||':'||p_restaurant::text));
  if p_kind='reversal' and exists(select 1 from public.sadakat_operations where reverses_id=p_reverse) then raise exception 'SADAKAT_ALREADY_REVERSED'; end if;
  select goal into v_goal from public.sadakat_programs where restaurant_id=p_restaurant;
  if v_goal is null then raise exception 'SADAKAT_NOT_FOUND'; end if;
  select coalesce(sum(delta),0) into v_balance from public.loyalty_transactions where customer_id=v_customer and scope_key=p_restaurant and type='stamp';
  if p_kind='earn' then
    if p_quantity is null or p_quantity not between 1 and 20 then raise exception 'SADAKAT_INVALID'; end if;
    v_delta:=p_quantity;
  elsif p_kind='redeem' then v_delta:=-v_goal;
  end if;
  if v_balance+v_delta<0 then raise exception 'SADAKAT_INSUFFICIENT'; end if;
  v_result:=jsonb_build_object('id',p_request,'stamps',v_balance+v_delta,'delta',v_delta,'kind',p_kind);
  insert into public.sadakat_operations(id,restaurant_id,customer_id,actor_id,kind,delta,code_digest,reverses_id,reason,result)
    values(p_request,p_restaurant,v_customer,p_actor,p_kind,v_delta,p_digest,p_reverse,case when p_kind='reversal' then btrim(p_reason) else 'manual_'||p_kind end,v_result);
  insert into public.loyalty_transactions(customer_id,restaurant_id,scope_key,type,delta,reason,direction,sadakat_operation_id)
    values(v_customer,p_restaurant,p_restaurant,'stamp',v_delta,case when p_kind='reversal' then 'manual_reversal' else 'manual_'||p_kind end,case when p_kind='reversal' then 'reversal' else p_kind end,p_request);
  return v_result;
end $$;

create function public.read_sadakat_dashboard(p_restaurant uuid,p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_owner boolean; v_result jsonb;
begin
  if not public.sadakat_actor(p_restaurant,p_actor) then raise exception 'SADAKAT_FORBIDDEN'; end if;
  v_owner:=public.sadakat_actor(p_restaurant,p_actor,true);
  select jsonb_build_object('restaurantId',r.id,'slug',r.slug,'restaurantName',r.name,'isOwner',v_owner,'active',public.sadakat_active(r.id),
    'access',(select jsonb_build_object('startsAt',starts_at,'endsAt',ends_at) from public.restaurant_product_access where restaurant_id=r.id and product='sadakat'),
    'program',(select jsonb_build_object('name',name,'logoUrl',logo_url,'color',color,'goal',goal,'reward',reward,'eligibleProducts',eligible_products,'goalLocked',goal_locked) from public.sadakat_programs where restaurant_id=r.id),
    'initialGoal',coalesce((r.settings->'loyalty'->>'stamp_goal')::int,8),
    'initialReward',coalesce(r.settings->'loyalty'->>'stamp_reward_text',''),
    'initialGoalLocked',exists(select 1 from public.loyalty_transactions where restaurant_id=r.id and type='stamp' and delta>0),
    'networkScope',coalesce(r.settings->'loyalty'->>'scope','restaurant')='network') into v_result from public.restaurants r where r.id=p_restaurant;
  if not v_owner then return v_result; end if;
  return v_result||jsonb_build_object(
    'customers',coalesce((select jsonb_agg(to_jsonb(c)) from (
      select m.customer_id as id,c.name,case when c.phone is null then null else '+90 5** *** '||right(c.phone,4) end as phone,m.joined_at as "joinedAt",
        coalesce(sum(t.delta),0) as stamps,max(t.created_at) filter(where t.direction in ('earn','redeem')) as "lastVisit",
        count(distinct (t.created_at at time zone 'Europe/Istanbul')::date) filter(where t.direction in ('earn','redeem')) as visits
      from public.sadakat_memberships m join public.customers c on c.id=m.customer_id
      left join public.loyalty_transactions t on t.customer_id=m.customer_id and t.scope_key=m.restaurant_id and t.type='stamp'
      where m.restaurant_id=p_restaurant group by m.customer_id,c.name,c.phone,m.joined_at order by m.joined_at desc limit 100
    ) c),'[]'::jsonb),
    'operations',coalesce((select jsonb_agg(to_jsonb(o)) from (
      select o.id,o.kind,o.delta,o.reason,o.created_at as "createdAt",o.actor_id as "actorId",c.name,
        exists(select 1 from public.sadakat_operations rev where rev.reverses_id=o.id) as reversed
      from public.sadakat_operations o join public.customers c on c.id=o.customer_id where o.restaurant_id=p_restaurant order by o.created_at desc limit 100
    ) o),'[]'::jsonb),
    'report',jsonb_build_object('members',(select count(*) from public.sadakat_memberships where restaurant_id=p_restaurant),
      'stampsIssued',(select coalesce(sum(delta),0) from public.loyalty_transactions where scope_key=p_restaurant and type='stamp' and direction='earn'),
      'rewardsUsed',(select count(*) from public.loyalty_transactions where scope_key=p_restaurant and type='stamp' and direction='redeem'),
      'newCustomers',(select count(*) from (select customer_id from public.loyalty_transactions where scope_key=p_restaurant and type='stamp' and direction in ('earn','redeem') group by customer_id having count(distinct (created_at at time zone 'Europe/Istanbul')::date)=1) n),
      'returningCustomers',(select count(*) from (select customer_id from public.loyalty_transactions where scope_key=p_restaurant and type='stamp' and direction in ('earn','redeem') group by customer_id having count(distinct (created_at at time zone 'Europe/Istanbul')::date)>1) n)));
end $$;

-- RPCs are exclusively reached through trusted server adapters.
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in
    ('sadakat_active','sadakat_actor','grant_sadakat_pilot','save_sadakat_program','read_sadakat_program','read_sadakat_card','join_sadakat','issue_sadakat_code','resolve_sadakat_code','mutate_sadakat','read_sadakat_dashboard','guard_sadakat_program','lock_sadakat_goal','guard_sadakat_settings') loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
notify pgrst,'reload schema';

-- Keep the audited team mutation aligned with dashboard permissions.
create or replace function public.mutate_team_member_with_audit(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_member_id uuid,
  p_operation text,
  p_permissions jsonb default null,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.restaurant_members%rowtype;
  v_event_type text;
begin
  if not exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id and r.owner_id = p_actor_user_id and r.deleted_at is null
  ) then raise exception 'team_mutation_access_denied' using errcode = '42501'; end if;

  select * into v_member from public.restaurant_members
    where id = p_member_id and restaurant_id = p_restaurant_id for update;
  if not found then raise exception 'team_member_not_found' using errcode = 'P0002'; end if;

  if p_operation = 'permissions' then
    if jsonb_typeof(p_permissions) <> 'array' or jsonb_array_length(p_permissions) < 1
      or exists (
        select 1 from jsonb_array_elements_text(p_permissions) permission
        where permission not in ('pano','orders','menu','tables','customers','analytics','inventory','theme','files','settings','sadakat')
      ) then raise exception 'team_permissions_invalid' using errcode = '22023'; end if;
    update public.restaurant_members set permissions = p_permissions
      where id = p_member_id returning * into v_member;
    v_event_type := 'team_member_permissions_updated';
  elsif p_operation = 'status' then
    if p_status not in ('active', 'disabled') or v_member.status = 'invited' then
      raise exception 'team_status_invalid' using errcode = '22023';
    end if;
    update public.restaurant_members set status = p_status
      where id = p_member_id returning * into v_member;
    v_event_type := case when p_status = 'active' then 'team_member_activated' else 'team_member_disabled' end;
  elsif p_operation = 'remove' then
    delete from public.restaurant_members where id = p_member_id;
    v_event_type := 'team_member_removed';
  else
    raise exception 'team_operation_invalid' using errcode = '22023';
  end if;

  insert into public.security_events (user_id, restaurant_id, event_type, metadata)
  values (
    p_actor_user_id,
    p_restaurant_id,
    v_event_type,
    jsonb_build_object('targetEmail', v_member.email, 'permissions', v_member.permissions)
  );

  return jsonb_build_object(
    'email', v_member.email,
    'permissions', v_member.permissions,
    'status', v_member.status
  );
end;
$$;

-- Minimal independent onboarding; request ID makes retries safe.
create table public.sadakat_business_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id),
  restaurant_id uuid not null references public.restaurants(id),
  name text not null,
  slug text not null
);
alter table public.sadakat_business_requests enable row level security;
revoke all on public.sadakat_business_requests from public,anon,authenticated;
grant select,insert on public.sadakat_business_requests to service_role;
create function public.create_sadakat_business(p_actor uuid,p_name text,p_slug text,p_request uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_existing public.sadakat_business_requests%rowtype; v_id uuid;
begin
  if not exists(select 1 from auth.users where id=p_actor and coalesce(raw_app_meta_data->>'user_type','')<>'customer') then raise exception 'SADAKAT_FORBIDDEN'; end if;
  if length(btrim(p_name)) not between 1 and 120 or length(p_slug) not between 3 and 80 or p_slug!~'^[a-z0-9]+(-[a-z0-9]+)*$' or p_slug in ('kurulum','api','auth','sadakat','dashboard','menu') then raise exception 'SADAKAT_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtext('sadakat-business:'||p_actor::text));
  select * into v_existing from public.sadakat_business_requests where request_id=p_request;
  if found then
    if v_existing.actor_id<>p_actor or v_existing.name<>btrim(p_name) or v_existing.slug<>p_slug then raise exception 'SADAKAT_CONFLICT'; end if;
    return jsonb_build_object('restaurantId',v_existing.restaurant_id);
  end if;
  if (select count(*) from public.restaurants where owner_id=p_actor and created_at>now()-interval '1 day')>=5 then raise exception 'SADAKAT_INVALID'; end if;
  if exists(select 1 from public.restaurants where slug=p_slug) then raise exception 'SADAKAT_SLUG_TAKEN'; end if;
  insert into public.restaurants(owner_id,name,slug,plan) values(p_actor,btrim(p_name),p_slug,'starter') returning id into v_id;
  insert into public.sadakat_business_requests values(p_request,p_actor,v_id,btrim(p_name),p_slug);
  return jsonb_build_object('restaurantId',v_id);
end $$;
revoke all on function public.create_sadakat_business(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_sadakat_business(uuid,text,text,uuid) to service_role;
revoke update,delete on public.sadakat_operations from service_role;
notify pgrst,'reload schema';

-- After expiry, existing members may authenticate to read their retained card.
create function public.can_sadakat_authenticate(p_restaurant uuid,p_phone text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.sadakat_programs p join public.restaurants r on r.id=p.restaurant_id
 where r.id=p_restaurant and r.deleted_at is null and (public.sadakat_active(r.id) or exists(
 select 1 from public.sadakat_memberships m join public.customers c on c.id=m.customer_id
 where m.restaurant_id=r.id and c.phone=p_phone and c.merged_at is null)));
$$;
revoke all on function public.can_sadakat_authenticate(uuid,text) from public,anon,authenticated;
grant execute on function public.can_sadakat_authenticate(uuid,text) to service_role;

-- The existing verified-identity merge moves the shared ledger before marking
-- the source customer merged. Keep independent membership and reversal subjects
-- attached to the survivor too; invalidate every historical personal code.
create function public.merge_sadakat_customer() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.merged_into_customer_id is not null and old.merged_into_customer_id is null then
   insert into public.sadakat_memberships(restaurant_id,customer_id,joined_at)
     select restaurant_id,new.merged_into_customer_id,joined_at from public.sadakat_memberships where customer_id=new.id
     on conflict(restaurant_id,customer_id) do update set joined_at=least(sadakat_memberships.joined_at,excluded.joined_at);
   delete from public.sadakat_memberships where customer_id=new.id;
   delete from public.sadakat_codes where customer_id in (new.id,new.merged_into_customer_id);
   update public.sadakat_operations set customer_id=new.merged_into_customer_id where customer_id=new.id;
 end if;
 return new;
end $$;
create trigger sadakat_identity_merge after update of merged_into_customer_id on public.customers for each row execute function public.merge_sadakat_customer();
revoke all on function public.merge_sadakat_customer() from public,anon,authenticated;
grant execute on function public.merge_sadakat_customer() to service_role;
notify pgrst,'reload schema';
