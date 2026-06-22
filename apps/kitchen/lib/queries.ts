import { createServiceClient, sortOrdersByPriorityThenCreatedAt, type Tables } from '@garsonless/db'

export async function getRestaurantPublic(restaurantId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('restaurants')
    .select('id, name, slug, logo_url')
    .eq('id', restaurantId)
    .single()
  return data
}

export async function getTableLabels(restaurantId: string): Promise<Record<string, string>> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('tables')
    .select('id, label')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
  const map: Record<string, string> = {}
  for (const row of (data ?? []) as Array<{ id: string; label: string }>) {
    map[row.id] = row.label
  }
  return map
}

export async function getOrdersForKitchen(restaurantId: string): Promise<Tables<'orders'>[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .not('status', 'in', '(served,cancelled)')
    .order('created_at', { ascending: true })
  return sortOrdersByPriorityThenCreatedAt((data ?? []) as Tables<'orders'>[])
}
