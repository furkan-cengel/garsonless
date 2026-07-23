import assert from 'node:assert/strict'
import test from 'node:test'
import { createPlatformAdminPrivacyPort, type PlatformPrivacyRpc } from './platform-admin-privacy-port'

const USER = '11111111-1111-4111-8111-111111111111'
const TENANT = '22222222-2222-4222-8222-222222222222'
const REQUEST = '33333333-3333-4333-8333-333333333333'
const NOW = '2026-07-23T00:00:00.000Z'
const summary = { customerCount: 1, consentCount: 1, orderLinkCount: 1, loyaltyRowCount: 1, campaignRecipientCount: 1, paymentShareLinkCount: 1, anonymizedGlobalCustomerCount: 0 }
const operation = { id: REQUEST, restaurantId: TENANT, type: 'export', status: 'completed', reason: 'Geçerli KVKK dışa aktarma gerekçesi.', summary, requestedBy: USER, requestId: REQUEST, createdAt: NOW, completedAt: NOW }

test('privacy port maps only trusted RPC arguments and parses the closed export', async () => {
  let call: unknown
  const rpc: PlatformPrivacyRpc = async (name, args) => {
    call = { name, args }
    return { data: { operation, duplicate: false, document: { schemaVersion: 1, generatedAt: NOW, tenant: { id: TENANT, name: 'Test', slug: 'test', createdAt: NOW }, customers: [] } }, error: null }
  }
  const result = await createPlatformAdminPrivacyPort(rpc).exportData({ restaurantId: TENANT, actorUserId: USER, actorRole: 'superadmin', reason: operation.reason, requestId: REQUEST })
  assert.equal(result.ok, true)
  assert.deepEqual(call, { name: 'export_platform_admin_tenant_privacy_data', args: { p_restaurant_id: TENANT, p_actor_user_id: USER, p_actor_role: 'superadmin', p_reason: operation.reason, p_request_id: REQUEST } })
})

test('malformed payloads and database details fail closed', async () => {
  const malformed: PlatformPrivacyRpc = async () => ({ data: { operation: { raw: 'pii' } }, error: null })
  assert.deepEqual(await createPlatformAdminPrivacyPort(malformed).eraseData({ restaurantId: TENANT, actorUserId: USER, actorRole: 'superadmin', reason: operation.reason, requestId: REQUEST }), { ok: false, error: 'platform_privacy_erase_failed' })
  const failed: PlatformPrivacyRpc = async () => ({ data: null, error: { message: 'secret database detail' } })
  assert.deepEqual(await createPlatformAdminPrivacyPort(failed).readOperations({ restaurantId: TENANT, actorUserId: USER, actorRole: 'superadmin' }), { ok: false, error: 'platform_privacy_read_failed' })
})
