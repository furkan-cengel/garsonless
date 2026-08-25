import { createServiceClient } from './service-client'

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
