import type { HistoryOrder } from '../../lib/actions/orders'

/** Group history by when the order left the live board, not when it began. */
export function historyTerminalAt(order: Pick<HistoryOrder, 'status' | 'served_at' | 'updated_at'>): string {
  return order.status === 'served' && order.served_at ? order.served_at : order.updated_at
}
