'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { inspectQRStyleSafety } from '@garsonless/application/qr-style'
import { saveQRStyle } from '../../lib/actions/tables'
import {
  beginQRHistoryChange,
  createQRHistory,
  normalizeQRStyle,
  pushQRHistory,
  qrContrast,
  redoQRHistory,
  replaceQRHistory,
  hasUnsupportedPersistedQRLogo,
  toPersistedQRStyle,
  undoQRHistory,
} from './tables-builder-model'
import { resolveQRStyleSave } from './qr-style-save-model'
import type { QRConfig, QRHealth, SaveState, TableItem } from './tables-builder-types'

interface UseQRStyleEditorOptions {
  restaurantId: string
  baseUrl: string
  initialStyle: unknown
  initialRevision: number
  activeTable?: TableItem
  validate: (qr: QRConfig, table?: TableItem) => Promise<QRHealth>
}

export function useQRStyleEditor({ restaurantId, baseUrl, initialStyle, initialRevision, activeTable, validate }: UseQRStyleEditorOptions) {
  const [history, setHistory] = useState(() => createQRHistory(normalizeQRStyle(initialStyle, baseUrl)))
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [health, setHealth] = useState<QRHealth>({ state: 'checking', message: 'Okunabilirlik kontrol ediliyor', contrast: 0 })
  const pendingSaveRef = useRef<QRConfig | null>(null)
  const saveRunningRef = useRef(false)
  const validationKeyRef = useRef('')
  const conflictFingerprintRef = useRef<string | null>(null)
  const [retryTick, setRetryTick] = useState(0)
  const legacyLogoRejected = useRef(hasUnsupportedPersistedQRLogo(initialStyle)).current
  const acknowledgedRef = useRef({
    revision: initialRevision,
    style: normalizeQRStyle(initialStyle, baseUrl),
  })
  const qr = history.stack[history.index]!

  const setQR = useCallback((next: QRConfig) => setHistory((current) => pushQRHistory(current, next)), [])
  const beginQRChange = useCallback(() => setHistory(beginQRHistoryChange), [])
  const replaceQR = useCallback((next: QRConfig) => setHistory((current) => replaceQRHistory(current, next)), [])
  const undo = useCallback(() => setHistory(undoQRHistory), [])
  const redo = useCallback(() => setHistory(redoQRHistory), [])

  const persistValidated = useCallback(async (style: QRConfig) => {
    const safety = inspectQRStyleSafety(toPersistedQRStyle(style))
    if (!safety.safe || !safety.style) {
      setSaveState('blocked')
      setSaveError(safety.issues[0] ?? 'Bu QR stili güvenli olmadığı için kaydedilmedi.')
      return
    }
    pendingSaveRef.current = style
    if (saveRunningRef.current) return
    saveRunningRef.current = true
    try {
      while (pendingSaveRef.current) {
        const next = pendingSaveRef.current
        pendingSaveRef.current = null
        setSaveState('saving')
        setSaveError(null)
        const expectedRevision = acknowledgedRef.current.revision
        let result
        try {
          result = await saveQRStyle(restaurantId, toPersistedQRStyle(next), expectedRevision)
        } catch {
          setSaveState('error')
          setSaveError('QR stili kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.')
          break
        }
        const resolution = resolveQRStyleSave({
          attemptedStyle: next,
          expectedRevision,
          result: 'conflict' in result
            ? { ...result, style: normalizeQRStyle(result.style, baseUrl) }
            : result,
        })
        if (resolution.kind === 'retry') {
          setSaveState('error')
          setSaveError(resolution.message)
          break
        }
        acknowledgedRef.current = resolution.snapshot
        if (resolution.kind === 'rollback') {
          pendingSaveRef.current = null
          conflictFingerprintRef.current = JSON.stringify(toPersistedQRStyle(resolution.snapshot.style))
          setHistory(createQRHistory(resolution.snapshot.style))
          setSaveState('conflict')
          setSaveError(resolution.message)
          break
        }
        if (!pendingSaveRef.current) {
          setSaveState('saved')
          setSaveError(null)
        }
      }
    } finally {
      saveRunningRef.current = false
    }
  }, [baseUrl, restaurantId])

  useEffect(() => {
    let cancelled = false
    let saveTimer: number | undefined
    const fingerprint = JSON.stringify(toPersistedQRStyle(qr))
    const validationKey = `${fingerprint}:${activeTable?.id ?? ''}:${activeTable?.qrToken ?? ''}:${retryTick}`
    const preservesConflictFeedback = conflictFingerprintRef.current === fingerprint
    validationKeyRef.current = validationKey
    const safety = inspectQRStyleSafety(toPersistedQRStyle(qr))
    if (!safety.safe) {
      const message = safety.issues[0] ?? 'Bu QR stili güvenli değil.'
      pendingSaveRef.current = null
      setSaveState('blocked')
      setSaveError(message)
      setHealth({ state: 'invalid', message: `${message} Değişiklik kaydedilmedi.`, contrast: safety.contrast })
      return
    }

    if (!preservesConflictFeedback) {
      conflictFingerprintRef.current = null
      setSaveState('validating')
      setSaveError(null)
    }
    setHealth({ state: 'checking', message: 'QR okunabilirliği doğrulanıyor; henüz kaydedilmedi.', contrast: qrContrast(qr) })
    const validationTimer = window.setTimeout(() => {
      void validate(qr, activeTable).then((result) => {
        if (cancelled || validationKeyRef.current !== validationKey) return
        setHealth(result)
        if (result.state === 'invalid') {
          pendingSaveRef.current = null
          setSaveState('blocked')
          setSaveError(`${result.message} Değişiklik kaydedilmedi.`)
          return
        }
        const acknowledgedFingerprint = JSON.stringify(toPersistedQRStyle(acknowledgedRef.current.style))
        if (fingerprint === acknowledgedFingerprint) {
          if (!preservesConflictFeedback) setSaveState('saved')
          return
        }
        saveTimer = window.setTimeout(() => {
          if (!cancelled && validationKeyRef.current === validationKey) void persistValidated(qr)
        }, 300)
      }).catch((error: unknown) => {
        console.error('[QR validation]', error)
        if (cancelled || validationKeyRef.current !== validationKey) return
        const message = 'Okunabilirlik testi tamamlanamadı. Değişiklik kaydedilmedi.'
        pendingSaveRef.current = null
        setHealth({ state: 'invalid', message, contrast: qrContrast(qr) })
        setSaveState('blocked')
        setSaveError(message)
      })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(validationTimer)
      if (saveTimer !== undefined) window.clearTimeout(saveTimer)
    }
  }, [activeTable, persistValidated, qr, retryTick, validate])

  useEffect(() => {
    if (!['validating', 'blocked', 'saving', 'error'].includes(saveState)) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [saveState])

  const retrySave = useCallback(() => setRetryTick((current) => current + 1), [])

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
    retrySave,
    health,
    legacyLogoRejected,
  }
}
