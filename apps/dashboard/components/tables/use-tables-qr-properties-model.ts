'use client'

import { useCallback, useMemo, useState } from 'react'
import { defaultQR } from './tables-builder-model'
import type { QRConfig, SaveState } from './tables-builder-types'

export type QRPropertiesTab = 'shape' | 'color' | 'logo' | 'frame' | 'data'
type QRFieldChangeMode = 'push' | 'replace' | 'begin'
export type SetQRField = <Key extends keyof QRConfig>(
  key: Key,
  value: QRConfig[Key],
  mode?: QRFieldChangeMode,
) => void

export const QR_PROPERTY_TABS: ReadonlyArray<{
  id: QRPropertiesTab
  label: string
  icon: 'qr' | 'paint' | 'image' | 'frame' | 'link2'
}> = [
  { id: 'shape', label: 'Şekil', icon: 'qr' },
  { id: 'color', label: 'Renk', icon: 'paint' },
  { id: 'logo', label: 'Logo', icon: 'image' },
  { id: 'frame', label: 'Çerçeve', icon: 'frame' },
  { id: 'data', label: 'Veri', icon: 'link2' },
]

function qrSaveStatus(saveState: SaveState) {
  if (saveState === 'validating') {
    return { label: 'Doğrulanıyor', tone: 'neutral' as const, dot: 'var(--warning)' }
  }
  if (saveState === 'blocked') {
    return { label: 'Kayıt engelli', tone: 'neutral' as const, dot: 'var(--critical)' }
  }
  if (saveState === 'saving') {
    return { label: 'Kaydediliyor', tone: 'neutral' as const, dot: 'var(--warning)' }
  }
  if (saveState === 'error') {
    return { label: 'Sorun var', tone: 'neutral' as const, dot: 'var(--critical)' }
  }
  if (saveState === 'conflict') {
    return { label: 'Çakışma çözüldü', tone: 'neutral' as const, dot: 'var(--warning)' }
  }
  return { label: 'Senkronlu', tone: 'positive' as const, dot: 'var(--positive)' }
}

export function useTablesQRPropertiesModel({
  qr,
  setQR,
  replaceQR,
  beginQRChange,
  saveState,
}: {
  qr: QRConfig
  setQR: (qr: QRConfig) => void
  replaceQR: (qr: QRConfig) => void
  beginQRChange: () => void
  saveState: SaveState
}) {
  const [tab, setTab] = useState<QRPropertiesTab>('shape')

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

  const status = useMemo(() => qrSaveStatus(saveState), [saveState])

  return { tab, setTab, setField, reset, status }
}
