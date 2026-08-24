'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export function useSettingsRevision(restaurantId: string, hasUnsavedChanges: boolean) {
  const router = useRouter()
  const [hasRemoteRevision, setHasRemoteRevision] = useState(false)
  const dirtyRef = useRef(hasUnsavedChanges)
  dirtyRef.current = hasUnsavedChanges

  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    void import('../../lib/supabase').then(({ createDashboardBrowserClient }) => {
      if (disposed) return
      const client = createDashboardBrowserClient()
      const channel = client
        .channel(`settings-revision:${restaurantId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'restaurant_settings_revisions',
          filter: `restaurant_id=eq.${restaurantId}`,
        }, () => {
          if (dirtyRef.current) setHasRemoteRevision(true)
          else router.refresh()
        })
        .subscribe()
      cleanup = () => { void client.removeChannel(channel) }
    })
    return () => { disposed = true; cleanup() }
  }, [restaurantId, router])

  return {
    hasRemoteRevision,
    clearRemoteRevision: () => setHasRemoteRevision(false),
    refreshFromServer: () => {
      setHasRemoteRevision(false)
      router.refresh()
    },
  }
}
