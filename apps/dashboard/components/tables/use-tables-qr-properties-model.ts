'use client'

import { useCallback, useState } from 'react'
import { defaultQR } from './tables-builder-model'
import type { QRConfig } from './tables-builder-types'
import { applyQRPreset, type QRPreset } from './tables-qr-presets'

type QRFieldChangeMode = 'push' | 'replace' | 'begin'
export type SetQRField = <Key extends keyof QRConfig>(
  key: Key,
  value: QRConfig[Key],
  mode?: QRFieldChangeMode,
) => void

export function useTablesQRPropertiesModel({
  qr,
  setQR,
  replaceQR,
  beginQRChange,
}: {
  qr: QRConfig
  setQR: (qr: QRConfig) => void
  replaceQR: (qr: QRConfig) => void
  beginQRChange: () => void
}) {
  const [advanced, setAdvanced] = useState(false)

  const setField = useCallback<SetQRField>((key, value, mode = 'push') => {
    if (mode === 'begin') {
      beginQRChange()
      return
    }
    const next = { ...qr, [key]: value }
    if (mode === 'replace') replaceQR(next)
    else setQR(next)
  }, [beginQRChange, qr, replaceQR, setQR])

  const reset = useCallback(() => {
    setQR(defaultQR(qr.baseUrl))
  }, [qr.baseUrl, setQR])

  const toggleAdvanced = useCallback(() => setAdvanced((open) => !open), [])

  const applyPreset = useCallback((preset: QRPreset) => setQR(applyQRPreset(qr, preset)), [qr, setQR])

  return { advanced, toggleAdvanced, applyPreset, setField, reset }
}
