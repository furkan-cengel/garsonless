import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { FieldError, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { OpenTableSessionView, TableItem } from './tables-builder-types'
import { sortTablesByAttention, tableOperationalState } from './tables-operation-model'
import { TABLES_NAV_ICONS, TABLES_NAV_STYLES } from './tables-navigation-ui'
import { TablesNavigationTableRow, type TableRowActions } from './TablesNavigationTableRow'

export function TablesNavigationList({
  tables,
  filteredTables,
  openSessions,
  pendingRequests,
  now,
  filtersActive,
  activeId,
  setActiveId,
  onRename,
  onDelete,
  onResolveRequest,
  rowActions,
  adding,
  startAdding,
  cancelAdding,
  newLabel,
  setNewLabel,
  newFloorLabel,
  setNewFloorLabel,
  newAreaLabel,
  setNewAreaLabel,
  saving,
  addError,
  addTable,
}: {
  tables: TableItem[]
  filteredTables: TableItem[]
  openSessions: Record<string, OpenTableSessionView>
  pendingRequests: Record<string, Array<{ id: string; label: string }>>
  now: number
  filtersActive: boolean
  activeId: string
  setActiveId: (tableId: string) => void
  onRename: (table: TableItem, input: { label: string; floorLabel: string; areaLabel: string }) => Promise<string | null>
  onDelete: (table: TableItem) => Promise<string | null>
  onResolveRequest: (requestId: string) => void
  rowActions: TableRowActions
  adding: boolean
  startAdding: () => void
  cancelAdding: () => void
  newLabel: string
  setNewLabel: (label: string) => void
  newFloorLabel: string
  setNewFloorLabel: (label: string) => void
  newAreaLabel: string
  setNewAreaLabel: (label: string) => void
  saving: boolean
  addError: string | null
  addTable: () => void
}) {
  return (
    <div className="tb-tables__nav-list" style={{ flex: 1, overflowY: 'auto', padding: '6px 8px 12px' }}>
      <div style={{ ...TABLES_NAV_STYLES.label, padding: '6px 8px 6px', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>{filtersActive ? 'Filtrelenen masalar' : 'Tüm masalar'}</span>
        <span aria-live="polite">{filteredTables.length}</span>
      </div>
      {filteredTables.length === 0 && (
        <Empty className="mx-1 my-2 min-h-28 border bg-muted/30 p-4">
          <EmptyHeader className="gap-1">
            <EmptyTitle>{tables.length === 0 ? 'Henüz masa yok' : 'Filtrelere uyan masa yok'}</EmptyTitle>
            <EmptyDescription className="text-xs">{tables.length === 0 ? 'İlk masanızı ekleyerek başlayın.' : 'Arama, durum veya konum filtresini değiştirin.'}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {sortTablesByAttention(filteredTables, openSessions, now).map((table) => {
        const session = openSessions[table.id]
        const operationalState = tableOperationalState(session, now)
        const tableRequests = pendingRequests[table.id] ?? []
        const rowTable: TableItem = session
          ? { ...table, status: 'active', orders: session.orderCount }
          : { ...table, status: 'idle', orders: 0 }
        return (
          <div key={table.id}>
            <TablesNavigationTableRow
              table={rowTable}
              operationalState={operationalState}
              session={session}
              requestCount={tableRequests.length}
              now={now}
              active={activeId === table.id}
              onClick={() => setActiveId(table.id)}
              onRename={(input) => onRename(table, input)}
              onDelete={() => onDelete(table)}
              deleteDisabled={Boolean(session)}
              actions={rowActions}
            />
            {tableRequests.map((request) => (
              <div key={request.id} className="tb-row-request">
                <span>{TABLES_NAV_ICONS.bellSmall}{request.label}</span>
                <Button type="button" variant="outline" size="xs" onClick={(event) => { event.stopPropagation(); onResolveRequest(request.id) }} className="border-[var(--warning)] text-[var(--warning)]">Tamamla</Button>
              </div>
            ))}
          </div>
        )
      })}

      {adding ? (
        <FieldGroup className="mx-1 mt-2 gap-1.5 rounded-lg border bg-muted/30 p-2">
          <Input
            aria-label="Yeni masa adı"
            autoFocus
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addTable()
              if (event.key === 'Escape') cancelAdding()
            }}
            placeholder="örn. Masa 11"
            className="h-7 text-xs"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <Input aria-label="Yeni masa katı" value={newFloorLabel} maxLength={40} onChange={(event) => setNewFloorLabel(event.target.value)} placeholder="Kat" className="h-7 min-w-0 text-xs" />
            <Input aria-label="Yeni masa alanı" value={newAreaLabel} maxLength={40} onChange={(event) => setNewAreaLabel(event.target.value)} placeholder="Alan" className="h-7 min-w-0 text-xs" />
          </div>
          <div className="flex gap-1">
            <Button type="button" size="xs" onClick={addTable} aria-busy={saving} disabled={saving} className="flex-1">{saving && <Spinner aria-hidden="true" data-icon="inline-start" />}{saving ? 'Ekleniyor…' : 'Ekle'}</Button>
            <Button type="button" variant="outline" size="xs" onClick={cancelAdding}>İptal</Button>
          </div>
          {addError && <FieldError className="text-xs">{addError}</FieldError>}
        </FieldGroup>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={startAdding} className="mt-2 w-full border-dashed"><Plus />Masa ekle</Button>
      )}
    </div>
  )
}
