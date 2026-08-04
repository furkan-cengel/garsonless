'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  createThemeAppliedEvent,
  createThemeComponentClickEvent,
  createThemePreviewReadyEvent,
  parseThemePreviewCommand,
} from '@garsonless/design-engine/theme-preview-protocol'
import type { GarsonlessTheme } from '@garsonless/design-engine'

interface ThemePreviewBridgeProps {
  theme: GarsonlessTheme
  onThemeChange: (theme: GarsonlessTheme) => void
}

function getParentOrigin() {
  if (typeof document === 'undefined' || !document.referrer) return null
  try {
    return new URL(document.referrer).origin
  } catch {
    return null
  }
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
