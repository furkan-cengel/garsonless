-- 3D model assets have no image/video object, so the library showed them with an
-- empty url. Fall back to the public 'model' object; menu/logo urls stay image-only.
create or replace function public.media_asset_json(p_id uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',a.id,'name',a.name,'alt',a.alt,'mime',a.mime,'width',a.width,'height',a.height,'duration',a.duration,'version',a.version,'status',a.status,'createdAt',a.created_at,
 'bytes',coalesce((select sum(bytes) from media_asset_objects where asset_id=a.id),0),
 'url',coalesce((select url from media_asset_objects where asset_id=a.id and role='image'),(select url from media_asset_objects where asset_id=a.id and role='video'),(select url from media_asset_objects where asset_id=a.id and role='model'),''),
 'menuUrl',coalesce((select url from media_asset_objects where asset_id=a.id and role='menu'),(select url from media_asset_objects where asset_id=a.id and role='image'),''),
 'logoUrl',coalesce((select url from media_asset_objects where asset_id=a.id and role='logo'),(select url from media_asset_objects where asset_id=a.id and role='image'),''),
 'uses',(select coalesce(jsonb_agg(jsonb_build_object('table',target_table,'id',target_id,'label',label)),'[]') from media_asset_references where asset_id=a.id)) from media_assets a where a.id=p_id;
$$;
revoke all on function public.media_asset_json(uuid) from public, anon, authenticated;
grant execute on function public.media_asset_json(uuid) to service_role;
