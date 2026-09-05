import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260903053000_loyalty_conflict_predicate_alignment.sql', import.meta.url),
  'utf8',
)

const rollback = readFileSync(
  new URL('../supabase/migrations/20260903053000_loyalty_conflict_predicate_alignment.rollback.md', import.meta.url),
  'utf8',
)

test('loyalty redemption conflict targets infer the refund-aware partial unique index', () => {
  assert.match(migration, /loyalty_tx_order_type_dir_uniq/)
  assert.match(migration, /\(order_id, type, direction\)/)
  assert.match(migration, /order_id is not null and refund_id is null do nothing/)
})

test('both active RPC signatures are patched with an exact fail-closed shape guard', () => {
  assert.match(
    migration,
    /public\.redeem_loyalty\(uuid,uuid,uuid,uuid,integer,integer,integer,boolean\)'::regprocedure/,
  )
  assert.match(
    migration,
    /public\.finalize_order_discount\(uuid,uuid,uuid,uuid,numeric,integer,integer,integer,integer,numeric,text,integer,numeric,text,uuid,timestamptz,numeric,numeric,numeric,numeric\)'::regprocedure/,
  )
  assert.match(migration, /v_expected_matches constant integer := 2/)
  assert.match(migration, /if v_actual_matches <> v_expected_matches then/)
  assert.match(migration, /execute v_patched_definition/)
  assert.match(migration, /legacy ON CONFLICT predicate remains/)
})

test('forward fix preserves schema, ledger data and existing function privileges', () => {
  assert.doesNotMatch(migration, /\b(?:insert|update|delete)\s+(?:into|public\.)/i)
  assert.doesNotMatch(migration, /\b(?:alter|drop|create)\s+(?:table|index)\b/i)
  assert.doesNotMatch(migration, /\b(?:grant|revoke)\b/i)
  assert.match(rollback, /changes no table data, index, function signature or\s+function privilege/i)
  assert.match(rollback, /Do not restore the predecessor/)
})
