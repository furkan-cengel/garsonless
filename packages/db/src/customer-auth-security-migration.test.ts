import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../supabase/migrations/20260802010000_customer_auth_security_foundation.sql',
  import.meta.url,
), 'utf8')

test('auth intent and rate limit tables are service-role only', () => {
  assert.match(migration, /create table if not exists public\.customer_auth_intents/)
  assert.match(migration, /create table if not exists public\.customer_auth_rate_limits/)
  assert.match(migration, /alter table public\.customer_auth_intents force row level security/)
  assert.match(migration, /revoke all on table public\.customer_auth_intents from public, anon, authenticated/)
  assert.match(migration, /revoke all on table public\.customer_auth_rate_limits from public, anon, authenticated/)
  assert.doesNotMatch(migration, /\b(email|name|consent|qr_token)\s+(text|boolean)/i)
})

test('intent consumption and rate limiting are atomic service functions', () => {
  assert.match(migration, /create or replace function public\.consume_customer_auth_intent/)
  assert.match(migration, /and intent\.consumed_at is null/)
  assert.match(migration, /and intent\.expires_at > now\(\)/)
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('customer-auth-rate:/)
  assert.match(migration, /grant execute on function public\.consume_customer_auth_rate_limit[\s\S]*to service_role/)
})

test('live staff and platform records override customer stamps', () => {
  assert.match(migration, /create or replace function public\.is_staff_or_platform_user/)
  assert.match(migration, /platform_user\.status <> 'revoked'/)
  const hook = migration.slice(migration.indexOf('create or replace function public.customer_access_token_hook'))
  assert.ok(hook.indexOf('is_staff_or_platform_user') < hook.indexOf("stamped = 'staff'"))
  assert.doesNotMatch(hook, /stamped in \('staff', 'customer'\)/)
})

test('customer and staff links share a locked, bidirectional role guard', () => {
  assert.match(migration, /customer-identity-role:/)
  assert.match(migration, /using errcode = 'GL003'/)
  for (const trigger of [
    'customers_identity_role_guard',
    'restaurants_identity_role_guard',
    'restaurant_members_identity_role_guard',
    'platform_admin_users_identity_role_guard',
  ]) assert.match(migration, new RegExp(`create trigger ${trigger}`))
  assert.match(migration, /existing customer\/staff identity overlap requires manual remediation/)
})
