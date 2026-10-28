'use client'

import { useEffect, useState } from 'react'

export type PanoView = 'business' | 'shift' | 'service'

export const PANO_VIEWS: Array<{ value: PanoView; label: string }> = [
  { value: 'business', label: 'İşletme' },
  { value: 'shift', label: 'Vardiya' },
  { value: 'service', label: 'Servis' },
]

export const isPanoView = (value: unknown): value is PanoView => value === 'business' || value === 'shift' || value === 'service'

/**
 * People who may see revenue open Pano on the business view and may switch to
 * the shift (with the till) or service view; everyone else gets the service
 * view, which shows work but no money. A choice is remembered on this device.
 */
export function usePanoView(restaurantId: string, canSeeBusiness: boolean) {
  const key = `pano-view:${restaurantId}`
  const [view, setView] = useState<PanoView>(canSeeBusiness ? 'business' : 'service')

  useEffect(() => {
    if (!canSeeBusiness) return
    try {
      const saved = window.localStorage.getItem(key)
      if (isPanoView(saved)) setView(saved)
    } catch {
      // Storage can be blocked; the default view still works.
    }
  }, [canSeeBusiness, key])

  function choose(next: PanoView) {
    if (!canSeeBusiness) return
    setView(next)
    try {
      window.localStorage.setItem(key, next)
    } catch {
      // Not remembering the choice is fine.
    }
  }

  return { view: canSeeBusiness ? view : 'service' as const, choose }
}
