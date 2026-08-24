import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20260822070000_email_marketing_campaigns.sql', import.meta.url), 'utf8')

test('email campaign migration keeps delivery tenant-owned, consent-gated and idempotent', () => {
  assert.match(sql, /restaurant\.owner_id = p_created_by/)
  assert.match(sql, /consent_type = 'marketing'/)
  assert.match(sql, /consent\.revoked_at is null/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /campaign\.request_id = p_request_id/)
  assert.match(sql, /customer_restaurants association/)
  assert.match(sql, /normalize_customer_search_text\(search_email\)/)
})

test('email campaign recipient PII remains service-role-only and canonicalized', () => {
  assert.match(sql, /normalize_marketing_email/)
  assert.match(sql, /campaign_recipients_campaign_email_uniq/)
  assert.match(sql, /revoke all on function public\.queue_marketing_campaign_delivery_atomic[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.queue_marketing_campaign_delivery_atomic[\s\S]*to service_role/)
})
