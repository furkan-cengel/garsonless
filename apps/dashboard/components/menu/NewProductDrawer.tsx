'use client'

import { useMenuDraft } from './MenuDraftProvider'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { useEffect, useRef, useState, useTransition } from 'react'
import { LockKeyhole } from 'lucide-react'
import type { Tables } from '@garsonless/db/types'
import { normalizeMenuNumericText, parseMenuNumericInput } from '@garsonless/domain/menu'
import { createItem } from '../../lib/actions/menu'
import { I } from '../../lib/ui'
import NutritionFields, { nutritionFromItem, appendNutritionToFormData, applyNutritionPatch, NutritionStatusPill, type NutritionState } from './NutritionFields'
import { MenuImageAttachment } from './MenuImageAttachment'
import { useMenuImageDraft } from './use-menu-image-draft'
import { MenuModifierGroupEditor } from './MenuModifierGroupEditor'
import { MenuCategoryPicker, MenuProductPanelHeader, MenuProductPanelTabs, PRODUCT_PANEL_TABS } from './MenuProductPanelChrome'
import { Tabs } from '@/components/ui/tabs'
import type { MenuModifierGroup } from '@garsonless/db/browser'
import UnsavedChangesDialog from '../overlays/UnsavedChangesDialog'
import { isNewMenuItemDraftDirty, type NewMenuItemDraftSnapshot } from './menu-item-editor-model'


/**
 * New product in the same three-tab panel as the editor, walked in order:
 *   1 Temel — ad / kategori / satış / maliyet / fotoğraf / varyantlar
 *   2 Detaylar — açıklama + shared NutritionFields
 *   3 Yayın — durum / sadakat damgası / mutfak istasyonu
 * Photo selection stays local until submission; variants and images are saved with the product.
 */
export default function NewProductDrawer({
  restaurantId,
  categoryId: initialCategoryId,
  categories,
  kitchenStations,
  loyaltyStampEnabled,
  onClose,
  onCreated,
}: {
  restaurantId: string
  categoryId: string
  categories: Tables<'menu_categories'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
  loyaltyStampEnabled: boolean
  onClose: () => void
  onCreated: (item: Tables<'menu_items'>) => void
}) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(1)
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const selectedCategory = categories.find((category) => category.id === categoryId)
  const categoryStationId = selectedCategory?.kitchen_station_id
    ?? categories.find((category) => category.id === selectedCategory?.parent_id)?.kitchen_station_id
    ?? null
  const [draftId] = useState(() => crypto.randomUUID())
  const media = useMenuImageDraft([], restaurantId, draftId)
  const [modifiers, setModifiers] = useState<MenuModifierGroup[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [isAvailable, setIsAvailable] = useState(true)
  const [earnsStamp, setEarnsStamp] = useState(false)
  const [stationMode, setStationMode] = useState<'category' | 'custom'>('category')
  const [kitchenStationId, setKitchenStationId] = useState(() => categories.find((category) => category.id === initialCategoryId)?.kitchen_station_id ?? '')
  const [initialNutrition] = useState<NutritionState>(() => nutritionFromItem(null))
  const [nutri, setNutri] = useState<NutritionState>(() => initialNutrition)
  const setN = (patch: Partial<NutritionState>) => setNutri((current) => applyNutritionPatch(current, patch))
  const [err, setErr] = useState<string | null>(null)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const onCloseRef = useRef(onClose)
  const pendingRef = useRef(pending)
  const discardConfirmOpenRef = useRef(discardConfirmOpen)
  const initialDraftRef = useRef<NewMenuItemDraftSnapshot>({
    name: '',
    description: '',
    price: '',
    cost: '',
    isAvailable: true,
    earnsStamp: false,
    stationMode: 'category',
    kitchenStationId: categories.find((category) => category.id === initialCategoryId)?.kitchen_station_id ?? '',
    nutrition: initialNutrition,
  })
  const isDirty = media.images.length > 0 || modifiers.length > 0 || isNewMenuItemDraftDirty(
    {
      name,
      description,
      price,
      cost,
      isAvailable,
      earnsStamp,
      stationMode,
      kitchenStationId,
      nutrition: nutri,
    },
    initialDraftRef.current,
  )
  useMenuDraft(isDirty, pending, () => onCloseRef.current())
  const dirtyRef = useRef(isDirty)

  onCloseRef.current = onClose
  pendingRef.current = pending
  discardConfirmOpenRef.current = discardConfirmOpen
  dirtyRef.current = isDirty

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const focusFrame = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus()
    })
    function handleKeyDown(event: KeyboardEvent) {
      if (discardConfirmOpenRef.current) return
      if (event.key === 'Escape') {
        if (pendingRef.current) return
        event.preventDefault()
        event.stopImmediatePropagation()
        if (dirtyRef.current) setDiscardConfirmOpen(true)
        else onCloseRef.current()
        return
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [])

  const parsedPrice = parseMenuNumericInput(price, {
    required: true,
    min: 0.01,
  })
  const parsedCost = parseMenuNumericInput(cost, { min: 0 })
  const step1Valid = name.trim().length > 0 && parsedPrice.ok && parsedCost.ok

  function create() {
    setErr(null)
    startTransition(async () => {
      try {
        const resolvedImages = await media.resolve()
        const fd = new FormData()
        fd.append('restaurantId', restaurantId)
        fd.append('categoryId', categoryId)
        fd.append('name', name.trim())
        fd.append('description', description.trim())
        fd.append('price', price)
        fd.append('cost', cost)
        fd.append('kitchen_station_id', stationMode === 'category' ? '' : kitchenStationId)
        fd.append('is_available', String(isAvailable))
        if (loyaltyStampEnabled) fd.append('earns_stamp', String(earnsStamp))
        fd.append('modifier_groups', JSON.stringify(modifiers))
        fd.append('images', JSON.stringify(resolvedImages))
        appendNutritionToFormData(fd, nutri)
        const res = await createItem(null, fd)
        if ('error' in res) {
          setErr(res.error)
          return
        }
        media.commit(resolvedImages)
        onCreated(res.item)
      } catch (error) {
        console.error('[menu-item-create-error]', error)
        setErr('Ürün oluşturulamadı. Bağlantıyı kontrol edip tekrar deneyin.')
      }
    })
  }

  const next = () => {
    if (step < 3) setStep(step + 1)
    else create()
  }
  const requestClose = () => {
    if (pending) return
    if (isDirty) setDiscardConfirmOpen(true)
    else onClose()
  }

  return (
    <aside className="menu-item-editor new-product-overlay" aria-labelledby="new-product-title" style={{ width: 'var(--props)', minWidth: 0, minHeight: 0, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        className="new-product-drawer"
        ref={drawerRef}
        role="region"
        aria-hidden={discardConfirmOpen ? true : undefined}
        inert={discardConfirmOpen ? true : undefined}
        aria-labelledby="new-product-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          minHeight: 0,
          flex: 1,
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
        }}
      >
        <MenuProductPanelHeader
          headingId="new-product-title"
          title={name.trim() || 'Yeni ürün'}
          subtitle={`Taslak · adım ${step}/3`}
          closeLabel="Yeni ürün panelini kapat"
          busy={pending}
          onClose={requestClose}
        />
        <Tabs value={PRODUCT_PANEL_TABS[step - 1]!.id} onValueChange={(value) => setStep(PRODUCT_PANEL_TABS.findIndex((tab) => tab.id === value) + 1)}>
          {/* Create is linear: earlier steps stay reachable, later ones open with İleri. */}
          <MenuProductPanelTabs mode="create" reachable={(tab) => PRODUCT_PANEL_TABS.findIndex((entry) => entry.id === tab) < step} />
        </Tabs>

        <div className="new-product-content" style={{ flex: 1, overflow: 'auto' }}>
          {err && (
            <Alert className="m-4 w-auto" variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}

          {step === 1 && (
            <FieldGroup className="gap-4 p-5">
              <Field className="gap-1.5">
                <FieldLabel htmlFor="new-product-name" className="text-xs font-medium">
                  Ürün adı <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  ref={nameInputRef}
                  id="new-product-name"
                  aria-label="Ürün adı"
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="örn. Serpme Kahvaltı"
                  className="h-9 text-sm"
                />
              </Field>
              <MenuCategoryPicker idPrefix="new-product" categories={categories} value={categoryId} onChange={setCategoryId} disabled={pending} />
              <div className="new-product-price-grid grid grid-cols-2 gap-3">
                <Field className="min-w-0 gap-1.5">
                  <FieldLabel htmlFor="new-product-price" className="text-xs font-medium">
                    Satış fiyatı <span className="text-destructive">*</span>
                  </FieldLabel>
                  <CurrencyInput label="Satış fiyatı" value={price} onChange={setPrice} />
                </Field>
                <Field className="min-w-0 gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <FieldLabel htmlFor="new-product-cost" className="text-xs font-medium">
                      Maliyet
                    </FieldLabel>
                    <FieldDescription className="text-[11px] leading-none">opsiyonel</FieldDescription>
                  </div>
                  <CurrencyInput label="Maliyet" value={cost} onChange={setCost} />
                </Field>
              </div>
              <Field>
                <FieldLabel>Fotoğraf</FieldLabel>
                <MenuImageAttachment title="Ürün görseli" imageUrl={media.images[0] ?? null} imageAlt={name || 'Yeni ürün'} uploading={pending} onFileSelected={(file) => {
                  try { media.select(file) } catch (error) { setErr(error instanceof Error ? error.message : 'Görsel seçilemedi.') }
                }} onAssetSelected={media.selectExisting} onRemove={media.remove} description="Fotoğraf ürün oluşturulduğunda kaydedilir." />
              </Field>
              <Field>
                <FieldLabel>Varyantlar</FieldLabel>
                <MenuModifierGroupEditor groups={modifiers} onChange={(groups) => { setModifiers(groups); setN({ reviewed: false }) }} />
              </Field>
            </FieldGroup>
          )}

          {step === 2 && (
            <>
              <FieldGroup className="gap-4 px-5 pt-5">
                <Field className="gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <FieldLabel htmlFor="new-product-description" className="text-xs font-medium">
                      Açıklama
                    </FieldLabel>
                    <FieldDescription className="shrink-0 text-[11px] leading-none">
                      {description.length}/120 önerilen
                    </FieldDescription>
                  </div>
                  <Textarea
                    id="new-product-description"
                    aria-label="Ürün açıklaması"
                    value={description}
                    maxLength={500}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="İçerik, porsiyon ve öne çıkan özellikler"
                    className="min-h-24 resize-y text-[13px]"
                  />
                </Field>
              </FieldGroup>
              <NutritionFields s={nutri} set={setN} />
            </>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-3 p-5">
              <FieldSet className="gap-3">
                <FieldLegend variant="label" className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
                  Durum
                </FieldLegend>
                <ToggleGroup aria-label="Ürün durumu" value={[isAvailable ? 'published' : 'passive']} onValueChange={(values) => { if (values[0]) setIsAvailable(values[0] === 'published') }} variant="outline" size="sm" spacing={1} className="grid w-full grid-cols-2">
                  <ToggleGroupItem value="published" className="aria-pressed:bg-primary aria-pressed:text-primary-foreground">Yayında</ToggleGroupItem>
                  <ToggleGroupItem value="passive" className="aria-pressed:bg-primary aria-pressed:text-primary-foreground">Pasif</ToggleGroupItem>
                </ToggleGroup>
                <FieldGroup className="gap-2.5">
                  <ToggleRow
                    id="new-product-earns-stamp"
                    label="Sadakat damgası kazandırır"
                    desc={loyaltyStampEnabled ? 'Satın alınan her uygun adet 1 damga kazandırır' : 'QR siparişi ve sadakat Pro ile açılır'}
                    checked={earnsStamp}
                    onCheckedChange={setEarnsStamp}
                    disabled={!loyaltyStampEnabled}
                    lockedLabel="Pro"
                  />
                </FieldGroup>
              </FieldSet>

              <FieldSet className="gap-3 rounded-lg border bg-muted/20 p-3">
                <FieldLegend variant="label" className="text-xs font-semibold">
                  Mutfak istasyonu
                </FieldLegend>
                <ToggleGroup
                  aria-label="Mutfak istasyonu kaynağı"
                  value={[stationMode]}
                  onValueChange={(values) => {
                    const value = values[0]
                    if (value === 'category' || value === 'custom') setStationMode(value)
                  }}
                  variant="outline"
                  size="sm"
                  spacing={1}
                  className="grid w-full grid-cols-2"
                >
                  <ToggleGroupItem
                    value="category"
                    className="min-w-0 px-2 text-[11px] aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                  >
                    Kategori varsayılanı
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="custom"
                    className="min-w-0 px-2 text-[11px] aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                  >
                    Özel istasyon
                  </ToggleGroupItem>
                </ToggleGroup>
                {stationMode === 'custom' ? (
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="new-product-station" className="text-[11px] text-muted-foreground">
                      İstasyon
                    </FieldLabel>
                    <KitchenStationCombobox stations={kitchenStations} value={kitchenStationId} onChange={setKitchenStationId} />
                    {kitchenStations.length === 0 && (
                      <FieldDescription className="text-[11px]">
                        Henüz istasyon yok.{' '}
                        <a href={`/dashboard/${restaurantId}/settings#kitchen-stations`} className="font-semibold text-foreground">
                          İstasyon oluştur
                        </a>
                      </FieldDescription>
                    )}
                  </Field>
                ) : (
                  <FieldDescription className="text-[11px] leading-relaxed">
                    {categoryStationId
                      ? `Kategori varsayılanı kullanılacak: ${kitchenStations.find((station) => station.id === categoryStationId)?.name ?? 'Atanmamış'}`
                      : 'Kategori istasyonu yoksa sipariş mutfakta Atanmamış görünür.'}
                  </FieldDescription>
                )}
              </FieldSet>

              <div className="mt-0.5">
                <NutritionStatusPill s={nutri} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="new-product-footer"
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--divider)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Button className="new-product-action new-product-action-secondary" type="button" variant="outline" size="lg" disabled={pending} onClick={step > 1 ? () => setStep(step - 1) : requestClose}>
            {step > 1 ? 'Geri' : 'İptal'}
          </Button>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button className="new-product-action new-product-action-primary" type="button" size="lg" aria-busy={pending} disabled={pending || (step === 1 && !step1Valid)} onClick={next}>
              {pending ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
              {pending ? 'Oluşturuluyor…' : step === 3 ? 'Ürünü oluştur' : 'İleri'}
              {step < 3 && !pending && <I.chevRight data-icon="inline-end" size={13} />}
            </Button>
          </div>
        </div>
      </div>
      {discardConfirmOpen && (
        <UnsavedChangesDialog
          description="Yeni ürün taslağındaki bilgiler henüz kaydedilmedi. Çıkarsan taslak silinecek."
          discardLabel="Taslağı sil"
          keepLabel="Düzenlemeye dön"
          onKeepEditing={() => setDiscardConfirmOpen(false)}
          onDiscard={() => onCloseRef.current()}
        />
      )}
    </aside>
  )
}

function CurrencyInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = label === 'Satış fiyatı' ? 'new-product-price' : 'new-product-cost'

  return (
    <InputGroup className="new-product-currency h-9 overflow-hidden">
      <InputGroupInput
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(normalizeMenuNumericText(e.target.value))}
        placeholder="0,00"
        inputMode="decimal"
        className="h-full px-2.5 text-sm tabular-nums"
      />
      <InputGroupAddon align="inline-start" className="h-full border-r bg-muted/50 px-2.5">
        <InputGroupText className="font-semibold">₺</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  )
}

function ToggleRow({
  id,
  label,
  desc,
  checked,
  onCheckedChange,
  disabled = false,
  lockedLabel,
}: {
  id: string
  label: string
  desc: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  lockedLabel?: string
}) {
  return (
    <Field orientation="horizontal" data-disabled={disabled || undefined} className="new-product-toggle items-center rounded-lg border bg-card p-3 data-disabled:bg-muted/30">
      <FieldContent>
        <FieldLabel htmlFor={id} className={`text-[13px] font-medium ${disabled ? 'cursor-default text-muted-foreground' : 'cursor-pointer'}`}>
          {label}
        </FieldLabel>
        <FieldDescription className="text-[11px]">{desc}</FieldDescription>
      </FieldContent>
      <div className="flex shrink-0 items-center gap-2">
        {disabled && lockedLabel && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"><LockKeyhole className="size-3.5" strokeWidth={1.8} />{lockedLabel}</span>}
        <Switch id={id} checked={disabled ? false : checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={label} />
      </div>
    </Field>
  )
}

type KitchenStationOption = {
  value: string
  label: string
}

function KitchenStationCombobox({
  stations,
  value,
  onChange,
}: {
  stations: Tables<'kitchen_stations'>[]
  value: string
  onChange: (value: string) => void
}) {
  const options: KitchenStationOption[] = [
    { value: '', label: 'Atanmamış' },
    ...stations
      .filter((station) => station.is_active)
      .map((station) => ({ value: station.id, label: station.name })),
  ]
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  return (
    <Combobox
      items={options}
      value={selectedOption}
      onValueChange={(option) => {
        if (option) onChange(option.value)
      }}
      autoHighlight
    >
      <ComboboxInput
        id="new-product-station"
        aria-label="Ürün mutfak istasyonu"
        placeholder="İstasyon ara"
        className="h-8 w-full **:data-[slot=input-group-control]:text-xs"
      />
      <ComboboxContent className="min-w-(--anchor-width)">
        <ComboboxEmpty>İstasyon bulunamadı.</ComboboxEmpty>
        <ComboboxList>
          {(option) => (
            <ComboboxItem key={option.value || 'unassigned'} value={option} className="py-1.5 text-xs">
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
