import {
  createCustomerConsentApplicationPort,
  createCustomerDeleteRequest,
  createCustomerPrivacyExport,
  readCustomerAccountRecord,
  deleteCustomerFavorite,
  previewCustomerOrderReorder,
  putCustomerFavorites,
  readCustomerFavorites,
  readCustomerOrderPageRecord,
  readCustomerOrderRecord,
  readCustomerOwnBirthday,
  readCustomerRestaurantLoyaltyActivityPageRecord,
  readCustomerReviewPrompt,
  readCustomerRewardNotices,
  setCustomerBirthday,
  submitCustomerFeedback,
  updateCustomerAccountName,
  type CustomerOrderRecord,
  type CustomerOrderRestaurantRecord,
} from '@garsonless/db/server'
import { updateCustomerConsent } from '@garsonless/application/customers'
import { isValidBirthday, type CustomerReviewPrompt, type CustomerRewardNotice } from '@garsonless/domain/customers'
import type { CustomerSession } from './customer-session'
import {
  customerOrderSavings,
  customerOrderStatus,
  customerPaymentLabel,
  encodeCustomerLoyaltyCursor,
  encodeCustomerOrderCursor,
  projectCustomerOrderLines,
  type CustomerAccountView,
  type CustomerOrderDetailView,
  type CustomerOrderFilter,
  type CustomerOrderSummaryView,
  type CustomerOrdersPageView,
  type CustomerFavoritesView,
  type CustomerLoyaltyActivityPageView,
  type CustomerPrivacyExportView,
  type CustomerDeleteRequestView,
  type CustomerReorderPreviewView,
} from './customer-account-contract'

export async function readCustomerAccountView(session: CustomerSession): Promise<CustomerAccountView | null> {
  const record = await readCustomerAccountRecord(session.customerId)
  if (!record) return null
  return {
    profile: {
      name: record.name,
      email: session.email && session.emailVerified ? { value: session.email, verified: true } : null,
      phone: session.phone && session.phoneVerified ? { value: session.phone, verified: true } : null,
      memberSince: record.createdAt,
    },
    loyalty: record.loyalty.map((item) => ({
      restaurant: {
        id: item.restaurantId,
        slug: item.restaurantSlug,
        name: item.restaurantName,
        logoUrl: item.restaurantLogoUrl,
      },
      points: item.points,
      stamps: item.stamps,
      stampGoal: item.stampGoal,
      stampRewardText: item.stampRewardText,
      stampUnlocked: item.stampUnlocked,
      pointsEnabled: item.pointsEnabled,
      stampsEnabled: item.stampsEnabled,
      tier: item.tier,
      nextTier: item.nextTier,
      tierProgress: item.tierProgress,
      lifetimePoints: item.lifetimePoints,
    })),
    consents: record.consents.map((item) => ({
      restaurant: {
        id: item.restaurantId,
        slug: item.restaurantSlug,
        name: item.restaurantName,
      },
      contactData: item.contactData,
      marketing: item.marketing,
    })),
    privacy: { deletionRequest: record.deletionRequest },
  }
}

export async function saveCustomerAccountName(session: CustomerSession, name: string): Promise<CustomerAccountView | null> {
  if (!await updateCustomerAccountName(session.customerId, name)) return null
  return readCustomerAccountView({ ...session, name })
}

export async function saveCustomerAccountConsent(input: {
  session: CustomerSession
  restaurantId: string
  consentType: 'contact_data' | 'marketing'
  grant: boolean
}): Promise<CustomerAccountView | null> {
  const current = await readCustomerAccountRecord(input.session.customerId)
  if (!current?.consents.some((consent) => consent.restaurantId === input.restaurantId)) return null
  const result = await updateCustomerConsent({
    actor: 'customer-member',
    authUserId: input.session.authUserId,
    customerId: input.session.customerId,
    restaurantId: input.restaurantId,
  }, {
    restaurantId: input.restaurantId,
    consentType: input.consentType,
    grant: input.grant,
    source: 'account_center',
  }, createCustomerConsentApplicationPort())
  return result.ok ? readCustomerAccountView(input.session) : null
}

export async function readCustomerLoyaltyActivityView(input: {
  session: CustomerSession
  restaurantId: string
  limit: number
  cursor: { createdAt: string; id: string } | null
}): Promise<CustomerLoyaltyActivityPageView> {
  const page = await readCustomerRestaurantLoyaltyActivityPageRecord({
    customerId: input.session.customerId,
    restaurantId: input.restaurantId,
    limit: input.limit,
    cursor: input.cursor,
  })
  return {
    items: page.items,
    nextCursor: page.nextCursor ? encodeCustomerLoyaltyCursor(page.nextCursor) : null,
  }
}

export async function prepareCustomerPrivacyExport(
  session: CustomerSession,
  requestId: string,
): Promise<CustomerPrivacyExportView> {
  return createCustomerPrivacyExport({ customerId: session.customerId, requestId })
}

export async function requestCustomerAccountDeletion(
  session: CustomerSession,
  requestId: string,
  confirmation: string,
): Promise<CustomerDeleteRequestView> {
  return createCustomerDeleteRequest({
    customerId: session.customerId,
    requestId,
    confirmation,
  })
}

export async function readCustomerOrdersView(input: {
  session: CustomerSession
  filter: CustomerOrderFilter
  limit: number
  cursor: { createdAt: string; id: string } | null
}): Promise<CustomerOrdersPageView> {
  const page = await readCustomerOrderPageRecord({
    customerId: input.session.customerId,
    filter: input.filter,
    limit: input.limit,
    cursor: input.cursor,
  })
  const restaurantById = new Map(page.restaurants.map((restaurant) => [restaurant.id, restaurant]))
  const items = page.orders.flatMap((order): CustomerOrderSummaryView[] => {
    const restaurant = restaurantById.get(order.restaurantId)
    return restaurant ? [toSummary(order, restaurant)] : []
  })
  const last = page.hasMore ? page.orders[Math.min(page.orders.length, input.limit) - 1] : null
  return {
    items,
    nextCursor: last ? encodeCustomerOrderCursor({ createdAt: last.createdAt, id: last.id }) : null,
  }
}

export async function readCustomerOrderDetailView(session: CustomerSession, orderId: string): Promise<CustomerOrderDetailView | null> {
  const result = await readCustomerOrderRecord(session.customerId, orderId)
  if (!result) return null
  const summary = toSummary(result.order, result.restaurant)
  return {
    ...summary,
    items: projectCustomerOrderLines(result.order.items),
    payment: result.order.paidAt ? {
      label: customerPaymentLabel(result.order.paymentMethod),
      paidAt: result.order.paidAt,
    } : null,
    savings: customerOrderSavings(result.order.discountBreakdown),
    cancellationReason: result.order.cancelReason?.trim().slice(0, 200) || null,
  }
}

export async function readCustomerFavoritesView(
  session: CustomerSession,
  restaurantId?: string,
): Promise<CustomerFavoritesView> {
  const records = await readCustomerFavorites({ customerId: session.customerId, ...(restaurantId ? { restaurantId } : {}) })
  return {
    items: records.map((record) => ({
      restaurant: {
        slug: record.restaurantSlug,
        name: record.restaurantName,
        logoUrl: record.restaurantLogoUrl,
      },
      item: {
        id: record.menuItemId,
        name: record.menuItemName,
        description: record.menuItemDescription,
        price: record.menuItemPrice,
        imageUrl: record.menuItemImageUrl,
      },
      createdAt: record.createdAt,
    })),
  }
}

export async function addCustomerFavorites(
  session: CustomerSession,
  restaurantId: string,
  menuItemIds: string[],
): Promise<CustomerFavoritesView> {
  await putCustomerFavorites({ customerId: session.customerId, restaurantId, menuItemIds })
  return readCustomerFavoritesView(session, restaurantId)
}

export async function removeCustomerFavorite(
  session: CustomerSession,
  restaurantId: string,
  menuItemId: string,
): Promise<CustomerFavoritesView> {
  await deleteCustomerFavorite({ customerId: session.customerId, restaurantId, menuItemId })
  return readCustomerFavoritesView(session, restaurantId)
}

export async function readCustomerReorderPreviewView(
  session: CustomerSession,
  orderId: string,
): Promise<CustomerReorderPreviewView | null> {
  const preview = await previewCustomerOrderReorder({ customerId: session.customerId, orderId })
  if (!preview) return null
  return {
    orderId: preview.orderId,
    restaurant: { slug: preview.restaurant.slug, name: preview.restaurant.name, logoUrl: null },
    originalTotal: preview.originalTotal,
    currentSubtotal: preview.currentSubtotal,
    canApply: preview.lines.some((line) => line.cartLine !== null),
    lines: preview.lines,
  }
}

function toSummary(order: CustomerOrderRecord, restaurant: CustomerOrderRestaurantRecord): CustomerOrderSummaryView {
  const lines = projectCustomerOrderLines(order.items)
  return {
    id: order.id,
    restaurant: { slug: restaurant.slug, name: restaurant.name, logoUrl: restaurant.logoUrl },
    placedAt: order.createdAt,
    updatedAt: order.updatedAt,
    total: Math.max(0, Math.round(order.total * 100) / 100),
    status: customerOrderStatus(order.status, order.paidAt),
    paid: Boolean(order.paidAt),
    itemCount: lines.reduce((total, line) => total + line.quantity, 0),
    itemNames: lines.slice(0, 3).map((line) => line.name),
  }
}

/** Day and month only; null when the customer has no link to this restaurant yet. */
export async function readCustomerBirthdayView(session: CustomerSession, restaurantId: string): Promise<{ month: number; day: number } | null | 'unlinked'> {
  const { linked, birthday } = await readCustomerOwnBirthday(restaurantId, session.customerId)
  if (!linked) return 'unlinked'
  return birthday ? { month: birthday.month, day: birthday.day } : null
}

export async function saveCustomerBirthday(session: CustomerSession, input: { restaurantId: string; month: number | null; day: number | null }): Promise<boolean> {
  if ((input.month === null) !== (input.day === null)) return false
  if (input.month !== null && !isValidBirthday(input.month, input.day!)) return false
  return setCustomerBirthday({ restaurantId: input.restaurantId, customerId: session.customerId, month: input.month, day: input.day, source: 'customer' })
}

/** Unseen automatic rewards from the last two weeks; `markSeen` dismisses them all. */
export function readCustomerRewardNoticeView(session: CustomerSession, restaurantId: string, markSeen: boolean): Promise<CustomerRewardNotice[]> {
  return readCustomerRewardNotices(restaurantId, session.customerId, markSeen)
}

export function readCustomerReviewPromptView(session: CustomerSession, restaurantId: string): Promise<CustomerReviewPrompt | null> {
  return readCustomerReviewPrompt(restaurantId, session.customerId)
}

/** Stars (or null for "not now") and, for 1-3 stars, a note to the business. */
export function saveCustomerFeedback(session: CustomerSession, input: { restaurantId: string; visitKey: string; rating: number | null; comment: string | null }): Promise<'saved' | 'refused'> {
  return submitCustomerFeedback({ ...input, customerId: session.customerId })
}
