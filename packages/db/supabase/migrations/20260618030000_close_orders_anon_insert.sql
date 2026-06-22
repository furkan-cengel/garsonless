-- Sprint 18b: customer orders must be created through /api/orders, where the
-- service-role path recomputes money and checks restaurant/table scope.

drop policy if exists "anyone_create_order" on public.orders;
revoke insert on public.orders from anon;
