import React from 'react'
import { InlineSpinner } from '@garsonless/ui/spinners'
import type { OpenTableSessionView, TableItem } from './tables-builder-types'
import { sessionDuration, tableOperationalState } from './tables-operation-model'
import { TABLES_NAV_ICONS, TABLES_NAV_STYLES, tablesNavGhostButton, tablesNavPrimaryButton } from './tables-navigation-ui'
import { TablesNavigationTableRow } from './TablesNavigationTableRow'

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
  onTransfer,
  onCloseSession,
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
  onTransfer: (mode: 'table_move' | 'account_transfer', tableId: string) => void
  onCloseSession: (session: OpenTableSessionView, label: string) => void
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
        <div style={{ margin: '8px 4px 12px', padding: '18px 12px', border: '1px dashed var(--border-strong)', borderRadius: 9, textAlign: 'center', color: 'var(--text-3)', background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
            {tables.length === 0 ? 'Henüz masa yok' : 'Filtrelere uyan masa yok'}
          </div>
          <div style={{ fontSize: 11.5, marginTop: 4 }}>
            {tables.length === 0 ? 'İlk masanızı ekleyerek başlayın.' : 'Arama, durum veya konum filtresini değiştirin.'}
          </div>
        </div>
      )}
      {filteredTables.map((table) => {
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
              active={activeId === table.id}
              onClick={() => setActiveId(table.id)}
              onRename={(input) => onRename(table, input)}
              onDelete={() => onDelete(table)}
              deleteDisabled={Boolean(session)}
            />
            {tableRequests.map((request) => (
              <div key={request.id} style={{ margin: '0 4px 4px 28px', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,159,64,.14)', borderRadius: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#b8690f', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {TABLES_NAV_ICONS.bellSmall}{request.label}
                </span>
                <button type="button" onClick={(event) => { event.stopPropagation(); onResolveRequest(request.id) }} style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', border: '1px solid #d98324', borderRadius: 5, background: 'var(--surface)', color: '#b8690f', cursor: 'pointer', flexShrink: 0 }}>Tamamla</button>
              </div>
            ))}
            {session && (
              <div className="tb-tables__session-actions" style={{ margin: '0 4px 4px 28px', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 6, background: operationalState === 'late' ? 'var(--critical-bg)' : 'var(--positive-bg)', borderRadius: 6 }}>
                <span className="tb-tables__session-summary" style={{ fontSize: 11, fontWeight: 700, color: operationalState === 'late' ? 'var(--critical)' : 'var(--positive)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  ₺{session.total.toLocaleString('tr-TR')} · {sessionDuration(session.openedAt, now)}
                  {session.unpaidTotal > 0 && ` · ₺${session.unpaidTotal.toLocaleString('tr-TR')} açık`}
                  {session.splitDeclaredCashTotal > 0 && ` · ₺${session.splitDeclaredCashTotal.toLocaleString('tr-TR')} nakit onayı`}
                </span>
                <button className="tb-tables__session-action" type="button" aria-label={`${table.label} masasını taşı`} title="Masayı taşı" onClick={(event) => { event.stopPropagation(); onTransfer('table_move', table.id) }} style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', cursor: 'pointer', flexShrink: 0 }}>Taşı</button>
                <button className="tb-tables__session-action" type="button" aria-label={`${table.label} ürün veya hesabını taşı`} title="Ürün veya hesap taşı" onClick={(event) => { event.stopPropagation(); onTransfer('account_transfer', table.id) }} style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', cursor:'pointer', flexShrink: 0 }}>Ürün</button>
                <button className="tb-tables__session-action" type="button" onClick={(event) => { event.stopPropagation(); onCloseSession(session, table.label) }} style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', border: '1px solid var(--positive)', borderRadius: 5, background: 'var(--surface)', color: 'var(--positive)', cursor: 'pointer', flexShrink: 0 }}>Kapat</button>
              </div>
            )}
          </div>
        )
      })}

      {adding ? (
        <div style={{ margin: '8px 4px 4px', padding: 8, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface-2)' }}>
          <input
            aria-label="Yeni masa adı"
            autoFocus
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addTable()
              if (event.key === 'Escape') cancelAdding()
            }}
            placeholder="örn. Masa 11"
            style={{ width: '100%', height: 28, padding: '0 8px', marginBottom: 6, border: '1px solid var(--border-strong)', borderRadius: 6, outline: 'none', fontSize: 12.5 }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <input aria-label="Yeni masa katı" value={newFloorLabel} maxLength={40} onChange={(event) => setNewFloorLabel(event.target.value)} placeholder="Kat" style={{ width: '100%', minWidth: 0, height: 30, padding: '0 8px', border: '1px solid var(--border-strong)', borderRadius: 6, outline: 'none', fontSize: 11.5 }} />
            <input aria-label="Yeni masa alanı" value={newAreaLabel} maxLength={40} onChange={(event) => setNewAreaLabel(event.target.value)} placeholder="Alan" style={{ width: '100%', minWidth: 0, height: 30, padding: '0 8px', border: '1px solid var(--border-strong)', borderRadius: 6, outline: 'none', fontSize: 11.5 }} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={addTable} disabled={saving} style={{ ...tablesNavPrimaryButton(), height: 26, fontSize: 11.5, padding: '0 10px', flex: 1, opacity: saving ? 0.6 : 1 }}>{saving ? <><InlineSpinner size={11} color="var(--on-action)" /> Kaydediliyor…</> : 'Ekle'}</button>
            <button onClick={cancelAdding} style={{ ...tablesNavGhostButton(), height: 26, fontSize: 11.5, padding: '0 10px' }}>İptal</button>
          </div>
          {addError && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--critical)' }}>{addError}</div>}
        </div>
      ) : (
        <button onClick={startAdding} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', marginTop: 8, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-2)', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, fontWeight: 500 }}>
          {React.cloneElement(TABLES_NAV_ICONS.plus as React.ReactElement<{ size?: number }>, { size: 13 })}Masa ekle
        </button>
      )}
    </div>
  )
}
