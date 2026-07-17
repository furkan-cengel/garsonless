import { randomUUID } from 'node:crypto'
import {
  mergeKitchenOrderProjection,
  readKitchenBoard,
  readKitchenOrders,
} from '@garsonless/application/tables'
import { createClient, createServiceClient } from '../src/client'
import { createKitchenBoardPort } from '../src/table-command-port'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''

async function main() {
  let primaryError: unknown = null
  try {
    const { data: fixture, error: fixtureError } = await service.from('restaurants')
      .select('owner_id').eq('slug', 'test-cafe-b').single()
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')

    const { data: restaurant, error: restaurantError } = await service.from('restaurants').insert({
      owner_id: fixture.owner_id,
      slug: `kitchen-projection-${suffix}`,
      name: `Kitchen projection ${suffix}`,
      settings: { runtimeMarker: suffix },
    }).select('id').single()
    if (restaurantError || !restaurant) throw restaurantError ?? new Error('Restaurant unavailable')
    restaurantId = restaurant.id

    const { data: table, error: tableError } = await service.from('tables').insert({
      restaurant_id: restaurantId,
      label: 'Projection Table',
    }).select('id').single()
    if (tableError || !table) throw tableError ?? new Error('Table unavailable')

    const { data: firstOrder, error: firstOrderError } = await service.from('orders').insert({
      restaurant_id: restaurantId,
      table_id: table.id,
      session_id: randomUUID(),
      status: 'preparing',
      items: [{ name: 'Initial projection item', quantity: 1 }],
      total: 777,
      request_id: randomUUID(),
      discount_breakdown: { shouldNeverReachKitchen: true },
    }).select('id').single()
    if (firstOrderError || !firstOrder) throw firstOrderError ?? new Error('Initial order unavailable')

    const context = { actor: 'kitchen' as const, restaurantId, stationId: 'expo' }
    const board = await readKitchenBoard(context, restaurantId, createKitchenBoardPort())
    assert(board.ok, board.ok ? '' : board.error)
    assert(board.value.orderBatch.snapshot, 'Initial board was not a snapshot')
    assert(board.value.orderBatch.orders.length === 1, 'Initial snapshot did not contain exactly one order')
    assert(board.value.tableLabels[table.id] === 'Projection Table', 'Table label projection was incorrect')

    const firstProjection = board.value.orderBatch.orders[0]
    assert(firstProjection, 'Initial projection missing')
    const projectionKeys = Object.keys(firstProjection).sort()
    const expectedKeys = [
      'active',
      'created_at',
      'customer_tier',
      'id',
      'items',
      'paid_at',
      'status',
      'table_id',
      'updated_at',
    ].sort()
    assert(JSON.stringify(projectionKeys) === JSON.stringify(expectedKeys), 'Projection exposed unexpected fields')

    const { error: terminalError } = await service.from('orders')
      .update({ status: 'served' }).eq('id', firstOrder.id).eq('restaurant_id', restaurantId)
    if (terminalError) throw terminalError
    const { data: secondOrder, error: secondOrderError } = await service.from('orders').insert({
      restaurant_id: restaurantId,
      table_id: table.id,
      session_id: randomUUID(),
      status: 'sent_to_kitchen',
      items: [{ name: 'Delta projection item', quantity: 2 }],
      total: 888,
      request_id: randomUUID(),
    }).select('id').single()
    if (secondOrderError || !secondOrder) throw secondOrderError ?? new Error('Delta order unavailable')

    const delta = await readKitchenOrders(
      context,
      { restaurantId, after: board.value.orderBatch.cursor },
      createKitchenBoardPort(),
    )
    assert(delta.ok, delta.ok ? '' : delta.error)
    assert(!delta.value.snapshot, 'Delta read returned a snapshot')
    assert(delta.value.orders.some((order) => order.id === firstOrder.id && !order.active), 'Terminal tombstone missing')
    assert(delta.value.orders.some((order) => order.id === secondOrder.id && order.active), 'New active order missing')
    const merged = mergeKitchenOrderProjection(board.value.orderBatch.orders, delta.value)
    assert(merged.length === 1 && merged[0]?.id === secondOrder.id, 'Delta merge left a stale card')

    const snapshot = await readKitchenOrders(context, { restaurantId, after: null }, createKitchenBoardPort())
    assert(snapshot.ok, snapshot.ok ? '' : snapshot.error)
    assert(snapshot.value.snapshot, 'Reconciliation read was not a snapshot')
    assert(snapshot.value.orders.length === 1 && snapshot.value.orders[0]?.id === secondOrder.id, 'Snapshot reconciliation was incorrect')

    const anonRpc = await createClient().rpc('read_kitchen_order_projection', {
      p_restaurant_id: restaurantId,
    })
    assert(anonRpc.error?.code === '42501', 'Anon could execute the kitchen projection RPC')

    console.log(JSON.stringify({
      initial: {
        snapshot: board.value.orderBatch.snapshot,
        orderCount: board.value.orderBatch.orders.length,
        fields: projectionKeys,
        sensitiveFieldsExposed: projectionKeys.some((key) => [
          'customer_id', 'total', 'payment_method', 'request_id', 'discount_breakdown', 'settled_by',
        ].includes(key)),
      },
      delta: {
        snapshot: delta.value.snapshot,
        rowCount: delta.value.orders.length,
        tombstone: true,
        inserted: true,
        mergedOrderIds: merged.map((order) => order.id),
      },
      reconciliation: { orderCount: snapshot.value.orders.length },
      access: { anonRpc: anonRpc.error.code },
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (restaurantId) {
    const { error } = await service.from('restaurants').delete().eq('id', restaurantId)
    if (error) throw error
  }
  const marker = restaurantId || randomUUID()
  const [restaurants, orders, tables] = await Promise.all([
    service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', marker),
    service.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('tables').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
  ])
  const cleanup = { restaurants: restaurants.count, orders: orders.count, tables: tables.count }
  console.log(JSON.stringify({ cleanup }))
  assert(Object.values(cleanup).every((count) => count === 0), 'Projection runtime cleanup left orphan rows')
  if (primaryError) throw primaryError
}

void main()
