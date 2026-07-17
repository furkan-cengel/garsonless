import { createHash, randomUUID } from 'node:crypto'
import { createDashboardOrder, settleOrder } from '@garsonless/application/orders'
import { prepareOrderCheckout, releaseOrderCheckout } from '@garsonless/application/payments'
import { processPaymentReconciliationBatch } from '@garsonless/application/payment-reconciliation'
import { createClient, createServiceClient } from '../src/client'
import { createDashboardOrderPort, createSettlementPort } from '../src/order-command-port'
import { createOrderCheckoutPort, attachOrderPaymentToken } from '../src/payment-provider-port'
import { createPaymentReconciliationPort, recordPaymentReconciliation } from '../src/payment-reconciliation-port'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''

async function main() {
  let primaryError: unknown = null
  try {
    const anon = createClient()
    const anonReservation = await anon.rpc('reserve_order_checkout', {
      p_order_id: randomUUID(), p_restaurant_id: randomUUID(), p_table_id: randomUUID(), p_reservation_seconds: 60,
    })
    assert(anonReservation.error?.code === '42501', 'Anon order checkout RPC was executable')

    const { data: fixture, error: fixtureError } = await service.from('restaurants')
      .select('owner_id').eq('slug', 'test-cafe-b').single()
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')
    const { data: restaurant, error: restaurantError } = await service.from('restaurants').insert({
      owner_id: fixture.owner_id,
      slug: `atomic-order-${suffix}`,
      name: `Atomic order ${suffix}`,
      settings: { city: 'Singapore', runtimeMarker: suffix },
    }).select('id').single()
    if (restaurantError) throw restaurantError
    restaurantId = restaurant.id
    const [{ data: table, error: tableError }, { data: category, error: categoryError }] = await Promise.all([
      service.from('tables').insert({ restaurant_id: restaurantId, label: 'Atomic table' }).select('id').single(),
      service.from('menu_categories').insert({ restaurant_id: restaurantId, name: 'Atomic category' }).select('id').single(),
    ])
    if (tableError || !table || categoryError || !category) throw tableError ?? categoryError ?? new Error('Fixture unavailable')
    const { data: item, error: itemError } = await service.from('menu_items').insert({
      category_id: category.id, name: 'Atomic item', price: 125,
    }).select('id').single()
    if (itemError || !item) throw itemError ?? new Error('Item unavailable')
    const created = await createDashboardOrder({
      actor: 'dashboard-member', userId: fixture.owner_id, restaurantId, permissions: ['orders'],
    }, {
      restaurantId, tableId: table.id, lines: [{ itemId: item.id, quantity: 1 }],
    }, createDashboardOrderPort())
    assert(created.ok, created.ok ? '' : created.error)

    const context = { actor: 'table-guest' as const, restaurantId, tableId: table.id, tableToken: randomUUID() }
    const port = createOrderCheckoutPort()
    const reservations = await Promise.all([
      prepareOrderCheckout(context, { restaurantId, orderId: created.value.orderId }, port),
      prepareOrderCheckout(context, { restaurantId, orderId: created.value.orderId }, port),
    ])
    const winners = reservations.filter((result) => result.ok)
    const losers = reservations.filter((result) => !result.ok)
    assert(winners.length === 1 && losers.length === 1, 'Parallel checkout did not produce exactly one lease owner')
    const winner = winners[0]
    assert(winner?.ok && winner.value.amount === 125, 'Checkout amount drifted')
    assert(!losers[0]?.ok && losers[0]?.error.includes('hazırlanıyor'), 'Concurrent checkout was not rejected clearly')

    const wrongRelease = await releaseOrderCheckout(context, {
      restaurantId, orderId: created.value.orderId, reservationId: randomUUID(),
    }, port)
    assert(!wrongRelease.ok, 'Foreign lease released checkout')
    const token = `atomic-order-${randomUUID()}`
    const attach = await attachOrderPaymentToken(created.value.orderId, restaurantId, winner.value.reservationId, token)
    assert(attach === null, attach ?? 'Token attach failed')
    const replacement = await attachOrderPaymentToken(
      created.value.orderId, restaurantId, winner.value.reservationId, `replacement-${randomUUID()}`,
    )
    assert(replacement?.includes('başka bir ödeme oturumuna'), 'Existing provider token was replaced')
    const boundRelease = await releaseOrderCheckout(context, {
      restaurantId, orderId: created.value.orderId, reservationId: winner.value.reservationId,
    }, port)
    assert(!boundRelease.ok, 'Token-bound checkout reservation was released')

    const tokenHash = createHash('sha256').update(token).digest('hex')
    const reconciliationInput = {
      restaurantId,
      orderId: created.value.orderId,
      providerTokenHash: tokenHash,
      eventType: 'order_settlement_failed' as const,
      detail: { runtimeMarker: suffix },
    }
    const firstEvent = await recordPaymentReconciliation(reconciliationInput)
    const duplicateEvent = await recordPaymentReconciliation(reconciliationInput)
    assert(firstEvent.ok && duplicateEvent.ok && firstEvent.value.eventId === duplicateEvent.value.eventId, 'Reconciliation event was not idempotent')

    const handlers = {
      recoverOrder: ({ restaurantId: scopedRestaurantId, orderId }: { restaurantId: string; orderId: string }) => settleOrder(
        { actor: 'payment-provider' as const, restaurantId: scopedRestaurantId, provider: 'iyzico' },
        { restaurantId: scopedRestaurantId, orderId, method: 'iyzico' },
        createSettlementPort(),
      ),
      async recoverShare() { return { ok: false as const, error: 'unexpected share' } },
    }
    const workers = await Promise.all([
      processPaymentReconciliationBatch({ workerId: `worker-a-${suffix}` }, createPaymentReconciliationPort(), handlers),
      processPaymentReconciliationBatch({ workerId: `worker-b-${suffix}` }, createPaymentReconciliationPort(), handlers),
    ])
    assert(workers.every((result) => result.ok), 'Reconciliation worker failed')
    assert(workers.reduce((sum, result) => sum + (result.ok ? result.value.claimed : 0), 0) === 1, 'Workers double-claimed one event')
    assert(workers.reduce((sum, result) => sum + (result.ok ? result.value.resolved : 0), 0) === 1, 'Recovery did not resolve exactly once')

    const [{ data: order }, { data: mapping }, { data: events }] = await Promise.all([
      service.from('orders').select('paid_at, payment_method, checkout_amount, checkout_reserved_until, checkout_reservation_id').eq('id', created.value.orderId).single(),
      service.from('order_payment_tokens').select('token').eq('order_id', created.value.orderId).single(),
      service.from('payment_reconciliation_events').select('id, status, attempts, resolved_at, dead_lettered_at').eq('order_id', created.value.orderId),
    ])
    assert(order?.paid_at && order.payment_method === 'iyzico', 'Recovered provider payment did not settle order')
    assert(order.checkout_amount === null && order.checkout_reserved_until === null && order.checkout_reservation_id === null, 'Terminal settlement retained checkout lease')
    assert(mapping?.token === token, 'Provider token mapping changed')
    assert(events?.length === 1 && events[0]?.status === 'resolved', 'Reconciliation queue did not resolve idempotently')

    console.log(JSON.stringify({
      checkout: {
        winners: winners.length,
        losers: losers.length,
        amount: winner.value.amount,
        concurrentError: !losers[0]?.ok ? losers[0]?.error : null,
        wrongLeaseRelease: wrongRelease.ok ? null : wrongRelease.error,
        replacementRejected: replacement,
        boundRelease: boundRelease.ok ? null : boundRelease.error,
      },
      reconciliation: { firstEvent, duplicateEvent, workers, rows: events },
      settlement: order,
      authorization: { anonReservationRpc: anonReservation.error.code },
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (restaurantId) {
    const { error } = await service.from('restaurants').delete().eq('id', restaurantId)
    if (error) throw error
  }
  const marker = restaurantId || randomUUID()
  const [{ count: restaurants }, { count: orders }, { count: reconciliation }, { count: outbox }] = await Promise.all([
    service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', marker),
    service.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('payment_reconciliation_events').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('domain_outbox').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
  ])
  console.log(JSON.stringify({ cleanup: { restaurants, orders, reconciliation, outbox } }))
  assert(restaurants === 0 && orders === 0 && reconciliation === 0 && outbox === 0, 'Runtime cleanup left orphan rows')
  if (primaryError) throw primaryError
}

void main()
