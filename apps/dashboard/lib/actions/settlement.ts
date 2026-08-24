'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { settleOrder as settleOrderCommand } from '@garsonless/application/orders'
import { closeTableSession as closeTableSessionCommand } from '@garsonless/application/tables'
import {
  canRestaurantUseFeature,
  createSettlementPort,
  createTableSessionPort,
  listTeamMembers,
  readOrdersForSettlement,
  readPaymentSharesForSettlement,
  readSessionSettlementAccessBundle,
  settleSessionAndCloseAtomic,
} from '@garsonless/db/server'
import type { PaymentMethod } from '@garsonless/db/types'
import { assertAccess } from '../auth/access'
import { getDashboardRequestAuth } from '../auth/current-user'
import { resolveTablesCommandActor } from '../auth/tables-command-access'
import { projectSettlementItems, type SettlementLineItem } from '../settlement-items'

// The manual settlement primitive only ever stamps a MANUAL method. 'iyzico' is
// deliberately NOT accepted here — online settlement is stamped solely by the
// İyzico callback (apps/menu/.../payment/callback). The errorMap makes the
// rejection explicit instead of a generic enum message.
const settleSchema = z.object({
  orderId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  method: z.enum(['cash', 'pos', 'comp'], {
    errorMap: () => ({ message: 'Geçersiz tahsilat yöntemi (İyzico yalnızca online ödeme ile işlenir)' }),
  }),
})

const settleSessionSchema = z.object({
  restaurantId: z.string().uuid(),
  sessionId: z.string().uuid(),
  settlements: z.array(z.object({
    orderId: z.string().uuid(),
    method: z.enum(['cash', 'pos', 'comp']),
  })).max(500),
}).superRefine((value, context) => {
  if (new Set(value.settlements.map((entry) => entry.orderId)).size !== value.settlements.length) {
    context.addIssue({ code: 'custom', path: ['settlements'], message: 'Aynı sipariş birden fazla kez tahsil edilemez.' })
  }
})

/**
 * settleOrder — the product's first manual "mark paid" primitive.
 *
 * Gate: owner OR a member with the 'tables' section (assertAccess). A member
 * without 'tables', or any cross-tenant caller, is rejected before any write.
 *
 * Settlement itself is delegated to the order application command, whose
 * Supabase port uses the package-private atomic settlement primitive. It is
 * restaurant-scoped AND guarded by `paid_at IS NULL`: re-settling an already
 * paid order (incl. an İyzico one) affects 0 rows and never overwrites the
 * recorded method (idempotent / no-op). Payment only settles the bill; explicit
 * staff close / idle sweep frees the table.
 */
export async function settleOrder(
  orderId: string,
  restaurantId: string,
  method: 'cash' | 'pos' | 'comp',
): Promise<{ error: string } | { success: true }> {
  const parsed = settleSchema.safeParse({ orderId, restaurantId, method })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz tahsilat' }

  // Gate: owner OR a member with the 'tables' section. A member without
  // 'tables', or a cross-tenant caller, is rejected here before any write.
  const gate = await resolveTablesCommandActor(parsed.data.restaurantId)
  if ('error' in gate) return { error: gate.error }

  // The adapter has already established the section permission. The command
  // receives only a verified actor context, never browser-provided authority.
  const result = await settleOrderCommand(
    {
      actor: 'dashboard-member',
      userId: gate.userId,
      restaurantId: parsed.data.restaurantId,
      permissions: ['tables'],
    },
    parsed.data,
    createSettlementPort(),
  )
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/orders`)
  return { success: true }
}

/** Settles every staged order concurrently and closes the adisyon through one
 * browser-to-server action. Authorization and entitlement are resolved once. */
export async function settleSessionAndClose(input: unknown): Promise<{ error: string } | { success: true }> {
  const startedAt = Date.now()
  const parsed = settleSessionSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz tahsilat' }

  const gate = await resolveTablesCommandActor(parsed.data.restaurantId)
  const authorizedAt = Date.now()
  if ('error' in gate) return { error: 'Bu işlem için yetkiniz yok.' }
  const context = {
    actor: 'dashboard-member' as const,
    userId: gate.userId,
    restaurantId: parsed.data.restaurantId,
    permissions: ['tables'] as const,
  }
  try {
    const fastResult = await settleSessionAndCloseAtomic({
      restaurantId: parsed.data.restaurantId,
      sessionId: parsed.data.sessionId,
      actorUserId: gate.userId,
      settlements: parsed.data.settlements,
    })
    if (fastResult) {
      const persistedAt = Date.now()
      if (fastResult.outcome === 'not_found') return { error: 'Adisyon bulunamadı veya daha önce kapatıldı.' }
      if (fastResult.outcome === 'unpaid') return { error: 'Ödenmemiş sipariş var. Adisyonu yenileyip tüm tahsilat yöntemlerini seçin.' }
      if (fastResult.outcome === 'payment_pending') return { error: 'Bu masa için online ödeme sonucu bekleniyor.' }
      if (!['already_closed', 'closed_normal'].includes(fastResult.outcome)) return { error: 'Adisyon kapatılamadı.' }
      revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
      revalidatePath(`/dashboard/${parsed.data.restaurantId}/orders`)
      console.info(JSON.stringify({
        event: 'tables.settlement_close.timing',
        path: 'atomic',
        authorizationMs: authorizedAt - startedAt,
        persistenceMs: persistedAt - authorizedAt,
        totalMs: Date.now() - startedAt,
      }))
      return { success: true }
    }
  } catch {
    return { error: 'Tahsilat tamamlanamadı. Adisyonu yenileyip tekrar deneyin.' }
  }
  const settlementPort = createSettlementPort()
  const results = await Promise.all(parsed.data.settlements.map((settlement) => settleOrderCommand(
    context,
    { ...settlement, restaurantId: parsed.data.restaurantId },
    settlementPort,
  )))
  const failed = results.find((result) => !result.ok)
  if (failed && !failed.ok) return { error: 'Tahsilat tamamlanamadı. Adisyonu yenileyip tekrar deneyin.' }

  const closeResult = await closeTableSessionCommand(
    context,
    { sessionId: parsed.data.sessionId, restaurantId: parsed.data.restaurantId },
    createTableSessionPort(),
  )
  if (!closeResult.ok) return { error: 'Adisyon kapatılamadı. Lütfen tekrar deneyin.' }
  if (closeResult.value === 'not_found') return { error: 'Adisyon bulunamadı veya daha önce kapatıldı.' }
  if (closeResult.value === 'unpaid') return { error: 'Ödenmemiş sipariş var. Adisyonu yenileyip tüm tahsilat yöntemlerini seçin.' }
  if (closeResult.value === 'payment_pending') return { error: 'Bu masa için online ödeme sonucu bekleniyor.' }
  if (!['already_closed', 'closed_normal'].includes(closeResult.value)) return { error: 'Adisyon kapatılamadı.' }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/orders`)
  console.info(JSON.stringify({
    event: 'tables.settlement_close.timing',
    path: 'fallback',
    authorizationMs: authorizedAt - startedAt,
    totalMs: Date.now() - startedAt,
  }))
  return { success: true }
}

export interface SettlementOrder {
  id: string
  total: number
  status: string
  paidAt: string | null
  paymentMethod: PaymentMethod | null
  settledBy: string | null
  /** Staff email for a settled order — resolved for OWNERS only (audit visibility). */
  settledByLabel: string | null
  createdAt: string
  items: SettlementLineItem[]
}

export interface SettlementShare {
  id: string
  amount: number
  method: 'iyzico' | 'cash' | null
  status: 'declared' | 'settled' | 'void'
  label: string | null
  settledAt: string | null
  settledBy: string | null
  settledByLabel: string | null
  createdAt: string
  providerState: 'none' | 'not_started' | 'checkout_active' | 'verification_required'
}

type OrderRow = {
  id: string
  total: number
  status: string
  paid_at: string | null
  payment_method: string | null
  settled_by: string | null
  created_at: string
  items: unknown
}

type ShareRow = {
  id: string
  amount: number | null
  method: string | null
  status: string
  label: string | null
  settled_at: string | null
  settled_by: string | null
  created_at: string
  checkout_reserved_until?: string | null
  provider_token_attached?: boolean
}

function isPaymentMethod(v: string | null): v is PaymentMethod {
  return v === 'iyzico' || v === 'cash' || v === 'pos' || v === 'comp' || v === 'split'
}

function isShareMethod(v: string | null): 'iyzico' | 'cash' | null {
  return v === 'iyzico' || v === 'cash' ? v : null
}

function isShareStatus(v: string): 'declared' | 'settled' | 'void' {
  return v === 'settled' || v === 'void' ? v : 'declared'
}

function projectSettlement(
  rows: OrderRow[],
  shareRows: ShareRow[],
  labelMap: Map<string, string> | null,
): { orders: SettlementOrder[]; shares: SettlementShare[] } {
  return {
    orders: rows.map((r) => ({
      id: r.id,
      total: Number(r.total),
      status: r.status,
      paidAt: r.paid_at,
      paymentMethod: isPaymentMethod(r.payment_method) ? r.payment_method : null,
      settledBy: r.settled_by,
      settledByLabel: r.settled_by && labelMap ? labelMap.get(r.settled_by) ?? null : null,
      createdAt: r.created_at,
      items: projectSettlementItems(r.items),
    })),
    shares: shareRows.map((r) => ({
      id: r.id,
      amount: Number(r.amount ?? 0),
      method: isShareMethod(r.method),
      status: isShareStatus(r.status),
      label: r.label,
      settledAt: r.settled_at,
      settledBy: r.settled_by,
      settledByLabel: r.settled_by && labelMap ? labelMap.get(r.settled_by) ?? null : null,
      createdAt: r.created_at,
      providerState: r.status !== 'declared' || r.method !== 'iyzico'
        ? 'none' as const
        : r.provider_token_attached !== true
          ? 'not_started' as const
          : r.checkout_reserved_until && Date.parse(r.checkout_reserved_until) > Date.now()
            ? 'checkout_active' as const
            : 'verification_required' as const,
    })),
  }
}

/**
 * The non-cancelled orders of an open adisyon, oldest-first, with each order's
 * settlement state — drives the close-flow settlement sheet (unpaid → method
 * buttons; paid → method badge) and the per-order audit. Gated by 'tables'.
 * settled_by is resolved to a staff email for owners only.
 */
export async function getSessionSettlement(
  sessionId: string,
  restaurantId: string,
): Promise<{ orders: SettlementOrder[]; shares: SettlementShare[] } | { error: string }> {
  const idCheck = z.object({ sessionId: z.string().uuid(), restaurantId: z.string().uuid() })
    .safeParse({ sessionId, restaurantId })
  if (!idCheck.success) return { error: 'Geçersiz oturum' }

  try {
    const signal = AbortSignal.timeout(8_000)
    const { user } = await getDashboardRequestAuth()
    if (!user) return { error: 'Bu işlem için yetkiniz yok.' }
    const bundle = await readSessionSettlementAccessBundle({
      restaurantId,
      sessionId,
      actorUserId: user.id,
    }, signal)
    if (bundle) {
      if (!bundle.authorized) return { error: 'Bu işlem için yetkiniz yok.' }
      const entitled = await canRestaurantUseFeature(
        { restaurantId, plan: bundle.plan, feature: 'table_management' },
        async () => ({ data: bundle.entitlementContext, error: null }),
      )
      if (!entitled) return { error: 'Bu işlem için yetkiniz yok.' }
      const labels = bundle.auditLabelsAllowed
        ? new Map(bundle.staffLabels.map((member) => [member.userId, member.email]))
        : null
      return projectSettlement(bundle.orders as unknown as OrderRow[], bundle.shares as unknown as ShareRow[], labels)
    }

    const gate = await assertAccess(restaurantId, 'tables')
    if ('error' in gate) return { error: gate.error }
    const [data, shareData, members] = await Promise.all([
      readOrdersForSettlement({ restaurantId, sessionId }, signal),
      readPaymentSharesForSettlement({ restaurantId, sessionId }, signal),
      gate.access.isOwner ? listTeamMembers(restaurantId, signal) : Promise.resolve([]),
    ])

    const rows = (data ?? []) as OrderRow[]
    const shareRows = (shareData ?? []) as ShareRow[]

    // settled_by → email map, OWNER-ONLY. Owner and team identities come from
    // the already-authorized access result and the parallel member query.
    const labelMap = gate.access.isOwner ? new Map<string, string>() : null
    if (labelMap) {
      for (const member of members) if (member.userId) labelMap.set(member.userId, member.email)
      if (gate.access.userEmail) labelMap.set(gate.userId, gate.access.userEmail)
    }

    return projectSettlement(rows, shareRows, labelMap)
  } catch {
    return { error: 'Adisyon bilgileri yüklenemedi. Lütfen tekrar deneyin.' }
  }
}
