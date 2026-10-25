-- Durable, bounded document reading. Sources are private and erased on completion.
create table public.menu_import_jobs (
 id uuid primary key, restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 actor_id uuid not null references auth.users(id), filename text not null,
 mime text not null check(mime in ('application/pdf','image/jpeg','image/png','image/webp')),
 source_data text, source_hash text not null,
 status text not null default 'queued' check(status in ('queued','reading','review','applied','failed','cancelled')),
 rows jsonb not null default '[]', revision integer not null default 0,
 lease uuid, lease_until timestamptz, attempts integer not null default 0,
 error text, imported_count integer not null default 0, dismissed boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(octet_length(source_data)<=4194304), check(char_length(filename) between 1 and 180)
);
create index menu_import_queue on public.menu_import_jobs(created_at) where status in ('queued','reading');
create index menu_import_tenant on public.menu_import_jobs(restaurant_id,created_at desc);
alter table public.menu_import_jobs enable row level security;
revoke all on public.menu_import_jobs from public,anon,authenticated;
grant all on public.menu_import_jobs to service_role;

create function public.menu_import_public_job(j public.menu_import_jobs) returns jsonb
language sql immutable set search_path=public,pg_temp as $$
 select jsonb_build_object('id',j.id,'filename',j.filename,'status',j.status,'rows',j.rows,
 'revision',j.revision,'error',j.error,'created_at',j.created_at,'imported_count',j.imported_count);
$$;

-- Called only by the validated dashboard upload route, after RBAC + entitlement checks.
create function public.enqueue_menu_import(p_restaurant uuid,p_actor uuid,p_id uuid,p_filename text,p_mime text,p_source text,p_hash text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.menu_import_jobs;
begin
 if not public.menu_translation_actor(p_restaurant,p_actor) then raise exception 'forbidden' using errcode='42501'; end if;
 -- Serialize quota checks globally, including concurrent requests across tenants.
 perform pg_advisory_xact_lock(hashtextextended('menu-import-quota',0));
 select * into j from public.menu_import_jobs where id=p_id;
 if found then
  if j.restaurant_id<>p_restaurant or j.actor_id<>p_actor or j.source_hash<>p_hash then raise exception 'request_mismatch'; end if;
  return public.menu_import_public_job(j);
 end if;
 if nullif(p_source,'') is null or octet_length(p_source)>4194304 or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_input'; end if;
 if (select count(*) from public.menu_import_jobs where restaurant_id=p_restaurant and created_at>now()-interval '24 hours')>=5
 or (select count(*) from public.menu_import_jobs where created_at>now()-interval '24 hours')>=100 then raise exception 'quota_exceeded'; end if;
 if exists(select 1 from public.menu_import_jobs where restaurant_id=p_restaurant and status in ('queued','reading','review') and not dismissed) then raise exception 'active_job_exists'; end if;
 insert into public.menu_import_jobs(id,restaurant_id,actor_id,filename,mime,source_data,source_hash)
 values(p_id,p_restaurant,p_actor,p_filename,p_mime,p_source,p_hash) returning * into j;
 return public.menu_import_public_job(j);
end $$;

create function public.read_menu_imports(p_restaurant uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.has_restaurant_section(p_restaurant,'menu') then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('jobs',coalesce((select jsonb_agg(public.menu_import_public_job(j) order by j.created_at desc)
 from (select * from public.menu_import_jobs where restaurant_id=p_restaurant and not dismissed order by created_at desc limit 5) j),'[]'::jsonb),
 'itemCount',(select count(*) from public.menu_items i join public.menu_categories c on c.id=i.category_id where c.restaurant_id=p_restaurant and c.deleted_at is null and i.deleted_at is null),
 'hasLogo',exists(select 1 from public.restaurants where id=p_restaurant and nullif(logo_url,'') is not null));
end $$;

create function public.review_menu_import(p_restaurant uuid,p_job uuid,p_revision integer,p_mode text,p_rows jsonb default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.menu_import_jobs; r jsonb; payload jsonb:='[]'; result jsonb; n integer:=1;
begin
 if auth.uid() is null or not public.has_restaurant_section(p_restaurant,'menu') then raise exception 'forbidden' using errcode='42501'; end if;
 select * into j from public.menu_import_jobs where id=p_job and restaurant_id=p_restaurant for update;
 if not found then raise exception 'not_found'; end if;
 -- Replaying an apply after a lost response cannot insert the menu twice.
 if p_mode='apply' and j.status='applied' then return public.menu_import_public_job(j); end if;
 if j.revision<>p_revision then raise exception 'revision_conflict'; end if;
 if p_mode='dismiss' then
  update public.menu_import_jobs set dismissed=true,source_data=null,lease=null,lease_until=null,
   status=case when status in ('queued','reading','review') then 'cancelled' else status end,
   revision=revision+1,updated_at=now() where id=j.id returning * into j;
  return public.menu_import_public_job(j);
 end if;
 if j.status<>'review' or p_mode not in ('save','apply') then raise exception 'invalid_state'; end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 200 or octet_length(p_rows::text)>300000 then raise exception 'invalid_input'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(r)<>'object' or (r-'category'-'name'-'description'-'price')<>'{}'::jsonb
   or jsonb_typeof(r->'category') is distinct from 'string' or char_length(btrim(r->>'category')) not between 1 and 100
   or jsonb_typeof(r->'name') is distinct from 'string' or char_length(btrim(r->>'name')) not between 1 and 100
   or jsonb_typeof(r->'description') is distinct from 'string' or char_length(r->>'description')>500
   or not (r ? 'price') or (jsonb_typeof(r->'price') not in ('number','null')) then raise exception 'invalid_input'; end if;
  if r->'price'<>'null'::jsonb and ((r->>'price')::numeric<0.01 or (r->>'price')::numeric>1000000) then raise exception 'invalid_input'; end if;
  if p_mode='apply' and r->'price'='null'::jsonb then raise exception 'missing_price'; end if;
  n:=n+1;
  payload:=payload||jsonb_build_array(jsonb_build_object('sourceRow',n,'category',btrim(r->>'category'),'name',btrim(r->>'name'),
   'description',r->>'description','price',r->'price','ingredients','[]'::jsonb,'energyKcal',null,
   'mayContainAllergens','[]'::jsonb,'containsAlcohol',false,'containsPork',false));
 end loop;
 if p_mode='apply' then
  -- Existing import command owns category creation, duplicate detection and menu events.
  -- Raising on partial failure rolls back ALL its writes; the review remains editable.
  result:=public.import_menu_rows(p_restaurant,payload);
  if jsonb_array_length(result->'failures')>0 then raise exception 'menu_conflict'; end if;
 end if;
 update public.menu_import_jobs set rows=p_rows,revision=revision+1,updated_at=now(),
  status=case when p_mode='apply' then 'applied' else 'review' end,
  imported_count=case when p_mode='apply' then jsonb_array_length(result->'items') else 0 end
 where id=j.id returning * into j;
 return public.menu_import_public_job(j);
end $$;

-- Runs from SQL cron even when the provider or worker credentials are unavailable.
create function public.expire_menu_imports() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.menu_import_jobs set status='failed',error='expired',source_data=null,lease=null,lease_until=null,revision=revision+1
 where status in ('queued','reading') and (created_at<now()-interval '24 hours' or (attempts>=2 and lease_until<now()));
 -- Retention also bounds abandoned reviews; no uploaded source survives 24 hours.
 update public.menu_import_jobs set source_data=null where source_data is not null and created_at<now()-interval '24 hours';
 delete from public.menu_import_jobs where created_at<now()-interval '30 days';
end $$;
revoke all on function public.expire_menu_imports() from public,anon,authenticated;
grant execute on function public.expire_menu_imports() to service_role;

create function public.claim_menu_import() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.menu_import_jobs;
begin
 perform public.expire_menu_imports();
 select * into j from public.menu_import_jobs where (status='queued' or (status='reading' and lease_until<now()))
 and attempts<2 order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 if not public.menu_translation_actor(j.restaurant_id,j.actor_id) then
  update public.menu_import_jobs set status='failed',error='forbidden',source_data=null,revision=revision+1 where id=j.id;
  return null;
 end if;
 update public.menu_import_jobs set status='reading',lease=gen_random_uuid(),lease_until=now()+interval '3 minutes',
 attempts=attempts+1,revision=revision+1,updated_at=now() where id=j.id returning * into j;
 return jsonb_build_object('id',j.id,'lease',j.lease,'mime',j.mime,'base64',j.source_data);
end $$;

create function public.finish_menu_import(p_job uuid,p_lease uuid,p_rows jsonb default null,p_error text default null)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_error is not null and p_error not in ('provider_busy','provider_unavailable','incomplete_output','unreadable_menu','invalid_output','too_many_items','timeout') then p_error:='provider_unavailable'; end if;
 if p_error is null and (p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 200 or octet_length(p_rows::text)>300000) then p_error:='invalid_output'; end if;
 update public.menu_import_jobs set status=case when p_error is null then 'review' else 'failed' end,
 rows=case when p_error is null then p_rows else '[]'::jsonb end,error=p_error,source_data=null,
 lease=null,lease_until=null,revision=revision+1,updated_at=now()
 where id=p_job and lease=p_lease and status='reading' and lease_until>now();
 return found;
end $$;

revoke all on function public.menu_import_public_job(public.menu_import_jobs),public.enqueue_menu_import(uuid,uuid,uuid,text,text,text,text),public.read_menu_imports(uuid),public.review_menu_import(uuid,uuid,integer,text,jsonb),public.claim_menu_import(),public.finish_menu_import(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.enqueue_menu_import(uuid,uuid,uuid,text,text,text,text),public.claim_menu_import(),public.finish_menu_import(uuid,uuid,jsonb,text) to service_role;
grant execute on function public.read_menu_imports(uuid),public.review_menu_import(uuid,uuid,integer,text,jsonb) to authenticated;

create function public.invoke_menu_import_worker() returns bigint language plpgsql security definer set search_path=public,vault,net,pg_temp as $$
declare endpoint text; secret text; request bigint;
begin
 perform public.expire_menu_imports();
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='menu_import_worker_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='menu_import_worker_secret';
 if nullif(endpoint,'') is null or nullif(secret,'') is null then return null; end if;
 select net.http_post(url:=endpoint,headers:=jsonb_build_object('content-type','application/json','x-menu-import-secret',secret),body:='{}',timeout_milliseconds:=120000) into request;
 return request;
end $$;
revoke all on function public.invoke_menu_import_worker() from public,anon,authenticated;
grant execute on function public.invoke_menu_import_worker() to service_role;
select cron.schedule('menu-import-worker-every-minute','* * * * *','select public.invoke_menu_import_worker();');

-- Service-only provisioning; no secret value is returned to the caller.
create function public.configure_menu_import_worker_vault(p_url text,p_secret text)
returns jsonb language plpgsql security definer set search_path=public,vault,cron,pg_temp as $$
declare url_id uuid; secret_id uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 if p_url is null or p_url not in (
  'https://yxsegwkzyiscrxiwdeuf.supabase.co/functions/v1/menu-import-worker',
  'https://svxvloeosiksqfadgkvo.supabase.co/functions/v1/menu-import-worker'
 ) then raise exception 'invalid_worker_url' using errcode='22023'; end if;
 if char_length(coalesce(p_secret,'')) not between 32 and 256 then raise exception 'invalid_worker_secret' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('menu-import-worker-configuration',0));
 select id into url_id from vault.secrets where name='menu_import_worker_url';
 select id into secret_id from vault.secrets where name='menu_import_worker_secret';
 if url_id is null then
  perform vault.create_secret(p_url,'menu_import_worker_url','Scheduled Menu import worker');
 else perform vault.update_secret(url_id,p_url,'menu_import_worker_url'); end if;
 if secret_id is null then
  perform vault.create_secret(p_secret,'menu_import_worker_secret','Menu import worker authentication');
 else perform vault.update_secret(secret_id,p_secret,'menu_import_worker_secret'); end if;
 return jsonb_build_object('configured',true,'cronScheduled',exists(select 1 from cron.job where jobname='menu-import-worker-every-minute' and active));
end $$;
revoke all on function public.configure_menu_import_worker_vault(text,text) from public,anon,authenticated;
grant execute on function public.configure_menu_import_worker_vault(text,text) to service_role;
