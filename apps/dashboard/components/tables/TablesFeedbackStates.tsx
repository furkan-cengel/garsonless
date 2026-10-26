'use client'

import { useRouter } from 'next/navigation'
import { AppIcons } from '@garsonless/ui/icons'

export interface TablesFilterSummary {
  query: string
  /** Active non-search filters in plain words, e.g. "Gecikiyor", "Bahçe". */
  labels: string[]
}

/* One place for what the plan and the list show instead of tables: first run, a failed load, or no matches. */
export function TablesFeedbackState({
  kind,
  compact = false,
  loadFailure,
  filters,
  onAddTable,
  onClearFilters,
  onClearQuery,
}: {
  kind: 'no-tables' | 'load-error' | 'no-results'
  compact?: boolean
  loadFailure?: { message: string; code: string | null } | null
  filters?: TablesFilterSummary
  onAddTable?: () => void
  onClearFilters?: () => void
  onClearQuery?: () => void
}) {
  const router = useRouter()
  if (kind === 'load-error') {
    return (
      <div className={`tb-feedback${compact ? ' is-compact' : ''}`} role="alert">
        <span className="tb-feedback__icon is-critical" aria-hidden="true"><AppIcons.warn size={22} /></span>
        <strong>Masalar yüklenemedi</strong>
        {!compact && <span>Sunucuya ulaşamadık. İnternet bağlantını kontrol edip tekrar dene. Siparişlerin kaybolmadı.</span>}
        <button type="button" className="tb-feedback__primary" onClick={() => router.refresh()}>Tekrar dene</button>
        {!compact && loadFailure?.code && <code>Hata kodu: {loadFailure.code}</code>}
      </div>
    )
  }
  if (kind === 'no-tables') {
    return (
      <div className={`tb-feedback${compact ? ' is-compact' : ''}`}>
        <span className="tb-feedback__icon is-dashed" aria-hidden="true"><AppIcons.chair size={22} /></span>
        <strong>{compact ? 'Henüz masa yok' : 'Salonunu kuralım'}</strong>
        <span>{compact ? 'İlk masanı aşağıdan ekleyebilirsin.' : 'Masaları ekle; her masa kendi QR koduyla gelir. Kat ve alanları sonra da tanımlayabilirsin.'}</span>
        {onAddTable && <button type="button" className="tb-feedback__primary" onClick={onAddTable}>Masaları ekle</button>}
      </div>
    )
  }
  const query = filters?.query.trim() ?? ''
  const labels = filters?.labels ?? []
  const filterText = labels.length === 1 ? `“${labels[0]}” filtresi açık.` : labels.length > 1 ? `${labels.map((label) => `“${label}”`).join(' ve ')} filtreleri açık.` : ''
  return (
    <div className={`tb-feedback${compact ? ' is-compact' : ''}`} role="status">
      <strong>{query ? `“${query}” için sonuç yok` : 'Bu filtrede masa yok'}</strong>
      {filterText && <span>{filterText} Aradığın masa başka bir durumda olabilir.</span>}
      <div className="tb-feedback__actions">
        {labels.length > 0 && onClearFilters && <button type="button" className="tb-feedback__primary" onClick={onClearFilters}>Filtreleri kaldır</button>}
        {query && onClearQuery && <button type="button" onClick={onClearQuery}>Aramayı temizle</button>}
      </div>
    </div>
  )
}
