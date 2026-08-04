'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createFullThemePreviewCommand,
  inspectAuthSurfaceContrast,
  inspectCheckoutSurfaceContrast,
  resolveMenuActionPlacements,
  type GarsonlessTheme,
  type ThemePreviewContext,
} from '@garsonless/design-engine'
import type { SettingField, SettingsGroup } from '@garsonless/ui/themes'
import { publishTheme, saveThemeDraft } from '../../lib/actions/theme'
import {
  appendHistorySnapshot,
  areThemeOverridesEqual,
  createThemeOverrides,
  getUnsavedFieldLabels,
} from './theme-editor-lifecycle-model'
import {
  prepareThemePublishAttempt,
  prepareThemeDraftSaveAttempt,
  type ThemePublishAttempt,
} from './theme-publish-contract'
import { useThemePreviewBridge } from './use-theme-preview-bridge'

const NAVIGATION_GUARD_MESSAGE = 'Kaydedilmemiş değişiklikler var. Çıkmak istediğine emin misin?'

interface ThemeEditorLifecycleOptions {
  restaurantId: string
  templateId: string
  previewUrl: string
  initialTheme: GarsonlessTheme
  initialPublishedRevision: number
  initialDraftRevision: number
  initialDraftSavedAt: string | null
  initialPublishedAt: string | null
  initialHasUnpublishedChanges: boolean
  defaults: GarsonlessTheme
  schema: SettingsGroup[]
  derivePreviewTheme: (overrides: Partial<GarsonlessTheme>) => GarsonlessTheme
  setNavigationGuard: (message: string | null) => void
  previewContext: ThemePreviewContext
}

export function useThemeEditorLifecycle({
  restaurantId,
  templateId,
  previewUrl,
  initialTheme,
  initialPublishedRevision,
  initialDraftRevision,
  initialDraftSavedAt,
  initialPublishedAt,
  initialHasUnpublishedChanges,
  defaults,
  schema,
  derivePreviewTheme,
  setNavigationGuard,
  previewContext,
}: ThemeEditorLifecycleOptions) {
  const [overrides, setOverrides] = useState<Partial<GarsonlessTheme>>(() =>
    createThemeOverrides(initialTheme, defaults, schema),
  )
  const [undoStack, setUndoStack] = useState<Array<Partial<GarsonlessTheme>>>([])
  const [redoStack, setRedoStack] = useState<Array<Partial<GarsonlessTheme>>>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() => initialDraftSavedAt ? new Date(initialDraftSavedAt) : null)
  const [lastPublishedAt, setLastPublishedAt] = useState<Date | null>(() => initialPublishedAt ? new Date(initialPublishedAt) : null)
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(initialHasUnpublishedChanges)
  const [toast, setToast] = useState('')
  const revisionRef = useRef(0)
  const draftRevisionRef = useRef(initialDraftRevision)
  const publishedRevisionRef = useRef(initialPublishedRevision)
  const draftSaveAttemptRef = useRef<ThemePublishAttempt | null>(null)
  const publishAttemptRef = useRef<ThemePublishAttempt | null>(null)
  const savedThemeRef = useRef(initialTheme)
  const savedOverridesRef = useRef(createThemeOverrides(initialTheme, defaults, schema))
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const previewTheme = useMemo(
    () => derivePreviewTheme(overrides),
    [derivePreviewTheme, overrides],
  )
  const authContrastIssues = useMemo(
    () => inspectAuthSurfaceContrast(previewTheme),
    [previewTheme],
  )
  const checkoutContrastIssues = useMemo(
    () => inspectCheckoutSurfaceContrast(previewTheme),
    [previewTheme],
  )
  const {
    iframeRef,
    status: previewStatus,
    postMessage: postPreviewMessage,
    reload: reloadPreviewFrame,
    handleFrameLoad: handlePreviewFrameLoad,
    handleFrameError: handlePreviewFrameError,
  } = useThemePreviewBridge({ previewUrl, theme: previewTheme, context: previewContext })

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
    revisionRef.current += 1
    setHasUnsavedChanges(!areThemeOverridesEqual(snapshot, savedOverridesRef.current))
    postPreviewMessage(createFullThemePreviewCommand(derivePreviewTheme(snapshot), undefined, previewContext))
  }, [derivePreviewTheme, postPreviewMessage, previewContext])

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

    postPreviewMessage(createFullThemePreviewCommand(derivePreviewTheme(nextOverrides), undefined, previewContext))
  }, [derivePreviewTheme, flashToast, markDirty, overrides, postPreviewMessage, previewContext, rememberOverrides])

  const updateThemePatch = useCallback((patch: Partial<GarsonlessTheme>) => {
    const nextOverrides = { ...overrides, ...patch }
    rememberOverrides(overrides)
    markDirty()
    setOverrides(nextOverrides)
    postPreviewMessage(createFullThemePreviewCommand(derivePreviewTheme(nextOverrides), undefined, previewContext))
  }, [derivePreviewTheme, markDirty, overrides, postPreviewMessage, previewContext, rememberOverrides])

  const handleSave = useCallback(async () => {
    const savingRevision = revisionRef.current
    const savingTheme = previewTheme
    const savingOverrides = overrides
    const attempt = prepareThemeDraftSaveAttempt(draftSaveAttemptRef.current, {
      expectedRevision: draftRevisionRef.current,
      templateId,
      theme: savingTheme,
    })
    draftSaveAttemptRef.current = attempt
    setSavingDraft(true)
    let result: Awaited<ReturnType<typeof saveThemeDraft>>
    try {
      result = await saveThemeDraft(restaurantId, {
        templateId,
        theme: savingTheme,
        expectedRevision: draftRevisionRef.current,
        requestId: attempt.requestId,
      })
    } catch {
      setSavingDraft(false)
      flashToast('Taslak yanıtı alınamadı; aynı istek güvenle tekrar denenebilir')
      return
    }
    setSavingDraft(false)

    if ('error' in result) {
      flashToast(`Hata: ${result.error}`)
      return
    }

    if (result.status === 'conflict') {
      const revision = result.snapshot?.revision ?? 0
      flashToast(`Taslak başka bir çalışan tarafından değiştirildi (sürüm ${revision}). Yerel değişikliklerin korundu; sayfayı yenileyip birleştir.`)
      return
    }

    draftRevisionRef.current = result.revision
    publishedRevisionRef.current = result.basedOnPublishedRevision
    draftSaveAttemptRef.current = null
    publishAttemptRef.current = null
    savedThemeRef.current = savingTheme
    savedOverridesRef.current = savingOverrides
    setLastSavedAt(new Date(result.savedAt))
    setHasUnpublishedChanges(result.hasUnpublishedChanges)

    if (revisionRef.current !== savingRevision) {
      flashToast('Taslak kaydedildi; son değişiklikler henüz kaydedilmedi')
      return
    }

    setHasUnsavedChanges(false)
    flashToast(result.status === 'replayed' ? 'Taslak kaydı doğrulandı' : 'Taslak kaydedildi')
  }, [flashToast, overrides, previewTheme, restaurantId, templateId])

  const handlePublish = useCallback(async () => {
    if (authContrastIssues.length > 0) {
      flashToast('Giriş yüzeyindeki kritik kontrast sorunlarını düzeltmeden yayınlayamazsın')
      return
    }
    if (checkoutContrastIssues.length > 0) {
      flashToast('Checkout yüzeyindeki kritik kontrast sorunlarını düzeltmeden yayınlayamazsın')
      return
    }
    if (hasUnsavedChanges) {
      flashToast('Yayınlamadan önce değişiklikleri kaydet')
      return
    }
    if (!hasUnpublishedChanges || draftRevisionRef.current <= 0) return
    const attempt = prepareThemePublishAttempt(publishAttemptRef.current, {
      expectedDraftRevision: draftRevisionRef.current,
      expectedPublishedRevision: publishedRevisionRef.current,
    })
    publishAttemptRef.current = attempt
    setPublishing(true)
    let result: Awaited<ReturnType<typeof publishTheme>>
    try {
      result = await publishTheme(restaurantId, {
        expectedDraftRevision: draftRevisionRef.current,
        expectedPublishedRevision: publishedRevisionRef.current,
        requestId: attempt.requestId,
      })
    } catch {
      setPublishing(false)
      flashToast('Yayın yanıtı alınamadı; aynı istek güvenle tekrar denenebilir')
      return
    }
    setPublishing(false)
    if ('error' in result) {
      flashToast(`Hata: ${result.error}`)
      return
    }
    if (result.status === 'draft_conflict') {
      flashToast(`Taslak başka bir çalışan tarafından değiştirildi (sürüm ${result.snapshot.revision}). Sayfayı yenileyip güncel taslağı kontrol et.`)
      return
    }
    if (result.status === 'conflict') {
      flashToast(`Canlı Tema başka bir çalışan tarafından yayınlandı (sürüm ${result.snapshot.revision}). Taslağın korundu; güncel sürümü kontrol et.`)
      return
    }
    publishedRevisionRef.current = result.revision
    publishAttemptRef.current = null
    setLastPublishedAt(new Date(result.publishedAt))
    setHasUnpublishedChanges(false)
    flashToast(result.status === 'replayed' ? 'Yayın doğrulandı' : 'Tema yayınlandı')
  }, [authContrastIssues.length, checkoutContrastIssues.length, flashToast, hasUnpublishedChanges, hasUnsavedChanges, restaurantId])

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
    handlePreviewFrameLoad,
    handlePreviewFrameError,
    savingDraft,
    publishing,
    toast,
    hasUnsavedChanges,
    lastSavedAt,
    lastPublishedAt,
    hasUnpublishedChanges,
    authContrastIssues,
    checkoutContrastIssues,
    unsavedFieldLabels,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    flashToast,
    handleUndo,
    handleRedo,
    handleFieldChange,
    updateThemePatch,
    handleSave,
    handlePublish,
  }
}
