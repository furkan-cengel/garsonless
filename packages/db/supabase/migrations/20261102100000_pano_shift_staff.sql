-- Pano "today's shift": who entered how many orders today and over which hours.
-- Staff-entered orders carry the member's auth user id in session_id with
-- source 'staff'; settled_by records who collected a bill. Read-only.

create or replace function public.read_dashboard_pano_staff(p_restaurant_id uuid, p_now timestamptz, p_timezone text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with bounds as (
    select date_trunc('day', p_now at time zone p_timezone) at time zone p_timezone as day_start
  ),
  activity as (
    select o.session_id as user_id, o.created_at as at, 1 as entered, 0 as settled
    from public.orders o, bounds b
    where o.restaurant_id = p_restaurant_id and o.source = 'staff' and o.deleted_at is null
      and o.created_at >= b.day_start and o.created_at <= p_now
    union all
    select o.settled_by, o.paid_at, 0, 1
    from public.orders o, bounds b
    where o.restaurant_id = p_restaurant_id and o.settled_by is not null and o.deleted_at is null
      and o.paid_at >= b.day_start and o.paid_at <= p_now
  ),
  people as (
    select a.user_id, sum(a.entered)::int as entered, sum(a.settled)::int as settled, min(a.at) as first_at, max(a.at) as last_at
    from activity a group by a.user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', p.user_id,
    'name', left(coalesce(
      nullif(btrim(u.raw_user_meta_data->>'display_name'), ''),
      nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data->>'name'), ''),
      nullif(split_part(u.email, '@', 1), ''),
      'Ekip üyesi'), 80),
    'isOwner', r.owner_id = p.user_id,
    'entered', p.entered,
    'settled', p.settled,
    'firstAt', p.first_at,
    'lastAt', p.last_at
  ) order by p.entered + p.settled desc, p.first_at), '[]'::jsonb)
  from people p
  join public.restaurants r on r.id = p_restaurant_id
  left join auth.users u on u.id = p.user_id
  -- Only the owner and this restaurant's members; a stray id never shows up.
  where r.owner_id = p.user_id
     or exists (select 1 from public.restaurant_members m where m.restaurant_id = p_restaurant_id and m.user_id = p.user_id);
$$;

revoke all on function public.read_dashboard_pano_staff(uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.read_dashboard_pano_staff(uuid, timestamptz, text) to service_role;
