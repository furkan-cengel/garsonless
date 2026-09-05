import { createServiceClient } from './service-client'

// Split-payment core primitives (service-role). The customer declare/pay entry
// points (P2 menu routes) and the staff cash-confirm action (dashboard) both land
// here; RLS keeps direct anon/authenticated writes out, so THIS is the only path
// that can settle a share — the cash-authority invariant.

export interface CreateShareInput {
  restaurantId: string
  tableId: string
  tableSessionId: string
  requestId: string
  requestFingerprint: string
  amount: number
  method?: 'iyzico' | 'cash' | null
  customerId?: string | null
  label?: string | null
  assignedItems?: unknown // [{ order_id, itemId }] for item-splits; null for free-amount
}

/** Insert a DECLARED share (never counted until settled). Server-authoritative
 *  amount is the caller's responsibility (P2 clamps card charges to the remaining). */
export async function createShareDB(input: CreateShareInput): Promise<{ shareId: string | null; amount: number | null; error: string | null }> {
  const svc = createServiceClient()
  const rpc = svc.rpc.bind(svc) as unknown as (
    name: 'create_split_share_guarded',
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await rpc('create_split_share_guarded', {
    p_restaurant_id: input.restaurantId,
    p_table_id: input.tableId,
    p_table_session_id: input.tableSessionId,
    p_request_id: input.requestId,
    p_request_fingerprint: input.requestFingerprint,
    p_amount: input.amount,
    p_method: input.method ?? null,
    p_customer_id: input.customerId ?? null,
    p_label: input.label ?? null,
    p_assigned_items: input.assignedItems ?? null,
    p_active_max: 50,
  })
  if (error) return { shareId: null, amount: null, error: error.message }
  const value = data as { shareId?: unknown; amount?: unknown } | null
  return typeof value?.shareId === 'string' && typeof value.amount === 'number'
    ? { shareId: value.shareId, amount: value.amount, error: null }
    : { shareId: null, amount: null, error: 'Pay oluşturma işlemi geçersiz yanıt döndürdü' }
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
