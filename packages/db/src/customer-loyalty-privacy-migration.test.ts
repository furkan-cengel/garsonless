import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260802030000_customer_loyalty_privacy.sql', import.meta.url),
  'utf8',
)

function functionBody(name: string, nextName: string): string {
  const start = migration.indexOf(`create or replace function public.${name}`)
  const end = migration.indexOf(`create or replace function public.${nextName}`, start + 1)
  assert.notEqual(start, -1, `${name} must exist`)
  assert.notEqual(end, -1, `${nextName} boundary must exist`)
  return migration.slice(start, end)
}

test('refund reconciliation reverses earned loyalty cumulatively and restores spent value only on full refund', () => {
  const adjustment = functionBody('apply_order_loyalty_adjustment', 'reconcile_order_loyalty_after_earn')

  assert.match(migration, /check \(direction in \('earn', 'redeem', 'refund', 'reversal'\)\)/i)
  assert.match(migration, /add column if not exists refund_id uuid references public\.order_refunds\(id\) on delete restrict/i)
  assert.match(adjustment, /sum\(r\.amount\)[\s\S]*r\.status = 'succeeded'/i)
  assert.match(adjustment, /least\(1, greatest\(0, v_refunded_total \/ v_order\.total::numeric\)\)/i)
  assert.match(adjustment, /when v_type = 'points' then floor\(v_earned \* v_ratio\)::integer/i)
  assert.match(adjustment, /when v_full then v_earned[\s\S]*else 0/i)
  assert.match(adjustment, /v_target - v_reversed/i)
  assert.match(adjustment, /'refund_full_earn_reversal'[\s\S]*'refund_partial_points_reversal'/i)
  assert.match(adjustment, /if v_full then[\s\S]*direction = 'redeem'[\s\S]*direction = 'refund'/i)
  assert.match(adjustment, /p_refund_id,[\s\S]*-v_needed,[\s\S]*'reversal'/i)
})

test('successful refund and late earn paths reconcile in the same durable transaction', () => {
  assert.match(migration, /after insert or update of status on public\.order_refunds/i)
  assert.match(migration, /new\.status = 'succeeded' and tg_op = 'INSERT'/i)
  assert.match(migration, /old\.status is distinct from 'succeeded'/i)
  assert.match(migration, /after insert on public\.loyalty_transactions[\s\S]*new\.direction = 'earn'/i)
  assert.match(migration, /reconcile_order_loyalty_after_earn\(new\.order_id\)/i)
  assert.match(migration, /Idempotent forward-fix[\s\S]*where r\.status = 'succeeded'[\s\S]*where o\.status = 'cancelled'/i)
  assert.match(migration, /loyalty_tx_refund_type_dir_uniq[\s\S]*refund_id, type, direction/i)
})

test('loyalty account reads use aggregates and a bounded stable cursor', () => {
  const aggregates = functionBody('get_customer_loyalty_aggregates', 'get_customer_loyalty_activity_page')
  const activity = functionBody('get_customer_loyalty_activity_page', 'reject_consent_event_mutation')

  assert.match(aggregates, /direction in \('earn', 'reversal'\)/i)
  assert.match(aggregates, /group by ledger\.restaurant_id, ledger\.scope_key/i)
  assert.match(activity, /ledger\.created_at < p_before_at/i)
  assert.match(activity, /ledger\.created_at = p_before_at and ledger\.id < p_before_id/i)
  assert.match(activity, /order by ledger\.created_at desc, ledger\.id desc/i)
  assert.match(activity, /limit least\(greatest\(p_limit, 1\), 50\) \+ 1/i)
  assert.match(migration, /revoke all on function public\.get_customer_loyalty_aggregates[\s\S]*from public, anon, authenticated/i)
})

test('consent audit is append-only, policy-versioned and service-only', () => {
  assert.match(migration, /create table if not exists public\.customer_consent_events/i)
  assert.match(migration, /consent_type in \('contact_data', 'marketing'\)/i)
  assert.match(migration, /policy_version text not null/i)
  assert.match(migration, /text_digest text not null check \(text_digest ~ '\^\[a-f0-9\]\{64\}\$'\)/i)
  assert.match(migration, /lawful_basis text not null/i)
  assert.match(migration, /alter table public\.customer_consent_events force row level security/i)
  assert.match(migration, /before update or delete on public\.customer_consent_events/i)
  assert.match(migration, /raise exception 'Consent events are append-only'/i)
  assert.match(migration, /record_customer_consent_event[\s\S]*insert into public\.customer_consents[\s\S]*insert into public\.customer_consent_events/i)
  assert.match(migration, /revoke all on table public\.customer_consent_events from public, anon, authenticated/i)
})

test('privacy export persists only a digest and deletion remains a review request', () => {
  const exportBody = functionBody('create_customer_privacy_export', 'request_customer_account_deletion')
  const deleteStart = migration.indexOf('create or replace function public.request_customer_account_deletion')
  const deleteEnd = migration.indexOf("notify pgrst, 'reload schema'", deleteStart)
  const deleteBody = migration.slice(deleteStart, deleteEnd)

  assert.match(migration, /create table if not exists public\.customer_privacy_requests/i)
  assert.match(migration, /alter table public\.customer_privacy_requests force row level security/i)
  assert.match(migration, /revoke all on table public\.customer_privacy_requests from public, anon, authenticated/i)
  assert.match(exportBody, /payload_digest = encode\(extensions\.digest\(v_document::text, 'sha256'\), 'hex'\)/i)
  assert.equal((migration.match(/extensions\.digest\(/g) ?? []).length, 4)
  assert.doesNotMatch(migration.slice(
    migration.indexOf('create table if not exists public.customer_privacy_requests'),
    migration.indexOf('create or replace function public.create_customer_privacy_export'),
  ), /payload jsonb|export_data|document jsonb/i)
  assert.match(deleteBody, /p_confirmation <> 'HESABIMI SİL'/i)
  assert.match(deleteBody, /'delete', 'pending_review'/i)
  assert.match(deleteBody, /'requiresReverification', true, 'preserveFinancialRecords', true/i)
  assert.doesNotMatch(deleteBody, /delete\s+from|truncate|drop\s+table/i)
})
