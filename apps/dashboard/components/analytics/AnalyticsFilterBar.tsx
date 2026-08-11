'use client'

import type { AnalyticsQuery } from '../../lib/analytics-filter-contract'
import { hasAnalyticsFilters } from '../../lib/analytics-filter-contract'
import { Button } from '../ui/button'
import { Field, FieldGroup, FieldLabel } from '../ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

const CHANNELS = [
  ['all', 'Tümü'],
  ['customer', 'Müşteri'],
  ['staff', 'Personel'],
] as const

const PAYMENT_METHODS = [
  ['all', 'Tümü'],
  ['cash', 'Nakit'],
  ['pos', 'Fiziksel POS'],
  ['iyzico', 'İyzico'],
  ['split', 'Hesap bölüşme'],
  ['comp', 'İkram'],
  ['unknown', 'Bilinmeyen'],
] as const

const STATUSES = [
  ['all', 'Tümü'],
  ['pending_approval', 'Onay bekliyor'],
  ['pending', 'Bekliyor'],
  ['preparing', 'Hazırlanıyor'],
  ['ready', 'Hazır'],
  ['served', 'Servis edildi'],
] as const

export default function AnalyticsFilterBar({
  restaurantName,
  query,
  disabled,
  dateOnly,
  scopeNote,
  onChange,
}: {
  restaurantName: string
  query: AnalyticsQuery
  disabled: boolean
  dateOnly: boolean
  scopeNote?: string
  onChange: (query: AnalyticsQuery) => void
}) {
  const updateFilters = (patch: Partial<AnalyticsQuery['filters']>) => onChange({
    ...query,
    filters: { ...query.filters, ...patch },
  })

  return (
    <section className="analytics-filter-bar" aria-label="Rapor filtreleri">
      <div className="analytics-filter-context" title={restaurantName}>
        <span>Şube</span>
        <strong>{restaurantName}</strong>
      </div>
      <FieldGroup className="analytics-filter-fields">
        <AnalyticsSelectField
          label="Kanal"
          ariaLabel="Sipariş kanalı"
          value={query.filters.source}
          disabled={disabled || dateOnly}
          options={CHANNELS}
          onChange={(value) => updateFilters({ source: value as AnalyticsQuery['filters']['source'] })}
        />
        <AnalyticsSelectField
          label="Ödeme"
          ariaLabel="Ödeme yöntemi"
          value={query.filters.paymentMethod}
          disabled={disabled || dateOnly}
          options={PAYMENT_METHODS}
          onChange={(value) => updateFilters({ paymentMethod: value as AnalyticsQuery['filters']['paymentMethod'] })}
        />
        <AnalyticsSelectField
          label="Durum"
          ariaLabel="Sipariş durumu"
          value={query.filters.status}
          disabled={disabled || dateOnly}
          options={STATUSES}
          onChange={(value) => updateFilters({ status: value as AnalyticsQuery['filters']['status'] })}
        />
      </FieldGroup>
      <div className="analytics-filter-actions">
        <span className="analytics-filter-semantics">Filtreler birlikte uygulanır (AND).</span>
        {dateOnly && <span className="analytics-filter-semantics">Sadakat defterinde yalnız dönem uygulanır.</span>}
        {!dateOnly && scopeNote && <span className="analytics-filter-semantics">{scopeNote}</span>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !hasAnalyticsFilters(query)}
          onClick={() => onChange({ ...query, filters: { source: 'all', paymentMethod: 'all', status: 'all' } })}
        >
          Filtreleri temizle
        </Button>
      </div>
    </section>
  )
}

function AnalyticsSelectField({
  label,
  ariaLabel,
  value,
  disabled,
  options,
  onChange,
}: {
  label: string
  ariaLabel: string
  value: string
  disabled: boolean
  options: ReadonlyArray<readonly [string, string]>
  onChange: (value: string) => void
}) {
  const selectedLabel = options.find(([optionValue]) => optionValue === value)?.[1] ?? value

  return (
    <Field className="min-w-0 gap-1">
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} disabled={disabled} onValueChange={(next) => { if (next) onChange(next) }}>
        <SelectTrigger className="w-full min-w-0" size="sm" aria-label={ariaLabel}>
          <SelectValue>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map(([optionValue, optionLabel]) => (
              <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}
