create table public.menu_translation_provider_spend (
 period text primary key, spent_microdollars bigint not null default 0, reserved_microdollars bigint not null default 0
);
create table public.menu_translation_attempts (
 lease uuid primary key, job_id uuid not null references public.menu_translation_jobs(id), period text not null,
 reserved_microdollars bigint not null default 100000, cost_microdollars bigint, created_at timestamptz not null default now()
);
alter table public.menu_translation_provider_spend enable row level security;
alter table public.menu_translation_attempts enable row level security;
revoke all on public.menu_translation_provider_spend,public.menu_translation_attempts from public,anon,authenticated;
grant all on public.menu_translation_provider_spend,public.menu_translation_attempts to service_role;

create function public.claim_menu_translation_job(p_budget_microdollars bigint default 20000000) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.menu_translation_jobs%rowtype; a record; month_name text:=to_char(now() at time zone 'UTC','YYYY-MM'); token uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(hashtextextended('translation-provider-budget',0));
 -- An expired attempt may have reached the provider: conservatively charge its reservation.
 for a in select att.* from public.menu_translation_attempts att join public.menu_translation_jobs job on job.id=att.job_id where att.cost_microdollars is null and job.lease=att.lease and job.lease_until<now() loop
 update public.menu_translation_provider_spend set reserved_microdollars=reserved_microdollars-a.reserved_microdollars,spent_microdollars=spent_microdollars+a.reserved_microdollars where period=a.period;
 update public.menu_translation_attempts set cost_microdollars=reserved_microdollars where lease=a.lease;
 end loop;
 for j in select * from public.menu_translation_jobs where status='running' and lease_until<now() for update skip locked loop
 if j.attempts>=3 then
 update public.menu_translation_jobs set status='failed',error='timeout',lease=null,lease_until=null where id=j.id;
 update public.menu_translation_usage set reserved=reserved-j.characters where restaurant_id=j.restaurant_id and locale='en' and period=j.period;
 else update public.menu_translation_jobs set status='queued',lease=null,lease_until=null where id=j.id; end if;
 end loop;
 insert into public.menu_translation_provider_spend(period) values(month_name) on conflict do nothing;
 if exists(select 1 from public.menu_translation_provider_spend where period=month_name and spent_microdollars+reserved_microdollars+100000>greatest(0,p_budget_microdollars)) then return null; end if;
 select * into j from public.menu_translation_jobs where status='queued' and available_at<=now() order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 if not public.menu_translation_allowed(j.restaurant_id) then
 update public.menu_translation_jobs set status='failed',error='plan_required' where id=j.id;
 update public.menu_translation_usage set reserved=reserved-j.characters where restaurant_id=j.restaurant_id and locale='en' and period=j.period;
 return null;
 end if;
 if not exists(select 1 from jsonb_array_elements(j.fields) x join public.menu_translation_fields f on f.restaurant_id=j.restaurant_id and f.key=x->>'key' and f.active and f.source=x->>'source' and f.source_version=(x->>'sourceVersion')::bigint and f.version=(x->>'version')::bigint) then
 update public.menu_translation_jobs set status='superseded' where id=j.id;
 update public.menu_translation_usage set reserved=reserved-j.characters where restaurant_id=j.restaurant_id and locale='en' and period=j.period;
 return null;
 end if;
 token:=gen_random_uuid();
 update public.menu_translation_jobs set status='running',lease=token,lease_until=now()+interval '120 seconds',attempts=attempts+1 where id=j.id;
 insert into public.menu_translation_attempts(lease,job_id,period) values(token,j.id,month_name);
 update public.menu_translation_provider_spend set reserved_microdollars=reserved_microdollars+100000 where period=month_name;
 return jsonb_build_object('id',j.id,'lease',token,'fields',j.fields,'glossary',j.glossary);
end $$;

create function public.finish_menu_translation_job(p_job uuid,p_lease uuid,p_translations jsonb default null,p_error text default null,p_input_tokens integer default 0,p_output_tokens integer default 0) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.menu_translation_jobs%rowtype; a public.menu_translation_attempts%rowtype; x jsonb; value text; saved integer:=0; price bigint; f public.menu_translation_fields%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden'; end if;
 -- Consistent global-budget -> job -> tenant lock order.
 perform pg_advisory_xact_lock(hashtextextended('translation-provider-budget',0));
 select * into j from public.menu_translation_jobs where id=p_job and lease=p_lease and status='running' and lease_until>now() for update;
 if not found then return 'lease_lost'; end if;
 perform pg_advisory_xact_lock(hashtextextended('menu-translation:'||j.restaurant_id::text,0));
 select * into a from public.menu_translation_attempts where lease=p_lease for update;
 price:=case when p_input_tokens>0 or p_output_tokens>0 then ceil(greatest(0,p_input_tokens)*0.75+greatest(0,p_output_tokens)*4.5)::bigint else a.reserved_microdollars end;
 update public.menu_translation_provider_spend set reserved_microdollars=reserved_microdollars-a.reserved_microdollars,spent_microdollars=spent_microdollars+price where period=a.period;
 update public.menu_translation_attempts set cost_microdollars=price where lease=p_lease;
 if p_error is null then
   if jsonb_typeof(p_translations) is distinct from 'object' then p_error:='invalid_output';
   elsif (select count(*) from jsonb_object_keys(p_translations))<>jsonb_array_length(j.fields) then p_error:='invalid_output';
   else
     for x in select element.value from jsonb_array_elements(j.fields) element loop
       value:=p_translations->>(x->>'key');
       if value is null or length(btrim(value)) not between 1 and 12000 or value~'[<>]' then p_error:='invalid_output'; exit; end if;
       if (select coalesce(array_agg(m[1] order by m[1]),'{}') from regexp_matches(x->>'source','([0-9]+(?:[.,][0-9]+)?)','g') m) is distinct from (select coalesce(array_agg(m[1] order by m[1]),'{}') from regexp_matches(value,'([0-9]+(?:[.,][0-9]+)?)','g') m) then p_error:='invalid_numbers'; exit; end if;
     end loop;
   end if;
 end if;
 if p_error is not null then
   update public.menu_translation_jobs set status=case when attempts<3 and p_error in ('provider_unavailable','timeout','rate_limit') then 'queued' else 'failed' end,
   error=left(p_error,80),lease=null,lease_until=null,available_at=now()+make_interval(secs=>30*j.attempts),input_tokens=p_input_tokens,output_tokens=p_output_tokens where id=j.id;
   if (select status from public.menu_translation_jobs where id=j.id)='failed' then update public.menu_translation_usage set reserved=reserved-j.characters where restaurant_id=j.restaurant_id and locale='en' and period=j.period; end if;
   return 'failed';
 end if;
 if public.menu_translation_allowed(j.restaurant_id) then
 for x in select element.value from jsonb_array_elements(j.fields) element loop
   select * into f from public.menu_translation_fields where restaurant_id=j.restaurant_id and key=x->>'key' and active and source=x->>'source' and source_version=(x->>'sourceVersion')::bigint and version=(x->>'version')::bigint for update;
   if found then
     value:=btrim(p_translations->>f.key);
     insert into public.menu_translation_history(restaurant_id,field_key,source,source_version,text,action) values(j.restaurant_id,f.key,f.source,f.source_version,value,'ai');
     update public.menu_translation_fields set draft=value,draft_source_version=source_version,version=version+1 where restaurant_id=j.restaurant_id and key=f.key;
     saved:=saved+char_length(f.source);
   end if;
 end loop;
 end if;
 update public.menu_translation_usage set reserved=reserved-j.characters,used=used+saved where restaurant_id=j.restaurant_id and locale='en' and period=j.period;
 update public.menu_translation_jobs set status=case when saved>0 then 'complete' else 'superseded' end,error=null,lease=null,lease_until=null,input_tokens=p_input_tokens,output_tokens=p_output_tokens where id=j.id;
 return 'complete';
end $$;
revoke all on function public.claim_menu_translation_job(bigint),public.finish_menu_translation_job(uuid,uuid,jsonb,text,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_menu_translation_job(bigint),public.finish_menu_translation_job(uuid,uuid,jsonb,text,integer,integer) to service_role;

create function public.invoke_menu_translation_worker() returns bigint language plpgsql security definer set search_path=public,vault,net,pg_temp as $$
declare endpoint text; secret text; request bigint;
begin
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='menu_translation_worker_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='menu_translation_worker_secret';
 if nullif(endpoint,'') is null or nullif(secret,'') is null then return null; end if;
 select net.http_post(url:=endpoint,headers:=jsonb_build_object('content-type','application/json','x-translation-secret',secret),body:='{}',timeout_milliseconds:=60000) into request;
 return request;
end $$;
revoke all on function public.invoke_menu_translation_worker() from public,anon,authenticated;
grant execute on function public.invoke_menu_translation_worker() to service_role;
select cron.schedule('menu-translation-worker-every-minute','* * * * *','select public.invoke_menu_translation_worker();');
