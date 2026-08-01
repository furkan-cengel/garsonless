import { randomUUID } from 'node:crypto'
import {
  createCustomerSegment,
  deleteCustomerSegment,
  grantCustomerStoreCredit,
  readCustomerDetail,
  readCustomerSegmentCounts,
  readCustomers,
  updateCustomerSegment,
} from '@garsonless/application/customers'
import { createServiceClient } from '../src/client'
import { createCustomerApplicationPort } from '../src/customer-application-port'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''
let customerId = ''
let authUserId = ''

async function main() {
  try {
    const { data: fixture, error: fixtureError } = await service
      .from('restaurants')
      .select('owner_id')
      .eq('slug', 'test-cafe-b')
      .single()
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')

    const { data: restaurant, error: restaurantError } = await service
      .from('restaurants')
      .insert({
        owner_id: fixture.owner_id,
        slug: `customer-strangler-${suffix}`,
        name: `Customer strangler ${suffix}`,
        plan: 'pro',
        settings: {
          loyalty: {
            stamp_enabled: false,
            points_enabled: true,
            points_per_lira: 1,
            points_redeem_rate: 10,
            member_discount_pct: 0,
            scope: 'restaurant',
            earn_trigger: 'paid',
          },
        },
      })
      .select('id')
      .single()
    if (restaurantError) throw restaurantError
    restaurantId = restaurant.id

    const email = `customer-strangler-${suffix}@example.test`
    const { data: authUser, error: authError } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (authError || !authUser.user) throw authError ?? new Error('Auth fixture unavailable')
    authUserId = authUser.user.id

    const { data: customer, error: customerError } = await service
      .from('customers')
      .insert({ auth_user_id: authUserId, email, name: 'Runtime Customer' })
      .select('id')
      .single()
    if (customerError) throw customerError
    customerId = customer.id

    const { error: associationError } = await service.from('customer_restaurants').insert({
      customer_id: customerId,
      restaurant_id: restaurantId,
      source: 'auth',
    })
    if (associationError) throw associationError

    const actor = {
      actor: 'dashboard-member' as const,
      userId: fixture.owner_id,
      restaurantId,
      permissions: ['customers'],
      isOwner: true,
    }
    const port = createCustomerApplicationPort()

    const created = await createCustomerSegment(actor, {
      restaurantId,
      name: 'Runtime VIP',
      definition: { points: { op: '>=', value: 0 } },
    }, port)
    assert(created.ok, 'Segment create failed')

    const updated = await updateCustomerSegment(actor, {
      restaurantId,
      segmentId: created.value.id,
      name: 'Runtime Active',
      definition: { visits: { op: '>=', value: 0 } },
    }, port)
    assert(updated.ok && updated.value?.name === 'Runtime Active', 'Segment update failed')

    const credit = await grantCustomerStoreCredit(actor, {
      restaurantId,
      customerId,
      requestId: randomUUID(),
      points: 25,
      note: 'runtime',
    }, port)
    assert(credit.ok && credit.value.granted === 25, 'Store credit failed')

    const page = await readCustomers(actor, {
      restaurantId,
      customSegmentId: created.value.id,
      page: 1,
      pageSize: 25,
    }, port)
    assert(page.ok && page.value.total === 1, 'Customer page failed')
    assert(page.value.customers[0]?.points === 25, 'Customer points projection mismatch')
    assert(page.value.customers[0]?.emailMasked === true, 'PII was not masked without consent')

    const detail = await readCustomerDetail(actor, { restaurantId, customerId }, port)
    assert(detail.ok && detail.value?.customerId === customerId, 'Customer detail failed')
    assert(detail.value.emailMasked === true, 'Detail PII was not masked without consent')

    const counts = await readCustomerSegmentCounts(actor, restaurantId, port)
    assert(counts.ok, 'Segment counts failed')

    const crossTenant = await readCustomers(actor, { restaurantId: randomUUID() }, port)
    assert(!crossTenant.ok && crossTenant.error === 'Not authorized', 'Cross-tenant read was not rejected')

    const deleted = await deleteCustomerSegment(actor, {
      restaurantId,
      segmentId: created.value.id,
    }, port)
    assert(deleted.ok && deleted.value, 'Segment delete failed')

    console.log(JSON.stringify({
      restaurantId,
      customerId,
      list: {
        total: page.value.total,
        points: page.value.customers[0]?.points,
        emailMasked: page.value.customers[0]?.emailMasked,
      },
      detail: {
        found: detail.value.customerId === customerId,
        emailMasked: detail.value.emailMasked,
        timelineEvents: detail.value.timeline.length,
      },
      segment: {
        created: created.value.name,
        updated: updated.value.name,
        deleted: deleted.value,
        builtinCounts: counts.value,
      },
      storeCredit: credit.value.granted,
      crossTenantRejected: !crossTenant.ok,
    }, null, 2))
  } finally {
    if (restaurantId) await service.from('restaurants').delete().eq('id', restaurantId)
    if (customerId) await service.from('customers').delete().eq('id', customerId)
    if (authUserId) await service.auth.admin.deleteUser(authUserId)
    const [{ count: restaurantOrphans }, { count: customerOrphans }, { count: segmentOrphans }] = await Promise.all([
      service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', restaurantId || randomUUID()),
      service.from('customers').select('id', { count: 'exact', head: true }).eq('id', customerId || randomUUID()),
      service.from('customer_segments').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId || randomUUID()),
    ])
    console.log(JSON.stringify({ cleanup: { restaurantOrphans, customerOrphans, segmentOrphans } }))
  }
}

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ runtimeError: error instanceof Error ? error.message : error }, null, 2))
  process.exitCode = 1
})
