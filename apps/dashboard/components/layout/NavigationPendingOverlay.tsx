'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Client-nav feedback. Next keeps the previous page visible during a (prefetched)
 * client transition — for a slow route (e.g. Müşteriler: service-role PII query)
 * that reads as "nothing happens for 2-3s". This shows a centered "Yükleniyor…"
 * spinner over a light scrim, but only after a short delay, so fast/prefetched
 * navigations (which complete in <300ms) never flash it. Hooks the shared
 * `navigation-start` event that IconRail dispatches on click; hides on route change.
 * Non-blocking (pointer-events: none) — it's purely a loading affordance.
 */
export default function NavigationPendingOverlay() {
  const pathname = usePathname()
  const [pending, setPending] = useState(false)
  const prevPath = useRef(pathname)
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname
      if (delayRef.current) clearTimeout(delayRef.current)
      setPending(false)
    }
  }, [pathname])

  useEffect(() => {
    const onStart = () => {
      if (delayRef.current) clearTimeout(delayRef.current)
      delayRef.current = setTimeout(() => setPending(true), 300)
    }
    window.addEventListener('navigation-start', onStart)
    return () => {
      window.removeEventListener('navigation-start', onStart)
      if (delayRef.current) clearTimeout(delayRef.current)
    }
  }, [])

  if (!pending) return null

  return (
    <div
      aria-live="polite"
      aria-busy="true"
      style={{
        position: 'fixed', top: 'var(--topbar)', left: 0, right: 0, bottom: 0,
        zIndex: 60, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(246,246,247,.55)', backdropFilter: 'blur(1.5px)',
        animation: 'navpend-fade .16s ease',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: '@keyframes navpend-fade{from{opacity:0}to{opacity:1}}@keyframes navpend-spin{to{transform:rotate(360deg)}}' }} />
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 999, padding: '9px 16px', boxShadow: 'var(--shadow-pop)',
      }}>
        <span style={{
          width: 15, height: 15, borderRadius: 999,
          border: '2px solid var(--text-3)', borderRightColor: 'transparent',
          animation: 'navpend-spin .7s linear infinite', display: 'inline-block',
        }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>Yükleniyor…</span>
      </div>
    </div>
  )
}
