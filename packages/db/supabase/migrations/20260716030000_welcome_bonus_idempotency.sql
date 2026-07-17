-- Consumer receipts are the delivery boundary, but a process can crash after
-- the ledger write and before the receipt. Keep the ledger itself idempotent
-- under that duplicate delivery window as well.

create unique index if not exists loyalty_tx_welcome_scope_uniq
  on public.loyalty_transactions(customer_id, scope_key)
  where type = 'points' and direction = 'earn' and reason = 'welcome';
