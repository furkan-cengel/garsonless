'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { saveQRStyle } from '../../lib/actions/tables'
import {
  beginQRHistoryChange,
  createQRHistory,
  normalizeQRStyle,
  pushQRHistory,
  qrContrast,
  redoQRHistory,
  replaceQRHistory,
  undoQRHistory,
} from './tables-builder-model'
import type { QRConfig, QRHealth, TableItem } from './tables-builder-types'

interface UseQRStyleEditorOptions {
  restaurantId: string
  baseUrl: string
  initialStyle: unknown
  activeTable?: TableItem
  validate: (qr: QRConfig, table?: TableItem) => Promise<QRHealth>
}

export function useQRStyleEditor({ restaurantId, baseUrl, initialStyle, activeTable, validate }: UseQRStyleEditorOptions) {
  const [history, setHistory] = useState(() => createQRHistory(normalizeQRStyle(initialStyle, baseUrl)))
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [health, setHealth] = useState<QRHealth>({ state: 'checking', message: 'Okunabilirlik kontrol ediliyor', contrast: 0 })
  const [healthDialogOpen, setHealthDialogOpen] = useState(false)
  const healthWasInvalidRef = useRef(false)
  const pendingSaveRef = useRef<QRConfig | null>(null)
  const saveRunningRef = useRef(false)
  const didMountRef = useRef(false)
  const qr = history.stack[history.index]!

  const setQR = useCallback((next: QRConfig) => setHistory((current) => pushQRHistory(current, next)), [])
  const beginQRChange = useCallback(() => setHistory(beginQRHistoryChange), [])
  const replaceQR = useCallback((next: QRConfig) => setHistory((current) => replaceQRHistory(current, next)), [])
  const undo = useCallback(() => setHistory(undoQRHistory), [])
  const redo = useCallback(() => setHistory(redoQRHistory), [])

  const persist = useCallback(async (style: QRConfig) => {
    pendingSaveRef.current = style
    if (saveRunningRef.current) return
    saveRunningRef.current = true
    try {
      while (pendingSaveRef.current) {
        const next = pendingSaveRef.current
        pendingSaveRef.current = null
        setSaveState('saving')
        setSaveError(null)
        const result = await saveQRStyle(restaurantId, next)
        if ('error' in result) {
          setSaveState('error')
          setSaveError(result.error)
          if (!pendingSaveRef.current) break
          continue
        }
        if (!pendingSaveRef.current) setSaveState('saved')
      }
    } finally {
      saveRunningRef.current = false
    }
  }, [restaurantId])

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    setSaveState('saving')
    setSaveError(null)
    const timer = window.setTimeout(() => { void persist(qr) }, 650)
    return () => window.clearTimeout(timer)
  }, [persist, qr])

  useEffect(() => {
    if (saveState === 'saved') return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [saveState])

  useEffect(() => {
    let cancelled = false
    setHealth({ state: 'checking', message: 'Okunabilirlik kontrol ediliyor', contrast: qrContrast(qr) })
    const timer = window.setTimeout(() => {
      void validate(qr, activeTable).then((result) => {
        if (!cancelled) setHealth(result)
      }).catch((error: unknown) => {
        console.error('[QR validation]', error)
        if (!cancelled) setHealth({ state: 'invalid', message: 'Stil kaydedildi · okunabilirlik testi çalıştırılamadı', contrast: qrContrast(qr) })
      })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activeTable, qr, validate])

  useEffect(() => {
    if (health.state === 'invalid') {
      if (!healthWasInvalidRef.current) setHealthDialogOpen(true)
      healthWasInvalidRef.current = true
      return
    }
    if (health.state === 'valid' || health.state === 'warning') {
      healthWasInvalidRef.current = false
      setHealthDialogOpen(false)
    }
  }, [health.state])

  return {
    qr,
    setQR,
    replaceQR,
    beginQRChange,
    undo,
    redo,
    canUndo: history.index > 0,
    canRedo: history.index < history.stack.length - 1,
    saveState,
    saveError,
    persist,
    health,
    healthDialogOpen,
    setHealthDialogOpen,
  }
}
