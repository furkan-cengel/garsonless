import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../supabase/migrations/20260730020000_customer_identity_credit_safety.sql',
  import.meta.url,
), 'utf8')
const generated = readFileSync(new URL('./types.gen.ts', import.meta.url), 'utf8')

test('manual credit is one atomic request-bound ledger effect', () => {
  assert.match(migration, /create table public\.manual_store_credit_requests/i)
  assert.match(migration, /request_id uuid primary key/i)
  assert.match(migration, /manual_credit_request_id uuid/i)
  assert.match(migration, /unique index loyalty_transactions_manual_credit_request_uniq/i)
  assert.match(migration, /create or replace function public\.grant_store_credit_atomic/i)
  assert.match(migration, /on conflict \(request_id\) do nothing/i)
  assert.match(migration, /for update/i)
  assert.match(migration, /request id reused with different intent/i)
  assert.match(migration, /loyalty_transaction_id is not null/i)
  assert.match(migration, /return query select v_existing\.points, true/i)
})

test('manual credit re-verifies owner, tenant activity and loyalty scope in SQL', () => {
  assert.match(migration, /restaurant\.owner_id = p_granted_by/i)
  assert.match(migration, /orders\.restaurant_id = p_restaurant_id/i)
  assert.match(migration, /ledger\.restaurant_id = p_restaurant_id/i)
  assert.match(migration, /association\.restaurant_id = p_restaurant_id/i)
  assert.match(migration, /loyalty scope mismatch/i)
  assert.match(migration, /revoke all on function public\.grant_store_credit_atomic[\s\S]*from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function public\.grant_store_credit_atomic[\s\S]*to service_role/i)
})

test('verified identity claims merge deterministically and fail closed across auth accounts', () => {
  assert.match(migration, /create table public\.customer_identity_claims/i)
  assert.match(migration, /unique \(kind, normalized_value\)/i)
  assert.match(migration, /pg_advisory_xact_lock/i)
  assert.match(migration, /verified identity belongs to another auth account/i)
  assert.match(migration, /identity merge requires manual loyalty review/i)
  assert.match(migration, /merge_customer_identity_into/i)
  assert.match(migration, /update public\.orders set customer_id = p_survivor/i)
  assert.match(migration, /update public\.loyalty_transactions set customer_id = p_survivor/i)
  assert.match(migration, /on conflict \(customer_id, restaurant_id, consent_type\) do update/i)
  assert.match(migration, /set auth_user_id = null,[\s\S]*email = null,[\s\S]*phone = null,[\s\S]*name = null/i)
  assert.match(migration, /create table public\.customer_identity_merge_audit/i)
})

test('identity and manual-credit persistence stays service-role only', () => {
  for (const table of [
    'manual_store_credit_requests',
    'customer_identity_claims',
    'customer_identity_merge_audit',
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, 'i'))
  }
  assert.match(migration, /revoke all on function public\.claim_customer_identity_atomic[\s\S]*from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function public\.claim_customer_identity_atomic[\s\S]*to service_role/i)
  assert.match(migration, /revoke all on function public\.merge_customer_identity_into[\s\S]*service_role/i)
})

test('generated database contract includes slice 1 tables and RPCs', () => {
  for (const token of [
    'manual_store_credit_requests:',
    'customer_identity_claims:',
    'customer_identity_merge_audit:',
    'grant_store_credit_atomic:',
    'claim_customer_identity_atomic:',
    'manual_credit_request_id:',
    'merged_into_customer_id:',
  ]) assert.match(generated, new RegExp(token))
})
