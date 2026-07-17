import { randomUUID } from 'node:crypto'
import { createDashboardOrder } from '@garsonless/application/orders'
import { prepareOrderCheckout } from '@garsonless/application/payments'
import {
  confirmDashboardCashShare,
  declareSplitShare,
  prepareSplitCheckout,
  settleProviderShare,
} from '@garsonless/application/splits'
import { createServiceClient } from '../src/client'
import { createDashboardOrderPort } from '../src/order-command-port'
import {
  attachOrderPaymentToken,
  attachSharePaymentToken,
  createOrderCheckoutPort,
  readOrderPaymentMapping,
  readSharePaymentMapping,
} from '../src/payment-provider-port'
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
    const { data: fixture, error: fixtureError } = await service
      .from('restaurants')
      .select('owner_id')
      .eq('slug', 'test-cafe-b')
      .single()
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')

    const { data: restaurant, error: restaurantError } = await service.from('restaurants').insert({
      owner_id: fixture.owner_id,
      slug: `order-split-${suffix}`,
      name: `Order split ${suffix}`,
      settings: { city: 'Singapore' },
    }).select('id').single()
    if (restaurantError) throw restaurantError
    restaurantId = restaurant.id

    const [{ data: table, error: tableError }, { data: category, error: categoryError }] = await Promise.all([
      service.from('tables').insert({ restaurant_id: restaurantId, label: 'Runtime table' }).select('id').single(),
      service.from('menu_categories').insert({ restaurant_id: restaurantId, name: 'Runtime category' }).select('id').single(),
    ])
    if (tableError || !table) throw tableError ?? new Error('Table unavailable')
    if (categoryError || !category) throw categoryError ?? new Error('Category unavailable')
    const { data: item, error: itemError } = await service.from('menu_items').insert({
      category_id: category.id,
      name: 'Runtime item',
      price: 40,
    }).select('id').single()
    if (itemError || !item) throw itemError ?? new Error('Item unavailable')

    const dashboardContext = {
      actor: 'dashboard-member' as const,
      userId: fixture.owner_id,
      restaurantId,
      permissions: ['orders', 'tables'],
    }
    const dashboardPort = createDashboardOrderPort()
    const crossTenant = await createDashboardOrder(dashboardContext, {
      restaurantId: randomUUID(),
      tableId: table.id,
      lines: [{ itemId: item.id, quantity: 2 }],
    }, dashboardPort)
    assert(!crossTenant.ok && crossTenant.error === 'Not authorized', 'Cross-tenant dashboard create was not rejected')

    const created = await createDashboardOrder(dashboardContext, {
      restaurantId,
      tableId: table.id,
      lines: [{ itemId: item.id, quantity: 2 }],
    }, dashboardPort)
    assert(created.ok, created.ok ? '' : created.error)
    const { data: orderRow, error: orderError } = await service.from('orders')
      .select('total, status, session_id, table_session_id')
      .eq('id', created.value.orderId)
      .single()
    if (orderError || !orderRow?.table_session_id) throw orderError ?? new Error('Created order unavailable')
    assert(Number(orderRow.total) === 80, 'Dashboard order total was not server-derived')
    assert(orderRow.status === 'sent_to_kitchen', 'Dashboard order status changed')
    assert(orderRow.session_id === fixture.owner_id, 'Dashboard actor was not persisted')

    const tableContext = {
      actor: 'table-guest' as const,
      restaurantId,
      tableId: table.id,
      tableToken: randomUUID(),
    }
    const splitPort = createSplitPaymentPort()
    const declaredOnline = await declareSplitShare(tableContext, {
      restaurantId,
      tableSessionId: orderRow.table_session_id,
      method: 'iyzico',
      amount: 800,
      customerId: null,
      label: 'runtime online',
    }, splitPort)
    assert(declaredOnline.ok, declaredOnline.ok ? '' : declaredOnline.error)
    assert(declaredOnline.value.amount === 80, 'Online share was not capped at the persisted balance')

    const checkout = await prepareSplitCheckout(tableContext, {
      restaurantId,
      shareId: declaredOnline.value.shareId,
    }, splitPort)
    assert(checkout.ok && checkout.value.amount === 80, checkout.ok ? 'Wrong checkout amount' : checkout.error)
    const shareToken = `share-${randomUUID()}`
    assert(
      await attachSharePaymentToken(declaredOnline.value.shareId, restaurantId, shareToken) === null,
      'Share token attach failed',
    )

    const onlineSettlement = await settleProviderShare(
      { actor: 'payment-provider', restaurantId, provider: 'iyzico' },
      { restaurantId, shareId: declaredOnline.value.shareId },
      splitPort,
    )
    assert(onlineSettlement.ok && onlineSettlement.value.finalized, onlineSettlement.ok ? 'Online share did not finalize' : onlineSettlement.error)
    const onlineRetry = await settleProviderShare(
      { actor: 'payment-provider', restaurantId, provider: 'iyzico' },
      { restaurantId, shareId: declaredOnline.value.shareId },
      splitPort,
    )
    assert(onlineRetry.ok, onlineRetry.ok ? '' : onlineRetry.error)

    const second = await createDashboardOrder(dashboardContext, {
      restaurantId,
      tableId: table.id,
      lines: [{ itemId: item.id, quantity: 1 }],
    }, dashboardPort)
    assert(second.ok, second.ok ? '' : second.error)
    const declaredCash = await declareSplitShare(tableContext, {
      restaurantId,
      tableSessionId: orderRow.table_session_id,
      method: 'cash',
      amount: 400,
      customerId: null,
      label: 'runtime cash',
    }, splitPort)
    assert(declaredCash.ok && declaredCash.value.amount === 40, declaredCash.ok ? 'Cash share cap failed' : declaredCash.error)
    const providerCash = await settleProviderShare(
      { actor: 'payment-provider', restaurantId, provider: 'iyzico' },
      { restaurantId, shareId: declaredCash.value.shareId },
      splitPort,
    )
    assert(!providerCash.ok && providerCash.error.includes('eşleşmiyor'), 'Provider settled a cash share')
    const cashSettlement = await confirmDashboardCashShare(dashboardContext, {
      restaurantId,
      shareId: declaredCash.value.shareId,
    }, splitPort)
    assert(cashSettlement.ok && cashSettlement.value.finalized, cashSettlement.ok ? 'Cash share did not finalize' : cashSettlement.error)

    const orderCheckout = await prepareOrderCheckout(tableContext, {
      restaurantId,
      orderId: second.value.orderId,
    }, createOrderCheckoutPort())
    assert(orderCheckout.ok && orderCheckout.value.amount === 40, orderCheckout.ok ? 'Order checkout amount mismatch' : orderCheckout.error)

    const orderToken = `order-${randomUUID()}`
    assert(await attachOrderPaymentToken(
      second.value.orderId,
      restaurantId,
      orderCheckout.value.reservationId,
      orderToken,
    ) === null, 'Order token attach failed')
    const [orderMapping, shareMapping] = await Promise.all([
      readOrderPaymentMapping(orderToken),
      readSharePaymentMapping(shareToken),
    ])
    assert(orderMapping.orderId === second.value.orderId && orderMapping.restaurantId === restaurantId, 'Order token mapping drifted')
    assert(shareMapping.shareId === declaredOnline.value.shareId && shareMapping.restaurantId === restaurantId, 'Share token mapping drifted')

    const { data: paidOrders } = await service.from('orders')
      .select('id, paid_at, payment_method')
      .eq('restaurant_id', restaurantId)
      .order('created_at')
    assert((paidOrders ?? []).length === 2, 'Unexpected runtime order count')
    assert((paidOrders ?? []).every((order) => order.paid_at && order.payment_method === 'split'), 'Split finalization did not persist')
    const { data: shares } = await service.from('payment_shares')
      .select('id, amount, method, status, settled_by')
      .eq('restaurant_id', restaurantId)
      .order('created_at')

    console.log(JSON.stringify({
      dashboardCreate: {
        crossTenant: crossTenant.error,
        orderId: created.value.orderId,
        total: orderRow.total,
        status: orderRow.status,
        actor: orderRow.session_id,
      },
      onlineShare: {
        declaredAmount: declaredOnline.value.amount,
        checkoutAmount: checkout.value.amount,
        finalized: onlineSettlement.value.finalized,
        retry: onlineRetry.ok,
      },
      cashShare: {
        declaredAmount: declaredCash.value.amount,
        providerRejected: providerCash.error,
        finalized: cashSettlement.value.finalized,
      },
      checkoutAndMappings: {
        orderAmount: orderCheckout.value.amount,
        settings: orderCheckout.value.restaurantSettings,
        orderMapping,
        shareMapping,
      },
      persisted: { shares, orders: paidOrders },
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (restaurantId) {
    // payment_shares.restaurant_id intentionally has no ON DELETE CASCADE;
    // remove real-money test ledger rows explicitly before the tenant shell.
    const { error: shareDeleteError } = await service.from('payment_shares')
      .delete().eq('restaurant_id', restaurantId)
    if (shareDeleteError) throw shareDeleteError
    const { error: restaurantDeleteError } = await service.from('restaurants')
      .delete().eq('id', restaurantId)
    if (restaurantDeleteError) throw restaurantDeleteError
  }
  const marker = restaurantId || randomUUID()
  const [{ count: restaurants }, { count: orders }, { count: shares }] = await Promise.all([
    service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', marker),
    service.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('payment_shares').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
  ])
  console.log(JSON.stringify({ cleanup: { restaurants, orders, shares } }))
  assert(restaurants === 0 && orders === 0 && shares === 0, 'Runtime cleanup left orphan rows')
  if (primaryError) throw primaryError
}

void main()
