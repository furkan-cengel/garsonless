'use client'

import { useCallback, useState } from 'react'
import type { OpenTableSessionView, TableItem } from './tables-builder-types'
import { TablePropertiesDialog } from './TablePropertiesDialog'
import { TableQuickActionMenu, type TableQuickMenuPosition } from './TableQuickActionMenu'
import { buildTableQuickActions, type TableQuickActionId } from './table-quick-actions-model'

type Input = {
  tables: TableItem[]
  openSessions: Record<string, OpenTableSessionView>
  pendingRequests: Record<string, Array<{ id: string; label: string }>>
  floorFilter: string
  initialLayoutError: string | null
  canCreateOrders: boolean
  setActiveId: (tableId: string) => void
  startEditing: () => void
  onOpenDetail: (tableId: string) => void
  onNewOrder: (tableId: string) => void
  onTransfer: (mode: 'table_move' | 'account_transfer', tableId: string, options?: { selectAll?: boolean }) => void
  onPrefetchTransfer: (tableId: string) => void
  onSettle: (session: OpenTableSessionView, label: string) => void
  onCloseSession: (session: OpenTableSessionView, label: string) => void
  onResolveRequest: (requestId: string) => void
  onRename: (table: TableItem, input: { label: string; floorLabel: string; areaLabel: string }) => Promise<string | null>
  onDelete: (table: TableItem) => Promise<string | null>
}

export function useTableFloorActions(input: Input) {
  const [quickMenu, setQuickMenu] = useState<{ tableId: string; position: TableQuickMenuPosition; restoreFocus: HTMLElement | null } | null>(null)
  const [properties, setProperties] = useState<{ tableId: string; initialDelete: boolean } | null>(null)
  const closeQuickMenu = useCallback(() => setQuickMenu(null), [])
  const { onPrefetchTransfer, openSessions, setActiveId } = input

  const run = (table: TableItem, action: TableQuickActionId) => {
    const session = input.openSessions[table.id]
    if (action === 'details') input.onOpenDetail(table.id)
    else if (action === 'new_order' || action === 'add_order') input.onNewOrder(table.id)
    else if (action === 'table_move') input.onTransfer('table_move', table.id)
    else if (action === 'order_transfer') input.onTransfer('account_transfer', table.id)
    else if (action === 'account_transfer') input.onTransfer('account_transfer', table.id, { selectAll: true })
    else if (action === 'settlement' && session) input.onSettle(session, table.label)
    else if (action === 'close_session' && session) input.onCloseSession(session, table.label)
    else if (action === 'resolve_request') {
      const request = input.pendingRequests[table.id]?.[0]
      if (request) input.onResolveRequest(request.id)
    } else if (action === 'rename') setProperties({ tableId: table.id, initialDelete: false })
    else if (action === 'delete') setProperties({ tableId: table.id, initialDelete: true })
    else if (action === 'edit_layout') {
      input.setActiveId(table.id)
      input.startEditing()
    }
  }

  const openQuickMenu = useCallback((tableId: string, anchor: HTMLElement, x: number, y: number) => {
    setActiveId(tableId)
    if (openSessions[tableId]) onPrefetchTransfer(tableId)
    setQuickMenu({ tableId, position: { x, y }, restoreFocus: anchor })
  }, [onPrefetchTransfer, openSessions, setActiveId])

  const menuTable = quickMenu ? input.tables.find((table) => table.id === quickMenu.tableId) : null
  const propertyTable = properties ? input.tables.find((table) => table.id === properties.tableId) : null
  const menuSession = menuTable ? input.openSessions[menuTable.id] : undefined
  const overlays = <>
    {quickMenu && menuTable && <TableQuickActionMenu
      tableLabel={menuTable.label}
      actions={buildTableQuickActions({
        hasSession: Boolean(menuSession),
        canCreateOrders: input.canCreateOrders,
        canEditLayout: Boolean(input.floorFilter) && !input.initialLayoutError,
        pendingRequestCount: input.pendingRequests[menuTable.id]?.length ?? 0,
        unpaidTotal: menuSession?.unpaidTotal ?? 0,
        declaredCashTotal: menuSession?.splitDeclaredCashTotal ?? 0,
        hasUnfinished: menuSession?.hasUnfinished ?? false,
      })}
      position={quickMenu.position}
      restoreFocus={quickMenu.restoreFocus}
      onAction={(action) => run(menuTable, action)}
      onClose={closeQuickMenu}
    />}
    {properties && propertyTable && <TablePropertiesDialog
      table={propertyTable}
      allowDelete={!input.openSessions[propertyTable.id]}
      initialDelete={properties.initialDelete}
      onClose={() => setProperties(null)}
      onSave={(value) => input.onRename(propertyTable, value)}
      onDelete={() => input.onDelete(propertyTable)}
    />}
  </>

  return { openQuickMenu, overlays }
}
