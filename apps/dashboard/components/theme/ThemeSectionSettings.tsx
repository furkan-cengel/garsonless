'use client'

import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import { I } from '../../lib/ui'
import { removeUnusedThemeMedia, uploadThemeMedia } from '../../lib/actions/theme'
import {
  type ThemeMediaPurpose,
  validateThemeMediaMetadata,
} from '../../lib/theme-media-policy'
import { ChefSectionIcon, isChefSectionIconName } from '@garsonless/ui/themes/default'
import type { SectionSettingField } from './theme-editor-properties-model'
import {
  getSectionSettingLabel,
  getVisibleSectionSettingFields,
  isPromoSliderFields,
  resolvePromoSliderSourceMode,
  resolveSectionSettingValue,
  sectionSettingControlId,
} from './theme-section-settings-model'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from '@/components/ui/attachment'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldTitle,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type MenuCategoryRef = { id: string; name: string }
type CampaignRef = {
  id: string
  title: string
  sourceLabel: string
  badge: string
  imageUrl?: string
}
type MenuItemRef = {
  id: string
  name: string
  categoryId: string
  categoryName: string
  price?: number
  images?: unknown
  isAvailable?: boolean
}

export function SectionSettingsEditor({ fields, values, menuCategories, menuItems, campaignOptions = [], menuHref, onChange }: {
  fields: SectionSettingField[]
  values: Record<string, string>
  menuCategories: MenuCategoryRef[]
  menuItems: MenuItemRef[]
  campaignOptions?: CampaignRef[]
  menuHref?: string
  onChange: (key: string, value: string) => void
}) {
  const targetType = values.targetType || 'none'
  const promoSlider = isPromoSliderFields(fields)
  const visibleFields = getVisibleSectionSettingFields(fields, values)

  return (
    <FieldGroup data-section-settings-editor className="min-w-0 gap-2.5">
      <style>{`
        [data-section-settings-editor] .garsonless-section-option-tile:hover {
          border-color: var(--text-3) !important;
          background: var(--surface-2) !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px color-mix(in srgb, var(--text) 8%, transparent);
        }
        [data-section-settings-editor] .garsonless-section-option-tile[aria-checked="true"]:hover {
          border-color: var(--text) !important;
          background: var(--surface-3) !important;
        }
        [data-section-settings-editor] .garsonless-section-option-tile:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        [data-section-settings-editor] .garsonless-section-option-tile:active {
          transform: translateY(0) scale(.985);
        }
        [data-section-settings-editor] input[type="range"] {
          min-inline-size: 0;
          max-inline-size: 100%;
        }
      `}</style>
      {visibleFields.map((field) => {
        if (field.type === 'heading') {
          return <FieldSeparator key={field.key} className="mt-2 uppercase tracking-[.06em] text-[11.5px] font-bold">{field.label}</FieldSeparator>
        }
        const controlId = sectionSettingControlId(field.key)
        const isIconGrid = field.type === 'icon-grid'
        const resolvedValue = resolveSectionSettingValue(field, values, promoSlider)
        return (
          <Field key={field.key} orientation={isIconGrid ? 'vertical' : 'horizontal'} className="min-h-8 items-start">
            <FieldLabel htmlFor={controlId} className={isIconGrid ? undefined : 'w-[82px] shrink-0 pt-1.5'}>
              <span>{getSectionSettingLabel(field, targetType)}</span>
              {field.type === 'range' && field.key !== 'cols' ? <small className="mt-0.5 block text-[10.5px] font-semibold text-muted-foreground">{resolvedValue}{field.unit ?? ''}</small> : null}
            </FieldLabel>
            <SectionSettingControl
              field={field}
              value={resolvedValue}
              controlId={controlId}
              targetType={targetType}
              menuCategories={menuCategories}
              menuItems={menuItems}
              campaignOptions={campaignOptions}
              {...(menuHref ? { menuHref } : {})}
              onChange={(value) => onChange(field.key, value)}
            />
          </Field>
        )
      })}
    </FieldGroup>
  )
}

function SectionSettingControl({ field, value, controlId, targetType, menuCategories = [], menuItems = [], campaignOptions = [], menuHref, onChange }: {
  field: SectionSettingField
  value: string
  controlId: string
  targetType?: string
  menuCategories?: MenuCategoryRef[]
  menuItems?: MenuItemRef[]
  campaignOptions?: CampaignRef[]
  menuHref?: string
  onChange: (value: string) => void
}) {
  if (field.type === 'campaign-multi-select') {
    const selectedIds = new Set(value.split(',').map((id) => id.trim()).filter(Boolean))
    const allSelected = selectedIds.size === 0
    const activeIds = campaignOptions.map((campaign) => campaign.id)
    const activeIdSet = new Set(activeIds)
    const staleSelectionCount = Array.from(selectedIds).filter((id) => !activeIdSet.has(id)).length
    const sourceCounts = campaignOptions.reduce<Record<string, number>>((counts, campaign) => {
      counts[campaign.sourceLabel] = (counts[campaign.sourceLabel] ?? 0) + 1
      return counts
    }, {})
    const sourceSummary = Object.entries(sourceCounts)
      .map(([label, count]) => `${label} ${count}`)
      .join(' · ')
    return (
      <FieldGroup id={controlId} className="gap-1.5">
        {campaignOptions.length === 0 ? (
          <Alert><AlertDescription>Sayfa akışında süresi devam eden İndirim Rozeti, Günün Özeli veya Kombo Şerit kampanyası yok.</AlertDescription></Alert>
        ) : (
          <>
            <Button
              type="button"
              variant={allSelected ? 'secondary' : 'outline'}
              aria-pressed={allSelected}
              onClick={() => onChange('')}
              className="h-auto min-h-11 w-full justify-start gap-2 whitespace-normal p-1.5 text-left"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><I.sparkles data-icon="inline-start" /></span>
              <span className="min-w-0 flex-1">
                <strong className="block text-[11.5px] text-foreground">Tüm aktif kampanyalar ({campaignOptions.length})</strong>
                <span className="mt-0.5 block text-[10.5px] leading-snug text-muted-foreground">{sourceSummary}</span>
              </span>
              {allSelected && <I.check data-icon="inline-end" aria-hidden="true" />}
            </Button>
            <ToggleGroup
              value={allSelected ? activeIds : activeIds.filter((id) => selectedIds.has(id))}
              onValueChange={(next) => onChange(next.length === activeIds.length ? '' : next.join(','))}
              orientation="vertical"
              variant="outline"
              spacing={1}
              className="w-full"
              aria-label="Gösterilecek kampanyalar"
            >
              {campaignOptions.map((campaign) => (
                <ToggleGroupItem key={campaign.id} value={campaign.id} className="h-auto min-h-11 w-full justify-start gap-2 whitespace-normal p-1.5 text-left">
                  <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-[10px] font-extrabold text-muted-foreground">
                    {campaign.imageUrl ? <img src={campaign.imageUrl} alt="" className="size-full object-cover" /> : campaign.sourceLabel.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[11.5px] text-foreground">{campaign.title}</strong>
                    <span className="mt-0.5 block truncate text-[10.5px] text-muted-foreground">{campaign.sourceLabel} · {campaign.badge}</span>
                  </span>
                  <I.check data-icon="inline-end" aria-hidden="true" className="opacity-0 group-data-pressed/toggle:opacity-100" />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </>
        )}
        {staleSelectionCount > 0 && (
          <Alert style={{ color: 'var(--warning)' }}>
            <I.warn size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <AlertDescription>Süresi dolmuş veya kaldırılmış {staleSelectionCount} seçim artık slaytta gösterilmiyor. Yeni bir seçim yaptığınızda liste temizlenir.</AlertDescription>
          </Alert>
        )}
        <FieldDescription className="text-[10.5px] leading-snug">
          Yalnız ürünü seçili, süresi devam eden ve fiyat kuralı geçerli kampanyalar sayılır. Ürün, fiyat ve bitiş bilgisi kendi bölümünden yönetilir.
        </FieldDescription>
      </FieldGroup>
    )
  }

  if (field.type === 'product-select') {
    const productOptions = menuItems.map((item) => ({
      value: item.id,
      label: productOptionLabel(item),
      item,
    }))
    const selectedItem = menuItems.find((item) => item.id === value)
    const selectedOption = productOptions.find((option) => option.value === value) ?? null
    if (menuItems.length === 0 && menuHref) {
      return (
        <div className="py-2 text-xs text-muted-foreground">
          Henüz ürün yok —{' '}
          <Button type="button" variant="link" size="xs" onClick={() => window.open(menuHref, '_blank', 'noopener')}>
            Menü&apos;den ekle <I.arrow size={11} />
          </Button>
        </div>
      )
    }
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <Combobox
          items={productOptions}
          value={selectedOption}
          onValueChange={(next) => onChange(next?.value ?? '')}
          autoHighlight
        >
          <ComboboxInput id={controlId} placeholder="Ürün ara…" showClear={Boolean(selectedOption)} className="w-full" />
          <ComboboxContent className="min-w-(--anchor-width)">
            <ComboboxEmpty>Ürün bulunamadı.</ComboboxEmpty>
            <ComboboxList>
              {(option) => (
                <ComboboxItem key={option.value} value={option} disabled={option.item.isAvailable === false}>
                  <span className="min-w-0">
                    <span className="block truncate">{option.item.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{option.item.categoryName}{typeof option.item.price === 'number' ? ` · ${formatProductPrice(option.item.price)}` : ''}{option.item.isAvailable === false ? ' · Pasif' : ''}</span>
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        {selectedItem && (
          <Item variant="muted" size="xs">
            <ItemMedia><ProductThumbnail item={selectedItem} /></ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="text-xs">{selectedItem.name}</ItemTitle>
              <ItemDescription className={selectedItem.isAvailable === false ? 'text-destructive' : undefined}>
                {selectedItem.categoryName}{selectedItem.isAvailable === false ? ' · Pasif' : ''}
              </ItemDescription>
            </ItemContent>
            {typeof selectedItem.price === 'number' && Number.isFinite(selectedItem.price) && (
              <ItemActions className="text-[11.5px] font-bold">
                {formatProductPrice(selectedItem.price)}
              </ItemActions>
            )}
          </Item>
        )}
        {value && !selectedItem && (
          <Alert variant="destructive"><AlertDescription>Bu ürün artık menüde bulunmuyor. Yeni bir ürün seçin.</AlertDescription></Alert>
        )}
        {value && menuHref && (
          <Button type="button" variant="link" size="xs" className="self-start" onClick={() => window.open(menuHref, '_blank', 'noopener')}>
            Menüde düzenle <I.arrow size={11} />
          </Button>
        )}
      </div>
    )
  }

  if (field.type === 'category-select') {
    const items = menuCategories.map((category) => ({ value: category.id, label: category.name }))
    return (
      <Select items={items} value={value || null} onValueChange={(next) => onChange(next ?? '')}>
        <SelectTrigger id={controlId} className="w-full"><SelectValue placeholder="— Kategori seç —" /></SelectTrigger>
        <SelectContent><SelectGroup>{menuCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectGroup></SelectContent>
      </Select>
    )
  }

  if (field.type === 'icon-grid') {
    return (
      <ToggleGroup id={controlId} value={[value]} onValueChange={(values) => { const next = values[0]; if (next) onChange(next) }} spacing={2} className="grid w-full grid-cols-3" aria-label={field.label}>
        {(field.options ?? []).map((option) => {
          const active = value === option.value
          return (
            <ToggleGroupItem
              key={option.value}
              className="garsonless-section-option-tile"
              value={option.value}
              aria-label={option.label}
              style={{
                minWidth: 0,
                minHeight: 58,
                padding: '7px 4px 6px',
                border: active ? '2px solid var(--text)' : '1px solid var(--border)',
                borderRadius: 9,
                background: active ? 'var(--surface-3)' : 'var(--surface)',
                color: active ? 'var(--text)' : 'var(--text-3)',
                display: 'grid',
                placeItems: 'center',
                gap: 4,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'border-color 120ms, background 120ms, color 120ms, transform 120ms',
              }}
            >
              <SectionOptionIcon value={option.value} />
              <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9.5, lineHeight: 1.15, fontWeight: 700 }}>
                {option.label}
              </span>
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
    )
  }

  if (field.key === 'targetId' && (targetType === 'category' || targetType === 'product')) {
    const options = targetType === 'category'
      ? menuCategories.map((category) => ({ value: category.id, label: category.name, meta: 'Kategori' }))
      : menuItems.map((item) => ({ value: item.id, label: item.name, meta: item.categoryName }))
    return (
      <Select items={options} value={value || null} onValueChange={(next) => onChange(next ?? '')}>
        <SelectTrigger id={controlId} className="w-full"><SelectValue placeholder={targetType === 'category' ? 'Kategori seç' : 'Ürün seç'} /></SelectTrigger>
        <SelectContent><SelectGroup>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label} · {option.meta}</SelectItem>)}</SelectGroup></SelectContent>
      </Select>
    )
  }

  if (field.type === 'color') {
    const colorValue = /^#[0-9a-f]{6}$/i.test(value) ? value : field.placeholder || '#000000'
    return (
      <InputGroup>
        <InputGroupAddon className="p-1">
          <input aria-label={`${field.label} renk seçici`} type="color" value={colorValue} onChange={(event) => onChange(event.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" />
        </InputGroupAddon>
        <InputGroupInput id={controlId} type="text" value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} className="font-mono" />
      </InputGroup>
    )
  }

  if (field.type === 'range' && field.key === 'cols') {
    return <TileOptions controlId={controlId} value={value || '2'} options={['1', '2', '3']} onChange={onChange} render={(option) => <ColumnIcon columns={Number(option)} />} />
  }

  if (field.type === 'range') {
    const fallback = Number(field.default ?? field.min ?? 0)
    const numeric = Number(value)
    const numericValue = Number.isFinite(numeric) ? numeric : fallback
    return (
      <Slider id={controlId} min={field.min} max={field.max} step={field.step} value={numericValue} onValueChange={(next) => onChange(String(Array.isArray(next) ? next[0] ?? numericValue : next))} aria-label={field.label} />
    )
  }

  if (field.type === 'select' && field.key === 'logoShape') {
    return <TileOptions controlId={controlId} value={value || 'rounded'} options={['square', 'rounded', 'circle']} onChange={onChange} render={(option) => <ShapeIcon shape={option} />} />
  }

  if (field.type === 'select') {
    const items = (field.options ?? []).map((option) => ({ value: option.value, label: option.label }))
    return (
      <Select items={items} value={value || String(field.default ?? field.options?.[0]?.value ?? '')} onValueChange={(next) => { if (next) onChange(next) }}>
        <SelectTrigger id={controlId} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent><SelectGroup>{(field.options ?? []).map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent>
      </Select>
    )
  }

  if (field.type === 'toggle') {
    const checked = value === 'true'
    return (
      <Switch id={controlId} checked={checked} aria-label={field.label} onCheckedChange={(next) => onChange(next ? 'true' : 'false')} />
    )
  }

  if (field.type === 'textarea') {
    return <Textarea id={controlId} value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} rows={3} />
  }

  if (field.type === 'datetime') {
    return (
      <Input
        id={controlId}
        type="datetime-local"
        step={60}
        value={toLocalDateTimeValue(value)}
        onChange={(event) => {
          if (!event.target.value) {
            onChange('')
            return
          }
          const date = new Date(event.target.value)
          onChange(Number.isFinite(date.getTime()) ? date.toISOString() : '')
        }}
      />
    )
  }

  return <Input id={controlId} type={field.type === 'url' ? 'url' : 'text'} value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
}

function toLocalDateTimeValue(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function ProductThumbnail({ item }: { item: MenuItemRef }) {
  const imageUrl = Array.isArray(item.images)
    ? item.images.find((image): image is string => typeof image === 'string' && image.length > 0)
    : undefined

  return (
    <div aria-hidden style={{
      width: 38, height: 38, borderRadius: 7, overflow: 'hidden', display: 'grid', placeItems: 'center',
      color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border)',
    }}>
      {imageUrl ? (
        <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <I.image size={15} />
      )}
    </div>
  )
}

function productOptionLabel(item: MenuItemRef) {
  const price = typeof item.price === 'number' && Number.isFinite(item.price)
    ? ` · ${formatProductPrice(item.price)}`
    : ''
  return `${item.name}${price}${item.isAvailable === false ? ' · Pasif' : ''}`
}

function formatProductPrice(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)
}

function TileOptions({ controlId, value, options, onChange, render }: {
  controlId: string
  value: string
  options: string[]
  onChange: (value: string) => void
  render: (value: string) => React.ReactNode
}) {
  return (
    <ToggleGroup id={controlId} value={[value]} onValueChange={(values) => { const next = values[0]; if (next) onChange(next) }} variant="outline" spacing={2} className="grid w-full grid-flow-col">
      {options.map((option) => {
        return (
          <ToggleGroupItem key={option} value={option} className="h-11 min-w-0">{render(option)}</ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}

function ColumnIcon({ columns }: { columns: number }) {
  return <svg width="28" height="22" viewBox="0 0 28 22" fill="currentColor" aria-hidden>{Array.from({ length: columns }, (_, index) => <rect key={index} x={2 + index * (24 / columns)} y="3" width={(22 / columns)} height="16" rx="2" opacity=".85" />)}</svg>
}

function ShapeIcon({ shape }: { shape: string }) {
  const radius = shape === 'square' ? 2 : shape === 'circle' ? 18 : 8
  return <svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor" aria-hidden><rect x="4" y="4" width="20" height="20" rx={radius} opacity=".85" /></svg>
}

function SectionOptionIcon({ value }: { value: string }) {
  if (isChefSectionIconName(value)) return <ChefSectionIcon name={value} width={20} height={20} />
  if (value === 'active') return <I.clock size={20} />
  if (value === 'mixed') return <I.sparkles size={20} />
  if (value === 'manual') return <I.page size={20} />
  if (value === 'dots') return <I.more size={20} />
  if (value === 'bars') return <I.layout size={20} />
  if (value === 'cover') return <I.image size={20} />
  if (value === 'contain') return <I.layout size={20} />
  if (value === 'top') return <VerticalPositionIcon direction="up" />
  if (value === 'center') return <I.layout size={20} />
  if (value === 'bottom') return <VerticalPositionIcon direction="down" />
  if (value === 'mosaic') return <GalleryLayoutIcon mode="mosaic" />
  if (value === 'grid') return <GalleryLayoutIcon mode="grid" />
  if (value === 'strip') return <GalleryLayoutIcon mode="strip" />
  if (value === '2' || value === '3') return <ColumnIcon columns={Number(value)} />
  if (value === 'cart') return <I.cart size={20} />
  if (value === 'bag') {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
  }
  if (value === 'custom') return <I.image size={20} />
  return <I.plus size={20} />
}

function GalleryLayoutIcon({ mode }: { mode: 'mosaic' | 'grid' | 'strip' }) {
  if (mode === 'strip') {
    return <svg width="22" height="20" viewBox="0 0 22 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><rect x="1.5" y="4" width="14" height="12" rx="2"/><path d="M18 5.5h2.5v9H18"/></svg>
  }
  if (mode === 'mosaic') {
    return <svg width="22" height="20" viewBox="0 0 22 20" fill="currentColor" aria-hidden><rect x="1" y="2" width="12" height="16" rx="2"/><rect x="15" y="2" width="6" height="7" rx="1.5"/><rect x="15" y="11" width="6" height="7" rx="1.5"/></svg>
  }
  return <svg width="22" height="20" viewBox="0 0 22 20" fill="currentColor" aria-hidden><rect x="1" y="2" width="9" height="7" rx="1.5"/><rect x="12" y="2" width="9" height="7" rx="1.5"/><rect x="1" y="11" width="9" height="7" rx="1.5"/><rect x="12" y="11" width="9" height="7" rx="1.5"/></svg>
}

function VerticalPositionIcon({ direction }: { direction: 'up' | 'down' }) {
  const up = direction === 'up'
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? 'm7 10 5-5 5 5' : 'm7 14 5 5 5-5'} />
      <path d={up ? 'M12 5v14' : 'M12 19V5'} />
    </svg>
  )
}

const GALLERY_TILES: Array<{ id: string; key: string; label: string }> = [
  { id: 'tile1', key: 'tile1Image', label: '1' },
  { id: 'tile2', key: 'tile2Image', label: '2' },
  { id: 'tile3', key: 'tile3Image', label: '3' },
  { id: 'tile4', key: 'tile4Image', label: '4' },
  { id: 'tile5', key: 'tile5Image', label: '5' },
  { id: 'tile6', key: 'tile6Image', label: '6' },
]

export function SectionImageUploadPanel({ restaurantId, label, value, onChange, mode = 'image' }: {
  restaurantId: string
  label: string
  value: string
  onChange: (value: string) => void
  mode?: 'image' | 'icon'
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const purpose: ThemeMediaPurpose = mode === 'icon' ? 'section-icon' : 'section-image'
    const metadata = validateThemeMediaMetadata({ size: file.size, type: file.type, purpose })
    if (!metadata.ok) return setError(metadata.error)

    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('restaurantId', restaurantId)
      formData.append('purpose', purpose)
      formData.append('file', file)
      const result = await uploadThemeMedia(formData)
      if ('error' in result) return setError(result.error)
      const previousUrl = value
      onChange(result.url)
      if (previousUrl) {
        try {
          const cleanup = await removeUnusedThemeMedia(restaurantId, previousUrl)
          if ('error' in cleanup) setError('Yeni medya yüklendi; önceki taslak dosya daha sonra temizlenecek.')
        } catch {
          setError('Yeni medya yüklendi; önceki taslak dosya daha sonra temizlenecek.')
        }
      }
    } catch {
      setError(`${mode === 'icon' ? 'İkon' : 'Görsel'} yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.`)
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    setUploading(true)
    setError(null)
    try {
      const cleanup = await removeUnusedThemeMedia(restaurantId, value)
      onChange('')
      if ('error' in cleanup) setError('Görsel taslaktan kaldırıldı; kullanılmayan dosya daha sonra temizlenecek.')
    } catch {
      setError('Görsel kaldırılamadı. Bağlantınızı kontrol edip tekrar deneyin.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div aria-busy={uploading} className="mb-2.5">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`${label} dosyası`} onChange={handleUpload} />
      <Attachment state={error ? 'error' : uploading ? 'uploading' : value ? 'done' : 'idle'} orientation="vertical" className="w-full">
        <AttachmentMedia variant={value ? 'image' : 'icon'} className="h-28 w-full">
          {value
            ? <img src={value} alt={`${label} önizlemesi`} className={mode === 'icon' ? 'object-contain p-5' : 'object-cover'} />
            : uploading ? <Spinner /> : <I.image />}
        </AttachmentMedia>
        <AttachmentContent className="w-full">
          <AttachmentTitle>{value ? label : `Henüz ${mode === 'icon' ? 'ikon' : 'görsel'} yüklenmedi`}</AttachmentTitle>
          <AttachmentDescription>{error ?? (mode === 'icon' ? 'JPEG, PNG veya WebP · en fazla 2 MB · SVG desteklenmez' : 'JPEG, PNG veya WebP · en fazla 8 MB')}</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction type="button" variant="outline" size="xs" disabled={uploading} onClick={() => inputRef.current?.click()}>{value ? 'Değiştir' : 'Yükle'}</AttachmentAction>
          {value && <AttachmentAction type="button" variant="destructive" size="xs" disabled={uploading} onClick={handleRemove}>Kaldır</AttachmentAction>}
        </AttachmentActions>
      </Attachment>
    </div>
  )
}

const SERVICE_REQUEST_ICON_UPLOADS = [
  { iconKey: 'waiterIcon', valueKey: 'waiterIconUrl', label: 'Garson çağır' },
  { iconKey: 'cleanTableIcon', valueKey: 'cleanTableIconUrl', label: 'Masa temizliği' },
  { iconKey: 'ashtrayIcon', valueKey: 'ashtrayIconUrl', label: 'Küllük değişimi' },
  { iconKey: 'tableServiceIcon', valueKey: 'tableServiceIconUrl', label: 'Servis isteği' },
  { iconKey: 'waterIcon', valueKey: 'waterIconUrl', label: 'Su isteği' },
  { iconKey: 'billIcon', valueKey: 'billIconUrl', label: 'Hesap isteği' },
] as const

export function ServiceRequestIconUploadPanels({ restaurantId, values, onChange }: {
  restaurantId: string
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const activeUploads = SERVICE_REQUEST_ICON_UPLOADS.filter(({ iconKey }) => values[iconKey] === 'custom')

  return (
    <FieldGroup className="mb-3 gap-3">
      <Alert><AlertDescription>Her isteğin ikon seçicisinden <strong>Özel ikon</strong> seçebilirsiniz. İlgili JPEG, PNG veya WebP yükleme alanı burada açılır. Güvenlik nedeniyle SVG kabul edilmez. <strong>İkonsuz</strong> seçeneği ise simgeyi kaldırır; buton hizasını korur.</AlertDescription></Alert>
      {activeUploads.map(({ valueKey, label }) => (
        <Field key={valueKey}>
          <FieldTitle className="text-[11.5px] font-bold">{label} özel ikonu</FieldTitle>
          <SectionImageUploadPanel
            restaurantId={restaurantId}
            label={`${label} özel ikonu`}
            value={values[valueKey] ?? ''}
            onChange={(value) => onChange(valueKey, value)}
            mode="icon"
          />
        </Field>
      ))}
    </FieldGroup>
  )
}

export function ChefPickIconUploadPanels({ restaurantId, values, onChange }: {
  restaurantId: string
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const customChefIcon = values.chefIcon === 'custom'
  const customButtonIcon = values.ctaMode === 'custom' && values.buttonIcon === 'custom'
  if (!customChefIcon && !customButtonIcon) return null

  return (
    <FieldGroup className="mb-3 gap-3">
      {customChefIcon && (
        <Field>
          <FieldTitle className="text-[11.5px] font-bold">Özel şef rozeti</FieldTitle>
          <SectionImageUploadPanel
            restaurantId={restaurantId}
            label="Özel şef rozeti"
            value={values.chefIconUrl ?? ''}
            onChange={(value) => onChange('chefIconUrl', value)}
          />
        </Field>
      )}
      {customButtonIcon && (
        <Field>
          <FieldTitle className="text-[11.5px] font-bold">Özel sepete ekle ikonu</FieldTitle>
          <SectionImageUploadPanel
            restaurantId={restaurantId}
            label="Özel sepete ekle ikonu"
            value={values.buttonIconUrl ?? ''}
            onChange={(value) => onChange('buttonIconUrl', value)}
          />
        </Field>
      )}
    </FieldGroup>
  )
}

export function PromoSliderImageUploadPanel({ restaurantId, values, onChange }: {
  restaurantId: string
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const sourceMode = resolvePromoSliderSourceMode(values)
  const comboEnabled = values.comboEnabled !== 'false'
  if (sourceMode === 'active' || !comboEnabled) return null

  return (
    <Field className="mb-3">
      <FieldTitle className="text-[11.5px] font-bold">Combo kartı görseli</FieldTitle>
      <SectionImageUploadPanel
        restaurantId={restaurantId}
        label="Combo kartı"
        value={values.comboImageUrl ?? ''}
        onChange={(value) => onChange('comboImageUrl', value)}
      />
      <FieldDescription className="-mt-0.5 text-[10.5px] leading-snug">
        Görsel eklemezsen kartta emoji kullanılır. Yerleşim ve odak ayarlarını aşağıdan değiştirebilirsin.
      </FieldDescription>
    </Field>
  )
}

export function GalleryUploadPanel({ restaurantId, values, onChange }: {
  restaurantId: string
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const requestedOrder = (values.tileOrder ?? '').split(',').map((id) => id.trim()).filter(Boolean)
  const orderedIds = Array.from(new Set([
    ...requestedOrder.filter((id) => GALLERY_TILES.some((tile) => tile.id === id)),
    ...GALLERY_TILES.map((tile) => tile.id),
  ]))
  const orderedTiles = orderedIds
    .map((id) => GALLERY_TILES.find((tile) => tile.id === id))
    .filter((tile): tile is typeof GALLERY_TILES[number] => Boolean(tile))
  const photoCount = GALLERY_TILES.filter((tile) => Boolean(values[tile.key]?.trim())).length

  async function handleUpload(tileKey: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const metadata = validateThemeMediaMetadata({
      size: file.size,
      type: file.type,
      purpose: 'gallery-image',
    })
    if (!metadata.ok) return setError(metadata.error)
    setUploading(tileKey)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('restaurantId', restaurantId)
      formData.append('purpose', 'gallery-image')
      formData.append('file', file)
      const result = await uploadThemeMedia(formData)
      if ('error' in result) return setError(result.error)
      const previousUrl = values[tileKey] ?? ''
      onChange(tileKey, result.url)
      if (previousUrl) {
        try {
          const cleanup = await removeUnusedThemeMedia(restaurantId, previousUrl)
          if ('error' in cleanup) setError('Yeni görsel yüklendi; önceki taslak dosya daha sonra temizlenecek.')
        } catch {
          setError('Yeni görsel yüklendi; önceki taslak dosya daha sonra temizlenecek.')
        }
      }
    } catch {
      setError('Görsel yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.')
    } finally {
      setUploading(null)
    }
  }

  async function removeTile(tileKey: string, imageUrl: string) {
    setUploading(tileKey)
    setError(null)
    try {
      const cleanup = await removeUnusedThemeMedia(restaurantId, imageUrl)
      onChange(tileKey, '')
      if ('error' in cleanup) setError('Görsel taslaktan kaldırıldı; kullanılmayan dosya daha sonra temizlenecek.')
    } catch {
      setError('Görsel kaldırılamadı. Bağlantınızı kontrol edip tekrar deneyin.')
    } finally {
      setUploading(null)
    }
  }

  function moveTile(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= orderedTiles.length) return
    const next = orderedTiles.map((tile) => tile.id)
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange('tileOrder', next.join(','))
  }

  return (
    <div data-gallery-upload-panel aria-busy={uploading !== null} className="mb-2">
      <Field orientation="horizontal" className="mb-2 items-center">
        <FieldContent>
          <FieldTitle className="text-xs">Galeri fotoğrafları</FieldTitle>
          <FieldDescription className="text-[10.5px]">{photoCount} / 6 fotoğraf yüklendi</FieldDescription>
        </FieldContent>
        <Badge variant={photoCount > 0 ? 'positive' : 'secondary'}>
          {photoCount > 0 ? 'Menüde görünür' : 'Galeri boş'}
        </Badge>
      </Field>
      <div className="mb-2 grid grid-cols-2 gap-2">
        {orderedTiles.map((tile, index) => {
          const imageUrl = values[tile.key] ?? ''
          const loading = uploading === tile.key
          return (
            <Attachment key={tile.key} state={loading ? 'uploading' : imageUrl ? 'done' : 'idle'} orientation="vertical" className="min-h-[104px] w-full flex-nowrap overflow-hidden p-0">
              <input ref={(element) => { fileRefs.current[tile.key] = element }} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Galeri karesi ${tile.label} dosyası`} onChange={(event) => handleUpload(tile.key, event)} />
              <AttachmentMedia variant={imageUrl ? 'image' : 'icon'} className="h-[104px] w-full rounded-none p-0">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="size-full min-h-[104px] bg-muted" style={{ objectFit: values.imageFit === 'contain' ? 'contain' : 'cover', objectPosition: values.imagePosition || 'center' }} />
                ) : (
                  <span className="grid justify-items-center gap-1.5 text-muted-foreground">
                    {loading ? <Spinner /> : <I.image />}
                    <span role={loading ? 'status' : undefined} aria-live={loading ? 'polite' : undefined} className="text-[10.5px] font-bold">{loading ? 'Fotoğraf yükleniyor…' : 'Fotoğraf yükle'}</span>
                  </span>
                )}
              </AttachmentMedia>
              <AttachmentTrigger aria-label={`Galeri karesi ${tile.label} ${imageUrl ? 'görselini değiştir' : 'görseli yükle'}`} disabled={loading} onClick={() => fileRefs.current[tile.key]?.click()} />
              <Badge aria-hidden className="absolute top-1.5 left-1.5 z-20 min-w-6 justify-center" variant={imageUrl ? 'default' : 'secondary'}>{index + 1}</Badge>
              <AttachmentActions className="top-auto right-1.5 bottom-1.5">
                <ButtonGroup>
                  <AttachmentAction type="button" variant="secondary" size="icon-xs" aria-label={`Galeri karesi ${index + 1} önceye taşı`} disabled={index === 0} onClick={() => moveTile(index, -1)}><I.chevRight className="rotate-180" /></AttachmentAction>
                  <AttachmentAction type="button" variant="secondary" size="icon-xs" aria-label={`Galeri karesi ${index + 1} sonraya taşı`} disabled={index === orderedTiles.length - 1} onClick={() => moveTile(index, 1)}><I.chevRight /></AttachmentAction>
                  {imageUrl && <AttachmentAction type="button" variant="destructive" size="icon-xs" aria-label={`Galeri karesi ${tile.label} görselini kaldır`} disabled={loading} onClick={() => removeTile(tile.key, imageUrl)}><I.close /></AttachmentAction>}
                </ButtonGroup>
              </AttachmentActions>
            </Attachment>
          )
        })}
      </div>
      {error ? (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      ) : (
        <FieldDescription className="grid gap-0.5 text-[10.5px] leading-snug">
          <span>Önerilen: 1600 × 1200 px (4:3) · minimum 1200 × 900 px</span>
          <span>JPG, PNG veya WEBP · en fazla 8 MB · oklarla sıralayabilirsin</span>
        </FieldDescription>
      )}
    </div>
  )
}
