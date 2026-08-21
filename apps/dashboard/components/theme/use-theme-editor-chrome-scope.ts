'use client'

import {
  resolveHomeChromeTheme,
  type GarsonlessTheme,
  type HomeChromeTarget,
  type HomeChromeThemeOverride,
} from '@garsonless/design-engine'
import type { SettingsGroup } from '@garsonless/ui/themes'
import { ensureHomeV2, homeV2Patch } from './home-theme-editor-model'
import {
  buildMenuHeaderGroupResetPatch,
  getMenuHeaderOverride,
  isMenuHeaderEditorGroup,
  projectMenuHeaderFieldChange,
} from './menu-header-editor-scope'

type ThemeField = SettingsGroup['fields'][number]

interface ThemeEditorChromeScopeOptions {
  activeGroup: string
  activeGroupData?: SettingsGroup
  experienceSurface: string
  selectedHomeSectionId: string | null
  previewTheme: GarsonlessTheme
  resolvedMenuPreviewTheme: GarsonlessTheme
  overrides: Partial<GarsonlessTheme>
  defaults: GarsonlessTheme
  updateThemePatch: (patch: Partial<GarsonlessTheme>) => void
  flashToast: (message: string) => void
}

export function useThemeEditorChromeScope({
  activeGroup,
  activeGroupData,
  experienceSurface,
  selectedHomeSectionId,
  previewTheme,
  resolvedMenuPreviewTheme,
  overrides,
  defaults,
  updateThemePatch,
  flashToast,
}: ThemeEditorChromeScopeOptions) {
  const sharedChromeActive = experienceSurface === 'home'
    && (selectedHomeSectionId === '__shared-header' || selectedHomeSectionId === '__shared-footer')
  const sharedChromeTarget: HomeChromeTarget | null = sharedChromeActive
    ? selectedHomeSectionId === '__shared-header' ? 'header' : 'footer'
    : null
  const sharedChromeOverrides = sharedChromeTarget
    ? previewTheme.surfaces?.home.chrome?.[sharedChromeTarget] ?? {}
    : {}
  const scopedHomeChromeTheme = sharedChromeTarget
    ? resolveHomeChromeTheme(previewTheme, sharedChromeTarget)
    : previewTheme
  const sharedChromeCustomized = Object.keys(sharedChromeOverrides).length > 0
  const menuHeaderActive = experienceSurface === 'menu' && isMenuHeaderEditorGroup(activeGroup)
  const menuHeaderOverrides = menuHeaderActive ? getMenuHeaderOverride(previewTheme) : {}

  const updateHomeChromeOverrides = (target: HomeChromeTarget, nextOverride: HomeChromeThemeOverride) => {
    const homeState = ensureHomeV2(previewTheme)
    const chrome = { ...(homeState.home.chrome ?? {}) }
    if (Object.keys(nextOverride).length > 0) chrome[target] = nextOverride
    else delete chrome[target]
    updateThemePatch(homeV2Patch(previewTheme, {
      ...homeState.home,
      ...(Object.keys(chrome).length > 0 ? { chrome } : { chrome: undefined }),
    }, homeState.sectionSettings))
  }

  const changeHomeField = (field: ThemeField, value: unknown) => {
    if (!sharedChromeTarget) return
    const key = field.themeField as keyof GarsonlessTheme
    const next = { ...sharedChromeOverrides } as Record<string, unknown>
    if (JSON.stringify(value) === JSON.stringify(previewTheme[key])) delete next[field.themeField]
    else next[field.themeField] = value
    updateHomeChromeOverrides(sharedChromeTarget, next as HomeChromeThemeOverride)
  }
  const changeMenuField = (field: ThemeField, value: unknown) => {
    if (!menuHeaderActive) return
    const projected = projectMenuHeaderFieldChange(previewTheme, field.themeField as keyof GarsonlessTheme, value)
    updateThemePatch(projected.patch)
    if (projected.movedHeaderAction) flashToast('Header en fazla iki hızlı aksiyon taşır; düşük öncelikli aksiyon Drawer’a alındı')
  }
  const reset = () => {
    if (sharedChromeTarget) {
      if (!sharedChromeCustomized) return
      updateHomeChromeOverrides(sharedChromeTarget, {})
      flashToast(sharedChromeTarget === 'header' ? 'Header Ana sayfa temel görünümüne döndü' : 'Footer ortak temel ayarlara döndü')
      return
    }
    if (!menuHeaderActive || !activeGroupData) return
    const keys = activeGroupData.fields.map((field) => field.themeField as keyof GarsonlessTheme)
    if (!keys.some((key) => Object.hasOwn(menuHeaderOverrides, key))) return
    if (activeGroup === 'header' && !window.confirm('Menü Header ayarları miras alınan değerlere döndürülsün mü?')) return
    updateThemePatch(buildMenuHeaderGroupResetPatch(previewTheme, keys))
    flashToast('Menü Header paneli miras alınan değerlere döndü')
  }
  const copy = async () => {
    if (!activeGroupData || (!sharedChromeTarget && !menuHeaderActive)) return
    const sourceTheme = sharedChromeTarget ? scopedHomeChromeTheme : resolvedMenuPreviewTheme
    const payload = Object.fromEntries(activeGroupData.fields.map((field) => [field.themeField, sourceTheme[field.themeField as keyof GarsonlessTheme]]))
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      flashToast('Ayarlar kopyalandı')
    } catch {
      flashToast('Kopyalama başarısız')
    }
  }

  return {
    active: sharedChromeActive || menuHeaderActive,
    sharedChromeActive,
    menuHeaderActive,
    theme: sharedChromeActive ? scopedHomeChromeTheme : menuHeaderActive ? resolvedMenuPreviewTheme : previewTheme,
    overrides: sharedChromeActive ? sharedChromeOverrides : menuHeaderActive ? menuHeaderOverrides : overrides,
    defaults: sharedChromeActive ? scopedHomeChromeTheme : menuHeaderActive ? previewTheme : defaults,
    customized: sharedChromeCustomized,
    inheritanceTarget: sharedChromeTarget,
    changeField: sharedChromeActive ? changeHomeField : changeMenuField,
    reset,
    copy,
  }
}
