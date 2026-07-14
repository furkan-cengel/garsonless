'use server'

import { revalidatePath } from 'next/cache'
import { createDashboardServerClient } from '../supabase-server'
import { assertAccess } from '../auth/access'
import { createServiceClient, serviceRequestLabel, type ServiceRequestType } from '@garsonless/db'

async function getAuthUser() {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// Waiter calls are handled inside the Tables workspace, so the action follows
// that page's `tables` section gate. The service-role mutation runs only after
// this verified user/tenant authorization boundary.
async function assertRestaurantOwner(
  _supabase: Awaited<ReturnType<typeof createDashboardServerClient>>,
  restaurantId: string,
  _userId: string,
) {
  const gate = await assertAccess(restaurantId, 'tables')
  return !('error' in gate)
}

export interface PendingServiceRequest {
  id: string
  tableId: string
  createdAt: string
  requestType: ServiceRequestType
  label: string
}

export async function getPendingServiceRequests(
  restaurantId: string,
): Promise<PendingServiceRequest[] | { error: string }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const isOwner = await assertRestaurantOwner(supabase, restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const { data } = await supabase
    .from('service_requests')
    .select('id, table_id, created_at, request_type')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return ((data ?? []) as Array<{
    id: string
    table_id: string
    created_at: string
    request_type: ServiceRequestType
  }>).map((row) => ({
    id: row.id,
    tableId: row.table_id,
    createdAt: row.created_at,
    requestType: row.request_type,
    label: serviceRequestLabel(row.request_type),
  }))
}

export async function resolveServiceRequest(
  requestId: string,
  restaurantId: string,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const isOwner = await assertRestaurantOwner(supabase, restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('service_requests')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'pending')
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'İstek bulunamadı veya daha önce tamamlandı.' }

  revalidatePath(`/dashboard/${restaurantId}/tables`)
  return { success: true }
}
