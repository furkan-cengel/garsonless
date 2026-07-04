export { createClient, createServiceClient } from './client'
export { createOrder, resolveOrderLines } from './orders'
export type { CreateOrderInput, CreateOrderLine, OrderDiscountBreakdown } from './orders'
export { updateOrderStatusDB, cancelOrderDB, markOrderPaidDB, validateKitchenToken } from './orders-update'
export { createServiceRequest } from './service-requests'
export type { CreateServiceRequestInput } from './service-requests'
export { recordSecurityEvent, getSecurityEvents } from './security'
export type { SecurityEvent, SecurityEventType, RecordSecurityEventInput } from './security'
export {
  TEAM_SECTIONS, generateInviteToken, sanitizeTeamPermissions,
  listTeamMembers, createInvite, resolveInviteByToken, acceptInvite,
  updateMemberPermissions, setMemberStatus, removeMember, resendInvite,
} from './team'
export type {
  TeamSection, MemberStatus, TeamMember, ResolvedInvite,
  CreateInviteResult, AcceptInviteResult, ResendInviteResult,
} from './team'
export { normalizePhone } from './phone'
export { getSmsProvider, MockSmsProvider } from './sms'
export type { SmsProvider, SmsSendOptions, SmsSendResult, SmsPurpose } from './sms'
export {
  requestOtp, verifyOtp, earnForOrder, getMemberBalances, NETWORK_SCOPE_KEY,
  computeOrderDiscount, computePointsRedemption, computeDiscountStack, computeStampEarn, effectivePct, applyBonusStamps, shouldEarnOnSettlement, redeemForOrder,
  refundCancelledLoyaltyOrder,
  computeTier, creditVisitsForSession, creditWelcomeBonus, DEFAULT_TIERS, MAX_TIERS, sanitizeTiers, getLoyaltyScope,
  snapshotOrderCustomerTier, readOrderCustomerTierSnapshot, orderHasPriorityService,
  compareOrdersByPriorityThenCreatedAt, sortOrdersByPriorityThenCreatedAt,
} from './loyalty'
export type {
  RequestOtpResult, VerifyOtpResult, MemberBalances, LoyaltyConfig,
  DiscountResult, OrderLineInput, LoyaltyTier, CatalogReward, LoyaltyActivity,
  OrderCustomerTierSnapshot, LoyaltyRefundResult,
} from './loyalty'
export {
  getRestaurantCustomers, getRestaurantCustomerDetail, grantStoreCredit,
  recordConsent, getConsentStatus, maskPhone,
  listCustomerSegments, getCustomerSegment, createCustomerSegment,
  updateCustomerSegment, deleteCustomerSegment,
  sanitizeCustomerSegmentDefinition, isEmptyCustomerSegmentDefinition,
} from './customers'
export type {
  RestaurantCustomer, RestaurantCustomersPage, RestaurantCustomerDetail,
  CustomerTimelineEvent, CustomerSort, CustomerSegment,
  CustomerSegmentDefinition, CustomerSegmentRule, CustomerSegmentOperator,
  CustomerSegmentConsent, CustomerConsentType, SavedCustomerSegment,
} from './customers'
export {
  listCampaigns, previewCampaignAudience, sendCampaign, sendCampaignTest,
  sanitizeCampaignMessage,
} from './campaigns'
export type {
  CampaignAudienceInput, CampaignAudiencePreview, CampaignSegmentKind,
  CampaignStatus, CampaignSummary, SendCampaignResult,
} from './campaigns'
export {
  signCustomerSession,
  verifyCustomerSession,
  CUSTOMER_SESSION_COOKIE,
} from './session'
export type { CustomerSession } from './session'
export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './types.gen'
export type { OrderStatus, RestaurantPlan, PaymentMethod } from './enums'
export { ORDER_STATUS_TRANSITIONS, canTransitionOrderStatus } from './enums'
// Restaurant-local-day helpers — one source of truth for day boundaries/keys.
export {
  DEFAULT_TIMEZONE, startOfRestaurantDay, startOfDayNDaysAgo, rangeWindow,
  restaurantDayKey, restaurantHour, restaurantWeekday, isValidTimeZone, normalizeTimeZone,
} from './restaurant-time'
// The one collected-revenue (tahsilat) predicate — client-safe home in
// order-client.ts, re-exported here for server queries.
export { isCollectedOrderRow } from './order-client'
export {
  ALLERGEN_CODES,
  ALLERGEN_LABELS,
  normalizeAllergenCodes,
  normalizeIngredients,
  normalizeModifierGroups,
  resolveModifierSelections,
  buildOrderLineSnapshot,
  readOrderLineSnapshot,
  readOrderLineSnapshots,
} from './menu-domain'
export type {
  AllergenCode,
  MenuIngredient,
  MenuModifierOption,
  MenuModifierGroup,
  ModifierSelectionMode,
  SelectedMenuModifier,
  ResolvedOrderModifier,
  RemovedOrderIngredient,
  OrderLineSnapshot,
  ResolvableMenuItem,
} from './menu-domain'
