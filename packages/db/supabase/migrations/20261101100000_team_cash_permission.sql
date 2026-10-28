-- Team roles: a "cash" permission lets a member see the shift till on Pano
-- (taken, open, cash, comp and cancellations for today) without the full
-- analytics section. It is not a page, so it never becomes a landing route.
--
-- The allowed list keeps 'sadakat', which PROD already accepts through
-- 20261005120000_sadakat_pilot; the body is otherwise that version's.

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
        where permission not in ('pano','orders','menu','tables','customers','analytics','inventory','theme','files','settings','sadakat','cash')
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
