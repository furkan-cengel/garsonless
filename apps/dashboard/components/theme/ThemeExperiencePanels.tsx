'use client'

import { Children, cloneElement, isValidElement, useEffect, useId, useMemo, useState, type CSSProperties, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactElement, type RefObject } from 'react'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Attachment, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from '@/components/ui/attachment'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty'
import { Field as ShadcnField, FieldContent, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

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
  const [dragId, setDragId] = useState<string | null>(null)

  if (surface !== 'home') {
    const states = surface === 'auth' ? AUTH_STATES : CHECKOUT_STATES
    const current = surface === 'auth' ? authState : checkoutState
    return (
      <SurfaceAside width={width} title={surface === 'auth' ? 'Giriş' : 'Checkout'} subtitle="Önizleme durumu">
        <div style={{ padding: 8 }}>
          <ToggleGroup
            value={[current]}
            onValueChange={(values) => {
              const next = values[0]
              if (!next) return
              if (surface === 'auth') onAuthStateChange(next as AuthPreviewState)
              else onCheckoutStateChange(next as CheckoutPreviewState)
            }}
            orientation="vertical"
            className="w-full flex-col items-stretch"
            aria-label={surface === 'auth' ? 'Giriş önizleme durumu' : 'Checkout önizleme durumu'}
          >
          {states.map((state) => (
            <ToggleGroupItem
              key={state.id}
              value={state.id}
              variant="outline"
              className="h-auto min-h-10 w-full justify-start gap-2.5 px-2.5 py-1.5"
            >
              <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 8, background: current === state.id ? 'var(--surface)' : 'var(--surface-3)' }}>
                {state.id === 'error' ? <I.warn size={17} /> : state.id === 'success' ? <I.check size={17} /> : surface === 'auth' ? <I.userCircle size={17} /> : <I.receipt size={17} />}
              </span>
              <span>{state.label}</span>
              {current === state.id && <I.chevRight size={17} style={{ marginLeft: 'auto' }} />}
            </ToggleGroupItem>
          ))}
          </ToggleGroup>
          <Alert className="my-4"><I.shield /><AlertDescription>{surface === 'auth' ? 'Önizleme OTP veya OAuth isteği oluşturmaz.' : 'Önizleme sipariş veya ödeme isteği oluşturmaz.'}</AlertDescription></Alert>
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
        <ShadcnField orientation="horizontal" className="min-h-13 rounded-lg bg-muted px-2.5">
          <FieldContent>
          <FieldLabel htmlFor="theme-home-enabled">Ana sayfayı etkinleştir</FieldLabel>
          <FieldDescription>Yayınlanınca /{'{slug}'} ana sayfa olur</FieldDescription>
          </FieldContent>
          <Switch
            id="theme-home-enabled"
            checked={homeState.home.enabled}
            onCheckedChange={(checked) => onPatch(homeV2Patch(theme, { ...homeState.home, enabled: checked === true }, homeState.sectionSettings))}
          />
        </ShadcnField>
      </div>

      <ScrollArea className="min-h-0 flex-1"><div className="px-2 pt-2.5 pb-5">
        <FieldTitle className="mx-2.5 mt-1.5 mb-2 text-[10.5px] font-bold uppercase tracking-[.06em] text-muted-foreground">Ortak alanlar</FieldTitle>
        <Item
          render={<Button type="button" variant="ghost" aria-pressed={selectedSectionId === '__shared-header'} onClick={() => onSelectShared('header')} />}
          variant={selectedSectionId === '__shared-header' ? 'muted' : 'default'}
          size="sm"
          className="min-h-[54px] text-left"
        >
          <ItemMedia variant="icon" className="size-8 rounded-lg border bg-background"><I.header /></ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="text-[12.5px]">Ortak Header</ItemTitle>
            <ItemDescription className="text-[10.5px]">Menü ile aynı bileşen ve ayarlar</ItemDescription>
          </ItemContent>
          <ItemActions><Badge variant="secondary">Ortak</Badge><I.chevRight /></ItemActions>
        </Item>

        <FieldTitle className="mx-2.5 mt-1.5 mb-2 text-[10.5px] font-bold uppercase tracking-[.06em] text-muted-foreground">Sayfa akışı</FieldTitle>
        {sections.map((section, index) => {
          const catalog = HOME_SECTION_LIBRARY.find((item) => item.id === section.sectionId)
          if (!catalog) return null
          const Icon = I[catalog.icon]
          const selected = selectedSectionId === section.id
          const settings = homeState.sectionSettings[section.id] ?? {}
          const displayTitle = settings.title?.trim() || catalog.label
          return (
            <Item
              key={section.id}
              size="xs"
              variant={selected ? 'muted' : 'default'}
              draggable
              onDragStart={() => setDragId(section.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => { if (dragId) moveSection(dragId, section.id) }}
              className="min-h-[58px] gap-1.5 px-2 py-1.5 text-muted-foreground"
              style={{ opacity: section.enabled ? 1 : .55 }}
            >
              <ItemMedia variant="icon" className="cursor-grab text-muted-foreground"><I.drag /></ItemMedia>
              <Button type="button" variant="ghost" aria-label={`${displayTitle} bölümünü düzenle`} title={displayTitle} onClick={() => onSelectSection(section.id)} className="h-auto min-w-0 flex-1 justify-start gap-2 p-0 text-left hover:bg-transparent">
                <Icon />
                <ItemContent className="min-w-0">
                  <ItemTitle className="line-clamp-2 text-[12.5px]">{displayTitle}</ItemTitle>
                  <ItemDescription className="text-[10.5px]">{catalog.plan === 'pro' ? 'Pro · ' : ''}{catalog.sub}</ItemDescription>
                </ItemContent>
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={section.enabled ? 'Bölümü gizle' : 'Bölümü göster'} onClick={() => patchSection(section.id, { enabled: !section.enabled })}>
                {section.enabled ? <I.eye /> : <I.eyeOff />}
              </Button>
              {selected ? <DropdownMenu>
                <DropdownMenuTrigger aria-label="Bölüm işlemleri" render={<Button type="button" variant="ghost" size="icon-sm" />}><I.more /></DropdownMenuTrigger>
                <DropdownMenuContent align="end" aria-label={`${displayTitle} işlemleri`}>
                  <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => {
                    const clone = { ...section, id: `${section.id}-copy-${Date.now().toString(36)}` }
                    const next = [...sections]
                    next.splice(index + 1, 0, clone)
                    const nextSettings = { ...homeState.sectionSettings, [clone.id]: { ...(homeState.sectionSettings[section.id] ?? {}) } }
                    onPatch(homeV2Patch(theme, { ...homeState.home, blocks: next }, nextSettings))
                    onSelectSection(clone.id)
                  }}><I.copy />Bölümü çoğalt</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => {
                    const nextSettings = { ...homeState.sectionSettings }
                    delete nextSettings[section.id]
                    onPatch(homeV2Patch(theme, { ...homeState.home, blocks: sections.filter((candidate) => candidate.id !== section.id) }, nextSettings))
                    if (selected) onSelectSection(null)
                  }}><I.trash />Bölümü kaldır</DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu> : null}
            </Item>
          )
        })}

        <Item render={<Button ref={sectionTriggerRef} type="button" variant="outline" aria-label="Bölüm ekle" onClick={onOpenSectionPicker} />} variant="outline" size="sm" className="mt-3.5 min-h-14 justify-start border-dashed text-left whitespace-normal">
          <ItemMedia variant="icon" className="size-9 rounded-lg bg-primary/10 text-primary"><I.plus /></ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="text-[12.5px]">Bölüm ekle</ItemTitle>
            <ItemDescription className="truncate text-[10.5px]">Menü bileşenlerini ve Video Hero’yu ekle</ItemDescription>
          </ItemContent>
          <ItemActions><I.chevRight /></ItemActions>
        </Item>

        <FieldTitle className="mx-2.5 mt-4.5 mb-2 text-[10.5px] font-bold uppercase tracking-[.06em] text-muted-foreground">Ortak alanlar</FieldTitle>
        <Item
          render={<Button type="button" variant="ghost" aria-pressed={selectedSectionId === '__shared-footer'} onClick={() => onSelectShared('footer')} />}
          variant={selectedSectionId === '__shared-footer' ? 'muted' : 'default'}
          size="sm"
          className="min-h-[54px] text-left"
        >
          <ItemMedia variant="icon" className="size-8 rounded-lg border bg-background"><I.layout /></ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="text-[12.5px]">Ortak Footer</ItemTitle>
            <ItemDescription className="text-[10.5px]">İletişim ve sosyal bağlantılar Menü ile ortak</ItemDescription>
          </ItemContent>
          <ItemActions><Badge variant="secondary">Ortak</Badge><I.chevRight /></ItemActions>
        </Item>
      </div></ScrollArea>
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
    <aside style={{ width, minWidth: 0, minHeight: 0, boxSizing: 'border-box', flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--divider)' }}>
        <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 14, fontWeight: 750 }}>Yüzey ayarları</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: 11.5 }}>Güvenli içerik ve görünüm alanları</p>
      </div>
      <ScrollArea className="min-h-0 flex-1"><div style={{ minWidth: 0, boxSizing: 'border-box', padding: 16 }}>
        {surface === 'home' && selectedSection && (
          <>
            <SettingsCard className="mb-3.5">
              <SettingsCardHeader icon={selectedHomeDefinition ? (() => { const Icon = I[selectedHomeDefinition.icon]; return <Icon size={17} /> })() : <I.layout size={17} />} title={selectedHomeDefinition?.label ?? 'Ana sayfa bölümü'} meta={selectedHomeDefinition?.id === 'storefront-video-hero' ? 'Pro · Ana sayfa' : selectedHomeDefinition?.plan === 'pro' ? 'Pro · Menü bileşeni' : 'Menü bileşeni'} />
              <Tabs value={effectiveHomeTab} onValueChange={(value) => setHomeEditorTab(value as EditorTab)}>
                <TabsList aria-label="Ana sayfa bölüm ayarları" style={{ width: '100%', display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, homeTabs.length)},minmax(0,1fr))`, marginBottom: 14 }}>
                  {homeTabs.map((tab) => <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>)}
                </TabsList>
              </Tabs>

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
              <Button type="button" onClick={() => {
                const next = { ...homeState.sectionSettings }
                delete next[selectedSection.id]
                onPatch(homeV2Patch(theme, homeState.home, next))
              }} variant="link" className="mt-3 w-full border-t">Bu bölümün ayarlarını varsayılana döndür</Button>
            </SettingsCard>
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

            <SettingsCard>
              <SettingsCardHeader icon={<I.image size={17} />} title="Header medyası" meta="Tüm durumlarda sabit" />
              <AuthHeaderMediaUploader
                restaurantId={restaurantId}
                header={surfaces.auth.header}
                onChange={updateAuthHeader}
              />
              <Field label="Görsel yerleşimi"><NativeSelect value={surfaces.auth.header.imageFit ?? 'cover'} onChange={(event) => updateAuthHeader({ imageFit: event.target.value as AuthHeaderTheme['imageFit'] })} style={inputStyle}><NativeSelectOption value="cover">Alanı doldur (cover)</NativeSelectOption><NativeSelectOption value="contain">Görselin tamamı (contain)</NativeSelectOption></NativeSelect></Field>
              {surfaces.auth.header.backgroundImageUrl && <AuthImageFocusControl header={surfaces.auth.header} onChange={updateAuthHeader} />}
              <Field label="Header yüksekliği"><NativeSelect value={surfaces.auth.header.height ?? 'standard'} onChange={(event) => updateAuthHeader({ height: event.target.value as AuthHeaderTheme['height'] })} style={inputStyle}><NativeSelectOption value="compact">Kompakt</NativeSelectOption><NativeSelectOption value="standard">Standart</NativeSelectOption><NativeSelectOption value="wide">Geniş</NativeSelectOption></NativeSelect></Field>
              <Field label={`Fotoğraf karartması · %${surfaces.auth.header.overlay}`}><RangeControl label="Fotoğraf karartması" min={0} max={85} value={surfaces.auth.header.overlay} onChange={(value) => updateAuthHeader({ overlay: value })} /></Field>
              <Field label="Header zemin rengi"><InputGroup><InputGroupAddon className="border-r px-1.5"><input aria-label="Header zemin rengini seç" type="color" value={surfaces.auth.header.backgroundColor ?? '#12271c'} onChange={(event) => updateAuthHeader({ backgroundColor: event.target.value })} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" /></InputGroupAddon><InputGroupInput aria-label="Header zemin rengi" value={surfaces.auth.header.backgroundColor ?? '#12271c'} onChange={(event) => { if (/^#[0-9a-f]{6}$/i.test(event.target.value)) updateAuthHeader({ backgroundColor: event.target.value }) }} /></InputGroup></Field>
            </SettingsCard>

            <SettingsCard className="mt-3.5">
              <SettingsCardHeader icon={<I.header size={17} />} title="Header içeriği" />
              {surfaces.auth.header.backgroundImageUrl && surfaces.auth.header.logoMode === 'restaurant' && <Alert variant="destructive"><I.warn /><AlertDescription>Fotoğraf ve varsayılan işletme logosu aynı alanda çakışabilir.</AlertDescription><Button type="button" variant="outline" size="xs" onClick={() => updateAuthHeader({ logoMode: 'none' })} className="mt-2">Logoyu gizle</Button></Alert>}
              <Field label="Logo"><NativeSelect value={surfaces.auth.header.logoMode} onChange={(event) => updateAuthHeader({ logoMode: event.target.value as AuthHeaderTheme['logoMode'] })} style={inputStyle}><NativeSelectOption value="none">Gösterme</NativeSelectOption><NativeSelectOption value="restaurant">İşletme logosu</NativeSelectOption><NativeSelectOption value="custom">Özel logo</NativeSelectOption></NativeSelect></Field>
              {surfaces.auth.header.logoMode === 'custom' && <AuthHeaderMediaUploader restaurantId={restaurantId} header={surfaces.auth.header} onChange={updateAuthHeader} logoOnly />}
              <Field label="Header başlığı (isteğe bağlı)"><Input value={surfaces.auth.header.title ?? ''} maxLength={100} onChange={(event) => updateAuthHeader({ title: event.target.value })} style={inputStyle} placeholder="Örn. Masana hoş geldin" /></Field>
              <Field label="Slogan (isteğe bağlı)"><Textarea value={surfaces.auth.header.slogan ?? ''} maxLength={180} rows={3} onChange={(event) => updateAuthHeader({ slogan: event.target.value })} style={{ ...inputStyle, paddingTop: 10, resize: 'vertical' }} placeholder="Kısa marka mesajın" /></Field>
              <Field label="Hizalama"><NativeSelect value={surfaces.auth.header.align} onChange={(event) => updateAuthHeader({ align: event.target.value as AuthHeaderTheme['align'] })} style={inputStyle}><NativeSelectOption value="center">Ortala</NativeSelectOption><NativeSelectOption value="left">Sola</NativeSelectOption></NativeSelect></Field>
              <Field label="İçerik tonu"><NativeSelect value={surfaces.auth.header.contentTone ?? 'light'} onChange={(event) => updateAuthHeader({ contentTone: event.target.value as AuthHeaderTheme['contentTone'] })} style={inputStyle}><NativeSelectOption value="light">Açık metin</NativeSelectOption><NativeSelectOption value="dark">Koyu metin</NativeSelectOption></NativeSelect></Field>
            </SettingsCard>

            <SettingsCard className="mt-3.5">
              <SettingsCardHeader icon={<I.layout size={17} />} title="Form yüzeyi" />
              <Field label="Görünüm"><NativeSelect value={surfaces.auth.preset} onChange={(event) => updateSurface({ ...surfaces.auth, preset: event.target.value as ThemeSurfaces['auth']['preset'] })} style={inputStyle}><NativeSelectOption value="brand-panel">Marka paneli</NativeSelectOption><NativeSelectOption value="minimal">Minimal</NativeSelectOption><NativeSelectOption value="immersive">Görsel odaklı</NativeSelectOption></NativeSelect></Field>
              <AuthColorField label="Dış zemin" field="background" value={surfaces.auth.override?.background} effectiveValue={authPalette.background} onChange={updateAuthOverride} />
              <AuthColorField label="Form paneli" field="surface" value={surfaces.auth.override?.surface} effectiveValue={authPalette.surface} onChange={updateAuthOverride} />
              <AuthColorField label="Alan zemini" field="fieldSurface" value={surfaces.auth.override?.fieldSurface} effectiveValue={authPalette.fieldSurface} onChange={updateAuthOverride} />
              <AuthColorField label="Alan kenarlığı" field="fieldBorder" value={surfaces.auth.override?.fieldBorder} effectiveValue={authPalette.fieldBorder} onChange={updateAuthOverride} />
            </SettingsCard>

            <SettingsCard className="mt-3.5">
              <SettingsCardHeader icon={<I.type size={17} />} title={authState === 'join' ? 'Form içeriği' : 'Form renkleri'} />
              {authState === 'join' && <>
                <Field label="Form başlığı"><Input value={surfaces.auth.title ?? ''} maxLength={100} onChange={(event) => updateSurface({ ...surfaces.auth, title: event.target.value })} style={inputStyle} /></Field>
                <Field label="Form açıklaması"><Textarea value={surfaces.auth.subtitle ?? ''} maxLength={240} rows={4} onChange={(event) => updateSurface({ ...surfaces.auth, subtitle: event.target.value })} style={{ ...inputStyle, paddingTop: 10 }} /></Field>
              </>}
              <AuthColorField label="Ana metin" field="text" value={surfaces.auth.override?.text} effectiveValue={authPalette.text} onChange={updateAuthOverride} />
              <AuthColorField label="İkincil metin" field="mutedText" value={surfaces.auth.override?.mutedText} effectiveValue={authPalette.mutedText} onChange={updateAuthOverride} />
              <AuthColorField label="Vurgu, link ve focus" field="accent" value={surfaces.auth.override?.accent} effectiveValue={authPalette.accent} onChange={updateAuthOverride} />
              <AuthColorField label="Ana CTA" field="cta" value={surfaces.auth.override?.cta} effectiveValue={authPalette.cta} onChange={updateAuthOverride} />
              <AuthColorField label="CTA metni" field="ctaText" value={surfaces.auth.override?.ctaText} effectiveValue={authPalette.ctaText} onChange={updateAuthOverride} />
              <ContrastStatus issues={authContrastIssues} />
            </SettingsCard>
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

            <SettingsCard className={checkoutState === 'cart' ? undefined : 'mt-3.5'}>
              <SettingsCardHeader icon={<I.receipt size={17} />} title="Checkout görünümü" meta="Tüm durumlarda ortak" />
              <Field label="Görünüm"><NativeSelect value={surfaces.checkout.preset} onChange={(event) => updateSurface({ ...surfaces.checkout, preset: event.target.value as ThemeSurfaces['checkout']['preset'] })} style={inputStyle}><NativeSelectOption value="clean">Temiz</NativeSelectOption><NativeSelectOption value="brand-header">Marka başlığı</NativeSelectOption><NativeSelectOption value="soft">Yumuşak yüzey</NativeSelectOption></NativeSelect></Field>
              <Field label="Panel boyutu"><NativeSelect value={surfaces.checkout.sheetSize ?? 'standard'} onChange={(event) => updateSurface({ ...surfaces.checkout, sheetSize: event.target.value as NonNullable<ThemeSurfaces['checkout']['sheetSize']> })} style={inputStyle}><NativeSelectOption value="compact">Kompakt</NativeSelectOption><NativeSelectOption value="standard">Standart</NativeSelectOption><NativeSelectOption value="large">Geniş</NativeSelectOption></NativeSelect></Field>
              <Field label={`Köşe yuvarlaklığı · ${surfaces.checkout.override?.radius ?? theme.radius}px`}><RangeControl label="Köşe yuvarlaklığı" min={4} max={28} value={surfaces.checkout.override?.radius ?? theme.radius} onChange={updateCheckoutRadius} /></Field>
            </SettingsCard>

            <SettingsCard className="mt-3.5">
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
            </SettingsCard>
          </>
        )}
        {surface === 'home' && <SurfaceOverrideFields surface={surface} theme={theme} onPatch={onPatch} />}
      </div></ScrollArea>
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
    <SettingsCard>
      <SettingsCardHeader icon={state === 'payment' ? <I.card /> : state === 'success' ? <I.check /> : state === 'table-payment' ? <I.bell /> : <I.warn />} title={`${stateLabel} içeriği`} action={<Button type="button" variant="ghost" size="xs" onClick={onReset} disabled={!hasOverride}>Varsayılana dön</Button>} />

      {payment && <>
        <Field label="Başlık"><Input value={payment.title} maxLength={100} onChange={(event) => onChange({ title: event.target.value })} style={inputStyle} /></Field>
        <Field label="Açıklama"><Textarea value={payment.description} maxLength={240} rows={3} onChange={(event) => onChange({ description: event.target.value })} style={{ ...inputStyle, paddingTop: 10, resize: 'vertical' }} /></Field>
        <Field label="Tutar etiketi"><Input value={payment.amountLabel} maxLength={60} onChange={(event) => onChange({ amountLabel: event.target.value })} style={inputStyle} /></Field>
        <Field label="Ödeme yöntemi başlığı"><Input value={payment.methodSectionTitle} maxLength={60} onChange={(event) => onChange({ methodSectionTitle: event.target.value })} style={inputStyle} /></Field>
        <Field label="Ödeyen kişi başlığı"><Input value={payment.buyerSectionTitle} maxLength={60} onChange={(event) => onChange({ buyerSectionTitle: event.target.value })} style={inputStyle} /></Field>
        <Field label="Ödeyen kişi açıklaması"><Input value={payment.buyerSectionDescription} maxLength={160} onChange={(event) => onChange({ buyerSectionDescription: event.target.value })} style={inputStyle} /></Field>
        <Field label="Kart butonu etiketi"><Input value={payment.cardActionLabel} maxLength={60} onChange={(event) => onChange({ cardActionLabel: event.target.value })} style={inputStyle} /></Field>
        <Field label="Masada ödeme butonu"><Input value={payment.tableActionLabel} maxLength={60} onChange={(event) => onChange({ tableActionLabel: event.target.value })} style={inputStyle} /></Field>
      </>}

      {status && <>
        <Field label="Başlık"><Input value={status.title} maxLength={100} onChange={(event) => onChange({ title: event.target.value })} style={inputStyle} /></Field>
        {'description' in status && <Field label="Açıklama"><Textarea value={status.description} maxLength={240} rows={4} onChange={(event) => onChange({ description: event.target.value })} style={{ ...inputStyle, paddingTop: 10, resize: 'vertical' }} /></Field>}
        <Field label={state === 'error' ? 'Tekrar dene butonu' : 'Ana buton metni'}><Input value={status.primaryActionLabel} maxLength={60} onChange={(event) => onChange({ primaryActionLabel: event.target.value })} style={inputStyle} /></Field>
        {state === 'error' && 'secondaryActionLabel' in status && <Field label="Kapat butonu"><Input value={status.secondaryActionLabel} maxLength={60} onChange={(event) => onChange({ secondaryActionLabel: event.target.value })} style={inputStyle} /></Field>}
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

      <Alert role="note"><I.shield /><AlertDescription>Gerçek tutar, sağlayıcı, alan adları, sistem hata metni ve buton hedefleri tema tarafından değiştirilemez.</AlertDescription></Alert>
    </SettingsCard>

    <SettingsCard className="mt-3.5">
      <SettingsCardHeader icon={<I.spacing size={17} />} title={`${stateLabel} yerleşimi`} meta="Güvenli aralık" />
      {payment ? <>
        <Field label={`Yatay panel padding · ${payment.layout.paddingX}px`}><RangeControl label="Yatay panel padding" min={12} max={28} value={payment.layout.paddingX} onChange={(value) => onPaymentLayoutChange({ paddingX: value })} /></Field>
        <Field label={`Bölüm aralığı · ${payment.layout.sectionGap}px`}><RangeControl label="Bölüm aralığı" min={12} max={28} value={payment.layout.sectionGap} onChange={(value) => onPaymentLayoutChange({ sectionGap: value })} /></Field>
        <Field label="Kontrol yoğunluğu"><NativeSelect value={payment.layout.density} onChange={(event) => onPaymentLayoutChange({ density: event.target.value as CheckoutPaymentLayoutTheme['density'] })} style={inputStyle}><NativeSelectOption value="compact">Kompakt</NativeSelectOption><NativeSelectOption value="standard">Standart</NativeSelectOption></NativeSelect></Field>
        <Field label="İçerik genişliği"><NativeSelect value={payment.layout.contentWidth} onChange={(event) => onPaymentLayoutChange({ contentWidth: event.target.value as CheckoutPaymentLayoutTheme['contentWidth'] })} style={inputStyle}><NativeSelectOption value="standard">Standart · 520px</NativeSelectOption><NativeSelectOption value="wide">Geniş · 620px</NativeSelectOption></NativeSelect></Field>
      </> : status ? <>
        <Field label={`Yatay panel padding · ${status.layout.paddingX}px`}><RangeControl label="Yatay panel padding" min={12} max={40} value={status.layout.paddingX} onChange={(value) => onResultLayoutChange({ paddingX: value })} /></Field>
        <Field label={`Dikey panel padding · ${status.layout.paddingY}px`}><RangeControl label="Dikey panel padding" min={12} max={56} value={status.layout.paddingY} onChange={(value) => onResultLayoutChange({ paddingY: value })} /></Field>
        <Field label={`İçerik aralığı · ${status.layout.contentGap}px`}><RangeControl label="İçerik aralığı" min={8} max={32} value={status.layout.contentGap} onChange={(value) => onResultLayoutChange({ contentGap: value })} /></Field>
        <Field label="İçerik hizalama"><NativeSelect value={status.layout.align} onChange={(event) => onResultLayoutChange({ align: event.target.value as CheckoutResultLayoutTheme['align'] })} style={inputStyle}><NativeSelectOption value="left">Sola</NativeSelectOption><NativeSelectOption value="center">Ortala</NativeSelectOption></NativeSelect></Field>
        <Field label="İçerik genişliği"><NativeSelect value={status.layout.contentWidth} onChange={(event) => onResultLayoutChange({ contentWidth: event.target.value as CheckoutResultLayoutTheme['contentWidth'] })} style={inputStyle}><NativeSelectOption value="compact">Kompakt · 320px</NativeSelectOption><NativeSelectOption value="standard">Standart · 380px</NativeSelectOption><NativeSelectOption value="full">Tam genişlik</NativeSelectOption></NativeSelect></Field>
        <Field label={`İkon boyutu · ${status.layout.iconSize}px`}><RangeControl label="İkon boyutu" min={56} max={96} value={status.layout.iconSize} onChange={(value) => onResultLayoutChange({ iconSize: value })} /></Field>
      </> : null}
    </SettingsCard>
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
    <ToggleGroup value={[value]} onValueChange={(values) => values[0] && onChange(values[0] as CheckoutStatusIcon)} aria-label={`${state === 'success' ? 'Başarı' : state === 'table-payment' ? 'Masada ödeme' : 'Hata'} ikonu`} className="grid w-full grid-cols-2">
      {options.map((option) => {
        const Icon = option.icon
        const selected = value === option.id
        return <ToggleGroupItem
          key={option.id}
          value={option.id}
          variant="outline"
          className="min-h-10 min-w-0 justify-start gap-2"
        ><Icon /><span>{option.label}</span>{selected && <I.check className="ml-auto" />}</ToggleGroupItem>
      })}
    </ToggleGroup>
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
    <SettingsCard>
      <SettingsCardHeader icon={state === 'otp' ? <I.mail /> : state === 'success' ? <I.check /> : <I.warn />} title={`${stateLabel} içeriği`} action={<Button type="button" variant="ghost" size="xs" onClick={onReset} disabled={!hasOverride}>Varsayılana dön</Button>} />
      <Field label="Başlık"><Input value={resolved.title} maxLength={100} onChange={(event) => onChange({ title: event.target.value })} style={inputStyle} /></Field>
      <Field label="Açıklama"><Textarea value={resolved.description} maxLength={240} rows={4} onChange={(event) => onChange({ description: event.target.value })} style={{ ...inputStyle, paddingTop: 10, resize: 'vertical' }} /></Field>
      <Field label="Ana buton metni"><Input value={resolved.primaryActionLabel} maxLength={60} onChange={(event) => onChange({ primaryActionLabel: event.target.value })} style={inputStyle} /></Field>
      {otpState && <Field label="Tekrar gönder metni"><Input value={otpState.resendLabel} maxLength={60} onChange={(event) => onChange({ resendLabel: event.target.value })} style={inputStyle} /></Field>}
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
      <Alert role="note"><I.shield /><AlertDescription>E-posta, sayaç, sistem hata metinleri ve buton hedefi tema tarafından değiştirilemez.</AlertDescription></Alert>
    </SettingsCard>

    <SettingsCard className="mt-3.5">
      <SettingsCardHeader icon={<I.spacing size={17} />} title={`${stateLabel} yerleşimi`} meta="Güvenli aralık" />
      <Field label={`Yatay panel padding · ${resolved.layout.paddingX}px`}><RangeControl label="Yatay panel padding" min={12} max={40} value={resolved.layout.paddingX} onChange={(value) => onLayoutChange({ paddingX: value })} /></Field>
      <Field label={`Dikey panel padding · ${resolved.layout.paddingY}px`}><RangeControl label="Dikey panel padding" min={12} max={56} value={resolved.layout.paddingY} onChange={(value) => onLayoutChange({ paddingY: value })} /></Field>
      <Field label={`İçerik aralığı · ${resolved.layout.contentGap}px`}><RangeControl label="İçerik aralığı" min={8} max={32} value={resolved.layout.contentGap} onChange={(value) => onLayoutChange({ contentGap: value })} /></Field>
      <Field label="İçerik hizalama"><NativeSelect value={resolved.layout.align} onChange={(event) => onLayoutChange({ align: event.target.value as AuthStateLayoutTheme['align'] })} style={inputStyle}><NativeSelectOption value="left">Sola</NativeSelectOption><NativeSelectOption value="center">Ortala</NativeSelectOption></NativeSelect></Field>
      <Field label="İçerik genişliği"><NativeSelect value={resolved.layout.contentWidth} onChange={(event) => onLayoutChange({ contentWidth: event.target.value as AuthStateLayoutTheme['contentWidth'] })} style={inputStyle}><NativeSelectOption value="compact">Kompakt · 320px</NativeSelectOption><NativeSelectOption value="standard">Standart · 380px</NativeSelectOption><NativeSelectOption value="full">Tam genişlik</NativeSelectOption></NativeSelect></Field>
      {state !== 'otp' && <Field label={`İkon boyutu · ${resolved.layout.iconSize}px`}><RangeControl label="İkon boyutu" min={56} max={96} value={resolved.layout.iconSize} onChange={(value) => onLayoutChange({ iconSize: value })} /></Field>}
    </SettingsCard>
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
    <InputGroup>
      <InputGroupAddon className="border-r px-1.5"><input aria-label={`${label} seç`} type="color" value={value} onChange={(event) => { setDraft(event.target.value); onChange(event.target.value) }} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" /></InputGroupAddon>
      <InputGroupInput
        aria-label={`${label} hex değeri`}
        value={draft}
        maxLength={7}
        onChange={(event) => { setDraft(event.target.value); commit(event.target.value) }}
        onBlur={() => { if (!/^#[0-9a-f]{6}$/i.test(draft)) setDraft(value) }}
      />
    </InputGroup>
    <Button type="button" variant="link" size="xs" disabled={inherited} onClick={() => onChange(undefined)} className="self-start px-0">
      {inherited ? 'Durum varsayılanı' : 'Varsayılanı kullan'}
    </Button>
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
    <ToggleGroup value={[value]} onValueChange={(values) => values[0] && onChange(values[0] as AuthSuccessIcon | AuthErrorIcon)} aria-label={`${state === 'success' ? 'Başarı' : 'Hata'} ikonu`} className="grid w-full grid-cols-2">
      {options.map((option) => {
        const Icon = option.icon
        const selected = value === option.id
        return <ToggleGroupItem
          key={option.id}
          value={option.id}
          variant="outline"
          className="min-h-10 min-w-0 justify-start gap-2"
        ><Icon /><span>{option.label}</span>{selected && <I.check className="ml-auto" />}</ToggleGroupItem>
      })}
    </ToggleGroup>
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
        <UploadAttachment title={header.backgroundImageUrl ? 'Header fotoğrafını değiştir' : 'Header fotoğrafı yükle'} description="JPEG, PNG veya WebP" icon={<I.image size={16} />} state={busy === 'background' ? 'processing' : header.backgroundImageUrl ? 'done' : 'idle'} accept="image/jpeg,image/png,image/webp" disabled={busy !== null} onChange={(event) => void upload(event, 'background')} />
        {header.backgroundImageUrl && <Button type="button" variant="link" size="xs" onClick={() => onChange({ backgroundImageUrl: undefined })} className="text-destructive">Fotoğrafı kaldır</Button>}
      </>}
      {logoOnly && <>
        <UploadAttachment title={header.logoUrl ? 'Özel logoyu değiştir' : 'Özel logo yükle'} description="JPEG, PNG veya WebP" icon={<I.upload size={16} />} state={busy === 'logo' ? 'processing' : header.logoUrl ? 'done' : 'idle'} accept="image/jpeg,image/png,image/webp" disabled={busy !== null} onChange={(event) => void upload(event, 'logo')} style={{ marginTop: 8 }} />
        {header.logoUrl && <Button type="button" variant="link" size="xs" onClick={() => onChange({ logoUrl: undefined })} className="text-destructive">Özel logoyu kaldır</Button>}
      </>}
      <p style={{ margin: '8px 0 0', color: message.includes('hazır') ? 'var(--positive)' : 'var(--text-3)', fontSize: 10.5, lineHeight: 1.45 }} aria-live="polite">{message || (logoOnly ? 'JPEG, PNG veya WebP. Logo en fazla 2 MB.' : 'JPEG, PNG veya WebP. Fotoğraf en fazla 8 MB.')}</p>
    </div>
  )
}

function AuthHeaderThumbnail({ header }: { header: AuthHeaderTheme }) {
  const tone = header.contentTone ?? 'light'
  const overlay = Math.min(85, Math.max(0, header.overlay)) / 100
  return (
    <div role="img" aria-label="Giriş Header gerçek kadraj önizlemesi" style={{ position: 'relative', height: 88, marginBottom: 8, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 10, background: header.backgroundColor ?? '#12271c' }}>
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
        <Field label={`X · %${x}`}><RangeControl label="Yatay odak" min={0} max={100} value={x} onChange={(value) => onChange({ imagePositionX: value })} /></Field>
        <Field label={`Y · %${y}`}><RangeControl label="Dikey odak" min={0} max={100} value={y} onChange={(value) => onChange({ imagePositionY: value })} /></Field>
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
      <InputGroup>
        <InputGroupAddon className="border-r px-1.5"><input aria-label={`${label} rengini seç`} type="color" value={value ?? effectiveValue} onChange={(event) => { setDraft(event.target.value); onChange(field, event.target.value) }} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" /></InputGroupAddon>
        <InputGroupInput
          aria-label={`${label} hex değeri`}
          value={draft}
          onChange={(event) => { setDraft(event.target.value); commit(event.target.value) }}
          onBlur={() => { if (!/^#[0-9a-f]{6}$/i.test(draft)) setDraft(value ?? effectiveValue) }}
          placeholder="#000000"
        />
      </InputGroup>
      <Button type="button" variant="link" size="xs" disabled={inherited} onClick={() => { setDraft(effectiveValue); onChange(field, undefined) }} className="self-start px-0">
        {inherited ? 'Ortak temadan kullanılıyor' : 'Ortak temadan kullan'}
      </Button>
    </Field>
  )
}

function ContrastStatus({ issues }: { issues: Array<AuthContrastIssue | CheckoutContrastIssue> }) {
  if (issues.length === 0) {
    return <Alert role="status"><I.check /><AlertDescription>Metin, alan ve CTA kontrastları yayın için uygun.</AlertDescription></Alert>
  }
  return (
    <Alert variant="destructive">
      <I.warn />
      <div><AlertTitle>Yayınlama için kontrastı düzelt</AlertTitle><AlertDescription>{issues.map((issue) => <div key={issue.id}>{issue.label}: {issue.ratio}:1 · gereken {issue.minimum}:1</div>)}</AlertDescription></div>
    </Alert>
  )
}

function SettingsCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const nodes = Children.toArray(children)
  const [header, ...content] = nodes
  return <Card size="sm" className={className}>
    {header}
    <CardContent className="flex flex-col">{content}</CardContent>
  </Card>
}

function SettingsCardHeader({ icon, title, meta, action }: { icon: React.ReactNode; title: string; meta?: string; action?: React.ReactNode }) {
  return <CardHeader>
    <div className="flex items-center gap-2">{icon}<CardTitle>{title}</CardTitle></div>
    {(meta || action) && <CardAction>{action ?? <Badge variant="secondary">{meta}</Badge>}</CardAction>}
  </CardHeader>
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
  return <Card size="sm" className="mb-4">
    <CardHeader><div className="flex items-center gap-2"><I.play /><CardTitle>Pro hero video</CardTitle></div><CardAction><Badge variant={enabled ? 'secondary' : 'outline'}>{enabled ? 'Açık' : 'Kilitli'}</Badge></CardAction></CardHeader>
    <CardContent>
    <UploadAttachment title={videoUrl ? 'Video hazır · değiştir' : 'MP4 / WebM yükle'} description="H.264 MP4 veya VP8/VP9 WebM" icon={<I.upload size={16} />} state={busy === 'video' ? 'processing' : videoUrl ? 'done' : 'idle'} accept="video/mp4,video/webm" disabled={!enabled || busy !== null} onChange={(event) => void uploadVideo(event)} />
    <UploadAttachment title={posterUrl ? 'Poster hazır · değiştir' : 'Zorunlu poster yükle'} description="JPEG, PNG veya WebP" icon={<I.image size={16} />} state={busy === 'poster' ? 'processing' : posterUrl ? 'done' : 'idle'} accept="image/jpeg,image/png,image/webp" disabled={!enabled || busy !== null} onChange={(event) => void uploadPoster(event)} style={{ marginTop: 8 }} />
    {effectiveFeedback ? <Alert
      variant={effectiveFeedback.tone === 'error' ? 'destructive' : 'default'}
      className="mt-2"
    ><AlertDescription>{effectiveFeedback.text}</AlertDescription></Alert> : null}
    <FieldDescription className="mt-2">En fazla 8 MB ve 15 sn. H.264 MP4 veya VP8/VP9 WebM. Önizleme için video ve poster gereklidir.</FieldDescription>
    </CardContent>
  </Card>
}

function SurfaceOverrideFields({ surface, theme, onPatch }: { surface: ThemeEditorSurface; theme: GarsonlessTheme; onPatch: (patch: Partial<GarsonlessTheme>) => void }) {
  if (surface === 'menu') return null
  const surfaces = resolvedSurfaces(theme)
  const current = surfaces[surface].override ?? {}
  const update = (key: 'background' | 'surface' | 'accent' | 'text' | 'cta', value: string) => {
    onPatch({ experienceVersion: 2, surfaces: { ...surfaces, [surface]: { ...surfaces[surface], override: { ...current, [key]: value } } } })
  }
  return (
    <div className="mt-5.5 flex min-w-0 w-full flex-col gap-3">
      <Separator />
      <h3 style={{ margin: '0 0 12px', color: 'var(--text)', fontSize: 12.5, fontWeight: 750 }}>Yüzey renkleri</h3>
      {([['background', 'Arka plan'], ['surface', 'Kart yüzeyi'], ['accent', 'Vurgu'], ['text', 'Metin'], ['cta', 'Ana buton']] as const).map(([key, label]) => (
        <Field key={key} label={label}>
          <InputGroup>
            <InputGroupAddon className="border-r px-1.5"><input aria-label={`${label} rengini seç`} type="color" value={current[key] ?? (key === 'background' ? theme.bg : key === 'surface' ? theme.cardColor ?? '#ffffff' : key === 'text' ? theme.textColor ?? '#1c1d20' : key === 'cta' ? theme.cta : theme.accent)} onChange={(event) => update(key, event.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" /></InputGroupAddon>
            <InputGroupInput value={current[key] ?? ''} onChange={(event) => update(key, event.target.value)} placeholder="Ortak temadan" />
          </InputGroup>
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
  const controlId = useId()
  const directControl = isValidElement(children) && (children.type === Input || children.type === Textarea || children.type === NativeSelect)
  const labelledControlId = directControl ? (children.props as { id?: string }).id ?? controlId : undefined
  const labelledControl = directControl
    ? cloneElement(children as ReactElement<{ id?: string }>, { id: labelledControlId })
    : children
  return <ShadcnField className="mb-4">
    {directControl ? <FieldLabel htmlFor={labelledControlId}>{label}</FieldLabel> : <FieldTitle>{label}</FieldTitle>}
    {labelledControl}
  </ShadcnField>
}

function EmptyProperties({ text }: { text: string }) {
  return <Empty style={{ padding: '28px 12px' }}><EmptyHeader><EmptyMedia variant="icon"><I.layout size={18} /></EmptyMedia><EmptyDescription>{text}</EmptyDescription></EmptyHeader></Empty>
}

function UploadAttachment({ title, description, icon, accept, disabled, state, style, onChange }: { title: string; description: string; icon: React.ReactNode; accept: string; disabled?: boolean; state: 'idle' | 'processing' | 'done'; style?: CSSProperties; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const inputId = useId()
  return <label htmlFor={inputId} aria-disabled={disabled} style={{ display: 'block', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, ...style }}>
    <Attachment size="sm" state={state} style={{ width: '100%', pointerEvents: 'none' }}>
      <AttachmentMedia>{icon}</AttachmentMedia>
      <AttachmentContent><AttachmentTitle>{title}</AttachmentTitle><AttachmentDescription>{description}</AttachmentDescription></AttachmentContent>
    </Attachment>
    <Input id={inputId} type="file" accept={accept} disabled={disabled} onChange={onChange} className="sr-only" />
  </label>
}

function RangeControl({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <Slider aria-label={label} value={value} min={min} max={max} step={step} onValueChange={(next) => onChange(Number(Array.isArray(next) ? next[0] ?? value : next))} />
}

const inputStyle: CSSProperties = { width: '100%', minWidth: 0 }
