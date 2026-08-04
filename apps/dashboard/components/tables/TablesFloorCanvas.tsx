'use client'

import { useCallback, useMemo, useRef } from 'react'
import { InlineSpinner } from '@garsonless/ui/spinners'
import { AppIcons } from '@garsonless/ui/icons'
import { UNASSIGNED_LOCATION_FILTER } from './tables-operation-model'
import { TablesFloorCard } from './TablesFloorCard'
import { LegacyTableLayoutImportBanner } from './LegacyTableLayoutImportBanner'
import type { TablesFloorCanvasProps } from './tables-operations-ui-types'
import { useTableFloorActions } from './use-table-floor-actions'
import { useTableFloorLayout } from './use-table-floor-layout'
import { buildTableLayoutOverviewDraft } from './table-floor-layout-model'

export function TablesFloorCanvas({
  restaurantId,
  tables,
  setTables,
  filteredTables,
  openSessions,
  pendingRequests,
  now,
  floorFilter,
  filtersActive,
  activeId,
  setActiveId,
  onOpenDetail,
  onNewOrder,
  onTransfer,
  onSettle,
  onCloseSession,
  onResolveRequest,
  onRename,
  onDelete,
  canCreateOrders,
  initialSnapshot,
  initialLayoutError,
  layoutInvalidation,
}: TablesFloorCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const layout = useTableFloorLayout({ restaurantId, tables, setTables, initialSnapshot, initialLayoutError, layoutInvalidation })
  const selectedTable = tables.find((table) => table.id === activeId)
  const selectedEntry = activeId ? layout.draft[activeId] : undefined
  const overviewDraft = useMemo(() => buildTableLayoutOverviewDraft(tables), [tables])
  const displayedDraft = floorFilter || layout.editing ? layout.draft : overviewDraft
  const floorLabel = floorFilter === UNASSIGNED_LOCATION_FILTER ? 'Atanmamış kat' : floorFilter || 'Tüm katlar · Özet'
  const editDisabledReason = initialLayoutError ?? (!floorFilter ? 'Düzeni düzenlemek için bir kat seçin.' : null)
  const floorActions = useTableFloorActions({
    tables, openSessions, pendingRequests, floorFilter, initialLayoutError, canCreateOrders,
    setActiveId, startEditing: layout.startEditing, onOpenDetail, onNewOrder, onTransfer,
    onSettle, onCloseSession, onResolveRequest, onRename, onDelete,
  })
  const { editing, patchEntry } = layout
  const { openQuickMenu } = floorActions
  const selectCard = useCallback((tableId: string) => {
    setActiveId(tableId)
    if (!editing) onOpenDetail(tableId)
  }, [editing, onOpenDetail, setActiveId])
  const moveCard = useCallback((tableId: string, xBp: number, yBp: number) => {
    patchEntry(tableId, { xBp, yBp })
  }, [patchEntry])
  const openCardMenu = useCallback((tableId: string, anchor: HTMLElement, x: number, y: number) => {
    openQuickMenu(tableId, anchor, x, y)
  }, [openQuickMenu])

  return (
    <section className="tb-floor" aria-label="Salon masa planı">
      <header className="tb-floor__toolbar">
        <div className="tb-floor__heading">
          <span className="tb-floor__eyebrow"><AppIcons.layout size={14} />Salon planı</span>
          <strong>{floorLabel}</strong>
          <span>{filteredTables.length} masa gösteriliyor</span>
        </div>
        <div className="tb-floor__legend" aria-label="Masa durumları">
          <span><i className="is-empty" />Boş</span>
          <span><i className="is-new" />Yeni</span>
          <span><i className="is-open" />Dolu</span>
          <span><i className="is-late" />Geciken</span>
        </div>
        <div className="tb-floor__actions">
          {layout.editing ? (
            <>
              <button type="button" className="tb-floor__button" disabled={layout.saving} onClick={layout.cancelEditing}>İptal</button>
              <button type="button" className="tb-floor__button tb-floor__button--primary" disabled={layout.saving || layout.collisions.size > 0} onClick={() => { void layout.save() }}>
                {layout.saving ? <><InlineSpinner size={12} color="var(--on-action)" />Kaydediliyor…</> : <><AppIcons.check size={14} />Düzeni kaydet</>}
              </button>
            </>
          ) : (
            <button type="button" className="tb-floor__button tb-floor__edit-button" disabled={Boolean(editDisabledReason)} onClick={layout.startEditing} title={editDisabledReason ?? 'Masa yerleşimini düzenle'}>
              <AppIcons.grid size={14} />Düzeni düzenle
            </button>
          )}
        </div>
      </header>

      {layout.editing && selectedTable && selectedEntry && (
        <div className="tb-floor__properties" aria-label={`${selectedTable.label} yerleşim özellikleri`}>
          <strong>{selectedTable.label}</strong>
          <label>Şekil
            <select value={selectedEntry.shape} onChange={(event) => layout.patchEntry(selectedTable.id, { shape: event.target.value === 'square' ? 'square' : 'rectangle' })}>
              <option value="rectangle">Dikdörtgen</option><option value="square">Kare</option>
            </select>
          </label>
          <label>Yön
            <select value={selectedEntry.rotation} disabled={selectedEntry.shape === 'square'} onChange={(event) => layout.patchEntry(selectedTable.id, { rotation: event.target.value === '90' ? 90 : 0 })}>
              <option value="0">Yatay</option><option value="90">Dikey</option>
            </select>
          </label>
          <label>Kapasite
            <select value={selectedEntry.seatCount} onChange={(event) => layout.patchEntry(selectedTable.id, { seatCount: Number(event.target.value) })}>
              {Array.from({ length: 20 }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1} kişi</option>)}
            </select>
          </label>
          <span className="tb-floor__edit-help">Sürükleyin veya ok tuşlarını kullanın. Shift + ok: büyük adım.</span>
        </div>
      )}

      {layout.legacyCandidate && (
        <LegacyTableLayoutImportBanner
          candidate={layout.legacyCandidate}
          importing={layout.legacyImporting}
          onImport={() => { void layout.importLegacy() }}
          onDismiss={layout.dismissLegacy}
        />
      )}

      {(layout.error || layout.notice) && (
        <div className={`tb-floor__message ${layout.error ? 'is-error' : 'is-success'}`} role={layout.error ? 'alert' : 'status'}>
          <span>{layout.error ?? layout.notice}</span>
          {layout.conflict && <span className="tb-floor__conflict-actions"><button type="button" onClick={layout.loadRemoteConflict}>Güncel düzeni yükle</button><button type="button" onClick={layout.keepLocalDraft}>Taslağımı koru</button></span>}
          {layout.notice && <button type="button" aria-label="Bildirimi kapat" onClick={layout.dismissNotice}><AppIcons.close size={14} /></button>}
        </div>
      )}

      <div className="tb-floor__viewport">
        <div ref={canvasRef} className={`tb-floor__canvas${layout.editing ? ' is-editing' : ''}`}>
          {layout.editing && <div className="tb-floor__grid" aria-hidden="true" />}
          {filteredTables.length === 0 ? (
            <div className="tb-floor__empty"><AppIcons.grid size={24} /><strong>{tables.length === 0 ? 'Henüz masa yok' : 'Bu filtrede masa bulunamadı'}</strong><span>{filtersActive ? 'Sol paneldeki filtreleri değiştirin.' : 'Sol panelden ilk masanızı ekleyin.'}</span></div>
          ) : filteredTables.map((table) => {
            const entry = displayedDraft[table.id]
            return entry ? <TablesFloorCard
              key={table.id}
              table={table}
              entry={entry}
              session={openSessions[table.id]}
              requestCount={pendingRequests[table.id]?.length ?? 0}
              now={now}
              active={activeId === table.id}
              editing={layout.editing}
              colliding={layout.collisions.has(table.id)}
              canvasRef={canvasRef}
              onSelect={selectCard}
              onMove={moveCard}
              onQuickMenu={openCardMenu}
            /> : null
          })}
        </div>
      </div>
      {floorActions.overlays}
    </section>
  )
}
