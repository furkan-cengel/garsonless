import type {
  AnalyticsReadModelPort,
  OrdersBoardReadModelPort,
  PanoTableDetailReadModelPort,
} from '@garsonless/application/read-models'
import { err, ok } from '@garsonless/domain'
import { createServiceClient } from './client'
import { listTeamMembers } from './team'
import type { Tables } from './types.gen'

export type DashboardOrderReadRow = Pick<Tables<'orders'>,
  | 'id'
  | 'restaurant_id'
  | 'table_id'
  | 'table_session_id'
  | 'status'
  | 'items'
  | 'total'
  | 'discount_breakdown'
  | 'customer_tier'
  | 'paid_at'
  | 'payment_method'
  | 'created_at'
  | 'sent_to_kitchen_at'
  | 'ready_at'
  | 'served_at'
  | 'cancel_reason'
>

const BOARD_ORDER_SELECT = 'id, restaurant_id, table_id, table_session_id, status, items, total, discount_breakdown, customer_tier, paid_at, payment_method, created_at, sent_to_kitchen_at, ready_at, served_at, cancel_reason'

export function createOrdersBoardReadModelPort(): OrdersBoardReadModelPort<DashboardOrderReadRow> {
  return {
    async readBoard({ restaurantId, since, pageSize = 500 }) {
      const service = createServiceClient()
      const orders: DashboardOrderReadRow[] = []

      for (let from = 0; ; from += pageSize) {
        const { data, error } = await service
          .from('orders')
          .select(BOARD_ORDER_SELECT)
          .eq('restaurant_id', restaurantId)
          .gte('created_at', since)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1)
        if (error) return err(`Siparişler yüklenemedi: ${error.message}`)
        const page = (data ?? []) as DashboardOrderReadRow[]
        orders.push(...page)
        if (page.length < pageSize) break
      }

      const { data: liveTables, error: tablesError } = await service
        .from('tables')
        .select('id, label')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
      if (tablesError) return err(`Masa etiketleri yüklenemedi: ${tablesError.message}`)

      const tables = (liveTables ?? []) as Array<{ id: string; label: string }>
      const knownIds = new Set(tables.map((table) => table.id))
      const missingIds = [...new Set(orders
        .map((order) => order.table_id)
        .filter((id): id is string => Boolean(id) && !knownIds.has(id as string)))]

      if (missingIds.length > 0) {
        const { data: deletedTables, error: deletedError } = await service
          .from('tables')
          .select('id, label')
          .eq('restaurant_id', restaurantId)
          .in('id', missingIds)
        if (deletedError) return err(`Eski masa etiketleri yüklenemedi: ${deletedError.message}`)
        tables.push(...((deletedTables ?? []) as Array<{ id: string; label: string }>))
      }

      const { data: credential, error: credentialError } = await service
        .from('kitchen_credentials')
        .select('restaurant_id')
        .eq('restaurant_id', restaurantId)
        .maybeSingle()
      if (credentialError) return err(`Mutfak erişimi yüklenemedi: ${credentialError.message}`)

      return ok({
        orders,
        tables,
        hasKitchenAccess: credential !== null,
      })
    },
  }
}

export function createPanoTableDetailReadModelPort(): PanoTableDetailReadModelPort {
  return {
    async readTableDetail({ restaurantId, tableId }) {
      const service = createServiceClient()
      const { data: session, error: sessionError } = await service
        .from('table_sessions')
        .select('id, opened_at')
        .eq('restaurant_id', restaurantId)
        .eq('table_id', tableId)
        .is('closed_at', null)
        .maybeSingle()
      if (sessionError) return err(sessionError.message)
      if (!session) return err('Bu masada açık adisyon yok.')

      const { data, error } = await service
        .from('orders')
        .select('id, status, total, paid_at, payment_method, created_at, items')
        .eq('restaurant_id', restaurantId)
        .eq('table_session_id', session.id)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true })
      if (error) return err(error.message)

      return ok({
        sessionId: session.id,
        openedAt: session.opened_at,
        orders: ((data ?? []) as Array<{
          id: string
          status: string
          total: number | null
          paid_at: string | null
          payment_method: string | null
          created_at: string
          items: unknown
        }>).map((order) => ({
          id: order.id,
          status: order.status,
          total: Number(order.total ?? 0),
          paidAt: order.paid_at,
          paymentMethod: order.payment_method,
          createdAt: order.created_at,
          items: order.items,
        })),
      })
    },
  }
}

export function createAnalyticsReadModelPort(): AnalyticsReadModelPort {
  return {
    async readPaymentOrders({ restaurantId, since }) {
      const { data, error } = await createServiceClient()
        .from('orders')
        .select('total, payment_method')
        .eq('restaurant_id', restaurantId)
        .not('paid_at', 'is', null)
        .neq('status', 'cancelled')
        .gte('paid_at', since)
        .is('deleted_at', null)
      if (error) return err(error.message)
      return ok(((data ?? []) as Array<{ total: number | null; payment_method: string | null }>).map((row) => ({
        total: row.total,
        paymentMethod: row.payment_method,
      })))
    },

    async readCancellationOrders({ restaurantId, since }) {
      const { data, error } = await createServiceClient()
        .from('orders')
        .select('total, status, items, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', since)
        .is('deleted_at', null)
      if (error) return err(error.message)
      return ok(((data ?? []) as Array<{
        total: number | null; status: string; items: unknown; created_at: string
      }>).map((row) => ({
        total: row.total,
        status: row.status,
        items: row.items,
        createdAt: row.created_at,
      })))
    },

    async readAbnormalCloseData({ restaurantId, since }) {
      const service = createServiceClient()
      const { data: sessionData, error: sessionError } = await service
        .from('table_sessions')
        .select('id, table_id, closed_at, close_reason')
        .eq('restaurant_id', restaurantId)
        .not('close_reason', 'is', null)
        .neq('close_reason', 'auto')
        .not('closed_at', 'is', null)
        .gte('closed_at', since)
      if (sessionError) return err(sessionError.message)
      const sessions = ((sessionData ?? []) as Array<{
        id: string; table_id: string; closed_at: string; close_reason: string
      }>).map((row) => ({
        id: row.id,
        tableId: row.table_id,
        closedAt: row.closed_at,
        closeReason: row.close_reason,
      }))
      if (sessions.length === 0) return ok({ sessions: [], unpaidOrders: [], tableLabels: {} })

      const [{ data: orderData, error: orderError }, { data: tableData, error: tableError }] = await Promise.all([
        service.from('orders')
          .select('table_session_id, total')
          .eq('restaurant_id', restaurantId)
          .in('table_session_id', sessions.map((session) => session.id))
          .is('paid_at', null)
          .neq('status', 'cancelled')
          .is('deleted_at', null),
        service.from('tables')
          .select('id, label')
          .eq('restaurant_id', restaurantId)
          .in('id', [...new Set(sessions.map((session) => session.tableId))]),
      ])
      if (orderError) return err(orderError.message)
      if (tableError) return err(tableError.message)

      return ok({
        sessions,
        unpaidOrders: ((orderData ?? []) as Array<{
          table_session_id: string | null; total: number | null
        }>).map((row) => ({ tableSessionId: row.table_session_id, total: row.total })),
        tableLabels: Object.fromEntries(((tableData ?? []) as Array<{ id: string; label: string }>)
          .map((row) => [row.id, row.label])),
      })
    },

    async readStaffSettlementData({ restaurantId, since }) {
      const service = createServiceClient()
      const [{ data: orderData, error: orderError }, { data: restaurant, error: restaurantError }] = await Promise.all([
        service.from('orders')
          .select('total, payment_method, settled_by')
          .eq('restaurant_id', restaurantId)
          .not('paid_at', 'is', null)
          .neq('status', 'cancelled')
          .gte('paid_at', since)
          .is('deleted_at', null),
        service.from('restaurants').select('owner_id').eq('id', restaurantId).maybeSingle(),
      ])
      if (orderError) return err(orderError.message)
      if (restaurantError) return err(restaurantError.message)

      const ownerId = (restaurant as { owner_id: string } | null)?.owner_id ?? null
      const [members, ownerResult] = await Promise.all([
        listTeamMembers(restaurantId),
        ownerId ? service.auth.admin.getUserById(ownerId) : Promise.resolve(null),
      ])
      if (ownerResult?.error) return err(ownerResult.error.message)

      return ok({
        orders: ((orderData ?? []) as Array<{
          total: number | null; payment_method: string | null; settled_by: string | null
        }>).map((row) => ({
          total: row.total,
          paymentMethod: row.payment_method,
          settledBy: row.settled_by,
        })),
        ownerId,
        ownerEmail: ownerResult?.data.user?.email ?? null,
        members: members.map((member) => ({
          userId: member.userId,
          email: member.email,
          permissions: member.permissions,
        })),
      })
    },

    async readLoyaltyRows({ restaurantId, since }) {
      const { data, error } = await createServiceClient()
        .from('loyalty_transactions')
        .select('type, direction, delta, reason, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', since)
      if (error) return err(error.message)
      return ok(((data ?? []) as Array<{
        type: string; direction: string; delta: number; reason: string
      }>).map((row) => ({
        type: row.type,
        direction: row.direction,
        delta: row.delta,
        reason: row.reason,
      })))
    },
  }
}
