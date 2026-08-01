import type { OrderStatus } from '@garsonless/db/types'

export type OrderTrackingPhase = 0 | 1 | 2 | 3

/**
 * Customer-facing progress for the canonical dashboard order lifecycle.
 * Keep legacy statuses mapped so an in-flight order never jumps backwards.
 */
export function orderStatusPhase(status: OrderStatus): OrderTrackingPhase {
  if (status === 'sent_to_kitchen' || status === 'preparing' || status === 'paid') return 1
  if (status === 'ready') return 2
  if (status === 'served') return 3
  return 0
}

