'use server'

import { revalidatePath } from 'next/cache'
import { createDashboardServerClient } from '../supabase-server'
import { mut } from '../supabase-mut'

async function getAuthUser() {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

async function assertRestaurantOwner(
  supabase: Awaited<ReturnType<typeof createDashboardServerClient>>,
  restaurantId: string,
  userId: string,
) {
  const { data } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .single()
  return !!data
}

export interface PendingServiceRequest {
  id: string
  tableId: string
  createdAt: string
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
    .select('id, table_id, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return ((data ?? []) as Array<{ id: string; table_id: string; created_at: string }>).map((row) => ({
    id: row.id,
    tableId: row.table_id,
    createdAt: row.created_at,
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

  const { error } = await mut(supabase, 'service_requests')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${restaurantId}/tables`)
  return { success: true }
}
