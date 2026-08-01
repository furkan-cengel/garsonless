import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260729070000_dashboard_pano_metrics.sql', import.meta.url),
  'utf8',
)
const operationalCountsMigration = readFileSync(
  new URL('../supabase/migrations/20260729080000_dashboard_pano_operational_counts.sql', import.meta.url),
  'utf8',
)

test('Pano metrics fold raw orders into bounded aggregate JSON', () => {
  assert.match(migration, /create or replace function public\.read_dashboard_pano_metrics/)
  assert.match(migration, /generate_series\(0, 23\)/)
  assert.match(migration, /generate_series\(0, 6\)/)
  assert.match(migration, /jsonb_array_elements/)
  assert.match(migration, /limit 7/)
  assert.match(migration, /limit 5/)
})

test('Pano metrics mirror canonical collected-revenue exclusions', () => {
  assert.match(migration, /paid_at is not null/)
  assert.match(migration, /status <> 'cancelled'/)
  assert.match(migration, /payment_method is null or payment_method <> 'comp'/)
})

test('Pano metrics are read-only and service-role only', () => {
  assert.match(migration, /language sql[\s\S]*stable[\s\S]*security definer/)
  assert.match(migration, /set search_path = public, pg_temp/)
  assert.match(migration, /revoke all on function public\.read_dashboard_pano_metrics[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.read_dashboard_pano_metrics[\s\S]*to service_role/)
  assert.doesNotMatch(migration, /\b(insert|update|delete)\s+(into|public\.)/i)
})

test('Pano metrics expose exact pending and preparing operational counts', () => {
  assert.match(operationalCountsMigration, /active_order_metrics/)
  assert.match(operationalCountsMigration, /'pendingOrders'/)
  assert.match(operationalCountsMigration, /'preparingOrders'/)
  assert.match(operationalCountsMigration, /status in \('pending', 'pending_approval'\)/)
  assert.match(operationalCountsMigration, /status in \('sent_to_kitchen', 'preparing', 'paid'\)/)
  assert.match(operationalCountsMigration, /revoke all on function public\.read_dashboard_pano_metrics[\s\S]*from public, anon, authenticated/)
})
