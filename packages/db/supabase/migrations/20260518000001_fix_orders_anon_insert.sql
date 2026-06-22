-- The initial migration was marked-applied without running, so the
-- anyone_create_order policy was never created on the remote DB.
-- This migration adds it explicitly.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'orders' and policyname = 'anyone_create_order'
  ) then
    execute 'create policy "anyone_create_order" on orders for insert with check (true)';
  end if;
end
$$;
