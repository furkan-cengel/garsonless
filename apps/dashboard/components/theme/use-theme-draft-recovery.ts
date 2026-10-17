'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { ThemeEditorSnapshot } from '@garsonless/application/themes'
import { readThemeRecoverySnapshot } from '../../lib/actions/theme'
import { mergeThemeRecovery, themeRecoveryKey, type ThemeRecoveryConflict, type ThemeRecoveryRecord, type ThemeRecoveryScope } from './theme-draft-recovery-model'

interface Options extends ThemeRecoveryScope {
  base: GarsonlessTheme
  local: GarsonlessTheme
  onApply: (theme: GarsonlessTheme, snapshot: ThemeEditorSnapshot) => void
}

export function useThemeDraftRecovery(options: Options) {
  const { userId, restaurantId, templateId, base, local, onApply } = options
  const scope = { userId, restaurantId, templateId }
  const key = themeRecoveryKey(scope)
  const [pending, setPending] = useState<ThemeRecoveryRecord | null>(null)
  const [remote, setRemote] = useState<ThemeEditorSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const latest = useRef(options)
  latest.current = options
  const busyRef = useRef(false)

  useEffect(() => {
    // Retire backups from older clients. Leaving without saving is final;
    // only an explicit server revision conflict starts recovery in this mount.
    try {
      sessionStorage.removeItem(key)
    } catch { /* Storage is optional; old backups are never read. */ }
  }, [key])

  const start = useCallback(() => {
    const current = latest.current
    const record: ThemeRecoveryRecord = { version: 1, userId: current.userId, restaurantId: current.restaurantId,
      templateId: current.templateId, base: current.base, local: current.local, updatedAt: Date.now() }
    setPending(record)
    setRemote(null)
    setError('')
  }, [])

  async function compare() {
    if (!pending || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const result = await readThemeRecoverySnapshot(restaurantId, templateId)
      if ('error' in result) setError(result.error)
      else setRemote(result.snapshot)
    } catch { setError('Güncel taslak alınamadı. Yerel çalışmayı açık tutup tekrar dene.') }
    finally { busyRef.current = false; setBusy(false) }
  }
  function apply(preference: 'local' | 'remote' | 'discard') {
    if (!pending || !remote || busyRef.current) return
    const next = preference === 'discard' ? remote.theme : mergeThemeRecovery(pending.base, pending.local, remote.theme, preference).theme
    onApply(next, remote)
    setPending(null)
    setRemote(null)
    setError('')
  }
  function download() {
    const blob = new Blob([JSON.stringify(pending ?? { ...scope, version: 1, base, local, updatedAt: Date.now() }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `masabu-tema-yerel-${restaurantId}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }
  const conflicts: ThemeRecoveryConflict[] = pending && remote ? mergeThemeRecovery(pending.base, pending.local, remote.theme).conflicts : []
  return { pending, remote, conflicts, busy, error, start, compare, apply, download }
}
