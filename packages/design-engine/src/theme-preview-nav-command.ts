export const THEME_PREVIEW_NAV_CHANNEL = 'garsonless-theme-preview' as const
export const THEME_PREVIEW_NAV_VERSION = 2 as const

export function parseOpenThemeNavDrawerCommand(value: unknown): { sectionId: string | null } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  if (candidate.channel !== THEME_PREVIEW_NAV_CHANNEL || candidate.version !== THEME_PREVIEW_NAV_VERSION || candidate.type !== 'OPEN_NAV_DRAWER') return null
  const sectionId = candidate.sectionId
  if (sectionId !== null && (typeof sectionId !== 'string' || sectionId.length === 0 || sectionId.length > 100)) return null
  return { sectionId }
}
