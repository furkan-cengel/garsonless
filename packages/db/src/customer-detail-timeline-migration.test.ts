import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../supabase/migrations/20260730040000_customer_detail_timeline_cursor.sql',
  import.meta.url,
), 'utf8')
const generated = readFileSync(new URL('./types.gen.ts', import.meta.url), 'utf8')

test('customer spend follows canonical collected-revenue exclusions in list and detail', () => {
  assert.match(migration, /paid_at is not null[\s\S]*status <> \\'cancelled\\'[\s\S]*payment_method is null or payment_method <> \\'comp\\'/i)
  assert.match(migration, /where paid_at is not null[\s\S]*status <> 'cancelled'[\s\S]*payment_method is null or payment_method <> 'comp'/i)
  assert.match(migration, /deleted_at is null/i)
})

test('timeline cursor is tenant scoped, deletion aware and totally ordered', () => {
  assert.match(migration, /create or replace function public\.get_restaurant_customer_timeline/i)
  assert.match(migration, /o\.restaurant_id = p_restaurant_id[\s\S]*o\.customer_id = p_customer_id[\s\S]*o\.deleted_at is null/i)
  assert.match(migration, /ledger\.restaurant_id = p_restaurant_id[\s\S]*ledger\.customer_id = p_customer_id/i)
  assert.match(migration, /e\.event_at < p_before_at/i)
  assert.match(migration, /e\.kind_order > case p_before_kind/i)
  assert.match(migration, /e\.event_id < p_before_id/i)
  assert.match(migration, /order by event_at desc, kind_order asc, event_id desc/i)
  assert.match(migration, /limit least\(greatest\(p_limit, 1\), 100\) \+ 1/i)
})

test('timeline is service-role-only and generated contract is pinned', () => {
  assert.match(migration, /revoke all on function public\.get_restaurant_customer_timeline[\s\S]*from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function public\.get_restaurant_customer_timeline[\s\S]*to service_role/i)
  assert.match(generated, /get_restaurant_customer_timeline:/)
  for (const field of ['event_id:', 'event_kind:', 'event_at:', 'collected:', 'loyalty_type:']) assert.match(generated, new RegExp(field))
})
