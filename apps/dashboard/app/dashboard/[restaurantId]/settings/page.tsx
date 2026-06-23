import { notFound, redirect } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries'
import { getUserRestaurantAccess, firstPermittedPath } from '../../../../lib/auth/access'
import { listTeamMembers } from '@garsonless/db'
import { createDashboardServerClient } from '../../../../lib/supabase-server'
import SettingsForm from '../../../../components/settings/SettingsForm'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { restaurantId } = await params
  const supabase = await createDashboardServerClient()
  const [restaurant, { data: { user } }, access] = await Promise.all([
    getRestaurantById(restaurantId),
    supabase.auth.getUser(),
    getUserRestaurantAccess(restaurantId),
  ])
  if (!restaurant || !access) notFound()
  // INTERIM GUARD (Phase 2): a member without 'settings' lands on a permitted section.
  if (!access.isOwner && !access.permissions.includes('settings')) {
    redirect(firstPermittedPath(restaurantId, access))
  }
  const isOwner = access.isOwner
  // Team list is OWNER-ONLY (members never see the team management surface).
  const teamMembers = isOwner ? await listTeamMembers(restaurantId) : []

  // GAP #1: kitchen token now lives in kitchen_credentials (owner-scoped, no anon).
  const { data: kc } = await supabase
    .from('kitchen_credentials')
    .select('token')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  const kitchenToken = (kc as { token: string } | null)?.token ?? null

  // Security activity log — read through the authenticated client so RLS scopes
  // it to the signed-in user's OWN events (user_id = auth.uid()) only.
  const { data: eventRows } = await supabase
    .from('security_events')
    .select('id, event_type, ip, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(20)
  const securityEvents = ((eventRows ?? []) as Array<{
    id: string; event_type: string; ip: string | null; user_agent: string | null; created_at: string
  }>).map(row => ({
    id: row.id,
    eventType: (row.event_type === 'password_change' ? 'password_change' : 'login') as 'login' | 'password_change',
    ip: row.ip,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }))

  return (
    <SettingsForm
      restaurant={restaurant}
      user={user}
      kitchenToken={kitchenToken}
      securityEvents={securityEvents}
      isOwner={isOwner}
      teamMembers={teamMembers}
    />
  )
}
