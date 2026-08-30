import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../supabase/migrations/20260831010000_outbox_worker_fail_loud.sql',
  import.meta.url,
), 'utf8')

const provisioner = readFileSync(new URL(
  '../scripts/configure-outbox-worker-vault.ts',
  import.meta.url,
), 'utf8')

test('scheduled outbox invocation fails visibly when Vault is incomplete', () => {
  assert.match(migration, /raise exception 'Missing Vault secret: outbox_worker_url'/)
  assert.match(migration, /raise exception 'Missing Vault secret: outbox_worker_secret'/)
  assert.doesNotMatch(migration, /return null/)
})

test('Vault provisioning requires runtime inputs and never embeds credentials', () => {
  assert.match(provisioner, /process\.env\.OUTBOX_WORKER_URL/)
  assert.match(provisioner, /process\.env\.OUTBOX_WORKER_SECRET/)
  assert.match(provisioner, /configure_outbox_worker_vault/)
  assert.match(migration, /vault\.update_secret/)
  assert.match(migration, /vault\.create_secret/)
  assert.match(migration, /revoke all on function public\.configure_outbox_worker_vault\(text, text\) from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.configure_outbox_worker_vault\(text, text\) to service_role/)
  assert.doesNotMatch(provisioner, /svxvloeosiksqfadgkvo|yxsegwkzyiscrxiwdeuf/)
})
