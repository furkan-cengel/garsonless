-- QR menu presentation only. No order, customer, payment or draft-theme data.
create table public.menu_translation_settings (
 restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
 enabled boolean not null default false, initialized boolean not null default false,
 revision bigint not null default 0, glossary jsonb not null default '{}'
);
create table public.menu_translation_fields (
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 key text not null, label text not null, source text not null, source_version bigint not null default 1,
 active boolean not null default true, version bigint not null default 1,
 draft text, draft_source_version bigint, published text, published_source_version bigint,
 primary key(restaurant_id,key)
);
create table public.menu_translation_history (
 id bigint generated always as identity primary key, restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 field_key text not null, source text not null, source_version bigint not null, text text not null,
 action text not null, actor_id uuid, created_at timestamptz not null default now()
);
create index menu_translation_manual_history on public.menu_translation_history(restaurant_id,field_key,id desc) where action='save';
create table public.menu_translation_usage (
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 locale text not null default 'en' check(locale='en'), period text not null,
 used integer not null default 0 check(used>=0), reserved integer not null default 0 check(reserved>=0),
 primary key(restaurant_id,locale,period)
);
create table public.menu_translation_jobs (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 fields jsonb not null, glossary jsonb not null, period text not null, characters integer not null,
 status text not null default 'queued' check(status in ('queued','running','complete','failed','superseded')),
 attempts integer not null default 0, lease uuid, lease_until timestamptz, available_at timestamptz not null default now(),
 error text, input_tokens integer, output_tokens integer, created_at timestamptz not null default now()
);
create index menu_translation_queue on public.menu_translation_jobs(available_at) where status in ('queued','running');
create table public.menu_translation_requests (
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 request_id uuid not null, actor_id uuid not null, input jsonb not null, primary key(restaurant_id,request_id)
);

create function public.menu_translation_allowed(p_restaurant uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.restaurants r join lateral (
 select s.* from public.billing_subscriptions s where s.restaurant_id=r.id and s.status<>'cancelled' order by s.created_at desc limit 1
 ) s on true where r.id=p_restaurant and r.deleted_at is null and r.plan::text in ('pro','business')
 and (s.status in ('active','past_due','grace_period') or (s.status='trial' and s.trial_ends_at>clock_timestamp())));
$$;
create function public.menu_translation_actor(p_restaurant uuid,p_actor uuid,p_owner boolean default false) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.restaurants r where r.id=p_restaurant and r.deleted_at is null and (
 r.owner_id=p_actor or (not p_owner and exists(select 1 from public.restaurant_members m where m.restaurant_id=r.id and m.user_id=p_actor and m.status='active' and m.permissions ? 'menu'))
 or exists(select 1 from public.organization_restaurants link join public.organizations o on o.id=link.organization_id and o.status='active'
 join public.organization_members m on m.organization_id=o.id and m.status='active' where link.restaurant_id=r.id and m.user_id=p_actor
 and (m.role in ('owner','admin') or (not p_owner and m.permissions ? 'menu')))));
$$;
create function public.menu_translation_quota(p_restaurant uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('limit',case when s.status='trial' then 100000 when r.plan::text='business' then 1000000 else 200000 end,
 'period',case when s.status='trial' then 'trial' else to_char(clock_timestamp() at time zone 'Europe/Istanbul','YYYY-MM') end)
 from public.restaurants r left join lateral(select * from public.billing_subscriptions where restaurant_id=r.id and status<>'cancelled' order by created_at desc limit 1) s on true where r.id=p_restaurant;
$$;

-- Explicit allowlist. Stable IDs identify nested ingredients, groups and options.
create function public.menu_translation_sources(p_restaurant uuid) returns table(key text,label text,source text)
language sql stable security definer set search_path=public,pg_temp as $$
 with recursive visible as (
 select c.id,c.name from public.menu_categories c where c.restaurant_id=p_restaurant and c.is_visible and c.deleted_at is null and c.parent_id is null
 union all select c.id,c.name from public.menu_categories c join visible v on c.parent_id=v.id where c.restaurant_id=p_restaurant and c.is_visible and c.deleted_at is null
 ), items as (
 select i.* from public.menu_items i join visible c on c.id=i.category_id where i.deleted_at is null and i.is_available
 ), theme as (select tokens from public.theme_configs where restaurant_id=p_restaurant), fields as (
 select 'category/'||c.id||'/name' key,c.name label,c.name source from visible c
 union all select 'item/'||i.id||'/'||f.key,i.name,f.value from items i cross join lateral jsonb_each_text(jsonb_build_object('name',i.name,'description',i.description,'allergen_note',i.allergen_note,'cross_contact_note',i.cross_contact_note)) f
 union all select 'item/'||i.id||'/ingredient/'||(x->>'id')||'/'||f.key,i.name,f.value from items i cross join lateral jsonb_array_elements(coalesce(i.ingredients,'[]')) x cross join lateral jsonb_each_text(jsonb_build_object('name',x->>'name','amount',x->>'amount')) f
 union all select 'item/'||i.id||'/group/'||(g->>'id')||'/name',i.name,g->>'name' from items i cross join lateral jsonb_array_elements(coalesce(i.modifier_groups,'[]')) g
 union all select 'item/'||i.id||'/group/'||(g->>'id')||'/option/'||(o->>'id')||'/name',i.name,o->>'name' from items i cross join lateral jsonb_array_elements(coalesce(i.modifier_groups,'[]')) g cross join lateral jsonb_array_elements(coalesce(g->'options','[]')) o
 union all select 'theme/pageDescription','Menü açıklaması',tokens->>'pageDescription' from theme
 union all select 'theme/filter/'||(f->>'id')||'/label','Menü filtresi',f->>'label' from theme cross join lateral jsonb_array_elements(coalesce(tokens->'menuCustomFilters','[]')) f
 union all select 'theme/section/'||s.key||'/'||f.key,'Menü bölümü: '||s.key,f.value
 from theme cross join lateral jsonb_each(coalesce(tokens->'sectionSettings','{}')) s
 cross join lateral jsonb_each_text(s.value) f
 where (f.key ~ '^combo[0-9]+(Title|Subtitle|Badge|Description)$' or f.key in ('title','subtitle','description','eyebrow','buttonLabel','label','text','badge','heading','body','quote','cta','ctaText','countdownLabel','chefNote','badgeText','mode1','mode2','mode3','flashCtaText','loyaltyCtaText','couponEyebrow','couponSubtitle','couponTitle','flashAccentText','flashChip','flashCountdownLabel','flashTitle','freebieCtaText','freebieLabel','freebieSubtitle','freebieTitle','guestBody','linkText','loyaltyEyebrow','loyaltyTitle','memberBody','note'))
 and (s.key in (select jsonb_array_elements_text(coalesce(tokens->'sections','[]'))) or exists(select 1 from jsonb_array_elements(coalesce(tokens->'pageBlocks','[]')) b where b->>'type'='section' and b->>'id'=s.key))
 ) select key,label,source from fields where key is not null and nullif(btrim(source),'') is not null;
$$;

create function public.menu_translation_sync(p_restaurant uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('menu-translation:'||p_restaurant::text,0));
 insert into public.menu_translation_settings(restaurant_id) values(p_restaurant) on conflict do nothing;
 update public.menu_translation_fields set active=false where restaurant_id=p_restaurant and active and key not in(select key from public.menu_translation_sources(p_restaurant));
 insert into public.menu_translation_fields(restaurant_id,key,label,source)
 select p_restaurant,key,label,source from public.menu_translation_sources(p_restaurant)
 on conflict(restaurant_id,key) do update set source=excluded.source,label=excluded.label,active=true,
 source_version=menu_translation_fields.source_version+case when menu_translation_fields.source is distinct from excluded.source then 1 else 0 end,
 version=menu_translation_fields.version+case when menu_translation_fields.source is distinct from excluded.source then 1 else 0 end;
end $$;

-- Reserve usage before enqueuing. Called only under the tenant advisory lock.
create function public.menu_translation_enqueue(p_restaurant uuid,p_keys jsonb default null,p_regenerate boolean default false) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare q jsonb; period_name text; remaining integer; f record; batch jsonb:='[]'; chars integer:=0; total integer:=0; terms jsonb;
begin
 if not public.menu_translation_allowed(p_restaurant) then return 0; end if;
 q:=public.menu_translation_quota(p_restaurant); period_name:=q->>'period';
 insert into public.menu_translation_usage(restaurant_id,period) values(p_restaurant,period_name) on conflict do nothing;
 select (q->>'limit')::integer-used-reserved into remaining from public.menu_translation_usage where restaurant_id=p_restaurant and locale='en' and period=period_name for update;
 select glossary into terms from public.menu_translation_settings where restaurant_id=p_restaurant;
 for f in select * from public.menu_translation_fields mf where mf.restaurant_id=p_restaurant and mf.active
 and (p_keys is null or p_keys ? mf.key)
 and (p_regenerate or mf.draft_source_version is distinct from mf.source_version)
 and not exists(select 1 from public.menu_translation_jobs j cross join lateral jsonb_array_elements(j.fields) x where j.restaurant_id=p_restaurant and j.status in ('queued','running') and x->>'key'=mf.key and (x->>'sourceVersion')::bigint=mf.source_version and (x->>'version')::bigint=mf.version)
 order by mf.key loop
   if char_length(f.source)>remaining or char_length(f.source)>12000 then continue; end if;
   if jsonb_array_length(batch)>=20 or chars+char_length(f.source)>12000 then
     insert into public.menu_translation_jobs(restaurant_id,fields,glossary,period,characters) values(p_restaurant,batch,terms,period_name,chars);
     batch:='[]';chars:=0;
   end if;
   batch:=batch||jsonb_build_array(jsonb_build_object('key',f.key,'label',f.label,'source',f.source,'sourceVersion',f.source_version,'version',f.version));
   chars:=chars+char_length(f.source);remaining:=remaining-char_length(f.source);total:=total+char_length(f.source);
 end loop;
 if jsonb_array_length(batch)>0 then insert into public.menu_translation_jobs(restaurant_id,fields,glossary,period,characters) values(p_restaurant,batch,terms,period_name,chars); end if;
 update public.menu_translation_usage set reserved=reserved+total where restaurant_id=p_restaurant and locale='en' and period=period_name;
 return total;
end $$;

create function public.menu_translation_snapshot(p_restaurant uuid,p_actor uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('enabled',s.enabled and public.menu_translation_allowed(p_restaurant),'allowed',public.menu_translation_allowed(p_restaurant),'owner',public.menu_translation_actor(p_restaurant,p_actor,true),'revision',s.revision,'glossary',s.glossary,
 'fields',(select coalesce(jsonb_agg(jsonb_build_object('key',f.key,'label',f.label,'source',f.source,'sourceVersion',f.source_version,'version',f.version,'draft',f.draft,'draftSourceVersion',f.draft_source_version,'published',f.published,'publishedSourceVersion',f.published_source_version,'manualDraft',(select jsonb_build_object('text',h.text,'source',h.source,'sourceVersion',h.source_version) from public.menu_translation_history h where h.restaurant_id=f.restaurant_id and h.field_key=f.key and h.action='save' order by h.id desc limit 1)) order by f.label,f.key),'[]') from public.menu_translation_fields f where f.restaurant_id=p_restaurant and f.active),
 'quota',public.menu_translation_quota(p_restaurant)||jsonb_build_object('used',coalesce(u.used,0),'reserved',coalesce(u.reserved,0)),
 'jobs',(select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'status',j.status,'error',j.error,'createdAt',j.created_at)),'[]') from (select * from public.menu_translation_jobs where restaurant_id=p_restaurant order by created_at desc limit 20) j))
 from public.menu_translation_settings s left join public.menu_translation_usage u on u.restaurant_id=s.restaurant_id and u.locale='en' and u.period=public.menu_translation_quota(p_restaurant)->>'period' where s.restaurant_id=p_restaurant;
$$;

create function public.execute_menu_translation(p_restaurant uuid,p_actor uuid,p_mode text,p_request uuid default null,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.menu_translation_fields%rowtype; row jsonb; old_request public.menu_translation_requests%rowtype; n integer; k text; v text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 if not public.menu_translation_actor(p_restaurant,p_actor,p_mode in ('enable','disable')) then return jsonb_build_object('ok',false,'error','forbidden'); end if;
 if p_mode not in ('snapshot','generate','save','publish','enable','disable','glossary') or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>300000 then raise exception 'invalid_request'; end if;
 perform public.menu_translation_sync(p_restaurant);
 if p_mode='snapshot' then return jsonb_build_object('ok',true,'data',public.menu_translation_snapshot(p_restaurant,p_actor)); end if;
 if p_request is null then raise exception 'invalid_request'; end if;
 if not public.menu_translation_allowed(p_restaurant) then return jsonb_build_object('ok',false,'error','plan_required'); end if;
 select * into old_request from public.menu_translation_requests where restaurant_id=p_restaurant and request_id=p_request;
 if found then
 if old_request.actor_id<>p_actor or old_request.input<>jsonb_build_object('mode',p_mode,'payload',p_payload) then raise exception 'request_mismatch'; end if;
 return jsonb_build_object('ok',true,'data',public.menu_translation_snapshot(p_restaurant,p_actor));
 end if;
 if p_mode in ('save','publish') then
   if jsonb_typeof(p_payload->'fields') is distinct from 'array' or jsonb_array_length(p_payload->'fields') not between 1 and 500 then raise exception 'invalid_request'; end if;
   for row in select value from jsonb_array_elements(p_payload->'fields') loop
     select * into f from public.menu_translation_fields where restaurant_id=p_restaurant and key=row->>'key' and active for update;
     if not found then raise exception 'not_found'; end if;
     if f.version::text is distinct from row->>'version' or f.source_version::text is distinct from row->>'sourceVersion' then raise exception 'conflict'; end if;
     v:=case when p_mode='save' then btrim(row->>'text') else f.draft end;
     if v is null or length(v) not between 1 and 12000 or v~'[<>]' then raise exception 'invalid_text'; end if;
     if p_mode='publish' and f.draft_source_version is distinct from f.source_version then raise exception 'conflict'; end if;
     if (select coalesce(array_agg(m[1] order by m[1]),'{}') from regexp_matches(f.source,'([0-9]+(?:[.,][0-9]+)?)','g') m) is distinct from (select coalesce(array_agg(m[1] order by m[1]),'{}') from regexp_matches(v,'([0-9]+(?:[.,][0-9]+)?)','g') m) then raise exception 'invalid_numbers'; end if;
     insert into public.menu_translation_history(restaurant_id,field_key,source,source_version,text,action,actor_id) values(p_restaurant,f.key,f.source,f.source_version,v,p_mode,p_actor);
     if p_mode='save' then update public.menu_translation_fields set draft=v,draft_source_version=source_version,version=version+1 where restaurant_id=p_restaurant and key=f.key;
     else update public.menu_translation_fields set published=v,published_source_version=source_version,version=version+1 where restaurant_id=p_restaurant and key=f.key; end if;
   end loop;
 elsif p_mode='generate' then
   if p_payload ? 'keys' and (jsonb_typeof(p_payload->'keys')<>'array' or jsonb_array_length(p_payload->'keys')>500) then raise exception 'invalid_request'; end if;
   update public.menu_translation_settings set initialized=true where restaurant_id=p_restaurant;
   n:=public.menu_translation_enqueue(p_restaurant,p_payload->'keys',coalesce((p_payload->>'regenerate')::boolean,false));
   if n=0 then return jsonb_build_object('ok',false,'error','nothing_queued'); end if;
 elsif p_mode='glossary' then
   if jsonb_typeof(p_payload->'terms') is distinct from 'object' or octet_length((p_payload->'terms')::text)>12000 then raise exception 'invalid_request'; end if;
   for k,v in select * from jsonb_each_text(p_payload->'terms') loop
     if length(k) not between 1 and 120 or length(v) not between 1 and 200 or k~'[<>]' or v~'[<>]' then raise exception 'invalid_request'; end if;
   end loop;
   update public.menu_translation_settings set glossary=p_payload->'terms' where restaurant_id=p_restaurant;
 elsif p_mode='enable' then
   if not exists(select 1 from public.menu_translation_fields where restaurant_id=p_restaurant and active) or exists(select 1 from public.menu_translation_fields where restaurant_id=p_restaurant and active and (published is null or published_source_version is distinct from source_version)) then raise exception 'incomplete'; end if;
   update public.menu_translation_settings set enabled=true,initialized=true where restaurant_id=p_restaurant;
 elsif p_mode='disable' then update public.menu_translation_settings set enabled=false where restaurant_id=p_restaurant;
 end if;
 update public.menu_translation_settings set revision=revision+1 where restaurant_id=p_restaurant;
 insert into public.menu_translation_requests values(p_restaurant,p_request,p_actor,jsonb_build_object('mode',p_mode,'payload',p_payload));
 return jsonb_build_object('ok',true,'data',public.menu_translation_snapshot(p_restaurant,p_actor));
exception when raise_exception then return jsonb_build_object('ok',false,'error',sqlerrm);
when invalid_text_representation or check_violation or not_null_violation then return jsonb_build_object('ok',false,'error','invalid_request');
end $$;

create function public.read_public_menu_translations(p_restaurant uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select jsonb_build_object('enabled',s.enabled and public.menu_translation_allowed(p_restaurant),'revision',s.revision,'fields',case when s.enabled and public.menu_translation_allowed(p_restaurant) then
 (select coalesce(jsonb_object_agg(f.key,jsonb_build_object('source',f.source,'text',f.published)),'{}') from public.menu_translation_fields f join public.menu_translation_sources(p_restaurant) src on src.key=f.key and src.source=f.source where f.restaurant_id=p_restaurant and f.active and f.published is not null and f.published_source_version=f.source_version) else '{}'::jsonb end) from public.menu_translation_settings s where s.restaurant_id=p_restaurant),'{"enabled":false,"revision":0,"fields":{}}'::jsonb);
$$;

create function public.menu_translation_source_changed() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid;
begin
 if tg_table_name='menu_items' then
 select restaurant_id into rid from public.menu_categories where id=case when tg_op='DELETE' then old.category_id else new.category_id end;
 else rid:=case when tg_op='DELETE' then old.restaurant_id else new.restaurant_id end; end if;
 if rid is null then return null; end if;
 if exists(select 1 from public.menu_translation_settings where restaurant_id=rid) then
   perform public.menu_translation_sync(rid);
   update public.menu_translation_settings set revision=revision+1 where restaurant_id=rid;
   if exists(select 1 from public.menu_translation_settings where restaurant_id=rid and initialized) then perform public.menu_translation_enqueue(rid); end if;
 end if;
 return null;
end $$;
create trigger menu_translation_catalog_change after insert or update or delete on public.menu_items for each row execute function public.menu_translation_source_changed();
create trigger menu_translation_category_change after insert or update or delete on public.menu_categories for each row execute function public.menu_translation_source_changed();
create trigger menu_translation_theme_change after insert or update or delete on public.theme_configs for each row execute function public.menu_translation_source_changed();

create function public.menu_translation_access_changed() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid;
begin
 rid:=(case when tg_table_name='restaurants' then to_jsonb(new)->>'id' else to_jsonb(new)->>'restaurant_id' end)::uuid;
 if not public.menu_translation_allowed(rid) or (tg_table_name='billing_subscriptions' and to_jsonb(old)->>'status'='trial' and (to_jsonb(old)->>'trial_ends_at')::timestamptz<=clock_timestamp()) then
 update public.menu_translation_settings set enabled=false,revision=revision+1 where restaurant_id=rid and enabled;
 end if;
 return null;
end $$;
create trigger menu_translation_plan_change after update of plan on public.restaurants for each row execute function public.menu_translation_access_changed();
create trigger menu_translation_subscription_change after update of status,trial_ends_at on public.billing_subscriptions for each row execute function public.menu_translation_access_changed();

-- Private drafts/history/jobs. Anonymous consumers get only the approved projection.
do $$ declare t text; f record; begin
 foreach t in array array['menu_translation_settings','menu_translation_fields','menu_translation_history','menu_translation_usage','menu_translation_jobs','menu_translation_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy menu_translation_member_read on public.%I for select to authenticated using (public.dashboard_session_is_verified() and public.has_restaurant_section(restaurant_id,''menu''))',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'menu_translation_%' or p.proname in ('execute_menu_translation','read_public_menu_translations')) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
-- Policy helper requires explicit actor binding, no caller-supplied actor.
grant execute on function public.read_public_menu_translations(uuid) to anon,authenticated;
