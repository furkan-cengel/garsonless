import { randomUUID } from 'node:crypto'
import { createDashboardOrder, transitionKitchenOrder } from '@garsonless/application/orders'
import { createClient, createServiceClient } from '../src/client'
import { createDashboardOrderPort, createKitchenOrderPort } from '../src/order-command-port'
import { createTableServiceRequestPort, createTableSessionPort } from '../src/table-command-port'

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
    const [anonClose, anonRequest, anonKitchen] = await Promise.all([
      anon.rpc('close_table_session_atomic', {
        p_session_id: randomUUID(), p_restaurant_id: randomUUID(), p_abnormal_reason: null,
      }),
      anon.rpc('create_table_service_request_atomic', {
        p_restaurant_id: randomUUID(), p_table_id: randomUUID(), p_request_type: 'water',
      }),
      anon.rpc('transition_kitchen_order_atomic', {
        p_order_id: randomUUID(), p_restaurant_id: randomUUID(), p_station_id: 'expo', p_target_status: 'ready',
      }),
    ])
    assert(anonClose.error?.code === '42501', 'Anon table-close RPC was executable')
    assert(anonRequest.error?.code === '42501', 'Anon service-request RPC was executable')
    assert(anonKitchen.error?.code === '42501', 'Anon kitchen-transition RPC was executable')

    const { data: fixture, error: fixtureError } = await service.from('restaurants')
      .select('owner_id').eq('slug', 'test-cafe-b').single()
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')

    const { data: restaurant, error: restaurantError } = await service.from('restaurants').insert({
      owner_id: fixture.owner_id,
      slug: `table-kitchen-${suffix}`,
      name: `Table kitchen ${suffix}`,
      settings: { runtimeMarker: suffix },
    }).select('id').single()
    if (restaurantError) throw restaurantError
    restaurantId = restaurant.id

    const [{ data: table, error: tableError }, { data: station, error: stationError }] = await Promise.all([
      service.from('tables').insert({ restaurant_id: restaurantId, label: 'Boundary table' }).select('id').single(),
      service.from('kitchen_stations').insert({ restaurant_id: restaurantId, name: 'Runtime bar' }).select('id').single(),
    ])
    if (tableError || !table) throw tableError ?? new Error('Table unavailable')
    if (stationError || !station) throw stationError ?? new Error('Station unavailable')

    const { data: category, error: categoryError } = await service.from('menu_categories').insert({
      restaurant_id: restaurantId,
      name: 'Runtime category',
      kitchen_station_id: station.id,
    }).select('id').single()
    if (categoryError || !category) throw categoryError ?? new Error('Category unavailable')
    const { data: item, error: itemError } = await service.from('menu_items').insert({
      category_id: category.id,
      name: 'Runtime item',
      price: 60,
      kitchen_station_id: station.id,
    }).select('id').single()
    if (itemError || !item) throw itemError ?? new Error('Item unavailable')

    const { data: sessionId, error: sessionError } = await service.rpc('open_or_get_table_session', {
      p_restaurant_id: restaurantId,
      p_table_id: table.id,
    })
    if (sessionError || !sessionId) throw sessionError ?? new Error('Session unavailable')

    const serviceRequestPort = createTableServiceRequestPort()
    const requests = await Promise.all([
      serviceRequestPort.createRequest({ restaurantId, tableId: table.id, requestType: 'water' }),
      serviceRequestPort.createRequest({ restaurantId, tableId: table.id, requestType: 'water' }),
    ])
    assert(requests.every((result) => result.ok), 'Concurrent service requests failed')
    const requestOutcomes = requests.map((result) => result.ok && result.value.throttled)
    assert(requestOutcomes.filter(Boolean).length === 1, 'Concurrent request did not produce exactly one throttle')
    const { data: requestRows, count: requestCount } = await service.from('service_requests')
      .select('id, table_session_id, request_type, status', { count: 'exact' })
      .eq('restaurant_id', restaurantId)
    assert(requestCount === 1, 'Concurrent service request wrote more than one row')
    assert(requestRows?.[0]?.table_session_id === sessionId, 'Service request missed the open session')

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

    const { data: share, error: shareError } = await service.from('payment_shares').insert({
      restaurant_id: restaurantId,
      table_session_id: sessionId,
      amount: 60,
      method: 'iyzico',
      status: 'declared',
      checkout_amount: 60,
      checkout_reserved_until: new Date(Date.now() + 3_600_000).toISOString(),
    }).select('id').single()
    if (shareError || !share) throw shareError ?? new Error('Share unavailable')
    const { error: tokenError } = await service.from('payment_share_tokens').insert({
      share_id: share.id,
      token: `boundary-${randomUUID()}`,
    })
    if (tokenError) throw tokenError

    const tablePort = createTableSessionPort()
    const paymentPending = await tablePort.closeSession({
      restaurantId,
      sessionId,
      abnormalReason: 'runtime walkout',
    })
    assert(paymentPending.ok && paymentPending.value === 'payment_pending', 'Provider payment did not block close')
    const [{ data: openSession }, { data: protectedShare }] = await Promise.all([
      service.from('table_sessions').select('closed_at').eq('id', sessionId).single(),
      service.from('payment_shares').select('status').eq('id', share.id).single(),
    ])
    assert(openSession?.closed_at === null, 'Payment-pending session was closed')
    assert(protectedShare?.status === 'declared', 'Provider-bound share was voided')

    await service.from('payment_share_tokens').delete().eq('share_id', share.id)
    await service.from('payment_shares').update({
      checkout_reserved_until: new Date(Date.now() - 60_000).toISOString(),
    }).eq('id', share.id)
    const abnormalClose = await tablePort.closeSession({
      restaurantId,
      sessionId,
      abnormalReason: 'runtime walkout',
    })
    assert(abnormalClose.ok && abnormalClose.value === 'closed_abnormal', 'Abnormal close failed after provider release')
    const [{ data: closedSession }, { data: voidedShare }, { count: closeOutbox }] = await Promise.all([
      service.from('table_sessions').select('closed_at, close_reason').eq('id', sessionId).single(),
      service.from('payment_shares').select('status, checkout_amount, checkout_reserved_until').eq('id', share.id).single(),
      service.from('domain_outbox').select('id', { count: 'exact', head: true })
        .eq('aggregate_id', sessionId).eq('event_type', 'table_session.closed'),
    ])
    assert(closedSession?.closed_at && closedSession.close_reason === 'runtime walkout', 'Close audit was not persisted')
    assert(voidedShare?.status === 'void' && voidedShare.checkout_amount === null, 'Unbound share was not voided atomically')
    assert(closeOutbox === 1, 'Table close did not enqueue exactly one event')

    const kitchenOrder = await createDashboardOrder(dashboardContext, {
      restaurantId,
      tableId: null,
      lines: [{ itemId: item.id, quantity: 1 }],
    }, createDashboardOrderPort())
    assert(kitchenOrder.ok, kitchenOrder.ok ? '' : kitchenOrder.error)
    const wrongStationId = randomUUID()
    const wrongStation = await service.rpc('transition_kitchen_order_atomic', {
      p_order_id: kitchenOrder.value.orderId,
      p_restaurant_id: restaurantId,
      p_station_id: wrongStationId,
      p_target_status: 'preparing',
    })
    assert(wrongStation.error?.code === '42501', 'DB accepted a wrong kitchen station')

    const kitchenPort = createKitchenOrderPort()
    const preparing = await transitionKitchenOrder(
      { actor: 'kitchen', restaurantId, stationId: station.id },
      { orderId: kitchenOrder.value.orderId, restaurantId, status: 'preparing' },
      kitchenPort,
    )
    assert(preparing.ok, preparing.ok ? '' : preparing.error)
    const readyResults = await Promise.all([
      transitionKitchenOrder(
        { actor: 'kitchen', restaurantId, stationId: station.id },
        { orderId: kitchenOrder.value.orderId, restaurantId, status: 'ready' },
        kitchenPort,
      ),
      transitionKitchenOrder(
        { actor: 'kitchen', restaurantId, stationId: 'expo' },
        { orderId: kitchenOrder.value.orderId, restaurantId, status: 'ready' },
        kitchenPort,
      ),
    ])
    assert(readyResults.every((result) => result.ok), 'Concurrent ready retry was not idempotent')
    const { data: readyOrder } = await service.from('orders').select('status').eq('id', kitchenOrder.value.orderId).single()
    assert(readyOrder?.status === 'ready', 'Kitchen transition did not persist ready')

    console.log(JSON.stringify({
      authorization: {
        anonClose: anonClose.error.code,
        anonRequest: anonRequest.error.code,
        anonKitchen: anonKitchen.error.code,
        wrongStation: wrongStation.error.code,
      },
      serviceRequest: {
        parallel: requestOutcomes,
        rows: requestCount,
        attachedSession: requestRows?.[0]?.table_session_id,
      },
      tableClose: {
        firstOutcome: paymentPending.value,
        remainedOpen: openSession.closed_at === null,
        providerSharePreserved: protectedShare.status,
        secondOutcome: abnormalClose.value,
        reason: closedSession.close_reason,
        shareAfterClose: voidedShare,
        outboxRows: closeOutbox,
      },
      kitchen: {
        preparing: preparing.ok,
        concurrentReady: readyResults.map((result) => result.ok),
        persistedStatus: readyOrder.status,
      },
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (restaurantId) {
    // payment_shares intentionally uses RESTRICT on restaurant deletion so
    // financial rows cannot disappear accidentally. The runtime fixture owns
    // these throwaway shares, therefore remove them explicitly before tenant cleanup.
    const { error: shareDeleteError } = await service.from('payment_shares')
      .delete().eq('restaurant_id', restaurantId)
    if (shareDeleteError) throw shareDeleteError
    const { error: deleteError } = await service.from('restaurants').delete().eq('id', restaurantId)
    if (deleteError) throw deleteError
  }
  const marker = restaurantId || randomUUID()
  const [restaurants, sessions, orders, shares, requests, outbox] = await Promise.all([
    service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', marker),
    service.from('table_sessions').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('payment_shares').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('service_requests').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('domain_outbox').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
  ])
  const cleanup = {
    restaurants: restaurants.count,
    sessions: sessions.count,
    orders: orders.count,
    shares: shares.count,
    requests: requests.count,
    outbox: outbox.count,
  }
  console.log(JSON.stringify({ cleanup }))
  assert(Object.values(cleanup).every((count) => count === 0), 'Runtime cleanup left orphan rows')
  if (primaryError) throw primaryError
}

void main()
