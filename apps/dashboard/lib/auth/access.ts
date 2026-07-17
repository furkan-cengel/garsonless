import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createDashboardServerClient } from '../supabase-server'

// The dashboard nav sections (verbatim from IconRail.tsx). These are the only
// keys a member's `permissions` array may contain. NOT included on purpose:
//   - 'kitchen' → the KDS is a separate app opened through a scoped session exchange
//   - 'loyalty' → an owner-only sub-section inside Settings
export const ALL_SECTIONS = [
  'pano', 'orders', 'menu', 'tables', 'customers', 'analytics', 'theme', 'settings',
] as const
export type Section = (typeof ALL_SECTIONS)[number]

function isSection(value: unknown): value is Section {
  return typeof value === 'string' && (ALL_SECTIONS as readonly string[]).includes(value)
}

export interface RestaurantAccess {
  isOwner: boolean
  isMember: boolean
  /** Owner → all sections. Member → their granted sections. */
  permissions: Section[]
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
): Promise<RestaurantAccess | null> {
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
  if (owned) return { isOwner: true, isMember: false, permissions: [...ALL_SECTIONS] }

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
    const permissions = Array.isArray(raw) ? raw.filter(isSection) : []
    return { isOwner: false, isMember: true, permissions }
  }

  return null
})

/** Section landing order for redirects (matches the IconRail nav order). */
const LANDING_ORDER: Section[] = ['pano', 'orders', 'menu', 'tables', 'customers', 'analytics', 'theme', 'settings']

/**
 * The path a member should land on after login / invite acceptance: the first
 * section they're permitted, in nav order. Owners (or any 'pano' holder) land on
 * the Pano root. Never returns a forbidden section.
 */
export function firstPermittedPath(restaurantId: string, access: RestaurantAccess): string {
  const base = `/dashboard/${restaurantId}`
  if (access.isOwner || access.permissions.includes('pano')) return base
  const section = LANDING_ORDER.find((s) => access.permissions.includes(s))
  if (!section || section === 'pano') return base
  return `${base}/${section}`
}

/**
 * Section gate for server actions. Owner always passes; a member passes only if
 * `section` is in their permissions. Returns the userId on success (same shape
 * as the existing assertOwner helpers so call sites stay uniform).
 */
export async function assertAccess(
  restaurantId: string,
  section: Section,
): Promise<{ userId: string } | { error: string }> {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const access = await getUserRestaurantAccess(restaurantId)
  if (!access) return { error: 'Not authorized' }
  if (!access.isOwner && !access.permissions.includes(section)) return { error: 'Not authorized' }
  return { userId: user.id }
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
): Promise<{ userId: string } | { error: string }> {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const access = await getUserRestaurantAccess(restaurantId)
  if (!access) return { error: 'Not authorized' }
  return { userId: user.id }
}
