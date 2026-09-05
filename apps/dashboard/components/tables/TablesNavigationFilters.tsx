import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import type { TableOperationalFilter } from './tables-operation-model'
import { UNASSIGNED_LOCATION_FILTER } from './tables-operation-model'

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
  stateCounts: Record<'empty' | 'new' | 'open' | 'late' | 'stale' | 'paid', number>
  floorOptions: LocationOptions
  areaOptions: LocationOptions
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
          placeholder="Masa ara"
          className="text-xs"
        />
        <InputGroupAddon><Search /></InputGroupAddon>
      </InputGroup>
      <div className="tb-tables__filters mt-2 grid gap-1.5">
        <NativeSelect
          aria-label="Masa durumu"
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as TableOperationalFilter)}
          className="w-full"
          size="sm"
        >
          <NativeSelectOption value="all">Tüm durumlar ({tableCount})</NativeSelectOption>
          <NativeSelectOption value="stale">Önceki günden açık ({stateCounts.stale})</NativeSelectOption>
          <NativeSelectOption value="paid">Tahsil edildi ({stateCounts.paid})</NativeSelectOption>
          <NativeSelectOption value="late">Gecikiyor ({stateCounts.late})</NativeSelectOption>
          <NativeSelectOption value="open">Açık ({stateCounts.open})</NativeSelectOption>
          <NativeSelectOption value="new">Yeni açıldı ({stateCounts.new})</NativeSelectOption>
          <NativeSelectOption value="empty">Boş ({stateCounts.empty})</NativeSelectOption>
        </NativeSelect>
        <div className="grid grid-cols-2 gap-1.5">
          <NativeSelect aria-label="Kat filtresi" value={floorFilter} onChange={(event) => onFloorFilterChange(event.target.value)} className="w-full" size="sm">
            <NativeSelectOption value="">Tüm katlar</NativeSelectOption>
            {floorOptions.values.map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}
            {floorOptions.hasUnassigned && <NativeSelectOption value={UNASSIGNED_LOCATION_FILTER}>Atanmamış</NativeSelectOption>}
          </NativeSelect>
          <NativeSelect aria-label="Alan filtresi" value={areaFilter} onChange={(event) => onAreaFilterChange(event.target.value)} className="w-full" size="sm">
            <NativeSelectOption value="">Tüm alanlar</NativeSelectOption>
            {areaOptions.values.map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}
            {areaOptions.hasUnassigned && <NativeSelectOption value={UNASSIGNED_LOCATION_FILTER}>Atanmamış</NativeSelectOption>}
          </NativeSelect>
        </div>
        {filtersActive && (
          <Button type="button" variant="link" size="xs" onClick={onClearFilters} className="justify-self-start px-0">Filtreleri temizle</Button>
        )}
      </div>
    </div>
  )
}
