-- AI menu reader: failed reads no longer use a daily read, and the status read reports the
-- remaining reads and the menu's category names so the review can mark new categories.

create or replace function public.enqueue_menu_import(p_restaurant uuid,p_actor uuid,p_id uuid,p_filename text,p_mime text,p_source text,p_hash text)
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
 if (select count(*) from public.menu_import_jobs where restaurant_id=p_restaurant and status<>'failed' and created_at>now()-interval '24 hours')>=5
 or (select count(*) from public.menu_import_jobs where created_at>now()-interval '24 hours')>=100 then raise exception 'quota_exceeded'; end if;
 if exists(select 1 from public.menu_import_jobs where restaurant_id=p_restaurant and status in ('queued','reading','review') and not dismissed) then raise exception 'active_job_exists'; end if;
 insert into public.menu_import_jobs(id,restaurant_id,actor_id,filename,mime,source_data,source_hash)
 values(p_id,p_restaurant,p_actor,p_filename,p_mime,p_source,p_hash) returning * into j;
 return public.menu_import_public_job(j);
end $$;

create or replace function public.read_menu_imports(p_restaurant uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.has_restaurant_section(p_restaurant,'menu') then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('jobs',coalesce((select jsonb_agg(public.menu_import_public_job(j) order by j.created_at desc)
 from (select * from public.menu_import_jobs where restaurant_id=p_restaurant and not dismissed order by created_at desc limit 5) j),'[]'::jsonb),
 'itemCount',(select count(*) from public.menu_items i join public.menu_categories c on c.id=i.category_id where c.restaurant_id=p_restaurant and c.deleted_at is null and i.deleted_at is null),
 'hasLogo',exists(select 1 from public.restaurants where id=p_restaurant and nullif(logo_url,'') is not null),
 'categories',coalesce((select jsonb_agg(c.name order by c.position, c.name) from public.menu_categories c where c.restaurant_id=p_restaurant and c.deleted_at is null),'[]'::jsonb),
 'quota',(select jsonb_build_object('limit',5,'used',count(*),'resetsAt',min(created_at)+interval '24 hours')
  from public.menu_import_jobs where restaurant_id=p_restaurant and status<>'failed' and created_at>now()-interval '24 hours'));
end $$;
