/** Server-only database boundary for app adapters and application ports. */
export { resolveOrderLines } from './orders'
export { recordSecurityEvent, TEAM_SECURITY_EVENT_TYPES } from './security'
export type { TeamSecurityEventType } from './security'
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
export { createKitchenSettingsCommandPort } from './kitchen-settings-command-port'
export { createTeamCommandPort } from './team-command-port'
export { createLoyaltyQueryPort } from './loyalty-query-port'
export { createThemeApplicationPort } from './theme-application-port'
export {
  createRestaurantSettingsPort,
  createStandRequestPort,
} from './restaurant-application-port'
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
  createDashboardInsightsReadModelPort,
  createOrdersBoardReadModelPort,
  createPanoTableDetailReadModelPort,
} from './dashboard-read-model-port'
export {
  createDashboardRestaurantReadModelPort,
  createDashboardSettingsReadModelPort,
  createDashboardTablesReadModelPort,
  createMenuManagementReadModelPort,
  createThemeMenuReferenceReadModelPort,
} from './dashboard-feature-read-model-port'
export type {
  ThemeEditorCategoryRow,
  ThemeEditorItemRow,
  TeamAuditEventRow,
} from './dashboard-feature-read-model-port'
export type { DashboardOrderReadRow } from './dashboard-read-model-port'
export { createStructuredDashboardInsightsObserver } from './dashboard-read-model-observability'
export type {
  DashboardInsightsObservabilityOptions,
  StructuredDashboardInsightsObserverOptions,
} from './dashboard-read-model-observability'
export { createPersistentDashboardInsightsObserver } from './dashboard-read-model-observation-sink'
export type { PersistentDashboardInsightsObserverOptions } from './dashboard-read-model-observation-sink'
export {
  DEFAULT_DASHBOARD_INSIGHTS_HEALTH_THRESHOLDS,
  projectDashboardInsightsHealth,
  readDashboardInsightsHealth,
} from './dashboard-read-model-health'
export type {
  DashboardInsightsHealthAlert,
  DashboardInsightsHealthOperationRollup,
  DashboardInsightsHealthSnapshot,
  DashboardInsightsHealthStatus,
  DashboardInsightsHealthThresholds,
  ReadDashboardInsightsHealthOptions,
} from './dashboard-read-model-health'
export {
  buildDashboardInsightsHealthAlertPayload,
  buildDashboardInsightsUnavailableAlertPayload,
  deliverDashboardInsightsHealthAlert,
} from './dashboard-read-model-health-alert'
export type {
  DashboardInsightsHealthAlertPayload,
  DashboardInsightsMonitorStatus,
  DeliverDashboardInsightsHealthAlertOptions,
} from './dashboard-read-model-health-alert'
export {
  createKitchenLaunchTicket,
  exchangeKitchenLaunchTicket,
  hasKitchenCredential,
  KITCHEN_SESSION_TTL_SECONDS,
  verifyKitchenSession,
} from './kitchen-session'
export type { KitchenLaunchTicketResult } from './kitchen-session'
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
  createDashboardTablePort,
  createKitchenBoardPort,
  createTableServiceRequestPort,
  createTableSessionPort,
} from './table-command-port'
export { createPublicTableQueryPort } from './table-qr-tokens'
