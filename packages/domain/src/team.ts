/**
 * The only dashboard sections that an owner may grant to a team member.
 * Ownership itself deliberately is not a grantable role: `restaurants.owner_id`
 * remains the single source of truth for the business owner.
 */
export const TEAM_SECTIONS = [
  'pano', 'orders', 'menu', 'tables', 'customers', 'analytics', 'theme', 'settings',
] as const

export type TeamSection = (typeof TEAM_SECTIONS)[number]

export type TeamMemberStatus = 'invited' | 'active' | 'disabled'

export function sanitizeTeamPermissions(value: unknown): TeamSection[] {
  if (!Array.isArray(value)) return []
  const known = new Set<string>(TEAM_SECTIONS)
  return Array.from(new Set(value.filter((item): item is TeamSection => (
    typeof item === 'string' && known.has(item)
  ))))
}

export function normalizeTeamEmail(value: string): string {
  return value.trim().toLowerCase()
}

/** Deliberately modest validation; email delivery remains the final authority. */
export function isValidTeamEmail(value: string): boolean {
  const email = normalizeTeamEmail(value)
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
