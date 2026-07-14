-- Customer operational state is now served by narrow service-role API routes
-- that require the order's session id or the table's unpredictable UUID.
drop policy if exists "anon_read_recent_orders" on public.orders;
revoke select on public.orders from anon;

drop policy if exists "anon_read_payment_shares" on public.payment_shares;
revoke select on public.payment_shares from anon;

-- Open table-session discovery also moved behind /api/table-state.
drop policy if exists "anon_read_open_table_sessions" on public.table_sessions;
drop policy if exists "anon_read_table_sessions" on public.table_sessions;
revoke select on public.table_sessions from anon;
