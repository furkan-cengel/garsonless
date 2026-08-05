'use client'

import type { AnalyticsQuery } from '../../lib/analytics-filter-contract'
import { hasAnalyticsFilters } from '../../lib/analytics-filter-contract'

const selectStyle = {
  minHeight: 36,
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface)',
  color: 'var(--text)',
  padding: '0 30px 0 10px',
  fontSize: 12,
} as const

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
      <label>
        <span>Kanal</span>
        <select
          aria-label="Sipariş kanalı"
          value={query.filters.source}
          disabled={disabled || dateOnly}
          onChange={(event) => updateFilters({ source: event.target.value as AnalyticsQuery['filters']['source'] })}
          style={selectStyle}
        >
          <option value="all">Tümü</option>
          <option value="customer">Müşteri</option>
          <option value="staff">Personel</option>
        </select>
      </label>
      <label>
        <span>Ödeme</span>
        <select
          aria-label="Ödeme yöntemi"
          value={query.filters.paymentMethod}
          disabled={disabled || dateOnly}
          onChange={(event) => updateFilters({ paymentMethod: event.target.value as AnalyticsQuery['filters']['paymentMethod'] })}
          style={selectStyle}
        >
          <option value="all">Tümü</option>
          <option value="cash">Nakit</option>
          <option value="pos">Fiziksel POS</option>
          <option value="iyzico">İyzico</option>
          <option value="split">Hesap bölüşme</option>
          <option value="comp">İkram</option>
          <option value="unknown">Bilinmeyen</option>
        </select>
      </label>
      <label>
        <span>Durum</span>
        <select
          aria-label="Sipariş durumu"
          value={query.filters.status}
          disabled={disabled || dateOnly}
          onChange={(event) => updateFilters({ status: event.target.value as AnalyticsQuery['filters']['status'] })}
          style={selectStyle}
        >
          <option value="all">Tümü</option>
          <option value="pending_approval">Onay bekliyor</option>
          <option value="pending">Bekliyor</option>
          <option value="preparing">Hazırlanıyor</option>
          <option value="ready">Hazır</option>
          <option value="served">Servis edildi</option>
        </select>
      </label>
      <div className="analytics-filter-actions">
        <span className="analytics-filter-semantics">Filtreler birlikte uygulanır (AND).</span>
        {dateOnly && <span className="analytics-filter-semantics">Sadakat defterinde yalnız dönem uygulanır.</span>}
        {!dateOnly && scopeNote && <span className="analytics-filter-semantics">{scopeNote}</span>}
        <button
          type="button"
          disabled={disabled || !hasAnalyticsFilters(query)}
          onClick={() => onChange({ ...query, filters: { source: 'all', paymentMethod: 'all', status: 'all' } })}
        >
          Filtreleri temizle
        </button>
      </div>
    </section>
  )
}
