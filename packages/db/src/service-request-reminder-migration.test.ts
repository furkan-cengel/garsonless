import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../supabase/migrations/20260831020000_service_request_reminder_cooldown.sql',
  import.meta.url,
), 'utf8')

test('pending service requests can emit a serialized reminder after the cooldown', () => {
  assert.match(migration, /and sr\.status = 'pending'[\s\S]*for update/i)
  assert.match(migration, /max\(event\.occurred_at\)/i)
  assert.match(migration, /interval '90 seconds'/i)
  assert.match(migration, /'reminder', true/i)
  assert.match(migration, /'service_request\.reminder:'/i)
  assert.match(migration, /'throttled', false,[\s\S]*'reminded', true/i)
  assert.match(migration, /exception when unique_violation[\s\S]*'throttled', true/i)
})

test('service request reminder RPC remains service-role only', () => {
  assert.match(migration, /security definer/i)
  assert.match(migration, /revoke all on function public\.create_table_service_request_atomic\(uuid, uuid, text\)[\s\S]*from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function public\.create_table_service_request_atomic\(uuid, uuid, text\)[\s\S]*to service_role/i)
})
