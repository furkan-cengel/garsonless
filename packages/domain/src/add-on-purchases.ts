import {
  ADD_ON_DEFINITIONS,
  type RestaurantAddOn,
  type RestaurantPlan,
} from './entitlements'

/** Prices are initial seeds only. Runtime sales always use the versioned DB catalogue. */
export const ADD_ON_INITIAL_PRICES = {
  storefront_video_hero: 39_000,
  iyzico_online_payments: 300_000,
} as const
export const ADD_ON_PURCHASE_PLANS: Record<
  RestaurantAddOn,
  readonly RestaurantPlan[]
> = {
  storefront_video_hero: ['starter', 'plus'],
  iyzico_online_payments: ['pro'],
}
/** Code-defined feature wiring; commercial prices and availability are versioned in the DB. */
export const ADD_ON_CATALOG = {
  storefront_video_hero: {
    ...ADD_ON_DEFINITIONS.storefront_video_hero,
    purchasePlans: ADD_ON_PURCHASE_PLANS.storefront_video_hero,
    requiresActiveSubscription: true,
    sectionId: 'storefront-video-hero',
    settingsSection: 'billing',
  },
  iyzico_online_payments: {
    ...ADD_ON_DEFINITIONS.iyzico_online_payments,
    purchasePlans: ADD_ON_PURCHASE_PLANS.iyzico_online_payments,
    requiresActiveSubscription: true,
    sectionId: null,
    settingsSection: 'payments',
  },
} as const
export type AddOnPrice = {
  addOn: RestaurantAddOn
  version: number
  netAmountMinor: number
  vatRate: number
  totalAmountMinor: number
  currency: 'TRY'
  active: boolean
  createdAt: string
}
export type AddOnPurchaseStatus =
  | 'initializing'
  | 'pending'
  | 'review'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'chargeback'
export type AddOnPurchaseSummary = {
  id: string
  addOn: RestaurantAddOn
  status: AddOnPurchaseStatus
  totalAmountMinor: number
  createdAt: string
  paidAt: string | null
  documentReady: boolean
}
export type AddOnStore = {
  prices: AddOnPrice[]
  owned: RestaurantAddOn[]
  purchases: AddOnPurchaseSummary[]
}
export type AddOnReturnContext = {
  templateId: string
  sectionId: 'storefront-video-hero'
} | null
export function canPurchaseAddOn(
  addOn: RestaurantAddOn,
  plan: RestaurantPlan,
): boolean {
  return ADD_ON_PURCHASE_PLANS[addOn].includes(plan)
}
export function addOnLabel(addOn: RestaurantAddOn): string {
  return ADD_ON_DEFINITIONS[addOn].label
}
export function addOnReturnPath(
  restaurantId: string,
  addOn: RestaurantAddOn,
  context: AddOnReturnContext,
): string {
  const root = `/dashboard/${encodeURIComponent(restaurantId)}`
  if (ADD_ON_CATALOG[addOn].sectionId && context) {
    return `${root}/theme/${encodeURIComponent(context.templateId)}/edit?addon=storefront_video_hero`
  }
  return `${root}/settings?section=${ADD_ON_CATALOG[addOn].settingsSection}`
}
export function formatAddOnMoney(minor: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(minor / 100)
}
