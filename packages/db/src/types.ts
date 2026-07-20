/**
 * Explicit shared database type surface.
 *
 * Runtime capabilities intentionally live behind explicit boundaries:
 * - `@garsonless/db/server`  — service-role repositories/RPC adapters
 * - `@garsonless/db/browser` — anon client and browser-safe projections
 * - `@garsonless/domain/*`   — business policies and vocabularies
 */

export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './types.gen'
export type { OrderStatus, RestaurantPlan, PaymentMethod } from './enums'
export type { CreateOrderInput, CreateOrderLine, OrderDiscountBreakdown } from './orders'
export type { VatBreakdown, VatBreakdownRate, VatLineInput } from './order-tax'
export type { CreateShareInput } from './split'
export type { ServiceRequestType } from '@garsonless/domain/tables'
export type {
  SecurityEvent,
  SecurityEventMetadata,
  SecurityEventType,
  TeamSecurityEventType,
  RecordSecurityEventInput,
} from './security'
export type { EnsureCustomerOptions, EnsureCustomerResult } from '@garsonless/domain/customers'
export type {
  TeamSection,
  MemberStatus,
  TeamMember,
  ResolvedInvite,
  CreateInviteResult,
  AcceptInviteResult,
  ResendInviteResult,
} from './team'
export type {
  MemberBalances,
  LoyaltyConfig,
  LoyaltyTier,
  CatalogReward,
  LoyaltyActivity,
} from '@garsonless/domain/loyalty'
export type {
  DiscountResult,
  OrderLineInput,
  LoyaltyRefundResult,
} from './loyalty'
export type { OrderCustomerTierSnapshot } from './order-client'
export type {
  RestaurantCustomer,
  RestaurantCustomersPage,
  RestaurantCustomerDetail,
  CustomerTimelineEvent,
  CustomerSort,
  CustomerSegment,
  CustomerSegmentCounts,
  CustomerSegmentDefinition,
  CustomerSegmentRule,
  CustomerSegmentOperator,
  CustomerSegmentConsent,
  CustomerConsentType,
  SavedCustomerSegment,
} from '@garsonless/domain/customers'
export type {
  CampaignAudienceInput,
  CampaignAudiencePreview,
  CampaignSegmentKind,
  CampaignStatus,
  CampaignSummary,
} from '@garsonless/domain/campaigns'
export type { SendCampaignResult } from '@garsonless/domain/campaigns'
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
