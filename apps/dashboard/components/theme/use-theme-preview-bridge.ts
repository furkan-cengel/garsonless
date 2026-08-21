'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createFullThemePreviewCommand,
  parseThemePreviewEvent,
  type GarsonlessTheme,
  type ThemePreviewCommand,
  type ThemePreviewContext,
} from '@garsonless/design-engine'

const PREVIEW_FALLBACK_MS = 6_500
export const THEME_PREVIEW_RETRY_DELAYS_MS = [250, 1_000, 2_500, 4_000] as const

export type ThemePreviewStatus = 'preparing' | 'ready' | 'stale' | 'error'

interface ThemePreviewBridgeOptions {
  previewUrl: string
  theme: GarsonlessTheme
  context: ThemePreviewContext
  onSurfaceNavigation?: (surface: 'home' | 'menu') => void
}

export function getThemePreviewTargetOrigin(url: string) {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export function getThemePreviewFailureStatus(hasSuccessfulPreview: boolean): ThemePreviewStatus {
  return hasSuccessfulPreview ? 'stale' : 'error'
}

export function useThemePreviewBridge({ previewUrl, theme, context, onSurfaceNavigation }: ThemePreviewBridgeOptions) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const childNavigationSurfaceRef = useRef<'home' | 'menu' | null>(null)
  const requestSequenceRef = useRef(0)
  const pendingRequestRef = useRef<string | null>(null)
  const previewReadyRef = useRef(false)
  const hasSuccessfulPreviewRef = useRef(false)
  const automaticRecoveryUsedRef = useRef(false)
  const themeRef = useRef(theme)
  const contextRef = useRef(context)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const [frameUrl, setFrameUrl] = useState(previewUrl)
  const [status, setStatus] = useState<ThemePreviewStatus>('preparing')
  const targetOrigin = getThemePreviewTargetOrigin(frameUrl)
  themeRef.current = theme
  contextRef.current = context

  const clearRetries = useCallback(() => {
    retryTimersRef.current.forEach(clearTimeout)
    retryTimersRef.current = []
  }, [])

  const clearFallback = useCallback(() => {
    if (!fallbackTimerRef.current) return
    clearTimeout(fallbackTimerRef.current)
    fallbackTimerRef.current = null
  }, [])

  const armFallback = useCallback(() => {
    clearFallback()
    fallbackTimerRef.current = setTimeout(() => {
      fallbackTimerRef.current = null
      clearRetries()
      pendingRequestRef.current = null
      const iframe = iframeRef.current
      if (!hasSuccessfulPreviewRef.current && !automaticRecoveryUsedRef.current && iframe) {
        automaticRecoveryUsedRef.current = true
        previewReadyRef.current = false
        setStatus('preparing')
        const currentSrc = iframe.src
        iframe.src = currentSrc
        return
      }
      setStatus((current) => (
        current === 'preparing' || current === 'stale'
          ? getThemePreviewFailureStatus(hasSuccessfulPreviewRef.current)
          : current
      ))
    }, PREVIEW_FALLBACK_MS)
  }, [clearFallback, clearRetries])

  const postMessage = useCallback((message: ThemePreviewCommand | null) => {
    if (!message || !targetOrigin) return
    iframeRef.current?.contentWindow?.postMessage(message, targetOrigin)
  }, [targetOrigin])

  const sendFullTheme = useCallback((requestId?: string) => {
    postMessage(createFullThemePreviewCommand(themeRef.current, requestId, contextRef.current))
  }, [postMessage])

  const beginHandshake = useCallback(() => {
    if (!targetOrigin) {
      setStatus('error')
      return
    }
    clearRetries()
    const requestId = `theme-preview-${++requestSequenceRef.current}`
    pendingRequestRef.current = requestId
    setStatus(hasSuccessfulPreviewRef.current ? 'stale' : 'preparing')
    armFallback()
    sendFullTheme(requestId)
    retryTimersRef.current = THEME_PREVIEW_RETRY_DELAYS_MS.map((delay) => setTimeout(() => {
      if (pendingRequestRef.current === requestId) sendFullTheme(requestId)
    }, delay))
  }, [armFallback, clearRetries, sendFullTheme, targetOrigin])

  const reload = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    automaticRecoveryUsedRef.current = false
    setStatus(hasSuccessfulPreviewRef.current ? 'stale' : 'preparing')
    previewReadyRef.current = false
    pendingRequestRef.current = null
    clearFallback()
    clearRetries()
    const currentSrc = iframe.src
    iframe.src = currentSrc
  }, [clearFallback, clearRetries])

  const handleFrameLoad = useCallback(() => {
    beginHandshake()
  }, [beginHandshake])

  const handleFrameError = useCallback(() => {
    previewReadyRef.current = false
    pendingRequestRef.current = null
    clearFallback()
    clearRetries()
    setStatus(getThemePreviewFailureStatus(hasSuccessfulPreviewRef.current))
  }, [clearFallback, clearRetries])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (!targetOrigin || event.origin !== targetOrigin) return

      const data = parseThemePreviewEvent(event.data)
      if (!data) return
      if (data.type === 'PREVIEW_NAVIGATION') {
        childNavigationSurfaceRef.current = data.surface
        contextRef.current = { surface: data.surface }
        onSurfaceNavigation?.(data.surface)
        return
      }
      if (data.type === 'PREVIEW_READY') {
        previewReadyRef.current = true
        beginHandshake()
        return
      }

      if (data.type === 'THEME_APPLIED' && data.requestId === pendingRequestRef.current) {
        previewReadyRef.current = true
        hasSuccessfulPreviewRef.current = true
        pendingRequestRef.current = null
        clearFallback()
        clearRetries()
        setStatus('ready')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [beginHandshake, clearFallback, clearRetries, onSurfaceNavigation, targetOrigin])

  useEffect(() => {
    const childSurface = childNavigationSurfaceRef.current
    if (childSurface) {
      childNavigationSurfaceRef.current = null
      if (childSurface === context.surface) return
    }
    setFrameUrl(previewUrl)
  }, [context.surface, previewUrl])

  useEffect(() => {
    previewReadyRef.current = false
    automaticRecoveryUsedRef.current = false
    pendingRequestRef.current = null
    clearFallback()
    clearRetries()
    setStatus(targetOrigin ? 'preparing' : 'error')
    if (targetOrigin) armFallback()
    return () => {
      clearFallback()
      clearRetries()
    }
  }, [armFallback, clearFallback, clearRetries, frameUrl, targetOrigin])

  // Keep the iframe aligned with React state as well as the imperative editor
  // commands. A command can race with an iframe reload/HMR cycle; the next
  // previewTheme render must still become the source of truth.
  useEffect(() => {
    if (!previewReadyRef.current) return
    postMessage(createFullThemePreviewCommand(theme, undefined, context))
  }, [context, postMessage, theme])

  return {
    iframeRef,
    frameUrl,
    status,
    postMessage,
    reload,
    handleFrameLoad,
    handleFrameError,
  }
}
