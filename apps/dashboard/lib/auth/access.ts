import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createDashboardServerClient } from '../supabase-server'
import {
  firstPermittedPath,
  normalizeDashboardPermissions,
  type Section,
} from './access-policy'

export { firstPermittedPath, type Section } from './access-policy'

// The dashboard nav sections (verbatim from IconRail.tsx). These are the only
// keys a member's `permissions` array may contain. NOT included on purpose:
//   - 'kitchen' → the KDS is a separate app opened through a scoped session exchange
//   - 'loyalty' → an owner-only sub-section inside Settings
const ALL_SECTIONS: Section[] = [
  'pano', 'orders', 'menu', 'tables', 'customers', 'analytics', 'theme', 'settings',
]

export interface RestaurantAccess {
  isOwner: boolean
  isMember: boolean
  /** Owner → all sections. Member → their granted sections. */
  permissions: Section[]
}

export interface ResolvedRestaurantAccess extends RestaurantAccess {
  userId: string
  userEmail: string | null
}

/**
 * Single authorization resolver. Returns the caller's access to a restaurant,
 * or null if they have none. Owner is the source of truth (restaurants.owner_id)
 * and is implicit all-perms — NOT a seeded member row.
 *
 * SECURITY: the gate is the EXPLICIT owner_id / active-membership filter below,
 * never the broad `anon_read_restaurants` SELECT policy (which lets any
 * authenticated user read any restaurant row). This is the GAP #4b discipline,
 * extended from owner-only to membership.
 */
export const getUserRestaurantAccess = cache(async function getUserRestaurantAccess(
  restaurantId: string,
): Promise<ResolvedRestaurantAccess | null> {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Owner fast-path — explicit owner_id match (not RLS row-visibility).
  const { data: owned } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (owned) return {
    isOwner: true,
    isMember: false,
    permissions: [...ALL_SECTIONS],
    userId: user.id,
    userEmail: user.email ?? null,
  }

  // Active member — explicit (restaurant_id, user_id, status='active') match.
  const { data: member } = await supabase
    .from('restaurant_members')
    .select('permissions, status')
    .eq('restaurant_id', restaurantId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (member) {
    const raw = (member as { permissions: unknown }).permissions
    const permissions = normalizeDashboardPermissions(raw)
    return {
      isOwner: false,
      isMember: true,
      permissions,
      userId: user.id,
      userEmail: user.email ?? null,
    }
  }

  return null
})

/**
 * Section gate for server actions. Owner always passes; a member passes only if
 * `section` is in their permissions. Returns the userId on success (same shape
 * as the existing assertOwner helpers so call sites stay uniform).
 */
export async function assertAccess(
  restaurantId: string,
  section: Section,
): Promise<{ userId: string; access: ResolvedRestaurantAccess } | { error: string }> {
  const access = await getUserRestaurantAccess(restaurantId)
  if (!access) return { error: 'Not authorized' }
  if (!access.isOwner && !access.permissions.includes(section)) return { error: 'Not authorized' }
  return { userId: access.userId, access }
}

/**
 * Strict OWNER gate — for capabilities that stay owner-only regardless of any
 * member permission: team management, payment_credentials, loyalty config,
 * kitchen token, API keys, billing, workspace identity.
 */
export async function assertOwner(
  restaurantId: string,
): Promise<{ userId: string } | { error: string }> {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!data) return { error: 'Not authorized' }
  return { userId: user.id }
}

/**
 * SSR-page section guard. No access → notFound(); access but missing the section
 * → redirect to the user's first permitted section (never a blank sensitive page,
 * never notFound for a logged-in member). Returns the access for the page to use.
 * MUST be called before any data fetch.
 */
export async function requireSection(restaurantId: string, section: Section): Promise<RestaurantAccess> {
  const access = await getUserRestaurantAccess(restaurantId)
  if (!access) notFound()
  if (!access.isOwner && !access.permissions.includes(section)) {
    redirect(firstPermittedPath(restaurantId, access))
  }
  return access
}

/**
 * Coarse gate — owner OR any active member (no specific section). For surfaces
 * every team member needs regardless of their sections (e.g. the new-order bell).
 */
export async function assertMember(
  restaurantId: string,
): Promise<{ userId: string; access: ResolvedRestaurantAccess } | { error: string }> {
  const access = await getUserRestaurantAccess(restaurantId)
  if (!access) return { error: 'Not authorized' }
  return { userId: access.userId, access }
}
