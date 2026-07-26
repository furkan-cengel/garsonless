'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { resolveMenuActionPlacements, type GarsonlessTheme } from '@garsonless/design-engine'
import type { SettingField, SettingsGroup } from '@garsonless/ui'
import { publishTheme } from '../../lib/actions/theme'
import {
  appendHistorySnapshot,
  createThemeOverrides,
  getUnsavedFieldLabels,
} from './theme-editor-lifecycle-model'
import { useThemePreviewBridge } from './use-theme-preview-bridge'

const SYSTEM_FONTS = new Set(['Georgia', 'Times New Roman', 'Arial', 'Helvetica', 'Verdana', 'Bodoni 72'])
const NAVIGATION_GUARD_MESSAGE = 'Kaydedilmemiş değişiklikler var. Çıkmak istediğine emin misin?'

interface ThemeEditorLifecycleOptions {
  restaurantId: string
  templateId: string
  previewUrl: string
  initialTheme: GarsonlessTheme
  defaults: GarsonlessTheme
  schema: SettingsGroup[]
  derivePreviewTheme: (overrides: Partial<GarsonlessTheme>) => GarsonlessTheme
  setNavigationGuard: (message: string | null) => void
}

function fontCssValue(fontName: string, isDisplay = false) {
  if (SYSTEM_FONTS.has(fontName)) return fontName
  return isDisplay ? `"${fontName}", cursive` : `"${fontName}", sans-serif`
}

function fieldToCSSValue(field: SettingField, value: unknown): string {
  const typedValue = value as string | number | boolean
  if (field.type === 'color') return typedValue as string
  if (field.type === 'range') return field.unit === 'px' ? `${typedValue}px` : String(typedValue)
  if (field.type === 'font') {
    const isDisplay = field.id.includes('display') || field.id.includes('Display')
    return fontCssValue(typedValue as string, isDisplay)
  }
  return String(typedValue)
}

export function useThemeEditorLifecycle({
  restaurantId,
  templateId,
  previewUrl,
  initialTheme,
  defaults,
  schema,
  derivePreviewTheme,
  setNavigationGuard,
}: ThemeEditorLifecycleOptions) {
  const [overrides, setOverrides] = useState<Partial<GarsonlessTheme>>(() =>
    createThemeOverrides(initialTheme, defaults, schema),
  )
  const [undoStack, setUndoStack] = useState<Array<Partial<GarsonlessTheme>>>([])
  const [redoStack, setRedoStack] = useState<Array<Partial<GarsonlessTheme>>>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [toast, setToast] = useState('')
  const revisionRef = useRef(0)
  const savedThemeRef = useRef(initialTheme)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const previewTheme = useMemo(
    () => derivePreviewTheme(overrides),
    [derivePreviewTheme, overrides],
  )
  const {
    iframeRef,
    status: previewStatus,
    postMessage: postPreviewMessage,
    reload: reloadPreviewFrame,
  } = useThemePreviewBridge({ previewUrl, theme: previewTheme })

  const flashToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null
      setToast('')
    }, 2_500)
  }, [])

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  useEffect(() => {
    setNavigationGuard(hasUnsavedChanges ? NAVIGATION_GUARD_MESSAGE : null)
    return () => setNavigationGuard(null)
  }, [hasUnsavedChanges, setNavigationGuard])

  const markDirty = useCallback(() => {
    revisionRef.current += 1
    setHasUnsavedChanges(true)
  }, [])

  const rememberOverrides = useCallback((snapshot: Partial<GarsonlessTheme>) => {
    setUndoStack((history) => appendHistorySnapshot(history, snapshot))
    setRedoStack([])
  }, [])

  const applyOverridesSnapshot = useCallback((snapshot: Partial<GarsonlessTheme>) => {
    setOverrides(snapshot)
    markDirty()
    postPreviewMessage({ type: 'FULL_THEME_UPDATE', theme: derivePreviewTheme(snapshot) })
  }, [derivePreviewTheme, markDirty, postPreviewMessage])

  const handleUndo = useCallback(() => {
    const previous = undoStack[undoStack.length - 1]
    if (!previous) return
    setUndoStack(undoStack.slice(0, -1))
    setRedoStack((history) => appendHistorySnapshot(history, overrides))
    applyOverridesSnapshot(previous)
    flashToast('Geri alındı')
  }, [applyOverridesSnapshot, flashToast, overrides, undoStack])

  const handleRedo = useCallback(() => {
    const next = redoStack[redoStack.length - 1]
    if (!next) return
    setRedoStack(redoStack.slice(0, -1))
    setUndoStack((history) => appendHistorySnapshot(history, overrides))
    applyOverridesSnapshot(next)
    flashToast('Yeniden uygulandı')
  }, [applyOverridesSnapshot, flashToast, overrides, redoStack])

  const handleFieldChange = useCallback((field: SettingField, value: unknown) => {
    let nextOverrides = { ...overrides, [field.themeField]: value }
    if (field.themeField === 'memberPlacement' || field.themeField === 'cartPlacement' || field.themeField === 'servicePlacement') {
      const projected = derivePreviewTheme(nextOverrides)
      const placements = resolveMenuActionPlacements(projected)
      const adjusted = {
        memberPlacement: placements.member,
        cartPlacement: placements.cart,
        servicePlacement: placements.service,
      } as const
      const moved = (['memberPlacement', 'cartPlacement', 'servicePlacement'] as const).some(
        (key) => projected[key] !== adjusted[key],
      )
      if (moved) {
        nextOverrides = { ...nextOverrides, ...adjusted }
        flashToast('Header en fazla iki hızlı aksiyon taşır; düşük öncelikli aksiyon Drawer’a alındı')
      }
    }
    rememberOverrides(overrides)
    markDirty()
    setOverrides(nextOverrides)

    if (field.cssVar) {
      postPreviewMessage({
        type: 'CSS_VARS_UPDATE',
        vars: { [field.cssVar]: fieldToCSSValue(field, value) },
      })
    }

    postPreviewMessage({ type: 'FULL_THEME_UPDATE', theme: derivePreviewTheme(nextOverrides) })
  }, [derivePreviewTheme, flashToast, markDirty, overrides, postPreviewMessage, rememberOverrides])

  const updateThemePatch = useCallback((patch: Partial<GarsonlessTheme>) => {
    const nextOverrides = { ...overrides, ...patch }
    rememberOverrides(overrides)
    markDirty()
    setOverrides(nextOverrides)
    postPreviewMessage({ type: 'FULL_THEME_UPDATE', theme: derivePreviewTheme(nextOverrides) })
  }, [derivePreviewTheme, markDirty, overrides, postPreviewMessage, rememberOverrides])

  const handleSave = useCallback(async () => {
    const savingRevision = revisionRef.current
    setSaving(true)
    const result = await publishTheme(restaurantId, previewTheme, templateId)
    setSaving(false)

    if ('error' in result) {
      flashToast(`Hata: ${result.error}`)
      return
    }

    if (revisionRef.current !== savingRevision) {
      flashToast('Kaydedildi; son değişiklikler henüz yayınlanmadı')
      return
    }

    setHasUnsavedChanges(false)
    savedThemeRef.current = previewTheme
    setLastSavedAt(new Date())
    flashToast('Kaydedildi')
  }, [flashToast, previewTheme, restaurantId, templateId])

  const unsavedFieldLabels = useMemo(
    () => getUnsavedFieldLabels(hasUnsavedChanges, schema, previewTheme, savedThemeRef.current),
    [hasUnsavedChanges, previewTheme, schema],
  )

  return {
    overrides,
    previewTheme,
    iframeRef,
    previewStatus,
    reloadPreviewFrame,
    saving,
    toast,
    hasUnsavedChanges,
    lastSavedAt,
    unsavedFieldLabels,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    flashToast,
    handleUndo,
    handleRedo,
    handleFieldChange,
    updateThemePatch,
    handleSave,
  }
}
