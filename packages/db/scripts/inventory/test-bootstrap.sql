-- Local disposable Supabase PostgreSQL image only; Auth/Storage service schema fixtures.
create table if not exists storage.objects(id uuid);
alter table storage.objects owner to postgres;
create table if not exists auth.sessions(id uuid primary key,user_id uuid);
grant all on auth.sessions to postgres;
create or replace function auth.jwt() returns jsonb language sql stable as $f$
 select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
$f$;
grant execute on function auth.jwt() to public;
