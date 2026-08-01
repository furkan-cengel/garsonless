import {
  isOrderStatus,
  normalizeOperationalOrderStatus,
  type OperationalOrderStatus,
} from '@garsonless/domain'
import type { Tables } from './types.gen'

export const DASHBOARD_ORDER_SOURCES = ['customer', 'staff'] as const
export type DashboardOrderSource = typeof DASHBOARD_ORDER_SOURCES[number]

export type DashboardOrderStorageRow = Pick<Tables<'orders'>,
  | 'id'
  | 'restaurant_id'
  | 'table_id'
  | 'table_session_id'
  | 'session_id'
  | 'customer_id'
  | 'status'
  | 'source'
  | 'items'
  | 'total'
  | 'discount_breakdown'
  | 'customer_tier'
  | 'paid_at'
  | 'payment_method'
  | 'created_at'
  | 'sent_to_kitchen_at'
  | 'ready_at'
  | 'served_at'
  | 'cancel_reason'
  | 'cancelled_by'
  | 'settled_by'
  | 'updated_at'
>

export type DashboardOrderReadRow = Omit<DashboardOrderStorageRow, 'status' | 'source'> & {
  status: OperationalOrderStatus
  source: DashboardOrderSource
}

export function isDashboardOrderSource(value: unknown): value is DashboardOrderSource {
  return typeof value === 'string' && (DASHBOARD_ORDER_SOURCES as readonly string[]).includes(value)
}

/** The authenticated board never receives raw legacy payment status. Unknown
 * storage vocabulary fails closed instead of being mislabeled in operations. */
export function normalizeDashboardOrderReadRow(row: DashboardOrderStorageRow): DashboardOrderReadRow {
  if (!isOrderStatus(row.status)) throw new Error('Unsupported order status')
  if (!isDashboardOrderSource(row.source)) throw new Error('Unsupported order source')
  return {
    ...row,
    status: normalizeOperationalOrderStatus(row.status),
    source: row.source,
  }
}
