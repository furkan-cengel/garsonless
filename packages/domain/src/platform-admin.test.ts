import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PLATFORM_ADMIN_CAPABILITIES,
  isPlatformAdminRole,
  isTenantServiceStatus,
  platformAdminCan,
  platformAdminCapabilities,
  type PlatformAdminActorContext,
  type PlatformAdminRole,
} from './platform-admin'

const actor = (role: PlatformAdminRole): PlatformAdminActorContext => ({
  actor: 'platform-admin', userId: 'admin-user', role, aal: 'aal2',
})

test('platform roles are closed and unknown values fail closed', () => {
  assert.equal(isPlatformAdminRole('support'), true)
  assert.equal(isPlatformAdminRole('owner'), false)
  assert.equal(isPlatformAdminRole('admin'), false)
})

test('tenant service status vocabulary is closed', () => {
  assert.equal(isTenantServiceStatus('active'), true)
  assert.equal(isTenantServiceStatus('suspended'), true)
  assert.equal(isTenantServiceStatus('manual_hold'), true)
  assert.equal(isTenantServiceStatus('past_due'), false)
})

test('role matrix matches the accepted platform-admin ADR', () => {
  assert.deepEqual(platformAdminCapabilities('support'), ['tenants.read', 'impersonation.read'])
  assert.deepEqual(platformAdminCapabilities('ops'), [
    'tenants.read', 'tenant.lifecycle.manage', 'entitlements.override',
  ])
  assert.deepEqual(platformAdminCapabilities('finance'), ['tenants.read', 'billing.manage'])
  assert.deepEqual(platformAdminCapabilities('superadmin'), PLATFORM_ADMIN_CAPABILITIES)
})

test('restaurant ownership is not a platform capability', () => {
  assert.equal(platformAdminCan(actor('support'), 'tenant.lifecycle.manage'), false)
  assert.equal(platformAdminCan(actor('finance'), 'billing.manage'), true)
  assert.equal(PLATFORM_ADMIN_CAPABILITIES.includes('restaurant.owner' as never), false)
})
