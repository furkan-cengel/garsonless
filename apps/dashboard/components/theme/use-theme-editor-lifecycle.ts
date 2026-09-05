'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createFullThemePreviewCommand,
  inspectAuthSurfaceContrast,
  inspectCheckoutSurfaceContrast,
  inspectMenuCardSurfaceContrast,
  inspectMenuCartContrast,
  inspectMenuFooterContrast,
  inspectMenuHeaderContrast,
  inspectMenuNavigationContrast,
  inspectMenuThemeContrast,
  projectThemeForSectionAccess,
  resolveMenuActionPlacements,
  type GarsonlessTheme,
  type ThemePreviewContext,
  type ThemeSectionAccess,
} from '@garsonless/design-engine'
import type { SettingField, SettingsGroup } from '@garsonless/ui/themes'
import { publishTheme, removeUnusedThemeMedia, saveThemeDraft } from '../../lib/actions/theme'
import { themeDocumentContainsMediaUrl } from '../../lib/theme-media-policy'
import {
  appendHistorySnapshot,
  areThemeOverridesEqual,
  createThemeOverrides,
  getUnsavedFieldLabels,
  isContinuousThemeHistoryControl,
  shouldAppendHistoryForGroup,
} from './theme-editor-lifecycle-model'
import {
  prepareThemePublishAttempt,
  prepareThemeDraftSaveAttempt,
  type ThemePublishAttempt,
} from './theme-publish-contract'
import { useThemePreviewBridge } from './use-theme-preview-bridge'
import { getThemePromoSliderIssues } from '../../lib/promo-slider-validation'
import { getThemeComboRibbonIssues } from '../../lib/combo-ribbon-validation'

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
  /** Entitlements applied to the live preview theme only, never to the editor tree. */
  canAddAdvancedSections: boolean
  canUseVideoHero: boolean
  onPreviewSurfaceNavigation?: (surface: 'home' | 'menu') => void
  menuItems: Array<{
    id: string
    name: string
    categoryId: string
    categoryName: string
    price?: number
    isAvailable?: boolean
    position?: number
  }>
}

export interface ThemePatchOptions {
  historyGroup?: string
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
  canAddAdvancedSections,
  canUseVideoHero,
  onPreviewSurfaceNavigation,
  menuItems,
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
  const activeHistoryGroupRef = useRef<string | null>(null)
  const focusedHistoryGroupRef = useRef<string | null>(null)
  const focusSessionRef = useRef(0)
  const retiredMediaUrlsRef = useRef(new Set<string>())
  const [retirementRevision, setRetirementRevision] = useState(0)

  const previewTheme = useMemo(
    () => derivePreviewTheme(overrides),
    [derivePreviewTheme, overrides],
  )
  // The preview iframe is a public rendering surface: the editor's live theme
  // would otherwise overwrite the server-side plan projection over postMessage
  // and bring unentitled sections back on screen. Every theme that crosses the
  // bridge goes through here — the editor keeps the full document so locked
  // sections stay listed, selectable and configurable without losing settings.
  const sectionAccess = useMemo<ThemeSectionAccess>(
    () => ({ advancedSections: canAddAdvancedSections, videoHero: canUseVideoHero }),
    [canAddAdvancedSections, canUseVideoHero],
  )
  const deriveBridgeTheme = useCallback(
    (nextOverrides: Partial<GarsonlessTheme>) =>
      projectThemeForSectionAccess(derivePreviewTheme(nextOverrides), sectionAccess),
    [derivePreviewTheme, sectionAccess],
  )
  const bridgeTheme = useMemo(
    () => projectThemeForSectionAccess(previewTheme, sectionAccess),
    [previewTheme, sectionAccess],
  )
  const authContrastIssues = useMemo(
    () => inspectAuthSurfaceContrast(previewTheme),
    [previewTheme],
  )
  const checkoutContrastIssues = useMemo(
    () => inspectCheckoutSurfaceContrast(previewTheme),
    [previewTheme],
  )
  const menuHeaderContrastIssues = useMemo(
    () => inspectMenuHeaderContrast(previewTheme),
    [previewTheme],
  )
  const menuCardContrastIssues = useMemo(
    () => inspectMenuCardSurfaceContrast(previewTheme),
    [previewTheme],
  )
  const menuCartContrastIssues = useMemo(
    () => inspectMenuCartContrast(previewTheme),
    [previewTheme],
  )
  const menuFooterContrastIssues = useMemo(
    () => inspectMenuFooterContrast(previewTheme),
    [previewTheme],
  )
  const menuNavigationContrastIssues = useMemo(
    () => inspectMenuNavigationContrast(previewTheme),
    [previewTheme],
  )
  const menuThemeContrastIssues = useMemo(
    () => inspectMenuThemeContrast(previewTheme),
    [previewTheme],
  )
  const {
    iframeRef,
    frameUrl: previewFrameUrl,
    status: previewStatus,
    postMessage: postPreviewMessage,
    reload: reloadPreviewFrame,
    handleFrameLoad: handlePreviewFrameLoad,
    handleFrameError: handlePreviewFrameError,
  } = useThemePreviewBridge({ previewUrl, theme: bridgeTheme, context: previewContext, onSurfaceNavigation: onPreviewSurfaceNavigation })

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
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) {
        focusedHistoryGroupRef.current = null
        return
      }
      const continuous = isContinuousThemeHistoryControl({
        tagName: target.tagName,
        ...(target instanceof HTMLInputElement ? { inputType: target.type } : {}),
        role: target.getAttribute('role'),
      })
      if (!continuous) {
        focusedHistoryGroupRef.current = null
        return
      }
      focusSessionRef.current += 1
      focusedHistoryGroupRef.current = `editor-control:${focusSessionRef.current}`
    }
    const handleFocusOut = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (isContinuousThemeHistoryControl({
        tagName: target.tagName,
        ...(target instanceof HTMLInputElement ? { inputType: target.type } : {}),
        role: target.getAttribute('role'),
      })) focusedHistoryGroupRef.current = null
    }
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
    }
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

  const retireThemeMediaUrl = useCallback((url: string) => {
    if (!url || retiredMediaUrlsRef.current.has(url)) return
    retiredMediaUrlsRef.current.add(url)
    setRetirementRevision((revision) => revision + 1)
  }, [])

  useEffect(() => {
    if (retiredMediaUrlsRef.current.size === 0) return
    const history = [overrides, ...undoStack, ...redoStack]
    const eligible = [...retiredMediaUrlsRef.current].filter((url) =>
      !history.some((snapshot) => themeDocumentContainsMediaUrl(snapshot, url)),
    )
    if (eligible.length === 0) return
    let cancelled = false
    void Promise.all(eligible.map(async (url) => {
      const result = await removeUnusedThemeMedia(restaurantId, url)
      if (!cancelled && !('error' in result) && result.removed) retiredMediaUrlsRef.current.delete(url)
    }))
    return () => { cancelled = true }
  }, [lastPublishedAt, lastSavedAt, overrides, redoStack, restaurantId, retirementRevision, undoStack])

  const rememberOverrides = useCallback((snapshot: Partial<GarsonlessTheme>) => {
    setUndoStack((history) => appendHistorySnapshot(history, snapshot))
    setRedoStack([])
  }, [])

  const rememberInteractionStart = useCallback((snapshot: Partial<GarsonlessTheme>, explicitGroup?: string) => {
    const requestedHistoryGroup = explicitGroup ?? focusedHistoryGroupRef.current
    if (shouldAppendHistoryForGroup(activeHistoryGroupRef.current, requestedHistoryGroup)) {
      rememberOverrides(snapshot)
    }
    activeHistoryGroupRef.current = requestedHistoryGroup
  }, [rememberOverrides])

  const applyOverridesSnapshot = useCallback((snapshot: Partial<GarsonlessTheme>) => {
    activeHistoryGroupRef.current = null
    setOverrides(snapshot)
    revisionRef.current += 1
    setHasUnsavedChanges(!areThemeOverridesEqual(snapshot, savedOverridesRef.current))
    postPreviewMessage(createFullThemePreviewCommand(deriveBridgeTheme(snapshot), undefined, previewContext))
  }, [deriveBridgeTheme, postPreviewMessage, previewContext])

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
    rememberInteractionStart(overrides)
    markDirty()
    setOverrides(nextOverrides)

    postPreviewMessage(createFullThemePreviewCommand(deriveBridgeTheme(nextOverrides), undefined, previewContext))
  }, [deriveBridgeTheme, derivePreviewTheme, flashToast, markDirty, overrides, postPreviewMessage, previewContext, rememberInteractionStart])

  const updateThemePatch = useCallback((patch: Partial<GarsonlessTheme>, options?: ThemePatchOptions) => {
    const nextOverrides = { ...overrides, ...patch }
    rememberInteractionStart(overrides, options?.historyGroup)
    markDirty()
    setOverrides(nextOverrides)
    postPreviewMessage(createFullThemePreviewCommand(deriveBridgeTheme(nextOverrides), undefined, previewContext))
  }, [deriveBridgeTheme, markDirty, overrides, postPreviewMessage, previewContext, rememberInteractionStart])

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
    flashToast(result.status === 'replayed'
      ? 'Taslak kaydı doğrulandı; QR menü için yayınla'
      : 'Taslak kaydedildi; QR menüde görünmesi için yayınla')
  }, [flashToast, overrides, previewTheme, restaurantId, templateId])

  const handlePublish = useCallback(async () => {
    const comboRibbonIssues = getThemeComboRibbonIssues(previewTheme, menuItems)
    if (comboRibbonIssues.length > 0) {
      flashToast(`Kombo Şerit: ${comboRibbonIssues[0]}`)
      return
    }
    const promoSliderIssues = getThemePromoSliderIssues(previewTheme)
    if (promoSliderIssues.length > 0) {
      flashToast(`Kampanya Slider: ${promoSliderIssues[0]}`)
      return
    }
    if (authContrastIssues.length > 0) {
      flashToast('Giriş yüzeyindeki kritik kontrast sorunlarını düzeltmeden yayınlayamazsın')
      return
    }
    if (checkoutContrastIssues.length > 0) {
      flashToast('Checkout yüzeyindeki kritik kontrast sorunlarını düzeltmeden yayınlayamazsın')
      return
    }
    if (menuHeaderContrastIssues.length > 0) {
      flashToast('Menü Header kritik kontrast sorunlarını düzeltmeden yayınlayamazsın')
      return
    }
    if (menuThemeContrastIssues.length > 0) {
      flashToast('Tema paletindeki kritik kontrast sorunlarını düzeltmeden yayınlayamazsın')
      return
    }
    if (menuNavigationContrastIssues.length > 0) {
      flashToast('Menü navigasyonundaki kritik kontrast sorunlarını düzeltmeden yayınlayamazsın')
      return
    }
    if (menuCardContrastIssues.length > 0) {
      flashToast('Ürün kartlarındaki kritik kontrast sorunlarını düzeltmeden yayınlayamazsın')
      return
    }
    if (menuCartContrastIssues.length > 0) {
      flashToast('Sepet yüzeyindeki kritik kontrast sorunlarını düzeltmeden yayınlayamazsın')
      return
    }
    if (menuFooterContrastIssues.length > 0) {
      flashToast('Footer yüzeyindeki kritik kontrast sorunlarını düzeltmeden yayınlayamazsın')
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
    flashToast(result.status === 'replayed' ? 'QR menü yayını doğrulandı' : 'Tema masa QR menüsünde yayınlandı')
  }, [authContrastIssues.length, checkoutContrastIssues.length, flashToast, hasUnpublishedChanges, hasUnsavedChanges, menuCardContrastIssues.length, menuCartContrastIssues.length, menuFooterContrastIssues.length, menuHeaderContrastIssues.length, menuItems, menuNavigationContrastIssues.length, menuThemeContrastIssues.length, previewTheme, restaurantId])

  const unsavedFieldLabels = useMemo(
    () => getUnsavedFieldLabels(hasUnsavedChanges, schema, previewTheme, savedThemeRef.current),
    [hasUnsavedChanges, previewTheme, schema],
  )

  return {
    overrides,
    previewTheme,
    iframeRef,
    previewFrameUrl,
    previewStatus,
    reloadPreviewFrame,
    handlePreviewFrameLoad,
    handlePreviewFrameError,
    postPreviewMessage,
    savingDraft,
    publishing,
    toast,
    hasUnsavedChanges,
    lastSavedAt,
    lastPublishedAt,
    hasUnpublishedChanges,
    authContrastIssues,
    checkoutContrastIssues,
    menuCardContrastIssues,
    menuCartContrastIssues,
    menuFooterContrastIssues,
    menuHeaderContrastIssues,
    menuNavigationContrastIssues,
    menuThemeContrastIssues,
    unsavedFieldLabels,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    flashToast,
    handleUndo,
    handleRedo,
    handleFieldChange,
    updateThemePatch,
    retireThemeMediaUrl,
    handleSave,
    handlePublish,
  }
}
