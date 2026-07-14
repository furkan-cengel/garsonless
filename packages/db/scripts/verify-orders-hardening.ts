import { randomUUID } from 'node:crypto'
import { createClient, createServiceClient } from '../src/client'
import { createOrder } from '../src/orders'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const svc = createServiceClient()
const anon = createClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''
let customerId = ''

async function main() {
try {
  const { data: fixture } = await svc.from('restaurants').select('owner_id').eq('slug', 'test-cafe-b').single()
  assert(fixture?.owner_id, 'fixture owner unavailable')

  const { data: restaurant, error: restaurantError } = await svc.from('restaurants').insert({
    owner_id: fixture.owner_id,
    slug: `orders-hardening-${suffix}`,
    name: `Orders hardening ${suffix}`,
    settings: {},
  }).select('id').single()
  if (restaurantError) throw restaurantError
  restaurantId = restaurant.id

  const { data: table, error: tableError } = await svc.from('tables').insert({
    restaurant_id: restaurantId,
    label: 'Throwaway table',
  }).select('id').single()
  if (tableError) throw tableError
  const { data: category, error: categoryError } = await svc.from('menu_categories').insert({
    restaurant_id: restaurantId,
    name: 'Throwaway category',
  }).select('id').single()
  if (categoryError) throw categoryError
  const { data: item, error: itemError } = await svc.from('menu_items').insert({
    category_id: category.id,
    name: 'Throwaway item',
    price: 100,
  }).select('id').single()
  if (itemError) throw itemError

  const requestId = randomUUID()
  const input = {
    restaurantId,
    tableId: table.id,
    sessionId: randomUUID(),
    requestId,
    lines: [{ itemId: item.id, quantity: 1 }],
  }
  const first = await createOrder(input)
  const retry = await createOrder(input)
  assert(first.ok && retry.ok, 'guest create/retry failed')
  assert(first.orderId === retry.orderId, 'request id created duplicate orders')
  const { count: idempotentCount } = await svc.from('orders').select('id', { count: 'exact', head: true }).eq('request_id', requestId)
  assert(idempotentCount === 1, 'request id row count is not one')

  const rateResults: boolean[] = []
  for (let i = 0; i < 9; i += 1) {
    const { data, error } = await svc.rpc('consume_public_order_rate_limit', {
      p_restaurant_id: restaurantId,
      p_key_hash: `0123456789abcdef-${suffix}`,
      p_max: 8,
      p_window_seconds: 60,
    })
    if (error) throw error
    rateResults.push(data)
  }
  assert(rateResults.slice(0, 8).every(Boolean) && rateResults[8] === false, 'rate limiter did not throttle 9th request')

  const { data: customer, error: customerError } = await svc.from('customers').insert({ name: `Hardening ${suffix}` }).select('id').single()
  if (customerError) throw customerError
  customerId = customer.id
  await svc.from('loyalty_transactions').insert({
    customer_id: customerId,
    restaurant_id: restaurantId,
    scope_key: restaurantId,
    type: 'points',
    delta: 100,
    reason: 'runtime_seed',
    direction: 'earn',
  })
  const orderId = randomUUID()
  const { error: shellError } = await svc.from('orders').insert({
    id: orderId,
    restaurant_id: restaurantId,
    table_id: table.id,
    session_id: randomUUID(),
    customer_id: customerId,
    items: [],
    total: 100,
    status: 'pending_approval',
  })
  if (shellError) throw shellError
  const finalizeArgs = {
    p_order: orderId,
    p_restaurant: restaurantId,
    p_customer: customerId,
    p_scope_key: restaurantId,
    p_subtotal: 100,
    p_member_pct: 10,
    p_points_requested: 50,
    p_points_rate: 10,
    p_stamps_requested: 0,
    p_stamp_discount: 0,
    p_reward_item_name: null,
    p_catalog_points_cost: 0,
    p_catalog_discount: 0,
    p_catalog_item_name: null,
    p_preview_total: 85,
  }
  const finalized = await svc.rpc('finalize_order_discount', finalizeArgs)
  if (finalized.error) throw finalized.error
  const finalizedRetry = await svc.rpc('finalize_order_discount', finalizeArgs)
  if (finalizedRetry.error) throw finalizedRetry.error
  const [{ data: finalOrder }, { data: redemptions }] = await Promise.all([
    svc.from('orders').select('total, discount_breakdown').eq('id', orderId).single(),
    svc.from('loyalty_transactions').select('delta').eq('order_id', orderId).eq('direction', 'redeem'),
  ])
  assert(Number(finalOrder?.total) === 85, 'atomic final total mismatch')
  assert(redemptions?.length === 1 && redemptions[0]?.delta === -50, 'redemption retry duplicated ledger debit')

  const anonResults = await Promise.all([
    anon.from('orders').select('id').limit(1),
    anon.from('table_sessions').select('id').limit(1),
    anon.from('payment_shares').select('id').limit(1),
  ])
  const anonCodes = anonResults.map((result) => result.error?.code ?? null)
  assert(anonCodes.every((code) => code === '42501'), `anon reads were not denied: ${anonCodes.join(',')}`)

  console.log(JSON.stringify({
    idempotency: { firstOrderId: first.orderId, retryOrderId: retry.orderId, rows: idempotentCount },
    rateLimit: rateResults,
    atomicDiscount: { total: finalOrder?.total, breakdown: finalOrder?.discount_breakdown, redemptionRows: redemptions },
    anonReadCodes: { orders: anonCodes[0], tableSessions: anonCodes[1], paymentShares: anonCodes[2] },
  }, null, 2))
} finally {
  if (restaurantId) await svc.from('restaurants').delete().eq('id', restaurantId)
  if (customerId) await svc.from('customers').delete().eq('id', customerId)
  const [{ count: restaurantOrphans }, { count: customerOrphans }] = await Promise.all([
    svc.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', restaurantId || randomUUID()),
    svc.from('customers').select('id', { count: 'exact', head: true }).eq('id', customerId || randomUUID()),
  ])
  console.log(JSON.stringify({ cleanup: { restaurantOrphans, customerOrphans } }))
}
}

void main()
