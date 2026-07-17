import { randomUUID } from 'node:crypto'
import {
  customerActorContext,
  previewLoyaltyDiscount,
  readMemberLoyalty,
} from '@garsonless/application/loyalty'
import { createServiceClient } from '../src/client'
import { createLoyaltyQueryPort } from '../src/loyalty-query-port'

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
        slug: `loyalty-strangler-${suffix}`,
        name: `Loyalty strangler ${suffix}`,
        settings: {
          loyalty: {
            stamp_enabled: true,
            stamp_goal: 10,
            stamp_reward_text: 'Bir kahve',
            points_enabled: true,
            points_per_lira: 1,
            points_redeem_rate: 10,
            member_discount_pct: 10,
            scope: 'restaurant',
            earn_trigger: 'paid',
          },
        },
      })
      .select('id')
      .single()
    if (restaurantError) throw restaurantError
    restaurantId = restaurant.id

    const { data: authUser, error: authUserError } = await service.auth.admin.createUser({
      email: `loyalty-${suffix}@example.test`,
      email_confirm: true,
    })
    if (authUserError || !authUser.user) throw authUserError ?? new Error('Auth fixture unavailable')
    authUserId = authUser.user.id
    const { data: customer, error: customerError } = await service
      .from('customers')
      .insert({ auth_user_id: authUserId, email: `loyalty-${suffix}@example.test`, name: 'Runtime Member' })
      .select('id')
      .single()
    if (customerError) throw customerError
    customerId = customer.id

    const { data: category, error: categoryError } = await service
      .from('menu_categories')
      .insert({ restaurant_id: restaurantId, name: 'Runtime', position: 0 })
      .select('id')
      .single()
    if (categoryError) throw categoryError
    const { data: item, error: itemError } = await service
      .from('menu_items')
      .insert({ category_id: category.id, name: 'Runtime Latte', price: 100, position: 0 })
      .select('id')
      .single()
    if (itemError) throw itemError

    const { error: ledgerError } = await service.from('loyalty_transactions').insert([
      {
        customer_id: customerId,
        restaurant_id: restaurantId,
        scope_key: restaurantId,
        type: 'points',
        delta: 500,
        reason: 'runtime_fixture',
        direction: 'earn',
      },
      {
        customer_id: customerId,
        restaurant_id: restaurantId,
        scope_key: restaurantId,
        type: 'stamp',
        delta: 4,
        reason: 'runtime_fixture',
        direction: 'earn',
      },
    ])
    if (ledgerError) throw ledgerError

    const port = createLoyaltyQueryPort()
    const context = customerActorContext({ authUserId, customerId, restaurantId })
    const member = await readMemberLoyalty(context, port)
    assert(member.ok && member.value, 'Member balance query failed')
    assert(member.value.points === 500, 'Spendable points mismatch')
    assert(member.value.lifetimePoints === 500, 'Lifetime points mismatch')
    assert(member.value.stamps === 4, 'Stamp balance mismatch')

    const preview = await previewLoyaltyDiscount(context, {
      restaurantId,
      lines: [{ itemId: item.id, quantity: 1, modifiersPriceDelta: 0 }],
      requestedPointsRedeem: 100,
    }, port)
    assert(preview.ok, 'Member preview failed')
    assert(preview.value.subtotal === 100, 'Authoritative subtotal mismatch')
    assert(preview.value.memberDiscountAmount === 10, 'Member discount mismatch')
    assert(preview.value.pointsDiscountAmount === 10, 'Points discount mismatch')
    assert(preview.value.finalTotal === 80, 'Discount stack order mismatch')

    const guest = await previewLoyaltyDiscount(null, {
      restaurantId,
      lines: [{ itemId: item.id, quantity: 1, modifiersPriceDelta: 0 }],
      requestedPointsRedeem: 100,
      requestedStampClaim: true,
    }, port)
    assert(guest.ok && guest.value.finalTotal === 100, 'Guest received a loyalty discount')
    assert(guest.value.pointsRedeemed === 0, 'Guest redemption was not stripped')

    const crossTenant = await previewLoyaltyDiscount(context, {
      restaurantId: randomUUID(),
      lines: [{ itemId: item.id, quantity: 1, modifiersPriceDelta: 0 }],
    }, port)
    assert(!crossTenant.ok && crossTenant.error === 'Not authorized', 'Cross-tenant preview was not rejected')

    console.log(JSON.stringify({
      restaurantId,
      customerId,
      balances: {
        points: member.value.points,
        lifetimePoints: member.value.lifetimePoints,
        stamps: member.value.stamps,
        tier: member.value.tier.name,
      },
      memberPreview: {
        subtotal: preview.value.subtotal,
        memberDiscountAmount: preview.value.memberDiscountAmount,
        pointsDiscountAmount: preview.value.pointsDiscountAmount,
        pointsRedeemed: preview.value.pointsRedeemed,
        finalTotal: preview.value.finalTotal,
      },
      guestPreview: {
        finalTotal: guest.value.finalTotal,
        pointsRedeemed: guest.value.pointsRedeemed,
      },
      crossTenantRejected: !crossTenant.ok,
    }, null, 2))
  } finally {
    if (restaurantId) await service.from('restaurants').delete().eq('id', restaurantId)
    if (customerId) await service.from('customers').delete().eq('id', customerId)
    if (authUserId) await service.auth.admin.deleteUser(authUserId)
    const [{ count: restaurantOrphans }, { count: customerOrphans }] = await Promise.all([
      service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', restaurantId || randomUUID()),
      service.from('customers').select('id', { count: 'exact', head: true }).eq('id', customerId || randomUUID()),
    ])
    console.log(JSON.stringify({ cleanup: { restaurantOrphans, customerOrphans } }))
  }
}

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ runtimeError: error }, null, 2))
  process.exitCode = 1
})
