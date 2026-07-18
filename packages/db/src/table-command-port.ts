import type {
  DashboardTablePort,
  KitchenBoardPort,
  KitchenOrderProjection,
  KitchenOrderProjectionBatch,
  OpenTableSession,
  TableServiceRequestPort,
  TableSessionPort,
} from '@garsonless/application/tables'
import { err, ok, serviceRequestLabel, type Result, type TableSessionCloseOutcome } from '@garsonless/domain'
import { createServiceClient } from './client'
import { dispatchAggregateDomainEvents } from './outbox-consumer-port'
import {
  listActiveTableQrTokens,
  rotateActiveTableQrToken,
} from './table-qr-tokens'

async function softDeleteTable(input: { restaurantId: string; tableId: string }) {
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

async function readRestaurantSlug(restaurantId: string): Promise<string | null> {
  const { data, error } = await createServiceClient().from('restaurants')
    .select('slug').eq('id', restaurantId).is('deleted_at', null).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.slug ?? null
}

async function patchRestaurantQrStyle(restaurantId: string, style: unknown): Promise<Result<null>> {
  const { error } = await createServiceClient().rpc('patch_restaurant_qr_style', {
    p_restaurant_id: restaurantId,
    p_qr_style: style as never,
  })
  return error ? err(error.message) : ok(null)
}

export function createDashboardTablePort(): DashboardTablePort {
  return {
    async createTable(input) {
      const service = createServiceClient()
      const { data: duplicate, error: duplicateError } = await service
        .from('tables')
        .select('id')
        .eq('restaurant_id', input.restaurantId)
        .ilike('label', input.label)
        .is('deleted_at', null)
        .limit(1)
      if (duplicateError) return err(duplicateError.message)
      if ((duplicate ?? []).length > 0) return err('Bu isimde aktif bir masa zaten var.')

      const { data, error } = await service
        .from('tables')
        .insert({ restaurant_id: input.restaurantId, label: input.label })
        .select('id')
        .single()
      if (error) return err(error.code === '23505' ? 'Bu isimde aktif bir masa zaten var.' : error.message)
      if (!data?.id) return err('Failed to create table')

      try {
        const tokens = await listActiveTableQrTokens(input.restaurantId)
        const token = tokens[data.id]
        return token
          ? ok({ id: data.id, token })
          : err('Yeni masa için QR bağlantısı oluşturulamadı.')
      } catch (error_) {
        return err(error_ instanceof Error ? error_.message : 'QR bağlantısı yüklenemedi.')
      }
    },

    async renameTable(input) {
      const service = createServiceClient()
      const { data: duplicate, error: duplicateError } = await service
        .from('tables')
        .select('id')
        .eq('restaurant_id', input.restaurantId)
        .neq('id', input.tableId)
        .ilike('label', input.label)
        .is('deleted_at', null)
        .limit(1)
      if (duplicateError) return err(duplicateError.message)
      if ((duplicate ?? []).length > 0) return err('Bu isimde aktif bir masa zaten var.')

      const { data, error } = await service
        .from('tables')
        .update({ label: input.label, updated_at: new Date().toISOString() })
        .eq('id', input.tableId)
        .eq('restaurant_id', input.restaurantId)
        .is('deleted_at', null)
        .select('id')
      if (error) return err(error.code === '23505' ? 'Bu isimde aktif bir masa zaten var.' : error.message)
      return data && data.length > 0
        ? ok(null)
        : err('Table not found for this restaurant')
    },

    async deleteTable(input) {
      const { data, error } = await softDeleteTable(input)
      if (error) return err(error.message)
      return data === 'deleted' || data === 'open_session'
        ? ok(data)
        : ok('not_found')
    },

    async listQrTokens(restaurantId) {
      try {
        return ok(await listActiveTableQrTokens(restaurantId))
      } catch (error) {
        return err(error instanceof Error ? error.message : 'QR bağlantıları yüklenemedi.')
      }
    },

    async rotateQrToken(input) {
      try {
        return ok(await rotateActiveTableQrToken(input))
      } catch (error) {
        return err(error instanceof Error ? error.message : 'QR kodu döndürülemedi.')
      }
    },

    async readRestaurantSlug(restaurantId) {
      try {
        return ok(await readRestaurantSlug(restaurantId))
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Restaurant could not be loaded')
      }
    },

    async patchQrStyle(input) {
      return patchRestaurantQrStyle(input.restaurantId, input.style)
    },
  }
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
      if (!['not_found', 'unpaid', 'payment_pending', 'already_closed', 'closed_normal', 'closed_abnormal'].includes(data ?? '')) {
        return err('Adisyon kapatılamadı.')
      }

      const outcome = data as TableSessionCloseOutcome
      if (outcome === 'closed_normal') {
        await dispatchAggregateDomainEvents({
          aggregateId: input.sessionId,
          eventTypes: ['table_session.closed'],
        })
      } else if (outcome === 'closed_abnormal') {
        await dispatchAggregateDomainEvents({
          aggregateId: input.sessionId,
          eventTypes: ['table_session.closed'],
        })
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
      const service = createServiceClient()
      const rpc = service.rpc.bind(service) as unknown as (
        fn: 'create_table_service_request_atomic',
        args: { p_restaurant_id: string; p_table_id: string; p_request_type: string },
      ) => Promise<{ data: { throttled?: boolean } | null; error: { message: string } | null }>
      const { data, error } = await rpc('create_table_service_request_atomic', {
        p_restaurant_id: input.restaurantId,
        p_table_id: input.tableId,
        p_request_type: input.requestType,
      })
      return error ? err(error.message) : ok({ throttled: data?.throttled === true })
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

const KITCHEN_ORDER_STATUSES = new Set([
  'pending',
  'pending_approval',
  'sent_to_kitchen',
  'preparing',
  'ready',
  'served',
  'paid',
  'cancelled',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseKitchenOrderBatch(value: unknown): Result<KitchenOrderProjectionBatch> {
  if (!isRecord(value) || typeof value['cursor'] !== 'string' || typeof value['snapshot'] !== 'boolean') {
    return err('Mutfak projection yanıtı geçersiz.')
  }
  const rawOrders = value['orders']
  if (!Array.isArray(rawOrders)) return err('Mutfak projection siparişleri geçersiz.')

  const orders: KitchenOrderProjection[] = []
  for (const raw of rawOrders) {
    if (
      !isRecord(raw)
      || typeof raw['id'] !== 'string'
      || typeof raw['status'] !== 'string'
      || !KITCHEN_ORDER_STATUSES.has(raw['status'])
      || (raw['table_id'] !== null && typeof raw['table_id'] !== 'string')
      || (raw['paid_at'] !== null && typeof raw['paid_at'] !== 'string')
      || typeof raw['created_at'] !== 'string'
      || typeof raw['updated_at'] !== 'string'
      || typeof raw['active'] !== 'boolean'
    ) {
      return err('Mutfak projection satırı geçersiz.')
    }
    orders.push({
      id: raw['id'],
      status: raw['status'] as KitchenOrderProjection['status'],
      table_id: raw['table_id'],
      items: raw['items'],
      customer_tier: raw['customer_tier'],
      paid_at: raw['paid_at'],
      created_at: raw['created_at'],
      updated_at: raw['updated_at'],
      active: raw['active'],
    })
  }
  return ok({ cursor: value['cursor'], snapshot: value['snapshot'], orders })
}

async function readKitchenOrderProjection(input: {
  restaurantId: string
  after: string | null
}): Promise<Result<KitchenOrderProjectionBatch>> {
  const service = createServiceClient()
  const rpc = service.rpc.bind(service) as unknown as (
    fn: 'read_kitchen_order_projection',
    args: { p_restaurant_id: string; p_after: string | null },
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await rpc('read_kitchen_order_projection', {
    p_restaurant_id: input.restaurantId,
    p_after: input.after,
  })
  return error ? err(error.message) : parseKitchenOrderBatch(data)
}

export function createKitchenBoardPort(): KitchenBoardPort {
  return {
    async readBoard(restaurantId) {
      const service = createServiceClient()
      const [restaurantResult, orderBatch, tablesResult, stationsResult] = await Promise.all([
        service.from('restaurants').select('id, name, slug, logo_url').eq('id', restaurantId).is('deleted_at', null).maybeSingle(),
        readKitchenOrderProjection({ restaurantId, after: null }),
        service.from('tables').select('id, label').eq('restaurant_id', restaurantId).is('deleted_at', null),
        service.from('kitchen_stations').select('id, name, color, position')
          .eq('restaurant_id', restaurantId).eq('is_active', true).order('position'),
      ])
      const firstError = restaurantResult.error ?? tablesResult.error ?? stationsResult.error
      if (firstError) return err(firstError.message)
      if (!orderBatch.ok) return orderBatch
      const tableLabels = Object.fromEntries((tablesResult.data ?? []).map((row) => [row.id, row.label]))
      return ok({
        restaurant: restaurantResult.data,
        orderBatch: orderBatch.value,
        tableLabels,
        stations: stationsResult.data ?? [],
      })
    },
    async readOrders(input) {
      return readKitchenOrderProjection(input)
    },
  }
}
