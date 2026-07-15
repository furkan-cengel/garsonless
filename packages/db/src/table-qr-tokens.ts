import { createServiceClient } from './client'

export interface ActiveTableQrToken {
  restaurantId: string
  restaurantSlug: string
  tableId: string
  tableLabel: string
}

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown
  error: { message: string } | null
}>

function rpc(): Rpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as Rpc
}

/** Resolve an opaque public credential at the server boundary. */
export async function resolveActiveTableQrToken(token: string): Promise<ActiveTableQrToken | null> {
  const { data, error } = await rpc()('resolve_active_table_qr_token', { p_token: token })
  if (error || !Array.isArray(data) || data.length !== 1) return null
  const row = data[0] as Record<string, unknown>
  if (
    typeof row.restaurant_id !== 'string' || typeof row.restaurant_slug !== 'string'
    || typeof row.table_id !== 'string' || typeof row.table_label !== 'string'
  ) return null
  return {
    restaurantId: row.restaurant_id,
    restaurantSlug: row.restaurant_slug,
    tableId: row.table_id,
    tableLabel: row.table_label,
  }
}

/** Dashboard-only read model. The token itself is intentionally never table-readable. */
export async function listActiveTableQrTokens(restaurantId: string): Promise<Record<string, string>> {
  const { data, error } = await rpc()('list_active_table_qr_tokens', { p_restaurant_id: restaurantId })
  if (error) throw new Error(error.message)
  if (!Array.isArray(data)) return {}
  return Object.fromEntries(data.flatMap((value) => {
    const row = value as Record<string, unknown>
    return typeof row.table_id === 'string' && typeof row.token === 'string'
      ? [[row.table_id, row.token]]
      : []
  }))
}

/** Atomically revoke the old public credential and issue a new one. */
export async function rotateActiveTableQrToken(input: {
  restaurantId: string
  tableId: string
  revokedBy: string
  reason?: string
}): Promise<string | null> {
  const { data, error } = await rpc()('rotate_table_qr_token', {
    p_restaurant_id: input.restaurantId,
    p_table_id: input.tableId,
    p_revoked_by: input.revokedBy,
    p_reason: input.reason ?? 'rotated',
  })
  if (error) throw new Error(error.message)
  return typeof data === 'string' ? data : null
}

export interface PublicTableState {
  token: ActiveTableQrToken
  session: { id: string; opened_at: string } | null
  orders: Array<{ id: string; status: string; total: number; paid_at: string | null; created_at: string; items: unknown }>
  shares: Array<{ id: string; amount: number; method: string | null; status: string; label: string | null }>
}

/** Narrow service-side read model for a valid public table credential. */
export async function readPublicTableState(token: string): Promise<PublicTableState | null> {
  const resolved = await resolveActiveTableQrToken(token)
  if (!resolved) return null
  const service = createServiceClient()
  const { data: session, error: sessionError } = await service.from('table_sessions')
    .select('id, opened_at')
    .eq('restaurant_id', resolved.restaurantId)
    .eq('table_id', resolved.tableId)
    .is('closed_at', null)
    .maybeSingle()
  if (sessionError) throw new Error(sessionError.message)
  if (!session) return { token: resolved, session: null, orders: [], shares: [] }

  const [{ data: orders, error: orderError }, { data: shares, error: shareError }] = await Promise.all([
    service.from('orders').select('id, status, total, paid_at, created_at, items')
      .eq('table_session_id', session.id).is('deleted_at', null).order('created_at'),
    service.from('payment_shares').select('id, amount, method, status, label')
      .eq('table_session_id', session.id).neq('status', 'void'),
  ])
  if (orderError) throw new Error(orderError.message)
  if (shareError) throw new Error(shareError.message)
  return {
    token: resolved,
    session,
    orders: (orders ?? []) as PublicTableState['orders'],
    shares: (shares ?? []) as PublicTableState['shares'],
  }
}
