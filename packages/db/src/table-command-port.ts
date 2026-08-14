import type {
  DashboardTablePort,
  KitchenBoardPort,
  KitchenOrderProjection,
  KitchenOrderProjectionBatch,
  TableLayoutEntry,
  TableLayoutSaveOutcome,
  TableLayoutSnapshot,
  TableServiceRequestPort,
  TableSessionPort,
} from '@garsonless/application/tables'
import { err, ok, serviceRequestLabel, type Result, type TableSessionCloseOutcome } from '@garsonless/domain'
import { createServiceClient } from './client'
import type { Json } from './types.gen'
import { dispatchAggregateDomainEvents } from './outbox-consumer-port'
import {
  listActiveTableQrTokens,
  rotateActiveTableQrToken,
} from './table-qr-tokens'
import {
  aggregateOpenTableSessions,
  type OpenSessionOrderRow,
  type OpenSessionRow,
  type OpenSessionShareRow,
} from './table-session-aggregation'

type TransferRpcValue = {
  operationId: string
  idempotent: boolean
  error?: string
}

function isJsonRecord(value: Json | null | undefined): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseTransferRpcResult(
  data: Json | null,
  error: { message: string } | null,
): Result<TransferRpcValue> {
  if (error) {
    return err(error.message.includes('table_transfer_idempotency_conflict')
      ? 'Bu istek kimliği farklı bir taşıma işlemi için kullanılmış.'
      : error.message)
  }
  if (!isJsonRecord(data) || typeof data['operationId'] !== 'string' || typeof data['idempotent'] !== 'boolean') {
    return err('Taşıma sonucu doğrulanamadı.')
  }
  return ok({
    operationId: data['operationId'],
    idempotent: data['idempotent'],
    ...(typeof data['error'] === 'string' ? { error: data['error'] } : {}),
  })
}

function parseTableLayoutEntry(value: Json | undefined): TableLayoutEntry | null {
  if (!isJsonRecord(value)) return null
  const shape = value['shape']
  const rotation = value['rotation']
  const xBp = value['xBp']
  const yBp = value['yBp']
  const seatCount = value['seatCount']
  if (
    typeof value['tableId'] !== 'string'
    || (xBp !== null && (!Number.isInteger(xBp) || (xBp as number) < 0 || (xBp as number) > 10000))
    || (yBp !== null && (!Number.isInteger(yBp) || (yBp as number) < 0 || (yBp as number) > 10000))
    || (xBp === null) !== (yBp === null)
    || (shape !== 'square' && shape !== 'rectangle')
    || (rotation !== 0 && rotation !== 90)
    || !Number.isInteger(seatCount)
    || (seatCount as number) < 1
    || (seatCount as number) > 20
  ) return null
  return {
    tableId: value['tableId'],
    xBp: xBp as number | null,
    yBp: yBp as number | null,
    shape,
    rotation,
    seatCount: seatCount as number,
  }
}

function parseTableLayoutSnapshot(value: Json | undefined): TableLayoutSnapshot | null {
  if (!isJsonRecord(value) || !Number.isSafeInteger(value['revision'])) return null
  const initializedAt = value['initializedAt']
  if (initializedAt !== null && typeof initializedAt !== 'string') return null
  const rawEntries = value['entries']
  if (!Array.isArray(rawEntries)) return null
  const entries = rawEntries.map(parseTableLayoutEntry)
  if (entries.some((entry) => entry === null)) return null
  return {
    revision: value['revision'] as number,
    initializedAt,
    entries: entries as TableLayoutEntry[],
  }
}

function parseTableLayoutSaveResult(
  data: Json | null,
  error: { message: string } | null,
): Result<TableLayoutSaveOutcome> {
  if (error) {
    if (error.message.includes('table_layout_idempotency_conflict')) {
      return err('Bu istek kimliği farklı bir masa yerleşimi için kullanılmış.')
    }
    if (error.message.includes('table_layout_table_not_found')) {
      return err('Yerleşimdeki masalardan biri artık kullanılamıyor.')
    }
    return err(error.message)
  }
  if (!isJsonRecord(data) || (data['outcome'] !== 'saved' && data['outcome'] !== 'conflict')) {
    return err('Masa yerleşimi sonucu doğrulanamadı.')
  }
  const snapshot = parseTableLayoutSnapshot(data['snapshot'])
  if (!snapshot || typeof data['idempotent'] !== 'boolean') {
    return err('Masa yerleşimi sonucu doğrulanamadı.')
  }
  if (data['outcome'] === 'conflict') {
    return data['idempotent'] === false
      ? ok({ kind: 'conflict', idempotent: false, snapshot })
      : err('Masa yerleşimi çakışma sonucu doğrulanamadı.')
  }
  return ok({ kind: 'saved', idempotent: data['idempotent'], snapshot })
}

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

async function patchRestaurantQrStyle(
  restaurantId: string,
  style: unknown,
  expectedRevision: number,
): ReturnType<DashboardTablePort['patchQrStyle']> {
  const { data, error } = await createServiceClient().rpc('patch_restaurant_qr_style', {
    p_restaurant_id: restaurantId,
    p_qr_style: style as never,
    p_expected_revision: expectedRevision,
  })
  if (error) return err(error.message)
  const row = data?.[0]
  if (!row) return err('QR style update result could not be verified')
  if (row.outcome === 'not_found') return err('Restaurant not found')
  if ((row.outcome !== 'saved' && row.outcome !== 'conflict') || !Number.isSafeInteger(row.revision)) {
    return err('QR style update result could not be verified')
  }
  return ok({
    kind: row.outcome,
    snapshot: { revision: row.revision, style: row.style },
  })
}

export function createDashboardTablePort(): DashboardTablePort {
  return {
    async createTable(input) {
      const service = createServiceClient()
      const { data, error } = await service.rpc('create_located_table', {
        p_restaurant_id: input.restaurantId,
        p_label: input.label,
        p_floor_label: input.floorLabel ?? '',
        p_area_label: input.areaLabel ?? '',
      })
      if (error) return err(error.message)

      const result = data?.[0]
      if (!result) return err('Masa oluşturma sonucu alınamadı.')
      if (result.outcome === 'duplicate_label') return err('Bu isimde aktif bir masa zaten var.')
      if (result.outcome === 'restaurant_not_found') return err('Restaurant not found')
      if (result.outcome === 'invalid_label') return err('Geçerli bir masa adı girin.')
      if (result.outcome === 'invalid_location') return err('Kat ve alan adları en fazla 40 karakter olabilir.')
      if (result.outcome !== 'created' || !result.table_id || !result.token) {
        return err('Yeni masa için QR bağlantısı oluşturulamadı.')
      }
      return ok({ kind: 'created', id: result.table_id, token: result.token })
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
        .update({
          label: input.label,
          floor_label: input.floorLabel ?? null,
          area_label: input.areaLabel ?? null,
          updated_at: new Date().toISOString(),
        })
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
      return patchRestaurantQrStyle(input.restaurantId, input.style, input.expectedRevision)
    },

    async readLayout(restaurantId) {
      const { data, error } = await createServiceClient().rpc('restaurant_table_layout_snapshot', {
        p_restaurant_id: restaurantId,
      })
      if (error) return err(error.message)
      if (data === null) return ok(null)
      const snapshot = parseTableLayoutSnapshot(data)
      return snapshot ? ok(snapshot) : err('Masa yerleşimi doğrulanamadı.')
    },

    async saveLayout(input) {
      const { data, error } = await createServiceClient().rpc('save_restaurant_table_layout', {
        p_restaurant_id: input.restaurantId,
        p_expected_revision: input.expectedRevision,
        p_request_id: input.requestId,
        p_entries: input.entries as unknown as Json,
        p_actor_id: input.actorId,
      })
      return parseTableLayoutSaveResult(data, error)
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
      const sessionRows = (sessions ?? []) as OpenSessionRow[]
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

      return ok(aggregateOpenTableSessions(
        sessionRows,
        (orders ?? []) as OpenSessionOrderRow[],
        (shares ?? []) as OpenSessionShareRow[],
      ))
    },

    async moveSession(input) {
      const { data, error } = await createServiceClient().rpc('move_table_session', {
        p_restaurant_id: input.restaurantId, p_source_table_id: input.sourceTableId,
        p_target_table_id: input.targetTableId, p_actor_id: input.actorId, p_request_id: input.requestId,
      })
      return parseTransferRpcResult(data, error)
    },
    async transferOrders(input) {
      const { data, error } = await createServiceClient().rpc('transfer_table_orders', {
        p_restaurant_id: input.restaurantId, p_source_table_id: input.sourceTableId,
        p_target_table_id: input.targetTableId, p_order_ids: input.orderIds,
        p_actor_id: input.actorId, p_request_id: input.requestId,
      })
      return parseTransferRpcResult(data, error)
    },
    async transferOrderItems(input) {
      const service = createServiceClient()
      const { data, error } = await service.rpc('transfer_table_order_items', {
        p_restaurant_id: input.restaurantId, p_source_table_id: input.sourceTableId,
        p_target_table_id: input.targetTableId, p_selections: input.selections as unknown as Json,
        p_actor_id: input.actorId, p_request_id: input.requestId,
      })
      return parseTransferRpcResult(data, error)
    },
    async readTransferKind(input) {
      const service = createServiceClient()
      const { data, error } = await service.from('table_transfer_operations')
        .select('kind')
        .eq('restaurant_id', input.restaurantId)
        .eq('id', input.operationId)
        .maybeSingle()
      if (error) return err(error.message)
      if (!data) return ok(null)
      if (data.kind !== 'table_move' && data.kind !== 'account_transfer' && data.kind !== 'item_transfer') {
        return err('Taşıma işlemi türü doğrulanamadı.')
      }
      return ok(data.kind)
    },
    async undoTransfer(input) {
      const { data, error } = await createServiceClient().rpc('undo_table_transfer', {
        p_restaurant_id: input.restaurantId, p_operation_id: input.operationId, p_actor_id: input.actorId,
      })
      return parseTransferRpcResult(data, error)
    },
    async listTransferHistory(restaurantId) {
      const service = createServiceClient()
      const { data, error } = await service.rpc('list_table_transfer_history', { p_restaurant_id: restaurantId, p_limit: 50 })
      if (error) return err(error.message)
      try {
        return ok((data ?? []).map((row) => {
          if (row.kind !== 'table_move' && row.kind !== 'account_transfer' && row.kind !== 'item_transfer') throw new Error('invalid transfer kind')
          if (row.status !== 'active' && row.status !== 'undone' && row.status !== 'locked') throw new Error('invalid transfer status')
          return {
            id: row.id, kind: row.kind,
            sourceTableId: row.source_table_id, targetTableId: row.target_table_id,
            sourceSessionId: row.source_session_id, targetSessionId: row.target_session_id,
            status: row.status, requestId: row.request_id,
            sourceSessionClosed: row.source_session_closed,
            targetSessionCreated: row.target_session_created,
            createdBy: row.created_by, createdAt: row.created_at,
            undoneBy: row.undone_by ?? null, undoneAt: row.undone_at ?? null,
            lockReason: row.lock_reason ?? null, orderCount: row.order_count,
          }
        }))
      } catch { return err('Taşıma geçmişi doğrulanamadı.') }
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
