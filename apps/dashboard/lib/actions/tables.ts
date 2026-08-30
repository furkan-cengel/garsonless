'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  inspectQRStyleSafety,
  QR_COLOR_TYPES,
  QR_DOT_TYPES,
  QR_ERROR_CORRECTION_LEVELS,
  QR_EYE_BALL_TYPES,
  QR_EYE_FRAME_TYPES,
  QR_FRAME_TYPES,
  QR_GRADIENT_TYPES,
} from '@garsonless/application/qr-style'
import {
  closeTableSession as closeTableSessionCommand,
  createDashboardTable,
  deleteDashboardTable,
  listOpenTableSessions,
  listTableTransferHistory,
  moveTableSession,
  readDashboardTableLayout,
  readDashboardTables,
  renameDashboardTable,
  rotateDashboardTableQrToken,
  saveDashboardQrStyle,
  saveDashboardTableLayout,
  transferTableOrders,
  transferTableOrderItems,
  undoTableTransfer,
} from '@garsonless/application/tables'
import { readPanoTableDetail } from '@garsonless/application/read-models'
import {
  createDashboardTablePort,
  createDashboardTablesReadModelPort,
  createPanoTableDetailReadModelPort,
  createTableSessionPort,
  canRestaurantUseFeature,
  readTransferableOrdersAccessBundle,
  readTransferableOrdersForSession,
} from '@garsonless/db/server'
import { readOrderLineSnapshots } from '@garsonless/db/browser'
import type { Tables } from '@garsonless/db/types'
import { assertAccess, assertMember, assertRestaurantFeature, getUserRestaurantAccess } from '../auth/access'
import { getDashboardRequestAuth } from '../auth/current-user'
import { resolveTableQrCommandActor, resolveTablesCommandActor } from '../auth/tables-command-access'
import { projectSettlementItems, type SettlementLineItem } from '../settlement-items'
import { transferActorLabel } from '../table-transfer-actor-label'

const tableLocationSchema = z.preprocess(
  (value) => typeof value === 'string' ? value.trim() || null : null,
  z.string().max(40).nullable(),
)

const createTableSchema = z.object({
  restaurantId: z.string().uuid(),
  label: z.string().trim().min(1).max(50),
  floorLabel: tableLocationSchema,
  areaLabel: tableLocationSchema,
})

const updateTableSchema = z.object({
  restaurantId: z.string().uuid(),
  tableId: z.string().uuid(),
  label: z.string().trim().min(1).max(50),
  floorLabel: tableLocationSchema,
  areaLabel: tableLocationSchema,
})

const deleteTableSchema = z.object({
  restaurantId: z.string().uuid(),
  tableId: z.string().uuid(),
})

const rotateTableQrTokenSchema = z.object({
  restaurantId: z.string().uuid(),
  tableId: z.string().uuid(),
  requestId: z.string().uuid(),
})
const transferBaseSchema = z.object({
  restaurantId: z.string().uuid(), sourceTableId: z.string().uuid(), targetTableId: z.string().uuid(), requestId: z.string().uuid(),
}).refine((value) => value.sourceTableId !== value.targetTableId, 'Kaynak ve hedef masa aynı olamaz.')
const accountTransferSchema = z.object({
  restaurantId: z.string().uuid(), sourceTableId: z.string().uuid(), targetTableId: z.string().uuid(), requestId: z.string().uuid(),
  orderIds: z.array(z.string().uuid()).min(1).max(500),
}).refine((value) => value.sourceTableId !== value.targetTableId, 'Kaynak ve hedef masa aynı olamaz.')
const itemTransferSchema = z.object({
  restaurantId: z.string().uuid(), sourceTableId: z.string().uuid(), targetTableId: z.string().uuid(), requestId: z.string().uuid(),
  selections: z.array(z.object({
    orderId: z.string().uuid(), lineIndex: z.number().int().min(0), quantity: z.number().int().min(1).max(99),
  }).strict()).min(1).max(500),
}).strict().refine((value) => value.sourceTableId !== value.targetTableId, 'Kaynak ve hedef masa aynı olamaz.').superRefine((value, context) => {
  const keys = value.selections.map((selection) => `${selection.orderId}:${selection.lineIndex}`)
  if (new Set(keys).size !== keys.length) context.addIssue({ code: 'custom', path: ['selections'], message: 'Aynı ürün satırı birden fazla kez seçilemez.' })
})

const tableLayoutEntrySchema = z.object({
  tableId: z.string().uuid(),
  xBp: z.number().int().min(0).max(10000),
  yBp: z.number().int().min(0).max(10000),
  shape: z.enum(['square', 'rectangle']),
  rotation: z.union([z.literal(0), z.literal(90)]),
  seatCount: z.number().int().min(1).max(20),
}).strict()

const saveTableLayoutSchema = z.object({
  restaurantId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
  requestId: z.string().uuid(),
  entries: z.array(tableLayoutEntrySchema).min(1).max(500),
}).strict().superRefine((value, context) => {
  if (new Set(value.entries.map((entry) => entry.tableId)).size !== value.entries.length) {
    context.addIssue({ code: 'custom', path: ['entries'], message: 'Aynı masa yerleşimde birden fazla kez bulunamaz.' })
  }
})

const qrStyleSchema = z.object({
  dotsType: z.enum(QR_DOT_TYPES),
  eyeFrame: z.enum(QR_EYE_FRAME_TYPES),
  eyeBall: z.enum(QR_EYE_BALL_TYPES),
  size: z.number().int().min(200).max(1200),
  margin: z.number().int().min(0).max(80),
  ecl: z.enum(QR_ERROR_CORRECTION_LEVELS),
  colorType: z.enum(QR_COLOR_TYPES),
  fg: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fg2: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  gradType: z.enum(QR_GRADIENT_TYPES),
  gradAngle: z.number().int().min(0).max(360),
  bg: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  bgTransparent: z.boolean(),
  // Hard cap: the logo rides inside restaurants.settings, which is read on
  // every dashboard SSR (and the public menu reads the row), so a multi-MB
  // base64 blob would bloat those payloads. The client downscales raster logos
  // to <=256px PNG before upload; this is the server backstop. ~256KB of base64.
  logo: z.string().max(262_144).nullable(),
  logoSize: z.number().min(.1).max(.5),
  logoMargin: z.number().int().min(0).max(80),
  logoHideBg: z.boolean(),
  frame: z.enum(QR_FRAME_TYPES),
  frameTitle: z.string().max(80),
  frameSubtitle: z.string().max(140),
  frameColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  utmSource: z.string().max(80),
  utmMedium: z.string().max(80),
  utmCampaign: z.string().max(120),
  autoLang: z.boolean(),
  countdown: z.boolean(),
  _presetId: z.string().max(60).optional(),
}).strict()

export type TablesActionErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_AUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'READ_FAILED'
  | 'WRITE_FAILED'

export type TablesActionFailure = { error: string; code: TablesActionErrorCode }
export type TablesActionResult<T> = T | TablesActionFailure

function tableActionError(code: TablesActionErrorCode, error: string): TablesActionFailure {
  return { code, error }
}

function tableAuthorizationError(): TablesActionFailure {
  return tableActionError('NOT_AUTHORIZED', 'Bu işlem için yetkiniz yok.')
}

export async function createTable(
  _prev: unknown,
  formData: FormData,
): Promise<TablesActionResult<{ id: string; token: string }>> {
  const parsed = createTableSchema.safeParse({
    restaurantId: formData.get('restaurantId'),
    label: formData.get('label'),
    floorLabel: formData.get('floorLabel'),
    areaLabel: formData.get('areaLabel'),
  })
  if (!parsed.success) return tableActionError('INVALID_INPUT', 'Masa bilgilerini kontrol edip tekrar deneyin.')

  const gate = await resolveTableQrCommandActor(parsed.data.restaurantId)
  if ('error' in gate) return tableAuthorizationError()
  const result = await createDashboardTable(
    { actor: 'dashboard-member', restaurantId: parsed.data.restaurantId, userId: gate.userId, permissions: ['tables'] },
    parsed.data,
    createDashboardTablePort(),
  )
  if (!result.ok) return tableActionError('WRITE_FAILED', 'Masa oluşturulamadı. Lütfen tekrar deneyin.')

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  return { id: result.value.id, token: result.value.token }
}

export async function renameTable(
  input: unknown,
): Promise<TablesActionResult<{ success: true }>> {
  const parsed = updateTableSchema.safeParse(input)
  if (!parsed.success) return tableActionError('INVALID_INPUT', 'Masa bilgilerini kontrol edip tekrar deneyin.')

  const gate = await resolveTableQrCommandActor(parsed.data.restaurantId)
  if ('error' in gate) return tableAuthorizationError()
  const result = await renameDashboardTable(
    { actor: 'dashboard-member', restaurantId: parsed.data.restaurantId, userId: gate.userId, permissions: ['tables'] },
    parsed.data,
    createDashboardTablePort(),
  )
  if (!result.ok) return tableActionError('WRITE_FAILED', 'Masa güncellenemedi. Lütfen tekrar deneyin.')

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  return { success: true }
}

export async function deleteTable(
  input: unknown,
): Promise<TablesActionResult<{ success: true }>> {
  const parsed = deleteTableSchema.safeParse(input)
  if (!parsed.success) return tableActionError('INVALID_INPUT', 'Geçersiz masa bilgisi.')

  const gate = await resolveTableQrCommandActor(parsed.data.restaurantId)
  if ('error' in gate) return tableAuthorizationError()
  const result = await deleteDashboardTable(
    { actor: 'dashboard-member', restaurantId: parsed.data.restaurantId, userId: gate.userId, permissions: ['tables'] },
    parsed.data,
    createDashboardTablePort(),
  )
  if (!result.ok) return tableActionError('WRITE_FAILED', 'Masa silinemedi. Lütfen tekrar deneyin.')
  if (result.value === 'open_session') return tableActionError('CONFLICT', 'Bu masada açık adisyon var. Önce adisyonu kapatın.')
  if (result.value !== 'deleted') return tableActionError('NOT_FOUND', 'Masa bulunamadı veya artık aktif değil.')

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  return { success: true }
}

/** Revoke the current public QR credential and issue a replacement atomically. */
export async function rotateTableQrToken(input: unknown): Promise<TablesActionResult<{ token: string }>> {
  const parsed = rotateTableQrTokenSchema.safeParse(input)
  if (!parsed.success) return tableActionError('INVALID_INPUT', 'Geçersiz QR yenileme isteği.')
  const gate = await resolveTableQrCommandActor(parsed.data.restaurantId)
  if ('error' in gate) return tableAuthorizationError()
  const result = await rotateDashboardTableQrToken(
    { actor: 'dashboard-member', restaurantId: parsed.data.restaurantId, userId: gate.userId, permissions: ['tables'] },
    parsed.data,
    createDashboardTablePort(),
  )
  if (!result.ok) return tableActionError('WRITE_FAILED', 'QR kodu yenilenemedi. Lütfen tekrar deneyin.')
  if (!result.value) return tableActionError('NOT_FOUND', 'Masa bulunamadı veya artık aktif değil.')
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  return { token: result.value }
}

export async function saveQRStyle(
  restaurantId: string,
  style: unknown,
  expectedRevision: number,
): Promise<
  | TablesActionFailure
  | { success: true; revision: number }
  | { conflict: true; revision: number; style: unknown }
> {
  const gate = await resolveTableQrCommandActor(restaurantId)
  if ('error' in gate) return tableAuthorizationError()

  const parsed = qrStyleSchema.safeParse(style)
  if (!parsed.success) return tableActionError('INVALID_INPUT', 'QR stili geçersiz.')
  const safety = inspectQRStyleSafety(parsed.data)
  if (!safety.safe || !safety.style) {
    return tableActionError('INVALID_INPUT', safety.issues[0] ?? 'Bu QR stili güvenli olmadığı için kaydedilmedi.')
  }
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    return tableActionError('INVALID_INPUT', 'Geçersiz QR stil sürümü.')
  }

  const result = await saveDashboardQrStyle(
    { actor: 'dashboard-member', restaurantId, userId: gate.userId, permissions: ['tables'] },
    {
      restaurantId,
      style: safety.style,
      expectedRevision,
    },
    createDashboardTablePort(),
  )
  if (!result.ok) return tableActionError('WRITE_FAILED', 'QR stili kaydedilemedi. Lütfen tekrar deneyin.')

  revalidatePath(`/dashboard/${restaurantId}/tables`)
  return result.value.kind === 'saved'
    ? { success: true, revision: result.value.snapshot.revision }
    : {
        conflict: true,
        revision: result.value.snapshot.revision,
        style: result.value.snapshot.style,
      }
}

export type OpenSessionInfo = import('@garsonless/application/tables').OpenTableSession

interface TableDetailItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  total: number
  modifiers: string[]
  removedIngredients: string[]
  productNote: string | null
}

interface TableDetailOrder {
  id: string
  status: string
  total: number
  paidAt: string | null
  paymentMethod: string | null
  createdAt: string
  items: TableDetailItem[]
}

export interface TableDetail {
  sessionId: string
  openedAt: string
  orders: TableDetailOrder[]
}

export interface TransferableSessionOrder {
  id: string
  total: number
  items: SettlementLineItem[]
  paidAt: string | null
}

const TRANSFER_ORDERS_LOAD_ERROR = 'Adisyon bilgileri yüklenemedi. Lütfen tekrar deneyin.'

/** Minimal read model for account transfer. It deliberately omits payment
 * shares and staff-directory labels used by the settlement sheet. */
export async function getTransferableSessionOrders(
  sessionId: string,
  restaurantId: string,
): Promise<TablesActionResult<TransferableSessionOrder[]>> {
  const ids = z.object({ sessionId: z.string().uuid(), restaurantId: z.string().uuid() })
    .safeParse({ sessionId, restaurantId })
  if (!ids.success) return tableActionError('INVALID_INPUT', 'Geçersiz adisyon bilgisi.')

  try {
    const signal = AbortSignal.timeout(8_000)
    const { user } = await getDashboardRequestAuth()
    if (!user) return tableAuthorizationError()
    const bundle = await readTransferableOrdersAccessBundle({
      restaurantId,
      sessionId,
      actorUserId: user.id,
    }, signal)
    let rows: Array<{ id: string; total: number | null; paid_at: string | null; items: unknown }>
    if (bundle) {
      if (!bundle.authorized) return tableAuthorizationError()
      const entitled = await canRestaurantUseFeature(
        { restaurantId, plan: bundle.plan, feature: 'table_management' },
        async () => ({ data: bundle.entitlementContext, error: null }),
      )
      if (!entitled) return tableAuthorizationError()
      rows = bundle.orders
    } else {
      const gate = await assertAccess(restaurantId, 'tables')
      if ('error' in gate) return tableAuthorizationError()
      rows = await readTransferableOrdersForSession({ restaurantId, sessionId }, signal)
    }
    return (rows as Array<{ id: string; total: number | null; paid_at: string | null; items: unknown }>).map((order) => ({
      id: order.id,
      total: Number(order.total ?? 0),
      paidAt: order.paid_at,
      items: projectSettlementItems(order.items),
    }))
  } catch {
    return tableActionError('READ_FAILED', TRANSFER_ORDERS_LOAD_ERROR)
  }
}

function projectTableDetailItems(orderId: string, value: unknown): TableDetailItem[] {
  return readOrderLineSnapshots(value).map((line, index) => {
    const unitPrice = line.price + line.modifiersPriceDelta
    return {
      id: `${orderId}-${index}`,
      name: line.name,
      quantity: line.quantity,
      unitPrice,
      total: unitPrice * line.quantity,
      modifiers: line.modifiers.map((modifier) => modifier.optionName),
      removedIngredients: line.removedIngredients.map((ingredient) => ingredient.name),
      productNote: line.productNote ?? null,
    }
  })
}

/** Canonical table-detail read shared by Canlı Masalar, Pano and floor overlays. */
export async function fetchTableDetail(
  restaurantId: string,
  tableId: string,
): Promise<TablesActionResult<TableDetail>> {
  const ids = z.object({ restaurantId: z.string().uuid(), tableId: z.string().uuid() })
    .safeParse({ restaurantId, tableId })
  if (!ids.success) return tableActionError('INVALID_INPUT', 'Geçersiz masa bilgisi.')
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return tableAuthorizationError()
  const detail = await readPanoTableDetail(
    { actor: 'dashboard-member', restaurantId, userId: gate.userId, permissions: ['tables'] },
    { restaurantId, tableId },
    createPanoTableDetailReadModelPort(),
  )
  if (!detail.ok) return tableActionError('READ_FAILED', 'Masa ayrıntıları yüklenemedi. Lütfen tekrar deneyin.')

  return {
    sessionId: detail.value.sessionId,
    openedAt: detail.value.openedAt,
    orders: detail.value.orders.map((order) => ({
      id: order.id,
      status: order.status,
      total: order.total,
      paidAt: order.paidAt,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      items: projectTableDetailItems(order.id, order.items),
    })),
  }
}

/** Open sessions with totals for every table of the restaurant. */
export async function getOpenTableSessions(
  restaurantId: string,
): Promise<OpenSessionInfo[] | TablesActionFailure> {
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return tableAuthorizationError()
  const result = await listOpenTableSessions(
    { actor: 'dashboard-member', restaurantId, userId: gate.userId, permissions: ['tables'] },
    restaurantId,
    createTableSessionPort(),
  )
  return result.ok ? result.value : tableActionError('READ_FAILED', 'Canlı masa durumu alınamadı. Lütfen tekrar deneyin.')
}

/** Realtime invalidation target for the tenant-scoped table directory. */
export async function getTableDirectory(
  restaurantId: string,
): Promise<Tables<'tables'>[] | TablesActionFailure> {
  const gate = await resolveTableQrCommandActor(restaurantId)
  if ('error' in gate) return tableAuthorizationError()
  const result = await readDashboardTables(
    { actor: 'dashboard-member', restaurantId, userId: gate.userId, permissions: ['tables'] },
    restaurantId,
    createDashboardTablesReadModelPort(),
  )
  return result.ok ? result.value : tableActionError('READ_FAILED', 'Masa listesi güncellenemedi. Lütfen tekrar deneyin.')
}

export type TableLayoutSnapshot = import('@garsonless/application/tables').TableLayoutSnapshot

export async function getTableLayout(
  restaurantId: string,
): Promise<TableLayoutSnapshot | null | TablesActionFailure> {
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return tableAuthorizationError()
  const result = await readDashboardTableLayout(
    { actor: 'dashboard-member', restaurantId, userId: gate.userId, permissions: ['tables'] },
    restaurantId,
    createDashboardTablePort(),
  )
  return result.ok ? result.value : tableActionError('READ_FAILED', 'Salon yerleşimi yüklenemedi. Lütfen tekrar deneyin.')
}

export async function saveTableLayout(input: unknown): Promise<
  | TablesActionFailure
  | { success: true; idempotent: boolean; snapshot: TableLayoutSnapshot }
  | { conflict: true; snapshot: TableLayoutSnapshot }
> {
  const parsed = saveTableLayoutSchema.safeParse(input)
  if (!parsed.success) return tableActionError('INVALID_INPUT', 'Geçersiz masa yerleşimi.')
  const gate = await assertAccess(parsed.data.restaurantId, 'tables')
  if ('error' in gate) return tableAuthorizationError()
  const result = await saveDashboardTableLayout(
    {
      actor: 'dashboard-member',
      restaurantId: parsed.data.restaurantId,
      userId: gate.userId,
      permissions: ['tables'],
    },
    parsed.data,
    createDashboardTablePort(),
  )
  if (!result.ok) return tableActionError('WRITE_FAILED', 'Salon yerleşimi kaydedilemedi. Lütfen tekrar deneyin.')
  if (result.value.kind === 'conflict') return { conflict: true, snapshot: result.value.snapshot }
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  return { success: true, idempotent: result.value.idempotent, snapshot: result.value.snapshot }
}

type ApplicationTransferHistoryItem = import('@garsonless/application/tables').TableTransferHistoryItem
export type TransferHistoryItem = ApplicationTransferHistoryItem & {
  actorLabel: string
  undoActorLabel: string | null
}

export async function moveTable(input: unknown): Promise<TablesActionResult<{ operationId: string }>> {
  const parsed = transferBaseSchema.safeParse(input)
  if (!parsed.success) return tableActionError('INVALID_INPUT', 'Geçersiz taşıma isteği.')
  const gate = await resolveTablesCommandActor(parsed.data.restaurantId)
  if ('error' in gate) return tableAuthorizationError()
  const result = await moveTableSession(
    { actor: 'dashboard-member', restaurantId: parsed.data.restaurantId, userId: gate.userId, permissions: ['tables'] },
    parsed.data, createTableSessionPort(),
  )
  if (!result.ok) return tableActionError('WRITE_FAILED', 'Masa taşınamadı. Hedef masayı kontrol edip tekrar deneyin.')
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/orders`)
  return { operationId: result.value.operationId }
}

export async function transferOrdersToTable(input: unknown): Promise<TablesActionResult<{ operationId: string }>> {
  const parsed = accountTransferSchema.safeParse(input)
  if (!parsed.success) return tableActionError('INVALID_INPUT', 'Geçersiz hesap taşıma isteği.')
  const gate = await assertAccess(parsed.data.restaurantId, 'orders')
  if ('error' in gate) return tableAuthorizationError()
  const result = await transferTableOrders(
    { actor: 'dashboard-member', restaurantId: parsed.data.restaurantId, userId: gate.userId, permissions: ['orders'] },
    parsed.data, createTableSessionPort(),
  )
  if (!result.ok) return tableActionError('WRITE_FAILED', 'Hesap taşınamadı. Seçimleri kontrol edip tekrar deneyin.')
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/orders`)
  return { operationId: result.value.operationId }
}

export async function transferOrderItemsToTable(input: unknown): Promise<TablesActionResult<{ operationId: string }>> {
  const parsed = itemTransferSchema.safeParse(input)
  if (!parsed.success) return tableActionError('INVALID_INPUT', 'Geçersiz ürün taşıma isteği.')
  const gate = await assertAccess(parsed.data.restaurantId, 'orders')
  if ('error' in gate) return tableAuthorizationError()
  const result = await transferTableOrderItems(
    { actor: 'dashboard-member', restaurantId: parsed.data.restaurantId, userId: gate.userId, permissions: ['orders'] },
    parsed.data, createTableSessionPort(),
  )
  if (!result.ok) return tableActionError('WRITE_FAILED', 'Ürünler taşınamadı. Seçimleri kontrol edip tekrar deneyin.')
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/orders`)
  return { operationId: result.value.operationId }
}

export async function undoTransfer(input: unknown): Promise<TablesActionResult<{ success: true }>> {
  const parsed = z.object({ restaurantId: z.string().uuid(), operationId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return tableActionError('INVALID_INPUT', 'Geçersiz geri alma isteği.')
  const gate = await assertMember(parsed.data.restaurantId)
  if ('error' in gate) return tableAuthorizationError()
  const access = await getUserRestaurantAccess(parsed.data.restaurantId)
  if (!access) return tableAuthorizationError()
  const entitlement = await assertRestaurantFeature(parsed.data.restaurantId, 'table_management')
  if ('error' in entitlement) return tableAuthorizationError()
  const result = await undoTableTransfer(
    { actor: 'dashboard-member', restaurantId: parsed.data.restaurantId, userId: gate.userId, permissions: access.permissions, isOwner: access.isOwner },
    parsed.data, createTableSessionPort(),
  )
  if (!result.ok) return tableActionError('WRITE_FAILED', 'Taşıma geri alınamadı. Lütfen tekrar deneyin.')
  if (result.value.error) return tableActionError('CONFLICT', 'Bu taşıma artık geri alınamıyor. Masa durumlarını yenileyin.')
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/orders`)
  return { success: true }
}

export async function getTransferHistory(restaurantId: string, permission: 'tables' | 'orders' = 'tables'): Promise<TransferHistoryItem[] | TablesActionFailure> {
  const gate = await assertAccess(restaurantId, permission)
  if ('error' in gate) return tableAuthorizationError()
  const result = await listTableTransferHistory(
    { actor: 'dashboard-member', restaurantId, userId: gate.userId, permissions: [permission] }, restaurantId, createTableSessionPort(),
  )
  return result.ok
    ? result.value.map((item) => ({
        ...item,
        actorLabel: transferActorLabel(item.createdBy, gate.userId),
        undoActorLabel: item.undoneBy ? transferActorLabel(item.undoneBy, gate.userId) : null,
      }))
    : tableActionError('READ_FAILED', 'Taşıma geçmişi alınamadı. Lütfen tekrar deneyin.')
}

/**
 * Close the adisyon — P2: NO path closes unpaid money silently.
 *
 *  - Fully paid (no unpaid non-cancelled order) → NORMAL close: closed_at set,
 *    close_reason stays null, +1 visit credited. This is now a fallback: the
 *    common path is the UI settling each order via settleOrder, whose last
 *    settle auto-closes the session (P1).
 *  - Unpaid orders remain + NO abnormalReason → REJECTED. The caller must settle
 *    (settlement sheet) or make an explicit abnormal decision. This is the
 *    money-drop guard.
 *  - Unpaid orders remain + abnormalReason given → ABNORMAL close (walkout/
 *    dispute): closed_at set, close_reason recorded, the unpaid orders STAY
 *    unpaid, and NO visit is credited (no completed paid visit).
 */
export async function closeTableSession(
  sessionId: string,
  restaurantId: string,
  opts?: { abnormalReason?: string },
): Promise<TablesActionResult<{ success: true }>> {
  const startedAt = Date.now()
  const gate = await resolveTablesCommandActor(restaurantId)
  const authorizedAt = Date.now()
  if ('error' in gate) return tableAuthorizationError()
  const result = await closeTableSessionCommand(
    { actor: 'dashboard-member', restaurantId, userId: gate.userId, permissions: ['tables'] },
    { sessionId, restaurantId, abnormalReason: opts?.abnormalReason },
    createTableSessionPort(),
  )
  if (!result.ok) return tableActionError('WRITE_FAILED', 'Adisyon kapatılamadı. Lütfen tekrar deneyin.')
  const outcome = result.value
  if (outcome === 'not_found') return tableActionError('NOT_FOUND', 'Adisyon bulunamadı veya daha önce kapatıldı.')
  if (outcome === 'unpaid') return tableActionError('CONFLICT', 'Ödenmemiş sipariş var — önce tahsil edin ya da bir sebeple anormal kapatın.')
  if (outcome === 'payment_pending') {
    return tableActionError('CONFLICT', 'Bu masa için online ödeme sonucu bekleniyor. Ödeme tamamlanmadan veya mutabakat yapılmadan adisyon kapatılamaz.')
  }
  if (outcome === 'already_closed') return { success: true }
  if (outcome !== 'closed_normal' && outcome !== 'closed_abnormal') return tableActionError('WRITE_FAILED', 'Adisyon kapatılamadı.')

  revalidatePath(`/dashboard/${restaurantId}/tables`)
  console.info(JSON.stringify({
    event: 'tables.close.timing',
    outcome,
    authorizationMs: authorizedAt - startedAt,
    commandMs: Date.now() - authorizedAt,
    totalMs: Date.now() - startedAt,
  }))
  return { success: true }
}

/* QR generation/styling were dashboard server actions that no callers used —
   the Tables/QR builder renders + downloads QR client-side via qr-code-styling
   and persists style through updateSettings. Removed with their QRStyleOptions
   type in the dead-code cleanup. */
