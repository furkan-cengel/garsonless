import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPlatformAdminTenantReadPort,
  type PlatformTenantReadRpc,
} from './platform-admin-tenant-read-port'

const tenantId = '11111111-1111-4111-8111-111111111111'
const invoiceId = '22222222-2222-4222-8222-222222222222'
const now = '2026-07-22T09:00:00.000Z'
const summary = {
  id: tenantId,
  name: 'Test Cafe',
  slug: 'test-cafe',
  plan: 'pro',
  timezone: 'Europe/Istanbul',
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  subscription: { plan: 'pro', status: 'active', currentPeriodEnd: now, trialEndsAt: null, graceEndsAt: null },
  latestInvoice: {
    id: invoiceId, status: 'paid', amountDueMinor: 14990, amountPaidMinor: 14990,
    currency: 'TRY', dueAt: now, paidAt: now, failedAt: null, createdAt: now,
  },
  usage: { tables: 3, menuItems: 6, teamMembers: 1, activeOrders: 2, openServiceRequests: 0 },
  attention: { reconciliationCount: 0 },
}
const input = {
  search: null, plan: null, subscriptionStatus: null, lifecycle: 'active' as const, page: 2, pageSize: 10,
}

function rpc(data: unknown, error?: string): PlatformTenantReadRpc {
  return async () => ({ data, error: error ? { message: error } : null })
}

test('tenant list parses only the safe closed projection and preserves pagination', async () => {
  let called: unknown
  const call: PlatformTenantReadRpc = async (name, args) => {
    called = { name, args }
    return { data: { items: [summary], totalCount: 11 }, error: null }
  }
  const result = await createPlatformAdminTenantReadPort(call).listTenants(input)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.value.items[0]?.name, 'Test Cafe')
  assert.equal(result.value.items[0]?.latestInvoice?.amountDueMinor, 14990)
  assert.deepEqual({ page: result.value.page, pageSize: result.value.pageSize, total: result.value.totalCount }, {
    page: 2, pageSize: 10, total: 11,
  })
  assert.deepEqual(called, {
    name: 'list_platform_admin_tenants',
    args: {
      p_search: null, p_plan: null, p_subscription_status: null, p_lifecycle: 'active', p_limit: 10, p_offset: 10,
    },
  })
})

test('tenant detail parses safe billing history and activity', async () => {
  const result = await createPlatformAdminTenantReadPort(rpc({
    ...summary,
    invoices: [summary.latestInvoice],
    activity: { lastOrderAt: now },
  })).readTenant(tenantId)
  assert.equal(result.ok, true)
  if (!result.ok || !result.value) return
  assert.equal(result.value.invoices.length, 1)
  assert.equal(result.value.activity.lastOrderAt, now)
})

test('missing tenant remains null', async () => {
  assert.deepEqual(await createPlatformAdminTenantReadPort(rpc(null)).readTenant(tenantId), { ok: true, value: null })
})

test('malformed projections fail closed instead of partially rendering', async () => {
  const malformed = { ...summary, plan: 'owner', ownerEmail: 'secret@example.com' }
  assert.deepEqual(await createPlatformAdminTenantReadPort(rpc({ items: [malformed], totalCount: 1 })).listTenants(input), {
    ok: false, error: 'platform_tenant_directory_query_failed',
  })
})

test('database error details stay behind stable port errors', async () => {
  assert.deepEqual(await createPlatformAdminTenantReadPort(rpc(null, 'secret SQL')).listTenants(input), {
    ok: false, error: 'platform_tenant_directory_query_failed',
  })
  assert.deepEqual(await createPlatformAdminTenantReadPort(rpc(null, 'secret SQL')).readTenant(tenantId), {
    ok: false, error: 'platform_tenant_detail_query_failed',
  })
})
