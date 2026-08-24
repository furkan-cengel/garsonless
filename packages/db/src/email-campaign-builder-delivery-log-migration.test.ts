import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260823010000_email_campaign_builder_and_delivery_log.sql', import.meta.url),
  'utf8',
)

test('email builder design is bounded and queued inside the tenant-safe transaction', () => {
  assert.match(sql, /content_mode = 'builder'[\s\S]*jsonb_typeof\(email_design\) = 'object'[\s\S]*octet_length\(email_design::text\) <= 100000/i)
  assert.match(sql, /queue_email_campaign_delivery_v2_atomic[\s\S]*queue_marketing_campaign_delivery_atomic\(/i)
  assert.match(sql, /where campaign\.id = queued\.campaign_id[\s\S]*campaign\.restaurant_id = p_restaurant_id/i)
  assert.match(sql, /revoke all on function public\.queue_email_campaign_delivery_v2_atomic[\s\S]*authenticated/i)
})

test('Resend events stay service-only, idempotent and projected without raw webhook PII', () => {
  assert.match(sql, /campaign_email_events[\s\S]*webhook_id text not null unique/i)
  assert.match(sql, /alter table public\.campaign_email_events enable row level security/i)
  assert.doesNotMatch(sql, /create policy[\s\S]*campaign_email_events/i)
  assert.match(sql, /record_resend_campaign_event[\s\S]*on conflict \(webhook_id\) do nothing/i)
  assert.match(sql, /revoke all on function public\.record_resend_campaign_event[\s\S]*authenticated/i)
  assert.doesNotMatch(sql, /payload|user_agent|ip_address|raw_body/i)
})
