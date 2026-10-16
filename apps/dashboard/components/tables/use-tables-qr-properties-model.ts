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
  /** Advanced tabs stay behind "Gelişmiş ayarlar"; presets in the top bar cover the style. */
  advanced: boolean
}> = [
  { id: 'logo', label: 'Logo', icon: 'image', advanced: false },
  { id: 'frame', label: 'Çerçeve ve etiket', icon: 'frame', advanced: false },
  { id: 'shape', label: 'Şekil', icon: 'qr', advanced: true },
  { id: 'color', label: 'Renk', icon: 'paint', advanced: true },
  { id: 'data', label: 'Bağlantı', icon: 'link2', advanced: true },
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
  const [tab, setTab] = useState<QRPropertiesTab>('logo')
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

  const status = useMemo(() => qrSaveStatus(saveState), [saveState])

  const toggleAdvanced = useCallback(() => {
    setAdvanced((open) => {
      // Closing the advanced tabs must not strand the panel on a hidden one.
      if (open && QR_PROPERTY_TABS.find((item) => item.id === tab)?.advanced) setTab('logo')
      return !open
    })
  }, [tab])

  return { tab, setTab, advanced, toggleAdvanced, setField, reset, status }
}
