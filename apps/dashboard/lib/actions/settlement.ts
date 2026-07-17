'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { settleOrder as settleOrderCommand } from '@garsonless/application/orders'
import { readOrderLineSnapshots } from '@garsonless/db/browser'
import { createSettlementPort, listTeamMembers, readPaymentSharesForSettlement } from '@garsonless/db/server'
import type { PaymentMethod } from '@garsonless/db'
import { assertAccess, getUserRestaurantAccess } from '../auth/access'
import { createDashboardServerClient } from '../supabase-server'

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
  const gate = await assertAccess(parsed.data.restaurantId, 'tables')
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
  /** Short human-readable line-item summary (e.g. "Türk Kahvesi ×2 · Su"). */
  itemsSummary: string
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

function isPaymentMethod(v: string | null): v is PaymentMethod {
  return v === 'iyzico' || v === 'cash' || v === 'pos' || v === 'comp' || v === 'split'
}

function isShareMethod(v: string | null): 'iyzico' | 'cash' | null {
  return v === 'iyzico' || v === 'cash' ? v : null
}

function isShareStatus(v: string): 'declared' | 'settled' | 'void' {
  return v === 'settled' || v === 'void' ? v : 'declared'
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

  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return { error: gate.error }

  const supabase = await createDashboardServerClient()
  const [{ data }, shareData] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total, status, paid_at, payment_method, settled_by, created_at, items')
      .eq('restaurant_id', restaurantId)
      .eq('table_session_id', sessionId)
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true }),
    readPaymentSharesForSettlement({ restaurantId, sessionId }),
  ])

  const rows = (data ?? []) as OrderRow[]
  const shareRows = (shareData ?? []) as Array<{
    id: string
    amount: number | null
    method: string | null
    status: string
    label: string | null
    settled_at: string | null
    settled_by: string | null
    created_at: string
  }>

  // settled_by → email map, OWNER-ONLY. The caller is the owner when isOwner, so
  // owner-settled rows resolve via the caller; member-settled rows via the team
  // list. System (İyzico) settles have settled_by = null → no label.
  let labelMap: Map<string, string> | null = null
  const access = await getUserRestaurantAccess(restaurantId)
  if (access?.isOwner) {
    labelMap = new Map()
    const members = await listTeamMembers(restaurantId)
    for (const m of members) if (m.userId) labelMap.set(m.userId, m.email)
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id && user.email) labelMap.set(user.id, user.email)
  }

  const orders: SettlementOrder[] = rows.map((r) => ({
    id: r.id,
    total: Number(r.total),
    status: r.status,
    paidAt: r.paid_at,
    paymentMethod: isPaymentMethod(r.payment_method) ? r.payment_method : null,
    settledBy: r.settled_by,
    settledByLabel: r.settled_by && labelMap ? labelMap.get(r.settled_by) ?? null : null,
    createdAt: r.created_at,
    itemsSummary: readOrderLineSnapshots(r.items)
      .map((it) => `${it.name}${it.quantity > 1 ? ` ×${it.quantity}` : ''}`)
      .join(' · '),
  }))

  const shares: SettlementShare[] = shareRows.map((r) => ({
    id: r.id,
    amount: Number(r.amount ?? 0),
    method: isShareMethod(r.method),
    status: isShareStatus(r.status),
    label: r.label,
    settledAt: r.settled_at,
    settledBy: r.settled_by,
    settledByLabel: r.settled_by && labelMap ? labelMap.get(r.settled_by) ?? null : null,
    createdAt: r.created_at,
  }))

  return { orders, shares }
}
