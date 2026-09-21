-- Shared tenant media. Object writes remain service-only; metadata is never public.
create table public.media_storage_usage (
 restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
 initialized boolean not null default false, used bigint not null default 0 check(used>=0), reserved bigint not null default 0 check(reserved>=0)
);
create table public.media_assets (
 id uuid primary key, restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 name text not null check(length(name) between 1 and 200), alt text not null default '' check(length(alt)<=500),
 hash text, mime text not null, width integer, height integer, duration numeric,
 status text not null default 'uploading' check(status in ('uploading','ready','deleting','deleted','failed')),
 version bigint not null default 1, created_by uuid, created_at timestamptz not null default now(), unique(restaurant_id,id)
);
create unique index media_asset_hash on public.media_assets(restaurant_id,hash) where status in ('uploading','ready');
create table public.media_asset_objects (
 asset_id uuid not null references public.media_assets(id) on delete cascade,
 restaurant_id uuid not null, role text not null, bucket text not null check(bucket in ('restaurant-assets','restaurant-media-sources')),
 path text not null, bytes bigint not null check(bytes>=0), url text not null default '',
 primary key(asset_id,role), unique(bucket,path), foreign key(restaurant_id,asset_id) references public.media_assets(restaurant_id,id)
);
create table public.media_asset_references (
 restaurant_id uuid not null, asset_id uuid not null, target_table text not null, target_id text not null, label text not null,
 primary key(asset_id,target_table,target_id), foreign key(restaurant_id,asset_id) references public.media_assets(restaurant_id,id) on delete cascade
);
create table public.media_upload_sessions (
 id uuid primary key, restaurant_id uuid not null references public.restaurants(id) on delete cascade, actor_id uuid not null,
 asset_id uuid not null references public.media_assets(id), metadata jsonb not null, reserved bigint not null,
 status text not null default 'pending' check(status in ('pending','processing','complete','cancelled','failed')),
 lease_until timestamptz, token uuid, expires_at timestamptz not null default now()+interval '1 hour', result_id uuid,
 created_at timestamptz not null default now(), unique(restaurant_id,id)
);
create table public.media_cleanup_jobs (
 id bigint generated always as identity primary key, restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 asset_id uuid references public.media_assets(id), bucket text not null, path text not null, bytes bigint not null default 0,
 status text not null default 'pending' check(status in ('pending','complete')), created_at timestamptz not null default now(), unique(bucket,path)
);
create index media_reference_tenant on public.media_asset_references(restaurant_id,target_table,target_id);
create index media_assets_listing on public.media_assets(restaurant_id,created_at desc) where status='ready';

create function public.media_actor(p_restaurant uuid,p_actor uuid,p_context text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select p_context in ('files','menu','theme','settings','tables') and exists(select 1 from restaurants r where r.id=p_restaurant and r.deleted_at is null and (
 r.owner_id=p_actor or exists(select 1 from restaurant_members m where m.restaurant_id=r.id and m.user_id=p_actor and m.status='active' and m.permissions ? p_context)
 or exists(select 1 from organization_restaurants l join organizations o on o.id=l.organization_id and o.status='active' join organization_members m on m.organization_id=o.id and m.status='active' where l.restaurant_id=r.id and m.user_id=p_actor and (m.role in ('owner','admin') or m.permissions ? p_context))));
$$;
create function public.media_limit(p_restaurant uuid) returns bigint language sql stable security definer set search_path=public,pg_temp as $$
 select case when s.status='trial' and s.trial_ends_at>now() then 1000000000
 when s.status is not null and s.status not in ('active','past_due','grace_period') then 250000000
 else case r.plan::text when 'plus' then 1000000000 when 'pro' then 5000000000 when 'business' then 10000000000 else 250000000 end end
 from restaurants r left join lateral(select status,trial_ends_at from billing_subscriptions where restaurant_id=r.id order by created_at desc limit 1) s on true where r.id=p_restaurant;
$$;
create function public.media_asset_json(p_id uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',a.id,'name',a.name,'alt',a.alt,'mime',a.mime,'width',a.width,'height',a.height,'duration',a.duration,'version',a.version,'status',a.status,'createdAt',a.created_at,
 'bytes',coalesce((select sum(bytes) from media_asset_objects where asset_id=a.id),0),
 'url',coalesce((select url from media_asset_objects where asset_id=a.id and role='image'),(select url from media_asset_objects where asset_id=a.id and role='video'),''),
 'menuUrl',coalesce((select url from media_asset_objects where asset_id=a.id and role='menu'),(select url from media_asset_objects where asset_id=a.id and role='image'),''),
 'logoUrl',coalesce((select url from media_asset_objects where asset_id=a.id and role='logo'),(select url from media_asset_objects where asset_id=a.id and role='image'),''),
 'uses',(select coalesce(jsonb_agg(jsonb_build_object('table',target_table,'id',target_id,'label',label)),'[]') from media_asset_references where asset_id=a.id)) from media_assets a where a.id=p_id;
$$;
-- Exact scalar URL matches, also accepting cache-busting query strings.
create function public.media_urls(p_doc jsonb) returns setof text language sql immutable as $$
 select distinct split_part(v#>>'{}','?',1) from jsonb_path_query(p_doc,'strict $.** ? (@.type() == "string")') v where v#>>'{}' like '%/storage/v1/object/public/restaurant-assets/%';
$$;
create function public.media_reference_sync(p_restaurant uuid,p_table text,p_id text,p_doc jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a record;
begin
 perform pg_advisory_xact_lock(hashtextextended('media:'||p_restaurant::text,0));
 for a in select distinct m.id,m.restaurant_id,m.status from media_assets m join media_asset_objects o on o.asset_id=m.id where o.url<>'' and o.url in(select public.media_urls(p_doc)) loop
 if a.restaurant_id<>p_restaurant then raise exception 'media_tenant_mismatch'; end if;
 if a.status<>'ready' then raise exception 'media_not_available'; end if;
 end loop;
 if exists(select 1 from public.media_urls(p_doc) url where url like '%/restaurant-assets/restaurants/%/library/%' and not exists(select 1 from media_asset_objects o where o.url=url)) then raise exception 'media_not_available';end if;
 delete from media_asset_references where restaurant_id=p_restaurant and target_table=p_table and target_id=p_id;
 insert into media_asset_references(restaurant_id,asset_id,target_table,target_id,label)
 select distinct p_restaurant,o.asset_id,p_table,p_id,left(coalesce(p_doc->>'name',case p_table when 'restaurants' then 'İşletme / QR logosu' when 'theme_configs' then 'Yayındaki tema' when 'theme_drafts' then 'Tema taslağı' when 'theme_config_history' then 'Tema geçmişi' else p_table end),200)
 from media_asset_objects o where o.restaurant_id=p_restaurant and o.url<>'' and o.url in(select public.media_urls(p_doc));
end $$;
create function public.media_reference_trigger() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare doc jsonb; rid uuid; tid text;
begin
 doc:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 rid:=case when tg_table_name='restaurants' then (doc->>'id')::uuid else (doc->>'restaurant_id')::uuid end;
 tid:=coalesce(doc->>'id',doc->>'restaurant_id');
 if tg_table_name='menu_items' then select restaurant_id into rid from menu_categories where id=(doc->>'category_id')::uuid;end if;
 if rid is null and tg_op='DELETE' then delete from media_asset_references where target_table=tg_table_name and target_id=tid;return old;end if;
 if tg_table_name='restaurants' and tg_op='INSERT' then insert into media_storage_usage(restaurant_id,initialized) values(rid,true) on conflict do nothing;end if;
 perform public.media_reference_sync(rid,tg_table_name,tid,case when tg_op='DELETE' then '{}'::jsonb else doc end);
 return case when tg_op='DELETE' then old else new end;
end $$;
do $$ declare t text; begin
 foreach t in array array['restaurants','menu_items','menu_categories','theme_configs','theme_drafts','theme_config_history'] loop
 execute format('create trigger media_references after insert or update or delete on public.%I for each row execute function public.media_reference_trigger()',t);
 end loop;
end $$;

create function public.media_command(p_restaurant uuid,p_actor uuid,p_context text,p_mode text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u media_storage_usage%rowtype; s media_upload_sessions%rowtype; a media_assets%rowtype; rid uuid; n bigint; rows jsonb; existing uuid; obj jsonb; q text; page integer; tok uuid;
begin
 if auth.role() is distinct from 'service_role' or not public.media_actor(p_restaurant,p_actor,p_context) then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(hashtextextended('media:'||p_restaurant::text,0));
 insert into media_storage_usage(restaurant_id) values(p_restaurant) on conflict do nothing;
 select * into u from media_storage_usage where restaurant_id=p_restaurant for update;
 if p_mode='list' then
 q:=left(coalesce(p_payload->>'search',''),200);page:=greatest(0,least(coalesce((p_payload->>'page')::integer,0),100000));
 select count(*) into n from media_assets m where restaurant_id=p_restaurant and status in ('ready','deleting') and position(lower(q) in lower(name))>0
 and (coalesce(p_payload->>'type','all')='all' or mime like (p_payload->>'type')||'/%')
 and (coalesce(p_payload->>'usage','all')='all' or ((p_payload->>'usage')='used')=exists(select 1 from media_asset_references where asset_id=m.id));
 select coalesce(jsonb_agg(public.media_asset_json(id)),'[]') into rows from (select id from media_assets m where restaurant_id=p_restaurant and status in ('ready','deleting') and position(lower(q) in lower(name))>0
 and (coalesce(p_payload->>'type','all')='all' or mime like (p_payload->>'type')||'/%')
 and (coalesce(p_payload->>'usage','all')='all' or ((p_payload->>'usage')='used')=exists(select 1 from media_asset_references where asset_id=m.id))
 order by case when p_payload->>'sort'='largest' then (select sum(bytes) from media_asset_objects where asset_id=m.id) else 0 end desc,created_at desc,id limit 40 offset page*40) x;
 return jsonb_build_object('assets',rows,'total',n,'used',u.used,'reserved',u.reserved,'limit',public.media_limit(p_restaurant),'initialized',u.initialized,'canManage',public.media_actor(p_restaurant,p_actor,'files'));
 end if;
 if not u.initialized then raise exception 'not_initialized'; end if;
 if p_mode='derive' then
 select * into a from media_assets where id=(p_payload->>'id')::uuid and restaurant_id=p_restaurant and status='ready' and mime like 'image/%';
 if not found then raise exception 'not_found';end if;
 if (select count(*) from media_asset_objects where asset_id=a.id and role in ('menu','logo'))=2 then return jsonb_build_object('status','complete','result_id',a.id);end if;
 select * into s from media_upload_sessions where asset_id=a.id and metadata->>'kind'='derive' and status in ('pending','processing') and expires_at>now();
 if found then return to_jsonb(s);end if;
 if exists(select 1 from media_upload_sessions where asset_id=a.id and status in ('failed','cancelled') and reserved>0) then raise exception 'busy';end if;
 delete from media_cleanup_jobs where asset_id=a.id and status='complete';
 n:=7340032;
 if u.used+u.reserved+n>public.media_limit(p_restaurant) then raise exception 'quota_exceeded';end if;
 insert into media_upload_sessions(id,restaurant_id,actor_id,asset_id,metadata,reserved) values(gen_random_uuid(),p_restaurant,p_actor,a.id,jsonb_build_object('kind','derive'),n) returning * into s;
 update media_storage_usage set reserved=reserved+n where restaurant_id=p_restaurant;
 return to_jsonb(s);
 end if;
 if p_mode='prepare' then
 rid:=(p_payload->>'id')::uuid;
 select * into s from media_upload_sessions where id=rid;
 if found then
 if s.restaurant_id<>p_restaurant or s.actor_id<>p_actor or s.metadata<>p_payload-'id' then raise exception 'request_mismatch'; end if;
 return to_jsonb(s);
 end if;
 n:=(p_payload->>'size')::bigint;
 if n not between 1 and 8388608 or p_payload->>'type' not in ('image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm') or length(p_payload->>'name') not between 1 and 200 then raise exception 'invalid_file'; end if;
 if (select count(*) from media_upload_sessions where restaurant_id=p_restaurant and created_at>now()-interval '1 hour')>=100 then raise exception 'busy';end if;
 n:=n+case when p_payload->>'type' like 'video/%' then n else 15728640 end;
 if u.used+u.reserved+n>public.media_limit(p_restaurant) then raise exception 'quota_exceeded';end if;
 insert into media_assets(id,restaurant_id,name,mime,created_by) values(rid,p_restaurant,p_payload->>'name',p_payload->>'type',p_actor);
 insert into media_upload_sessions(id,restaurant_id,actor_id,asset_id,metadata,reserved) values(rid,p_restaurant,p_actor,rid,p_payload-'id',n) returning * into s;
 update media_storage_usage set reserved=reserved+n where restaurant_id=p_restaurant;
 return to_jsonb(s);
 end if;
 if p_mode in ('read','claim','hash','finish','cancel','fail') then
 select * into s from media_upload_sessions where id=(p_payload->>'id')::uuid and restaurant_id=p_restaurant and actor_id=p_actor for update;
 if not found then raise exception 'not_found'; end if;
 if p_mode='read' then return to_jsonb(s); end if;
 if s.status='complete' then return to_jsonb(s);end if;
 if s.status in ('cancelled','failed') or s.expires_at<=now() then raise exception 'expired';end if;
 if p_mode='claim' then
 if s.status='processing' and s.lease_until>now() then return null;end if;
 update media_upload_sessions set status='processing',token=gen_random_uuid(),lease_until=now()+interval '2 minutes' where id=s.id returning * into s;
 return to_jsonb(s);
 end if;
 if p_mode in ('hash','finish') and (s.token is distinct from (p_payload->>'token')::uuid or s.status<>'processing' or s.lease_until<=now()) then raise exception 'busy';end if;
 if p_mode='hash' then
 if p_payload->>'hash' !~ '^[a-f0-9]{64}$' then raise exception 'invalid_file';end if;
 select id into existing from media_assets where restaurant_id=p_restaurant and hash=p_payload->>'hash' and status in ('ready','uploading') and id<>s.asset_id;
 if existing is not null then
 if not exists(select 1 from media_assets where id=existing and status='ready') then raise exception 'busy';end if;
 update media_assets set status='failed' where id=s.asset_id and status='uploading';
 update media_upload_sessions set status='complete',result_id=existing where id=s.id returning * into s;
 update media_storage_usage set reserved=reserved-s.reserved where restaurant_id=p_restaurant;
 insert into media_cleanup_jobs(restaurant_id,bucket,path) values(p_restaurant,'restaurant-media-staging','library/'||s.restaurant_id||'/'||s.id||'/source') on conflict do nothing;
 return to_jsonb(s);
 end if;
 update media_assets set hash=p_payload->>'hash' where id=s.asset_id;
 return to_jsonb(s);
 end if;
 if p_mode='finish' then
 select coalesce(sum((x->>'bytes')::bigint),0) into n from jsonb_array_elements(p_payload->'objects') x;
 if n<=0 or n>s.reserved then raise exception 'invalid_file';end if;
 for obj in select value from jsonb_array_elements(p_payload->'objects') loop
 if obj->>'bucket' not in ('restaurant-assets','restaurant-media-sources') or obj->>'path' not like 'restaurants/'||p_restaurant||'/library/'||s.asset_id||'/%' then raise exception 'invalid_file';end if;
 insert into media_asset_objects(asset_id,restaurant_id,role,bucket,path,bytes,url) values(s.asset_id,p_restaurant,obj->>'role',obj->>'bucket',obj->>'path',(obj->>'bytes')::bigint,coalesce(obj->>'url',''));
 end loop;
 update media_assets set status='ready',width=(p_payload->>'width')::integer,height=(p_payload->>'height')::integer,duration=(p_payload->>'duration')::numeric where id=s.asset_id;
 update media_storage_usage set used=used+n,reserved=reserved-s.reserved where restaurant_id=p_restaurant;
 update media_upload_sessions set status='complete',result_id=asset_id where id=s.id returning * into s;
 insert into media_cleanup_jobs(restaurant_id,bucket,path) values(p_restaurant,'restaurant-media-staging','library/'||s.restaurant_id||'/'||s.id||'/source') on conflict do nothing;
 return to_jsonb(s);
 end if;
 if p_mode='fail' then
 if s.token is distinct from (p_payload->>'token')::uuid then raise exception 'busy';end if;
 update media_upload_sessions set status='failed' where id=s.id;
 update media_assets set status='failed' where id=s.asset_id and status='uploading';
 return '{}'::jsonb;
 end if;
 if p_mode='cancel' then
 if s.status='processing' and s.lease_until>now() then raise exception 'busy';end if;
 update media_upload_sessions set status='cancelled' where id=s.id;
 update media_assets set status='failed' where id=s.asset_id and status='uploading';
 return '{}'::jsonb;
 end if;
 end if;
 select * into a from media_assets where restaurant_id=p_restaurant and id=(p_payload->>'id')::uuid;
 if not found then raise exception 'not_found';end if;
 if p_mode='source' then
 if a.status<>'ready' then raise exception 'not_found';end if;
 return (select to_jsonb(o) from media_asset_objects o where asset_id=a.id order by case role when 'source' then 0 when 'image' then 1 else 2 end limit 1);
 end if;
 if p_mode='asset' then
 if a.status<>'ready' then raise exception 'not_found';end if;
 return public.media_asset_json(a.id);
 end if;
 if p_mode in ('delete','metadata') then
 if not public.media_actor(p_restaurant,p_actor,'files') then raise exception 'forbidden';end if;
 if a.version is distinct from (p_payload->>'version')::bigint then raise exception 'conflict';end if;
 if p_mode='metadata' then
 if a.status<>'ready' then raise exception 'not_found';end if;
 update media_assets set name=btrim(p_payload->>'name'),alt=coalesce(p_payload->>'alt',''),version=version+1 where id=a.id;
 return public.media_asset_json(a.id);
 end if;
 if exists(select 1 from media_asset_references where asset_id=a.id) then raise exception 'in_use';end if;
 if exists(select 1 from media_upload_sessions where asset_id=a.id and status in ('pending','processing')) then raise exception 'busy';end if;
 if a.status='deleted' then return '{}'::jsonb;end if;
 update media_assets set status='deleting' where id=a.id;
 insert into media_cleanup_jobs(restaurant_id,asset_id,bucket,path,bytes) select restaurant_id,asset_id,bucket,path,bytes from media_asset_objects where asset_id=a.id on conflict do nothing;
 return '{}'::jsonb;
 end if;
 raise exception 'invalid_request';
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('restaurant-media-sources','restaurant-media-sources',false,8388608,array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm']) on conflict do nothing;
do $$ declare t text; begin
 foreach t in array array['media_storage_usage','media_assets','media_asset_objects','media_asset_references','media_upload_sessions','media_cleanup_jobs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
 grant select on media_assets,media_asset_references,media_storage_usage to authenticated;
 create policy media_read on media_assets for select to authenticated using(public.media_actor(restaurant_id,auth.uid(),'files'));
 create policy media_read on media_asset_references for select to authenticated using(public.media_actor(restaurant_id,auth.uid(),'files'));
 create policy media_read on media_storage_usage for select to authenticated using(public.media_actor(restaurant_id,auth.uid(),'files'));
end $$;
do $$ declare r record;begin
 for r in select oid::regprocedure sig from pg_proc where pronamespace='public'::regnamespace and proname in ('media_actor','media_limit','media_asset_json','media_urls','media_reference_sync','media_reference_trigger','media_command') loop
 execute format('revoke all on function %s from public,anon,authenticated',r.sig);execute format('grant execute on function %s to service_role',r.sig);
 end loop;
 grant execute on function public.media_actor(uuid,uuid,text) to authenticated;
end $$;

-- Maintenance is service-only and never accepts actor permissions from the browser.
create function public.media_maintenance(p_mode text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; j media_cleanup_jobs%rowtype; n bigint; t text; d record; rid uuid; aid uuid; o jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden';end if;
 if p_mode='sweep' then
 for r in select * from media_upload_sessions where (status in ('pending','processing') and expires_at<now()-interval '10 minutes') or (status in ('cancelled','failed') and reserved>0) order by restaurant_id limit 100 loop
 perform pg_advisory_xact_lock(hashtextextended('media:'||r.restaurant_id::text,0));
 if exists(select 1 from media_upload_sessions where id=r.id and status='complete') then continue;end if;
 update media_upload_sessions set status='failed' where id=r.id;
 update media_assets set status='failed' where id=r.asset_id and status='uploading';
 foreach t in array case when r.metadata->>'kind'='derive' then array['menu.webp','logo.webp'] else array['source','image.webp','menu.webp','logo.webp','video.mp4','video.webm'] end loop
 insert into media_cleanup_jobs(restaurant_id,asset_id,bucket,path) values(r.restaurant_id,r.asset_id,case when t='source' then 'restaurant-media-sources' else 'restaurant-assets' end,'restaurants/'||r.restaurant_id||'/library/'||r.asset_id||'/'||t) on conflict do nothing;
 end loop;
 insert into media_cleanup_jobs(restaurant_id,bucket,path) values(r.restaurant_id,'restaurant-media-staging','library/'||r.restaurant_id||'/'||r.id||'/source') on conflict do nothing;
 end loop;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from media_cleanup_jobs where status='pending' and (bucket<>'restaurant-media-staging' or created_at<now()-interval '3 hours') order by id limit 100) x);
 elsif p_mode='cleaned' then
 select * into j from media_cleanup_jobs where id=(p_payload->>'id')::bigint;
 if not found or j.status='complete' then return '{}'::jsonb;end if;
 perform pg_advisory_xact_lock(hashtextextended('media:'||j.restaurant_id::text,0));
 update media_cleanup_jobs set status='complete' where id=j.id;
 if j.asset_id is not null and not exists(select 1 from media_cleanup_jobs where asset_id=j.asset_id and status='pending') then
 if exists(select 1 from media_assets where id=j.asset_id and status='deleting') then
 select coalesce(sum(bytes),0) into n from media_asset_objects where asset_id=j.asset_id;
 update media_storage_usage set used=used-n where restaurant_id=j.restaurant_id;
 -- Retain immutable URL tombstones so stale forms cannot reattach deleted files.
 update media_assets set status='deleted' where id=j.asset_id;
 elsif exists(select 1 from media_assets where id=j.asset_id and status in ('failed','ready')) then
 select coalesce(sum(reserved),0) into n from media_upload_sessions where asset_id=j.asset_id and status='failed';
 if n is not null then
 update media_storage_usage set reserved=reserved-n where restaurant_id=j.restaurant_id;
 update media_upload_sessions set reserved=0,status='cancelled' where asset_id=j.asset_id and status='failed';
 update media_assets set status='deleted' where id=j.asset_id and status='failed';
 end if;
 end if;
 end if;
 return '{}'::jsonb;
 elsif p_mode='import' then
 rid:=(p_payload->>'restaurantId')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('media:'||rid::text,0));
 insert into media_storage_usage(restaurant_id) values(rid) on conflict do nothing;
 for o in select value from jsonb_array_elements(p_payload->'objects') loop
 if exists(select 1 from media_asset_objects where bucket='restaurant-assets' and path=o->>'path') then continue;end if;
 aid:=gen_random_uuid();
 insert into media_assets(id,restaurant_id,name,mime,status) values(aid,rid,left(o->>'name',200),o->>'mime','ready');
 insert into media_asset_objects(asset_id,restaurant_id,role,bucket,path,bytes,url) values(aid,rid,case when o->>'mime' like 'video/%' then 'video' else 'image' end,'restaurant-assets',o->>'path',(o->>'bytes')::bigint,o->>'url');
 update media_storage_usage set used=used+(o->>'bytes')::bigint where restaurant_id=rid;
 end loop;
 foreach t in array array['restaurants','menu_items','menu_categories','theme_configs','theme_drafts','theme_config_history'] loop
 for d in execute case when t='menu_items' then 'select to_jsonb(x) doc from public.menu_items x join public.menu_categories c on c.id=x.category_id where c.restaurant_id=$1' else format('select to_jsonb(x) doc from public.%I x where %I=$1',t,case when t='restaurants' then 'id' else 'restaurant_id' end) end using rid loop
 perform public.media_reference_sync(rid,t,coalesce(d.doc->>'id',d.doc->>'restaurant_id'),d.doc);
 end loop;
 end loop;
 return '{}'::jsonb;
 elsif p_mode='initialize' then
 rid:=(p_payload->>'restaurantId')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('media:'||rid::text,0));
 insert into media_storage_usage(restaurant_id,initialized) values(rid,true) on conflict(restaurant_id) do update set initialized=true;
 return '{}'::jsonb;
 end if;
 raise exception 'invalid_request';
end $$;
revoke all on function public.media_maintenance(text,jsonb) from public,anon,authenticated;
grant execute on function public.media_maintenance(text,jsonb) to service_role;

create function public.dispatch_media_cleanup() returns boolean language plpgsql security definer set search_path=public,vault,pg_temp as $$
declare endpoint text; secret text;
begin
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='media_library_cleanup_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='media_library_cleanup_secret';
 if endpoint is null or secret is null then return false;end if;
 perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-media-secret',secret),body:='{}'::jsonb,timeout_milliseconds:=45000);
 return true;
end $$;
create function public.configure_media_cleanup_vault(p_url text,p_secret text) returns jsonb language plpgsql security definer set search_path=public,vault,cron,pg_temp as $$
declare sid uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden';end if;
 if p_url not in ('https://yxsegwkzyiscrxiwdeuf.supabase.co/functions/v1/media-library-cleanup','https://svxvloeosiksqfadgkvo.supabase.co/functions/v1/media-library-cleanup') or length(p_secret) not between 32 and 256 then raise exception 'invalid_request';end if;
 select id into sid from vault.secrets where name='media_library_cleanup_url';
 if sid is null then perform vault.create_secret(p_url,'media_library_cleanup_url');else perform vault.update_secret(sid,p_url,'media_library_cleanup_url');end if;
 select id into sid from vault.secrets where name='media_library_cleanup_secret';
 if sid is null then perform vault.create_secret(p_secret,'media_library_cleanup_secret');else perform vault.update_secret(sid,p_secret,'media_library_cleanup_secret');end if;
 perform cron.schedule('media-library-cleanup','*/10 * * * *','select public.dispatch_media_cleanup()');
 return jsonb_build_object('configured',true,'cronScheduled',true);
end $$;
revoke all on function public.dispatch_media_cleanup() from public,anon,authenticated;
revoke all on function public.configure_media_cleanup_vault(text,text) from public,anon,authenticated;
grant execute on function public.configure_media_cleanup_vault(text,text) to service_role;
