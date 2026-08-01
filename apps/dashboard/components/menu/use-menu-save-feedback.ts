'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getMenuSaveState } from './menu-save-state-model'

export function useMenuSaveFeedback({
  dirty,
  saving,
  durationMs = 2400,
}: {
  dirty: boolean
  saving: boolean
  durationMs?: number
}) {
  const [recentlySaved, setRecentlySaved] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSavedFeedback = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setRecentlySaved(false)
  }, [])

  const markSaved = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setRecentlySaved(true)
    timerRef.current = setTimeout(() => {
      setRecentlySaved(false)
      timerRef.current = null
    }, durationMs)
  }, [durationMs])

  useEffect(() => {
    if (dirty) clearSavedFeedback()
  }, [clearSavedFeedback, dirty])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return {
    markSaved,
    state: getMenuSaveState({ dirty, saving, recentlySaved }),
  }
}
