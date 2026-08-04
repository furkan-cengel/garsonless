'use client'

import { useEffect } from 'react'
import { fetchCustomerSession, subscribeToCustomerSession } from '../customer-auth-client'

export default function CustomerSessionSynchronizer({ authenticated }: { authenticated: boolean }) {
  useEffect(() => {
    let active = true
    const reconcile = async () => {
      const session = await fetchCustomerSession()
      if (active && session && session.authenticated !== authenticated) window.location.reload()
    }
    const unsubscribe = subscribeToCustomerSession(() => { void reconcile() })
    const onFocus = () => { void reconcile() }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void reconcile()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      active = false
      unsubscribe()
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [authenticated])

  return null
}
