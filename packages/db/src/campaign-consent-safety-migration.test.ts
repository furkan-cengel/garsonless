import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../supabase/migrations/20260730050000_campaign_activation_consent_safety.sql',
  import.meta.url,
), 'utf8')
const generated = readFileSync(new URL('./types.gen.ts', import.meta.url), 'utf8')

test('campaign enqueue is request-idempotent and conflicting reuse fails closed', () => {
  assert.match(migration, /campaigns_restaurant_request_uniq/i)
  assert.match(migration, /pg_advisory_xact_lock/i)
  assert.match(migration, /existing\.request_fingerprint <> p_request_fingerprint/i)
  assert.match(migration, /errcode = 'GL001'/i)
  assert.match(migration, /existing\.id, true/i)
  assert.match(migration, /campaign\.delivery_requested:' \|\| new_campaign_id/i)
})

test('enqueue re-verifies owner, tenant, current marketing consent and canonical phone', () => {
  assert.match(migration, /p_contacts is null or jsonb_typeof\(p_contacts\) <> 'array'/i)
  assert.match(migration, /restaurant\.owner_id = p_created_by/i)
  assert.match(migration, /association\.restaurant_id = p_restaurant_id/i)
  assert.match(migration, /consent\.consent_type = 'marketing'/i)
  assert.match(migration, /consent\.granted_at is not null[\s\S]*consent\.revoked_at is null/i)
  assert.match(migration, /normalize_sms_phone\(customer\.phone\)/i)
  assert.match(migration, /select distinct on \(phone\)/i)
  assert.match(migration, /campaign_recipients_campaign_phone_uniq/i)
  assert.match(migration, /customer\.merged_into_customer_id is null/i)
})

test('future campaign failures persist stable codes without duplicating phone PII', () => {
  assert.match(migration, /when p_error in \('provider_unavailable', 'provider_rejected', 'configuration_unavailable', 'delivery_unknown'\)/i)
  assert.match(migration, /else 'provider_failure'/i)
  assert.match(migration, /event_type, phone, provider[\s\S]*case when p_success then 'sent' else 'failed' end,[\s\S]*null, left\(coalesce\(p_provider/i)
})

test('campaign safety functions remain service-role-only and generated types are pinned', () => {
  assert.match(migration, /drop function if exists public\.queue_campaign_delivery_atomic/i)
  assert.match(migration, /revoke all on function public\.normalize_sms_phone\(text\) from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function public\.queue_campaign_delivery_atomic[\s\S]*to service_role/i)
  assert.match(generated, /normalize_sms_phone:/)
  assert.match(generated, /p_request_fingerprint:/)
  assert.match(generated, /skipped_duplicate_count:/)
  assert.match(generated, /replayed: boolean/)
})
