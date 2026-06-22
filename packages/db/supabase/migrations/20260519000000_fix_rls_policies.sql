-- Drop the broken session_read_own_orders policy.
-- It relied on current_setting('app.session_id') which the app never sets,
-- so customers could never query their own orders via RLS.
-- Customer order reads are handled server-side via service role key in /api/orders routes.
drop policy if exists "session_read_own_orders" on orders;
