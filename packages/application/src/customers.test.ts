import assert from 'node:assert/strict'
import test from 'node:test'
import { err, ok, type RestaurantCustomersPage } from '@garsonless/domain'
import {
  createCustomerSegment,
  ensureCustomerIdentity,
  grantCustomerStoreCredit,
  readCustomers,
  updateCustomerConsent,
  type CustomerApplicationPort,
  type CustomerConsentPort,
  type CustomerIdentityPort,
} from './customers'

const context = {
  actor: 'dashboard-member' as const,
  userId: 'staff-a',
  restaurantId: 'restaurant-a',
  permissions: ['customers'],
}

const emptyPage: RestaurantCustomersPage = { customers: [], total: 0, page: 1, pageSize: 25 }

function port(): CustomerApplicationPort {
  return {
    listCustomers: async () => ok(emptyPage),
    countSegments: async () => ok({ new: 0, frequent: 0, lapsed: 0, consented: 0 }),
    listSegments: async () => ok([]),
    getSegment: async () => ok(null),
    createSegment: async (input) => ok({
      id: 'segment', restaurantId: input.restaurantId, name: input.name,
      definition: input.definition, createdAt: 'now', updatedAt: 'now',
    }),
    updateSegment: async () => ok(null),
    deleteSegment: async () => ok(false),
    readDetail: async () => ok(null),
    grantStoreCredit: async (input) => ok({ granted: input.points }),
  }
}

test('customer reads reject cross-tenant and missing permission before the port', async () => {
  const adapter = port()
  let called = false
  adapter.listCustomers = async () => {
    called = true
    return ok(emptyPage)
  }
  assert.deepEqual(await readCustomers(context, { restaurantId: 'restaurant-b' }, adapter), err('Not authorized'))
  assert.deepEqual(await readCustomers({ ...context, permissions: ['orders'] }, { restaurantId: 'restaurant-a' }, adapter), err('Not authorized'))
  assert.equal(called, false)
})

test('custom segments are tenant-bound and resolved before listing', async () => {
  const adapter = port()
  adapter.getSegment = async ({ restaurantId }) => ok({
    id: 'segment', restaurantId, name: 'VIP', definition: { spend: { op: '>=', value: 100 } },
    createdAt: 'now', updatedAt: 'now',
  })
  let customSpend = 0
  adapter.listCustomers = async (input) => {
    customSpend = input.customSegment?.spend?.value ?? 0
    return ok(emptyPage)
  }
  const result = await readCustomers(context, {
    restaurantId: 'restaurant-a', customSegmentId: 'segment', segment: 'new',
  }, adapter)
  assert.equal(result.ok, true)
  assert.equal(customSpend, 100)
})

test('customer members receive a masked contact projection while owners may receive consented contact data', async () => {
  const adapter = port()
  const projections: boolean[] = []
  adapter.listCustomers = async (input) => {
    projections.push(input.includeContactData)
    return ok(emptyPage)
  }
  await readCustomers(context, { restaurantId: 'restaurant-a' }, adapter)
  await readCustomers({ ...context, isOwner: true }, { restaurantId: 'restaurant-a' }, adapter)
  assert.deepEqual(projections, [false, true])
})

test('segment and owner-only credit commands derive audit identity from the actor', async () => {
  const adapter = port()
  let creator = ''
  adapter.createSegment = async (input) => {
    creator = input.createdBy
    return ok({ id: 'segment', restaurantId: input.restaurantId, name: input.name, definition: input.definition, createdAt: 'now', updatedAt: 'now' })
  }
  let granter = ''
  adapter.grantStoreCredit = async (input) => {
    granter = input.grantedBy
    return ok({ granted: input.points })
  }
  await createCustomerSegment(context, { restaurantId: 'restaurant-a', name: ' VIP ', definition: {} }, adapter)
  await grantCustomerStoreCredit({ ...context, isOwner: true }, { restaurantId: 'restaurant-a', customerId: 'customer', points: 10.9 }, adapter)
  assert.equal(creator, 'staff-a')
  assert.equal(granter, 'staff-a')
})

test('customer members cannot grant manual store credit', async () => {
  const adapter = port()
  let called = false
  adapter.grantStoreCredit = async () => {
    called = true
    return ok({ granted: 10 })
  }
  const result = await grantCustomerStoreCredit(context, {
    restaurantId: 'restaurant-a', customerId: 'customer', points: 10,
  }, adapter)
  assert.deepEqual(result, err('Not authorized'))
  assert.equal(called, false)
})

test('first-login preserves required ordering and only affirmative consent side effects', async () => {
  const calls: string[] = []
  const identityPort: CustomerIdentityPort = {
    async upsertIdentity(input) {
      calls.push(`upsert:${input.email}:${input.name}`)
      return { ok: true, customer: { id: 'customer-a', email: input.email, name: input.name } }
    },
    async stampCustomerRole() { calls.push('stamp'); return ok(null) },
    async associateRestaurant() { calls.push('associate'); return ok(null) },
    async creditWelcomeBonus() { calls.push('bonus') },
    async recordConsent(input) { calls.push(`consent:${input.consentType}`); return ok(null) },
  }
  const result = await ensureCustomerIdentity({
    authUserId: 'auth-a',
    email: ' MEMBER@EXAMPLE.COM ',
    userMetadata: { full_name: ' Ada ' },
    appMetadata: { provider: 'email' },
  }, {
    restaurantId: 'restaurant-a',
    consent: true,
    marketingConsent: false,
  }, identityPort)
  assert.equal(result.ok, true)
  assert.deepEqual(calls, [
    'upsert:member@example.com:Ada',
    'stamp',
    'associate',
    'bonus',
    'consent:contact_data',
  ])
})

test('consent updates reject a cross-tenant customer before persistence', async () => {
  let called = false
  const consentPort: CustomerConsentPort = {
    async recordConsent() { called = true; return ok(null) },
    async readSnapshot() { return ok({ consentGiven: true, marketingConsentGiven: false }) },
  }
  const result = await updateCustomerConsent({
    actor: 'customer-member',
    authUserId: 'auth-a',
    customerId: 'customer-a',
    restaurantId: 'restaurant-a',
  }, {
    restaurantId: 'restaurant-b',
    grant: true,
    consentType: 'marketing',
  }, consentPort)
  assert.deepEqual(result, err('Not authorized'))
  assert.equal(called, false)
})
