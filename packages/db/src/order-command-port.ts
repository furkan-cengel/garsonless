import type {
  DashboardOrderCreatePort,
  DashboardOrderLifecyclePort,
  KitchenOrderPort,
  PublicOrderPort,
  SettlementPort,
} from '@garsonless/application/orders'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './client'
import { createOrder, resolveOrderLines } from './orders'
import { dispatchAggregateDomainEvents } from './outbox-consumer-port'
import type { Json } from './types.gen'
import { cancelOrderDB, markOrderPaidDB, updateOrderStatusDB } from './orders-update'
import { readOrderLineSnapshots } from './menu-domain'
import { readTenantOrderIngressStatus } from './platform-admin-tenant-operations-port'

/** Supabase implementation of the public-order application port. */
export function createPublicOrderPort(): PublicOrderPort {
  return {
    async resolveRestaurantIdBySlug(slug) {
      const { data, error } = await createServiceClient()
        .from('restaurants')
        .select('id')
        .eq('slug', slug)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) return null
      return (data as { id: string } | null)?.id ?? null
    },
    async consumeRateLimit(input) {
      const service = createServiceClient()
      const rpc = service.rpc.bind(service) as unknown as (
        name: 'consume_public_order_rate_limit',
        args: { p_restaurant_id: string; p_key_hash: string; p_max: number; p_window_seconds: number },
      ) => Promise<{ data: boolean | null; error: { message: string } | null }>
      const { data, error } = await rpc('consume_public_order_rate_limit', {
        p_restaurant_id: input.restaurantId,
        p_key_hash: input.keyHash,
        p_max: input.max,
        p_window_seconds: input.windowSeconds,
      })
      if (error) return err('Sipariş güvenlik kontrolü kullanılamıyor')
      if (data !== true) return err('Çok fazla sipariş denemesi. Lütfen kısa süre sonra tekrar deneyin.')
      return ok(true)
    },
    async readOrderIngressStatus(restaurantId) {
      return readTenantOrderIngressStatus(restaurantId)
    },
    async createOrder(input) {
      const result = await createOrder({
        restaurantId: input.restaurantId,
        tableId: input.tableId,
        sessionId: input.sessionId,
        requestId: input.requestId,
        lines: input.lines,
        customerId: input.customerId,
        redeemPoints: input.redeemPoints,
        redeemStampClaim: input.redeemStampClaim,
        catalogItemId: input.catalogItemId,
      })
      return result.ok
        ? ok({ orderId: result.orderId, breakdown: result.breakdown })
        : err(result.error)
    },
  }
}

/** Supabase implementation for manual and provider settlement commands. */
export function createSettlementPort(): SettlementPort {
  return {
    async settleOrder(input) {
      const result = await markOrderPaidDB(
        input.orderId,
        input.restaurantId,
        input.method,
        input.settledBy,
      )
      return result.error ? err(result.error) : ok(null)
    },
  }
}

/** Supabase adapter for dashboard status/cancellation commands. Raw lifecycle
 * primitives stay package-private and cannot be called from app adapters. */
export function createDashboardOrderLifecyclePort(): DashboardOrderLifecyclePort {
  return {
    async transitionStatus(input) {
      const result = await updateOrderStatusDB(input.orderId, input.status, input.restaurantId)
      return result.error ? err(result.error) : ok(null)
    },
    async readForCancellation(input) {
      const { data, error } = await createServiceClient()
        .from('orders')
        .select('status, paid_at, payment_method')
        .eq('id', input.orderId)
        .eq('restaurant_id', input.restaurantId)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) return err(error.message)
      if (!data) return err('Order not found for this restaurant')
      const row = data as { status: string; paid_at: string | null; payment_method: string | null }
      return ok({
        status: row.status,
        paidAt: row.paid_at,
        paymentMethod: row.payment_method,
      })
    },
    async cancelOrder(input) {
      const result = await cancelOrderDB(input.orderId, input.restaurantId, {
        reason: input.reason,
        cancelledBy: input.cancelledBy,
      })
      return result.error ? err(result.error) : ok(null)
    },
  }
}

/** Service-role repository for staff-entered orders. The action supplies only a
 * verified actor context; price resolution, table ownership and session opening
 * remain inside this infrastructure boundary. */
export function createDashboardOrderPort(): DashboardOrderCreatePort {
  return {
    async readOrderIngressStatus(restaurantId) {
      return readTenantOrderIngressStatus(restaurantId)
    },
    async createOrder(input) {
      const service = createServiceClient()
      const resolved = await resolveOrderLines(input.restaurantId, input.lines)
      if (!resolved.ok) return err(resolved.error)

      let tableSessionId: string | null = null
      if (input.tableId) {
        const { data: table, error: tableError } = await service
          .from('tables')
          .select('id')
          .eq('id', input.tableId)
          .eq('restaurant_id', input.restaurantId)
          .is('deleted_at', null)
          .maybeSingle()
        if (tableError) return err(tableError.message)
        if (!table) return err('Table not found for this restaurant')

        const { data: sessionId, error: sessionError } = await service.rpc('open_or_get_table_session', {
          p_restaurant_id: input.restaurantId,
          p_table_id: input.tableId,
        })
        if (sessionError || !sessionId) return err('Failed to open table session')
        tableSessionId = sessionId as string
      }

      const builder = service.from('orders') as unknown as {
        insert: (row: Record<string, unknown>) => {
          select: (columns: string) => {
            single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>
          }
        }
      }
      const { data, error } = await builder.insert({
        restaurant_id: input.restaurantId,
        table_id: input.tableId,
        table_session_id: tableSessionId,
        items: resolved.snapshots as unknown as Json,
        total: resolved.snapshots.reduce(
          (sum, line) => sum + (line.price + line.modifiersPriceDelta) * line.quantity,
          0,
        ),
        status: 'sent_to_kitchen',
        session_id: input.createdBy,
      }).select('id').single()
      if (error) return err(error.message)
      return data?.id ? ok({ orderId: data.id }) : err('Failed to create order')
    },
  }
}

/** Service-only read model used by the dashboard settlement sheet. */
export async function readPaymentSharesForSettlement(input: {
  restaurantId: string
  sessionId: string
}) {
  const { data, error } = await createServiceClient()
    .from('payment_shares')
    .select('id, amount, method, status, label, settled_at, settled_by, created_at')
    .eq('restaurant_id', input.restaurantId)
    .eq('table_session_id', input.sessionId)
    .neq('status', 'void')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Supabase adapter for KDS commands; application code receives a compact snapshot only. */
export function createKitchenOrderPort(): KitchenOrderPort {
  return {
    async getOrder(input) {
      const { data, error } = await createServiceClient()
        .from('orders')
        .select('id, status, items')
        .eq('id', input.orderId)
        .eq('restaurant_id', input.restaurantId)
        .maybeSingle()
      if (error || !data) return null
      const row = data as { id: string; status: import('@garsonless/domain').OrderStatus; items: unknown }
      return {
        id: row.id,
        status: row.status,
        stationIds: [...new Set(readOrderLineSnapshots(row.items).map((line) => line.station?.id ?? 'unassigned'))],
      }
    },
    async updateStatus(input) {
      const service = createServiceClient()
      const rpc = service.rpc.bind(service) as unknown as (
        fn: 'transition_kitchen_order_atomic',
        args: {
          p_order_id: string
          p_restaurant_id: string
          p_station_id: string
          p_target_status: string
        },
      ) => Promise<{ data: boolean | null; error: { message: string } | null }>
      const { error } = await rpc('transition_kitchen_order_atomic', {
        p_order_id: input.orderId,
        p_restaurant_id: input.restaurantId,
        p_station_id: input.stationId,
        p_target_status: input.status,
      })
      if (error) return err(error.message)
      await dispatchAggregateDomainEvents({
        aggregateId: input.orderId,
        eventTypes: ['order.status_changed'],
      })
      return ok(null)
    },
  }
}
