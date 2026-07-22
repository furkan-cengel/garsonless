import assert from 'node:assert/strict'
import test from 'node:test'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { err, ok } from '@garsonless/domain/result'
import {
  setPlatformTenantPlan,
  type PlatformTenantPlanManagementPort,
} from './platform-admin-tenant-plans'

const restaurantId = '11111111-1111-4111-8111-111111111111'
const requestId = '22222222-2222-4222-8222-222222222222'
const userId = '33333333-3333-4333-8333-333333333333'
const actor = (role: PlatformAdminActorContext['role']): PlatformAdminActorContext => ({
  actor: 'platform-admin', userId, role, aal: 'aal2',
})

function port(overrides: Partial<PlatformTenantPlanManagementPort> = {}): PlatformTenantPlanManagementPort {
  return {
    setPlan: async (input) => ok({
      restaurantId: input.restaurantId,
      previousPlan: 'free', plan: input.plan, changed: true,
      duplicate: false, requestId: input.requestId,
    }),
    ...overrides,
  }
}

test('plan changes are superadmin-only and never reach the port for other roles', async () => {
  let calls = 0
  const database = port({ setPlan: async () => { calls += 1; return err('no') } })
  for (const role of ['support', 'ops', 'finance'] as const) {
    assert.deepEqual(await setPlatformTenantPlan(actor(role), {
      restaurantId, plan: 'pro', reason: 'Sözleşmeli paket düzeltmesi', requestId,
    }, database), { ok: false, error: 'Not authorized' })
  }
  assert.equal(calls, 0)
})

test('command trims reason and derives actor fields from trusted context', async () => {
  let received: unknown
  const result = await setPlatformTenantPlan(actor('superadmin'), {
    restaurantId, plan: 'starter', reason: '  Sözleşmeli paket düzeltmesi  ', requestId,
  }, port({ setPlan: async (input) => {
    received = input
    return ok({
      restaurantId, previousPlan: 'free', plan: 'starter', changed: true,
      duplicate: false, requestId,
    })
  } }))
  assert.equal(result.ok, true)
  assert.deepEqual(received, {
    restaurantId, actorUserId: userId, actorRole: 'superadmin', plan: 'starter',
    reason: 'Sözleşmeli paket düzeltmesi', requestId,
  })
})

test('invalid plan, reason and request fail before persistence', async () => {
  let calls = 0
  const database = port({ setPlan: async () => { calls += 1; return err('no') } })
  const base = { restaurantId, plan: 'pro' as const, reason: 'Sözleşmeli paket düzeltmesi', requestId }
  assert.deepEqual(await setPlatformTenantPlan(actor('superadmin'), { ...base, plan: 'business' as never }, database), { ok: false, error: 'Invalid plan' })
  assert.deepEqual(await setPlatformTenantPlan(actor('superadmin'), { ...base, reason: 'kısa' }, database), { ok: false, error: 'Invalid operation reason' })
  assert.deepEqual(await setPlatformTenantPlan(actor('superadmin'), { ...base, requestId: 'browser-value' }, database), { ok: false, error: 'Invalid request id' })
  assert.equal(calls, 0)
})

test('live billing conflict remains a stable user-safe application error', async () => {
  const result = await setPlatformTenantPlan(actor('superadmin'), {
    restaurantId, plan: 'enterprise', reason: 'Kurumsal paket sözleşmesi onaylandı', requestId,
  }, port({ setPlan: async () => err('platform_tenant_plan_billing_managed') }))
  assert.deepEqual(result, {
    ok: false,
    error: 'Tenant plan is managed by an active billing subscription',
  })
})

test('unknown database details collapse to a stable mutation error', async () => {
  const result = await setPlatformTenantPlan(actor('superadmin'), {
    restaurantId, plan: 'pro', reason: 'Kurumsal paket düzeltmesi onaylandı', requestId,
  }, port({ setPlan: async () => err('postgres details') }))
  assert.deepEqual(result, { ok: false, error: 'Tenant plan could not be changed' })
})
