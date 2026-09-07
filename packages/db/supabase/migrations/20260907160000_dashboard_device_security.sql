-- Dashboard step-up evidence is server-owned. Roll out accounts explicitly; never trust user_metadata.
create table public.dashboard_security_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enrolled_at timestamptz not null default now()
);
create table public.dashboard_trusted_devices (
 token_hash text primary key check (length(token_hash)=64),
 user_id uuid not null references auth.users(id) on delete cascade,
 user_agent_hash text not null,
 country text, ip_hash text,
 expires_at timestamptz not null, revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index on public.dashboard_trusted_devices(user_id);
create table public.dashboard_verified_sessions (
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 device_hash text not null,
 user_agent_hash text not null,
 country text, ip_hash text,
 expires_at timestamptz not null, revoked_at timestamptz,
 verified_at timestamptz not null default now()
);
create table public.dashboard_device_challenges (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null references auth.sessions(id) on delete cascade,
 device_hash text not null, code_hash text not null,
 user_agent_hash text not null, country text, ip_hash text,
 attempts integer not null default 0 check (attempts between 0 and 5),
 expires_at timestamptz not null, sent_at timestamptz, consumed_at timestamptz,
 created_at timestamptz not null default now()
);
create index on public.dashboard_device_challenges(session_id,created_at desc);
alter table public.dashboard_security_accounts enable row level security;
alter table public.dashboard_trusted_devices enable row level security;
alter table public.dashboard_verified_sessions enable row level security;
alter table public.dashboard_device_challenges enable row level security;
revoke all on public.dashboard_security_accounts, public.dashboard_trusted_devices,
 public.dashboard_verified_sessions, public.dashboard_device_challenges from public,anon,authenticated;
grant all on public.dashboard_security_accounts, public.dashboard_trusted_devices,
 public.dashboard_verified_sessions, public.dashboard_device_challenges to service_role;

-- Atomic attempt accounting, one-time consumption, device/session binding and evidence publication.
create function public.verify_dashboard_device_challenge(
 p_id uuid,p_user_id uuid,p_session_id uuid,p_device_hash text,p_code_hash text,
 p_user_agent_hash text,p_country text,p_ip_hash text,p_trust boolean
) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.dashboard_device_challenges%rowtype; expiry timestamptz;
begin
 select * into c from public.dashboard_device_challenges where id=p_id for update;
 if not found or c.user_id<>p_user_id or c.session_id<>p_session_id or c.device_hash<>p_device_hash
  or c.user_agent_hash<>p_user_agent_hash or c.country is distinct from p_country
  or c.ip_hash is distinct from p_ip_hash then return 'invalid'; end if;
 if c.consumed_at is not null or c.expires_at<=now() or c.sent_at is null or c.attempts>=5 then return 'expired'; end if;
 update public.dashboard_device_challenges set attempts=attempts+1 where id=p_id;
 if c.code_hash<>p_code_hash then return 'invalid'; end if;
 expiry:=now()+case when p_trust then interval '15 days' else interval '24 hours' end;
 if p_trust then
  insert into public.dashboard_trusted_devices(token_hash,user_id,user_agent_hash,country,ip_hash,expires_at)
   values(p_device_hash,p_user_id,p_user_agent_hash,p_country,p_ip_hash,expiry)
  on conflict(token_hash) do update set user_id=excluded.user_id,user_agent_hash=excluded.user_agent_hash,
   country=excluded.country,ip_hash=excluded.ip_hash,expires_at=excluded.expires_at,revoked_at=null;
 else
  update public.dashboard_trusted_devices set revoked_at=now() where token_hash=p_device_hash and user_id=p_user_id;
 end if;
 insert into public.dashboard_verified_sessions(session_id,user_id,device_hash,user_agent_hash,country,ip_hash,expires_at)
 values(p_session_id,p_user_id,p_device_hash,p_user_agent_hash,p_country,p_ip_hash,expiry)
 on conflict(session_id) do update set device_hash=excluded.device_hash,user_agent_hash=excluded.user_agent_hash,
  country=excluded.country,ip_hash=excluded.ip_hash,expires_at=excluded.expires_at,revoked_at=null,verified_at=now();
 update public.dashboard_device_challenges set consumed_at=now() where session_id=p_session_id and consumed_at is null;
 return 'verified';
end;
$$;
revoke all on function public.verify_dashboard_device_challenge(uuid,uuid,uuid,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.verify_dashboard_device_challenge(uuid,uuid,uuid,text,text,text,text,text,boolean) to service_role;

-- REST/RPC and RLS evidence checks prevent a client obtained password/OAuth session bypassing step-up.
create function public.dashboard_session_is_verified() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select not exists(select 1 from public.dashboard_security_accounts where user_id=auth.uid())
  or exists(select 1 from public.dashboard_verified_sessions s
   join auth.sessions a on a.id=s.session_id and a.user_id=s.user_id
   where s.user_id=auth.uid() and s.session_id::text=auth.jwt()->>'session_id'
    and s.expires_at>now() and s.revoked_at is null);
$$;
revoke all on function public.dashboard_session_is_verified() from public,anon;
grant execute on function public.dashboard_session_is_verified() to authenticated,service_role;
create function public.check_dashboard_session() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.role()='authenticated' and not public.dashboard_session_is_verified() then
  raise sqlstate 'PT403' using message='dashboard_device_verification_required';
 end if;
end;
$$;
revoke all on function public.check_dashboard_session() from public;
grant execute on function public.check_dashboard_session() to authenticated,anon,service_role;
-- Do not overwrite an unrelated pre-request hook silently.
do $$
declare configured text; t record;
begin
 select split_part(config,'=',2) into configured from pg_roles r cross join lateral unnest(r.rolconfig) config
 where r.rolname='authenticator' and config like 'pgrst.db_pre_request=%';
 if configured is not null and configured not in ('','public.check_dashboard_session') then
  raise exception 'Existing PostgREST pre-request hook must be composed before rollout';
 end if;
 for t in select schemaname,tablename from pg_tables where (schemaname='public' or (schemaname='storage' and tablename in ('objects','buckets')))
  and rowsecurity and tablename not in ('dashboard_security_accounts','dashboard_trusted_devices','dashboard_verified_sessions','dashboard_device_challenges') loop
  execute format('create policy dashboard_session_step_up on %I.%I as restrictive for all to authenticated using (public.dashboard_session_is_verified()) with check (public.dashboard_session_is_verified())',t.schemaname,t.tablename);
 end loop;
end;
$$;
alter role authenticator set pgrst.db_pre_request='public.check_dashboard_session';
notify pgrst,'reload config';
