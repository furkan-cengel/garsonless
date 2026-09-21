-- Append-only command evidence and reconciliation; no automatic balance repair.
create table public.media_operation_events (
 id bigint generated always as identity primary key,
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 actor_id uuid not null, context text not null, operation text not null,
 target_id text, recorded_at timestamptz not null default now()
);
alter table public.media_operation_events enable row level security;
revoke all on public.media_operation_events from public,anon,authenticated,service_role;
grant select on public.media_operation_events to service_role;
create index media_operation_events_tenant on public.media_operation_events(restaurant_id,recorded_at desc);
alter function public.media_command(uuid,uuid,text,text,jsonb) rename to media_command_core;
revoke all on function public.media_command_core(uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role;
create function public.media_command(p_restaurant uuid,p_actor uuid,p_context text,p_mode text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 result:=public.media_command_core(p_restaurant,p_actor,p_context,p_mode,p_payload);
 if p_mode in ('prepare','derive','finish','metadata','delete','cancel','fail') then
 insert into public.media_operation_events(restaurant_id,actor_id,context,operation,target_id) values(p_restaurant,p_actor,p_context,p_mode,left(p_payload->>'id',100));
 end if;
 return result;
end $$;
revoke all on function public.media_command(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.media_command(uuid,uuid,text,text,jsonb) to service_role;
create function public.audit_media_storage() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden';end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
 select u.restaurant_id,u.used,u.reserved,
 coalesce((select sum(o.bytes) from media_asset_objects o join media_assets a on a.id=o.asset_id where o.restaurant_id=u.restaurant_id and a.status in ('ready','deleting')),0) expected_used,
 coalesce((select sum(s.reserved) from media_upload_sessions s where s.restaurant_id=u.restaurant_id and s.status<>'complete'),0) expected_reserved
 from media_storage_usage u where u.initialized
 ) x where x.used<>x.expected_used or x.reserved<>x.expected_reserved;
 return result;
end $$;
revoke all on function public.audit_media_storage() from public,anon,authenticated;
grant execute on function public.audit_media_storage() to service_role;
