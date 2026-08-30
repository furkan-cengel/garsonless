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

const provisioningFix = readFileSync(new URL(
  '../supabase/migrations/20260831011000_outbox_worker_vault_provisioning_fix.sql',
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
  assert.match(provisioningFix, /from vault\.decrypted_secrets where name = 'outbox_worker_url'/)
  assert.match(provisioningFix, /vault\.update_secret/)
  assert.match(provisioningFix, /vault\.create_secret/)
  assert.doesNotMatch(provisioningFix, /from vault\.secrets/)
  assert.match(provisioningFix, /revoke all on function public\.configure_outbox_worker_vault\(text, text\) from public, anon, authenticated/)
  assert.match(provisioningFix, /grant execute on function public\.configure_outbox_worker_vault\(text, text\) to service_role/)
  assert.doesNotMatch(provisioner, /svxvloeosiksqfadgkvo|yxsegwkzyiscrxiwdeuf/)
})
