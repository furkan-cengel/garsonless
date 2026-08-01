import React from 'react'
import type { TableOperationalFilter } from './tables-operation-model'
import { UNASSIGNED_LOCATION_FILTER } from './tables-operation-model'
import { TABLES_NAV_ICONS } from './tables-navigation-ui'

type LocationOptions = { values: string[]; hasUnassigned: boolean }

export function TablesNavigationFilters({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  floorFilter,
  onFloorFilterChange,
  areaFilter,
  onAreaFilterChange,
  tableCount,
  stateCounts,
  floorOptions,
  areaOptions,
  filtersActive,
  onClearFilters,
}: {
  query: string
  onQueryChange: (query: string) => void
  statusFilter: TableOperationalFilter
  onStatusFilterChange: (filter: TableOperationalFilter) => void
  floorFilter: string
  onFloorFilterChange: (filter: string) => void
  areaFilter: string
  onAreaFilterChange: (filter: string) => void
  tableCount: number
  stateCounts: Record<'empty' | 'new' | 'open' | 'late', number>
  floorOptions: LocationOptions
  areaOptions: LocationOptions
  filtersActive: boolean
  onClearFilters: () => void
}) {
  return (
    <div style={{ padding: '10px 12px 4px' }}>
      <div className="tb-tables__search" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', background: 'var(--surface-3)', borderRadius: 7, color: 'var(--text-3)' }}>
        {React.cloneElement(TABLES_NAV_ICONS.search as React.ReactElement<{ size?: number }>, { size: 13 })}
        <input
          aria-label="Masa ara"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Masa ara"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--text)' }}
        />
      </div>
      <div className="tb-tables__filters" style={{ display: 'grid', gap: 6, marginTop: 7 }}>
        <select
          aria-label="Masa durumu"
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as TableOperationalFilter)}
          style={{ width: '100%', height: 32, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', padding: '0 8px', fontSize: 11.5 }}
        >
          <option value="all">Tüm durumlar ({tableCount})</option>
          <option value="late">Gecikiyor ({stateCounts.late})</option>
          <option value="open">Açık ({stateCounts.open})</option>
          <option value="new">Yeni açıldı ({stateCounts.new})</option>
          <option value="empty">Boş ({stateCounts.empty})</option>
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <select aria-label="Kat filtresi" value={floorFilter} onChange={(event) => onFloorFilterChange(event.target.value)} style={{ width: '100%', minWidth: 0, height: 32, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', padding: '0 6px', fontSize: 11 }}>
            <option value="">Tüm katlar</option>
            {floorOptions.values.map((value) => <option key={value} value={value}>{value}</option>)}
            {floorOptions.hasUnassigned && <option value={UNASSIGNED_LOCATION_FILTER}>Atanmamış</option>}
          </select>
          <select aria-label="Alan filtresi" value={areaFilter} onChange={(event) => onAreaFilterChange(event.target.value)} style={{ width: '100%', minWidth: 0, height: 32, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', padding: '0 6px', fontSize: 11 }}>
            <option value="">Tüm alanlar</option>
            {areaOptions.values.map((value) => <option key={value} value={value}>{value}</option>)}
            {areaOptions.hasUnassigned && <option value={UNASSIGNED_LOCATION_FILTER}>Atanmamış</option>}
          </select>
        </div>
        {filtersActive && (
          <button type="button" onClick={onClearFilters} style={{ justifySelf: 'start', border: 0, background: 'transparent', color: 'var(--action)', padding: '2px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Filtreleri temizle</button>
        )}
      </div>
    </div>
  )
}
