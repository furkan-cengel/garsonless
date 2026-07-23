import assert from 'node:assert/strict'
import test from 'node:test'
import { ok } from '@garsonless/domain/result'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import {
  erasePlatformTenantPrivacyData,
  exportPlatformTenantPrivacyData,
  PLATFORM_PRIVACY_ERASE_CONFIRMATION,
  readPlatformTenantPrivacyOperations,
  type PlatformPrivacyOperation,
  type PlatformTenantPrivacyPort,
} from './platform-admin-privacy'

const USER = '11111111-1111-4111-8111-111111111111'
const TENANT = '22222222-2222-4222-8222-222222222222'
const REQUEST = '33333333-3333-4333-8333-333333333333'
const actor = (role: PlatformAdminActorContext['role']): PlatformAdminActorContext => ({ actor: 'platform-admin', userId: USER, role, aal: 'aal2' })
const operation: PlatformPrivacyOperation = {
  id: REQUEST, restaurantId: TENANT, type: 'erase', status: 'completed', reason: 'Geçerli KVKK başvurusu tamamlandı.',
  summary: { customerCount: 1, consentCount: 1, orderLinkCount: 1, loyaltyRowCount: 1, campaignRecipientCount: 1, paymentShareLinkCount: 1, anonymizedGlobalCustomerCount: 1 },
  requestedBy: USER, requestId: REQUEST, createdAt: '2026-07-23T00:00:00.000Z', completedAt: '2026-07-23T00:00:00.000Z',
}
function port(overrides: Partial<PlatformTenantPrivacyPort> = {}): PlatformTenantPrivacyPort {
  return {
    readOperations: async () => ok([operation]),
    exportData: async () => ok({ operation: { ...operation, type: 'export' }, duplicate: false, document: { schemaVersion: 1, generatedAt: operation.createdAt, tenant: { id: TENANT, name: 'Test', slug: 'test', createdAt: operation.createdAt }, customers: [] } }),
    eraseData: async () => ok({ operation, duplicate: false }),
    ...overrides,
  }
}

test('only a superadmin can read or execute tenant privacy operations', async () => {
  for (const role of ['support', 'ops', 'finance'] as const) {
    assert.deepEqual(await readPlatformTenantPrivacyOperations(actor(role), TENANT, port()), { ok: false, error: 'Not authorized' })
    assert.deepEqual(await exportPlatformTenantPrivacyData(actor(role), { restaurantId: TENANT, reason: 'Geçerli KVKK dışa aktarma gerekçesi.', requestId: REQUEST }, port()), { ok: false, error: 'Not authorized' })
  }
  assert.equal((await readPlatformTenantPrivacyOperations(actor('superadmin'), TENANT, port())).ok, true)
})

test('erase requires an explicit confirmation before persistence', async () => {
  let calls = 0
  const adapter = port({ eraseData: async () => { calls += 1; return ok({ operation, duplicate: false }) } })
  const invalid = await erasePlatformTenantPrivacyData(actor('superadmin'), {
    restaurantId: TENANT, reason: 'Geçerli KVKK silme başvurusu.', requestId: REQUEST, confirmation: 'sil',
  }, adapter)
  assert.deepEqual(invalid, { ok: false, error: 'Invalid erase confirmation' })
  assert.equal(calls, 0)
  assert.equal((await erasePlatformTenantPrivacyData(actor('superadmin'), {
    restaurantId: TENANT, reason: 'Geçerli KVKK silme başvurusu.', requestId: REQUEST, confirmation: PLATFORM_PRIVACY_ERASE_CONFIRMATION,
  }, adapter)).ok, true)
  assert.equal(calls, 1)
})

test('trusted actor and normalized reason cross the port', async () => {
  let input: unknown
  const adapter = port({ exportData: async (value) => { input = value; return port().exportData(value) } })
  assert.equal((await exportPlatformTenantPrivacyData(actor('superadmin'), {
    restaurantId: TENANT, reason: '  Geçerli KVKK dışa aktarma gerekçesi.  ', requestId: REQUEST,
  }, adapter)).ok, true)
  assert.deepEqual(input, { restaurantId: TENANT, reason: 'Geçerli KVKK dışa aktarma gerekçesi.', requestId: REQUEST, actorUserId: USER, actorRole: 'superadmin' })
})
