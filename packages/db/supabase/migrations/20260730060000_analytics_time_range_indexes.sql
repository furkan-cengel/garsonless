-- Rapor sorgularının tenant + zaman aralığı predikatları için production indexleri.
-- Salt şema değişikliğidir; veri dönüştürmez veya iş kaydı oluşturmaz.

create index if not exists orders_analytics_paid_at_idx
  on public.orders (restaurant_id, paid_at)
  where paid_at is not null and deleted_at is null;

create index if not exists orders_analytics_created_at_idx
  on public.orders (restaurant_id, created_at)
  where deleted_at is null;

create index if not exists table_sessions_analytics_closed_at_idx
  on public.table_sessions (restaurant_id, closed_at)
  where closed_at is not null;

create index if not exists loyalty_transactions_analytics_created_at_idx
  on public.loyalty_transactions (restaurant_id, created_at);
