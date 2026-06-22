import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries'
import { createDashboardServerClient } from '../../../../lib/supabase-server'
import SettingsForm from '../../../../components/settings/SettingsForm'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { restaurantId } = await params
  const supabase = await createDashboardServerClient()
  const [restaurant, { data: { user } }] = await Promise.all([
    getRestaurantById(restaurantId),
    supabase.auth.getUser(),
  ])
  if (!restaurant) notFound()

  // GAP #1: kitchen token now lives in kitchen_credentials (owner-scoped, no anon).
  const { data: kc } = await supabase
    .from('kitchen_credentials')
    .select('token')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  const kitchenToken = (kc as { token: string } | null)?.token ?? null

  return <SettingsForm restaurant={restaurant} user={user} kitchenToken={kitchenToken} />
}
