-- Drop and recreate the anyone_create_order policy to ensure it exists correctly
drop policy if exists "anyone_create_order" on orders;
create policy "anyone_create_order" on orders for insert with check (true);

-- Also add anon read policy for customers to see their own orders
drop policy if exists "session_read_own_orders" on orders;
