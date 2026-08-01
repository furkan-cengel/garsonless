import type { TableOrderItemTransferSelection } from '@garsonless/application/tables'
import type { SettlementLineItem } from '../../lib/settlement-items'

export type TransferSelectionOrder = {
  id: string
  items: SettlementLineItem[]
}

export type TransferItemSelectionState = Record<string, number>

export function transferItemKey(orderId: string, lineIndex: number): string {
  return `${orderId}:${lineIndex}`
}

export function buildInitialTransferItemSelection(
  orders: TransferSelectionOrder[],
  initialOrderIds: string[],
  selectAll: boolean,
): TransferItemSelectionState {
  const selectedOrders = new Set(initialOrderIds)
  return Object.fromEntries(orders.flatMap((order) => (
    selectAll || selectedOrders.has(order.id)
      ? order.items.map((item) => [transferItemKey(order.id, item.lineIndex), item.quantity])
      : []
  )))
}

export function toggleTransferItem(
  current: TransferItemSelectionState,
  orderId: string,
  item: SettlementLineItem,
  checked: boolean,
): TransferItemSelectionState {
  const key = transferItemKey(orderId, item.lineIndex)
  if (checked) return { ...current, [key]: item.quantity }
  const next = { ...current }
  delete next[key]
  return next
}

export function toggleTransferOrder(
  current: TransferItemSelectionState,
  order: TransferSelectionOrder,
  checked: boolean,
): TransferItemSelectionState {
  return order.items.reduce(
    (next, item) => toggleTransferItem(next, order.id, item, checked),
    current,
  )
}

export function setTransferItemQuantity(
  current: TransferItemSelectionState,
  orderId: string,
  item: SettlementLineItem,
  quantity: number,
): TransferItemSelectionState {
  const normalized = Math.max(1, Math.min(item.quantity, Math.floor(quantity)))
  return { ...current, [transferItemKey(orderId, item.lineIndex)]: normalized }
}

export function selectedTransferItems(
  orders: TransferSelectionOrder[],
  selected: TransferItemSelectionState,
): TableOrderItemTransferSelection[] {
  return orders.flatMap((order) => order.items.flatMap((item) => {
    const quantity = selected[transferItemKey(order.id, item.lineIndex)]
    return quantity ? [{ orderId: order.id, lineIndex: item.lineIndex, quantity }] : []
  }))
}

export function selectedTransferUnitCount(selected: TransferItemSelectionState): number {
  return Object.values(selected).reduce((sum, quantity) => sum + quantity, 0)
}

export function orderSelectionState(
  order: TransferSelectionOrder,
  selected: TransferItemSelectionState,
): 'none' | 'partial' | 'all' {
  const selectedItems = order.items.filter((item) => selected[transferItemKey(order.id, item.lineIndex)])
  if (selectedItems.length === 0) return 'none'
  return selectedItems.length === order.items.length
    && selectedItems.every((item) => selected[transferItemKey(order.id, item.lineIndex)] === item.quantity)
    ? 'all'
    : 'partial'
}

export function selectionNeedsOrderSplit(
  orders: TransferSelectionOrder[],
  selected: TransferItemSelectionState,
): boolean {
  return orders.some((order) => orderSelectionState(order, selected) === 'partial')
}

export function fullySelectedOrderIds(
  orders: TransferSelectionOrder[],
  selected: TransferItemSelectionState,
): string[] {
  return orders.filter((order) => orderSelectionState(order, selected) === 'all').map((order) => order.id)
}
