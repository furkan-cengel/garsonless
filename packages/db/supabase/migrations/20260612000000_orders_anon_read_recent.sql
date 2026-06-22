-- Customer-side realtime: postgres_changes respects RLS, and anon had zero
-- SELECT access on orders (session_read_own_orders was dropped in 20260519),
-- so the menu app never received status updates.
--
-- Narrowest viable policy: anon may read only recent (24h), non-deleted
-- orders. Rows carry no personal data (items/total/table/status); the
-- realtime subscriber additionally filters by exact order id.
create policy "anon_read_recent_orders"
  on orders for select
  to anon
  using (
    deleted_at is null
    and created_at > now() - interval '24 hours'
  );
