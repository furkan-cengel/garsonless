'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AppIcons } from '@garsonless/ui/icons'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { resolveLayoutEditAccess } from './tables-operation-model'
import { TablesFloorToolbar } from './TablesFloorToolbar'
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
  onSelectFloor,
  areaFilter,
  onSelectArea,
  floorOptions,
  areaOptions,
  filtersActive,
  onClearFilters, onAddTable,
  activeId,
  setActiveId,
  onOpenDetail,
  onNewOrder,
  onTransfer,
  onPrefetchTransfer,
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
  const { disabledReason: editDisabledReason, canEditUnassigned } = resolveLayoutEditAccess(tables, floorFilter, layout.loadError)
  const floorActions = useTableFloorActions({
    tables, openSessions, pendingRequests, floorFilter, initialLayoutError: layout.loadError, canCreateOrders,
    setActiveId, startEditing: layout.startEditing, onOpenDetail, onNewOrder, onTransfer, onPrefetchTransfer,
    onSettle, onCloseSession, onResolveRequest, onRename, onDelete,
  })
  const { editing, patchEntry } = layout
  const { openQuickMenu } = floorActions
  useEffect(() => {
    if (!activeId || editing || !window.matchMedia('(min-width: 1181px)').matches) return
    const frame = window.requestAnimationFrame(() => {
      canvasRef.current
        ?.querySelector<HTMLElement>(`[data-table-id="${CSS.escape(activeId)}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeId, editing])
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
      <TablesFloorToolbar
        restaurantId={restaurantId}
        tables={tables}
        shownCount={filteredTables.length}
        floorFilter={floorFilter}
        onSelectFloor={onSelectFloor}
        areaFilter={areaFilter}
        onSelectArea={onSelectArea}
        floorOptions={floorOptions}
        areaOptions={areaOptions}
        layout={layout}
        editDisabledReason={editDisabledReason}
        canEditUnassigned={canEditUnassigned}
        onOpenSettings={() => floorActions.openProperties(activeId || tables[0]!.id)}
      />

      {layout.editing && selectedTable && selectedEntry && (
        <div className="tb-floor__properties" aria-label={`${selectedTable.label} yerleşim özellikleri`}>
          <strong>{selectedTable.label}</strong>
          <label>Şekil
            <NativeSelect size="sm" value={selectedEntry.shape} onChange={(event) => layout.patchEntry(selectedTable.id, { shape: event.target.value === 'square' ? 'square' : 'rectangle' })}>
              <NativeSelectOption value="rectangle">Dikdörtgen</NativeSelectOption><NativeSelectOption value="square">Kare</NativeSelectOption>
            </NativeSelect>
          </label>
          <label>Yön
            <NativeSelect size="sm" value={selectedEntry.rotation} disabled={selectedEntry.shape === 'square'} onChange={(event) => layout.patchEntry(selectedTable.id, { rotation: event.target.value === '90' ? 90 : 0 })}>
              <NativeSelectOption value="0">Yatay</NativeSelectOption><NativeSelectOption value="90">Dikey</NativeSelectOption>
            </NativeSelect>
          </label>
          <label>Kapasite
            <NativeSelect size="sm" value={selectedEntry.seatCount} onChange={(event) => layout.patchEntry(selectedTable.id, { seatCount: Number(event.target.value) })}>
              {Array.from({ length: 20 }, (_, index) => <NativeSelectOption value={index + 1} key={index + 1}>{index + 1} kişi</NativeSelectOption>)}
            </NativeSelect>
          </label>
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
        <Alert variant={layout.error ? 'destructive' : 'default'} className={`tb-floor__message ${layout.error ? 'is-error' : 'is-success'}`} role={layout.error ? 'alert' : 'status'}>
          <AlertDescription className="text-current">{layout.error ?? layout.notice}</AlertDescription>
          {layout.loadError && <Button type="button" variant="outline" size="sm" disabled={layout.retrying} onClick={() => void layout.retryLayout()}>{layout.retrying ? 'Yükleniyor…' : 'Yerleşimi yeniden yükle'}</Button>}
          {layout.conflict && <span className="tb-floor__conflict-actions"><Button type="button" variant="outline" size="xs" onClick={layout.loadRemoteConflict}>Güncel düzeni yükle</Button><Button type="button" variant="outline" size="xs" onClick={layout.keepLocalDraft}>Taslağımı koru</Button></span>}
          {layout.notice && <AlertAction><Button type="button" variant="ghost" size="icon-xs" aria-label="Bildirimi kapat" onClick={layout.dismissNotice}><AppIcons.close /></Button></AlertAction>}
        </Alert>
      )}

      <div className="tb-floor__viewport">
        <div ref={canvasRef} className={`tb-floor__canvas${layout.editing ? ' is-editing' : ''}`}>
          {layout.editing && <div className="tb-floor__grid" aria-hidden="true" />}
          {filteredTables.length === 0 ? (
            <Empty className="tb-floor__empty border-0">
              <EmptyHeader><EmptyMedia variant="icon"><AppIcons.grid /></EmptyMedia><EmptyTitle>{tables.length === 0 ? 'Henüz masa yok' : 'Bu filtrede masa bulunamadı'}</EmptyTitle><EmptyDescription>{filtersActive ? 'Arama veya filtreleri temizleyerek masalarınızı görüntüleyin.' : 'İlk masanızı ekleyerek salonunuzu hazırlayın.'}</EmptyDescription></EmptyHeader>
              {tables.length === 0 && <Button type="button" onClick={onAddTable}>İlk masayı ekle</Button>}
              {filtersActive && <Button type="button" variant="outline" onClick={onClearFilters}>Filtreleri temizle</Button>}
            </Empty>
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

