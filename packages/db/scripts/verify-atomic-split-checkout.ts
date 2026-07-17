import { randomUUID } from 'node:crypto'
import { createDashboardOrder } from '@garsonless/application/orders'
import {
  confirmDashboardCashShare,
  declareSplitShare,
  prepareSplitCheckout,
  releaseSplitCheckout,
  settleProviderShare,
} from '@garsonless/application/splits'
import { createClient, createServiceClient } from '../src/client'
import { createDashboardOrderPort } from '../src/order-command-port'
import { attachSharePaymentToken } from '../src/payment-provider-port'
import { createSplitPaymentPort } from '../src/split-command-port'

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
    const anonReservation = await anon.rpc('reserve_split_checkout', {
      p_share_id: randomUUID(),
      p_restaurant_id: randomUUID(),
      p_table_id: randomUUID(),
      p_reservation_seconds: 60,
    })
    assert(anonReservation.error?.code === '42501', 'Anon checkout reservation RPC was executable')

    const { data: fixture, error: fixtureError } = await service
      .from('restaurants')
      .select('owner_id')
      .eq('slug', 'test-cafe-b')
      .single()
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')

    const { data: restaurant, error: restaurantError } = await service.from('restaurants').insert({
      owner_id: fixture.owner_id,
      slug: `atomic-split-${suffix}`,
      name: `Atomic split ${suffix}`,
      settings: { city: 'Singapore', runtimeMarker: suffix },
    }).select('id').single()
    if (restaurantError) throw restaurantError
    restaurantId = restaurant.id

    const [{ data: table, error: tableError }, { data: category, error: categoryError }] = await Promise.all([
      service.from('tables').insert({ restaurant_id: restaurantId, label: 'Atomic table' }).select('id').single(),
      service.from('menu_categories').insert({ restaurant_id: restaurantId, name: 'Atomic category' }).select('id').single(),
    ])
    if (tableError || !table) throw tableError ?? new Error('Table unavailable')
    if (categoryError || !category) throw categoryError ?? new Error('Category unavailable')
    const { data: item, error: itemError } = await service.from('menu_items').insert({
      category_id: category.id,
      name: 'Atomic item',
      price: 100,
    }).select('id').single()
    if (itemError || !item) throw itemError ?? new Error('Item unavailable')

    const dashboardContext = {
      actor: 'dashboard-member' as const,
      userId: fixture.owner_id,
      restaurantId,
      permissions: ['orders', 'tables'],
    }
    const created = await createDashboardOrder(dashboardContext, {
      restaurantId,
      tableId: table.id,
      lines: [{ itemId: item.id, quantity: 1 }],
    }, createDashboardOrderPort())
    assert(created.ok, created.ok ? '' : created.error)
    const { data: order, error: orderError } = await service.from('orders')
      .select('id, table_session_id, total')
      .eq('id', created.value.orderId)
      .single()
    if (orderError || !order?.table_session_id) throw orderError ?? new Error('Order unavailable')
    assert(Number(order.total) === 100, 'Fixture order total drifted')

    const tableContext = {
      actor: 'table-guest' as const,
      restaurantId,
      tableId: table.id,
      tableToken: randomUUID(),
    }
    const splitPort = createSplitPaymentPort()
    const declarations = await Promise.all([
      declareSplitShare(tableContext, {
        restaurantId, tableSessionId: order.table_session_id, method: 'iyzico', amount: 80,
        customerId: null, label: 'concurrent-a',
      }, splitPort),
      declareSplitShare(tableContext, {
        restaurantId, tableSessionId: order.table_session_id, method: 'iyzico', amount: 80,
        customerId: null, label: 'concurrent-b',
      }, splitPort),
    ])
    assert(declarations.every((result) => result.ok), 'Share declarations failed')
    const firstShare = declarations[0]
    const secondShare = declarations[1]
    assert(firstShare.ok && secondShare.ok, 'Share ids unavailable')

    const reservations = await Promise.all([
      prepareSplitCheckout(tableContext, { restaurantId, shareId: firstShare.value.shareId }, splitPort),
      prepareSplitCheckout(tableContext, { restaurantId, shareId: secondShare.value.shareId }, splitPort),
    ])
    assert(reservations.every((result) => result.ok), 'Concurrent checkout reservation failed')
    const reservedAmounts = reservations.map((result) => result.ok ? result.value.amount : 0)
    assert(reservedAmounts.reduce((sum, amount) => sum + amount, 0) === 100, 'Concurrent reservations exceeded or under-covered ₺100')
    assert(reservedAmounts.includes(80) && reservedAmounts.includes(20), 'Expected serialized ₺80 + ₺20 reservations')

    const retry = await prepareSplitCheckout(
      tableContext,
      { restaurantId, shareId: firstShare.value.shareId },
      splitPort,
    )
    assert(retry.ok && retry.value.amount === reservedAmounts[0], 'Reservation retry was not idempotent')

    const released = await releaseSplitCheckout(
      tableContext,
      { restaurantId, shareId: secondShare.value.shareId },
      splitPort,
    )
    assert(released.ok, released.ok ? '' : released.error)
    const thirdShare = await declareSplitShare(tableContext, {
      restaurantId, tableSessionId: order.table_session_id, method: 'iyzico', amount: 80,
      customerId: null, label: 'released-balance',
    }, splitPort)
    assert(thirdShare.ok, thirdShare.ok ? '' : thirdShare.error)
    const thirdReservation = await prepareSplitCheckout(
      tableContext,
      { restaurantId, shareId: thirdShare.value.shareId },
      splitPort,
    )
    assert(thirdReservation.ok && thirdReservation.value.amount === reservedAmounts[1], 'Released balance was not reusable')

    const firstToken = `atomic-a-${randomUUID()}`
    const thirdToken = `atomic-c-${randomUUID()}`
    assert(await attachSharePaymentToken(firstShare.value.shareId, restaurantId, firstToken) === null, 'First token attach failed')
    assert(await attachSharePaymentToken(thirdShare.value.shareId, restaurantId, thirdToken) === null, 'Third token attach failed')
    const boundRelease = await releaseSplitCheckout(
      tableContext,
      { restaurantId, shareId: firstShare.value.shareId },
      splitPort,
    )
    assert(!boundRelease.ok, 'Token-bound reservation was released')

    const settlements = await Promise.all([
      settleProviderShare(
        { actor: 'payment-provider', restaurantId, provider: 'iyzico' },
        { restaurantId, shareId: firstShare.value.shareId },
        splitPort,
      ),
      settleProviderShare(
        { actor: 'payment-provider', restaurantId, provider: 'iyzico' },
        { restaurantId, shareId: thirdShare.value.shareId },
        splitPort,
      ),
    ])
    assert(settlements.every((result) => result.ok), 'Concurrent provider settlement failed')
    assert(settlements.some((result) => result.ok && result.value.finalized), 'No concurrent settlement finalized the order')
    const settlementRetry = await settleProviderShare(
      { actor: 'payment-provider', restaurantId, provider: 'iyzico' },
      { restaurantId, shareId: firstShare.value.shareId },
      splitPort,
    )
    assert(settlementRetry.ok && settlementRetry.value.idempotent, 'Provider callback retry was not idempotent')

    const [{ data: paidOrder }, { count: settledOutbox }] = await Promise.all([
      service.from('orders').select('paid_at, payment_method').eq('id', order.id).single(),
      service.from('domain_outbox').select('id', { count: 'exact', head: true })
        .eq('aggregate_id', order.id).eq('event_type', 'order.settled'),
    ])
    assert(paidOrder?.paid_at && paidOrder.payment_method === 'split', 'Atomic finalization did not stamp the order')
    assert(settledOutbox === 1, 'Atomic finalization did not enqueue exactly one order.settled event')
    const { data: staleFirstRound } = await service.from('payment_shares')
      .select('status')
      .eq('id', secondShare.value.shareId)
      .single()
    assert(staleFirstRound?.status === 'void', 'Fully covered bill retained a stale declared intent')

    // Add a second ₺30 round. Its cash intent must not consume money already
    // protected by an online provider token.
    const { error: priceError } = await service.from('menu_items').update({ price: 30 }).eq('id', item.id)
    if (priceError) throw priceError
    const secondOrder = await createDashboardOrder(dashboardContext, {
      restaurantId,
      tableId: table.id,
      lines: [{ itemId: item.id, quantity: 1 }],
    }, createDashboardOrderPort())
    assert(secondOrder.ok, secondOrder.ok ? '' : secondOrder.error)
    const cashShare = await declareSplitShare(tableContext, {
      restaurantId, tableSessionId: order.table_session_id, method: 'cash', amount: 30,
      customerId: null, label: 'cash-race',
    }, splitPort)
    const protectedShare = await declareSplitShare(tableContext, {
      restaurantId, tableSessionId: order.table_session_id, method: 'iyzico', amount: 30,
      customerId: null, label: 'online-protected',
    }, splitPort)
    assert(cashShare.ok && protectedShare.ok, 'Second-round declarations failed')
    const protectedCheckout = await prepareSplitCheckout(
      tableContext,
      { restaurantId, shareId: protectedShare.value.shareId },
      splitPort,
    )
    assert(protectedCheckout.ok && protectedCheckout.value.amount === 30, 'Second-round reservation failed')
    assert(
      await attachSharePaymentToken(protectedShare.value.shareId, restaurantId, `protected-${randomUUID()}`) === null,
      'Protected token attach failed',
    )
    const cashCollision = await confirmDashboardCashShare(
      dashboardContext,
      { restaurantId, shareId: cashShare.value.shareId },
      splitPort,
    )
    assert(!cashCollision.ok && cashCollision.error.includes('aşıyor'), 'Cash settlement consumed provider-reserved balance')
    const protectedSettlement = await settleProviderShare(
      { actor: 'payment-provider', restaurantId, provider: 'iyzico' },
      { restaurantId, shareId: protectedShare.value.shareId },
      splitPort,
    )
    assert(protectedSettlement.ok && protectedSettlement.value.finalized, 'Protected provider settlement did not finalize')
    const { data: staleCash } = await service.from('payment_shares')
      .select('status')
      .eq('id', cashShare.value.shareId)
      .single()
    assert(staleCash?.status === 'void', 'Finalized second round retained a stale cash intent')

    const wrongTenant = await splitPort.settleShare({
      restaurantId: randomUUID(),
      shareId: protectedShare.value.shareId,
      settledBy: null,
      expectedMethod: 'iyzico',
    })
    assert(!wrongTenant.ok, 'Cross-tenant atomic settlement was accepted')

    const { data: persistedShares } = await service.from('payment_shares')
      .select('id, label, amount, checkout_amount, checkout_reserved_until, method, status, settled_by')
      .eq('restaurant_id', restaurantId)
      .order('created_at')
    console.log(JSON.stringify({
      concurrency: {
        declared: [firstShare.value.amount, secondShare.value.amount],
        reserved: reservedAmounts,
        totalReserved: reservedAmounts.reduce((sum, amount) => sum + amount, 0),
        retryAmount: retry.value.amount,
        released: released.value,
        reusedAmount: thirdReservation.value.amount,
        boundReleaseRejected: boundRelease.error,
      },
      settlement: {
        concurrent: settlements.map((result) => result.ok ? result.value : result.error),
        retry: settlementRetry.value,
        order: paidOrder,
        orderSettledOutboxRows: settledOutbox,
        staleFirstRoundIntent: staleFirstRound?.status,
      },
      collision: {
        cashRejected: cashCollision.error,
        providerFinalized: protectedSettlement.value.finalized,
        staleCashIntent: staleCash?.status,
        crossTenantRejected: wrongTenant.error,
      },
      authorization: { anonReservationRpc: anonReservation.error.code },
      persistedShares,
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (restaurantId) {
    const { error: shareDeleteError } = await service.from('payment_shares')
      .delete().eq('restaurant_id', restaurantId)
    if (shareDeleteError) throw shareDeleteError
    const { error: restaurantDeleteError } = await service.from('restaurants')
      .delete().eq('id', restaurantId)
    if (restaurantDeleteError) throw restaurantDeleteError
  }
  const marker = restaurantId || randomUUID()
  const [{ count: restaurants }, { count: orders }, { count: shares }, { count: outbox }] = await Promise.all([
    service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', marker),
    service.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('payment_shares').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('domain_outbox').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
  ])
  console.log(JSON.stringify({ cleanup: { restaurants, orders, shares, outbox } }))
  assert(restaurants === 0 && orders === 0 && shares === 0 && outbox === 0, 'Runtime cleanup left orphan rows')
  if (primaryError) throw primaryError
}

void main()
