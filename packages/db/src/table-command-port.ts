import type {
  KitchenBoardPort,
  OpenTableSession,
  TableServiceRequestPort,
  TableSessionPort,
} from '@garsonless/application/tables'
import { err, ok, serviceRequestLabel, type Result, type TableSessionCloseOutcome } from '@garsonless/domain'
import { createServiceClient } from './client'
import { creditVisitsForSession, sortOrdersByPriorityThenCreatedAt } from './loyalty'
import { createServiceRequest } from './service-requests'
import { voidDeclaredSharesForSession } from './split'
import type { Tables } from './types.gen'

export async function softDeleteTable(input: { restaurantId: string; tableId: string }) {
  const service = createServiceClient()
  const rpc = service.rpc.bind(service) as unknown as (
    fn: 'soft_delete_table_atomic',
    args: { p_table_id: string; p_restaurant_id: string },
  ) => Promise<{ data: string | null; error: { message: string } | null }>
  return rpc('soft_delete_table_atomic', {
    p_table_id: input.tableId,
    p_restaurant_id: input.restaurantId,
  })
}

export async function readRestaurantSlug(restaurantId: string): Promise<string | null> {
  const { data, error } = await createServiceClient().from('restaurants')
    .select('slug').eq('id', restaurantId).is('deleted_at', null).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.slug ?? null
}

export async function patchRestaurantQrStyle(restaurantId: string, style: unknown): Promise<Result<null>> {
  const { error } = await createServiceClient().rpc('patch_restaurant_qr_style', {
    p_restaurant_id: restaurantId,
    p_qr_style: style as never,
  })
  return error ? err(error.message) : ok(null)
}

export function createTableSessionPort(): TableSessionPort {
  return {
    async closeSession(input) {
      const service = createServiceClient()
      const rpc = service.rpc.bind(service) as unknown as (
        fn: 'close_table_session_atomic',
        args: { p_session_id: string; p_restaurant_id: string; p_abnormal_reason: string | null },
      ) => Promise<{ data: string | null; error: { message: string } | null }>
      const { data, error } = await rpc('close_table_session_atomic', {
        p_session_id: input.sessionId,
        p_restaurant_id: input.restaurantId,
        p_abnormal_reason: input.abnormalReason,
      })
      if (error) return err(error.message)
      if (!['not_found', 'unpaid', 'already_closed', 'closed_normal', 'closed_abnormal'].includes(data ?? '')) {
        return err('Adisyon kapatılamadı.')
      }

      const outcome = data as TableSessionCloseOutcome
      if (outcome === 'closed_normal') {
        await creditVisitsForSession(input.sessionId)
      } else if (outcome === 'closed_abnormal') {
        const voided = await voidDeclaredSharesForSession(input.sessionId, input.restaurantId)
        if (voided.error) return err(voided.error)
      }
      return ok(outcome)
    },

    async listOpenSessions(restaurantId) {
      const service = createServiceClient()
      const { data: sessions, error: sessionsError } = await service
        .from('table_sessions')
        .select('id, table_id, opened_at')
        .eq('restaurant_id', restaurantId)
        .is('closed_at', null)
      if (sessionsError) return err(`Açık adisyonlar yüklenemedi: ${sessionsError.message}`)
      const sessionRows = (sessions ?? []) as Array<{ id: string; table_id: string; opened_at: string }>
      if (sessionRows.length === 0) return ok([])

      const sessionIds = sessionRows.map((session) => session.id)
      const [{ data: orders, error: ordersError }, { data: shares, error: sharesError }] = await Promise.all([
        service.from('orders')
          .select('table_session_id, total, status, paid_at')
          .in('table_session_id', sessionIds)
          .eq('restaurant_id', restaurantId)
          .is('deleted_at', null),
        service.from('payment_shares')
          .select('table_session_id, amount, method, status')
          .in('table_session_id', sessionIds)
          .eq('restaurant_id', restaurantId)
          .neq('status', 'void'),
      ])
      if (ordersError) return err(`Sipariş toplamları yüklenemedi: ${ordersError.message}`)
      if (sharesError) return err(`Ödeme payları yüklenemedi: ${sharesError.message}`)

      const orderRows = (orders ?? []) as Array<{
        table_session_id: string; total: number; status: string; paid_at: string | null
      }>
      const shareRows = (shares ?? []) as Array<{
        table_session_id: string; amount: number | null; method: string | null; status: string
      }>
      const result: OpenTableSession[] = sessionRows.map((session) => {
        const active = orderRows.filter((order) => order.table_session_id === session.id && order.status !== 'cancelled')
        const sessionShares = shareRows.filter((share) => share.table_session_id === session.id)
        return {
          sessionId: session.id,
          tableId: session.table_id,
          openedAt: session.opened_at,
          total: active.reduce((sum, order) => sum + Number(order.total), 0),
          unpaidTotal: active.filter((order) => order.paid_at === null).reduce((sum, order) => sum + Number(order.total), 0),
          splitSettledTotal: sessionShares.filter((share) => share.status === 'settled').reduce((sum, share) => sum + Number(share.amount ?? 0), 0),
          splitDeclaredCashTotal: sessionShares.filter((share) => share.status === 'declared' && share.method === 'cash').reduce((sum, share) => sum + Number(share.amount ?? 0), 0),
          orderCount: active.length,
          hasUnfinished: active.some((order) => order.status !== 'served'),
        }
      })
      return ok(result)
    },
  }
}

export function createTableServiceRequestPort(): TableServiceRequestPort {
  return {
    async createRequest(input) {
      const result = await createServiceRequest(input)
      return result.ok ? ok({ throttled: result.throttled }) : err(result.error)
    },
    async resolveRequest(input) {
      const { data, error } = await createServiceClient()
        .from('service_requests')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', input.requestId)
        .eq('restaurant_id', input.restaurantId)
        .eq('status', 'pending')
        .select('id')
      if (error) return err(error.message)
      return data && data.length > 0
        ? ok(null)
        : err('İstek bulunamadı veya daha önce tamamlandı.')
    },
    async listPendingRequests(restaurantId) {
      const { data, error } = await createServiceClient()
        .from('service_requests')
        .select('id, table_id, created_at, request_type')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      if (error) return err(error.message)
      return ok(((data ?? []) as Array<{
        id: string; table_id: string; created_at: string; request_type: import('@garsonless/domain').ServiceRequestType
      }>).map((row) => ({
        id: row.id,
        tableId: row.table_id,
        createdAt: row.created_at,
        requestType: row.request_type,
        label: serviceRequestLabel(row.request_type),
      })))
    },
  }
}

type KitchenRestaurant = Pick<Tables<'restaurants'>, 'id' | 'name' | 'slug' | 'logo_url'>
type KitchenStation = Tables<'kitchen_stations'>
type KitchenOrder = Tables<'orders'>

export function createKitchenBoardPort(): KitchenBoardPort<KitchenRestaurant, KitchenOrder, KitchenStation> {
  return {
    async readBoard(restaurantId) {
      const service = createServiceClient()
      const [restaurantResult, ordersResult, tablesResult, stationsResult] = await Promise.all([
        service.from('restaurants').select('id, name, slug, logo_url').eq('id', restaurantId).is('deleted_at', null).maybeSingle(),
        service.from('orders').select('*').eq('restaurant_id', restaurantId)
          .in('status', ['pending', 'pending_approval', 'sent_to_kitchen', 'paid', 'preparing', 'ready'])
          .is('deleted_at', null).order('created_at'),
        service.from('tables').select('id, label').eq('restaurant_id', restaurantId).is('deleted_at', null),
        service.from('kitchen_stations').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('position'),
      ])
      const firstError = restaurantResult.error ?? ordersResult.error ?? tablesResult.error ?? stationsResult.error
      if (firstError) return err(firstError.message)
      const tableLabels = Object.fromEntries((tablesResult.data ?? []).map((row) => [row.id, row.label]))
      return ok({
        restaurant: restaurantResult.data as KitchenRestaurant | null,
        orders: sortOrdersByPriorityThenCreatedAt((ordersResult.data ?? []) as KitchenOrder[]),
        tableLabels,
        stations: (stationsResult.data ?? []) as KitchenStation[],
      })
    },
    async readOrder(input) {
      const { data, error } = await createServiceClient().from('orders').select('*')
        .eq('id', input.orderId).eq('restaurant_id', input.restaurantId).maybeSingle()
      return error ? err(error.message) : ok(data as KitchenOrder | null)
    },
    async listOrders(restaurantId) {
      const { data, error } = await createServiceClient().from('orders').select('*')
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'pending_approval', 'sent_to_kitchen', 'paid', 'preparing', 'ready'])
        .is('deleted_at', null)
        .order('created_at')
      return error
        ? err(error.message)
        : ok(sortOrdersByPriorityThenCreatedAt((data ?? []) as KitchenOrder[]))
    },
  }
}
