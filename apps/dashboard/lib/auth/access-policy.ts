export const DASHBOARD_SECTIONS = [
  'pano', 'orders', 'menu', 'tables', 'customers', 'analytics', 'inventory', 'theme', 'files', 'settings',
] as const

export type Section = (typeof DASHBOARD_SECTIONS)[number]

const DASHBOARD_SECTION_SET = new Set<string>(DASHBOARD_SECTIONS)
const LANDING_ORDER: Section[] = [...DASHBOARD_SECTIONS]

export interface RestaurantAccessPolicy {
  isOwner: boolean
  isMember?: boolean
  permissions: Section[]
}

export function normalizeDashboardPermissions(value: unknown): Section[] {
  if (!Array.isArray(value)) return []
  return value.filter((permission): permission is Section =>
    typeof permission === 'string' && DASHBOARD_SECTION_SET.has(permission))
}

/** Returns the first route a member is explicitly allowed to use. */
export function firstPermittedPath(restaurantId: string, access: RestaurantAccessPolicy): string {
  const base = `/dashboard/${restaurantId}`
  if (access.isOwner || access.permissions.includes('pano')) return base
  const section = LANDING_ORDER.find((candidate) => access.permissions.includes(candidate))
  if (!section || section === 'pano') return base
  return `${base}/${section}`
}
