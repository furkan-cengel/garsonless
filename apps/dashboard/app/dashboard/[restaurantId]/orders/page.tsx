import { notFound } from 'next/navigation'
import { createDashboardServerClient } from '../../../../lib/supabase-server'
import { getRestaurantById, getTablesForRestaurant } from '../../../../lib/queries'
import OrderBoard from '../../../../components/orders/OrderBoard'
import type { Tables } from '@garsonless/db'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function OrdersPage({ params }: Props) {
  const { restaurantId } = await params
  const [restaurant, tables] = await Promise.all([
    getRestaurantById(restaurantId),
    getTablesForRestaurant(restaurantId),
  ])
  if (!restaurant) notFound()

  const supabase = await createDashboardServerClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', today.toISOString())
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(300)

  const initialOrders = (data ?? []) as Tables<'orders'>[]
  // GAP #1: kitchen token now lives in kitchen_credentials (owner-scoped, no anon).
  const { data: kc } = await supabase
    .from('kitchen_credentials')
    .select('token')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  const kitchenToken = (kc as { token: string } | null)?.token ?? null

  return (
    <OrderBoard
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      initialOrders={initialOrders}
      tables={tables as Tables<'tables'>[]}
      kitchenToken={kitchenToken}
    />
  )
}
