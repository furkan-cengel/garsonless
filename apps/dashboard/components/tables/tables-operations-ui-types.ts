import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { TableLayoutSnapshot } from '@garsonless/application/tables'
import type { Tables } from '@garsonless/db/types'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import type { OpenTableSessionView, TableItem } from './tables-builder-types'
import type { TablesFilterSummary } from './TablesFeedbackStates'

export interface TablesOperationsShellProps {
  restaurantId: string
  restaurantName: string
  restaurantTimezone?: string
  initialTables: Tables<'tables'>[]
  initialDirectoryError?: string | null
  initialDirectoryErrorCode?: string | null
  initialOpenSessions: OpenSessionInfo[]
  initialSessionError?: string | null
  initialLayoutSnapshot: TableLayoutSnapshot
  initialLayoutError?: string | null
  initialNow: number
  initialTableId?: string | null
}

type TransferHandler = (
  mode: 'table_move' | 'account_transfer' | 'history',
  tableId?: string,
  options?: { selectAll?: boolean },
) => void

export interface TablesNavigationProps {
  tables: TableItem[]
  setTables: Dispatch<SetStateAction<TableItem[]>>
  activeId: string
  setActiveId: Dispatch<SetStateAction<string>>
  restaurantId: string
  openSessions: Record<string, OpenTableSessionView>
  onCloseSession: (session: OpenTableSessionView, label: string) => void
  onTransfer: TransferHandler
  onPrefetchTransfer: (tableId: string) => void
  onOpenDetail: (tableId: string) => void
  onNewOrder: (tableId: string) => void
  onSettle: (session: OpenTableSessionView, label: string) => void
  pendingRequests: Record<string, Array<{ id: string; label: string }>>
  onResolveRequest: (requestId: string) => void
  requestError: string | null
  sessionError: string | null
  feedbackNotice: string | null
  onDismissFeedbackNotice: () => void
  requestRetrying: boolean
  sessionRetrying: boolean
  onRetryPendingRequests: () => void
  onRetrySessions: () => void
  now: number
  initialLayoutSnapshot: TableLayoutSnapshot
  initialLayoutError: string | null
  layoutInvalidation: number
  canCreateOrders: boolean
  /** Draws the table detail; receives this list's table commands so the panel can rename or delete. */
  loadFailure: TablesLoadFailure | null
  renderDetailPanel?: (manage: {
    rename: (table: TableItem, input: { label: string; floorLabel: string; areaLabel: string }) => Promise<string | null>
    remove: (table: TableItem) => Promise<string | null>
  }) => ReactNode
}

interface TablesLoadFailure { message: string; code: string | null }

/** Everything the plan and the list need to explain an empty view and undo the filters behind it. */
export interface TablesFeedbackProps {
  loadFailure: TablesLoadFailure | null
  filterSummary: TablesFilterSummary
  onClearQuery: () => void
  onClearStateFilters: () => void
}

export interface TablesFloorCanvasProps {
  feedback: TablesFeedbackProps
  /** Floor tabs and the area select drive the shared navigation filter. */
  onSelectFloor: (floor: string) => void
  areaFilter: string
  onSelectArea: (area: string) => void
  floorOptions: { values: string[]; hasUnassigned: boolean }
  areaOptions: { values: string[]; hasUnassigned: boolean }
  restaurantId: string
  tables: TableItem[]
  setTables: Dispatch<SetStateAction<TableItem[]>>
  filteredTables: TableItem[]
  openSessions: Record<string, OpenTableSessionView>
  pendingRequests: Record<string, Array<{ id: string; label: string }>>
  now: number
  floorFilter: string
  filtersActive: boolean
  onAddTable: () => void
  activeId: string
  setActiveId: (tableId: string) => void
  onOpenDetail: (tableId: string) => void
  onNewOrder: (tableId: string) => void
  onTransfer: (mode: 'table_move' | 'account_transfer', tableId: string, options?: { selectAll?: boolean }) => void
  onPrefetchTransfer: (tableId: string) => void
  onSettle: (session: OpenTableSessionView, label: string) => void
  onCloseSession: (session: OpenTableSessionView, label: string) => void
  onResolveRequest: (requestId: string) => void
  onRename: (table: TableItem, input: { label: string; floorLabel: string; areaLabel: string }) => Promise<string | null>
  onDelete: (table: TableItem) => Promise<string | null>
  canCreateOrders: boolean
  initialSnapshot: TableLayoutSnapshot
  initialLayoutError: string | null
  layoutInvalidation: number
}
