/**
 * Narrow Supabase projections owned by the dashboard read-model adapter.
 * Contract tests intentionally pin these strings: adding a field is an
 * explicit data-boundary decision, not an incidental UI refactor.
 */
export const DASHBOARD_INSIGHTS_PROJECTIONS = {
  orderVolume: 'id, total, status, session_id, table_id, created_at',
  collectedOrders: 'total, paid_at, payment_method, created_at, table_id, items',
  tableRefs: 'id, label, deleted_at',
  tablePerformanceTables: 'id, label',
  tablePerformanceOrders: 'table_id, total',
  tablePerformanceClosedSessions: 'table_id, opened_at, closed_at',
  tablePerformanceOpenSessions: 'table_id',
  panoTables: 'id, label, deleted_at',
  panoOpenSessions: 'id, table_id, opened_at',
  panoPaymentStatus: 'mode',
  panoOpenSessionOrders: 'table_session_id, status, total, paid_at',
  panoOpenSessionShares: 'table_session_id, amount, method, status',
  panoOpenServiceRequests: 'id, table_id, created_at, request_type',
} as const
