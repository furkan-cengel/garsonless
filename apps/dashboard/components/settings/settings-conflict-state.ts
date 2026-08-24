'use client'

export const SETTINGS_CONFLICT_EVENT = 'settings:conflict'

export interface SettingsConflictEventDetail {
  source: string
  canonicalSettings: Record<string, unknown>
  draft: Record<string, unknown>
  prepareReapply: () => void
}

export function notifySettingsConflict(detail: SettingsConflictEventDetail): void {
  window.dispatchEvent(new CustomEvent<SettingsConflictEventDetail>(SETTINGS_CONFLICT_EVENT, { detail }))
}
