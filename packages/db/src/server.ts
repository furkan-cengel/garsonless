/** Server-only database boundary for app adapters and application ports. */
export { createServiceClient } from './client'
export { resolveOrderLines } from './orders'
export { recordSecurityEvent } from './security'
export {
  TEAM_SECTIONS,
  listTeamMembers,
  createInvite,
  resolveInviteByToken,
  acceptInvite,
  updateMemberPermissions,
  setMemberStatus,
  removeMember,
  resendInvite,
} from './team'
export type { TeamSection, TeamMember, ResolvedInvite } from './team'
export { resolveCustomerIdentityForAuthUser } from './customer-identity-port'
export { createCustomerApplicationPort } from './customer-application-port'
export { createCampaignApplicationPort } from './campaign-application-port'
export {
  createCustomerConsentApplicationPort,
  createCustomerIdentityApplicationPort,
} from './customer-auth-application-port'
export { createMenuCommandPort } from './menu-command-port'
export { createLoyaltyQueryPort } from './loyalty-query-port'
export { createThemeApplicationPort } from './theme-application-port'
export {
  createDomainEventConsumerPort,
  dispatchAggregateDomainEvents,
  isDurableConsumerEventType,
  processDomainOutboxEvent,
  requestWelcomeBonus,
} from './outbox-consumer-port'
export { applyCollectedOrderFilter } from './order-query-spec'
export {
  createAnalyticsReadModelPort,
  createOrdersBoardReadModelPort,
  createPanoTableDetailReadModelPort,
} from './dashboard-read-model-port'
export type { DashboardOrderReadRow } from './dashboard-read-model-port'
export {
  createKitchenLaunchTicket,
  exchangeKitchenLaunchTicket,
  hasKitchenCredential,
  KITCHEN_SESSION_TTL_SECONDS,
  verifyKitchenSession,
} from './kitchen-session'
export {
  createDashboardOrderPort,
  createDashboardOrderLifecyclePort,
  createPublicOrderPort,
  createSettlementPort,
  createKitchenOrderPort,
  readPaymentSharesForSettlement,
} from './order-command-port'
export {
  createPaymentReconciliationPort,
  recordPaymentReconciliation,
} from './payment-reconciliation-port'
export { createSplitPaymentPort } from './split-command-port'
export {
  attachOrderPaymentToken,
  attachSharePaymentToken,
  createOrderCheckoutPort,
  readIyzicoCredentialRecord,
  readOrderPaymentMapping,
  readSharePaymentMapping,
} from './payment-provider-port'
export {
  createKitchenBoardPort,
  createTableServiceRequestPort,
  createTableSessionPort,
  patchRestaurantQrStyle,
  readRestaurantSlug,
  softDeleteTable,
} from './table-command-port'
export {
  listActiveTableQrTokens,
  readPublicTableState,
  resolveActiveTableQrToken,
  rotateActiveTableQrToken,
} from './table-qr-tokens'
