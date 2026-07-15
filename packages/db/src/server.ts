/** Server-only database boundary for app adapters and application ports. */
export { createServiceClient } from './client'
export { applyCollectedOrderFilter } from './order-query-spec'
export {
  createAnalyticsReadModelPort,
  createOrdersBoardReadModelPort,
  createPanoTableDetailReadModelPort,
} from './dashboard-read-model-port'
export type { DashboardOrderReadRow } from './dashboard-read-model-port'
export {
  createPublicOrderPort,
  createSettlementPort,
  createKitchenOrderPort,
  recordPaymentReconciliation,
  readPaymentSharesForSettlement,
  verifyKitchenActor,
} from './order-command-port'
export {
  createKitchenBoardPort,
  createTableServiceRequestPort,
  createTableSessionPort,
  patchRestaurantQrStyle,
  readRestaurantSlug,
  softDeleteTable,
} from './table-command-port'
export { resolveOrderLines } from './orders'
export { createShareDB, settleShareDB, voidShareDB } from './split'
export { validateKitchenToken } from './orders-update'
export {
  listActiveTableQrTokens,
  readPublicTableState,
  resolveActiveTableQrToken,
  rotateActiveTableQrToken,
} from './table-qr-tokens'
