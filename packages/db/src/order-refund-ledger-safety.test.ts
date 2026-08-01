import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20260730070000_order_refund_ledger.sql', import.meta.url),
  'utf8',
)

test('refund ledger is tenant-scoped, client-inaccessible and idempotent', () => {
  assert.match(migration, /alter table public\.order_refunds enable row level security/i)
  assert.match(migration, /revoke all on table public\.order_refunds from public, anon, authenticated/i)
  assert.match(migration, /order_refunds_idempotency_uidx[\s\S]*restaurant_id, source, idempotency_key/i)
  assert.match(migration, /o\.id = p_order_id[\s\S]*o\.restaurant_id = p_restaurant_id/i)
  assert.match(migration, /r\.id = p_restaurant_id and r\.owner_id = p_actor_user_id/i)
  assert.match(migration, /foreign key \(order_id, restaurant_id\)[\s\S]*references public\.orders\(id, restaurant_id\)/i)
})

test('manual and provider success paths cannot be confused', () => {
  assert.match(migration, /source = 'manual' and payment_method in \('cash', 'pos'\) and status = 'succeeded'/i)
  assert.match(migration, /source = 'provider' and payment_method = 'iyzico' and provider = 'iyzico'/i)
  assert.match(migration, /create or replace function public\.finalize_iyzico_order_refund/i)
  assert.match(migration, /provider_payment_id <> btrim\(p_provider_payment_id\)/i)
  assert.match(migration, /status in \('pending', 'pending_reconciliation', 'succeeded'\)/i)
  assert.doesNotMatch(migration, /raw_payload|payload_raw|webhook_body|secret_key|api_key/i)
})

test('paid manual cancellation completes the remaining refund atomically', () => {
  assert.match(migration, /create or replace function public\.cancel_paid_manual_order_with_refund/i)
  assert.match(migration, /perform public\.record_manual_order_refund/i)
  assert.match(migration, /'cancel:' \|\| p_order_id::text/i)
})
