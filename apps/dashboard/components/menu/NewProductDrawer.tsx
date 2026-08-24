'use client'

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
import type { Tables } from '@garsonless/db/types'
import { normalizeMenuNumericText, parseMenuNumericInput } from '@garsonless/domain/menu'
import { createItem } from '../../lib/actions/menu'
import { I } from '../../lib/ui'
import NutritionFields, { nutritionFromItem, appendNutritionToFormData, applyNutritionPatch, NutritionStatusPill, type NutritionState } from './NutritionFields'
import UnsavedChangesDialog from '../overlays/UnsavedChangesDialog'
import { isNewMenuItemDraftDirty, type NewMenuItemDraftSnapshot } from './menu-item-editor-model'

const FOCUSABLE_SELECTOR = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 3-step new-product drawer (reference design, real data):
 *   1 Temel — ad / açıklama / satış / maliyet
 *   2 İçerik & alerjen — shared NutritionFields
 *   3 Görünürlük & oluştur — yayında / sadakat damgası
 * Görsel + varyantlar are added afterwards from the product panel (no fake
 * upload-before-create). On finish → createItem → onCreated opens the panel.
 */
export default function NewProductDrawer({
  restaurantId,
  categoryId,
  categoryName,
  categoryStationId,
  kitchenStations,
  onClose,
  onCreated,
}: {
  restaurantId: string
  categoryId: string
  categoryName: string
  categoryStationId: string | null
  kitchenStations: Tables<'kitchen_stations'>[]
  onClose: () => void
  onCreated: (item: Tables<'menu_items'>) => void
}) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [isAvailable, setIsAvailable] = useState(true)
  const [earnsStamp, setEarnsStamp] = useState(false)
  const [stationMode, setStationMode] = useState<'category' | 'custom'>('category')
  const [kitchenStationId, setKitchenStationId] = useState(categoryStationId ?? '')
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
    kitchenStationId: categoryStationId ?? '',
    nutrition: initialNutrition,
  })
  const isDirty = isNewMenuItemDraftDirty(
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
  const dirtyRef = useRef(isDirty)

  onCloseRef.current = onClose
  pendingRef.current = pending
  discardConfirmOpenRef.current = discardConfirmOpen
  dirtyRef.current = isDirty

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus()
    })
    function handleKeyDown(event: KeyboardEvent) {
      if (discardConfirmOpenRef.current) return
      if (event.key === 'Escape') {
        if (pendingRef.current) return
        event.preventDefault()
        if (dirtyRef.current) setDiscardConfirmOpen(true)
        else onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) {
        event.preventDefault()
        drawerRef.current?.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
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
        const fd = new FormData()
        fd.append('restaurantId', restaurantId)
        fd.append('categoryId', categoryId)
        fd.append('name', name.trim())
        fd.append('description', description.trim())
        fd.append('price', price)
        fd.append('cost', cost)
        fd.append('kitchen_station_id', stationMode === 'category' ? '' : kitchenStationId)
        fd.append('is_available', String(isAvailable))
        fd.append('earns_stamp', String(earnsStamp))
        fd.append('modifier_groups', JSON.stringify([]))
        appendNutritionToFormData(fd, nutri)
        const res = await createItem(null, fd)
        if ('error' in res) {
          setErr(res.error)
          return
        }
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
    <div
      className="new-product-overlay"
      onClick={
        pending
          ? undefined
          : (event) => {
              if (event.target === event.currentTarget) requestClose()
            }
      }
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(17,17,19,.4)',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        className="new-product-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal={discardConfirmOpen ? undefined : 'true'}
        aria-hidden={discardConfirmOpen ? true : undefined}
        inert={discardConfirmOpen ? true : undefined}
        aria-labelledby="new-product-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 'min(480px, 100vw)',
          background: 'var(--surface)',
          boxShadow: '-20px 0 60px -10px rgba(0,0,0,.2)',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px 12px',
            borderBottom: '1px solid var(--divider)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div
                id="new-product-title"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '-.01em',
                  color: 'var(--text)',
                }}
              >
                Yeni ürün ekle
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                Adım {step}/3 · {categoryName} kategorisine
              </div>
            </div>
            <Button
              className="new-product-close"
              type="button"
              disabled={pending}
              onClick={requestClose}
              aria-label="Yeni ürün penceresini kapat"
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: 'var(--surface-2)',
                color: 'var(--text-3)',
                display: 'grid',
                placeItems: 'center',
                border: '1px solid var(--border)',
                cursor: pending ? 'not-allowed' : 'pointer',
              }}
            >
              <I.close size={15} />
            </Button>
          </div>
          <div className="new-product-steps" aria-label={`3 adımın ${step}. adımı`}>
            {['Temel bilgiler', 'Gıda bilgileri', 'Yayın ayarları'].map((label, index) => {
              const n = index + 1
              return (
                <div key={label} className="new-product-step" data-state={n === step ? 'current' : n < step ? 'complete' : 'upcoming'}>
                  <span>{n}</span>
                  {label}
                </div>
              )
            })}
          </div>
        </div>

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
                  autoFocus
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="örn. Serpme Kahvaltı"
                  className="h-9 text-sm"
                />
              </Field>
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
            </FieldGroup>
          )}

          {step === 2 && <NutritionFields s={nutri} set={setN} firstBorderless />}

          {step === 3 && (
            <div className="flex flex-col gap-3 p-5">
              <FieldSet className="gap-3">
                <FieldLegend variant="label" className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
                  Görünürlük
                </FieldLegend>
                <FieldGroup className="gap-2.5">
                  <ToggleRow
                    id="new-product-available"
                    label="Menüde yayında"
                    desc="Tüm müşteriler görebilir"
                    checked={isAvailable}
                    onCheckedChange={setIsAvailable}
                  />
                  <ToggleRow
                    id="new-product-earns-stamp"
                    label="Sadakat damgası kazandırır"
                    desc="Satın alınan her uygun adet 1 damga kazandırır"
                    checked={earnsStamp}
                    onCheckedChange={setEarnsStamp}
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

              <Alert className="py-2.5">
                <I.image className="size-4" />
                <AlertDescription className="text-[11.5px] leading-relaxed">
                  Görsel ve varyantları ürünü oluşturduktan sonra ürün panelinden ekleyebilirsin.
                </AlertDescription>
              </Alert>
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
          <Button className="new-product-action new-product-action-secondary" type="button" variant="outline" size="lg" disabled={pending} onClick={requestClose}>
            İptal
          </Button>
          <div style={{ display: 'flex', gap: 6 }}>
            {step > 1 && (
              <Button className="new-product-action new-product-action-secondary" type="button" variant="outline" size="lg" disabled={pending} onClick={() => setStep(step - 1)}>
                Geri
              </Button>
            )}
            <Button className="new-product-action new-product-action-primary" type="button" size="lg" aria-busy={pending} disabled={pending || (step === 1 && !step1Valid)} onClick={next}>
              {pending ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
              {pending ? 'Oluşturuluyor…' : step === 3 ? 'Ürünü oluştur' : 'Devam'}
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
    </div>
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
}: {
  id: string
  label: string
  desc: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Field orientation="horizontal" className="new-product-toggle items-center rounded-lg border bg-card p-3">
      <FieldContent>
        <FieldLabel htmlFor={id} className="cursor-pointer text-[13px] font-medium">
          {label}
        </FieldLabel>
        <FieldDescription className="text-[11px]">{desc}</FieldDescription>
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
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
