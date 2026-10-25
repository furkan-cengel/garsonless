import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { TableStatusIcon } from './TableStatusBadge'
import {
  TABLE_ATTENTION_ORDER,
  TABLE_OPERATIONAL_COPY,
  TABLE_OPERATIONAL_SHORT_COPY,
  type TableOperationalFilter,
} from './tables-operation-model'

export function TablesNavigationFilters({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  tableCount,
  stateCounts,
  filtersActive,
  onClearFilters,
}: {
  query: string
  onQueryChange: (query: string) => void
  statusFilter: TableOperationalFilter
  onStatusFilterChange: (filter: TableOperationalFilter) => void
  tableCount: number
  stateCounts: Record<'empty' | 'new' | 'open' | 'late' | 'stale' | 'paid', number>
  filtersActive: boolean
  onClearFilters: () => void
}) {
  return (
    <div className="px-3 pt-2.5 pb-1">
      <InputGroup className="tb-tables__search border-transparent bg-muted/70">
        <InputGroupInput
          aria-label="Masa ara"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Masa ara (ad veya kod)"
          className="text-xs"
        />
        <InputGroupAddon><Search /></InputGroupAddon>
      </InputGroup>
      <div className="tb-tables__filters mt-2 grid gap-1.5">
        <div className="tb-chips" role="group" aria-label="Duruma göre filtrele">
          <button type="button" className="tb-chip" aria-pressed={statusFilter === 'all'} onClick={() => onStatusFilterChange('all')}>
            Tümü<span>{tableCount}</span>
          </button>
          {TABLE_ATTENTION_ORDER.map((state) => (
            <button
              key={state}
              type="button"
              className={`tb-chip tb-chip--${state}${stateCounts[state] === 0 ? ' is-zero' : ''}`}
              aria-pressed={statusFilter === state}
              aria-label={`${TABLE_OPERATIONAL_COPY[state]}: ${stateCounts[state]} masa`}
              onClick={() => onStatusFilterChange(statusFilter === state ? 'all' : state)}
            >
              <TableStatusIcon state={state} size={13} />{TABLE_OPERATIONAL_SHORT_COPY[state]}<span>{stateCounts[state]}</span>
            </button>
          ))}
        </div>
        {filtersActive && (
          <Button type="button" variant="link" size="xs" onClick={onClearFilters} className="justify-self-start px-0">Filtreleri temizle</Button>
        )}
      </div>
    </div>
  )
}
