import { randomUUID } from 'node:crypto'
import {
  cancelDashboardOrder,
  transitionDashboardOrder,
} from '@garsonless/application/orders'
import { createServiceClient } from '../src/client'
import { createDashboardOrderLifecyclePort } from '../src/order-command-port'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''

async function insertOrder(input: {
  status: 'pending_approval' | 'served'
  paidAt?: string | null
  paymentMethod?: 'cash' | 'iyzico' | null
}) {
  const id = randomUUID()
  const { error } = await service.from('orders').insert({
    id,
    restaurant_id: restaurantId,
    session_id: randomUUID(),
    items: [],
    total: 0,
    status: input.status,
    paid_at: input.paidAt ?? null,
    payment_method: input.paymentMethod ?? null,
  })
  if (error) throw error
  return id
}

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
        slug: `order-lifecycle-${suffix}`,
        name: `Order lifecycle ${suffix}`,
        settings: {},
      })
      .select('id')
      .single()
    if (restaurantError) throw restaurantError
    restaurantId = restaurant.id

    const actor = {
      actor: 'dashboard-member' as const,
      userId: fixture.owner_id,
      restaurantId,
      permissions: ['orders'],
    }
    const port = createDashboardOrderLifecyclePort()

    const transitionOrderId = await insertOrder({ status: 'pending_approval' })
    const crossTenant = await transitionDashboardOrder(actor, {
      orderId: transitionOrderId,
      restaurantId: randomUUID(),
      status: 'sent_to_kitchen',
    }, port)
    assert(!crossTenant.ok && crossTenant.error === 'Not authorized', 'Cross-tenant transition was not rejected')

    const transitioned = await transitionDashboardOrder(actor, {
      orderId: transitionOrderId,
      restaurantId,
      status: 'sent_to_kitchen',
    }, port)
    assert(transitioned.ok, transitioned.ok ? '' : transitioned.error)
    const { data: transitionedRow } = await service
      .from('orders')
      .select('status')
      .eq('id', transitionOrderId)
      .single()
    assert(transitionedRow?.status === 'sent_to_kitchen', 'Status transition did not persist')

    const cashOrderId = await insertOrder({
      status: 'served',
      paidAt: new Date().toISOString(),
      paymentMethod: 'cash',
    })
    const missingReason = await cancelDashboardOrder(actor, {
      orderId: cashOrderId,
      restaurantId,
    }, port)
    assert(!missingReason.ok && missingReason.error.includes('gerekçe zorunlu'), 'Paid cash reason guard failed')

    const cancelled = await cancelDashboardOrder(actor, {
      orderId: cashOrderId,
      restaurantId,
      reason: '  runtime iade  ',
    }, port)
    assert(cancelled.ok, cancelled.ok ? '' : cancelled.error)
    const retry = await cancelDashboardOrder(actor, {
      orderId: cashOrderId,
      restaurantId,
      reason: 'runtime iade',
    }, port)
    assert(retry.ok, retry.ok ? '' : retry.error)
    const { data: cancelledRow } = await service
      .from('orders')
      .select('status, cancel_reason, cancelled_by')
      .eq('id', cashOrderId)
      .single()
    assert(cancelledRow?.status === 'cancelled', 'Cash order was not cancelled')
    assert(cancelledRow.cancel_reason === 'runtime iade', 'Cancellation reason was not normalized')
    assert(cancelledRow.cancelled_by === fixture.owner_id, 'Cancellation actor was not derived from context')

    const onlineOrderId = await insertOrder({
      status: 'served',
      paidAt: new Date().toISOString(),
      paymentMethod: 'iyzico',
    })
    const onlineCancellation = await cancelDashboardOrder(actor, {
      orderId: onlineOrderId,
      restaurantId,
      reason: 'runtime',
    }, port)
    assert(!onlineCancellation.ok && onlineCancellation.error.includes('İyzico'), 'Online refund guard failed')
    const { data: onlineRow } = await service
      .from('orders')
      .select('status')
      .eq('id', onlineOrderId)
      .single()
    assert(onlineRow?.status === 'served', 'Online-paid order was mutated')

    console.log(JSON.stringify({
      transition: { crossTenant: crossTenant.error, persistedStatus: transitionedRow.status },
      cashCancellation: {
        missingReason: missingReason.error,
        status: cancelledRow.status,
        reason: cancelledRow.cancel_reason,
        cancelledBy: cancelledRow.cancelled_by,
        retry: retry.ok,
      },
      onlineCancellation: { error: onlineCancellation.error, persistedStatus: onlineRow.status },
    }, null, 2))
  } finally {
    if (restaurantId) await service.from('restaurants').delete().eq('id', restaurantId)
    const [{ count: restaurantOrphans }, { count: orderOrphans }] = await Promise.all([
      service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', restaurantId || randomUUID()),
      service.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId || randomUUID()),
    ])
    console.log(JSON.stringify({ cleanup: { restaurantOrphans, orderOrphans } }))
  }
}

void main()
