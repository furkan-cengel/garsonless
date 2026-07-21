import { randomUUID } from 'node:crypto'
import {
  computeOrderDiscount,
  creditWelcomeBonusStrict,
  getLoyaltyScope,
  getMemberBalances,
} from '../src/loyalty'
import { createServiceClient } from '../src/client'

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
        slug: `loyalty-plan-${suffix}`,
        name: `Loyalty plan ${suffix}`,
        plan: 'starter',
        settings: {
          loyalty: {
            stamp_enabled: false,
            points_enabled: true,
            points_per_lira: 1,
            points_redeem_rate: 10,
            welcome_bonus_points: 25,
            member_discount_pct: 0,
            scope: 'restaurant',
            earn_trigger: 'paid',
          },
        },
      })
      .select('id')
      .single()
    if (restaurantError || !restaurant) throw restaurantError ?? new Error('Restaurant fixture unavailable')
    restaurantId = restaurant.id

    const email = `loyalty-plan-${suffix}@example.test`
    const { data: auth, error: authError } = await service.auth.admin.createUser({ email, email_confirm: true })
    if (authError || !auth.user) throw authError ?? new Error('Auth fixture unavailable')
    authUserId = auth.user.id

    const { data: customer, error: customerError } = await service
      .from('customers')
      .insert({ auth_user_id: authUserId, email, name: 'Plan entitlement member' })
      .select('id')
      .single()
    if (customerError || !customer) throw customerError ?? new Error('Customer fixture unavailable')
    customerId = customer.id

    const { data: category, error: categoryError } = await service
      .from('menu_categories')
      .insert({ restaurant_id: restaurantId, name: 'Plan test', position: 0 })
      .select('id')
      .single()
    if (categoryError || !category) throw categoryError ?? new Error('Category fixture unavailable')
    const { data: item, error: itemError } = await service
      .from('menu_items')
      .insert({ category_id: category.id, name: 'Plan latte', price: 100, position: 0 })
      .select('id')
      .single()
    if (itemError || !item) throw itemError ?? new Error('Item fixture unavailable')

    const starterScope = await getLoyaltyScope(restaurantId)
    const starterBalance = await getMemberBalances(customerId, restaurantId)
    await creditWelcomeBonusStrict(customerId, restaurantId)
    const { count: starterLedgerRows, error: starterLedgerError } = await service
      .from('loyalty_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
    if (starterLedgerError) throw starterLedgerError
    const starterDiscount = await computeOrderDiscount({
      customerId,
      restaurantId,
      lines: [{ itemId: item.id, quantity: 1, modifiersPriceDelta: 0 }],
      requestedPointsRedeem: 10,
    })
    assert(starterScope === null, 'Starter unexpectedly resolved a loyalty scope')
    assert(starterBalance === null, 'Starter unexpectedly resolved a loyalty balance')
    assert(starterLedgerRows === 0, 'Starter unexpectedly minted a welcome bonus')
    assert(starterDiscount.scopeKey === null && starterDiscount.finalTotal === 100, 'Starter unexpectedly applied a loyalty discount')

    const { error: upgradeError } = await service
      .from('restaurants')
      .update({ plan: 'pro' })
      .eq('id', restaurantId)
    if (upgradeError) throw upgradeError

    const proScope = await getLoyaltyScope(restaurantId)
    await creditWelcomeBonusStrict(customerId, restaurantId)
    const proBalance = await getMemberBalances(customerId, restaurantId)
    const proDiscount = await computeOrderDiscount({
      customerId,
      restaurantId,
      lines: [{ itemId: item.id, quantity: 1, modifiersPriceDelta: 0 }],
      requestedPointsRedeem: 10,
    })
    assert(proScope?.pointsEnabled === true, 'Pro did not resolve the stored loyalty configuration')
    assert(proBalance?.points === 25, 'Pro did not mint the welcome bonus once')
    assert(proDiscount.scopeKey === restaurantId, 'Pro discount did not resolve its loyalty scope')
    assert(proDiscount.pointsRedeemed === 10 && proDiscount.finalTotal === 99, 'Pro point redemption was not applied')

    console.log(JSON.stringify({
      starter: {
        scopeResolved: starterScope !== null,
        balanceResolved: starterBalance !== null,
        ledgerRows: starterLedgerRows,
        discountApplied: starterDiscount.finalTotal !== 100,
      },
      pro: {
        scopeResolved: proScope !== null,
        points: proBalance?.points ?? null,
        pointsRedeemed: proDiscount.pointsRedeemed,
        finalTotal: proDiscount.finalTotal,
      },
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
