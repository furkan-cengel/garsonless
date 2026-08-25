import type {
  DashboardOrderCreatePort,
  DashboardOrderLifecyclePort,
  KitchenOrderPort,
  PublicOrderPort,
  SettlementPort,
} from '@garsonless/application/orders'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'
import { createOrder, resolveOrderLines } from './orders'
import { dispatchAggregateDomainEvents } from './outbox-consumer-port'
import type { Json } from './types.gen'
import { cancelOrderDB, markOrderPaidDB, updateOrderStatusDB } from './orders-update'
import { readOrderLineSnapshots } from './menu-domain'
import { readTenantOrderIngressStatus } from './platform-admin-tenant-operations-port'
import { canRestaurantUseFeature } from './feature-entitlement-port'

async function restaurantFeature(restaurantId: string, feature: 'guest_ordering' | 'staff_orders'): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from('restaurants')
    .select('plan')
    .eq('id', restaurantId)
    .is('deleted_at', null)
    .maybeSingle()
  return !error && Boolean(data) && canRestaurantUseFeature({ restaurantId, plan: data?.plan, feature })
}

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
    async canUseGuestOrdering(restaurantId) {
      return restaurantFeature(restaurantId, 'guest_ordering')
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
        couponCode: input.couponCode ?? null,
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
    async cancelPaidManualOrder(input) {
      const service = createServiceClient()
      const call = service.rpc.bind(service) as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
      const { data, error } = await call('cancel_paid_manual_order_with_refund', {
        p_order_id: input.orderId,
        p_restaurant_id: input.restaurantId,
        p_reason: input.reason,
        p_actor_user_id: input.cancelledBy,
      })
      if (error) return err(error.message)
      if (data !== true) return err('Sipariş iptal/iade kaydı tamamlanamadı')
      await dispatchAggregateDomainEvents({ aggregateId: input.orderId, eventTypes: ['order.status_changed'] })
      return ok(null)
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
    async canUseStaffOrders(restaurantId) {
      return restaurantFeature(restaurantId, 'staff_orders')
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
        source: 'staff',
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
}, signal?: AbortSignal) {
  const service = createServiceClient()
  let query = service
    .from('payment_shares')
    .select('id, amount, method, status, label, settled_at, settled_by, created_at, checkout_reserved_until')
    .eq('restaurant_id', input.restaurantId)
    .eq('table_session_id', input.sessionId)
    .neq('status', 'void')
    .order('created_at', { ascending: true })
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const shareIds = rows.map((row) => row.id)
  if (shareIds.length === 0) return []
  const { data: tokens, error: tokenError } = await service
    .from('payment_share_tokens')
    .select('share_id')
    .in('share_id', shareIds)
  if (tokenError) throw new Error(tokenError.message)
  const tokenShares = new Set((tokens ?? []).map((row) => row.share_id))
  return rows.map((row) => ({ ...row, provider_token_attached: tokenShares.has(row.id) }))
}

/** Service-only order projection used after the dashboard settlement gate. */
export async function readOrdersForSettlement(input: {
  restaurantId: string
  sessionId: string
}, signal?: AbortSignal) {
  let query = createServiceClient()
    .from('orders')
    .select('id, total, status, paid_at, payment_method, settled_by, created_at, items')
    .eq('restaurant_id', input.restaurantId)
    .eq('table_session_id', input.sessionId)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Service-only, tenant-scoped read model for the account-transfer picker. */
export async function readTransferableOrdersForSession(input: {
  restaurantId: string
  sessionId: string
}, signal?: AbortSignal) {
  let query = createServiceClient()
    .from('orders')
    .select('id, total, paid_at, items')
    .eq('restaurant_id', input.restaurantId)
    .eq('table_session_id', input.sessionId)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export type TransferableOrdersAccessBundle = {
  authorized: boolean
  plan: unknown
  entitlementContext: unknown
  orders: Array<{ id: string; total: number | null; paid_at: string | null; items: unknown }>
}

export type TablesCommandAccessBundle = {
  authorized: boolean
  auditLabelsAllowed: boolean
  plan: unknown
  entitlementContext: unknown
}

export type SessionSettlementAccessBundle = TablesCommandAccessBundle & {
  orders: Array<Record<string, unknown>>
  shares: Array<Record<string, unknown>>
  staffLabels: Array<{ userId: string; email: string }>
}

export type SettleSessionAndCloseOutcome =
  | 'not_found'
  | 'unpaid'
  | 'payment_pending'
  | 'already_closed'
  | 'closed_normal'
  | 'closed_abnormal'

type ServiceBundleRpcResult = { data: unknown; error: { code?: string; message: string } | null }

function bundleRpcUnavailable(error: { code?: string; message: string }): boolean {
  return error.code === 'PGRST202' || /schema cache|could not find the function/i.test(error.message)
}

function parseTablesCommandAccessBundle(data: unknown): TablesCommandAccessBundle {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid tables access bundle')
  const row = data as Record<string, unknown>
  if (row.authorized !== true) return { authorized: false, auditLabelsAllowed: false, plan: null, entitlementContext: null }
  return {
    authorized: true,
    auditLabelsAllowed: row.auditLabelsAllowed === true,
    plan: row.plan,
    entitlementContext: row.entitlementContext,
  }
}

export async function readTablesCommandAccessBundle(input: {
  restaurantId: string
  actorUserId: string
}, signal?: AbortSignal): Promise<TablesCommandAccessBundle | null> {
  const service = createServiceClient()
  let query = service.rpc('read_tables_command_access_bundle' as never, {
    p_restaurant_id: input.restaurantId,
    p_actor_user_id: input.actorUserId,
  } as never) as unknown as { abortSignal: (value: AbortSignal) => PromiseLike<ServiceBundleRpcResult>; then: PromiseLike<ServiceBundleRpcResult>['then'] }
  if (signal) query = query.abortSignal(signal) as typeof query
  const { data, error } = await query
  if (error) {
    if (bundleRpcUnavailable(error)) return null
    throw new Error(error.message)
  }
  return parseTablesCommandAccessBundle(data)
}

export async function readSessionSettlementAccessBundle(input: {
  restaurantId: string
  sessionId: string
  actorUserId: string
}, signal?: AbortSignal): Promise<SessionSettlementAccessBundle | null> {
  const service = createServiceClient()
  let query = service.rpc('read_session_settlement_bundle' as never, {
    p_restaurant_id: input.restaurantId,
    p_session_id: input.sessionId,
    p_actor_user_id: input.actorUserId,
  } as never) as unknown as { abortSignal: (value: AbortSignal) => PromiseLike<ServiceBundleRpcResult>; then: PromiseLike<ServiceBundleRpcResult>['then'] }
  if (signal) query = query.abortSignal(signal) as typeof query
  const { data, error } = await query
  if (error) {
    if (bundleRpcUnavailable(error)) return null
    throw new Error(error.message)
  }
  const access = parseTablesCommandAccessBundle(data)
  if (!access.authorized) return { ...access, orders: [], shares: [], staffLabels: [] }
  const row = data as Record<string, unknown>
  if (!Array.isArray(row.orders) || !Array.isArray(row.shares) || !Array.isArray(row.staffLabels)) {
    throw new Error('Invalid settlement read bundle')
  }
  const staffLabels = row.staffLabels.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid settlement staff label')
    const label = value as Record<string, unknown>
    if (typeof label.userId !== 'string' || typeof label.email !== 'string') throw new Error('Invalid settlement staff label')
    return { userId: label.userId, email: label.email }
  })
  return {
    ...access,
    orders: row.orders as Array<Record<string, unknown>>,
    shares: row.shares as Array<Record<string, unknown>>,
    staffLabels,
  }
}

/** One database transaction for the staff-critical "collect and close" path.
 * Returns null during rolling deploys where the migration is not installed. */
export async function settleSessionAndCloseAtomic(input: {
  restaurantId: string
  sessionId: string
  actorUserId: string
  settlements: Array<{ orderId: string; method: 'cash' | 'pos' | 'comp' }>
}): Promise<{ outcome: SettleSessionAndCloseOutcome; settledOrderIds: string[] } | null> {
  const service = createServiceClient()
  const { data, error } = await service.rpc('settle_session_and_close_atomic' as never, {
    p_restaurant_id: input.restaurantId,
    p_session_id: input.sessionId,
    p_actor_user_id: input.actorUserId,
    p_settlements: input.settlements.map((entry) => ({ order_id: entry.orderId, method: entry.method })),
  } as never) as unknown as ServiceBundleRpcResult
  if (error) {
    if (bundleRpcUnavailable(error)) return null
    throw new Error(error.message)
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid settlement command result')
  const row = data as Record<string, unknown>
  const outcomes: SettleSessionAndCloseOutcome[] = ['not_found', 'unpaid', 'payment_pending', 'already_closed', 'closed_normal', 'closed_abnormal']
  if (!outcomes.includes(row.outcome as SettleSessionAndCloseOutcome) || !Array.isArray(row.settledOrderIds)) {
    throw new Error('Invalid settlement command result')
  }
  if (!row.settledOrderIds.every((value) => typeof value === 'string')) throw new Error('Invalid settlement command result')
  return { outcome: row.outcome as SettleSessionAndCloseOutcome, settledOrderIds: row.settledOrderIds }
}

/** Service-only fast path that collapses actor access, entitlement context and
 * the tenant/session-scoped order projection into one database round trip.
 * Returns null while a rolling deployment has not installed the RPC yet. */
export async function readTransferableOrdersAccessBundle(input: {
  restaurantId: string
  sessionId: string
  actorUserId: string
}, signal?: AbortSignal): Promise<TransferableOrdersAccessBundle | null> {
  const service = createServiceClient()
  const rpc = service.rpc.bind(service) as unknown as (
    name: 'read_transferable_session_orders_bundle',
    args: { p_restaurant_id: string; p_session_id: string; p_actor_user_id: string },
  ) => {
    abortSignal: (nextSignal: AbortSignal) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>
    then: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>['then']
  }
  let query = rpc('read_transferable_session_orders_bundle', {
    p_restaurant_id: input.restaurantId,
    p_session_id: input.sessionId,
    p_actor_user_id: input.actorUserId,
  })
  if (signal) query = query.abortSignal(signal) as typeof query
  const { data, error } = await query
  if (error) {
    if (error.code === 'PGRST202' || /schema cache|could not find the function/i.test(error.message)) return null
    throw new Error(error.message)
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid transfer read bundle')
  const row = data as Record<string, unknown>
  if (row.authorized !== true) return { authorized: false, plan: null, entitlementContext: null, orders: [] }
  if (!Array.isArray(row.orders)) throw new Error('Invalid transfer order projection')
  return {
    authorized: true,
    plan: row.plan,
    entitlementContext: row.entitlementContext,
    orders: row.orders as TransferableOrdersAccessBundle['orders'],
  }
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
