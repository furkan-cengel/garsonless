import type { KitchenOrderPort, PublicOrderPort, SettlementPort } from '@garsonless/application/orders'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './client'
import { createOrder } from './orders'
import { markOrderPaidDB, updateOrderStatusDB, validateKitchenToken } from './orders-update'
import { readOrderLineSnapshots } from './menu-domain'

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

/** Records provider reconciliation without exposing a service-role client to a route. */
export async function recordPaymentReconciliation(input: {
  restaurantId?: string | null
  orderId?: string | null
  shareId?: string | null
  providerTokenHash: string
  eventType: 'order_settlement_failed' | 'share_settlement_failed' | 'order_mapping_missing'
  detail?: Record<string, unknown>
}): Promise<void> {
  const service = createServiceClient()
  const table = service.from.bind(service) as unknown as (name: string) => {
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
  }
  const { error } = await table('payment_reconciliation_events').insert({
    restaurant_id: input.restaurantId ?? null,
    order_id: input.orderId ?? null,
    share_id: input.shareId ?? null,
    provider_token_hash: input.providerTokenHash,
    event_type: input.eventType,
    detail: (input.detail ?? {}) as never,
  })
  if (error) console.warn(JSON.stringify({ event: 'payment.callback.reconciliation_record_failed', error: error.message }))
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

export async function verifyKitchenActor(restaurantId: string, token: string): Promise<boolean> {
  return validateKitchenToken(restaurantId, token)
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
      const result = await updateOrderStatusDB(input.orderId, input.status, input.restaurantId)
      return result.error ? err(result.error) : ok(null)
    },
  }
}

export async function readKitchenOrder(input: { orderId: string; restaurantId: string }) {
  const { data, error } = await createServiceClient()
    .from('orders')
    .select('*')
    .eq('id', input.orderId)
    .eq('restaurant_id', input.restaurantId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function listKitchenOrders(restaurantId: string) {
  const { data, error } = await createServiceClient().from('orders').select('*')
    .eq('restaurant_id', restaurantId)
    .in('status', ['pending', 'pending_approval', 'sent_to_kitchen', 'paid', 'preparing', 'ready'])
    .is('deleted_at', null)
    .order('created_at')
  if (error) throw new Error(error.message)
  return data ?? []
}
