'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  createThemeAppliedEvent,
  createThemeComponentClickEvent,
  createThemePreviewNavigationEvent,
  createThemePreviewReadyEvent,
  MENU_CART_PREVIEW_EVENT,
  parseThemePreviewCommand,
} from '@garsonless/design-engine/theme-preview-protocol'
import type { GarsonlessTheme } from '@garsonless/design-engine'

interface ThemePreviewBridgeProps {
  theme: GarsonlessTheme
  onThemeChange: (theme: GarsonlessTheme) => void
}

const PREVIEW_PARENT_ORIGIN_KEY = 'garsonless-theme-preview-parent-origin'

function safeOrigin(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

function getParentOrigin() {
  if (typeof window === 'undefined' || window.parent === window) return null
  try {
    return window.parent.location.origin
  } catch { /* cross-origin parent access is expected */ }

  const referrerOrigin = safeOrigin(document.referrer)
  if (referrerOrigin && referrerOrigin !== window.location.origin) {
    try { window.sessionStorage.setItem(PREVIEW_PARENT_ORIGIN_KEY, referrerOrigin) } catch { /* storage may be disabled */ }
    return referrerOrigin
  }

  try {
    return safeOrigin(window.sessionStorage.getItem(PREVIEW_PARENT_ORIGIN_KEY))
  } catch { /* storage may be disabled */ }
  return null
}

function getCurrentPreviewSurface() {
  const requested = new URLSearchParams(window.location.search).get('surface')
  if (requested === 'home' || requested === 'menu') return requested
  return /\/menu\/?$/.test(window.location.pathname) ? 'menu' : null
}

export function ThemePreviewBridge({ theme, onThemeChange }: ThemePreviewBridgeProps) {
  const pendingThemeAckRef = useRef<string | null>(null)

  useEffect(() => {
    const requestId = pendingThemeAckRef.current
    if (!requestId) return
    let cancelled = false
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cancelled) return
      const parentOrigin = getParentOrigin()
      const message = createThemeAppliedEvent(requestId)
      if (parentOrigin && message) {
        window.parent.postMessage(message, parentOrigin)
        if (pendingThemeAckRef.current === requestId) pendingThemeAckRef.current = null
      }
    }))
    return () => { cancelled = true }
  }, [theme])

  const handleMessage = useCallback((event: MessageEvent) => {
    const parentOrigin = getParentOrigin()
    if (!parentOrigin || event.source !== window.parent || event.origin !== parentOrigin) return
    const data = parseThemePreviewCommand(event.data)
    if (!data) return
    if (data.type === 'SCROLL_TO_COMPONENT') {
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[data-component="footer"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return
    }
    if (data.type === 'SET_MENU_CART_PREVIEW_STATE') {
      window.dispatchEvent(new CustomEvent(MENU_CART_PREVIEW_EVENT, { detail: { state: data.state } }))
      return
    }
    if (data.type === 'REVEAL_MENU_PAGE_BLOCK') {
      requestAnimationFrame(() => {
        const escapedId = CSS.escape(data.target.id)
        let target = data.target.kind === 'nav'
          ? document.querySelector<HTMLElement>('[data-component="catnav"], [data-component="visual-category-grid"]')
          : data.target.kind === 'category'
            ? document.querySelector<HTMLElement>(`#section-${escapedId}`)
            : document.querySelector<HTMLElement>(`[data-menu-page-section-id="${escapedId}"]`)
        if (!target && data.target.kind === 'category') {
          const hash = `#category-${encodeURIComponent(data.target.id)}`
          window.history.replaceState(window.history.state, '', hash)
          window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
          requestAnimationFrame(() => {
            target = document.querySelector<HTMLElement>(`#section-${escapedId}`)
            if (!target) return
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
          })
          return
        }
        if (!target) return
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
      })
      return
    }
    if (data.type === 'FULL_THEME_UPDATE') {
      if (data.requestId && pendingThemeAckRef.current === data.requestId) return
      if (data.requestId) pendingThemeAckRef.current = data.requestId
      onThemeChange(data.theme)
    }
  }, [onThemeChange])

  useEffect(() => {
    const parentOrigin = getParentOrigin()
    if (!parentOrigin || window.parent === window) return
    window.addEventListener('message', handleMessage)
    const navigation = createThemePreviewNavigationEvent(getCurrentPreviewSurface())
    if (navigation) window.parent.postMessage(navigation, parentOrigin)
    window.parent.postMessage(createThemePreviewReadyEvent(), parentOrigin)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const element = (event.target as HTMLElement).closest('[data-component]')
      if (!element) return
      const component = element.getAttribute('data-component')
      if (!component) return
      const rect = element.getBoundingClientRect()
      const parentOrigin = getParentOrigin()
      const message = createThemeComponentClickEvent({
        component,
        x: rect.left + rect.width / 2,
        y: rect.top,
        iframeWidth: window.innerWidth,
        iframeHeight: window.innerHeight,
      })
      if (parentOrigin && message) window.parent.postMessage(message, parentOrigin)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  return null
}
