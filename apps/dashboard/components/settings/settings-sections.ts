export const SETTINGS_SECTION_IDS = [
  'workspace',
  'profile',
  'team',
  'store',
  'hours',
  'tax',
  'languages',
  'payments',
  'loyalty',
  'kitchen',
  'notifications',
  'api',
  'billing',
  'security',
  'privacy',
] as const

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number]

const SETTINGS_SECTION_SET = new Set<string>(SETTINGS_SECTION_IDS)

const OWNER_ONLY_SETTINGS_SECTIONS = new Set<SettingsSectionId>([
  'workspace',
  'team',
  'payments',
  'loyalty',
  'kitchen',
  'api',
  'billing',
  'privacy',
])

export function isSettingsSectionId(value: unknown): value is SettingsSectionId {
  return typeof value === 'string' && SETTINGS_SECTION_SET.has(value)
}

export function canAccessSettingsSection(section: SettingsSectionId, isOwner: boolean): boolean {
  return isOwner || !OWNER_ONLY_SETTINGS_SECTIONS.has(section)
}

export function defaultSettingsSection(isOwner: boolean): SettingsSectionId {
  return isOwner ? 'workspace' : 'profile'
}

export function resolveSettingsSection(value: unknown, isOwner: boolean): SettingsSectionId {
  if (isSettingsSectionId(value) && canAccessSettingsSection(value, isOwner)) return value
  return defaultSettingsSection(isOwner)
}
