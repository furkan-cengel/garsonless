'use client'
import dynamic from 'next/dynamic'
import { TablesNavigationFilters } from './TablesNavigationFilters'
import { TablesNavigationFeedback, TablesNavigationHeader } from './TablesNavigationHeader'
import { TablesNavigationList } from './TablesNavigationList'
import { TablesResponsiveNavigation } from './TablesResponsiveNavigation'
import type { TableItem } from './tables-builder-types'
import { useTableManagement } from './use-table-management'
import { useTablesNavigationModel } from './use-tables-navigation-model'
import type { TablesNavigationProps } from './tables-operations-ui-types'
const TablesFloorCanvas = dynamic(
  () => import('./TablesFloorCanvas').then((module) => module.TablesFloorCanvas),
  { loading: () => <section className="tb-floor tb-floor--loading" role="status" aria-live="polite" aria-busy="true"><span className="sr-only">Salon planı yükleniyor</span><div className="tb-floor__loading-block" aria-hidden="true" /></section> },
)
export function TablesNavigation({
  tables, setTables,
  activeId,
  setActiveId,
  restaurantId,
  openSessions,
  onCloseSession,
  onTransfer, onPrefetchTransfer,
  onOpenDetail,
  onNewOrder,
  onSettle,
  pendingRequests,
  onResolveRequest,
  requestError,
  sessionError,
  feedbackNotice,
  onDismissFeedbackNotice,
  requestRetrying, sessionRetrying,
  onRetryPendingRequests, onRetrySessions,
  now,
  initialLayoutSnapshot, initialLayoutError, layoutInvalidation,
  canCreateOrders,
  detailPanel,
}: TablesNavigationProps) {
  const management = useTableManagement({
    restaurantId,
    tables,
    setTables,
    activeId,
    setActiveId,
  })
  const model = useTablesNavigationModel({
    tables,
    openSessions,
    query: management.query,
    setQuery: management.setQuery,
    now,
  })
  const selectTable = (tableId: string) => {
    setActiveId(tableId)
    onOpenDetail(tableId)
  }
  const filterProps = {
    query: management.query,
    onQueryChange: management.setQuery,
    statusFilter: model.statusFilter,
    onStatusFilterChange: model.setStatusFilter,
    tableCount: tables.length,
    stateCounts: model.stateCounts,
    filtersActive: model.filtersActive,
    onClearFilters: model.clearFilters,
  }
  const listProps = {
    tables,
    filteredTables: model.filteredTables,
    openSessions,
    pendingRequests,
    now: model.now,
    filtersActive: model.filtersActive,
    activeId,
    setActiveId: selectTable,
    onRename: (table: TableItem, input: { label: string; floorLabel: string; areaLabel: string }) => management.rename(table, input),
    onDelete: (table: TableItem) => management.remove(table),
    onResolveRequest,
    rowActions: {
      canCreateOrders,
      onNewOrder,
      onSettle,
      onCloseSession,
      onTransfer: (mode: 'table_move' | 'account_transfer', tableId: string) => onTransfer(mode, tableId),
      onPrefetchTransfer,
    },
    adding: management.adding,
    startAdding: management.startAdding,
    cancelAdding: management.cancelAdding,
    newLabel: management.newLabel,
    setNewLabel: management.setNewLabel,
    newFloorLabel: management.newFloorLabel,
    setNewFloorLabel: management.setNewFloorLabel,
    newAreaLabel: management.newAreaLabel,
    setNewAreaLabel: management.setNewAreaLabel,
    saving: management.saving,
    addError: management.addError,
    addTable: management.addTable,
  }
  return (
    <div className="tb-tables__operations-workspace">
      <TablesResponsiveNavigation listOpenRequest={management.listOpenRequest}
        tableCount={tables.length}
        resultCount={model.filteredTables.length}
        activeFilterCount={model.activeFilterCount}
        onOpenHistory={() => onTransfer('history')}
        header={<TablesNavigationHeader
          tableCount={tables.length}
          activeCount={model.activeCount}
          lateCount={model.stateCounts.late}
        />}
        feedback={<TablesNavigationFeedback
          requestError={requestError}
          sessionError={sessionError}
          feedbackNotice={feedbackNotice}
          requestRetrying={requestRetrying}
          sessionRetrying={sessionRetrying}
          onRetryPendingRequests={onRetryPendingRequests}
          onRetrySessions={onRetrySessions}
          onDismissFeedbackNotice={onDismissFeedbackNotice}
        />}
        renderFilters={() => <TablesNavigationFilters {...filterProps} />}
        renderList={(afterSelect) => <TablesNavigationList
          {...listProps}
          setActiveId={(tableId) => { selectTable(tableId); afterSelect?.() }}
        />}
      />
      <TablesFloorCanvas
        restaurantId={restaurantId}
        tables={tables}
        setTables={setTables}
        filteredTables={model.filteredTables}
        openSessions={openSessions}
        pendingRequests={pendingRequests}
        now={model.now}
        onAddTable={management.startAdding}
        onClearFilters={model.clearFilters}
        floorFilter={model.floorFilter}
        onSelectFloor={model.setFloorFilter}
        areaFilter={model.areaFilter}
        onSelectArea={model.setAreaFilter}
        floorOptions={model.floorOptions}
        areaOptions={model.areaOptions}
        filtersActive={model.filtersActive}
        activeId={activeId}
        setActiveId={setActiveId}
        onOpenDetail={onOpenDetail}
        onNewOrder={onNewOrder}
        onTransfer={(mode, tableId, options) => onTransfer(mode, tableId, options)} onPrefetchTransfer={onPrefetchTransfer}
        onSettle={onSettle}
        onCloseSession={onCloseSession}
        onResolveRequest={onResolveRequest}
        onRename={(table, input) => management.rename(table, input)}
        onDelete={(table) => management.remove(table)}
        canCreateOrders={canCreateOrders}
        initialSnapshot={initialLayoutSnapshot}
        initialLayoutError={initialLayoutError}
        layoutInvalidation={layoutInvalidation}
      />
      {detailPanel}
    </div>
  )
}
