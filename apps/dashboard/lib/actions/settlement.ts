'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { markOrderPaidDB, listTeamMembers } from '@garsonless/db'
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
 * Settlement itself is delegated to the P1 markOrderPaidDB, which is
 * restaurant-scoped AND guarded by `paid_at IS NULL`: re-settling an already
 * paid order (incl. an İyzico one) affects 0 rows and never overwrites the
 * recorded method (idempotent / no-op). The P1 auto-close fires inside — if this
 * was the session's last unpaid order, the table closes + visits are credited.
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

  // settled_by = the staff user who collected (audit). markOrderPaidDB's
  // restaurant scoping means even if a foreign orderId is passed, the
  // `eq(restaurant_id)` won't match → "Order not found for this restaurant".
  const { error } = await markOrderPaidDB(
    parsed.data.orderId,
    parsed.data.restaurantId,
    parsed.data.method,
    gate.userId,
  )
  if (error) return { error }

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
}

type OrderRow = {
  id: string
  total: number
  status: string
  paid_at: string | null
  payment_method: string | null
  settled_by: string | null
  created_at: string
}

function isPaymentMethod(v: string | null): v is PaymentMethod {
  return v === 'iyzico' || v === 'cash' || v === 'pos' || v === 'comp'
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
): Promise<{ orders: SettlementOrder[] } | { error: string }> {
  const idCheck = z.object({ sessionId: z.string().uuid(), restaurantId: z.string().uuid() })
    .safeParse({ sessionId, restaurantId })
  if (!idCheck.success) return { error: 'Geçersiz oturum' }

  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return { error: gate.error }

  const supabase = await createDashboardServerClient()
  const { data } = await supabase
    .from('orders')
    .select('id, total, status, paid_at, payment_method, settled_by, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('table_session_id', sessionId)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })

  const rows = (data ?? []) as OrderRow[]

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
  }))

  return { orders }
}
