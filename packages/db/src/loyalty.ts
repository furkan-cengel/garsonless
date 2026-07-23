// Loyalty earning ledger, balances, redemption and consent-side economics.
// All service-role only. Earning is computed from the order's OWN
// DB data (never client input), so points/stamps can't be inflated.

import { createServiceClient } from './client'
import { canRestaurantUseFeature } from './feature-entitlement-port'
import {
  applyBonusStamps,
  computeDiscountStack,
  computePointsDelta,
  computeStampEarn,
  computeTier,
  effectivePct,
  loyaltyScopeKey,
  readLoyaltyConfig,
  type LoyaltyActivity,
  type LoyaltyTier,
  type MemberBalances,
  type RawLoyaltySettings,
} from '@garsonless/domain/loyalty'
import { snapshotOrderCustomerTier, type OrderCustomerTierSnapshot } from './order-client'

// ─── Earning ledger + balances ───────────────────────────────────────────────────

// Pure loyalty economics live in @garsonless/domain/loyalty. This module owns
// only service-role persistence and orchestration helpers.
type OrderItemLine = { itemId?: unknown; quantity?: unknown }
type RestaurantLoyaltyRecord = { settings: RawLoyaltySettings; plan: unknown }

/**
 * Configuration may remain stored after a downgrade, but it must never remain
 * executable. Keeping the entitlement at this service-role boundary prevents
 * an old settings JSONB document from minting or redeeming loyalty value.
 */
async function readEntitledLoyaltyConfig(row: unknown, restaurantId: string) {
  const restaurant = row as RestaurantLoyaltyRecord | null
  if (!restaurant || !await canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'loyalty' })) return null
  return readLoyaltyConfig(restaurant.settings ?? null)
}

/** Service-role read for CRM aggregation without N balance queries. */
export async function getLoyaltyScope(restaurantId: string): Promise<{
  scopeKey: string
  tiers: LoyaltyTier[]
  pointsEnabled: boolean
} | null> {
  const { data: restaurant } = await createServiceClient()
    .from('restaurants')
    .select('settings, plan')
    .eq('id', restaurantId)
    .maybeSingle()
  const config = await readEntitledLoyaltyConfig(restaurant, restaurantId)
  if (!config) return null
  return {
    scopeKey: loyaltyScopeKey(config, restaurantId),
    tiers: config.tiers,
    pointsEnabled: config.points_enabled,
  }
}

/**
 * Best-effort loyalty earning. Called AFTER the paid/served write succeeds.
 * NEVER throws — a loyalty failure must not break the order write. Idempotent
 * via unique(order_id, type): paid→served, realtime retries and kitchen
 * re-flips can all call this safely.
 */
export async function earnForOrderStrict(orderId: string, firedTrigger: 'paid' | 'served'): Promise<void> {
  const supabase = createServiceClient()

  // Read the order's OWN data from the DB (never trust client-supplied totals).
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('customer_id, restaurant_id, total, items')
    .eq('id', orderId)
    .maybeSingle()
  if (orderError) throw new Error(orderError.message)
  const order = orderRow as {
    customer_id: string | null
    restaurant_id: string
    total: number
    items: unknown
  } | null
  if (!order || !order.customer_id) return // guest order → no earning

  const { data: restRow, error: restaurantError } = await supabase
    .from('restaurants')
    .select('settings, plan')
    .eq('id', order.restaurant_id)
    .maybeSingle()
  if (restaurantError) throw new Error(restaurantError.message)
  const cfg = await readEntitledLoyaltyConfig(restRow, order.restaurant_id)
  if (!cfg) return
  if (!cfg.stamp_enabled && !cfg.points_enabled) return
  if (cfg.earn_trigger !== firedTrigger) return // only the configured trigger earns

  const scopeKey = loyaltyScopeKey(cfg, order.restaurant_id)

  // 17b: tier perks (points multiplier + bonus stamps) from the customer's
  // PRE-this-order lifetime points — sum of earn-direction points EXCLUDING
  // this order's own earn row, so it's stable across paid→served retries (you
  // earn at the tier you were at before this order).
  const { data: ltRows, error: lifetimeError } = await supabase
    .from('loyalty_transactions')
    .select('delta, order_id')
    .eq('customer_id', order.customer_id)
    .eq('scope_key', scopeKey)
    .eq('type', 'points')
    .eq('direction', 'earn')
  if (lifetimeError) throw new Error(lifetimeError.message)
  let lifetimeBefore = 0
  for (const r of (ltRows as Array<{
    delta: number
    order_id: string | null
  }> | null) ?? []) {
    if (r.order_id !== orderId) lifetimeBefore += r.delta
  }
  const { tier } = computeTier(lifetimeBefore, cfg.tiers)

  // STAMP: per-item — sum quantities of order lines whose menu_item.earns_stamp.
  let stampDelta = 0
  if (cfg.stamp_enabled) {
    const lines = (Array.isArray(order.items) ? order.items : []) as OrderItemLine[]
    const ids = [...new Set(lines.map((l) => (typeof l.itemId === 'string' ? l.itemId : '')).filter(Boolean))]
    if (ids.length > 0) {
      const { data: flaggedRows, error: flaggedError } = await supabase
        .from('menu_items')
        .select('id')
        .in('id', ids)
        .eq('earns_stamp', true)
      if (flaggedError) throw new Error(flaggedError.message)
      const flagged = new Set(((flaggedRows as Array<{ id: string }> | null) ?? []).map((r) => r.id))
      // Did this order claim a free reward unit? A redeem stamp row on the
      // order means yes → that unit must not re-earn (computeStampEarn handles it).
      const { data: redeemRows, error: redeemError } = await supabase
        .from('loyalty_transactions')
        .select('id')
        .eq('order_id', orderId)
        .eq('type', 'stamp')
        .eq('direction', 'redeem')
        .limit(1)
      if (redeemError) throw new Error(redeemError.message)
      const freeClaimed = ((redeemRows as unknown[] | null) ?? []).length > 0
      stampDelta = computeStampEarn(order.items, flagged, cfg.reward_item_id, freeClaimed)
    }
  }
  // 17b: tier bonus stamps — only when the order already earns ≥1 stamp (never
  // mint stamps from nothing), on top of the net positive delta.
  stampDelta = applyBonusStamps(stampDelta, tier.bonusStamps)

  // POINTS: floor(order_total * points_per_lira * tier multiplier) — DB total.
  const pointsDelta = cfg.points_enabled
    ? computePointsDelta(order.total, cfg.points_per_lira, tier.pointsMultiplier)
    : 0

  const rows: Array<Record<string, unknown>> = []
  if (stampDelta > 0)
    rows.push({
      type: 'stamp',
      delta: stampDelta,
      reason: `earn_${firedTrigger}`,
    })
  if (pointsDelta > 0)
    rows.push({
      type: 'points',
      delta: pointsDelta,
      reason: `earn_${firedTrigger}`,
    })
  if (rows.length === 0) return // nothing to credit

  const insert = supabase.from('loyalty_transactions') as unknown as {
    insert: (
      rows: Array<Record<string, unknown>>,
      opts: { onConflict: string; ignoreDuplicates: boolean },
    ) => Promise<{ error: unknown }>
  }
  const { error: insertError } = await insert.insert(
    rows.map((r) => ({
      customer_id: order.customer_id,
      restaurant_id: order.restaurant_id,
      scope_key: scopeKey,
      order_id: orderId,
      direction: 'earn', // earn side; redeem rows use direction='redeem'
      ...r,
    })),
    { onConflict: 'order_id,type,direction', ignoreDuplicates: true }, // idempotent earn
  )
  if (insertError) throw new Error(String((insertError as { message?: unknown }).message ?? insertError))
}

export async function earnForOrder(orderId: string, firedTrigger: 'paid' | 'served'): Promise<void> {
  try {
    await earnForOrderStrict(orderId, firedTrigger)
  } catch (err) {
    // Best-effort: log and swallow. Never break the paid/served write.
    console.error(`[earnForOrder] order=${orderId} trigger=${firedTrigger}:`, err)
  }
}

/** Service-role balance read, scoped to one customer + one restaurant's bucket. */
export async function getMemberBalances(customerId: string, restaurantId: string): Promise<MemberBalances | null> {
  const supabase = createServiceClient()

  const { data: restRow } = await supabase.from('restaurants').select('settings, plan').eq('id', restaurantId).maybeSingle()
  const cfg = await readEntitledLoyaltyConfig(restRow, restaurantId)
  if (!cfg) return null

  const scopeKey = loyaltyScopeKey(cfg, restaurantId)
  const [{ data: customerRow }, { data: txRows }, { data: consentRows }] = await Promise.all([
    supabase.from('customers').select('created_at').eq('id', customerId).maybeSingle(),
    supabase
      .from('loyalty_transactions')
      .select('id, type, delta, direction, reason, created_at')
      .eq('customer_id', customerId)
      .eq('scope_key', scopeKey)
      .order('created_at', { ascending: false }),
    supabase
      .from('customer_consents')
      .select('consent_type, granted_at, revoked_at')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .in('consent_type', ['contact_data', 'marketing']),
  ])
  const customer = customerRow as { created_at: string } | null
  if (!customer) return null
  const consentList =
    (consentRows as Array<{
      consent_type?: string
      granted_at: string | null
      revoked_at: string | null
    }> | null) ?? []
  const consentGiven = consentList.some(
    (row) => row.consent_type === 'contact_data' && row.granted_at && !row.revoked_at,
  )
  const marketingConsentGiven = consentList.some(
    (row) => row.consent_type === 'marketing' && row.granted_at && !row.revoked_at,
  )
  const rows =
    (txRows as Array<{
      id: string
      type: string
      delta: number
      direction: string
      reason: string
      created_at: string
    }> | null) ?? []

  let stamps = 0
  let points = 0 // spendable (earn − redeem)
  let lifetimePoints = 0 // earn only
  let visits = 0
  for (const r of rows) {
    if (r.type === 'stamp') stamps += r.delta
    else if (r.type === 'points') {
      points += r.delta
      if (r.direction === 'earn') lifetimePoints += r.delta
    } else if (r.type === 'visit') visits += r.delta
  }

  const { tier, tierIndex, nextTier, tierProgress } = computeTier(lifetimePoints, cfg.tiers)

  return {
    memberCode: `MSB-${customerId
      .replaceAll('-', '')
      .slice(0, 8)
      .toUpperCase()
      .replace(/(.{4})(.{4})/, '$1-$2')}`,
    joinedAt: customer.created_at,
    stamps,
    points,
    lifetimePoints,
    visits,
    tier,
    tierIndex,
    nextTier,
    tierProgress,
    stampGoal: cfg.stamp_goal,
    stampRewardText: cfg.stamp_reward_text,
    stampUnlocked: cfg.stamp_enabled && cfg.stamp_goal > 0 && stamps >= cfg.stamp_goal,
    stampEnabled: cfg.stamp_enabled,
    pointsEnabled: cfg.points_enabled,
    consentGiven,
    marketingConsentGiven,
    recentActivity: rows.slice(0, 8).flatMap((row): LoyaltyActivity[] => {
      if (row.type !== 'stamp' && row.type !== 'points' && row.type !== 'visit') return []
      if (row.direction !== 'earn' && row.direction !== 'redeem' && row.direction !== 'refund') return []
      return [
        {
          id: row.id,
          type: row.type,
          direction: row.direction,
          delta: row.delta,
          reason: row.reason,
          createdAt: row.created_at,
        },
      ]
    }),
  }
}

/**
 * Credit +1 visit to each DISTINCT member who had a non-cancelled order in a
 * closed table session. Idempotent via unique(session_id, customer_id, type):
 * a session closed once credits each member exactly once, no matter how many
 * times the close path re-fires. Best-effort — NEVER throws (must not block
 * closeTableSession).
 */
export async function creditVisitsForSessionStrict(sessionId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: sessRow, error: sessionError } = await supabase
    .from('table_sessions')
    .select('restaurant_id')
    .eq('id', sessionId)
    .maybeSingle()
  if (sessionError) throw new Error(sessionError.message)
  const session = sessRow as { restaurant_id: string } | null
  if (!session) return

  const { data: restRow, error: restaurantError } = await supabase
    .from('restaurants')
    .select('settings, plan')
    .eq('id', session.restaurant_id)
    .maybeSingle()
  if (restaurantError) throw new Error(restaurantError.message)
  const cfg = await readEntitledLoyaltyConfig(restRow, session.restaurant_id)
  if (!cfg) return
  const scopeKey = loyaltyScopeKey(cfg, session.restaurant_id)

  const { data: orderRows, error: ordersError } = await supabase
    .from('orders')
    .select('customer_id, status')
    .eq('table_session_id', sessionId)
    .is('deleted_at', null)
  if (ordersError) throw new Error(ordersError.message)
  const members = [
    ...new Set(
      (
        (orderRows as Array<{
          customer_id: string | null
          status: string
        }> | null) ?? []
      )
        .filter((o) => o.customer_id && o.status !== 'cancelled')
        .map((o) => o.customer_id as string),
    ),
  ]
  if (members.length === 0) return // guest-only / empty session → no visit

  const insert = supabase.from('loyalty_transactions') as unknown as {
    insert: (
      rows: Array<Record<string, unknown>>,
      opts: { onConflict: string; ignoreDuplicates: boolean },
    ) => Promise<{ error: unknown }>
  }
  const { error: insertError } = await insert.insert(
    members.map((customerId) => ({
      customer_id: customerId,
      restaurant_id: session.restaurant_id,
      scope_key: scopeKey,
      session_id: sessionId,
      type: 'visit',
      delta: 1,
      reason: 'visit',
      direction: 'earn',
    })),
    { onConflict: 'session_id,customer_id,type', ignoreDuplicates: true }, // idempotent per (session, member)
  )
  if (insertError) throw new Error(String((insertError as { message?: unknown }).message ?? insertError))
}

export async function creditVisitsForSession(sessionId: string): Promise<void> {
  try {
    await creditVisitsForSessionStrict(sessionId)
  } catch (err) {
    console.error(`[creditVisitsForSession] session=${sessionId}:`, err)
  }
}

/**
 * Credit the one-time welcome bonus (config welcome_bonus_points) on first
 * verify, scoped to the restaurant's bucket. The read avoids unnecessary
 * writes; the partial unique index on (customer_id, scope_key) for welcome
 * earns is the real duplicate-delivery/race boundary.
 */
export async function creditWelcomeBonusStrict(customerId: string, restaurantId: string): Promise<void> {
  const supabase = createServiceClient()
  const { data: restRow, error: restaurantError } = await supabase
    .from('restaurants')
    .select('settings, plan')
    .eq('id', restaurantId)
    .maybeSingle()
  if (restaurantError) throw new Error(restaurantError.message)
  const cfg = await readEntitledLoyaltyConfig(restRow, restaurantId)
  if (!cfg || cfg.welcome_bonus_points <= 0) return
  const scopeKey = loyaltyScopeKey(cfg, restaurantId)

  const { data: existing, error: existingError } = await supabase
    .from('loyalty_transactions')
    .select('id')
    .eq('customer_id', customerId)
    .eq('scope_key', scopeKey)
    .eq('reason', 'welcome')
    .limit(1)
  if (existingError) throw new Error(existingError.message)
  if (((existing as unknown[] | null) ?? []).length > 0) return // already credited

  const insert = supabase.from('loyalty_transactions') as unknown as {
    insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>
  }
  const { error: insertError } = await insert.insert({
    customer_id: customerId,
    restaurant_id: restaurantId,
    scope_key: scopeKey,
    type: 'points',
    delta: cfg.welcome_bonus_points,
    reason: 'welcome',
    direction: 'earn',
  })
  if (insertError && (insertError as { code?: string }).code !== '23505') {
    throw new Error(String((insertError as { message?: unknown }).message ?? insertError))
  }
}

export async function creditWelcomeBonus(customerId: string, restaurantId: string): Promise<void> {
  try {
    await creditWelcomeBonusStrict(customerId, restaurantId)
  } catch (err) {
    console.error(`[creditWelcomeBonus] customer=${customerId} restaurant=${restaurantId}:`, err)
  }
}

// ─── Phase 3a: redemption / discount engine ─────────────────────────────────────

export interface OrderLineInput {
  itemId: string
  quantity: number
  modifiersPriceDelta: number
}

export interface DiscountResult {
  subtotal: number
  memberDiscountAmount: number
  memberDiscountPct: number
  memberTierName: string | null // 17b: tier driving the discount, for the cart label
  pointsDiscountAmount: number
  pointsRedeemed: number // points to consume (proposed)
  stampDiscountAmount: number
  stampsConsumed: number // stamps to debit when a free item is claimed (= stamp_goal)
  rewardItemName: string | null // stamp-free reward item name, for the breakdown label
  // catalog reward (15c) — free item bought with points from the configured catalog:
  catalogDiscountAmount: number // ₺ off = the catalog item's DB price (one free unit)
  catalogPointsCost: number // EXACT points to debit (all-or-nothing); 0 = no catalog reward
  catalogItemName: string | null // catalog reward item name, for the breakdown label
  catalogItemId: string | null
  finalTotal: number
  // placement internals (not surfaced to the client):
  pointsRate: number
  scopeKey: string | null // null when no loyalty config / no member
  customerTierSnapshot: OrderCustomerTierSnapshot | null
}

/**
 * Server-authoritative discount computation. Subtotal is recomputed from DB
 * `menu_items.price` (NOT client prices); modifier deltas are client-supplied
 * (flagged residual). READ-ONLY — never writes. Used by both the cart preview
 * endpoint and order placement. 3a covers points only (member %=3b, stamp=3c).
 */
export async function computeOrderDiscount(input: {
  customerId: string | null
  restaurantId: string
  lines: OrderLineInput[]
  requestedPointsRedeem?: number
  requestedStampClaim?: boolean
  /** 15c: claim a catalog reward (free unit of this item, paid in points). */
  requestedCatalogReward?: { itemId: string } | null
}): Promise<DiscountResult> {
  const supabase = createServiceClient()

  // Authoritative subtotal from DB base prices (also captures names for labels).
  const ids = [...new Set(input.lines.map((l) => l.itemId).filter(Boolean))]
  const priceById = new Map<string, number>()
  const nameById = new Map<string, string>()
  if (ids.length > 0) {
    const { data } = await supabase.from('menu_items').select('id, price, name').in('id', ids)
    for (const r of (data as Array<{
      id: string
      price: number
      name: string
    }> | null) ?? []) {
      priceById.set(r.id, Number(r.price))
      nameById.set(r.id, r.name)
    }
  }
  let subtotal = 0
  for (const l of input.lines) {
    const base = priceById.get(l.itemId) ?? 0
    subtotal += (base + (Number(l.modifiersPriceDelta) || 0)) * (Number(l.quantity) || 0)
  }
  subtotal = Math.max(0, Math.round(subtotal * 100) / 100)

  const empty: DiscountResult = {
    subtotal,
    memberDiscountAmount: 0,
    memberDiscountPct: 0,
    memberTierName: null,
    pointsDiscountAmount: 0,
    pointsRedeemed: 0,
    stampDiscountAmount: 0,
    stampsConsumed: 0,
    rewardItemName: null,
    catalogDiscountAmount: 0,
    catalogPointsCost: 0,
    catalogItemName: null,
    catalogItemId: null,
    finalTotal: subtotal,
    pointsRate: 1,
    scopeKey: null,
    customerTierSnapshot: null,
  }
  if (!input.customerId) return empty

  const { data: restRow } = await supabase
    .from('restaurants')
    .select('settings, plan')
    .eq('id', input.restaurantId)
    .maybeSingle()
  const cfg = await readEntitledLoyaltyConfig(restRow, input.restaurantId)
  if (!cfg) return empty
  const scopeKey = loyaltyScopeKey(cfg, input.restaurantId)
  const balances = await getMemberBalances(input.customerId, input.restaurantId)
  if (!balances) return { ...empty, scopeKey }

  // STAMP free item (3c): eligible only if a full card is available, a reward
  // item is configured, AND that item is actually in the cart. One free unit
  // (full price) per order. Otherwise the claim is invalid → no discount.
  let stampDiscountAmount = 0
  let stampsConsumed = 0
  let rewardItemName: string | null = null
  if (
    input.requestedStampClaim &&
    cfg.stamp_enabled &&
    cfg.stamp_goal > 0 &&
    cfg.reward_item_id &&
    balances.stamps >= cfg.stamp_goal
  ) {
    const inCart = input.lines.some((l) => l.itemId === cfg.reward_item_id && (Number(l.quantity) || 0) > 0)
    const rewardPrice = priceById.get(cfg.reward_item_id) ?? 0
    if (inCart && rewardPrice > 0) {
      stampDiscountAmount = rewardPrice
      stampsConsumed = cfg.stamp_goal
      rewardItemName = nameById.get(cfg.reward_item_id) ?? null
    }
  }

  // CATALOG reward (15c): redeem points → one free unit of a catalog item.
  // pointCost is re-read SERVER-SIDE from reward_catalog (client never trusted).
  // Eligible only if: points enabled + the itemId is in the catalog + that item
  // is in the cart + spendable points cover the cost. Else clamp to no-claim.
  let catalogDiscountAmount = 0
  let catalogPointsCost = 0
  let catalogItemName: string | null = null
  let catalogItemId: string | null = null
  const reqCatalogId = input.requestedCatalogReward?.itemId ?? null
  if (reqCatalogId && cfg.points_enabled) {
    const entry = cfg.reward_catalog.find((r) => r.itemId === reqCatalogId)
    const inCart = input.lines.some((l) => l.itemId === reqCatalogId && (Number(l.quantity) || 0) > 0)
    const itemPrice = priceById.get(reqCatalogId) ?? 0
    if (entry && inCart && itemPrice > 0 && balances.points >= entry.pointCost) {
      catalogDiscountAmount = itemPrice
      catalogPointsCost = entry.pointCost
      catalogItemName = nameById.get(reqCatalogId) ?? null
      catalogItemId = reqCatalogId
    }
  }

  // EITHER/OR: a catalog reward and free-form points-as-₺ never both apply on one
  // order. When a catalog reward is claimed, points-as-₺ is forced to 0 (the
  // catalog reward IS the points spend this order).
  const requestedPoints = catalogPointsCost > 0 ? 0 : cfg.points_enabled ? (input.requestedPointsRedeem ?? 0) : 0

  // 17b: tier perk discount supersedes the flat member_discount_pct (fallback).
  const memberPct = effectivePct(balances.tier.discountPct, cfg.member_discount_pct)

  // Locked order: stamp-free (3c) → catalog-free (15c) → member/tier % (3b/17b) → points (3a).
  const stack = computeDiscountStack({
    subtotal,
    stampDiscountAmount,
    catalogDiscountAmount,
    memberPct, // tier perk discountPct, else legacy member_discount_pct
    requestedPoints,
    pointsBalance: balances.points,
    pointsRate: cfg.points_redeem_rate,
  })

  return {
    subtotal,
    memberDiscountAmount: stack.memberDiscountAmount,
    memberDiscountPct: memberPct,
    memberTierName: stack.memberDiscountAmount > 0 ? balances.tier.name : null,
    pointsDiscountAmount: stack.pointsDiscountAmount,
    pointsRedeemed: stack.pointsRedeemed,
    stampDiscountAmount: stack.stampDiscountAmount,
    stampsConsumed,
    rewardItemName,
    catalogDiscountAmount: stack.catalogDiscountAmount,
    catalogPointsCost,
    catalogItemName,
    catalogItemId,
    finalTotal: stack.finalTotal,
    pointsRate: cfg.points_redeem_rate,
    scopeKey,
    customerTierSnapshot: snapshotOrderCustomerTier({
      tier: balances.tier,
      tierIndex: balances.tierIndex,
      lifetimePoints: balances.lifetimePoints,
    }),
  }
}

/**
 * Atomic, double-spend-safe redemption debit (calls the redeem_loyalty RPC,
 * which serializes per customer+scope via an advisory lock). Returns the ACTUAL
 * amounts debited — may be less than requested if a concurrent order spent the
 * balance first. Service-role only.
 */
export async function redeemForOrder(params: {
  customerId: string
  scopeKey: string
  restaurantId: string
  orderId: string
  points: number
  stamps: number
  pointsRate: number
  /** 15c: true → all-or-nothing points debit (catalog reward); false → points-as-₺. */
  pointsExact?: boolean
}): Promise<{ pointsDebited: number; stampsDebited: number }> {
  const supabase = createServiceClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('plan')
    .eq('id', params.restaurantId)
    .maybeSingle()
  if (!await canRestaurantUseFeature({
    restaurantId: params.restaurantId,
    plan: (restaurant as { plan?: unknown } | null)?.plan,
    feature: 'loyalty',
  })) {
    return { pointsDebited: 0, stampsDebited: 0 }
  }
  const { data } = await supabase.rpc('redeem_loyalty', {
    p_customer: params.customerId,
    p_scope_key: params.scopeKey,
    p_restaurant: params.restaurantId,
    p_order: params.orderId,
    p_points: params.points,
    p_stamps: params.stamps,
    p_points_rate: params.pointsRate,
    p_points_exact: params.pointsExact ?? false,
  })
  const row = (data as Array<{ points_debited: number; stamps_debited: number }> | null)?.[0]
  return {
    pointsDebited: row?.points_debited ?? 0,
    stampsDebited: row?.stamps_debited ?? 0,
  }
}

export interface LoyaltyRefundResult {
  refundedPoints: number
  refundedStamps: number
  rows: Array<{ type: 'points' | 'stamp'; refunded: number }>
}

/**
 * Reverse loyalty redemption rows when an order is cancelled. The DB RPC writes
 * positive `direction='refund'` ledger rows and uses the existing
 * (order_id,type,direction) key, so repeated cancel/paid/served/status retries
 * cannot double-refund. Refund rows restore spendable balance but do NOT count
 * toward lifetime points because lifetime only sums direction='earn'.
 */
export async function refundCancelledLoyaltyOrderStrict(orderId: string): Promise<LoyaltyRefundResult> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('refund_cancelled_loyalty', {
    p_order: orderId,
  })
  if (error) throw new Error(error.message)
  const rows: LoyaltyRefundResult['rows'] = ((data as Array<{ type: string; refunded: number }> | null) ?? []).flatMap(
    (row) => {
      if ((row.type !== 'points' && row.type !== 'stamp') || row.refunded <= 0) return []
      return [{ type: row.type, refunded: row.refunded }]
    },
  )
  return {
    refundedPoints: rows.filter((row) => row.type === 'points').reduce((sum, row) => sum + row.refunded, 0),
    refundedStamps: rows.filter((row) => row.type === 'stamp').reduce((sum, row) => sum + row.refunded, 0),
    rows,
  }
}

export async function refundCancelledLoyaltyOrder(orderId: string): Promise<LoyaltyRefundResult> {
  try {
    return await refundCancelledLoyaltyOrderStrict(orderId)
  } catch (err) {
    console.error(`[refundCancelledLoyaltyOrder] order=${orderId}:`, err)
    return { refundedPoints: 0, refundedStamps: 0, rows: [] }
  }
}
