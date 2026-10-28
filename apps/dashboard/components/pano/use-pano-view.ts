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
 * The business view needs the analytics section, the shift view (with the
 * till) analytics or the cash section; the service view, work without money,
 * is for everyone. Pano opens on the richest allowed view and remembers a
 * person's own choice on this device.
 */
export function usePanoView(restaurantId: string, allowed: { business: boolean; shift: boolean }) {
  const key = `pano-view:${restaurantId}`
  const views = PANO_VIEWS.map((option) => option.value).filter((value) => value === 'service' || allowed[value])
  const [view, setView] = useState<PanoView>(views[0]!)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key)
      if (isPanoView(saved) && views.includes(saved)) setView(saved)
    } catch {
      // Storage can be blocked; the default view still works.
    }
    // views is derived from the two flags below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed.business, allowed.shift, key])

  function choose(next: PanoView) {
    if (!views.includes(next)) return
    setView(next)
    try {
      window.localStorage.setItem(key, next)
    } catch {
      // Not remembering the choice is fine.
    }
  }

  return { view: views.includes(view) ? view : views[0]!, views, choose }
}
