'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AppIcons } from '@garsonless/ui/icons'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { TABLE_ATTENTION_ORDER, UNASSIGNED_LOCATION_FILTER, resolveLayoutEditAccess } from './tables-operation-model'
import { TableStatusBadge } from './TableStatusBadge'
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
  const floorLabel = floorFilter === UNASSIGNED_LOCATION_FILTER ? 'Atanmamış kat' : floorFilter || 'Tüm katlar · Özet'
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
      <header className="tb-floor__toolbar">
        <div className="tb-floor__heading">
          <span className="tb-floor__eyebrow"><AppIcons.layout size={14} />Salon planı</span>
          <strong>{floorLabel}</strong>
          <span>{filteredTables.length} masa gösteriliyor</span>
        </div>
        <div className="tb-floor__legend" aria-label="Masa durumları">
          {/* The cards' badges with their full names, most urgent first. */}
          {TABLE_ATTENTION_ORDER.map((state) => <TableStatusBadge key={state} state={state} full />)}
        </div>
        <div className="tb-floor__actions">
          {layout.editing ? (
            <>
              <Button type="button" variant="outline" className="tb-floor__button" disabled={layout.saving} onClick={layout.cancelEditing}>İptal</Button>
              <Button type="button" className="tb-floor__button tb-floor__button--primary" aria-busy={layout.saving} disabled={layout.saving || layout.collisions.size > 0} onClick={() => { void layout.save() }}>
                {layout.saving ? <Spinner aria-hidden="true" data-icon="inline-start" /> : <AppIcons.check data-icon="inline-start" />}{layout.saving ? 'Kaydediliyor…' : 'Düzeni kaydet'}
              </Button>
            </>
          ) : canEditUnassigned ? null : (
            <Button type="button" variant="outline" className="tb-floor__button tb-floor__edit-button" aria-disabled={Boolean(editDisabledReason)} aria-describedby={editDisabledReason ? 'table-layout-edit-disabled-reason' : undefined} onClick={() => { if (!editDisabledReason) layout.startEditing() }} title={editDisabledReason ?? 'Masa yerleşimini düzenle'}>
              <AppIcons.grid data-icon="inline-start" />Düzeni düzenle
            </Button>
          )}
          {editDisabledReason && <span id="table-layout-edit-disabled-reason" className="tb-floor__edit-disabled-copy">{editDisabledReason}</span>}
          {canEditUnassigned && !layout.editing && (
            <Button type="button" className="tb-floor__button tb-floor__button--primary" onClick={() => { onSelectFloor(UNASSIGNED_LOCATION_FILTER); layout.startEditing() }}>
              <AppIcons.grid data-icon="inline-start" />Tüm masaları düzenle
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
