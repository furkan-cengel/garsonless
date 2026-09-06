'use client'

import { useEffect } from 'react'

/**
 * Settings has several independently-loaded forms.  A small DOM event keeps
 * their successful saves in sync with the shell-level navigation guard without
 * coupling every form to the Settings shell.
 */
export const SETTINGS_SAVED_EVENT = 'settings:save-complete'
export const SETTINGS_DIRTY_EVENT = 'settings:changed'

export interface SettingsDirtyEventDetail {
  source: string
  blocking?: boolean
}

export function notifySettingsDirty(source = 'active-section', blocking = false): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<SettingsDirtyEventDetail>(SETTINGS_DIRTY_EVENT, {
      detail: { source, blocking },
    }))
  }
}

export function notifySettingsSaved(source = 'active-section'): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<SettingsDirtyEventDetail>(SETTINGS_SAVED_EVENT, {
      detail: { source },
    }))
  }
}

/** Registers one independently editable draft with the Settings shell. A save
 * from another form cannot clear it, and returning to the canonical snapshot
 * removes the navigation guard immediately. */
export function useSettingsDirtyState(source: string, dirty: boolean, blocking = false): void {
  useEffect(() => {
    if (dirty) notifySettingsDirty(source, blocking)
    else notifySettingsSaved(source)
    return () => notifySettingsSaved(source)
  }, [dirty, source, blocking])
}

/** An open editor can host the shared navigation confirmation in its own dialog stack. */
export const SETTINGS_CONFIRM_DISCARD_EVENT = 'settings:confirm-discard'
export interface SettingsConfirmDiscardDetail { onDiscard: () => void }
