import { createServiceClient } from './client'

// Split-payment core primitives (service-role). The customer declare/pay entry
// points (P2 menu routes) and the staff cash-confirm action (dashboard) both land
// here; RLS keeps direct anon/authenticated writes out, so THIS is the only path
// that can settle a share — the cash-authority invariant.

export interface CreateShareInput {
  restaurantId: string
  tableSessionId: string
  amount: number
  method?: 'iyzico' | 'cash' | null
  customerId?: string | null
  label?: string | null
  assignedItems?: unknown // [{ order_id, itemId }] for item-splits; null for free-amount
}

/** Insert a DECLARED share (never counted until settled). Server-authoritative
 *  amount is the caller's responsibility (P2 clamps card charges to the remaining). */
export async function createShareDB(input: CreateShareInput): Promise<{ shareId: string | null; error: string | null }> {
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('payment_shares')
    .insert({
      restaurant_id: input.restaurantId,
      table_session_id: input.tableSessionId,
      amount: input.amount,
      method: input.method ?? null,
      customer_id: input.customerId ?? null,
      label: input.label ?? null,
      assigned_items: (input.assignedItems ?? null) as never,
      status: 'declared',
    })
    .select('id')
    .single()
  if (error) return { shareId: null, error: error.message }
  return { shareId: (data as { id: string }).id, error: null }
}

/**
 * Settle a DECLARED share → counts toward covering the bill. Used by BOTH the
 * İyzico callback (card: settledBy null, method already 'iyzico') and the staff
 * cash-confirm (settledBy = staff user). Idempotent: a re-fired callback for an
 * already-settled share transitions 0 rows and never double-counts; finalize is
 * itself atomic/idempotent. Finalize stamps covered orders paid+'split' but does
 * NOT close the table; explicit staff close / idle sweep still frees it. Always
 * runs finalize when the share is settled (robust to a prior partial failure).
 */
export async function settleShareDB(
  shareId: string,
  restaurantId: string,
  opts?: { settledBy?: string | null },
): Promise<{ error: string | null; finalized: boolean }> {
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('payment_shares')
    .update({ status: 'settled', settled_at: new Date().toISOString(), settled_by: opts?.settledBy ?? null })
    .eq('id', shareId)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'declared') // only declared → settled (idempotent guard)
    .select('table_session_id')
  if (error) return { error: error.message, finalized: false }

  let sessionId = (data as Array<{ table_session_id: string }> | null)?.[0]?.table_session_id ?? null
  if (!sessionId) {
    // 0 rows transitioned → already settled (idempotent), void, or not found.
    const { data: existing } = await svc
      .from('payment_shares')
      .select('status, table_session_id')
      .eq('id', shareId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
    const row = existing as { status: string; table_session_id: string } | null
    if (!row) return { error: 'Share not found for this restaurant', finalized: false }
    if (row.status === 'void') return { error: 'Share is void', finalized: false }
    sessionId = row.table_session_id // already 'settled' → fall through to finalize (harmless)
  }

  const { data: finalized } = await svc.rpc('finalize_split_if_covered', { p_session_id: sessionId })
  return { error: null, finalized: finalized === true }
}

/** Void a share BEFORE it settles (customer removes it). Settled shares are real
 *  money and cannot be voided here (refund path, deferred). */
export async function voidShareDB(shareId: string, restaurantId: string): Promise<{ error: string | null }> {
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('payment_shares')
    .update({ status: 'void' })
    .eq('id', shareId)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'declared')
    .select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Only a declared (unsettled) share can be voided' }
  return { error: null }
}

/**
 * Void every DECLARED (unconfirmed) share of a session — called when a session is
 * manually/abnormally closed with money still owed. SETTLED shares are left intact
 * (real collected money). No silent drop: the abnormal close_reason on the session
 * is the audit record; these declared shares were never counted anyway.
 */
export async function voidDeclaredSharesForSession(sessionId: string, restaurantId: string): Promise<{ voided: number; error: string | null }> {
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('payment_shares')
    .update({ status: 'void' })
    .eq('table_session_id', sessionId)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'declared')
    .select('id')
  if (error) return { voided: 0, error: error.message }
  return { voided: (data as Array<{ id: string }> | null)?.length ?? 0, error: null }
}
