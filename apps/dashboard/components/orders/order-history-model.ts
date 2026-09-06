import type { HistoryOrder } from '../../lib/actions/orders'
import { normalizeOrderSearch } from './order-filters'

export function historyMatchesSearch(orderId: string, tableLabel: string, search: string): boolean {
  const query = normalizeOrderSearch(search)
  return !query || orderId.toLocaleLowerCase('tr-TR').startsWith(query)
    || tableLabel.toLocaleLowerCase('tr-TR').includes(query)
}

/** Group history by when the order left the live board, not when it began. */
export function historyTerminalAt(order: Pick<HistoryOrder, 'status' | 'served_at' | 'updated_at'>): string {
  return order.status === 'served' && order.served_at ? order.served_at : order.updated_at
}
