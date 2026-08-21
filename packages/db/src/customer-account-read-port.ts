import { computeTier, loyaltyScopeKey, readLoyaltyConfig } from '@garsonless/domain/loyalty'
import { createServiceClient } from './client'
import { canRestaurantUseFeature } from './feature-entitlement-port'

interface CustomerAccountRecord {
  name: string | null
  createdAt: string
  loyalty: CustomerAccountLoyaltyRecord[]
  consents: CustomerAccountConsentRecord[]
  deletionRequest: CustomerDeletionRequestRecord | null
}

interface CustomerAccountLoyaltyRecord {
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  restaurantLogoUrl: string | null
  points: number
  stamps: number
  stampGoal: number
  stampRewardText: string
  stampUnlocked: boolean
  pointsEnabled: boolean
  stampsEnabled: boolean
  tier: { name: string; color: string }
  nextTier: { name: string; minimumPoints: number } | null
  tierProgress: number
  lifetimePoints: number
}

interface CustomerAccountConsentRecord {
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  contactData: boolean
  marketing: boolean
}

interface CustomerDeletionRequestRecord {
  id: string
  status: string
  requestedAt: string
}

export interface CustomerLoyaltyAggregateRecord {
  restaurantId: string
  scopeKey: string
  points: number
  stamps: number
  lifetimePoints: number
  visits: number
  latestActivityAt: string | null
}

export interface CustomerLoyaltyActivityRecord {
  id: string
  type: 'points' | 'stamp' | 'visit'
  direction: 'earn' | 'redeem' | 'refund' | 'reversal'
  delta: number
  reason: string
  createdAt: string
}

interface CustomerLoyaltyActivityCursor {
  createdAt: string
  id: string
}

type ServiceRpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown
  error: { message: string } | null
}>

export interface CustomerOrderRecord {
  id: string
  restaurantId: string
  createdAt: string
  updatedAt: string
  status: string
  paidAt: string | null
  paymentMethod: string | null
  total: number
  items: unknown
  discountBreakdown: unknown
  cancelReason: string | null
}

export interface CustomerOrderRestaurantRecord {
  id: string
  slug: string
  name: string
  logoUrl: string | null
}

interface CustomerOrderPageRecord {
  orders: CustomerOrderRecord[]
  restaurants: CustomerOrderRestaurantRecord[]
  hasMore: boolean
}

interface CustomerOrderCursor {
  createdAt: string
  id: string
}

type CustomerOrderFilter = 'all' | 'active' | 'past'

/** Service-role account snapshot. The caller supplies a customer id resolved
 * from the trusted menu session; no browser-controlled identity is accepted. */
export async function readCustomerAccountRecord(customerId: string): Promise<CustomerAccountRecord | null> {
  const service = createServiceClient()
  const rpc = service.rpc.bind(service) as unknown as ServiceRpc
  const privacyTable = service.from('customer_privacy_requests' as never) as unknown as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          order: (column: string, options: { ascending: boolean }) => {
            limit: (count: number) => Promise<{ data: unknown; error: { message: string } | null }>
          }
        }
      }
    }
  }
  const [
    { data: customer, error: customerError },
    { data: links, error: linksError },
    aggregateResult,
    { data: consentRows, error: consentError },
    privacyResult,
  ] = await Promise.all([
    service.from('customers').select('name, created_at').eq('id', customerId).is('merged_at', null).maybeSingle(),
    service.from('customer_restaurants').select('restaurant_id').eq('customer_id', customerId),
    rpc('get_customer_loyalty_aggregates', { p_customer_id: customerId }),
    service.from('customer_consents')
      .select('restaurant_id, consent_type, granted_at, revoked_at')
      .eq('customer_id', customerId),
    privacyTable.select('id, status, requested_at')
      .eq('customer_id', customerId)
      .eq('request_type', 'delete')
      .order('requested_at', { ascending: false })
      .limit(1),
  ])
  if (customerError || linksError || aggregateResult.error || consentError || privacyResult.error) {
    throw new Error('customer_account_read_failed')
  }
  if (!customer) return null

  const aggregates = ((aggregateResult.data ?? []) as Array<{
    restaurant_id: string
    scope_key: string
    points: number
    stamps: number
    lifetime_points: number
    visits: number
    latest_activity_at: string | null
  }>).map(toLoyaltyAggregateRecord)
  const consentList = (consentRows ?? []) as Array<{
    restaurant_id: string
    consent_type: string
    granted_at: string | null
    revoked_at: string | null
  }>
  const restaurantIds = [...new Set([
    ...((links ?? []) as Array<{ restaurant_id: string }>).map((row) => row.restaurant_id),
    ...aggregates.map((row) => row.restaurantId),
    ...consentList.map((row) => row.restaurant_id),
  ])]

  if (restaurantIds.length === 0) {
    return {
      name: customer.name,
      createdAt: customer.created_at,
      loyalty: [],
      consents: [],
      deletionRequest: toDeletionRequest(privacyResult.data),
    }
  }

  const { data: restaurants, error: restaurantError } = await service
    .from('restaurants')
    .select('id, slug, name, logo_url, settings, plan')
    .in('id', restaurantIds)
    .is('deleted_at', null)
  if (restaurantError) throw new Error('customer_account_restaurants_failed')

  const loyalty = await Promise.all(((restaurants ?? []) as Array<{
    id: string
    slug: string
    name: string
    logo_url: string | null
    settings: unknown
    plan: string
  }>).map(async (restaurant): Promise<CustomerAccountLoyaltyRecord | null> => {
    const entitled = await canRestaurantUseFeature({
      restaurantId: restaurant.id,
      plan: restaurant.plan,
      feature: 'loyalty',
    })
    if (!entitled) return null
    const config = readLoyaltyConfig(restaurant.settings as Record<string, unknown> | null)
    if (!config || (!config.points_enabled && !config.stamp_enabled)) return null
    const scopeKey = loyaltyScopeKey(config, restaurant.id)
    const scoped = aggregates.filter((row) => row.scopeKey === scopeKey)
    const points = scoped.reduce((total, row) => total + row.points, 0)
    const stamps = scoped.reduce((total, row) => total + row.stamps, 0)
    const lifetimePoints = scoped.reduce((total, row) => total + row.lifetimePoints, 0)
    const tier = computeTier(lifetimePoints, config.tiers)
    return {
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
      restaurantName: restaurant.name,
      restaurantLogoUrl: restaurant.logo_url,
      points: Math.max(0, points),
      stamps: Math.max(0, stamps),
      stampGoal: config.stamp_goal,
      stampRewardText: config.stamp_reward_text,
      stampUnlocked: config.stamp_enabled && config.stamp_goal > 0 && stamps >= config.stamp_goal,
      pointsEnabled: config.points_enabled,
      stampsEnabled: config.stamp_enabled,
      tier: { name: tier.tier.name, color: tier.tier.color },
      nextTier: tier.nextTier ? { name: tier.nextTier.name, minimumPoints: tier.nextTier.min } : null,
      tierProgress: tier.tierProgress,
      lifetimePoints,
    }
  }))

  return {
    name: customer.name,
    createdAt: customer.created_at,
    loyalty: loyalty.filter((value): value is CustomerAccountLoyaltyRecord => value !== null),
    consents: ((restaurants ?? []) as Array<{ id: string; slug: string; name: string }>).map((restaurant) => ({
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
      restaurantName: restaurant.name,
      contactData: consentList.some((row) => row.restaurant_id === restaurant.id
        && row.consent_type === 'contact_data' && Boolean(row.granted_at) && !row.revoked_at),
      marketing: consentList.some((row) => row.restaurant_id === restaurant.id
        && row.consent_type === 'marketing' && Boolean(row.granted_at) && !row.revoked_at),
    })),
    deletionRequest: toDeletionRequest(privacyResult.data),
  }
}

export async function readCustomerLoyaltyAggregates(customerId: string): Promise<CustomerLoyaltyAggregateRecord[]> {
  const service = createServiceClient()
  const rpc = service.rpc.bind(service) as unknown as ServiceRpc
  const { data, error } = await rpc('get_customer_loyalty_aggregates', { p_customer_id: customerId })
  if (error) throw new Error('customer_loyalty_aggregate_failed')
  return ((data ?? []) as Array<{
    restaurant_id: string
    scope_key: string
    points: number
    stamps: number
    lifetime_points: number
    visits: number
    latest_activity_at: string | null
  }>).map(toLoyaltyAggregateRecord)
}

export async function readCustomerLoyaltyActivityPageRecord(input: {
  customerId: string
  restaurantId: string
  scopeKey: string
  limit: number
  cursor: CustomerLoyaltyActivityCursor | null
}): Promise<{ items: CustomerLoyaltyActivityRecord[]; nextCursor: CustomerLoyaltyActivityCursor | null }> {
  const service = createServiceClient()
  const rpc = service.rpc.bind(service) as unknown as ServiceRpc
  const { data, error } = await rpc('get_customer_loyalty_activity_page', {
    p_customer_id: input.customerId,
    p_restaurant_id: input.restaurantId,
    p_scope_key: input.scopeKey,
    p_before_at: input.cursor?.createdAt ?? null,
    p_before_id: input.cursor?.id ?? null,
    p_limit: input.limit,
  })
  if (error) throw new Error('customer_loyalty_activity_failed')
  const rows = ((data ?? []) as Array<{
    event_id: string
    loyalty_type: string
    direction: string
    delta: number
    reason: string
    event_at: string
  }>).flatMap((row): CustomerLoyaltyActivityRecord[] => {
    if (!['points', 'stamp', 'visit'].includes(row.loyalty_type)
        || !['earn', 'redeem', 'refund', 'reversal'].includes(row.direction)) return []
    return [{
      id: row.event_id,
      type: row.loyalty_type as CustomerLoyaltyActivityRecord['type'],
      direction: row.direction as CustomerLoyaltyActivityRecord['direction'],
      delta: Number(row.delta) || 0,
      reason: row.reason,
      createdAt: row.event_at,
    }]
  })
  const items = rows.slice(0, input.limit)
  const last = rows.length > input.limit ? items[items.length - 1] : null
  return { items, nextCursor: last ? { createdAt: last.createdAt, id: last.id } : null }
}

export async function readCustomerRestaurantLoyaltyActivityPageRecord(input: {
  customerId: string
  restaurantId: string
  limit: number
  cursor: CustomerLoyaltyActivityCursor | null
}): Promise<{ items: CustomerLoyaltyActivityRecord[]; nextCursor: CustomerLoyaltyActivityCursor | null }> {
  const { data: restaurant, error } = await createServiceClient()
    .from('restaurants')
    .select('settings, plan')
    .eq('id', input.restaurantId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !restaurant) throw new Error('customer_loyalty_restaurant_failed')
  if (!await canRestaurantUseFeature({
    restaurantId: input.restaurantId,
    plan: restaurant.plan,
    feature: 'loyalty',
  })) return { items: [], nextCursor: null }
  const config = readLoyaltyConfig(restaurant.settings as Record<string, unknown> | null)
  if (!config) return { items: [], nextCursor: null }
  return readCustomerLoyaltyActivityPageRecord({
    ...input,
    scopeKey: loyaltyScopeKey(config, input.restaurantId),
  })
}

function toLoyaltyAggregateRecord(row: {
  restaurant_id: string
  scope_key: string
  points: number
  stamps: number
  lifetime_points: number
  visits: number
  latest_activity_at: string | null
}): CustomerLoyaltyAggregateRecord {
  return {
    restaurantId: row.restaurant_id,
    scopeKey: row.scope_key,
    points: Number(row.points) || 0,
    stamps: Number(row.stamps) || 0,
    lifetimePoints: Number(row.lifetime_points) || 0,
    visits: Number(row.visits) || 0,
    latestActivityAt: row.latest_activity_at,
  }
}

function toDeletionRequest(value: unknown): CustomerDeletionRequestRecord | null {
  const row = Array.isArray(value) ? value[0] as Record<string, unknown> | undefined : undefined
  return row && typeof row['id'] === 'string' && typeof row['status'] === 'string'
    && typeof row['requested_at'] === 'string'
    ? { id: row['id'], status: row['status'], requestedAt: row['requested_at'] }
    : null
}

export async function updateCustomerAccountName(customerId: string, name: string): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from('customers')
    .update({ name })
    .eq('id', customerId)
    .is('merged_at', null)
    .select('id')
    .maybeSingle()
  if (error) throw new Error('customer_account_update_failed')
  return Boolean(data)
}

export async function readCustomerOrderPageRecord(input: {
  customerId: string
  filter: CustomerOrderFilter
  limit: number
  cursor: CustomerOrderCursor | null
}): Promise<CustomerOrderPageRecord> {
  let query = createServiceClient()
    .from('orders')
    .select('id, restaurant_id, created_at, updated_at, status, paid_at, payment_method, total, items, discount_breakdown, cancel_reason')
    .eq('customer_id', input.customerId)
    .is('deleted_at', null)

  if (input.filter === 'active') {
    query = query.is('paid_at', null).neq('status', 'cancelled').neq('status', 'paid')
  } else if (input.filter === 'past') {
    query = query.or('paid_at.not.is.null,status.eq.cancelled,status.eq.paid')
  }
  if (input.cursor) {
    query = query.or(`created_at.lt.${input.cursor.createdAt},and(created_at.eq.${input.cursor.createdAt},id.lt.${input.cursor.id})`)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(input.limit + 1)
  if (error) throw new Error('customer_orders_read_failed')

  const rows = ((data ?? []) as Array<{
    id: string
    restaurant_id: string
    created_at: string
    updated_at: string
    status: string
    paid_at: string | null
    payment_method: string | null
    total: number
    items: unknown
    discount_breakdown: unknown
    cancel_reason: string | null
  }>).map(toCustomerOrderRecord)
  const orders = rows.slice(0, input.limit)
  const restaurants = await readOrderRestaurants([...new Set(orders.map((order) => order.restaurantId))])
  return { orders, restaurants, hasMore: rows.length > input.limit }
}

export async function readCustomerOrderRecord(customerId: string, orderId: string): Promise<{
  order: CustomerOrderRecord
  restaurant: CustomerOrderRestaurantRecord
} | null> {
  const { data, error } = await createServiceClient()
    .from('orders')
    .select('id, restaurant_id, created_at, updated_at, status, paid_at, payment_method, total, items, discount_breakdown, cancel_reason')
    .eq('id', orderId)
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error('customer_order_read_failed')
  if (!data) return null
  const order = toCustomerOrderRecord(data)
  const [restaurant] = await readOrderRestaurants([order.restaurantId])
  return restaurant ? { order, restaurant } : null
}

function toCustomerOrderRecord(row: {
  id: string
  restaurant_id: string
  created_at: string
  updated_at: string
  status: string
  paid_at: string | null
  payment_method: string | null
  total: number
  items: unknown
  discount_breakdown: unknown
  cancel_reason: string | null
}): CustomerOrderRecord {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    paidAt: row.paid_at,
    paymentMethod: row.payment_method,
    total: row.total,
    items: row.items,
    discountBreakdown: row.discount_breakdown,
    cancelReason: row.cancel_reason,
  }
}

async function readOrderRestaurants(ids: string[]): Promise<CustomerOrderRestaurantRecord[]> {
  if (ids.length === 0) return []
  const { data, error } = await createServiceClient()
    .from('restaurants')
    .select('id, slug, name, logo_url')
    .in('id', ids)
    .is('deleted_at', null)
  if (error) throw new Error('customer_order_restaurants_failed')
  return ((data ?? []) as Array<{ id: string; slug: string; name: string; logo_url: string | null }>).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url,
  }))
}
