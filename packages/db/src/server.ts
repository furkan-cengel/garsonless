import 'server-only'
export { enqueueMenuImport } from './menu-import-port'
export { findDashboardRecoveryEmail } from './dashboard-recovery-intent'

/** Server-only database boundary for app adapters and application ports. */
export { resolveCheckoutDiscount, resolveOrderLines } from './orders'
export {
  applyCouponToDiscount,
  archiveRestaurantCoupon,
  restoreRestaurantCoupon,
  listActivePublicCoupons,
  listRestaurantCoupons,
  resolveCouponPricing,
  saveRestaurantCoupon,
} from './coupons'
export type { CouponWriteInput, ResolvedCouponPricing } from './coupons'
export { recordSecurityEvent, TEAM_SECURITY_EVENT_TYPES } from './security'
export {
  completeDashboardSignupEmailVerification,
  requireDashboardSignupEmailVerification,
} from './dashboard-signup-verification-port'
export {
  consumeDashboardAuthRateLimit,
  createTenantPrivacyExport,
  readRestaurantIntegrationHealth,
  recordRestaurantIntegrationHealth,
  requestTenantPrivacyOperation,
  updateRestaurantTimezoneCas,
} from './dashboard-settings-security-port'
export {
  recordLegalDocumentAcceptance,
  recordSignupLegalEvidence,
  recordCustomerMembershipLegalEvidence,
} from './legal-acceptance-port'
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
export {
  readCustomerAccountRecord,
  readCustomerLoyaltyActivityPageRecord,
  readCustomerLoyaltyAggregates,
  readCustomerRestaurantLoyaltyActivityPageRecord,
  readCustomerOrderPageRecord,
  readCustomerOrderRecord,
  updateCustomerAccountName,
} from './customer-account-read-port'
export type {
  CustomerLoyaltyActivityRecord,
  CustomerLoyaltyAggregateRecord,
  CustomerOrderRecord,
  CustomerOrderRestaurantRecord,
} from './customer-account-read-port'
export {
  createCustomerDeleteRequest,
  createCustomerPrivacyExport,
} from './customer-privacy-port'
export type {
  CustomerDeleteRequestRecord,
  CustomerPrivacyExportRecord,
} from './customer-privacy-port'
export {
  claimActiveCustomerGuestOrders,
  deleteCustomerFavorite,
  previewCustomerOrderReorder,
  putCustomerFavorites,
  readCustomerFavorites,
} from './customer-continuity-port'
export type {
  CustomerFavoriteRecord,
  CustomerReorderPreviewRecord,
} from './customer-continuity-port'
export { createCustomerApplicationPort } from './customer-application-port'
export { getLoyaltyScope } from './loyalty'
export { createCampaignApplicationPort } from './campaign-application-port'
export {
  getCampaignDeliveryLog,
  listCampaignEmailTemplates,
  listCampaignAudienceContacts,
  recordResendCampaignEvent,
  saveCampaignEmailTemplate,
  deleteCampaignEmailTemplate,
} from './campaigns'
export { getSmsDeliveryAvailability } from './sms'
export {
  getCampaignEmailDeliveryAvailability,
  readCampaignEmailIdentity,
  renderCampaignEmail,
  sanitizeCampaignHtml,
} from './campaign-email'
export { normalizeTurkishMobile } from './phone'
export {
  createCustomerConsentApplicationPort,
  createCustomerIdentityApplicationPort,
} from './customer-auth-application-port'
export {
  consumeCustomerAuthIntent,
  consumeCustomerAuthRateLimit,
  registerCustomerAuthIntent,
} from './customer-auth-security-port'
export { createMenuCommandPort } from './menu-command-port'
export { listMenuItemRecommendations } from './menu-recommendations'
export type { MenuItemRecommendationRow } from './menu-recommendations'
export { createKitchenSettingsCommandPort } from './kitchen-settings-command-port'
export { createTeamCommandPort } from './team-command-port'
export { createLoyaltyQueryPort } from './loyalty-query-port'
export { createFeaturedProductsReadPort } from './featured-products-read-port'
export { createPublicMenuRevisionPort } from './public-menu-revision-port'
export { listPublishedPublicMenuSitemapEntries } from './public-menu-sitemap-port'
export type { PublicMenuSitemapEntry } from './public-menu-sitemap-port'
export { createThemeApplicationPort } from './theme-application-port'
export {
  createThemePreviewAccessToken,
  resolveThemePreviewSigningSecret,
  THEME_PREVIEW_ACCESS_TTL_SECONDS,
  verifyThemePreviewAccessToken,
} from './theme-preview-access'
export { createRestaurantAssetStoragePort } from './restaurant-asset-storage-port'
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
  readOrdersForSettlement,
  readSessionSettlementAccessBundle,
  readTablesCommandAccessBundle,
  settleSessionAndCloseAtomic,
  readTransferableOrdersAccessBundle,
  readPaymentSharesForSettlement,
  readTransferableOrdersForSession,
} from './order-command-port'
export { createOrderRefundPort } from './order-refund-port'
export { createPlatformSubscriptionRefundPort } from './subscription-refund-port'
export {
  createPaymentReconciliationPort,
  recordPaymentReconciliation,
} from './payment-reconciliation-port'
export { createSubscriptionBillingPersistencePort } from './subscription-billing-port'
export { createSubscriptionBillingWebhookInboxPort } from './subscription-billing-webhook-port'
export { createSubscriptionBillingOperationsPort } from './subscription-billing-operations-port'
export { createSubscriptionBillingSettingsReadPort } from './subscription-billing-settings-port'
export {
  createSubscriptionInvoiceDocumentReadPort,
  type SubscriptionInvoiceDocumentLookup,
} from './subscription-invoice-document-port'
export { createSubscriptionCancellationSchedulePort } from './subscription-cancellation-port'
export {
  createAccountingInvoicePort,
  type ActiveAccountingProviderName,
  type AccountingInvoiceJob,
  type AccountingProfileSnapshot,
  type AccountingProviderName,
} from './accounting-invoice-port'
export { createBillingMaintenancePort } from './billing-maintenance-port'
export { createPlatformAdminIdentityPort } from './platform-admin-identity-port'
export { createPlatformAdminTenantAccountsPort } from './platform-admin-tenant-accounts-port'
export {
  createPlatformErrorReadPort,
  recordPlatformErrorEvent,
} from './platform-error-event-port'
export { createPlatformAdminTenantReadPort } from './platform-admin-tenant-read-port'
export {
  createPlatformAdminTenantOperationsPort,
  readTenantOrderIngressStatus,
} from './platform-admin-tenant-operations-port'
export { createPlatformAdminTenantPlanManagementPort } from './platform-admin-tenant-plan-port'
export { createPlatformAdminEntitlementPort } from './platform-admin-entitlement-port'
export { createPlatformAdminImpersonationPort } from './platform-admin-impersonation-port'
export { createPlatformAdminPrivacyPort } from './platform-admin-privacy-port'
export {
  canPublicRestaurantUseFeature,
  canRestaurantUseFeature,
  canRestaurantUseFeatures,
  resolveRestaurantFeatureEntitlement,
} from './feature-entitlement-port'
export {
  createPlatformAdminDunningInterventionPort,
  createPlatformAdminTenantBillingReadPort,
} from './platform-admin-billing-port'
export { createSplitPaymentPort } from './split-command-port'
export {
  attachOrderProviderPayment,
  attachOrderPaymentToken,
  attachSharePaymentToken,
  createOrderCheckoutPort,
  deletePaymentCredentialVault,
  readIyzicoCredentialRecord,
  readOrderPaymentMapping,
  readPaymentCredentialMeta,
  readSharePaymentMapping,
  readShareProviderCheckout,
  rotatePaymentCredentialVault,
  writePaymentCredentialVault,
  voidVerifiedFailedSplitShare,
} from './payment-provider-port'
export type {
  IyzicoCredentialRecord,
  PaymentCredentialMetaRecord,
} from './payment-provider-port'
export {
  createDashboardTablePort,
  createKitchenBoardPort,
  createTableServiceRequestPort,
  createTableSessionPort,
} from './table-command-port'
export { triggerDomainOutboxWorker } from './outbox-worker-trigger'
export { createPublicTableQueryPort, resolveTransferredGuestTable } from './table-qr-tokens'
export {
  createDashboardPushPort,
  deleteDashboardPushEndpoint,
  deleteDashboardPushSubscriptionsForUser,
  readDashboardPushSubscriptionForUser,
  upsertDashboardPushSubscription,
} from './dashboard-push-port'
export {
  countUnreadInboxNotifications,
  createDashboardInboxPort,
  listPendingDashboardInboxEventIds,
  listInboxNotifications,
  markInboxNotificationsRead,
  type InboxFeedItem,
} from './dashboard-inbox-port'
export {
  createNotificationEmailPort,
  getNotificationPreferences,
  recordResendNotificationEvent,
  upsertNotificationPreferences,
} from './notification-email-port'

export { removeUnreferencedMenuMedia } from './menu-media-cleanup'

export { deviceDigest, enrollDashboardSecurity, readDashboardDeviceEvidence, saveDashboardVerifiedSession, invalidateDashboardSession, revokeDashboardDevices, createDashboardDeviceChallenge, markDashboardChallengeSent, verifyDashboardDeviceChallenge, sendDashboardDeviceCode } from './dashboard-device-security'

export { hasDashboardSignupLegalEvidence } from './legal-acceptance-port'

export { readPendingDashboardDeviceChallenge } from './dashboard-device-security'

export { createDashboardMediaStagingPort } from './dashboard-media-staging'
export type { MediaUploadRow, MediaUploadMetadata, StagedMediaResult } from './dashboard-media-staging'

export { createAddOnPurchasePort } from './add-on-purchase-port'
export { createMenuBulkPort } from './menu-bulk-port'

export { createInventoryPort } from './inventory-port'

export { createMenuTranslationPort, readPublicMenuTranslations } from './menu-translation-port'
export { createMediaLibraryPort, cleanupMediaLibrary, type MediaSession } from './media-library-port'

export { canSadakatAuthenticate, createSadakatBusiness, createSadakatPort, readSadakatProgram, readSadakatCard, readSadakatDashboard, joinSadakat, hasSadakatAccess, issueSadakatCode, grantSadakatPilot, sadakatError } from './sadakat-port'
