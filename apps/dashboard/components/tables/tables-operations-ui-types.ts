import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { TableLayoutSnapshot } from '@garsonless/application/tables'
import type { Tables } from '@garsonless/db/types'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import type { OpenTableSessionView, TableItem } from './tables-builder-types'
import type { TablesRealtimeStatus } from './tables-realtime-model'

export interface TablesOperationsShellProps {
  restaurantId: string
  restaurantName: string
  restaurantTimezone?: string
  initialTables: Tables<'tables'>[]
  initialDirectoryError?: string | null
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
  connectionStatus: TablesRealtimeStatus
  onRetryRealtime: () => void
  now: number
  initialLayoutSnapshot: TableLayoutSnapshot
  initialLayoutError: string | null
  layoutInvalidation: number
  canCreateOrders: boolean
  detailPanel?: ReactNode
}

export interface TablesFloorCanvasProps {
  restaurantId: string
  tables: TableItem[]
  setTables: Dispatch<SetStateAction<TableItem[]>>
  filteredTables: TableItem[]
  openSessions: Record<string, OpenTableSessionView>
  pendingRequests: Record<string, Array<{ id: string; label: string }>>
  now: number
  floorFilter: string
  filtersActive: boolean
  onClearFilters: () => void
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
