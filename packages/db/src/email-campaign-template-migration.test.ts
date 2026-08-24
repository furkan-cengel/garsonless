import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260822080000_email_campaign_templates.sql', import.meta.url),
  'utf8',
)
const lengthSql = readFileSync(
  new URL('../supabase/migrations/20260822081000_email_campaign_html_queue_length.sql', import.meta.url),
  'utf8',
)

test('email template metadata is constrained and queued through the tenant-safe atomic boundary', () => {
  assert.match(sql, /content_mode text not null default 'plain'/i)
  assert.match(sql, /template_id in \('minimal', 'announcement', 'offer'\)/i)
  assert.match(sql, /queue_marketing_campaign_delivery_atomic\(/i)
  assert.match(sql, /where campaign\.id = queued\.campaign_id[\s\S]*campaign\.restaurant_id = p_restaurant_id/i)
  assert.match(sql, /revoke all on function public\.queue_email_campaign_delivery_atomic[\s\S]*authenticated/i)
  assert.match(sql, /grant execute on function public\.queue_email_campaign_delivery_atomic[\s\S]*service_role/i)
  assert.match(lengthSql, /when channel = 'sms' then 459[\s\S]*else 100000/i)
})
