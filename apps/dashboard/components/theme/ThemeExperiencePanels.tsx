'use client'

import { Children, cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactElement, type RefObject } from 'react'
import {
  inspectAuthSurfaceContrast,
  inspectCheckoutSurfaceContrast,
  inspectHomeSurfaceContrast,
  resolveAuthErrorState,
  resolveAuthOtpState,
  resolveAuthSuccessState,
  resolveAuthSurfacePalette,
  resolveCheckoutErrorState,
  resolveCheckoutPaymentState,
  resolveCheckoutSuccessState,
  resolveCheckoutSurfacePalette,
  resolveCheckoutTablePaymentState,
  resolveHomeSurfacePalette,
  DEFAULT_THEME,
  type AuthContrastIssue,
  type AuthErrorIcon,
  type AuthErrorStateTheme,
  type AuthHeaderTheme,
  type AuthOtpStateTheme,
  type AuthPreviewState,
  type AccountPreviewState,
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
  type HomeColorToken,
  type HomeContrastIssue,
  type HomeSurfacePalette,
  type HomeSurfaceBlock,
  type ThemeEditorSurface,
  type ThemeSurfaces,
} from '@garsonless/design-engine'
import type { PublicCouponChoice } from '@garsonless/domain/coupons'
import { I, type Icon } from '../../lib/ui'
import { uploadThemeMedia, uploadThemeVideo } from '../../lib/dashboard-media-upload-client'
import { HOME_SECTION_LIBRARY, SECTION_SETTING_SCHEMA } from './theme-editor-section-registry'
import { buildVideoHeroModernSettings, buildVideoHeroResetSettings, createInitialSectionSettings } from './theme-section-initial-settings'
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
import { Field as ShadcnField, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import styles from './ThemeExperiencePanels.module.css'
import { ThemeSectionCatalogIcon } from './ThemeSectionCatalogIcon'

const AUTH_STATES: Array<{ id: AuthPreviewState; label: string }> = [
  { id: 'join', label: 'Üyelik' },
  { id: 'otp', label: 'OTP' },
  { id: 'profile', label: 'Profil tamamlama' },
  { id: 'challenge', label: 'Güvenlik doğrulaması' },
  { id: 'success', label: 'Başarılı dönüş' },
  { id: 'error', label: 'Hata' },
]
const ACCOUNT_STATES: Array<{ id: AccountPreviewState; label: string }> = [
  { id: 'overview', label: 'Özet' },
  { id: 'orders', label: 'Siparişler' },
  { id: 'favorites', label: 'Favoriler' },
  { id: 'profile', label: 'Profil ve güvenlik' },
  { id: 'detail', label: 'Sipariş detayı' },
  { id: 'reorder', label: 'Yeniden sipariş' },
  { id: 'loading', label: 'Yükleniyor' },
  { id: 'error', label: 'Hata' },
  { id: 'empty', label: 'Boş durum' },
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
type EditableAuthState = Exclude<AuthPreviewState, 'join' | 'profile' | 'challenge'>
type EditableAuthStateTheme = AuthOtpStateTheme | AuthSuccessStateTheme | AuthErrorStateTheme
type EditableCheckoutState = Exclude<CheckoutPreviewState, 'cart'>
type EditableCheckoutStateTheme = CheckoutPaymentStateTheme | CheckoutSuccessStateTheme | CheckoutTablePaymentStateTheme | CheckoutErrorStateTheme
type CheckoutStatusIcon = CheckoutSuccessIcon | CheckoutTablePaymentIcon | CheckoutErrorIcon
type ThemePatchOptions = { historyGroup?: string }
type ThemePatchHandler = (patch: Partial<GarsonlessTheme>, options?: ThemePatchOptions) => void

function resolvedSurfaces(theme: GarsonlessTheme): ThemeSurfaces {
  return theme.surfaces ?? DEFAULT_THEME.surfaces!
}

export function ThemeExperienceSidebar({
  width,
  surface,
  theme,
  selectedSectionId,
  authState,
  accountState,
  checkoutState,
  sectionTriggerRef,
  onSelectSection,
  onSelectShared,
  onOpenSectionPicker,
  onAuthStateChange,
  onAccountStateChange,
  onCheckoutStateChange,
  onPatch,
  onRetireMedia,
}: {
  width: number
  surface: ThemeEditorSurface
  theme: GarsonlessTheme
  selectedSectionId: string | null
  authState: AuthPreviewState
  accountState: AccountPreviewState
  checkoutState: CheckoutPreviewState
  sectionTriggerRef: RefObject<HTMLButtonElement | null>
  onSelectSection: (id: string | null) => void
  onSelectShared: (target: 'header' | 'footer') => void
  onOpenSectionPicker: () => void
  onAuthStateChange: (state: AuthPreviewState) => void
  onAccountStateChange: (state: AccountPreviewState) => void
  onCheckoutStateChange: (state: CheckoutPreviewState) => void
  onPatch: ThemePatchHandler
  onRetireMedia?: (url: string) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)

  if (surface !== 'home') {
    const states = surface === 'auth' ? AUTH_STATES : surface === 'account' ? ACCOUNT_STATES : CHECKOUT_STATES
    const current = surface === 'auth' ? authState : surface === 'account' ? accountState : checkoutState
    const title = surface === 'auth' ? 'Giriş' : surface === 'account' ? 'Masabu Hesabım' : 'Checkout'
    return (
      <SurfaceAside width={width} title={title} subtitle="Önizleme durumu">
        <div style={{ padding: 8 }}>
          <ToggleGroup
            value={[current]}
            onValueChange={(values) => {
              const next = values[0]
              if (!next) return
              if (surface === 'auth') onAuthStateChange(next as AuthPreviewState)
              else if (surface === 'account') onAccountStateChange(next as AccountPreviewState)
              else onCheckoutStateChange(next as CheckoutPreviewState)
            }}
            orientation="vertical"
            className="w-full flex-col items-stretch"
            aria-label={`${title} önizleme durumu`}
          >
          {states.map((state) => (
            <ToggleGroupItem
              key={state.id}
              value={state.id}
              variant="outline"
              className="h-auto min-h-10 w-full justify-start gap-2.5 px-2.5 py-1.5"
            >
              <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 8, background: current === state.id ? 'var(--surface)' : 'var(--surface-3)' }}>
                {state.id === 'error' ? <I.warn size={17} /> : state.id === 'success' ? <I.check size={17} /> : surface === 'auth' || surface === 'account' ? <I.userCircle size={17} /> : <I.receipt size={17} />}
              </span>
              <span>{state.label}</span>
              {current === state.id && <I.chevRight size={17} style={{ marginLeft: 'auto' }} />}
            </ToggleGroupItem>
          ))}
          </ToggleGroup>
          <Alert className="my-4"><I.shield /><AlertDescription>{surface === 'auth' ? 'Önizleme OTP veya OAuth isteği oluşturmaz.' : surface === 'account' ? 'Hesap önizlemesi gerçek müşteri verisi kullanmaz ve değişiklik kaydetmez.' : 'Önizleme sipariş veya ödeme isteği oluşturmaz.'}</AlertDescription></Alert>
        </div>
      </SurfaceAside>
    )
  }

  const homeState = ensureHomeV2(theme)
  const homeHeaderCustomized = Object.keys(homeState.home.chrome?.header ?? {}).length > 0
  const homeFooterCustomized = Object.keys(homeState.home.chrome?.footer ?? {}).length > 0
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
        <ShadcnField orientation="horizontal" className="min-h-16 gap-3 rounded-lg bg-muted px-3.5 py-3">
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
        <Item
          render={<Button type="button" variant="ghost" aria-pressed={selectedSectionId === '__home-style'} onClick={() => onSelectSection('__home-style')} className="focus-visible:border-ring focus-visible:ring-0" />}
          variant={selectedSectionId === '__home-style' ? 'muted' : 'default'}
          size="sm"
          className="mb-2 min-h-[54px] text-left"
        >
          <ItemMedia variant="icon" className="size-8 rounded-lg border bg-background"><I.palette /></ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="text-[12.5px]">Ana sayfa stili</ItemTitle>
            <ItemDescription className="text-[10.5px]">Zemin, metin ve ortak renkler</ItemDescription>
          </ItemContent>
          <ItemActions><Badge variant="secondary">Genel</Badge><I.chevRight /></ItemActions>
        </Item>

        <FieldTitle className="mx-2.5 mt-1.5 mb-2 text-[10.5px] font-bold uppercase tracking-[.06em] text-muted-foreground">Ortak alanlar</FieldTitle>
        <Item
          render={<Button type="button" variant="ghost" aria-pressed={selectedSectionId === '__shared-header'} onClick={() => onSelectShared('header')} className="focus-visible:border-ring focus-visible:ring-0" />}
          variant={selectedSectionId === '__shared-header' ? 'muted' : 'default'}
          size="sm"
          className="min-h-[54px] text-left"
        >
          <ItemMedia variant="icon" className="size-8 rounded-lg border bg-background"><I.header /></ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="text-[12.5px]">Header</ItemTitle>
            <ItemDescription className="text-[10.5px]">{homeHeaderCustomized ? 'Ana sayfaya özel ayarlar' : 'Ortak temel görünüm · 0px alt boşluk'}</ItemDescription>
          </ItemContent>
          <ItemActions><Badge variant="secondary">{homeHeaderCustomized ? 'Özel' : 'Ortak'}</Badge><I.chevRight /></ItemActions>
        </Item>

        <FieldTitle className="mx-2.5 mt-1.5 mb-2 text-[10.5px] font-bold uppercase tracking-[.06em] text-muted-foreground">Sayfa akışı</FieldTitle>
        {sections.map((section, index) => {
          const catalog = HOME_SECTION_LIBRARY.find((item) => item.id === section.sectionId)
          if (!catalog) return null
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
              className="min-h-[58px] gap-1.5 px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground has-[[data-section-select]:focus-visible]:border-ring has-[[data-section-select]:focus-visible]:bg-muted"
              style={{ opacity: section.enabled ? 1 : .55 }}
            >
              <ItemMedia variant="icon" className="cursor-grab text-muted-foreground"><I.drag /></ItemMedia>
              <Tooltip>
                <TooltipTrigger render={<Button data-section-select type="button" variant="ghost" aria-label={`${displayTitle} bölümünü düzenle`} onClick={() => onSelectSection(section.id)} className="h-auto min-w-0 flex-1 justify-start gap-2 border-transparent p-0 text-left hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0" />}>
                  <ThemeSectionCatalogIcon icon={catalog.icon} />
                  <ItemContent className="min-w-0">
                    <ItemTitle className="line-clamp-2 text-[12.5px]">{displayTitle}</ItemTitle>
                    <ItemDescription className="w-full truncate text-[10.5px]">{catalog.plan === 'pro' ? 'Pro · ' : ''}{catalog.sub}</ItemDescription>
                  </ItemContent>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} align="center" className="max-w-64 whitespace-normal text-[11px] leading-snug">
                  {catalog.plan === 'pro' ? 'Pro · ' : ''}{catalog.sub}
                </TooltipContent>
              </Tooltip>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={section.enabled ? 'Bölümü gizle' : 'Bölümü göster'} onClick={() => patchSection(section.id, { enabled: !section.enabled })}>
                {section.enabled ? <I.eye /> : <I.eyeOff />}
              </Button>
              {selected ? <DropdownMenu>
                <DropdownMenuTrigger aria-label="Bölüm işlemleri" render={<Button type="button" variant="ghost" size="icon-sm" />}><I.more /></DropdownMenuTrigger>
                <DropdownMenuContent align="end" aria-label={`${displayTitle} işlemleri`}>
                  <DropdownMenuGroup>
                  {section.sectionId !== 'storefront-video-hero' ? <DropdownMenuItem onClick={() => {
                    const clone = { ...section, id: `${section.id}-copy-${Date.now().toString(36)}` }
                    const next = [...sections]
                    next.splice(index + 1, 0, clone)
                    const nextSettings = { ...homeState.sectionSettings, [clone.id]: { ...(homeState.sectionSettings[section.id] ?? {}) } }
                    onPatch(homeV2Patch(theme, { ...homeState.home, blocks: next }, nextSettings))
                    onSelectSection(clone.id)
                  }}><I.copy />Bölümü çoğalt</DropdownMenuItem> : null}
                  <DropdownMenuItem variant="destructive" onClick={() => {
                    const nextSettings = { ...homeState.sectionSettings }
                    if (section.sectionId === 'storefront-video-hero') {
                      const media = nextSettings[section.id] ?? {}
                      if (media.videoUrl) onRetireMedia?.(media.videoUrl)
                      if (media.posterUrl) onRetireMedia?.(media.posterUrl)
                    }
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

        <Item render={<Button ref={sectionTriggerRef} type="button" variant="outline" aria-label="Bölüm ekle" onClick={onOpenSectionPicker} className="focus-visible:border-ring focus-visible:ring-0" />} variant="outline" size="sm" className="mt-3.5 min-h-14 justify-start border-dashed text-left whitespace-normal">
          <ItemMedia variant="icon" className="size-9 rounded-lg bg-primary/10 text-primary"><I.plus /></ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="text-[12.5px]">Bölüm ekle</ItemTitle>
            <ItemDescription className="truncate text-[10.5px]">Menü bileşenlerini ve Video Hero’yu ekle</ItemDescription>
          </ItemContent>
          <ItemActions><I.chevRight /></ItemActions>
        </Item>

        <FieldTitle className="mx-2.5 mt-4.5 mb-2 text-[10.5px] font-bold uppercase tracking-[.06em] text-muted-foreground">Ortak alanlar</FieldTitle>
        <Item
          render={<Button type="button" variant="ghost" aria-pressed={selectedSectionId === '__shared-footer'} onClick={() => onSelectShared('footer')} className="focus-visible:border-ring focus-visible:ring-0" />}
          variant={selectedSectionId === '__shared-footer' ? 'muted' : 'default'}
          size="sm"
          className="min-h-[54px] text-left"
        >
          <ItemMedia variant="icon" className="size-8 rounded-lg border bg-background"><I.layout /></ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="text-[12.5px]">Footer</ItemTitle>
            <ItemDescription className="text-[10.5px]">{homeFooterCustomized ? 'Ana sayfaya özel ayarlar' : 'Menü ayarlarını kullanır'}</ItemDescription>
          </ItemContent>
          <ItemActions><Badge variant="secondary">{homeFooterCustomized ? 'Özel' : 'Ortak'}</Badge><I.chevRight /></ItemActions>
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
  accountState,
  checkoutState,
  theme,
  selectedSectionId,
  couponOptions,
  menuCategories,
  menuItems,
  onPatch,
  onRetireMedia,
}: {
  width: number
  restaurantId: string
  canAddAdvancedSections: boolean
  surface: ThemeEditorSurface
  authState: AuthPreviewState
  accountState: AccountPreviewState
  checkoutState: CheckoutPreviewState
  theme: GarsonlessTheme
  selectedSectionId: string | null
  couponOptions: PublicCouponChoice[]
  menuCategories: Array<{ id: string; name: string; parentId?: string | null }>
  menuItems: Array<{ id: string; name: string; categoryId: string; categoryName: string; price?: number; images?: unknown; isAvailable?: boolean }>
  onPatch: ThemePatchHandler
  onRetireMedia?: (url: string) => void
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
  const videoHeroBlocks = homeState.home.blocks.filter((block) => block.sectionId === 'storefront-video-hero')
  const updateSurface = (nextSurface: ThemeSurfaces['auth'] | ThemeSurfaces['checkout']) => {
    const target = surface === 'auth' ? 'auth' : 'checkout'
    onPatch({ experienceVersion: 2, surfaces: { ...surfaces, [target]: nextSurface } })
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
  const homePalette = resolveHomeSurfacePalette(theme)
  const homeContrastIssues = inspectHomeSurfaceContrast(theme)
  const updateHomeOverride = (key: HomeColorToken, value: string | undefined, historyGroup?: string) => {
    const nextOverride = { ...(homeState.home.override ?? {}) }
    if (value === undefined) delete nextOverride[key]
    else nextOverride[key] = value
    onPatch(homeV2Patch(theme, {
      ...homeState.home,
      ...(Object.keys(nextOverride).length > 0 ? { override: nextOverride } : { override: undefined }),
    }, homeState.sectionSettings), historyGroup ? { historyGroup } : undefined)
  }
  const repairAuthCtaContrast = () => updateSurface({
    ...surfaces.auth,
    override: {
      ...(surfaces.auth.override ?? {}),
      cta: '#2f855a',
      ctaText: '#ffffff',
    },
  })

  return (
    <aside data-theme-experience-properties data-settings-density="compact" className={styles.properties} style={{ width, minWidth: 0, minHeight: 0, boxSizing: 'border-box', flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px 13px', borderBottom: '1px solid var(--divider)' }}>
        <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 14, fontWeight: 750 }}>Yüzey ayarları</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: 11 }}>Güvenli içerik ve görünüm alanları</p>
      </div>
      <ScrollArea className="min-h-0 flex-1" style={{ background: 'var(--surface-inset)' }}><div data-theme-experience-settings-stack className="flex min-w-0 flex-col gap-2.5 p-3">
        {surface === 'home' && selectedSection && (
          <>
            <SettingsCard toolbar={(
              <Tabs value={effectiveHomeTab} onValueChange={(value) => setHomeEditorTab(value as EditorTab)} className="gap-0">
                <TabsList variant="line" aria-label="Ana sayfa bölüm ayarları" className="h-8 w-full justify-stretch px-1">
                  {homeTabs.map((tab) => <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>)}
                </TabsList>
              </Tabs>
            )}>
              <SettingsCardHeader icon={selectedHomeDefinition ? <ThemeSectionCatalogIcon icon={selectedHomeDefinition.icon} size={17} /> : <I.layout size={17} />} title={selectedHomeDefinition?.label ?? 'Ana sayfa bölümü'} meta={selectedHomeDefinition?.id === 'storefront-video-hero' ? 'Pro · Ana sayfa' : selectedHomeDefinition?.plan === 'pro' ? 'Pro · Menü bileşeni' : 'Menü bileşeni'} />

              {selectedSection.sectionId === 'storefront-video-hero' && videoHeroBlocks.length > 1 ? <Alert variant="destructive"><I.warn /><AlertTitle>Birden fazla Video Hero var</AlertTitle><AlertDescription>{videoHeroBlocks[0]?.id === selectedSection.id ? 'Bu ilk ve birincil hero. Diğer eski örnekleri kaldırmanız önerilir.' : 'Bu ek hero sayfada ikinci H1 ve gereksiz video yükü oluşturabilir.'}</AlertDescription></Alert> : null}
              {selectedSection.sectionId === 'storefront-video-hero' && selectedHomeSettings.editorialVersion !== '2' ? <Alert><I.sparkles /><AlertTitle>Modern yerleşim hazır</AlertTitle><AlertDescription>Medya ve metinler korunarak güvenli 3×3 konum sistemine geçebilirsiniz.</AlertDescription><Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => updateSelected(buildVideoHeroModernSettings(selectedHomeSettings))}>Modern Video Hero’ya geçir</Button></Alert> : null}

              {effectiveHomeTab === 'design' && selectedSection.sectionId === 'hero-banner' && <SectionImageUploadPanel restaurantId={restaurantId} label="Hero Banner" value={selectedHomeSettings.imageUrl ?? ''} onChange={(value) => updateSelected({ imageUrl: value })} />}
              {effectiveHomeTab === 'content' && selectedSection.sectionId === 'gallery' && <GalleryUploadPanel restaurantId={restaurantId} values={selectedHomeSettings} onPatch={updateSelected} onRetireMedia={onRetireMedia} />}
              {effectiveHomeTab === 'design' && selectedSection.sectionId === 'promo-slider' && <PromoSliderImageUploadPanel restaurantId={restaurantId} values={selectedHomeSettings} onChange={(key, value) => updateSelected({ [key]: value })} />}
              {effectiveHomeTab === 'design' && selectedSection.sectionId === 'chef-pick' && <ChefPickIconUploadPanels restaurantId={restaurantId} values={selectedHomeSettings} onChange={(key, value) => updateSelected({ [key]: value })} />}
              {effectiveHomeTab === 'content' && selectedSection.sectionId === 'storefront-video-hero' && (
              <HeroVideoUploader
                restaurantId={restaurantId}
                enabled={canAddAdvancedSections}
                videoUrl={selectedHomeSettings.videoUrl ?? ''}
                posterUrl={selectedHomeSettings.posterUrl ?? ''}
                onChange={(patch) => updateSelected(patch)}
                onRetireMedia={onRetireMedia}
              />
              )}

              <SectionSettingsEditor
                fields={visibleHomeFields}
                values={selectedHomeSettings}
                inheritedColors={homePalette}
                menuCategories={menuCategories}
                menuItems={menuItems}
                couponOptions={couponOptions}
                menuHref={`/dashboard/${restaurantId}/menu`}
                onChange={(key, value) => {
                  if (key !== 'couponId') {
                    updateSelected({ [key]: value })
                    return
                  }
                  const coupon = couponOptions.find((option) => option.id === value)
                  updateSelected({
                    couponId: value,
                    couponEnabled: coupon ? 'true' : 'false',
                    ...(coupon ? {
                      couponEyebrow: coupon.eyebrow,
                      couponTitle: coupon.title,
                      couponSubtitle: coupon.subtitle,
                      couponCode: coupon.code,
                    } : {}),
                  })
                }}
              />
              <Button type="button" onClick={() => {
                const next = { ...homeState.sectionSettings }
                const initialSettings = selectedSection.sectionId === 'storefront-video-hero'
                  ? buildVideoHeroResetSettings(selectedHomeSettings)
                  : createInitialSectionSettings(selectedSection.sectionId)
                if (Object.keys(initialSettings).length > 0) next[selectedSection.id] = initialSettings
                else delete next[selectedSection.id]
                onPatch(homeV2Patch(theme, homeState.home, next))
              }} variant="link" className="w-full border-t pt-3">Bu bölümün ayarlarını varsayılana döndür</Button>
            </SettingsCard>
          </>
        )}
        {surface === 'home' && selectedSectionId === '__home-style' && (
          <HomeStyleSettings
            values={homeState.home.override ?? {}}
            palette={homePalette}
            issues={homeContrastIssues}
            onChange={updateHomeOverride}
          />
        )}
        {surface === 'home' && !selectedSection && selectedSectionId !== '__home-style' && <EmptyProperties text="Düzenlemek için soldan bir ana sayfa bölümü veya Ana sayfa stili seç." />}
        {surface === 'auth' && (
          <>
            {authState !== 'join' && authState !== 'profile' && authState !== 'challenge' && <AuthStateSettings
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
              <RangeField label="Fotoğraf karartması" unit="%" min={0} max={85} value={surfaces.auth.header.overlay} onChange={(value) => updateAuthHeader({ overlay: value })} />
              <Field label="Header zemin rengi"><InputGroup><InputGroupAddon className="border-r px-1.5"><input aria-label="Header zemin rengini seç" type="color" value={surfaces.auth.header.backgroundColor ?? '#12271c'} onChange={(event) => updateAuthHeader({ backgroundColor: event.target.value })} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" /></InputGroupAddon><InputGroupInput aria-label="Header zemin rengi" value={surfaces.auth.header.backgroundColor ?? '#12271c'} onChange={(event) => { if (/^#[0-9a-f]{6}$/i.test(event.target.value)) updateAuthHeader({ backgroundColor: event.target.value }) }} /></InputGroup></Field>
            </SettingsCard>

            <SettingsCard>
              <SettingsCardHeader icon={<I.header size={17} />} title="Header içeriği" />
              {surfaces.auth.header.backgroundImageUrl && surfaces.auth.header.logoMode === 'restaurant' && <Alert variant="destructive"><I.warn /><AlertDescription>Fotoğraf ve varsayılan işletme logosu aynı alanda çakışabilir.</AlertDescription><Button type="button" variant="outline" size="xs" onClick={() => updateAuthHeader({ logoMode: 'none' })} className="mt-2">Logoyu gizle</Button></Alert>}
              <Field label="Logo"><NativeSelect value={surfaces.auth.header.logoMode} onChange={(event) => updateAuthHeader({ logoMode: event.target.value as AuthHeaderTheme['logoMode'] })} style={inputStyle}><NativeSelectOption value="none">Gösterme</NativeSelectOption><NativeSelectOption value="restaurant">İşletme logosu</NativeSelectOption><NativeSelectOption value="custom">Özel logo</NativeSelectOption></NativeSelect></Field>
              {surfaces.auth.header.logoMode === 'custom' && <AuthHeaderMediaUploader restaurantId={restaurantId} header={surfaces.auth.header} onChange={updateAuthHeader} logoOnly />}
              <Field label="Header başlığı (isteğe bağlı)"><Input value={surfaces.auth.header.title ?? ''} maxLength={100} onChange={(event) => updateAuthHeader({ title: event.target.value })} style={inputStyle} placeholder="Örn. Masana hoş geldin" /></Field>
              <Field label="Slogan (isteğe bağlı)"><Textarea value={surfaces.auth.header.slogan ?? ''} maxLength={180} rows={3} onChange={(event) => updateAuthHeader({ slogan: event.target.value })} style={{ ...inputStyle, paddingTop: 10, resize: 'vertical' }} placeholder="Kısa marka mesajın" /></Field>
              <Field label="Hizalama"><NativeSelect value={surfaces.auth.header.align} onChange={(event) => updateAuthHeader({ align: event.target.value as AuthHeaderTheme['align'] })} style={inputStyle}><NativeSelectOption value="center">Ortala</NativeSelectOption><NativeSelectOption value="left">Sola</NativeSelectOption></NativeSelect></Field>
              <Field label="İçerik tonu"><NativeSelect value={surfaces.auth.header.contentTone ?? 'light'} onChange={(event) => updateAuthHeader({ contentTone: event.target.value as AuthHeaderTheme['contentTone'] })} style={inputStyle}><NativeSelectOption value="light">Açık metin</NativeSelectOption><NativeSelectOption value="dark">Koyu metin</NativeSelectOption></NativeSelect></Field>
            </SettingsCard>

            <SettingsCard>
              <SettingsCardHeader icon={<I.layout size={17} />} title="Form yüzeyi" />
              <Field label="Görünüm"><NativeSelect value={surfaces.auth.preset} onChange={(event) => updateSurface({ ...surfaces.auth, preset: event.target.value as ThemeSurfaces['auth']['preset'] })} style={inputStyle}><NativeSelectOption value="brand-panel">Marka paneli</NativeSelectOption><NativeSelectOption value="minimal">Minimal</NativeSelectOption><NativeSelectOption value="immersive">Görsel odaklı</NativeSelectOption></NativeSelect></Field>
              <AuthColorField label="Dış zemin" field="background" value={surfaces.auth.override?.background} effectiveValue={authPalette.background} onChange={updateAuthOverride} />
              <AuthColorField label="Form paneli" field="surface" value={surfaces.auth.override?.surface} effectiveValue={authPalette.surface} onChange={updateAuthOverride} />
              <AuthColorField label="Alan zemini" field="fieldSurface" value={surfaces.auth.override?.fieldSurface} effectiveValue={authPalette.fieldSurface} onChange={updateAuthOverride} />
              <AuthColorField label="Alan kenarlığı" field="fieldBorder" value={surfaces.auth.override?.fieldBorder} effectiveValue={authPalette.fieldBorder} onChange={updateAuthOverride} />
            </SettingsCard>

            <SettingsCard>
              <SettingsCardHeader icon={<I.type size={17} />} title={authState === 'join' ? 'Form içeriği' : 'Form renkleri'} />
              {(authState === 'join' || authState === 'profile' || authState === 'challenge') && <>
                <Field label="Form başlığı"><Input value={surfaces.auth.title ?? ''} maxLength={100} onChange={(event) => updateSurface({ ...surfaces.auth, title: event.target.value })} style={inputStyle} /></Field>
                <Field label="Form açıklaması"><Textarea value={surfaces.auth.subtitle ?? ''} maxLength={240} rows={4} onChange={(event) => updateSurface({ ...surfaces.auth, subtitle: event.target.value })} style={{ ...inputStyle, paddingTop: 10 }} /></Field>
              </>}
              <AuthColorField label="Ana metin" field="text" value={surfaces.auth.override?.text} effectiveValue={authPalette.text} onChange={updateAuthOverride} />
              <AuthColorField label="İkincil metin" field="mutedText" value={surfaces.auth.override?.mutedText} effectiveValue={authPalette.mutedText} onChange={updateAuthOverride} />
              <AuthColorField label="Vurgu, link ve focus" field="accent" value={surfaces.auth.override?.accent} effectiveValue={authPalette.accent} onChange={updateAuthOverride} />
              <AuthColorField label="Ana CTA" field="cta" value={surfaces.auth.override?.cta} effectiveValue={authPalette.cta} onChange={updateAuthOverride} />
              <AuthColorField label="CTA metni" field="ctaText" value={surfaces.auth.override?.ctaText} effectiveValue={authPalette.ctaText} onChange={updateAuthOverride} />
              <ContrastStatus
                issues={authContrastIssues}
                repairLabel={authContrastIssues.some((issue) => issue.id === 'cta') ? 'CTA kontrastını otomatik düzelt' : undefined}
                onRepair={authContrastIssues.some((issue) => issue.id === 'cta') ? repairAuthCtaContrast : undefined}
              />
            </SettingsCard>
          </>
        )}
        {surface === 'account' && (
          <>
            <SettingsCard>
              <SettingsCardHeader icon={<I.userCircle size={17} />} title="Masabu Hesabım" meta="Production hesap bileşeni" />
              <Alert><I.shield /><AlertDescription>Bu yüzey Sepet/Checkout ile aynı semantik surface, radius, spacing ve kontrast tokenlarını kullanır. Ayrı bir yayınlanmış tema sözleşmesi oluşturmaz.</AlertDescription></Alert>
              <Field label="Önizlenen durum"><div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">{ACCOUNT_STATES.find((item) => item.id === accountState)?.label ?? 'Özet'}</div></Field>
            </SettingsCard>
            <SettingsCard>
              <SettingsCardHeader icon={<I.palette size={17} />} title="Paylaşılan yüzey tokenları" />
              <Alert><I.shield /><AlertDescription>Renk, köşe ve tipografi ayarları Checkout yüzeyinden; profil kimliği vurguları global accent tokenlarından gelir.</AlertDescription></Alert>
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

            <SettingsCard>
              <SettingsCardHeader icon={<I.receipt size={17} />} title="Checkout görünümü" meta="Tüm durumlarda ortak" />
              <Field label="Görünüm"><NativeSelect value={surfaces.checkout.preset} onChange={(event) => updateSurface({ ...surfaces.checkout, preset: event.target.value as ThemeSurfaces['checkout']['preset'] })} style={inputStyle}><NativeSelectOption value="clean">Temiz</NativeSelectOption><NativeSelectOption value="brand-header">Marka başlığı</NativeSelectOption><NativeSelectOption value="soft">Yumuşak yüzey</NativeSelectOption></NativeSelect></Field>
              <Field label="Panel boyutu"><NativeSelect value={surfaces.checkout.sheetSize ?? 'standard'} onChange={(event) => updateSurface({ ...surfaces.checkout, sheetSize: event.target.value as NonNullable<ThemeSurfaces['checkout']['sheetSize']> })} style={inputStyle}><NativeSelectOption value="compact">Kompakt</NativeSelectOption><NativeSelectOption value="standard">Standart</NativeSelectOption><NativeSelectOption value="large">Geniş</NativeSelectOption></NativeSelect></Field>
              <RangeField label="Köşe yuvarlaklığı" unit="px" min={4} max={28} value={surfaces.checkout.override?.radius ?? theme.radius} onChange={updateCheckoutRadius} />
            </SettingsCard>

            <SettingsCard>
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

    <SettingsCard>
      <SettingsCardHeader icon={<I.spacing size={17} />} title={`${stateLabel} yerleşimi`} meta="Güvenli aralık" />
      {payment ? <>
        <RangeField label="Yatay panel padding" unit="px" min={12} max={28} value={payment.layout.paddingX} onChange={(value) => onPaymentLayoutChange({ paddingX: value })} />
        <RangeField label="Bölüm aralığı" unit="px" min={12} max={28} value={payment.layout.sectionGap} onChange={(value) => onPaymentLayoutChange({ sectionGap: value })} />
        <Field label="Kontrol yoğunluğu"><NativeSelect value={payment.layout.density} onChange={(event) => onPaymentLayoutChange({ density: event.target.value as CheckoutPaymentLayoutTheme['density'] })} style={inputStyle}><NativeSelectOption value="compact">Kompakt</NativeSelectOption><NativeSelectOption value="standard">Standart</NativeSelectOption></NativeSelect></Field>
        <Field label="İçerik genişliği"><NativeSelect value={payment.layout.contentWidth} onChange={(event) => onPaymentLayoutChange({ contentWidth: event.target.value as CheckoutPaymentLayoutTheme['contentWidth'] })} style={inputStyle}><NativeSelectOption value="standard">Standart · 520px</NativeSelectOption><NativeSelectOption value="wide">Geniş · 620px</NativeSelectOption></NativeSelect></Field>
      </> : status ? <>
        <RangeField label="Yatay panel padding" unit="px" min={12} max={40} value={status.layout.paddingX} onChange={(value) => onResultLayoutChange({ paddingX: value })} />
        <RangeField label="Dikey panel padding" unit="px" min={12} max={56} value={status.layout.paddingY} onChange={(value) => onResultLayoutChange({ paddingY: value })} />
        <RangeField label="İçerik aralığı" unit="px" min={8} max={32} value={status.layout.contentGap} onChange={(value) => onResultLayoutChange({ contentGap: value })} />
        <Field label="İçerik hizalama"><NativeSelect value={status.layout.align} onChange={(event) => onResultLayoutChange({ align: event.target.value as CheckoutResultLayoutTheme['align'] })} style={inputStyle}><NativeSelectOption value="left">Sola</NativeSelectOption><NativeSelectOption value="center">Ortala</NativeSelectOption></NativeSelect></Field>
        <Field label="İçerik genişliği"><NativeSelect value={status.layout.contentWidth} onChange={(event) => onResultLayoutChange({ contentWidth: event.target.value as CheckoutResultLayoutTheme['contentWidth'] })} style={inputStyle}><NativeSelectOption value="compact">Kompakt · 320px</NativeSelectOption><NativeSelectOption value="standard">Standart · 380px</NativeSelectOption><NativeSelectOption value="full">Tam genişlik</NativeSelectOption></NativeSelect></Field>
        <RangeField label="İkon boyutu" unit="px" min={56} max={96} value={status.layout.iconSize} onChange={(value) => onResultLayoutChange({ iconSize: value })} />
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
      <Alert role="note"><I.shield /><AlertDescription>Telefon/e-posta hedefi, sayaç, sistem hata metinleri ve buton hedefi tema tarafından değiştirilemez.</AlertDescription></Alert>
    </SettingsCard>

    <SettingsCard>
      <SettingsCardHeader icon={<I.spacing size={17} />} title={`${stateLabel} yerleşimi`} meta="Güvenli aralık" />
      <RangeField label="Yatay panel padding" unit="px" min={12} max={40} value={resolved.layout.paddingX} onChange={(value) => onLayoutChange({ paddingX: value })} />
      <RangeField label="Dikey panel padding" unit="px" min={12} max={56} value={resolved.layout.paddingY} onChange={(value) => onLayoutChange({ paddingY: value })} />
      <RangeField label="İçerik aralığı" unit="px" min={8} max={32} value={resolved.layout.contentGap} onChange={(value) => onLayoutChange({ contentGap: value })} />
      <Field label="İçerik hizalama"><NativeSelect value={resolved.layout.align} onChange={(event) => onLayoutChange({ align: event.target.value as AuthStateLayoutTheme['align'] })} style={inputStyle}><NativeSelectOption value="left">Sola</NativeSelectOption><NativeSelectOption value="center">Ortala</NativeSelectOption></NativeSelect></Field>
      <Field label="İçerik genişliği"><NativeSelect value={resolved.layout.contentWidth} onChange={(event) => onLayoutChange({ contentWidth: event.target.value as AuthStateLayoutTheme['contentWidth'] })} style={inputStyle}><NativeSelectOption value="compact">Kompakt · 320px</NativeSelectOption><NativeSelectOption value="standard">Standart · 380px</NativeSelectOption><NativeSelectOption value="full">Tam genişlik</NativeSelectOption></NativeSelect></Field>
      {state !== 'otp' && <RangeField label="İkon boyutu" unit="px" min={56} max={96} value={resolved.layout.iconSize} onChange={(value) => onLayoutChange({ iconSize: value })} />}
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
        <RangeField label="Yatay odak" unit="%" min={0} max={100} value={x} onChange={(value) => onChange({ imagePositionX: value })} />
        <RangeField label="Dikey odak" unit="%" min={0} max={100} value={y} onChange={(value) => onChange({ imagePositionY: value })} />
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

function ContrastStatus({
  issues,
  repairLabel,
  onRepair,
  blocking = true,
  successMessage = 'Metin, alan ve CTA kontrastları yayın için uygun.',
}: {
  issues: Array<AuthContrastIssue | CheckoutContrastIssue | HomeContrastIssue>
  repairLabel?: string
  onRepair?: () => void
  blocking?: boolean
  successMessage?: string
}) {
  if (issues.length === 0) {
    return <Alert role="status"><I.check /><AlertDescription>{successMessage}</AlertDescription></Alert>
  }
  return (
    <Alert variant="destructive">
      <I.warn />
      <div>
        <AlertTitle>{blocking ? 'Yayınlama için kontrastı düzelt' : 'Kontrastı iyileştirin'}</AlertTitle>
        <AlertDescription>{issues.map((issue) => <div key={issue.id}>{issue.label}: {issue.ratio}:1 · gereken {issue.minimum}:1</div>)}</AlertDescription>
        {onRepair && repairLabel && <Button type="button" variant="outline" size="xs" onClick={onRepair} className="mt-2">{repairLabel}</Button>}
      </div>
    </Alert>
  )
}

function SettingsCard({ children, className, toolbar, density = 'compact' }: { children: React.ReactNode; className?: string; toolbar?: React.ReactNode; density?: 'compact' }) {
  const nodes = Children.toArray(children)
  const [header, ...content] = nodes
  return <Card size="sm" data-settings-card-density={density} className={cn('gap-0 py-0', className)}>
    {header}
    {toolbar ? <div className="border-y bg-muted/20 px-2">{toolbar}</div> : null}
    <CardContent className="flex flex-col gap-2.5 px-3 py-2.5">{content}</CardContent>
  </Card>
}

function SettingsCardHeader({ icon, title, meta, action }: { icon: React.ReactNode; title: string; meta?: string; action?: React.ReactNode }) {
  return <CardHeader className="min-h-11 items-center px-3 py-2">
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">{icon}</span>
      <CardTitle className="min-w-0 truncate text-[13px] font-semibold">{title}</CardTitle>
    </div>
    {(meta || action) && <CardAction className="self-center">{action ?? <Badge variant="secondary" className="max-w-36 truncate text-[10px]">{meta}</Badge>}</CardAction>}
  </CardHeader>
}

function HeroVideoUploader({
  restaurantId,
  enabled,
  videoUrl,
  posterUrl,
  onChange,
  onRetireMedia,
}: {
  restaurantId: string
  enabled: boolean
  videoUrl: string
  posterUrl: string
  onChange: (patch: { videoUrl?: string; posterUrl?: string }) => void
  onRetireMedia?: (url: string) => void
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
      if (videoUrl && videoUrl !== result.url) onRetireMedia?.(videoUrl)
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
      if (posterUrl && posterUrl !== result.url) onRetireMedia?.(posterUrl)
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
  return <Card size="sm" className="mb-0">
    <CardHeader><div className="flex items-center gap-2"><I.play /><CardTitle>Pro hero video</CardTitle></div><CardAction><Badge variant={enabled ? 'secondary' : 'outline'}>{enabled ? 'Açık' : 'Kilitli'}</Badge></CardAction></CardHeader>
    <CardContent>
    {posterUrl ? <div className="relative mb-2 overflow-hidden rounded-lg border bg-muted" style={{ aspectRatio: '16 / 9' }}>
      <img src={posterUrl} alt="Video Hero poster önizlemesi" className="size-full object-cover" />
      <Badge className="absolute bottom-2 left-2 bg-black/70 text-white">Poster önizlemesi</Badge>
    </div> : null}
    <UploadAttachment title={videoUrl ? 'Video hazır · değiştir' : 'MP4 / WebM yükle'} description="H.264 MP4 veya VP8/VP9 WebM" icon={<I.upload size={16} />} state={busy === 'video' ? 'processing' : videoUrl ? 'done' : 'idle'} accept="video/mp4,video/webm" disabled={!enabled || busy !== null} onChange={(event) => void uploadVideo(event)} />
    <UploadAttachment title={posterUrl ? 'Poster hazır · değiştir' : 'Zorunlu poster yükle'} description="JPEG, PNG veya WebP" icon={<I.image size={16} />} state={busy === 'poster' ? 'processing' : posterUrl ? 'done' : 'idle'} accept="image/jpeg,image/png,image/webp" disabled={!enabled || busy !== null} onChange={(event) => void uploadPoster(event)} style={{ marginTop: 8 }} />
    {effectiveFeedback ? <Alert
      variant={effectiveFeedback.tone === 'error' ? 'destructive' : 'default'}
      className="mt-2"
    ><AlertDescription>{effectiveFeedback.text}</AlertDescription></Alert> : null}
    {(videoUrl || posterUrl) ? <Button type="button" variant="outline" size="sm" className="mt-2 w-full" disabled={busy !== null} onClick={() => {
      if (!window.confirm('Video ve posteri kaldırmak istediğinizden emin misiniz?')) return
      onChange({ videoUrl: '', posterUrl: '' })
      if (videoUrl) onRetireMedia?.(videoUrl)
      if (posterUrl) onRetireMedia?.(posterUrl)
      setFeedback({ tone: 'info', text: 'Video ve poster kaldırıldı. Bu işlem geri alınabilir.' })
    }}>Medyayı kaldır</Button> : null}
    <FieldDescription className="mt-2">Poster; video yüklenirken, video duraklatıldığında, hareket/veri tasarrufu tercihinde veya video oynatılamadığında gösterilir. Video en fazla 8 MB ve 15 sn olabilir.</FieldDescription>
    </CardContent>
  </Card>
}

const HOME_COLOR_GROUPS: Array<{
  id: string
  label: string
  fields: Array<{ key: HomeColorToken; label: string }>
}> = [
  { id: 'home-surfaces', label: 'Zeminler', fields: [{ key: 'background', label: 'Sayfa arka planı' }, { key: 'surface', label: 'Kart yüzeyi' }] },
  { id: 'home-text', label: 'Metinler', fields: [{ key: 'text', label: 'Ana metin' }, { key: 'mutedText', label: 'Yardımcı metin' }] },
  { id: 'home-accent', label: 'Vurgular', fields: [{ key: 'accent', label: 'Vurgu rengi' }] },
  { id: 'home-actions', label: 'Aksiyonlar', fields: [{ key: 'cta', label: 'Ana buton' }, { key: 'ctaText', label: 'Buton metni' }] },
]

function HomeStyleSettings({ values, palette, issues, onChange }: {
  values: Partial<Record<HomeColorToken, string>>
  palette: HomeSurfacePalette
  issues: HomeContrastIssue[]
  onChange: (field: HomeColorToken, value: string | undefined, historyGroup?: string) => void
}) {
  return (
    <SettingsCard>
      <SettingsCardHeader icon={<I.palette size={17} />} title="Ana sayfa stili" meta="Ana sayfa geneli" />
      <Alert><I.palette /><AlertDescription>Standart içerik bölümleri boş bırakılan renkleri bu paletten; bu palet de Ortak Tema’dan alır. Kampanya paletleri bölüm içinde kalır.</AlertDescription></Alert>
      {HOME_COLOR_GROUPS.map((group, index) => (
        <FieldSet key={group.id} className={cn('min-w-0 gap-2.5', index > 0 && 'border-t pt-2.5')}>
          <FieldLegend variant="label" className="mb-0 text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">{group.label}</FieldLegend>
          {group.fields.map((field) => (
            <HomeColorField
              key={field.key}
              field={field.key}
              label={field.label}
              value={values[field.key]}
              effectiveValue={palette[field.key]}
              onChange={onChange}
            />
          ))}
        </FieldSet>
      ))}
      <ContrastStatus issues={issues} blocking={false} successMessage="Ana sayfa metin, vurgu ve buton kontrastları uygun." />
    </SettingsCard>
  )
}

function HomeColorField({ label, field, value, effectiveValue, onChange }: {
  label: string
  field: HomeColorToken
  value: string | undefined
  effectiveValue: string
  onChange: (field: HomeColorToken, value: string | undefined, historyGroup?: string) => void
}) {
  const historyGroupId = useId()
  const historySessionRef = useRef(0)
  const activeHistoryGroupRef = useRef<string | null>(null)
  const [draft, setDraft] = useState(value ?? effectiveValue)
  useEffect(() => setDraft(value ?? effectiveValue), [effectiveValue, value])
  const inherited = value === undefined
  const beginHistoryGroup = () => {
    historySessionRef.current += 1
    activeHistoryGroupRef.current = `${historyGroupId}:${historySessionRef.current}`
  }
  const currentHistoryGroup = () => {
    if (!activeHistoryGroupRef.current) beginHistoryGroup()
    return activeHistoryGroupRef.current ?? undefined
  }
  const endHistoryGroup = () => { activeHistoryGroupRef.current = null }
  const commit = (candidate: string) => {
    const normalized = candidate.trim()
    if (!normalized) { onChange(field, undefined, currentHistoryGroup()); return }
    if (/^#[0-9a-f]{6}$/i.test(normalized)) onChange(field, normalized, currentHistoryGroup())
  }
  return (
    <ShadcnField className="min-w-0 gap-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <FieldLabel htmlFor={`home-color-${field}`} className="text-xs leading-4">{label}</FieldLabel>
        <Badge variant={inherited ? 'outline' : 'secondary'} className="text-[9.5px]">{inherited ? 'Ortak temadan' : 'Ana sayfaya özel'}</Badge>
      </div>
      <InputGroup>
        <InputGroupAddon className="border-r px-1.5"><input aria-label={`${label} rengini seç`} type="color" value={value ?? effectiveValue} onFocus={beginHistoryGroup} onBlur={endHistoryGroup} onChange={(event) => { setDraft(event.target.value); onChange(field, event.target.value, currentHistoryGroup()) }} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" /></InputGroupAddon>
        <InputGroupInput
          id={`home-color-${field}`}
          aria-label={`${label} hex değeri`}
          value={draft}
          onFocus={beginHistoryGroup}
          onChange={(event) => { setDraft(event.target.value); commit(event.target.value) }}
          onBlur={() => { endHistoryGroup(); if (!/^#[0-9a-f]{6}$/i.test(draft)) setDraft(value ?? effectiveValue) }}
          placeholder="#000000"
          className="font-mono"
        />
      </InputGroup>
      <Button type="button" variant="link" size="xs" disabled={inherited} onClick={() => onChange(field, undefined)} className="self-start px-0">
        {inherited ? 'Ortak tema kullanılıyor' : 'Ortak temaya dön'}
      </Button>
    </ShadcnField>
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
  return <ShadcnField className="gap-1.5">
    {directControl ? <FieldLabel htmlFor={labelledControlId} className="text-xs leading-4">{label}</FieldLabel> : <FieldTitle className="text-xs leading-4">{label}</FieldTitle>}
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

function RangeField({ label, unit, value, min, max, step = 1, onChange }: {
  label: string
  unit?: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return <ShadcnField className="gap-2">
    <div className="flex min-w-0 items-center justify-between gap-3">
      <FieldTitle className="text-xs leading-4">{label}</FieldTitle>
      <output aria-live="polite" className="min-w-10 rounded-md border bg-muted/40 px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold text-muted-foreground">
        {value}{unit ?? ''}
      </output>
    </div>
    <RangeControl label={label} value={value} min={min} max={max} step={step} onChange={onChange} />
  </ShadcnField>
}

function RangeControl({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <Slider aria-label={label} value={value} min={min} max={max} step={step} onValueChange={(next) => onChange(Number(Array.isArray(next) ? next[0] ?? value : next))} />
}

const inputStyle: CSSProperties = { width: '100%', minWidth: 0 }
