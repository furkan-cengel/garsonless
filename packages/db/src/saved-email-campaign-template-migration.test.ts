import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260823011000_saved_email_campaign_templates.sql', import.meta.url),
  'utf8',
)

test('saved email templates are tenant-owned, bounded and contain no recipient data', () => {
  assert.match(sql, /create table if not exists public\.campaign_email_templates/i)
  assert.match(sql, /octet_length\(design::text\) <= 100000/i)
  assert.match(sql, /unique index[\s\S]*restaurant_id, lower\(btrim\(name\)\)/i)
  assert.match(sql, /owner_manage_campaign_email_templates[\s\S]*restaurant\.owner_id = auth\.uid\(\)/i)
  assert.doesNotMatch(sql, /customer_id|recipient_email|\bemail\s+text/i)
})
