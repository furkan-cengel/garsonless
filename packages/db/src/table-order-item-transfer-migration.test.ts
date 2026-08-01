import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260729040000_table_order_item_transfers.sql'),
  'utf8',
)
const lockHotfixSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260729050000_fix_table_order_item_transfer_lock.sql'),
  'utf8',
)

test('item transfers are service-only, tenant-scoped and transactionally locked', () => {
  assert.match(sql, /create or replace function public\.transfer_table_order_items/)
  assert.match(sql, /security definer/)
  assert.match(sql, /restaurant_id = p_restaurant_id/)
  assert.match(sql, /order by selected_order\.id\s+for update/)
  assert.doesNotMatch(sql, /join \(select distinct order_id from item_transfer_selection\) selection\s+on selection\.order_id = selected_order\.id\s+order by selected_order\.id\s+for update/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /revoke all on function public\.transfer_table_order_items[\s\S]+from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.transfer_table_order_items[\s\S]+to service_role/)
})

test('deployed item-transfer lock query is upgraded without weakening row locks', () => {
  assert.match(lockHotfixSql, /pg_get_functiondef/)
  assert.match(lockHotfixSql, /join \(select distinct order_id from item_transfer_selection\)/)
  assert.match(lockHotfixSql, /where selected_order\.id in/)
  assert.match(lockHotfixSql, /transfer_table_order_items lock query shape is unknown/)
})

test('partial orders split snapshots while complete orders keep their identity', () => {
  assert.match(sql, /jsonb_array_length\(v_source_items\) = 0[\s\S]+insert into public\.table_transfer_orders/)
  assert.match(sql, /set items = v_source_items, total = round\(v_order\.total - v_moved_total/)
  assert.match(sql, /insert into public\.orders\(/)
  assert.match(sql, /insert into public\.table_transfer_item_splits/)
  assert.match(sql, /source_items_before, source_total_before, moved_quantity/)
})

test('partial transfers fail closed around money, checkout, loyalty and stale quantities', () => {
  assert.match(sql, /Bölünmüş ödeme bulunan hesapta ürün bazlı taşıma yapılamaz/)
  assert.match(sql, /order_payment_tokens/)
  assert.match(sql, /checkout_reservation_id/)
  assert.match(sql, /loyalty_transactions/)
  assert.match(sql, /İndirim veya puan uygulanmış sipariş ürün bazında taşınamaz/)
  assert.match(sql, /Seçilen ürün adedi artık geçerli değil/)
})

test('item transfer retries bind canonical intent and undo rejects later drift', () => {
  assert.match(sql, /table_transfer_item_request_intent/)
  assert.match(sql, /table_transfer_idempotency_conflict/)
  assert.match(sql, /table_transfer_financial_fingerprint/)
  assert.match(sql, /Taşımadan sonra ödeme, ürün veya sipariş durumu değişti/)
  assert.match(sql, /Ürünler daha sonra başka bir taşıma işlemine dahil edildi/)
  assert.match(sql, /set items = v_split\.source_items_before, total = v_split\.source_total_before/)
  assert.match(sql, /Ürün taşıma geri alındı/)
})
