'use client'

import { useEffect, useMemo, useState, type CSSProperties, type ChangeEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import {
  inspectAuthSurfaceContrast,
  inspectCheckoutSurfaceContrast,
  resolveAuthErrorState,
  resolveAuthOtpState,
  resolveAuthSuccessState,
  resolveAuthSurfacePalette,
  resolveCheckoutErrorState,
  resolveCheckoutPaymentState,
  resolveCheckoutSuccessState,
  resolveCheckoutSurfacePalette,
  resolveCheckoutTablePaymentState,
  DEFAULT_THEME,
  type AuthContrastIssue,
  type AuthErrorIcon,
  type AuthErrorStateTheme,
  type AuthHeaderTheme,
  type AuthOtpStateTheme,
  type AuthPreviewState,
  type AuthStateLayoutTheme,
  type AuthSuccessIcon,
  type AuthSuccessStateTheme,
  type AuthSurfaceStatesTheme,
  type CheckoutContrastIssue,
  type CheckoutErrorIcon,
  type CheckoutErrorStateTheme,
  type CheckoutPaymentLayoutTheme,
  type CheckoutPaymentStateTheme,
  type CheckoutPreviewState,
  type CheckoutResultLayoutTheme,
  type CheckoutSuccessIcon,
  type CheckoutSuccessStateTheme,
  type CheckoutSurfaceStatesTheme,
  type CheckoutTablePaymentIcon,
  type CheckoutTablePaymentStateTheme,
  type GarsonlessTheme,
  type HomeSurfaceBlock,
  type ThemeEditorSurface,
  type ThemeSurfaces,
} from '@garsonless/design-engine'
import { I, type Icon } from '../../lib/ui'
import { uploadThemeMedia, uploadThemeVideo } from '../../lib/actions/theme'
import { HOME_SECTION_LIBRARY, SECTION_SETTING_SCHEMA } from './theme-editor-section-registry'
import { ensureHomeV2, homeV2Patch } from './home-theme-editor-model'
import {
  ChefPickIconUploadPanels,
  GalleryUploadPanel,
  PromoSliderImageUploadPanel,
  SectionImageUploadPanel,
  SectionSettingsEditor,
} from './ThemeSectionSettings'
import { getAvailableSectionTabs, resolveEffectiveEditorTab, type EditorTab } from './theme-editor-properties-model'

const AUTH_STATES: Array<{ id: AuthPreviewState; label: string }> = [
  { id: 'join', label: 'Üyelik' },
  { id: 'otp', label: 'OTP' },
  { id: 'success', label: 'Başarılı dönüş' },
  { id: 'error', label: 'Hata' },
]

const CHECKOUT_STATES: Array<{ id: CheckoutPreviewState; label: string }> = [
  { id: 'cart', label: 'Sepet' },
  { id: 'payment', label: 'Ödeme formu' },
  { id: 'success', label: 'Başarılı' },
  { id: 'table-payment', label: 'Masada ödeme' },
  { id: 'error', label: 'Hata' },
]

const SUCCESS_ICON_OPTIONS: Array<{ id: AuthSuccessIcon; label: string; icon: Icon }> = [
  { id: 'check', label: 'Onay', icon: I.check },
  { id: 'shield', label: 'Güvenli', icon: I.shield },
  { id: 'sparkles', label: 'Kutlama', icon: I.sparkles },
  { id: 'star', label: 'Yıldız', icon: I.star },
]

const ERROR_ICON_OPTIONS: Array<{ id: AuthErrorIcon; label: string; icon: Icon }> = [
  { id: 'warn', label: 'Uyarı', icon: I.warn },
  { id: 'close', label: 'Kapat', icon: I.close },
  { id: 'refresh', label: 'Yenile', icon: I.refresh },
  { id: 'lock', label: 'Kilit', icon: I.lock },
]

const CHECKOUT_SUCCESS_ICON_OPTIONS: Array<{ id: CheckoutSuccessIcon; label: string; icon: Icon }> = [
  { id: 'check', label: 'Onay', icon: I.check },
  { id: 'receipt', label: 'Fiş', icon: I.receipt },
  { id: 'shield', label: 'Güvenli', icon: I.shield },
  { id: 'sparkles', label: 'Kutlama', icon: I.sparkles },
]

const CHECKOUT_TABLE_ICON_OPTIONS: Array<{ id: CheckoutTablePaymentIcon; label: string; icon: Icon }> = [
  { id: 'bell', label: 'Zil', icon: I.bell },
  { id: 'receipt', label: 'Fiş', icon: I.receipt },
  { id: 'clock', label: 'Bekliyor', icon: I.clock },
  { id: 'card', label: 'Ödeme', icon: I.card },
]

const CHECKOUT_ERROR_ICON_OPTIONS: Array<{ id: CheckoutErrorIcon; label: string; icon: Icon }> = [
  { id: 'warn', label: 'Uyarı', icon: I.warn },
  { id: 'close', label: 'Kapat', icon: I.close },
  { id: 'refresh', label: 'Yenile', icon: I.refresh },
  { id: 'lock', label: 'Kilit', icon: I.lock },
]

type AuthColorFieldKey = 'background' | 'surface' | 'text' | 'mutedText' | 'fieldSurface' | 'fieldBorder' | 'accent' | 'cta' | 'ctaText'
type EditableAuthState = Exclude<AuthPreviewState, 'join'>
type EditableAuthStateTheme = AuthOtpStateTheme | AuthSuccessStateTheme | AuthErrorStateTheme
type EditableCheckoutState = Exclude<CheckoutPreviewState, 'cart'>
type EditableCheckoutStateTheme = CheckoutPaymentStateTheme | CheckoutSuccessStateTheme | CheckoutTablePaymentStateTheme | CheckoutErrorStateTheme
type CheckoutStatusIcon = CheckoutSuccessIcon | CheckoutTablePaymentIcon | CheckoutErrorIcon

function resolvedSurfaces(theme: GarsonlessTheme): ThemeSurfaces {
  return theme.surfaces ?? DEFAULT_THEME.surfaces!
}

export function ThemeExperienceSidebar({
  width,
  surface,
  theme,
  selectedSectionId,
  authState,
  checkoutState,
  sectionTriggerRef,
  onSelectSection,
  onSelectShared,
  onOpenSectionPicker,
  onAuthStateChange,
  onCheckoutStateChange,
  onPatch,
}: {
  width: number
  surface: ThemeEditorSurface
  theme: GarsonlessTheme
  selectedSectionId: string | null
  authState: AuthPreviewState
  checkoutState: CheckoutPreviewState
  sectionTriggerRef: RefObject<HTMLButtonElement | null>
  onSelectSection: (id: string | null) => void
  onSelectShared: (target: 'header' | 'footer') => void
  onOpenSectionPicker: () => void
  onAuthStateChange: (state: AuthPreviewState) => void
  onCheckoutStateChange: (state: CheckoutPreviewState) => void
  onPatch: (patch: Partial<GarsonlessTheme>) => void
}) {
  const surfaces = resolvedSurfaces(theme)
  const [dragId, setDragId] = useState<string | null>(null)

  if (surface !== 'home') {
    const states = surface === 'auth' ? AUTH_STATES : CHECKOUT_STATES
    const current = surface === 'auth' ? authState : checkoutState
    return (
      <SurfaceAside width={width} title={surface === 'auth' ? 'Giriş' : 'Checkout'} subtitle="Önizleme durumu">
        <div style={{ padding: 8 }}>
          {states.map((state) => (
            <button
              key={state.id}
              type="button"
              aria-pressed={current === state.id}
              onClick={() => surface === 'auth'
                ? onAuthStateChange(state.id as AuthPreviewState)
                : onCheckoutStateChange(state.id as CheckoutPreviewState)}
              style={navButtonStyle(current === state.id)}
            >
              <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 8, background: current === state.id ? 'var(--surface)' : 'var(--surface-3)' }}>
                {state.id === 'error' ? <I.warn size={17} /> : state.id === 'success' ? <I.check size={17} /> : surface === 'auth' ? <I.userCircle size={17} /> : <I.receipt size={17} />}
              </span>
              <span>{state.label}</span>
              {current === state.id && <I.chevRight size={17} style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
          <div role="note" style={noticeStyle}>
            <I.shield size={17} />
            <span>{surface === 'auth' ? 'Önizleme OTP veya OAuth isteği oluşturmaz.' : 'Önizleme sipariş veya ödeme isteği oluşturmaz.'}</span>
          </div>
        </div>
      </SurfaceAside>
    )
  }

  const homeState = ensureHomeV2(theme)
  const sections = homeState.home.blocks
  const moveSection = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    const from = sections.findIndex((section) => section.id === sourceId)
    const to = sections.findIndex((section) => section.id === targetId)
    if (from < 0 || to < 0) return
    const next = [...sections]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved!)
    onPatch(homeV2Patch(theme, { ...homeState.home, blocks: next }, homeState.sectionSettings))
  }
  const patchSection = (id: string, patch: Partial<HomeSurfaceBlock>) => {
    onPatch(homeV2Patch(theme, {
      ...homeState.home,
      blocks: sections.map((section) => section.id === id ? { ...section, ...patch } : section),
    }, homeState.sectionSettings))
  }

  return (
    <SurfaceAside width={width} title="Ana sayfa" subtitle="Menü bileşenleri + Video Hero">
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--divider)' }}>
        <label style={{ minHeight: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px', borderRadius: 10, background: surfaces.home.enabled ? 'var(--positive-bg)' : 'var(--surface-3)', color: 'var(--text)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={homeState.home.enabled}
            onChange={(event) => onPatch(homeV2Patch(theme, { ...homeState.home, enabled: event.target.checked }, homeState.sectionSettings))}
            style={{ width: 18, height: 18, accentColor: 'var(--positive)' }}
          />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 750 }}>Ana sayfayı etkinleştir</span>
            <span style={{ display: 'block', marginTop: 2, color: 'var(--text-3)', fontSize: 11.5 }}>Yayınlanınca /{`{slug}`} ana sayfa olur</span>
          </span>
        </label>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '10px 8px 20px' }}>
        <h3 style={groupLabelStyle}>Ortak alanlar</h3>
        <button type="button" aria-pressed={selectedSectionId === '__shared-header'} onClick={() => onSelectShared('header')} style={sharedChromeRowStyle(selectedSectionId === '__shared-header')}>
          <span style={sharedChromeIconStyle}><I.header size={17} /></span>
          <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: 12.5 }}>Ortak Header</strong><span style={sharedChromeMetaStyle}>Menü ile aynı bileşen ve ayarlar</span></span>
          <span style={sharedBadgeStyle}>Ortak</span><I.chevRight size={16} />
        </button>

        <h3 style={groupLabelStyle}>Sayfa akışı</h3>
        {sections.map((section, index) => {
          const catalog = HOME_SECTION_LIBRARY.find((item) => item.id === section.sectionId)
          if (!catalog) return null
          const Icon = I[catalog.icon]
          const selected = selectedSectionId === section.id
          const settings = homeState.sectionSettings[section.id] ?? {}
          const displayTitle = settings.title?.trim() || catalog.label
          return (
            <div
              key={section.id}
              draggable
              onDragStart={() => setDragId(section.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => { if (dragId) moveSection(dragId, section.id) }}
              style={{ ...sectionRowStyle, background: selected ? 'var(--surface-inset)' : 'transparent', opacity: section.enabled ? 1 : .55 }}
            >
              <I.drag size={17} style={{ color: 'var(--text-4)', cursor: 'grab' }} />
              <button type="button" aria-label={`${displayTitle} bölümünü düzenle`} title={displayTitle} onClick={() => onSelectSection(section.id)} style={{ flex: 1, minWidth: 0, padding: 0, border: 0, background: 'transparent', display: 'flex', alignItems: 'center', gap: 9, color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <Icon size={17} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: '-webkit-box', fontSize: 12.5, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', overflowWrap: 'anywhere', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{displayTitle}</span>
                  <span style={{ display: 'block', marginTop: 1, color: 'var(--text-3)', fontSize: 10.5 }}>{catalog.plan === 'pro' ? 'Pro · ' : ''}{catalog.sub}</span>
                </span>
              </button>
              <button type="button" aria-label={section.enabled ? 'Bölümü gizle' : 'Bölümü göster'} onClick={() => patchSection(section.id, { enabled: !section.enabled })} style={iconButtonStyle}>
                {section.enabled ? <I.eye size={16} /> : <I.eyeOff size={16} />}
              </button>
              {selected ? <details
                style={{ position: 'relative', flex: '0 0 auto' }}
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') return
                  event.preventDefault()
                  event.currentTarget.removeAttribute('open')
                  event.currentTarget.querySelector<HTMLElement>('summary')?.focus()
                }}
              >
                <summary aria-label="Bölüm işlemleri" style={actionSummaryStyle}><I.more size={16} /></summary>
                <div role="menu" aria-label={`${displayTitle} işlemleri`} style={sectionActionMenuStyle}>
                  <button type="button" role="menuitem" onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open')
                    const clone = { ...section, id: `${section.id}-copy-${Date.now().toString(36)}` }
                    const next = [...sections]
                    next.splice(index + 1, 0, clone)
                    const nextSettings = { ...homeState.sectionSettings, [clone.id]: { ...(homeState.sectionSettings[section.id] ?? {}) } }
                    onPatch(homeV2Patch(theme, { ...homeState.home, blocks: next }, nextSettings))
                    onSelectSection(clone.id)
                  }} style={actionMenuItemStyle}><I.copy size={16} />Bölümü çoğalt</button>
                  <button type="button" role="menuitem" onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open')
                    const nextSettings = { ...homeState.sectionSettings }
                    delete nextSettings[section.id]
                    onPatch(homeV2Patch(theme, { ...homeState.home, blocks: sections.filter((candidate) => candidate.id !== section.id) }, nextSettings))
                    if (selected) onSelectSection(null)
                  }} style={actionMenuItemStyle}><I.trash size={16} />Bölümü kaldır</button>
                </div>
              </details> : null}
            </div>
          )
        })}

        <button ref={sectionTriggerRef} type="button" onClick={onOpenSectionPicker} style={addSectionButtonStyle}>
          <span style={addSectionIconStyle}><I.plus size={18} /></span>
          <span style={{ flex: 1, textAlign: 'left' }}><strong style={{ display: 'block' }}>Bölüm ekle</strong><span style={{ display: 'block', marginTop: 2, color: 'var(--text-3)', fontSize: 10.5, fontWeight: 550 }}>Menü bileşenlerini ve Video Hero’yu ekle</span></span>
          <I.chevRight size={17} />
        </button>

        <h3 style={{ ...groupLabelStyle, marginTop: 18 }}>Ortak alanlar</h3>
        <button type="button" aria-pressed={selectedSectionId === '__shared-footer'} onClick={() => onSelectShared('footer')} style={sharedChromeRowStyle(selectedSectionId === '__shared-footer')}>
          <span style={sharedChromeIconStyle}><I.layout size={17} /></span>
          <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: 12.5 }}>Ortak Footer</strong><span style={sharedChromeMetaStyle}>İletişim ve sosyal bağlantılar Menü ile ortak</span></span>
          <span style={sharedBadgeStyle}>Ortak</span><I.chevRight size={16} />
        </button>
      </div>
    </SurfaceAside>
  )
}

export function ThemeExperienceProperties({
  width,
  restaurantId,
  canAddAdvancedSections,
  surface,
  authState,
  checkoutState,
  theme,
  selectedSectionId,
  menuCategories,
  menuItems,
  onPatch,
}: {
  width: number
  restaurantId: string
  canAddAdvancedSections: boolean
  surface: ThemeEditorSurface
  authState: AuthPreviewState
  checkoutState: CheckoutPreviewState
  theme: GarsonlessTheme
  selectedSectionId: string | null
  menuCategories: Array<{ id: string; name: string; parentId?: string | null }>
  menuItems: Array<{ id: string; name: string; categoryId: string; categoryName: string; price?: number; images?: unknown; isAvailable?: boolean }>
  onPatch: (patch: Partial<GarsonlessTheme>) => void
}) {
  const surfaces = resolvedSurfaces(theme)
  const homeState = ensureHomeV2(theme)
  const selectedSection = useMemo(
    () => homeState.home.blocks.find((section) => section.id === selectedSectionId) ?? null,
    [homeState.home.blocks, selectedSectionId],
  )
  const selectedHomeDefinition = selectedSection
    ? HOME_SECTION_LIBRARY.find((item) => item.id === selectedSection.sectionId) ?? null
    : null
  const [homeEditorTab, setHomeEditorTab] = useState<EditorTab>('content')
  const homeSectionFields = selectedSection ? SECTION_SETTING_SCHEMA[selectedSection.sectionId] ?? [] : []
  const homeTabs = getAvailableSectionTabs(homeSectionFields)
  const effectiveHomeTab = resolveEffectiveEditorTab(homeTabs, homeEditorTab)
  const visibleHomeFields = homeSectionFields.filter((field) => field.editorTab === effectiveHomeTab)
  const selectedHomeSettings = selectedSection ? homeState.sectionSettings[selectedSection.id] ?? {} : {}
  const updateSurface = (nextSurface: ThemeSurfaces['auth'] | ThemeSurfaces['checkout']) => {
    onPatch({ experienceVersion: 2, surfaces: { ...surfaces, [surface]: nextSurface } })
  }
  const updateSelected = (patch: Record<string, string | undefined>) => {
    if (!selectedSection) return
    const next = { ...selectedHomeSettings }
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '') delete next[key]
      else next[key] = value
    }
    onPatch(homeV2Patch(theme, homeState.home, { ...homeState.sectionSettings, [selectedSection.id]: next }))
  }
  const updateAuthHeader = (patch: Partial<AuthHeaderTheme>) => {
    updateSurface({
      ...surfaces.auth,
      header: { ...surfaces.auth.header, ...patch },
    })
  }
  const updateAuthOverride = (key: AuthColorFieldKey, value: string | undefined) => {
    const nextOverride = { ...(surfaces.auth.override ?? {}) }
    if (value === undefined) delete nextOverride[key]
    else nextOverride[key] = value
    updateSurface({
      ...surfaces.auth,
      ...(Object.keys(nextOverride).length > 0 ? { override: nextOverride } : { override: undefined }),
    })
  }
  const updateCheckoutRadius = (radius: number) => {
    updateSurface({
      ...surfaces.checkout,
      override: { ...(surfaces.checkout.override ?? {}), radius },
    })
  }
  const updateAuthState = (state: EditableAuthState, patch: Partial<EditableAuthStateTheme>) => {
    const current = surfaces.auth.states?.[state] ?? {}
    const nextState = { ...current } as Record<string, unknown>
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete nextState[key]
      else nextState[key] = value
    }
    const states = {
      ...(surfaces.auth.states ?? {}),
      [state]: nextState,
    } as AuthSurfaceStatesTheme
    updateSurface({ ...surfaces.auth, states })
  }
  const updateAuthStateLayout = (state: EditableAuthState, patch: Partial<AuthStateLayoutTheme>) => {
    const current = surfaces.auth.states?.[state] ?? {}
    updateAuthState(state, { layout: { ...(current.layout ?? {}), ...patch } })
  }
  const resetAuthState = (state: EditableAuthState) => {
    const states = { ...(surfaces.auth.states ?? {}) }
    delete states[state]
    updateSurface({
      ...surfaces.auth,
      ...(Object.keys(states).length > 0 ? { states } : { states: undefined }),
    })
  }
  const checkoutStateKey = (state: EditableCheckoutState): keyof CheckoutSurfaceStatesTheme =>
    state === 'table-payment' ? 'tablePayment' : state
  const updateCheckoutState = (state: EditableCheckoutState, patch: Partial<EditableCheckoutStateTheme>) => {
    const key = checkoutStateKey(state)
    const current = surfaces.checkout.states?.[key] ?? {}
    const nextState = { ...current } as Record<string, unknown>
    for (const [field, value] of Object.entries(patch)) {
      if (value === undefined) delete nextState[field]
      else nextState[field] = value
    }
    const states = {
      ...(surfaces.checkout.states ?? {}),
      [key]: nextState,
    } as CheckoutSurfaceStatesTheme
    updateSurface({ ...surfaces.checkout, states })
  }
  const updateCheckoutPaymentLayout = (patch: Partial<CheckoutPaymentLayoutTheme>) => {
    const current = surfaces.checkout.states?.payment ?? {}
    updateCheckoutState('payment', { layout: { ...(current.layout ?? {}), ...patch } })
  }
  const updateCheckoutResultLayout = (state: Exclude<EditableCheckoutState, 'payment'>, patch: Partial<CheckoutResultLayoutTheme>) => {
    const key = checkoutStateKey(state)
    const current = surfaces.checkout.states?.[key] as CheckoutSuccessStateTheme | CheckoutTablePaymentStateTheme | CheckoutErrorStateTheme | undefined
    updateCheckoutState(state, { layout: { ...(current?.layout ?? {}), ...patch } })
  }
  const resetCheckoutState = (state: EditableCheckoutState) => {
    const key = checkoutStateKey(state)
    const states = { ...(surfaces.checkout.states ?? {}) }
    delete states[key]
    updateSurface({
      ...surfaces.checkout,
      ...(Object.keys(states).length > 0 ? { states } : { states: undefined }),
    })
  }
  const updateCheckoutOverride = (key: AuthColorFieldKey, value: string | undefined) => {
    const nextOverride = { ...(surfaces.checkout.override ?? {}) }
    if (value === undefined) delete nextOverride[key]
    else nextOverride[key] = value
    updateSurface({
      ...surfaces.checkout,
      ...(Object.keys(nextOverride).length > 0 ? { override: nextOverride } : { override: undefined }),
    })
  }
  const authPalette = resolveAuthSurfacePalette(theme)
  const authContrastIssues = inspectAuthSurfaceContrast(theme)
  const checkoutPalette = resolveCheckoutSurfacePalette(theme)
  const checkoutContrastIssues = inspectCheckoutSurfaceContrast(theme)

  return (
    <aside style={{ width, minWidth: 0, boxSizing: 'border-box', flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', overflowX: 'hidden', overflowY: 'auto' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--divider)' }}>
        <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 14, fontWeight: 750 }}>Yüzey ayarları</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: 11.5 }}>Güvenli içerik ve görünüm alanları</p>
      </div>
      <div style={{ minWidth: 0, boxSizing: 'border-box', padding: 16 }}>
        {surface === 'home' && selectedSection && (
          <>
            <div style={{ ...settingsCardStyle, marginBottom: 14 }}>
              <SettingsCardHeader icon={selectedHomeDefinition ? (() => { const Icon = I[selectedHomeDefinition.icon]; return <Icon size={17} /> })() : <I.layout size={17} />} title={selectedHomeDefinition?.label ?? 'Ana sayfa bölümü'} meta={selectedHomeDefinition?.id === 'storefront-video-hero' ? 'Pro · Ana sayfa' : selectedHomeDefinition?.plan === 'pro' ? 'Pro · Menü bileşeni' : 'Menü bileşeni'} />
              <div role="tablist" aria-label="Ana sayfa bölüm ayarları" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, homeTabs.length)},minmax(0,1fr))`, gap: 5, marginBottom: 14 }}>
                {homeTabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={effectiveHomeTab === tab.id} onClick={() => setHomeEditorTab(tab.id)} style={homeTabStyle(effectiveHomeTab === tab.id)}>{tab.label}</button>)}
              </div>

              {effectiveHomeTab === 'design' && selectedSection.sectionId === 'hero-banner' && <SectionImageUploadPanel restaurantId={restaurantId} label="Hero Banner" value={selectedHomeSettings.imageUrl ?? ''} onChange={(value) => updateSelected({ imageUrl: value })} />}
              {effectiveHomeTab === 'design' && selectedSection.sectionId === 'gallery' && <GalleryUploadPanel restaurantId={restaurantId} values={selectedHomeSettings} onChange={(key, value) => updateSelected({ [key]: value })} />}
              {effectiveHomeTab === 'design' && selectedSection.sectionId === 'promo-slider' && <PromoSliderImageUploadPanel restaurantId={restaurantId} values={selectedHomeSettings} onChange={(key, value) => updateSelected({ [key]: value })} />}
              {effectiveHomeTab === 'design' && selectedSection.sectionId === 'chef-pick' && <ChefPickIconUploadPanels restaurantId={restaurantId} values={selectedHomeSettings} onChange={(key, value) => updateSelected({ [key]: value })} />}
              {effectiveHomeTab === 'design' && selectedSection.sectionId === 'storefront-video-hero' && (
              <HeroVideoUploader
                restaurantId={restaurantId}
                enabled={canAddAdvancedSections}
                videoUrl={selectedHomeSettings.videoUrl ?? ''}
                posterUrl={selectedHomeSettings.posterUrl ?? ''}
                onChange={(patch) => updateSelected(patch)}
              />
              )}

              <SectionSettingsEditor
                fields={visibleHomeFields}
                values={selectedHomeSettings}
                menuCategories={menuCategories}
                menuItems={menuItems}
                menuHref={`/dashboard/${restaurantId}/menu`}
                onChange={(key, value) => updateSelected({ [key]: value })}
              />
              <button type="button" onClick={() => {
                const next = { ...homeState.sectionSettings }
                delete next[selectedSection.id]
                onPatch(homeV2Patch(theme, homeState.home, next))
              }} style={homeResetButtonStyle}>Bu bölümün ayarlarını varsayılana döndür</button>
            </div>
          </>
        )}
        {surface === 'home' && !selectedSection && <EmptyProperties text="Düzenlemek için soldan bir ana sayfa bölümü seç." />}
        {surface === 'auth' && (
          <>
            {authState !== 'join' && <AuthStateSettings
              state={authState}
              auth={surfaces.auth}
              onChange={(patch) => updateAuthState(authState, patch)}
              onLayoutChange={(patch) => updateAuthStateLayout(authState, patch)}
              onReset={() => resetAuthState(authState)}
            />}

            <div style={settingsCardStyle}>
              <SettingsCardHeader icon={<I.image size={17} />} title="Header medyası" meta="Tüm durumlarda sabit" />
              <AuthHeaderMediaUploader
                restaurantId={restaurantId}
                header={surfaces.auth.header}
                onChange={updateAuthHeader}
              />
              <Field label="Görsel yerleşimi"><select value={surfaces.auth.header.imageFit ?? 'cover'} onChange={(event) => updateAuthHeader({ imageFit: event.target.value as AuthHeaderTheme['imageFit'] })} style={inputStyle}><option value="cover">Alanı doldur (cover)</option><option value="contain">Görselin tamamı (contain)</option></select></Field>
              {surfaces.auth.header.backgroundImageUrl && <AuthImageFocusControl header={surfaces.auth.header} onChange={updateAuthHeader} />}
              <Field label="Header yüksekliği"><select value={surfaces.auth.header.height ?? 'standard'} onChange={(event) => updateAuthHeader({ height: event.target.value as AuthHeaderTheme['height'] })} style={inputStyle}><option value="compact">Kompakt</option><option value="standard">Standart</option><option value="wide">Geniş</option></select></Field>
              <Field label={`Fotoğraf karartması · %${surfaces.auth.header.overlay}`}><input type="range" min={0} max={85} step={1} value={surfaces.auth.header.overlay} onChange={(event) => updateAuthHeader({ overlay: Number(event.target.value) })} style={rangeStyle} /></Field>
              <Field label="Header zemin rengi"><div style={{ display: 'flex', gap: 8 }}><input aria-label="Header zemin rengini seç" type="color" value={surfaces.auth.header.backgroundColor ?? '#12271c'} onChange={(event) => updateAuthHeader({ backgroundColor: event.target.value })} style={colorSwatchStyle} /><input aria-label="Header zemin rengi" value={surfaces.auth.header.backgroundColor ?? '#12271c'} onChange={(event) => { if (/^#[0-9a-f]{6}$/i.test(event.target.value)) updateAuthHeader({ backgroundColor: event.target.value }) }} style={inputStyle} /></div></Field>
            </div>

            <div style={{ ...settingsCardStyle, marginTop: 14 }}>
              <SettingsCardHeader icon={<I.header size={17} />} title="Header içeriği" />
              {surfaces.auth.header.backgroundImageUrl && surfaces.auth.header.logoMode === 'restaurant' && <div role="alert" style={warningNoticeStyle}><I.warn size={17} /><span>Fotoğraf ve varsayılan işletme logosu aynı alanda çakışabilir.</span><button type="button" onClick={() => updateAuthHeader({ logoMode: 'none' })} style={warningActionStyle}>Logoyu gizle</button></div>}
              <Field label="Logo"><select value={surfaces.auth.header.logoMode} onChange={(event) => updateAuthHeader({ logoMode: event.target.value as AuthHeaderTheme['logoMode'] })} style={inputStyle}><option value="none">Gösterme</option><option value="restaurant">İşletme logosu</option><option value="custom">Özel logo</option></select></Field>
              {surfaces.auth.header.logoMode === 'custom' && <AuthHeaderMediaUploader restaurantId={restaurantId} header={surfaces.auth.header} onChange={updateAuthHeader} logoOnly />}
              <Field label="Header başlığı (isteğe bağlı)"><input value={surfaces.auth.header.title ?? ''} maxLength={100} onChange={(event) => updateAuthHeader({ title: event.target.value })} style={inputStyle} placeholder="Örn. Masana hoş geldin" /></Field>
              <Field label="Slogan (isteğe bağlı)"><textarea value={surfaces.auth.header.slogan ?? ''} maxLength={180} rows={3} onChange={(event) => updateAuthHeader({ slogan: event.target.value })} style={{ ...inputStyle, paddingTop: 10, resize: 'vertical' }} placeholder="Kısa marka mesajın" /></Field>
              <Field label="Hizalama"><select value={surfaces.auth.header.align} onChange={(event) => updateAuthHeader({ align: event.target.value as AuthHeaderTheme['align'] })} style={inputStyle}><option value="center">Ortala</option><option value="left">Sola</option></select></Field>
              <Field label="İçerik tonu"><select value={surfaces.auth.header.contentTone ?? 'light'} onChange={(event) => updateAuthHeader({ contentTone: event.target.value as AuthHeaderTheme['contentTone'] })} style={inputStyle}><option value="light">Açık metin</option><option value="dark">Koyu metin</option></select></Field>
            </div>

            <div style={{ ...settingsCardStyle, marginTop: 14 }}>
              <SettingsCardHeader icon={<I.layout size={17} />} title="Form yüzeyi" />
              <Field label="Görünüm"><select value={surfaces.auth.preset} onChange={(event) => updateSurface({ ...surfaces.auth, preset: event.target.value as ThemeSurfaces['auth']['preset'] })} style={inputStyle}><option value="brand-panel">Marka paneli</option><option value="minimal">Minimal</option><option value="immersive">Görsel odaklı</option></select></Field>
              <AuthColorField label="Dış zemin" field="background" value={surfaces.auth.override?.background} effectiveValue={authPalette.background} onChange={updateAuthOverride} />
              <AuthColorField label="Form paneli" field="surface" value={surfaces.auth.override?.surface} effectiveValue={authPalette.surface} onChange={updateAuthOverride} />
              <AuthColorField label="Alan zemini" field="fieldSurface" value={surfaces.auth.override?.fieldSurface} effectiveValue={authPalette.fieldSurface} onChange={updateAuthOverride} />
              <AuthColorField label="Alan kenarlığı" field="fieldBorder" value={surfaces.auth.override?.fieldBorder} effectiveValue={authPalette.fieldBorder} onChange={updateAuthOverride} />
            </div>

            <div style={{ ...settingsCardStyle, marginTop: 14 }}>
              <SettingsCardHeader icon={<I.type size={17} />} title={authState === 'join' ? 'Form içeriği' : 'Form renkleri'} />
              {authState === 'join' && <>
                <Field label="Form başlığı"><input value={surfaces.auth.title ?? ''} maxLength={100} onChange={(event) => updateSurface({ ...surfaces.auth, title: event.target.value })} style={inputStyle} /></Field>
                <Field label="Form açıklaması"><textarea value={surfaces.auth.subtitle ?? ''} maxLength={240} rows={4} onChange={(event) => updateSurface({ ...surfaces.auth, subtitle: event.target.value })} style={{ ...inputStyle, paddingTop: 10 }} /></Field>
              </>}
              <AuthColorField label="Ana metin" field="text" value={surfaces.auth.override?.text} effectiveValue={authPalette.text} onChange={updateAuthOverride} />
              <AuthColorField label="İkincil metin" field="mutedText" value={surfaces.auth.override?.mutedText} effectiveValue={authPalette.mutedText} onChange={updateAuthOverride} />
              <AuthColorField label="Vurgu, link ve focus" field="accent" value={surfaces.auth.override?.accent} effectiveValue={authPalette.accent} onChange={updateAuthOverride} />
              <AuthColorField label="Ana CTA" field="cta" value={surfaces.auth.override?.cta} effectiveValue={authPalette.cta} onChange={updateAuthOverride} />
              <AuthColorField label="CTA metni" field="ctaText" value={surfaces.auth.override?.ctaText} effectiveValue={authPalette.ctaText} onChange={updateAuthOverride} />
              <ContrastStatus issues={authContrastIssues} />
            </div>
          </>
        )}
        {surface === 'checkout' && (
          <>
            {checkoutState !== 'cart' && <CheckoutStateSettings
              state={checkoutState}
              checkout={surfaces.checkout}
              onChange={(patch) => updateCheckoutState(checkoutState, patch)}
              onPaymentLayoutChange={updateCheckoutPaymentLayout}
              onResultLayoutChange={(patch) => updateCheckoutResultLayout(checkoutState as Exclude<EditableCheckoutState, 'payment'>, patch)}
              onReset={() => resetCheckoutState(checkoutState)}
            />}

            <div style={{ ...settingsCardStyle, marginTop: checkoutState === 'cart' ? 0 : 14 }}>
              <SettingsCardHeader icon={<I.receipt size={17} />} title="Checkout görünümü" meta="Tüm durumlarda ortak" />
              <Field label="Görünüm"><select value={surfaces.checkout.preset} onChange={(event) => updateSurface({ ...surfaces.checkout, preset: event.target.value as ThemeSurfaces['checkout']['preset'] })} style={inputStyle}><option value="clean">Temiz</option><option value="brand-header">Marka başlığı</option><option value="soft">Yumuşak yüzey</option></select></Field>
              <Field label="Panel boyutu"><select value={surfaces.checkout.sheetSize ?? 'standard'} onChange={(event) => updateSurface({ ...surfaces.checkout, sheetSize: event.target.value as NonNullable<ThemeSurfaces['checkout']['sheetSize']> })} style={inputStyle}><option value="compact">Kompakt</option><option value="standard">Standart</option><option value="large">Geniş</option></select></Field>
              <Field label={`Köşe yuvarlaklığı · ${surfaces.checkout.override?.radius ?? theme.radius}px`}><input type="range" min={4} max={28} step={1} value={surfaces.checkout.override?.radius ?? theme.radius} onChange={(event) => updateCheckoutRadius(Number(event.target.value))} style={rangeStyle} /></Field>
            </div>

            <div style={{ ...settingsCardStyle, marginTop: 14 }}>
              <SettingsCardHeader icon={<I.palette size={17} />} title="Checkout renkleri" meta="Semantik alanlar" />
              <AuthColorField label="Dış zemin" field="background" value={surfaces.checkout.override?.background} effectiveValue={checkoutPalette.background} onChange={updateCheckoutOverride} />
              <AuthColorField label="Panel ve kart" field="surface" value={surfaces.checkout.override?.surface} effectiveValue={checkoutPalette.surface} onChange={updateCheckoutOverride} />
              <AuthColorField label="Ana metin" field="text" value={surfaces.checkout.override?.text} effectiveValue={checkoutPalette.text} onChange={updateCheckoutOverride} />
              <AuthColorField label="İkincil metin" field="mutedText" value={surfaces.checkout.override?.mutedText} effectiveValue={checkoutPalette.mutedText} onChange={updateCheckoutOverride} />
              <AuthColorField label="Alan zemini" field="fieldSurface" value={surfaces.checkout.override?.fieldSurface} effectiveValue={checkoutPalette.fieldSurface} onChange={updateCheckoutOverride} />
              <AuthColorField label="Alan kenarlığı" field="fieldBorder" value={surfaces.checkout.override?.fieldBorder} effectiveValue={checkoutPalette.fieldBorder} onChange={updateCheckoutOverride} />
              <AuthColorField label="Vurgu ve focus" field="accent" value={surfaces.checkout.override?.accent} effectiveValue={checkoutPalette.accent} onChange={updateCheckoutOverride} />
              <AuthColorField label="Ana CTA" field="cta" value={surfaces.checkout.override?.cta} effectiveValue={checkoutPalette.cta} onChange={updateCheckoutOverride} />
              <AuthColorField label="CTA metni" field="ctaText" value={surfaces.checkout.override?.ctaText} effectiveValue={checkoutPalette.ctaText} onChange={updateCheckoutOverride} />
              <ContrastStatus issues={checkoutContrastIssues} />
            </div>
          </>
        )}
        {surface === 'home' && <SurfaceOverrideFields surface={surface} theme={theme} onPatch={onPatch} />}
      </div>
    </aside>
  )
}

function CheckoutStateSettings({
  state,
  checkout,
  onChange,
  onPaymentLayoutChange,
  onResultLayoutChange,
  onReset,
}: {
  state: EditableCheckoutState
  checkout: ThemeSurfaces['checkout']
  onChange: (patch: Partial<EditableCheckoutStateTheme>) => void
  onPaymentLayoutChange: (patch: Partial<CheckoutPaymentLayoutTheme>) => void
  onResultLayoutChange: (patch: Partial<CheckoutResultLayoutTheme>) => void
  onReset: () => void
}) {
  const payment = state === 'payment' ? resolveCheckoutPaymentState(checkout) : null
  const status = state === 'success'
    ? resolveCheckoutSuccessState(checkout)
    : state === 'table-payment'
      ? resolveCheckoutTablePaymentState(checkout)
      : state === 'error' ? resolveCheckoutErrorState(checkout) : null
  const stateKey: keyof CheckoutSurfaceStatesTheme = state === 'table-payment' ? 'tablePayment' : state
  const statusOverride = state === 'success'
    ? checkout.states?.success
    : state === 'table-payment'
      ? checkout.states?.tablePayment
      : state === 'error' ? checkout.states?.error : undefined
  const hasOverride = Boolean(checkout.states?.[stateKey])
  const stateLabel = state === 'payment' ? 'Ödeme formu' : state === 'success' ? 'Başarılı' : state === 'table-payment' ? 'Masada ödeme' : 'Hata'

  return <>
    <div style={settingsCardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {state === 'payment' ? <I.card size={17} /> : state === 'success' ? <I.check size={17} /> : state === 'table-payment' ? <I.bell size={17} /> : <I.warn size={17} />}
        <strong style={{ fontSize: 12.5 }}>{stateLabel} içeriği</strong>
        <button type="button" onClick={onReset} disabled={!hasOverride} style={{ ...stateResetButtonStyle, opacity: hasOverride ? 1 : .45 }}>Varsayılana dön</button>
      </div>

      {payment && <>
        <Field label="Başlık"><input value={payment.title} maxLength={100} onChange={(event) => onChange({ title: event.target.value })} style={inputStyle} /></Field>
        <Field label="Açıklama"><textarea value={payment.description} maxLength={240} rows={3} onChange={(event) => onChange({ description: event.target.value })} style={{ ...inputStyle, paddingTop: 10, resize: 'vertical' }} /></Field>
        <Field label="Tutar etiketi"><input value={payment.amountLabel} maxLength={60} onChange={(event) => onChange({ amountLabel: event.target.value })} style={inputStyle} /></Field>
        <Field label="Ödeme yöntemi başlığı"><input value={payment.methodSectionTitle} maxLength={60} onChange={(event) => onChange({ methodSectionTitle: event.target.value })} style={inputStyle} /></Field>
        <Field label="Ödeyen kişi başlığı"><input value={payment.buyerSectionTitle} maxLength={60} onChange={(event) => onChange({ buyerSectionTitle: event.target.value })} style={inputStyle} /></Field>
        <Field label="Ödeyen kişi açıklaması"><input value={payment.buyerSectionDescription} maxLength={160} onChange={(event) => onChange({ buyerSectionDescription: event.target.value })} style={inputStyle} /></Field>
        <Field label="Kart butonu etiketi"><input value={payment.cardActionLabel} maxLength={60} onChange={(event) => onChange({ cardActionLabel: event.target.value })} style={inputStyle} /></Field>
        <Field label="Masada ödeme butonu"><input value={payment.tableActionLabel} maxLength={60} onChange={(event) => onChange({ tableActionLabel: event.target.value })} style={inputStyle} /></Field>
      </>}

      {status && <>
        <Field label="Başlık"><input value={status.title} maxLength={100} onChange={(event) => onChange({ title: event.target.value })} style={inputStyle} /></Field>
        {'description' in status && <Field label="Açıklama"><textarea value={status.description} maxLength={240} rows={4} onChange={(event) => onChange({ description: event.target.value })} style={{ ...inputStyle, paddingTop: 10, resize: 'vertical' }} /></Field>}
        <Field label={state === 'error' ? 'Tekrar dene butonu' : 'Ana buton metni'}><input value={status.primaryActionLabel} maxLength={60} onChange={(event) => onChange({ primaryActionLabel: event.target.value })} style={inputStyle} /></Field>
        {state === 'error' && 'secondaryActionLabel' in status && <Field label="Kapat butonu"><input value={status.secondaryActionLabel} maxLength={60} onChange={(event) => onChange({ secondaryActionLabel: event.target.value })} style={inputStyle} /></Field>}
        <CheckoutStatusIconPicker state={state as Exclude<EditableCheckoutState, 'payment'>} value={status.icon} onChange={(icon) => onChange({ icon } as Partial<EditableCheckoutStateTheme>)} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
          <AuthStateColorField
            label="İkon rengi"
            value={status.iconColor}
            inherited={statusOverride?.iconColor === undefined}
            onChange={(iconColor) => onChange({ iconColor } as Partial<EditableCheckoutStateTheme>)}
          />
          <AuthStateColorField
            label="İkon zemini"
            value={status.iconBackground}
            inherited={statusOverride?.iconBackground === undefined}
            onChange={(iconBackground) => onChange({ iconBackground } as Partial<EditableCheckoutStateTheme>)}
          />
        </div>
      </>}

      <div role="note" style={{ ...noticeStyle, margin: '4px 0 0' }}><I.shield size={16} /><span>Gerçek tutar, sağlayıcı, alan adları, sistem hata metni ve buton hedefleri tema tarafından değiştirilemez.</span></div>
    </div>

    <div style={{ ...settingsCardStyle, marginTop: 14 }}>
      <SettingsCardHeader icon={<I.spacing size={17} />} title={`${stateLabel} yerleşimi`} meta="Güvenli aralık" />
      {payment ? <>
        <Field label={`Yatay panel padding · ${payment.layout.paddingX}px`}><input type="range" min={12} max={28} step={1} value={payment.layout.paddingX} onChange={(event) => onPaymentLayoutChange({ paddingX: Number(event.target.value) })} style={rangeStyle} /></Field>
        <Field label={`Bölüm aralığı · ${payment.layout.sectionGap}px`}><input type="range" min={12} max={28} step={1} value={payment.layout.sectionGap} onChange={(event) => onPaymentLayoutChange({ sectionGap: Number(event.target.value) })} style={rangeStyle} /></Field>
        <Field label="Kontrol yoğunluğu"><select value={payment.layout.density} onChange={(event) => onPaymentLayoutChange({ density: event.target.value as CheckoutPaymentLayoutTheme['density'] })} style={inputStyle}><option value="compact">Kompakt</option><option value="standard">Standart</option></select></Field>
        <Field label="İçerik genişliği"><select value={payment.layout.contentWidth} onChange={(event) => onPaymentLayoutChange({ contentWidth: event.target.value as CheckoutPaymentLayoutTheme['contentWidth'] })} style={inputStyle}><option value="standard">Standart · 520px</option><option value="wide">Geniş · 620px</option></select></Field>
      </> : status ? <>
        <Field label={`Yatay panel padding · ${status.layout.paddingX}px`}><input type="range" min={12} max={40} step={1} value={status.layout.paddingX} onChange={(event) => onResultLayoutChange({ paddingX: Number(event.target.value) })} style={rangeStyle} /></Field>
        <Field label={`Dikey panel padding · ${status.layout.paddingY}px`}><input type="range" min={12} max={56} step={1} value={status.layout.paddingY} onChange={(event) => onResultLayoutChange({ paddingY: Number(event.target.value) })} style={rangeStyle} /></Field>
        <Field label={`İçerik aralığı · ${status.layout.contentGap}px`}><input type="range" min={8} max={32} step={1} value={status.layout.contentGap} onChange={(event) => onResultLayoutChange({ contentGap: Number(event.target.value) })} style={rangeStyle} /></Field>
        <Field label="İçerik hizalama"><select value={status.layout.align} onChange={(event) => onResultLayoutChange({ align: event.target.value as CheckoutResultLayoutTheme['align'] })} style={inputStyle}><option value="left">Sola</option><option value="center">Ortala</option></select></Field>
        <Field label="İçerik genişliği"><select value={status.layout.contentWidth} onChange={(event) => onResultLayoutChange({ contentWidth: event.target.value as CheckoutResultLayoutTheme['contentWidth'] })} style={inputStyle}><option value="compact">Kompakt · 320px</option><option value="standard">Standart · 380px</option><option value="full">Tam genişlik</option></select></Field>
        <Field label={`İkon boyutu · ${status.layout.iconSize}px`}><input type="range" min={56} max={96} step={1} value={status.layout.iconSize} onChange={(event) => onResultLayoutChange({ iconSize: Number(event.target.value) })} style={rangeStyle} /></Field>
      </> : null}
    </div>
  </>
}

function CheckoutStatusIconPicker({
  state,
  value,
  onChange,
}: {
  state: Exclude<EditableCheckoutState, 'payment'>
  value: CheckoutStatusIcon
  onChange: (icon: CheckoutStatusIcon) => void
}) {
  const options = state === 'success'
    ? CHECKOUT_SUCCESS_ICON_OPTIONS
    : state === 'table-payment' ? CHECKOUT_TABLE_ICON_OPTIONS : CHECKOUT_ERROR_ICON_OPTIONS
  return <Field label="Durum ikonu">
    <div role="radiogroup" aria-label={`${state === 'success' ? 'Başarı' : state === 'table-payment' ? 'Masada ödeme' : 'Hata'} ikonu`} style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
      {options.map((option) => {
        const Icon = option.icon
        const selected = value === option.id
        return <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(option.id)}
          style={{ minHeight: 40, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${selected ? 'var(--action)' : 'var(--border-strong)'}`, borderRadius: 9, background: selected ? 'var(--surface)' : 'transparent', color: selected ? 'var(--text)' : 'var(--text-2)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
        ><Icon size={17} /><span>{option.label}</span>{selected && <I.check size={14} style={{ marginLeft: 'auto' }} />}</button>
      })}
    </div>
  </Field>
}

function AuthStateSettings({
  state,
  auth,
  onChange,
  onLayoutChange,
  onReset,
}: {
  state: EditableAuthState
  auth: ThemeSurfaces['auth']
  onChange: (patch: Partial<EditableAuthStateTheme>) => void
  onLayoutChange: (patch: Partial<AuthStateLayoutTheme>) => void
  onReset: () => void
}) {
  const otpState = state === 'otp' ? resolveAuthOtpState(auth) : null
  const statusState = state === 'success'
    ? resolveAuthSuccessState(auth)
    : state === 'error' ? resolveAuthErrorState(auth) : null
  const statusOverride = state === 'success'
    ? auth.states?.success
    : state === 'error' ? auth.states?.error : undefined
  const resolved = otpState ?? statusState!
  const stateLabel = state === 'otp' ? 'OTP' : state === 'success' ? 'Başarılı dönüş' : 'Hata'
  const hasOverride = Boolean(auth.states?.[state])

  return <>
    <div style={settingsCardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {state === 'otp' ? <I.mail size={17} /> : state === 'success' ? <I.check size={17} /> : <I.warn size={17} />}
        <strong style={{ fontSize: 12.5 }}>{stateLabel} içeriği</strong>
        <button type="button" onClick={onReset} disabled={!hasOverride} style={{ ...stateResetButtonStyle, opacity: hasOverride ? 1 : .45 }}>Varsayılana dön</button>
      </div>
      <Field label="Başlık"><input value={resolved.title} maxLength={100} onChange={(event) => onChange({ title: event.target.value })} style={inputStyle} /></Field>
      <Field label="Açıklama"><textarea value={resolved.description} maxLength={240} rows={4} onChange={(event) => onChange({ description: event.target.value })} style={{ ...inputStyle, paddingTop: 10, resize: 'vertical' }} /></Field>
      <Field label="Ana buton metni"><input value={resolved.primaryActionLabel} maxLength={60} onChange={(event) => onChange({ primaryActionLabel: event.target.value })} style={inputStyle} /></Field>
      {otpState && <Field label="Tekrar gönder metni"><input value={otpState.resendLabel} maxLength={60} onChange={(event) => onChange({ resendLabel: event.target.value })} style={inputStyle} /></Field>}
      {state !== 'otp' && statusState && <AuthStatusIconPicker
        state={state}
        value={statusState.icon}
        onChange={(icon) => onChange({ icon } as Partial<EditableAuthStateTheme>)}
      />}
      {state !== 'otp' && statusState && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
        <AuthStateColorField
          label="İkon rengi"
          value={statusState.iconColor}
          inherited={statusOverride?.iconColor === undefined}
          onChange={(iconColor) => onChange({ iconColor } as Partial<EditableAuthStateTheme>)}
        />
        <AuthStateColorField
          label="İkon zemini"
          value={statusState.iconBackground}
          inherited={statusOverride?.iconBackground === undefined}
          onChange={(iconBackground) => onChange({ iconBackground } as Partial<EditableAuthStateTheme>)}
        />
      </div>}
      <div role="note" style={{ ...noticeStyle, margin: '4px 0 0' }}><I.shield size={16} /><span>E-posta, sayaç, sistem hata metinleri ve buton hedefi tema tarafından değiştirilemez.</span></div>
    </div>

    <div style={{ ...settingsCardStyle, marginTop: 14 }}>
      <SettingsCardHeader icon={<I.spacing size={17} />} title={`${stateLabel} yerleşimi`} meta="Güvenli aralık" />
      <Field label={`Yatay panel padding · ${resolved.layout.paddingX}px`}><input type="range" min={12} max={40} step={1} value={resolved.layout.paddingX} onChange={(event) => onLayoutChange({ paddingX: Number(event.target.value) })} style={rangeStyle} /></Field>
      <Field label={`Dikey panel padding · ${resolved.layout.paddingY}px`}><input type="range" min={12} max={56} step={1} value={resolved.layout.paddingY} onChange={(event) => onLayoutChange({ paddingY: Number(event.target.value) })} style={rangeStyle} /></Field>
      <Field label={`İçerik aralığı · ${resolved.layout.contentGap}px`}><input type="range" min={8} max={32} step={1} value={resolved.layout.contentGap} onChange={(event) => onLayoutChange({ contentGap: Number(event.target.value) })} style={rangeStyle} /></Field>
      <Field label="İçerik hizalama"><select value={resolved.layout.align} onChange={(event) => onLayoutChange({ align: event.target.value as AuthStateLayoutTheme['align'] })} style={inputStyle}><option value="left">Sola</option><option value="center">Ortala</option></select></Field>
      <Field label="İçerik genişliği"><select value={resolved.layout.contentWidth} onChange={(event) => onLayoutChange({ contentWidth: event.target.value as AuthStateLayoutTheme['contentWidth'] })} style={inputStyle}><option value="compact">Kompakt · 320px</option><option value="standard">Standart · 380px</option><option value="full">Tam genişlik</option></select></Field>
      {state !== 'otp' && <Field label={`İkon boyutu · ${resolved.layout.iconSize}px`}><input type="range" min={56} max={96} step={1} value={resolved.layout.iconSize} onChange={(event) => onLayoutChange({ iconSize: Number(event.target.value) })} style={rangeStyle} /></Field>}
    </div>
  </>
}

function AuthStateColorField({
  label,
  value,
  inherited,
  onChange,
}: {
  label: string
  value: string
  inherited: boolean
  onChange: (value: string | undefined) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = (candidate: string) => {
    const normalized = candidate.trim()
    if (/^#[0-9a-f]{6}$/i.test(normalized)) onChange(normalized)
  }
  return <Field label={label}>
    <div style={{ display: 'flex', gap: 6 }}>
      <input aria-label={`${label} seç`} type="color" value={value} onChange={(event) => { setDraft(event.target.value); onChange(event.target.value) }} style={colorSwatchStyle} />
      <input
        aria-label={`${label} hex değeri`}
        value={draft}
        maxLength={7}
        onChange={(event) => { setDraft(event.target.value); commit(event.target.value) }}
        onBlur={() => { if (!/^#[0-9a-f]{6}$/i.test(draft)) setDraft(value) }}
        style={{ ...inputStyle, minWidth: 0, paddingInline: 8 }}
      />
    </div>
    <button type="button" disabled={inherited} onClick={() => onChange(undefined)} style={{ ...inheritButtonStyle, opacity: inherited ? .6 : 1, cursor: inherited ? 'default' : 'pointer' }}>
      {inherited ? 'Durum varsayılanı' : 'Varsayılanı kullan'}
    </button>
  </Field>
}

function AuthStatusIconPicker({
  state,
  value,
  onChange,
}: {
  state: 'success' | 'error'
  value: AuthSuccessIcon | AuthErrorIcon
  onChange: (icon: AuthSuccessIcon | AuthErrorIcon) => void
}) {
  const options = state === 'success' ? SUCCESS_ICON_OPTIONS : ERROR_ICON_OPTIONS
  return <Field label="Durum ikonu">
    <div role="radiogroup" aria-label={`${state === 'success' ? 'Başarı' : 'Hata'} ikonu`} style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
      {options.map((option) => {
        const Icon = option.icon
        const selected = value === option.id
        return <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(option.id)}
          style={{ minHeight: 40, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${selected ? 'var(--action)' : 'var(--border-strong)'}`, borderRadius: 9, background: selected ? 'var(--surface)' : 'transparent', color: selected ? 'var(--text)' : 'var(--text-2)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
        ><Icon size={17} /><span>{option.label}</span>{selected && <I.check size={14} style={{ marginLeft: 'auto' }} />}</button>
      })}
    </div>
  </Field>
}

function AuthHeaderMediaUploader({
  restaurantId,
  header,
  onChange,
  logoOnly = false,
}: {
  restaurantId: string
  header: AuthHeaderTheme
  onChange: (patch: Partial<AuthHeaderTheme>) => void
  logoOnly?: boolean
}) {
  const [busy, setBusy] = useState<'background' | 'logo' | null>(null)
  const [message, setMessage] = useState('')

  const upload = async (event: ChangeEvent<HTMLInputElement>, kind: 'background' | 'logo') => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(kind)
    setMessage('')
    const form = new FormData()
    form.set('restaurantId', restaurantId)
    form.set('purpose', kind === 'background' ? 'auth-header-background' : 'auth-header-logo')
    form.set('file', file)
    const result = await uploadThemeMedia(form)
    setBusy(null)
    if ('error' in result) {
      setMessage(result.error)
      return
    }
    if (kind === 'background') onChange({
      backgroundImageUrl: result.url,
      ...(!header.backgroundImageUrl && header.logoMode === 'restaurant' ? { logoMode: 'none' as const } : {}),
    })
    else onChange({ logoMode: 'custom', logoUrl: result.url })
    setMessage(kind === 'background' ? 'Header fotoğrafı hazır.' : 'Özel logo hazır.')
  }

  return (
    <div style={{ marginBottom: 15 }}>
      {!logoOnly && <>
        {header.backgroundImageUrl && <AuthHeaderThumbnail header={header} />}
        <label style={uploadLabelStyle}><I.image size={16} /><span>{busy === 'background' ? 'İşleniyor…' : header.backgroundImageUrl ? 'Header fotoğrafını değiştir' : 'Header fotoğrafı yükle'}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy !== null} onChange={(event) => void upload(event, 'background')} style={visuallyHiddenInputStyle} /></label>
        {header.backgroundImageUrl && <button type="button" onClick={() => onChange({ backgroundImageUrl: undefined })} style={inlineRemoveButtonStyle}>Fotoğrafı kaldır</button>}
      </>}
      {logoOnly && <>
        <label style={{ ...uploadLabelStyle, marginTop: 8 }}><I.upload size={16} /><span>{busy === 'logo' ? 'İşleniyor…' : header.logoUrl ? 'Özel logoyu değiştir' : 'Özel logo yükle'}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy !== null} onChange={(event) => void upload(event, 'logo')} style={visuallyHiddenInputStyle} /></label>
        {header.logoUrl && <button type="button" onClick={() => onChange({ logoUrl: undefined })} style={inlineRemoveButtonStyle}>Özel logoyu kaldır</button>}
      </>}
      <p style={{ margin: '8px 0 0', color: message.includes('hazır') ? 'var(--positive)' : 'var(--text-3)', fontSize: 10.5, lineHeight: 1.45 }} aria-live="polite">{message || (logoOnly ? 'JPEG, PNG veya WebP. Logo en fazla 2 MB.' : 'JPEG, PNG veya WebP. Fotoğraf en fazla 8 MB.')}</p>
    </div>
  )
}

function AuthHeaderThumbnail({ header }: { header: AuthHeaderTheme }) {
  const tone = header.contentTone ?? 'light'
  const overlay = Math.min(85, Math.max(0, header.overlay)) / 100
  return (
    <div aria-label="Giriş Header gerçek kadraj önizlemesi" style={{ position: 'relative', height: 88, marginBottom: 8, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 10, background: header.backgroundColor ?? '#12271c' }}>
      {/* Tenant uploads have arbitrary aspect ratios; native img mirrors the menu renderer. */}
      <img src={header.backgroundImageUrl} alt="" style={{ width: '100%', height: '100%', display: 'block', objectFit: header.imageFit ?? 'cover', objectPosition: `${header.imagePositionX ?? 50}% ${header.imagePositionY ?? 50}%` }} />
      <img aria-hidden="true" src={header.backgroundImageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none', objectFit: header.imageFit ?? 'cover', objectPosition: `${header.imagePositionX ?? 50}% ${header.imagePositionY ?? 50}%`, filter: tone === 'dark' ? 'brightness(0) invert(1)' : 'brightness(0)', opacity: overlay }} />
      <span style={{ position: 'absolute', left: 9, bottom: 7, color: tone === 'dark' ? '#151719' : '#ffffff', fontSize: 10, fontWeight: 750 }}>Canlı kadraj</span>
    </div>
  )
}

function AuthImageFocusControl({ header, onChange }: {
  header: AuthHeaderTheme
  onChange: (patch: Partial<AuthHeaderTheme>) => void
}) {
  const x = header.imagePositionX ?? 50
  const y = header.imagePositionY ?? 50
  const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    onChange({
      imagePositionX: Math.round(Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100))),
      imagePositionY: Math.round(Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100))),
    })
  }
  return (
    <div style={{ marginBottom: 15 }}>
      <span style={{ display: 'block', marginBottom: 6, color: 'var(--text-2)', fontSize: 11.5, fontWeight: 700 }}>Odak noktası</span>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Header fotoğrafı odak noktası"
        aria-valuetext={`Yatay yüzde ${x}, dikey yüzde ${y}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={x}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateFromPointer(event) }}
        onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event) }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 10 : 2
          if (event.key === 'ArrowLeft') { event.preventDefault(); onChange({ imagePositionX: Math.max(0, x - step) }) }
          if (event.key === 'ArrowRight') { event.preventDefault(); onChange({ imagePositionX: Math.min(100, x + step) }) }
          if (event.key === 'ArrowUp') { event.preventDefault(); onChange({ imagePositionY: Math.max(0, y - step) }) }
          if (event.key === 'ArrowDown') { event.preventDefault(); onChange({ imagePositionY: Math.min(100, y + step) }) }
        }}
        style={{ position: 'relative', height: 132, overflow: 'hidden', border: '1px solid var(--border-strong)', borderRadius: 10, background: header.backgroundColor ?? '#12271c', cursor: 'crosshair', outlineOffset: 3, touchAction: 'none' }}
      >
        <img src={header.backgroundImageUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none', userSelect: 'none', objectFit: header.imageFit ?? 'cover', objectPosition: `${x}% ${y}%` }} />
        <span aria-hidden="true" style={{ position: 'absolute', left: `calc(${x}% - 9px)`, top: `calc(${y}% - 9px)`, width: 18, height: 18, border: '2px solid #ffffff', borderRadius: 999, boxShadow: '0 0 0 2px rgba(0,0,0,.5)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <Field label={`X · %${x}`}><input aria-label="Yatay odak" type="range" min={0} max={100} value={x} onChange={(event) => onChange({ imagePositionX: Number(event.target.value) })} style={rangeStyle} /></Field>
        <Field label={`Y · %${y}`}><input aria-label="Dikey odak" type="range" min={0} max={100} value={y} onChange={(event) => onChange({ imagePositionY: Number(event.target.value) })} style={rangeStyle} /></Field>
      </div>
    </div>
  )
}

function AuthColorField({ label, field, value, effectiveValue, onChange }: {
  label: string
  field: AuthColorFieldKey
  value: string | undefined
  effectiveValue: string
  onChange: (field: AuthColorFieldKey, value: string | undefined) => void
}) {
  const [draft, setDraft] = useState(value ?? effectiveValue)
  useEffect(() => setDraft(value ?? effectiveValue), [effectiveValue, value])
  const inherited = value === undefined
  const commit = (candidate: string) => {
    const normalized = candidate.trim()
    if (!normalized) { onChange(field, undefined); return }
    if (/^#[0-9a-f]{6}$/i.test(normalized)) onChange(field, normalized)
  }
  return (
    <Field label={label}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input aria-label={`${label} rengini seç`} type="color" value={value ?? effectiveValue} onChange={(event) => { setDraft(event.target.value); onChange(field, event.target.value) }} style={colorSwatchStyle} />
        <input
          aria-label={`${label} hex değeri`}
          value={draft}
          onChange={(event) => { setDraft(event.target.value); commit(event.target.value) }}
          onBlur={() => { if (!/^#[0-9a-f]{6}$/i.test(draft)) setDraft(value ?? effectiveValue) }}
          placeholder="#000000"
          style={inputStyle}
        />
      </div>
      <button type="button" disabled={inherited} onClick={() => { setDraft(effectiveValue); onChange(field, undefined) }} style={{ ...inheritButtonStyle, opacity: inherited ? .6 : 1, cursor: inherited ? 'default' : 'pointer' }}>
        {inherited ? 'Ortak temadan kullanılıyor' : 'Ortak temadan kullan'}
      </button>
    </Field>
  )
}

function ContrastStatus({ issues }: { issues: Array<AuthContrastIssue | CheckoutContrastIssue> }) {
  if (issues.length === 0) {
    return <div role="status" style={contrastPassStyle}><I.check size={17} /><span>Metin, alan ve CTA kontrastları yayın için uygun.</span></div>
  }
  return (
    <div role="alert" style={contrastFailStyle}>
      <I.warn size={17} />
      <div><strong style={{ display: 'block', marginBottom: 4 }}>Yayınlama için kontrastı düzelt</strong>{issues.map((issue) => <div key={issue.id}>{issue.label}: {issue.ratio}:1 · gereken {issue.minimum}:1</div>)}</div>
    </div>
  )
}

function SettingsCardHeader({ icon, title, meta }: { icon: React.ReactNode; title: string; meta?: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>{icon}<strong style={{ fontSize: 12.5 }}>{title}</strong>{meta && <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 10.5 }}>{meta}</span>}</div>
}

function HeroVideoUploader({
  restaurantId,
  enabled,
  videoUrl,
  posterUrl,
  onChange,
}: {
  restaurantId: string
  enabled: boolean
  videoUrl: string
  posterUrl: string
  onChange: (patch: { videoUrl?: string; posterUrl?: string }) => void
}) {
  const [busy, setBusy] = useState<'video' | 'poster' | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null)

  const uploadVideo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !enabled) return
    setBusy('video'); setFeedback(null)
    try {
      const form = new FormData(); form.set('restaurantId', restaurantId); form.set('file', file)
      const result = await uploadThemeVideo(form)
      if ('error' in result) {
        setFeedback({ tone: 'error', text: `Video eklenmedi: ${result.error}` })
        return
      }
      onChange({ videoUrl: result.url })
      setFeedback({
        tone: posterUrl ? 'success' : 'info',
        text: posterUrl
          ? `${result.durationSeconds.toFixed(1)} sn video ve poster hazır. Önizleme güncellendi.`
          : `${result.durationSeconds.toFixed(1)} sn video hazır. Önizleme için zorunlu posteri de yükleyin.`,
      })
    } catch {
      setFeedback({ tone: 'error', text: 'Video eklenemedi. Bağlantınızı kontrol edip tekrar deneyin.' })
    } finally {
      setBusy(null)
    }
  }
  const uploadPoster = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !enabled) return
    setBusy('poster'); setFeedback(null)
    try {
      const form = new FormData(); form.set('restaurantId', restaurantId); form.set('purpose', 'home-hero-poster'); form.set('file', file)
      const result = await uploadThemeMedia(form)
      if ('error' in result) {
        setFeedback({ tone: 'error', text: `Poster eklenmedi: ${result.error}` })
        return
      }
      onChange({ posterUrl: result.url })
      setFeedback({
        tone: videoUrl ? 'success' : 'info',
        text: videoUrl
          ? 'Video ve poster hazır. Önizleme güncellendi.'
          : 'Poster hazır. Önizleme için videoyu da yükleyin.',
      })
    } catch {
      setFeedback({ tone: 'error', text: 'Poster eklenemedi. Bağlantınızı kontrol edip tekrar deneyin.' })
    } finally {
      setBusy(null)
    }
  }
  const effectiveFeedback = feedback ?? (videoUrl && posterUrl
    ? { tone: 'success' as const, text: 'Video ve poster hazır. Önizleme etkin.' }
    : videoUrl
      ? { tone: 'info' as const, text: 'Video hazır. Önizleme için zorunlu posteri yükleyin.' }
      : posterUrl
        ? { tone: 'info' as const, text: 'Poster hazır. Önizleme için videoyu yükleyin.' }
        : null)
  return <div style={{ marginBottom: 16, padding: 12, border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface-3)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><I.play size={17} /><strong style={{ fontSize: 12.5 }}>Pro hero video</strong><span style={{ marginLeft: 'auto', padding: '2px 6px', borderRadius: 999, background: enabled ? 'var(--positive-bg)' : 'var(--surface)', color: enabled ? 'var(--positive)' : 'var(--text-3)', fontSize: 10, fontWeight: 750 }}>{enabled ? 'Açık' : 'Kilitli'}</span></div>
    <label style={uploadLabelStyle} aria-disabled={!enabled}><I.upload size={16} /><span>{busy === 'video' ? 'Doğrulanıyor…' : videoUrl ? 'Video hazır · değiştir' : 'MP4 / WebM yükle'}</span><input type="file" accept="video/mp4,video/webm" disabled={!enabled || busy !== null} onChange={(event) => void uploadVideo(event)} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} /></label>
    <label style={{ ...uploadLabelStyle, marginTop: 8 }} aria-disabled={!enabled}><I.image size={16} /><span>{busy === 'poster' ? 'İşleniyor…' : posterUrl ? 'Poster hazır · değiştir' : 'Zorunlu poster yükle'}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={!enabled || busy !== null} onChange={(event) => void uploadPoster(event)} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} /></label>
    {effectiveFeedback ? <div
      role={effectiveFeedback.tone === 'error' ? 'alert' : 'status'}
      style={{
        marginTop: 9,
        padding: '8px 9px',
        border: `1px solid ${effectiveFeedback.tone === 'error' ? 'var(--critical)' : effectiveFeedback.tone === 'success' ? 'var(--positive)' : 'var(--border)'}`,
        borderRadius: 8,
        background: effectiveFeedback.tone === 'error' ? 'var(--critical-bg)' : effectiveFeedback.tone === 'success' ? 'var(--positive-bg)' : 'var(--surface)',
        color: effectiveFeedback.tone === 'error' ? 'var(--critical)' : effectiveFeedback.tone === 'success' ? 'var(--positive)' : 'var(--text-2)',
        fontSize: 10.5,
        fontWeight: 650,
        lineHeight: 1.45,
      }}
    >{effectiveFeedback.text}</div> : null}
    <p style={{ margin: '9px 0 0', color: 'var(--text-3)', fontSize: 10.5, lineHeight: 1.45 }}>En fazla 8 MB ve 15 sn. H.264 MP4 veya VP8/VP9 WebM. Önizleme için video ve poster gereklidir.</p>
  </div>
}

function SurfaceOverrideFields({ surface, theme, onPatch }: { surface: ThemeEditorSurface; theme: GarsonlessTheme; onPatch: (patch: Partial<GarsonlessTheme>) => void }) {
  if (surface === 'menu') return null
  const surfaces = resolvedSurfaces(theme)
  const current = surfaces[surface].override ?? {}
  const update = (key: 'background' | 'surface' | 'accent' | 'text' | 'cta', value: string) => {
    onPatch({ experienceVersion: 2, surfaces: { ...surfaces, [surface]: { ...surfaces[surface], override: { ...current, [key]: value } } } })
  }
  return (
    <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--divider)' }}>
      <h3 style={{ margin: '0 0 12px', color: 'var(--text)', fontSize: 12.5, fontWeight: 750 }}>Yüzey renkleri</h3>
      {([['background', 'Arka plan'], ['surface', 'Kart yüzeyi'], ['accent', 'Vurgu'], ['text', 'Metin'], ['cta', 'Ana buton']] as const).map(([key, label]) => (
        <Field key={key} label={label}>
          <div style={{ width: '100%', minWidth: 0, display: 'flex', gap: 8 }}>
            <input type="color" value={current[key] ?? (key === 'background' ? theme.bg : key === 'surface' ? theme.cardColor ?? '#ffffff' : key === 'text' ? theme.textColor ?? '#1c1d20' : key === 'cta' ? theme.cta : theme.accent)} onChange={(event) => update(key, event.target.value)} style={colorSwatchStyle} />
            <input value={current[key] ?? ''} onChange={(event) => update(key, event.target.value)} placeholder="Ortak temadan" style={{ ...inputStyle, width: 'auto', flex: '1 1 0' }} />
          </div>
        </Field>
      ))}
    </div>
  )
}

function SurfaceAside({ width, title, subtitle, children }: { width: number; title: string; subtitle: string; children: React.ReactNode }) {
  return <aside style={{ width, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '16px', borderBottom: '1px solid var(--divider)' }}><h2 style={{ margin: 0, color: 'var(--text)', fontSize: 15, fontWeight: 750 }}>{title}</h2><p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: 11.5 }}>{subtitle}</p></div>
    {children}
  </aside>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block', marginBottom: 15 }}><span style={{ display: 'block', marginBottom: 6, color: 'var(--text-2)', fontSize: 11.5, fontWeight: 700 }}>{label}</span>{children}</label>
}

function EmptyProperties({ text }: { text: string }) {
  return <div style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5, lineHeight: 1.5 }}><I.layout size={22} style={{ marginBottom: 8 }} /><div>{text}</div></div>
}

const inputStyle: CSSProperties = { width: '100%', minWidth: 0, boxSizing: 'border-box', minHeight: 34, padding: '0 9px', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, outline: 'none' }
const colorSwatchStyle: CSSProperties = { width: 34, height: 34, flexShrink: 0, padding: 3, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }
const rangeStyle: CSSProperties = { width: '100%', minWidth: 0, minHeight: 30, accentColor: 'var(--action)' }
const groupLabelStyle: CSSProperties = { margin: '6px 10px 7px', color: 'var(--text-3)', fontSize: 10.5, fontWeight: 750, letterSpacing: '.06em', textTransform: 'uppercase' }
const sectionRowStyle: CSSProperties = { minHeight: 58, position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 9, color: 'var(--text-2)' }
const iconButtonStyle: CSSProperties = { width: 30, height: 30, minWidth: 30, minHeight: 30, padding: 0, display: 'grid', placeItems: 'center', border: 0, borderRadius: 7, background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }
const actionSummaryStyle: CSSProperties = { width: 30, height: 30, minWidth: 30, minHeight: 30, display: 'grid', placeItems: 'center', borderRadius: 7, color: 'var(--text-3)', cursor: 'pointer', listStyle: 'none' }
const sectionActionMenuStyle: CSSProperties = { position: 'absolute', zIndex: 30, top: 36, right: 0, width: 176, padding: 6, border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', boxShadow: '0 12px 32px rgba(17,19,24,.16)' }
const actionMenuItemStyle: CSSProperties = { width: '100%', minHeight: 34, padding: '0 9px', border: 0, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 9, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', textAlign: 'left', fontSize: 12, fontWeight: 650 }
const noticeStyle: CSSProperties = { margin: '16px 4px', padding: 12, display: 'flex', gap: 9, alignItems: 'flex-start', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-3)', color: 'var(--text-3)', fontSize: 11.5, lineHeight: 1.45 }
const uploadLabelStyle: CSSProperties = { minHeight: 36, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px dashed var(--border-strong)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text-2)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }
const settingsCardStyle: CSSProperties = { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-3)' }
const warningNoticeStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8, marginBottom: 14, padding: 10, border: '1px solid #f1c27d', borderRadius: 9, background: '#fff7e8', color: '#7a4600', fontSize: 11.5, lineHeight: 1.45 }
const warningActionStyle: CSSProperties = { gridColumn: '2', justifySelf: 'start', minHeight: 32, padding: '0 10px', border: '1px solid #d99b43', borderRadius: 7, background: '#ffffff', color: '#7a4600', fontSize: 11, fontWeight: 750, cursor: 'pointer' }
const stateResetButtonStyle: CSSProperties = { minHeight: 32, marginLeft: 'auto', padding: '0 8px', border: 0, borderRadius: 7, background: 'transparent', color: 'var(--action)', fontSize: 10.5, fontWeight: 750, cursor: 'pointer' }
const inheritButtonStyle: CSSProperties = { minHeight: 32, marginTop: 4, padding: 0, border: 0, background: 'transparent', color: 'var(--action)', fontSize: 10.5, fontWeight: 700 }
const contrastPassStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 8, padding: 10, border: '1px solid var(--positive)', borderRadius: 9, background: 'var(--positive-bg)', color: 'var(--positive)', fontSize: 11.5, lineHeight: 1.45 }
const contrastFailStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 8, padding: 10, border: '1px solid #d98b84', borderRadius: 9, background: '#fff1f0', color: '#8f2923', fontSize: 11.5, lineHeight: 1.45 }
const visuallyHiddenInputStyle: CSSProperties = { position: 'absolute', width: 1, height: 1, opacity: 0 }
const inlineRemoveButtonStyle: CSSProperties = { minHeight: 36, marginTop: 4, padding: '0 8px', border: 0, background: 'transparent', color: 'var(--danger)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }
const navButtonStyle = (active: boolean): CSSProperties => ({ width: '100%', minHeight: 40, padding: '6px 10px', border: 0, borderRadius: 9, display: 'flex', alignItems: 'center', gap: 10, background: active ? 'var(--surface-inset)' : 'transparent', color: active ? 'var(--text)' : 'var(--text-2)', cursor: 'pointer', textAlign: 'left', fontSize: 12.5, fontWeight: 650 })
const sharedChromeRowStyle = (active: boolean): CSSProperties => ({ width: '100%', minHeight: 54, padding: '7px 10px', border: active ? '1px solid var(--text)' : '1px solid transparent', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9, background: active ? 'var(--surface-inset)' : 'var(--surface-2)', color: active ? 'var(--text)' : 'var(--text-2)', cursor: 'pointer', textAlign: 'left' })
const sharedChromeIconStyle: CSSProperties = { width: 34, height: 34, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }
const sharedChromeMetaStyle: CSSProperties = { display: 'block', marginTop: 2, color: 'var(--text-3)', fontSize: 10.5, lineHeight: 1.3, fontWeight: 550 }
const sharedBadgeStyle: CSSProperties = { padding: '3px 7px', borderRadius: 999, background: 'var(--positive-bg)', color: 'var(--positive)', fontSize: 9.5, fontWeight: 800 }
const addSectionButtonStyle: CSSProperties = { width: '100%', minHeight: 56, marginTop: 14, padding: '7px 10px', border: '1px dashed var(--border-strong)', borderRadius: 11, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 12.5, fontWeight: 750 }
const addSectionIconStyle: CSSProperties = { width: 36, height: 36, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 10, background: 'var(--positive-bg)', color: 'var(--positive)' }
const homeTabStyle = (active: boolean): CSSProperties => ({ minHeight: 38, border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, borderRadius: 8, background: active ? 'var(--surface)' : 'transparent', color: active ? 'var(--text)' : 'var(--text-3)', fontSize: 11, fontWeight: 750, cursor: 'pointer' })
const homeResetButtonStyle: CSSProperties = { width: '100%', minHeight: 40, marginTop: 14, border: 0, borderTop: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', textDecoration: 'underline', textUnderlineOffset: 2, fontSize: 11, cursor: 'pointer' }
