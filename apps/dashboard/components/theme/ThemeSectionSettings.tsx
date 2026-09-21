'use client'
import { MediaInput } from '../media-library/MediaInput'

import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import { I } from '../../lib/ui'
import { removeUnusedThemeMedia } from '../../lib/actions/theme'
import { uploadThemeMedia } from '../../lib/dashboard-media-upload-client'
import {
  type ThemeMediaPurpose,
  validateThemeMediaMetadata,
} from '../../lib/theme-media-policy'
import { ChefSectionIcon, isChefSectionIconName } from '@garsonless/ui/themes/default'
import type { HomeSurfacePalette } from '@garsonless/design-engine'
import type { SectionSettingField } from './theme-editor-properties-model'
import type { PublicCouponChoice } from '@garsonless/domain/coupons'
import {
  getChefPickSettingIssues,
  getComboRibbonSettingIssues,
  getSectionSettingLabel,
  getSectionSettingLayout,
  getPromoSliderSettingIssues,
  getVisibleSectionSettingFields,
  groupSectionSettingFields,
  isChefPickFields,
  isComboRibbonFields,
  isPromoSliderFields,
  resolveSectionSettingValue,
  sectionSettingControlId,
} from './theme-section-settings-model'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Attachment,
  AttachmentAction,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { DateTimePicker } from '@/components/ui/date-time-picker'
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
  FieldLegend,
  FieldSet,
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
import { buildGalleryClearPatch, GALLERY_EDITORIAL_VERSION } from './theme-section-initial-settings'

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

export function SectionSettingsEditor({ fields, values, inheritedColors, menuCategories, menuItems, campaignOptions = [], couponOptions = [], menuHref, onChange }: {
  fields: SectionSettingField[]
  values: Record<string, string>
  inheritedColors?: HomeSurfacePalette
  menuCategories: MenuCategoryRef[]
  menuItems: MenuItemRef[]
  campaignOptions?: CampaignRef[]
  couponOptions?: PublicCouponChoice[]
  menuHref?: string
  onChange: (key: string, value: string) => void
}) {
  const targetType = values.targetType || 'none'
  const promoSlider = isPromoSliderFields(fields)
  const chefPick = isChefPickFields(fields)
  const comboRibbon = isComboRibbonFields(fields)
  const visibleFields = getVisibleSectionSettingFields(fields, values)
  const fieldGroups = groupSectionSettingFields(visibleFields)
  const promoSliderIssues = promoSlider ? getPromoSliderSettingIssues(values, Date.now(), menuItems) : []
  const chefPickIssues = chefPick ? getChefPickSettingIssues(values, menuItems) : []
  const comboRibbonIssues = comboRibbon ? getComboRibbonSettingIssues(values, menuItems) : []

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
          outline: none;
          border-color: var(--text-2) !important;
          box-shadow: inset 0 0 0 1px var(--text-2);
        }
        [data-section-settings-editor] .garsonless-section-option-tile:active {
          transform: translateY(0) scale(.985);
        }
        [data-section-settings-editor] input[type="range"] {
          min-inline-size: 0;
          max-inline-size: 100%;
        }
      `}</style>
      {promoSliderIssues.length > 0 && (
        <Alert style={{ color: 'var(--warning)' }}>
          <I.warn size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <AlertDescription>{promoSliderIssues.join(' ')}</AlertDescription>
        </Alert>
      )}
      {chefPick && (values.selectionMode || 'automatic') !== 'manual' && (
        <Alert>
          <I.question size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <AlertDescription className="grid gap-2">
            <span>Otomatik mod menü sırasındaki ilk aktif ürünleri gösterir; gerçek bir şef kürasyonu değildir.</span>
            <Button type="button" variant="outline" size="xs" className="w-fit" onClick={() => onChange('selectionMode', 'manual')}>
              Manuel seçime geç
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {chefPickIssues.length > 0 && (
        <Alert style={{ color: 'var(--warning)' }}>
          <I.warn size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <AlertDescription>{chefPickIssues.join(' ')}</AlertDescription>
        </Alert>
      )}
      {comboRibbonIssues.length > 0 && (
        <Alert style={{ color: 'var(--warning)' }}>
          <I.warn size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <AlertDescription className="grid gap-1">
            <strong>Kombo henüz yayına hazır değil.</strong>
            {comboRibbonIssues.slice(0, 4).map((issue) => <span key={issue}>{issue}</span>)}
            {comboRibbonIssues.length > 4 ? <span>+{comboRibbonIssues.length - 4} sorun daha</span> : null}
          </AlertDescription>
        </Alert>
      )}
      {fieldGroups.map((group, groupIndex) => (
        <FieldSet
          key={group.id}
          data-section-setting-group={group.id}
          className={groupIndex === 0 ? 'min-w-0 gap-2.5' : 'min-w-0 gap-2.5 border-t pt-2.5'}
        >
          {group.title ? (
            <div className="grid gap-1">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <FieldLegend variant="label" className="mb-0 text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">
                  {group.title}
                </FieldLegend>
                {group.fields.some((field) => field.type === 'color') && !group.fields.some((field) => field.inheritToken) ? (
                  <Badge variant="outline" className="text-[9px]">Bölüme özel palet</Badge>
                ) : null}
              </div>
              {group.description ? (
                <FieldDescription className="text-[10.5px] leading-snug">
                  {group.description}
                </FieldDescription>
              ) : null}
            </div>
          ) : null}
          <FieldGroup className="min-w-0 gap-2.5">
            {group.fields.map((field) => (
              <SectionSettingFieldRow
                key={field.key}
                field={field}
                value={resolveSectionSettingValue(field, values, promoSlider)}
                explicitValue={Object.prototype.hasOwnProperty.call(values, field.key)}
                inheritedColor={field.inheritToken ? inheritedColors?.[field.inheritToken] : undefined}
                targetType={targetType}
                menuCategories={menuCategories}
                menuItems={menuItems}
                campaignOptions={campaignOptions}
                couponOptions={couponOptions}
                {...(menuHref ? { menuHref } : {})}
                onChange={(value) => onChange(field.key, value)}
              />
            ))}
          </FieldGroup>
        </FieldSet>
      ))}
    </FieldGroup>
  )
}

function SectionSettingFieldRow({ field, value, explicitValue, inheritedColor, targetType, menuCategories, menuItems, campaignOptions, couponOptions, menuHref, onChange }: {
  field: SectionSettingField
  value: string
  explicitValue: boolean
  inheritedColor?: string
  targetType: string
  menuCategories: MenuCategoryRef[]
  menuItems: MenuItemRef[]
  campaignOptions: CampaignRef[]
  couponOptions: PublicCouponChoice[]
  menuHref?: string
  onChange: (value: string) => void
}) {
  const controlId = sectionSettingControlId(field.key)
  const layout = getSectionSettingLayout(field)
  const label = getSectionSettingLabel(field, targetType)
  const control = (
    <SectionSettingControl
      field={field}
      value={value}
      explicitValue={explicitValue}
      inheritedColor={inheritedColor}
      controlId={controlId}
      targetType={targetType}
      menuCategories={menuCategories}
      menuItems={menuItems}
      campaignOptions={campaignOptions}
      couponOptions={couponOptions}
      {...(menuHref ? { menuHref } : {})}
      onChange={onChange}
    />
  )

  if (layout === 'range') {
    return (
      <Field className="gap-2">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <FieldLabel htmlFor={controlId} className="text-xs leading-4">{label}</FieldLabel>
          <output htmlFor={controlId} aria-live="polite" className="min-w-10 rounded-md border bg-muted/40 px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold text-muted-foreground">
            {value}{field.unit ?? ''}
          </output>
        </div>
        {control}
      </Field>
    )
  }

  if (layout === 'toggle') {
    return (
      <Field orientation="horizontal" className="min-h-9 items-center justify-between gap-3">
        <FieldLabel htmlFor={controlId} className="min-w-0 flex-1 text-xs leading-4">{label}</FieldLabel>
        {control}
      </Field>
    )
  }

  if (layout === 'stacked') {
    return (
      <Field className="min-w-0 gap-1.5">
        <FieldLabel htmlFor={controlId} className="text-xs leading-4">{label}</FieldLabel>
        {control}
      </Field>
    )
  }

  return (
    <Field className="grid min-h-9 min-w-0 grid-cols-[104px_minmax(0,1fr)] items-start gap-3">
      <FieldLabel htmlFor={controlId} className="min-w-0 pt-1.5 text-xs leading-4">{label}</FieldLabel>
      {control}
    </Field>
  )
}

function SectionSettingControl({ field, value, explicitValue = false, inheritedColor, controlId, targetType, menuCategories = [], menuItems = [], campaignOptions = [], couponOptions = [], menuHref, onChange }: {
  field: SectionSettingField
  value: string
  explicitValue?: boolean
  inheritedColor?: string
  controlId: string
  targetType?: string
  menuCategories?: MenuCategoryRef[]
  menuItems?: MenuItemRef[]
  campaignOptions?: CampaignRef[]
  couponOptions?: PublicCouponChoice[]
  menuHref?: string
  onChange: (value: string) => void
}) {
  if (field.type === 'coupon-select') {
    const selected = couponOptions.find((coupon) => coupon.id === value) ?? null
    const options = couponOptions.map((coupon) => ({ value: coupon.id, label: `${coupon.code} · ${coupon.title}`, coupon }))
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <Combobox items={options} value={options.find((option) => option.value === value) ?? null} onValueChange={(next) => onChange(next?.value ?? '')} autoHighlight>
          <ComboboxInput id={controlId} placeholder="Aktif kupon seç…" showClear={Boolean(value)} className="w-full" />
          <ComboboxContent className="min-w-(--anchor-width)">
            <ComboboxEmpty>Sadakat ayarlarında aktif kupon bulunamadı.</ComboboxEmpty>
            <ComboboxList>{(option) => <ComboboxItem key={option.value} value={option}><span className="min-w-0"><span className="block truncate font-mono text-xs font-semibold">{option.coupon.code}</span><span className="block truncate text-[10.5px] text-muted-foreground">{option.coupon.title} · {option.coupon.subtitle}</span></span></ComboboxItem>}</ComboboxList>
          </ComboboxContent>
        </Combobox>
        {selected ? <div className="rounded-lg border bg-muted/30 p-2"><strong className="block text-xs">{selected.title}</strong><span className="mt-0.5 block text-[10.5px] text-muted-foreground">{selected.subtitle}</span></div> : value ? (
          <Alert variant="destructive"><AlertDescription>Seçili kupon artık aktif değil, süresi doldu veya kullanım limiti tükendi. Seçim editörde korunur ancak kart menüde gösterilmez.</AlertDescription></Alert>
        ) : <FieldDescription className="text-[10.5px]">Kuponları Ayarlar → Sadakat → Kuponlar bölümünden yönetin.</FieldDescription>}
      </div>
    )
  }
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
                <strong className="block text-xs text-foreground">Tüm aktif kampanyalar ({campaignOptions.length})</strong>
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
                    <strong className="block truncate text-xs text-foreground">{campaign.title}</strong>
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
          Henüz ürün yok -{' '}
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
                <ComboboxItem key={option.value} value={option} disabled={option.item.isAvailable === false} className="text-xs">
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
          <Item data-selected-product-summary variant="default" size="xs" className="rounded-none border-x-0 border-b-0 border-t bg-transparent px-1 py-1.5">
            <ItemMedia><ProductThumbnail item={selectedItem} /></ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="text-[11.5px]">{selectedItem.name}</ItemTitle>
              <ItemDescription className={selectedItem.isAvailable === false ? 'text-[10.5px] text-destructive' : 'text-[10.5px]'}>
                {selectedItem.categoryName}{selectedItem.isAvailable === false ? ' · Pasif' : ''}
              </ItemDescription>
            </ItemContent>
            {((typeof selectedItem.price === 'number' && Number.isFinite(selectedItem.price)) || Boolean(menuHref)) && (
              <ItemActions className="ml-auto flex-col items-end gap-0.5">
                {typeof selectedItem.price === 'number' && Number.isFinite(selectedItem.price) ? (
                  <span className="text-[11.5px] font-bold">{formatProductPrice(selectedItem.price)}</span>
                ) : null}
                {menuHref ? (
                  <Button type="button" variant="link" size="xs" className="h-auto px-0" onClick={() => window.open(menuHref, '_blank', 'noopener')}>
                    Menüde düzenle <I.arrow size={11} />
                  </Button>
                ) : null}
              </ItemActions>
            )}
          </Item>
        )}
        {value && !selectedItem && (
          <Alert variant="destructive"><AlertDescription>Bu ürün artık menüde bulunmuyor. Yeni bir ürün seçin.</AlertDescription></Alert>
        )}
      </div>
    )
  }

  if (field.type === 'category-select') {
    const items = menuCategories.map((category) => ({ value: category.id, label: category.name }))
    return (
      <Select items={items} value={value || null} onValueChange={(next) => onChange(next ?? '')}>
        <SelectTrigger id={controlId} className="w-full"><SelectValue placeholder="- Kategori seç -" /></SelectTrigger>
        <SelectContent><SelectGroup>{menuCategories.map((category) => <SelectItem key={category.id} value={category.id} className="text-xs">{category.name}</SelectItem>)}</SelectGroup></SelectContent>
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
              <span className="max-w-full truncate text-xs font-bold leading-tight">
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
        <SelectContent><SelectGroup>{options.map((option) => <SelectItem key={option.value} value={option.value} className="text-xs">{option.label} · {option.meta}</SelectItem>)}</SelectGroup></SelectContent>
      </Select>
    )
  }

  if (field.type === 'color') {
    const fallbackColor = inheritedColor ?? field.placeholder ?? '#000000'
    const colorValue = /^#[0-9a-f]{6}$/i.test(value)
      ? value
      : /^#[0-9a-f]{6}$/i.test(fallbackColor) ? fallbackColor : '#000000'
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <InputGroup>
          <InputGroupAddon className="p-1">
            <input aria-label={`${field.label} renk seçici`} type="color" value={colorValue} onChange={(event) => onChange(event.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" />
          </InputGroupAddon>
          <InputGroupInput id={controlId} type="text" value={value} placeholder={inheritedColor ?? field.placeholder} onChange={(event) => onChange(event.target.value)} className="font-mono" />
        </InputGroup>
        {field.inheritToken ? (
          <div className="flex min-w-0 items-center justify-between gap-2">
            <FieldDescription className="text-[10px]">{explicitValue ? 'Bu bölüme özel' : inheritedColor ? 'Ana sayfa stilinden' : 'Genel temadan'}</FieldDescription>
            {explicitValue ? <Button type="button" variant="link" size="xs" onClick={() => onChange('')} className="h-auto px-0 text-[10px]">{inheritedColor ? 'Ana sayfa stiline dön' : 'Genel temaya dön'}</Button> : null}
          </div>
        ) : null}
      </div>
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
        <SelectContent><SelectGroup>{(field.options ?? []).map((option) => <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>)}</SelectGroup></SelectContent>
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
    return <Textarea id={controlId} value={value} placeholder={field.placeholder} maxLength={field.maxLength} onChange={(event) => onChange(event.target.value)} rows={3} />
  }

  if (field.type === 'datetime') {
    return (
      <DateTimePicker
        id={controlId}
        value={value}
        onChange={onChange}
      />
    )
  }

  return <Input id={controlId} type={field.type === 'url' ? 'url' : 'text'} value={value} placeholder={field.placeholder} maxLength={field.maxLength} onChange={(event) => onChange(event.target.value)} />
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
  if (/^(top|center|bottom)-(left|center|right)$/.test(value) || value === 'center') return <HeroPlacementIcon value={value} />
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
  if (value === 'editorial' || value === 'spotlight' || value === 'collage') return <MosaicPatternIcon pattern={value} />
  if (value === '2' || value === '3') return <ColumnIcon columns={Number(value)} />
  if (value === 'cart') return <I.cart size={20} />
  if (value === 'bag') {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
  }
  if (value === 'custom') return <I.image size={20} />
  return <I.plus size={20} />
}

function HeroPlacementIcon({ value }: { value: string }) {
  const normalized = value === 'center' ? 'center-center' : value
  const [vertical, horizontal] = normalized.split('-')
  const cx = horizontal === 'left' ? 6 : horizontal === 'right' ? 18 : 12
  const cy = vertical === 'top' ? 6 : vertical === 'bottom' ? 18 : 12
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden><rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" opacity=".35"/><circle cx={cx} cy={cy} r="3" fill="currentColor"/></svg>
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

function MosaicPatternIcon({ pattern }: { pattern: 'editorial' | 'spotlight' | 'collage' }) {
  if (pattern === 'spotlight') {
    return <svg width="24" height="20" viewBox="0 0 24 20" fill="currentColor" aria-hidden><rect x="1" y="1" width="22" height="10" rx="2"/><rect x="1" y="13" width="10" height="6" rx="1.5" opacity=".7"/><rect x="13" y="13" width="10" height="6" rx="1.5" opacity=".7"/></svg>
  }
  if (pattern === 'collage') {
    return <svg width="24" height="20" viewBox="0 0 24 20" fill="currentColor" aria-hidden><rect x="1" y="1" width="14" height="8" rx="2"/><rect x="17" y="1" width="6" height="8" rx="1.5" opacity=".7"/><rect x="1" y="11" width="6" height="8" rx="1.5" opacity=".7"/><rect x="9" y="11" width="14" height="8" rx="2"/></svg>
  }
  return <svg width="24" height="20" viewBox="0 0 24 20" fill="currentColor" aria-hidden><rect x="1" y="1" width="15" height="18" rx="2"/><rect x="18" y="1" width="5" height="8" rx="1.5" opacity=".7"/><rect x="18" y="11" width="5" height="8" rx="1.5" opacity=".7"/></svg>
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
    <div aria-busy={uploading} className="mb-2.5 w-full min-w-0 self-stretch" style={{ width: '100%' }}>
      <MediaInput context="theme" purpose={mode === 'icon' ? 'logo' : 'image'} restaurantId={restaurantId} onMedia={rows => { if (rows[0]) onChange(rows[0].url) }} ref={inputRef} accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`${label} dosyası`} onChange={handleUpload} />
      <Attachment
        state={error ? 'error' : uploading ? 'uploading' : value ? 'done' : 'idle'}
        orientation="vertical"
        className="self-stretch"
        style={{ width: '100%', maxWidth: 'none' }}
      >
        <AttachmentMedia variant={value ? 'image' : 'icon'} className="h-28 w-full">
          {value
            ? <img src={value} alt={`${label} önizlemesi`} className={mode === 'icon' ? 'object-contain p-5' : 'object-cover'} />
            : uploading ? <Spinner /> : <I.image />}
        </AttachmentMedia>
        <AttachmentContent className="w-full">
          <AttachmentTitle>{value ? label : `Henüz ${mode === 'icon' ? 'ikon' : 'görsel'} yüklenmedi`}</AttachmentTitle>
          <AttachmentDescription>{error ?? (mode === 'icon' ? 'JPEG, PNG veya WebP · en fazla 2 MB · SVG desteklenmez' : 'JPEG, PNG veya WebP · en fazla 8 MB')}</AttachmentDescription>
        </AttachmentContent>
        <div data-section-image-upload-actions className="flex w-full items-center justify-end gap-1.5 border-t px-2.5 py-2">
          <AttachmentAction type="button" variant="outline" size="xs" disabled={uploading} onClick={() => inputRef.current?.click()}>{value ? 'Değiştir' : 'Yükle'}</AttachmentAction>
          {value && <AttachmentAction type="button" variant="destructive" size="xs" disabled={uploading} onClick={handleRemove}>Kaldır</AttachmentAction>}
        </div>
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
  const freebieEnabled = values.freebieEnabled === 'true'
  const freebieCustomImage = freebieEnabled && values.freebieImageSource === 'custom'
  if (!freebieCustomImage) return null

  return (
    <FieldGroup className="mb-3 gap-3">
      {freebieCustomImage && <Field>
        <FieldTitle className="text-[11.5px] font-bold">Bedava ürün kartı görseli</FieldTitle>
        <SectionImageUploadPanel restaurantId={restaurantId} label="Bedava ürün kartı" value={values.freebieImageUrl ?? ''} onChange={(value) => onChange('freebieImageUrl', value)} />
        <FieldDescription className="-mt-0.5 text-[10.5px] leading-snug">JPEG, PNG veya WebP yükleyebilir; yerleşim, sığdırma ve odağı tasarım ayarlarından değiştirebilirsin.</FieldDescription>
      </Field>}
    </FieldGroup>
  )
}

export function GalleryUploadPanel({ restaurantId, values, onPatch, onRetireMedia }: {
  restaurantId: string
  values: Record<string, string>
  onPatch: (patch: Record<string, string>) => void
  onRetireMedia?: (url: string) => void
}) {
  const [uploading, setUploading] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const addInputRef = useRef<HTMLInputElement | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const requestedOrder = (values.tileOrder ?? '').split(',').map((id) => id.trim()).filter(Boolean)
  const orderedIds = Array.from(new Set([
    ...requestedOrder.filter((id) => GALLERY_TILES.some((tile) => tile.id === id)),
    ...GALLERY_TILES.map((tile) => tile.id),
  ]))
  const orderedTiles = orderedIds
    .map((id) => GALLERY_TILES.find((tile) => tile.id === id))
    .filter((tile): tile is typeof GALLERY_TILES[number] => Boolean(tile))
  const loadedTiles = orderedTiles.filter((tile) => Boolean(values[tile.key]?.trim()))
  const photoCount = loadedTiles.length
  const visibleCount = Math.min(photoCount, Math.max(1, Math.min(6, Number(values.maxItems) || 6)))
  const isModern = values.editorialVersion === GALLERY_EDITORIAL_VERSION
  const targetUrl = values.targetUrl?.trim() ?? ''
  const invalidTarget = values.targetType === 'link' && Boolean(targetUrl) && !/^https?:\/\/[^\s]+$/i.test(targetUrl)

  async function uploadFile(file: File) {
    const formData = new FormData()
    formData.append('restaurantId', restaurantId)
    formData.append('purpose', 'gallery-image')
    formData.append('file', file)
    return uploadThemeMedia(formData)
  }

  async function handleAdd(event: ChangeEvent<HTMLInputElement>) {
    const selected = [...(event.target.files ?? [])]
    event.target.value = ''
    if (selected.length === 0) return
    const emptyTiles = orderedTiles.filter((tile) => !values[tile.key]?.trim())
    const accepted = selected.slice(0, emptyTiles.length)
    const nextErrors = selected.length > emptyTiles.length ? [`En fazla 6 fotoğraf eklenebilir; ${selected.length - emptyTiles.length} dosya yüklenmedi.`] : []
    setUploading('batch')
    setErrors([])
    const patch: Record<string, string> = {}
    let destinationIndex = 0
    try {
      for (const file of accepted) {
        const metadata = validateThemeMediaMetadata({ size: file.size, type: file.type, purpose: 'gallery-image' })
        if (!metadata.ok) {
          nextErrors.push(`${file.name}: ${metadata.error}`)
          continue
        }
        try {
          const result = await uploadFile(file)
          if ('error' in result) nextErrors.push(`${file.name}: ${result.error}`)
          else {
            const tile = emptyTiles[destinationIndex]
            if (tile) patch[tile.key] = result.url
            destinationIndex += 1
          }
        } catch {
          nextErrors.push(`${file.name}: yükleme tamamlanamadı.`)
        }
      }
      if (Object.keys(patch).length > 0) onPatch(patch)
    } catch {
      nextErrors.push('Fotoğraflar yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.')
    } finally {
      setErrors(nextErrors)
      setUploading(null)
    }
  }

  async function replaceTile(tileId: string, tileKey: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const metadata = validateThemeMediaMetadata({ size: file.size, type: file.type, purpose: 'gallery-image' })
    if (!metadata.ok) return setErrors([metadata.error])
    setUploading(tileKey)
    setErrors([])
    try {
      const result = await uploadFile(file)
      if ('error' in result) return setErrors([result.error])
      const previousUrl = values[tileKey] ?? ''
      onPatch({ [tileKey]: result.url })
      if (previousUrl) onRetireMedia?.(previousUrl)
    } catch {
      setErrors([`${tileId} fotoğrafı değiştirilemedi. Bağlantınızı kontrol edip tekrar deneyin.`])
    } finally {
      setUploading(null)
    }
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= loadedTiles.length || to >= loadedTiles.length) return
    const loaded = loadedTiles.map((tile) => tile.id)
    const [moved] = loaded.splice(from, 1)
    if (!moved) return
    loaded.splice(to, 0, moved)
    const unloaded = orderedTiles.map((tile) => tile.id).filter((id) => !loaded.includes(id))
    onPatch({ tileOrder: [...loaded, ...unloaded].join(',') })
  }

  function moveTile(index: number, direction: -1 | 1) {
    const target = index + direction
    reorder(index, target)
  }

  function dropTile(event: DragEvent, targetId: string) {
    event.preventDefault()
    if (!dragId) return
    reorder(loadedTiles.findIndex((tile) => tile.id === dragId), loadedTiles.findIndex((tile) => tile.id === targetId))
    setDragId(null)
  }

  function removeTile(tile: typeof GALLERY_TILES[number]) {
    const imageUrl = values[tile.key] ?? ''
    const remaining = loadedTiles.filter((entry) => entry.id !== tile.id).map((entry) => entry.id)
    const unloaded = orderedTiles.map((entry) => entry.id).filter((id) => !remaining.includes(id) && id !== tile.id)
    onPatch({ [tile.key]: '', [`${tile.id}Label`]: '', tileOrder: [...remaining, ...unloaded, tile.id].join(',') })
    if (imageUrl) onRetireMedia?.(imageUrl)
  }

  function clearGallery() {
    const urls = loadedTiles.map((tile) => values[tile.key]).filter(Boolean)
    onPatch(buildGalleryClearPatch())
    urls.forEach((url) => onRetireMedia?.(url!))
    setClearOpen(false)
  }

  return (
    <div data-gallery-upload-panel aria-busy={uploading !== null} className="mb-3 grid gap-3">
      {!isModern && <Alert><AlertDescription className="grid gap-2"><span>Bu galeri mevcut görünümünü koruyan eski sürümü kullanıyor.</span><Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => onPatch({ editorialVersion: GALLERY_EDITORIAL_VERSION })}>Modern galeriye geçir</Button></AlertDescription></Alert>}
      <Field orientation="horizontal" className="mb-2 items-center">
        <FieldContent>
          <FieldTitle className="text-xs">Galeri fotoğrafları</FieldTitle>
          <FieldDescription className="text-[10.5px]">6 fotoğrafın {photoCount}’ü yüklendi · {visibleCount}’ü gösteriliyor</FieldDescription>
        </FieldContent>
        <Button type="button" size="sm" onClick={() => addInputRef.current?.click()} disabled={uploading !== null || photoCount >= 6}>{uploading === 'batch' ? <Spinner data-icon="inline-start" /> : <I.plus />}Fotoğraf ekle</Button>
      </Field>
      <MediaInput context="theme" restaurantId={restaurantId} onMedia={rows => { const empty = orderedTiles.filter(t => !values[t.key]); if (rows.length > empty.length) throw new Error(`En fazla ${empty.length} fotoğraf daha seçebilirsiniz.`); onPatch(Object.fromEntries(rows.map((r,i) => [empty[i]!.key,r.url]))); }} ref={addInputRef} multiple accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Galeri fotoğrafları ekle" onChange={handleAdd} />
      {photoCount === 0 && <Alert><AlertDescription>Galeri boş. Fotoğraf eklenene kadar editörde bu çağrı görünür; public sayfada bölüm güvenli biçimde gizlenir.</AlertDescription></Alert>}
      {invalidTarget && <Alert variant="destructive"><AlertDescription>Dış bağlantı http:// veya https:// ile başlayan geçerli bir adres olmalı. Geçersiz bağlantı public sayfada gösterilmez.</AlertDescription></Alert>}
      <div className="grid gap-2">
        {loadedTiles.map((tile, index) => {
          const imageUrl = values[tile.key] ?? ''
          const loading = uploading === tile.key
          return (
            <div key={tile.key} draggable={!loading} onDragStart={() => setDragId(tile.id)} onDragEnd={() => setDragId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropTile(event, tile.id)} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 rounded-xl border bg-background p-2 shadow-xs">
              <div className="relative h-[72px] overflow-hidden rounded-lg bg-muted"><img src={imageUrl} alt="" className="size-full" style={{ objectFit: values.imageFit === 'contain' ? 'contain' : 'cover', objectPosition: values.imagePosition || 'center' }} /><Badge aria-hidden className="absolute top-1 left-1 min-w-6 justify-center">{index + 1}</Badge></div>
              <div className="grid min-w-0 gap-2">
                <div className="flex items-center gap-1"><span className="mr-auto inline-flex cursor-grab items-center gap-1 text-[10.5px] font-bold text-muted-foreground"><I.drag />Sırala</span><ButtonGroup>
                  <Button type="button" variant="outline" size="icon-xs" aria-label={`${index + 1}. fotoğrafı önceye taşı`} disabled={index === 0 || loading} onClick={() => moveTile(index, -1)}><I.chevRight className="rotate-180" /></Button>
                  <Button type="button" variant="outline" size="icon-xs" aria-label={`${index + 1}. fotoğrafı sonraya taşı`} disabled={index === loadedTiles.length - 1 || loading} onClick={() => moveTile(index, 1)}><I.chevRight /></Button>
                </ButtonGroup></div>
                {values.showLabels !== 'false' && <Input aria-label={`${index + 1}. fotoğraf etiketi`} value={values[`${tile.id}Label`] ?? ''} placeholder="Fotoğraf etiketi" onChange={(event) => onPatch({ [`${tile.id}Label`]: event.target.value })} />}
                <div className="flex flex-wrap gap-1.5"><MediaInput context="theme" restaurantId={restaurantId} onMedia={rows => { if (rows[0]) onPatch({ [tile.key]: rows[0].url }) }} ref={(element) => { fileRefs.current[tile.key] = element }} accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`${index + 1}. fotoğrafı değiştir`} onChange={(event) => replaceTile(tile.id, tile.key, event)} /><Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => fileRefs.current[tile.key]?.click()}>{loading ? <Spinner data-icon="inline-start" /> : <I.image />}Değiştir</Button><Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={loading} onClick={() => removeTile(tile)}><I.close />Kaldır</Button></div>
              </div>
            </div>
          )
        })}
      </div>
      {errors.length > 0 && <Alert variant="destructive"><AlertDescription><ul className="list-disc pl-4">{errors.map((message) => <li key={message}>{message}</li>)}</ul></AlertDescription></Alert>}
      <FieldDescription className="grid gap-0.5 text-[10.5px] leading-snug"><span>Önerilen: 1600 × 1200 px (4:3) · minimum 1200 × 900 px</span><span>JPG, PNG veya WEBP · en fazla 8 MB · sürükleyerek ya da oklarla sıralayabilirsin</span></FieldDescription>
      {photoCount > 0 && <Button type="button" variant="outline" className="w-fit text-destructive" onClick={() => setClearOpen(true)}>Galeriyi temizle</Button>}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Galeriyi temizle</AlertDialogTitle><AlertDialogDescription>Tüm fotoğraflar, etiketler ve fotoğraf sırası tek işlemde temizlenecek. Başlık, açıklama ve bağlantı korunacak.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={clearGallery}>Galeriyi temizle</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  )
}
