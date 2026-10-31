-- Customer associations use linked_at. Preserve the original applied migration.
create or replace function public.save_sadakat_program(p_restaurant uuid,p_actor uuid,p_config jsonb) returns jsonb
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
    select restaurant_id,customer_id,linked_at from public.customer_restaurants where restaurant_id=p_restaurant on conflict do nothing;
  return jsonb_build_object('saved',true);
end $$;

notify pgrst,'reload schema';
