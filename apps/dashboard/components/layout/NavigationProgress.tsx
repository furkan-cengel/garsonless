'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export default function NavigationProgress() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const prevPathname = useRef(pathname)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setProgress(100)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 300)
      prevPathname.current = pathname
    }
  }, [pathname])

  useEffect(() => {
    const handleStart = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setVisible(true)
      setProgress(0)
      let p = 0
      intervalRef.current = setInterval(() => {
        p += Math.random() * 15
        if (p >= 85) {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          p = 85
        }
        setProgress(p)
      }, 100)
    }
    window.addEventListener('navigation-start', handleStart)
    return () => {
      window.removeEventListener('navigation-start', handleStart)
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      top: 'var(--topbar)',
      left: 0,
      width: `${progress}%`,
      height: 3,
      background: 'linear-gradient(90deg, var(--brand) 0%, var(--accent) 100%)',
      zIndex: 9999,
      transition: 'width 100ms ease',
      boxShadow: '0 0 8px var(--brand)',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.4) 50%, transparent 100%)',
        animation: 'spin 1s linear infinite',
      }} />
    </div>
  )
}
