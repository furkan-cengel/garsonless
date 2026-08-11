'use client'

import { useCallback, useMemo, useRef } from 'react'
import { AppIcons } from '@garsonless/ui/icons'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
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
              <Button type="button" variant="outline" className="tb-floor__button" disabled={layout.saving} onClick={layout.cancelEditing}>İptal</Button>
              <Button type="button" className="tb-floor__button tb-floor__button--primary" disabled={layout.saving || layout.collisions.size > 0} onClick={() => { void layout.save() }}>
                {layout.saving ? <Spinner data-icon="inline-start" /> : <AppIcons.check data-icon="inline-start" />}Düzeni kaydet
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" className="tb-floor__button tb-floor__edit-button" disabled={Boolean(editDisabledReason)} onClick={layout.startEditing} title={editDisabledReason ?? 'Masa yerleşimini düzenle'}>
              <AppIcons.grid data-icon="inline-start" />Düzeni düzenle
            </Button>
          )}
        </div>
      </header>

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
        <Alert variant={layout.error ? 'destructive' : 'default'} className={`tb-floor__message ${layout.error ? 'is-error' : 'is-success'}`} role={layout.error ? 'alert' : 'status'}>
          <AlertDescription className="text-current">{layout.error ?? layout.notice}</AlertDescription>
          {layout.conflict && <span className="tb-floor__conflict-actions"><Button type="button" variant="outline" size="xs" onClick={layout.loadRemoteConflict}>Güncel düzeni yükle</Button><Button type="button" variant="outline" size="xs" onClick={layout.keepLocalDraft}>Taslağımı koru</Button></span>}
          {layout.notice && <AlertAction><Button type="button" variant="ghost" size="icon-xs" aria-label="Bildirimi kapat" onClick={layout.dismissNotice}><AppIcons.close /></Button></AlertAction>}
        </Alert>
      )}

      <div className="tb-floor__viewport">
        <div ref={canvasRef} className={`tb-floor__canvas${layout.editing ? ' is-editing' : ''}`}>
          {layout.editing && <div className="tb-floor__grid" aria-hidden="true" />}
          {filteredTables.length === 0 ? (
            <Empty className="tb-floor__empty border-0">
              <EmptyHeader><EmptyMedia variant="icon"><AppIcons.grid /></EmptyMedia><EmptyTitle>{tables.length === 0 ? 'Henüz masa yok' : 'Bu filtrede masa bulunamadı'}</EmptyTitle><EmptyDescription>{filtersActive ? 'Sol paneldeki filtreleri değiştirin.' : 'Sol panelden ilk masanızı ekleyin.'}</EmptyDescription></EmptyHeader>
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
