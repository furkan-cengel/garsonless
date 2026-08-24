import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const route = readFileSync(new URL('../app/api/webhooks/resend/route.ts', import.meta.url), 'utf8')

test('Resend campaign webhook verifies the untouched body and Svix headers before persistence', () => {
  assert.match(route, /const payload = await request\.text\(\)/)
  assert.match(route, /new Webhook\(webhookSecret\)\.verify\(payload/)
  assert.match(route, /'svix-id': webhookId/)
  assert.match(route, /'svix-timestamp': timestamp/)
  assert.match(route, /'svix-signature': signature/)
  assert.match(route, /recordResendCampaignEvent/)
  assert.doesNotMatch(route, /console\.|request\.json\(\)/)
})
