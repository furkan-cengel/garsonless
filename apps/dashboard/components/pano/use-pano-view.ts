'use client'

import { useEffect, useState } from 'react'

export type PanoView = 'business' | 'operations'

/**
 * People who may see revenue open Pano on the business view; everyone else on
 * the shift view. A person with both keeps their last choice on this device.
 */
export function usePanoView(restaurantId: string, canSeeBusiness: boolean) {
  const key = `pano-view:${restaurantId}`
  const [view, setView] = useState<PanoView>(canSeeBusiness ? 'business' : 'operations')

  useEffect(() => {
    if (!canSeeBusiness) return
    try {
      const saved = window.localStorage.getItem(key)
      if (saved === 'business' || saved === 'operations') setView(saved)
    } catch {
      // Storage can be blocked; the default view still works.
    }
  }, [canSeeBusiness, key])

  function choose(next: PanoView) {
    if (next === 'business' && !canSeeBusiness) return
    setView(next)
    try {
      window.localStorage.setItem(key, next)
    } catch {
      // Not remembering the choice is fine.
    }
  }

  return { view: canSeeBusiness ? view : 'operations' as const, choose }
}
