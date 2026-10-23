'use client'

import type { Ref } from 'react'
import { LockKeyhole } from 'lucide-react'
import type { Tables } from '@garsonless/db/types'
import { normalizeMenuNumericText } from '@garsonless/domain/menu'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/* The product fields shared by the new-product and edit panels, so both tabs
   look and behave the same whichever way the panel was opened. */

const labelClass = 'text-xs font-medium'

export function ProductNameField({ id, value, onChange, inputRef, error }: {
  id: string
  value: string
  onChange: (value: string) => void
  inputRef?: Ref<HTMLInputElement>
  error?: string
}) {
  return (
    <Field className="gap-1.5" data-invalid={Boolean(error) || undefined}>
      <FieldLabel htmlFor={id} className={labelClass}>
        Ürün adı <span className="text-destructive">*</span>
      </FieldLabel>
      <Input ref={inputRef} id={id} value={value} maxLength={100} aria-invalid={Boolean(error) || undefined} onChange={(event) => onChange(event.target.value)} placeholder="örn. Serpme Kahvaltı" className="h-9 text-sm" />
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}

export function ProductPriceFields({ idPrefix, price, cost, onPriceChange, onCostChange, priceError, costError, marginPercent }: {
  idPrefix: string
  price: string
  cost: string
  onPriceChange: (value: string) => void
  onCostChange: (value: string) => void
  priceError?: string
  costError?: string
  marginPercent?: number | null
}) {
  return (
    <div className="new-product-price-grid grid grid-cols-2 gap-3">
      <Field className="min-w-0 gap-1.5" data-invalid={Boolean(priceError) || undefined}>
        <FieldLabel htmlFor={`${idPrefix}-price`} className={labelClass}>
          Satış fiyatı <span className="text-destructive">*</span>
        </FieldLabel>
        <CurrencyInput id={`${idPrefix}-price`} label="Satış fiyatı" value={price} onChange={onPriceChange} invalid={Boolean(priceError)} />
        {priceError && <FieldError>{priceError}</FieldError>}
      </Field>
      <Field className="min-w-0 gap-1.5" data-invalid={Boolean(costError) || undefined}>
        <div className="flex items-baseline justify-between gap-2">
          <FieldLabel htmlFor={`${idPrefix}-cost`} className={labelClass}>Maliyet</FieldLabel>
          <FieldDescription className="text-[11px] leading-none">opsiyonel</FieldDescription>
        </div>
        <CurrencyInput id={`${idPrefix}-cost`} label="Maliyet" value={cost} onChange={onCostChange} invalid={Boolean(costError)} />
        {costError && <FieldError>{costError}</FieldError>}
      </Field>
      {marginPercent != null && (
        <FieldDescription className="col-span-2 text-[11.5px]">Kâr marjı <strong className="text-foreground tabular-nums">%{marginPercent}</strong></FieldDescription>
      )}
    </div>
  )
}

function CurrencyInput({ id, label, value, onChange, invalid }: { id: string; label: string; value: string; onChange: (value: string) => void; invalid?: boolean }) {
  return (
    <InputGroup className="new-product-currency h-9 overflow-hidden">
      <InputGroupInput
        id={id}
        aria-label={label}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(event) => onChange(normalizeMenuNumericText(event.target.value))}
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

export function ProductDescriptionField({ id, value, onChange, error }: { id: string; value: string; onChange: (value: string) => void; error?: string }) {
  return (
    <Field className="gap-1.5" data-menu-field="description" data-invalid={Boolean(error) || undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel htmlFor={id} className={labelClass}>Açıklama</FieldLabel>
        <FieldDescription className="shrink-0 text-[11px] leading-none">{value.length}/120 önerilen</FieldDescription>
      </div>
      <Textarea id={id} value={value} maxLength={500} aria-invalid={Boolean(error) || undefined} onChange={(event) => onChange(event.target.value)} rows={3} placeholder="İçerik, porsiyon ve öne çıkan özellikler" className="min-h-24 resize-y text-[13px]" />
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}

export function ProductStatusField({ isAvailable, onChange, hint }: { isAvailable: boolean; onChange: (isAvailable: boolean) => void; hint?: string }) {
  return (
    <FieldSet className="gap-2">
      <FieldLegend variant="label" className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Durum</FieldLegend>
      <ToggleGroup aria-label="Ürün durumu" value={[isAvailable ? 'published' : 'passive']} onValueChange={(values) => { if (values[0]) onChange(values[0] === 'published') }} variant="outline" size="sm" spacing={1} className="grid w-full grid-cols-2">
        <ToggleGroupItem value="published" className="aria-pressed:bg-primary aria-pressed:text-primary-foreground">Yayında</ToggleGroupItem>
        <ToggleGroupItem value="passive" className="aria-pressed:bg-primary aria-pressed:text-primary-foreground">Pasif</ToggleGroupItem>
      </ToggleGroup>
      {hint && <FieldDescription className="text-[11px]">{hint}</FieldDescription>}
    </FieldSet>
  )
}

export function ProductLoyaltyField({ id, enabled, checked, onChange }: { id: string; enabled: boolean; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Field orientation="horizontal" data-disabled={!enabled || undefined} className="new-product-toggle items-center rounded-lg border bg-card p-3 data-disabled:bg-muted/30">
      <FieldContent>
        <FieldLabel htmlFor={id} className={`text-[13px] font-medium ${enabled ? 'cursor-pointer' : 'cursor-default text-muted-foreground'}`}>Sadakat damgası kazandırır</FieldLabel>
        <FieldDescription className="text-[11px]">{enabled ? 'Satın alınan her uygun adet 1 damga kazandırır' : 'QR siparişi ve sadakat Pro ile açılır'}</FieldDescription>
      </FieldContent>
      <div className="flex shrink-0 items-center gap-2">
        {!enabled && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"><LockKeyhole className="size-3.5" strokeWidth={1.8} />Pro</span>}
        <Switch id={id} checked={enabled ? checked : false} onCheckedChange={onChange} disabled={!enabled} aria-label="Sadakat damgası kazandırır" />
      </div>
    </Field>
  )
}

export function ProductStationField({ id, restaurantId, stations, mode, onModeChange, stationId, onStationChange, categoryStationId }: {
  id: string
  restaurantId: string
  stations: Tables<'kitchen_stations'>[]
  mode: 'category' | 'custom'
  onModeChange: (mode: 'category' | 'custom') => void
  stationId: string
  onStationChange: (stationId: string) => void
  categoryStationId: string | null
}) {
  return (
    <FieldSet className="gap-3 rounded-lg border bg-muted/20 p-3">
      <FieldLegend variant="label" className="text-xs font-semibold">Mutfak istasyonu</FieldLegend>
      <ToggleGroup
        aria-label="Mutfak istasyonu kaynağı"
        value={[mode]}
        onValueChange={(values) => {
          const value = values[0]
          if (value === 'category' || value === 'custom') onModeChange(value)
        }}
        variant="outline"
        size="sm"
        spacing={1}
        className="grid w-full grid-cols-2"
      >
        <ToggleGroupItem value="category" className="min-w-0 px-2 text-[11px] aria-pressed:bg-primary aria-pressed:text-primary-foreground">Kategori varsayılanı</ToggleGroupItem>
        <ToggleGroupItem value="custom" className="min-w-0 px-2 text-[11px] aria-pressed:bg-primary aria-pressed:text-primary-foreground">Özel istasyon</ToggleGroupItem>
      </ToggleGroup>
      {mode === 'custom' ? (
        <Field className="gap-1.5">
          <FieldLabel htmlFor={id} className="text-[11px] text-muted-foreground">İstasyon</FieldLabel>
          <KitchenStationCombobox id={id} stations={stations} value={stationId} onChange={onStationChange} />
          {stations.length === 0 && (
            <FieldDescription className="text-[11px]">
              Henüz istasyon yok.{' '}
              <a href={`/dashboard/${restaurantId}/settings#kitchen-stations`} className="font-semibold text-foreground">İstasyon oluştur</a>
            </FieldDescription>
          )}
        </Field>
      ) : (
        <FieldDescription className="text-[11px] leading-relaxed">
          {categoryStationId
            ? `Kategori varsayılanı kullanılacak: ${stations.find((station) => station.id === categoryStationId)?.name ?? 'Atanmamış'}`
            : 'Kategori istasyonu yoksa sipariş mutfakta Atanmamış görünür.'}
        </FieldDescription>
      )}
    </FieldSet>
  )
}

type KitchenStationOption = { value: string; label: string }

function KitchenStationCombobox({ id, stations, value, onChange }: { id: string; stations: Tables<'kitchen_stations'>[]; value: string; onChange: (value: string) => void }) {
  const options: KitchenStationOption[] = [
    { value: '', label: 'Atanmamış' },
    ...stations.filter((station) => station.is_active).map((station) => ({ value: station.id, label: station.name })),
  ]
  const selectedOption = options.find((option) => option.value === value) ?? options[0]
  return (
    <Combobox items={options} value={selectedOption} onValueChange={(option) => { if (option) onChange(option.value) }} autoHighlight>
      <ComboboxInput id={id} aria-label="Ürün mutfak istasyonu" placeholder="İstasyon ara" className="h-8 w-full **:data-[slot=input-group-control]:text-xs" />
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
