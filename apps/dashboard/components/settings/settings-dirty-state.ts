'use client'

/**
 * Settings has several independently-loaded forms.  A small DOM event keeps
 * their successful saves in sync with the shell-level navigation guard without
 * coupling every form to the Settings shell.
 */
export const SETTINGS_SAVED_EVENT = 'settings:save-complete'
export const SETTINGS_DIRTY_EVENT = 'settings:changed'

export function notifySettingsDirty(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SETTINGS_DIRTY_EVENT))
  }
}

export function notifySettingsSaved(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SETTINGS_SAVED_EVENT))
  }
}
