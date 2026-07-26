'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'

const PREVIEW_FALLBACK_MS = 5_000

export type ThemePreviewStatus = 'preparing' | 'ready' | 'degraded'

interface ThemePreviewBridgeOptions {
  previewUrl: string
  theme: GarsonlessTheme
}

export function getThemePreviewTargetOrigin(url: string) {
  try {
    return new URL(url).origin
  } catch {
    return '*'
  }
}

export function useThemePreviewBridge({ previewUrl, theme }: ThemePreviewBridgeOptions) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const requestSequenceRef = useRef(0)
  const pendingRequestRef = useRef<string | null>(null)
  const previewReadyRef = useRef(false)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [status, setStatus] = useState<ThemePreviewStatus>('preparing')
  const targetOrigin = getThemePreviewTargetOrigin(previewUrl)

  const clearFallback = useCallback(() => {
    if (!fallbackTimerRef.current) return
    clearTimeout(fallbackTimerRef.current)
    fallbackTimerRef.current = null
  }, [])

  const armFallback = useCallback(() => {
    clearFallback()
    fallbackTimerRef.current = setTimeout(() => {
      fallbackTimerRef.current = null
      pendingRequestRef.current = null
      setStatus((current) => current === 'preparing' ? 'degraded' : current)
    }, PREVIEW_FALLBACK_MS)
  }, [clearFallback])

  const postMessage = useCallback((message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(message, targetOrigin)
  }, [targetOrigin])

  const sendFullTheme = useCallback((requestId?: string) => {
    postMessage({ type: 'FULL_THEME_UPDATE', theme, requestId })
  }, [postMessage, theme])

  const reload = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    setStatus('preparing')
    pendingRequestRef.current = null
    armFallback()
    const currentSrc = iframe.src
    iframe.src = currentSrc
  }, [armFallback])

  useEffect(() => {
    previewReadyRef.current = false
    setStatus('preparing')
    pendingRequestRef.current = null
    armFallback()
    return clearFallback
  }, [armFallback, clearFallback, previewUrl])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (targetOrigin !== '*' && event.origin !== targetOrigin) return

      const data = event.data as { type?: string; requestId?: string }
      if (data.type === 'PREVIEW_READY') {
        previewReadyRef.current = true
        const requestId = `theme-preview-${++requestSequenceRef.current}`
        pendingRequestRef.current = requestId
        setStatus('preparing')
        armFallback()
        sendFullTheme(requestId)
        return
      }

      if (data.type === 'THEME_APPLIED' && data.requestId === pendingRequestRef.current) {
        pendingRequestRef.current = null
        clearFallback()
        setStatus('ready')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [armFallback, clearFallback, sendFullTheme, targetOrigin])

  // Keep the iframe aligned with React state as well as the imperative editor
  // commands. A command can race with an iframe reload/HMR cycle; the next
  // previewTheme render must still become the source of truth.
  useEffect(() => {
    if (!previewReadyRef.current) return
    postMessage({ type: 'FULL_THEME_UPDATE', theme })
  }, [postMessage, theme])

  return {
    iframeRef,
    status,
    postMessage,
    reload,
  }
}
