import { createServiceClient } from './client'
import type { ServiceRequestType } from './service-request-types'

const THROTTLE_MS = 90_000

export interface CreateServiceRequestInput {
  restaurantId: string
  tableId: string
  requestType: ServiceRequestType
}

/**
 * Waiter-call insert (service role). Idempotent UX: if a pending request for
 * this table already exists within the throttle window, returns throttled:true
 * WITHOUT inserting, so the customer still sees success and no duplicate row
 * lands. Attaches the table's open session if one exists.
 */
export async function createServiceRequest(
  input: CreateServiceRequestInput,
): Promise<{ ok: true; throttled: boolean } | { ok: false; error: string }> {
  const supabase = createServiceClient()

  const { data: table } = await supabase
    .from('tables')
    .select('id')
    .eq('id', input.tableId)
    .eq('restaurant_id', input.restaurantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!table) return { ok: false, error: 'Table not found for this restaurant' }

  const since = new Date(Date.now() - THROTTLE_MS).toISOString()
  const { data: existing } = await supabase
    .from('service_requests')
    .select('id')
    .eq('restaurant_id', input.restaurantId)
    .eq('table_id', input.tableId)
    .eq('request_type', input.requestType)
    .eq('status', 'pending')
    .gte('created_at', since)
    .limit(1)
    .maybeSingle()

  if (existing) return { ok: true, throttled: true }

  const { data: session } = await supabase
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', input.restaurantId)
    .eq('table_id', input.tableId)
    .is('closed_at', null)
    .maybeSingle()

  const tableSessionId = (session as { id: string } | null)?.id ?? null

  const builder = supabase.from('service_requests') as unknown as {
    insert: (row: Record<string, unknown>) => Promise<{ error: { code?: string } | null }>
  }
  const { error } = await builder.insert({
    restaurant_id: input.restaurantId,
    table_id: input.tableId,
    table_session_id: tableSessionId,
    request_type: input.requestType,
  })

  // The partial unique index is the concurrency-safe throttle. Two parallel
  // requests may both miss the read above, but only one can insert.
  if (error?.code === '23505') return { ok: true, throttled: true }
  if (error) return { ok: false, error: 'Failed to create service request' }
  return { ok: true, throttled: false }
}
