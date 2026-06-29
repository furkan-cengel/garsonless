import { createServiceClient } from './client'
import type { Json } from './types.gen'
import type { OrderStatus } from './enums'
import { computeOrderDiscount, computeDiscountStack, redeemForOrder, type OrderLineInput } from './loyalty'
import {
  buildOrderLineSnapshot,
  type OrderLineSnapshot,
  type ResolvableMenuItem,
  type SelectedMenuModifier,
} from './menu-domain'

/** Legacy display/money fields are accepted during rollout but ignored. */
export interface CreateOrderLine {
  itemId: string
  quantity: number
  modifiers?: unknown
  selectedModifiers?: SelectedMenuModifier[]
  removedIngredientIds?: string[]
  name?: string
  price?: number
  modifiersPriceDelta?: number
}

export interface CreateOrderInput {
  restaurantId: string
  tableId: string | null
  sessionId: string
  lines: CreateOrderLine[]
  /** Set when the order is placed by a verified member (else guest → null). */
  customerId?: string | null
  /** Requested points to redeem (member only). Validated + clamped server-side. */
  redeemPoints?: number
  /** Claim one free reward item (3c). Validated + clamped server-side. */
  redeemStampClaim?: boolean
  /** Claim a catalog reward (15c): free unit of this item, paid in points. */
  catalogItemId?: string | null
}

export interface OrderDiscountBreakdown {
  subtotal: number
  memberDiscountAmount: number
  memberDiscountPct: number
  pointsDiscountAmount: number
  pointsRedeemed: number
  stampDiscountAmount: number
  stampsRedeemed: number
  rewardItemName: string | null
  /** Catalog reward (15c): ₺ off (item price) + points actually debited + label. */
  catalogDiscountAmount: number
  catalogPointsRedeemed: number
  catalogItemName: string | null
  finalTotal: number
  /** True if a concurrent redeem clamped the discount below the previewed value. */
  clamped: boolean
}

type OrderResult = { id: string }

type MenuItemForOrder = ResolvableMenuItem

function incomingSelections(line: CreateOrderLine): SelectedMenuModifier[] {
  const value = line.selectedModifiers ?? line.modifiers
  if (!Array.isArray(value)) return []
  return value.flatMap((raw): SelectedMenuModifier[] => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const row = raw as Record<string, unknown>
    const groupId = typeof row['group_id'] === 'string'
      ? row['group_id']
      : typeof row['groupId'] === 'string' ? row['groupId'] : ''
    const optionId = typeof row['option_id'] === 'string'
      ? row['option_id']
      : typeof row['optionId'] === 'string' ? row['optionId'] : ''
    if (!groupId || !optionId) return []
    const quantity = typeof row['quantity'] === 'number' && Number.isFinite(row['quantity'])
      ? Math.max(1, Math.floor(row['quantity']))
      : undefined
    return [{ group_id: groupId, option_id: optionId, ...(quantity ? { quantity } : {}) }]
  })
}

export async function resolveOrderLines(
  restaurantId: string,
  inputLines: CreateOrderLine[],
): Promise<
  | { ok: true; snapshots: OrderLineSnapshot[]; discountLines: OrderLineInput[] }
  | { ok: false; error: string }
> {
  const supabase = createServiceClient()
  const { data: categories, error: categoryError } = await supabase
    .from('menu_categories')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
  if (categoryError) return { ok: false, error: 'Failed to resolve menu' }

  const categoryIds = (categories ?? []).map((row) => row.id)
  const itemIds = [...new Set(inputLines.map((line) => line.itemId))]
  if (categoryIds.length === 0 || itemIds.length === 0) {
    return { ok: false, error: 'Menu item not found' }
  }
  const { data, error } = await supabase
    .from('menu_items')
    .select('id, name, price, is_available, ingredients, energy_kcal, may_contain_allergens, contains_allergens, contains_alcohol, contains_pork, modifier_groups')
    .in('id', itemIds)
    .in('category_id', categoryIds)
    .is('deleted_at', null)
  if (error) return { ok: false, error: 'Failed to resolve menu' }

  const byId = new Map(
    ((data ?? []) as MenuItemForOrder[]).map((item) => [item.id, item]),
  )
  const snapshots: OrderLineSnapshot[] = []
  const discountLines: OrderLineInput[] = []

  for (const line of inputLines) {
    const item = byId.get(line.itemId)
    if (!item) return { ok: false, error: 'Menu item is not available' }
    const built = buildOrderLineSnapshot({
      item,
      quantity: line.quantity,
      selections: incomingSelections(line),
      removedIngredientIds: line.removedIngredientIds ?? [],
    })
    if (!built.ok) return built
    snapshots.push(built.snapshot)
    discountLines.push({
      itemId: item.id,
      quantity: line.quantity,
      modifiersPriceDelta: built.snapshot.modifiersPriceDelta,
    })
  }

  return { ok: true, snapshots, discountLines }
}

export async function createOrder(
  input: CreateOrderInput,
): Promise<{ ok: true; orderId: string; breakdown: OrderDiscountBreakdown } | { ok: false; error: string }> {
  const supabase = createServiceClient()
  const resolved = await resolveOrderLines(input.restaurantId, input.lines)
  if (!resolved.ok) return resolved

  // Table orders attach to the table's open session (adisyon); the RPC opens
  // one lazily on first order and resolves concurrent-open races atomically.
  let tableSessionId: string | null = null
  if (input.tableId) {
    const { data: table } = await supabase
      .from('tables')
      .select('id')
      .eq('id', input.tableId)
      .eq('restaurant_id', input.restaurantId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!table) return { ok: false, error: 'Table not found for this restaurant' }

    const { data: sessionId, error: sessionError } = await supabase.rpc('open_or_get_table_session', {
      p_restaurant_id: input.restaurantId,
      p_table_id: input.tableId,
    })
    if (sessionError || !sessionId) {
      return { ok: false, error: 'Failed to open table session' }
    }
    tableSessionId = (sessionId as string | null) ?? null
  }

  const customerId = input.customerId ?? null

  // SERVER-AUTHORITATIVE discount: subtotal recomputed from DB prices, points
  // validated against the real balance. Client totals are never trusted.
  const discount = await computeOrderDiscount({
    customerId,
    restaurantId: input.restaurantId,
    lines: resolved.discountLines,
    requestedPointsRedeem: input.redeemPoints ?? 0,
    requestedStampClaim: input.redeemStampClaim ?? false,
    requestedCatalogReward: input.catalogItemId ? { itemId: input.catalogItemId } : null,
  })

  // Type-cast required: @supabase/supabase-js v2 resolves insert() as never[]
  // cross-package under strict TypeScript (purely a TS limitation).
  const builder = supabase.from('orders') as unknown as {
    insert: (row: Record<string, unknown>) => {
      select: (cols: string) => {
        single: () => Promise<{ data: OrderResult | null; error: unknown }>
      }
    }
  }

  const { data, error } = await builder
    .insert({
      restaurant_id: input.restaurantId,
      table_id: input.tableId,
      table_session_id: tableSessionId,
      session_id: input.sessionId,
      customer_id: customerId,
      customer_tier: discount.customerTierSnapshot,
      items: resolved.snapshots as unknown as Json,
      total: discount.finalTotal, // optimistic; corrected below if redeem clamps
      status: 'pending_approval' as OrderStatus,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, error: 'Failed to create order' }
  }
  const orderId = data.id

  let memberDiscountAmount = discount.memberDiscountAmount
  let pointsRedeemed = discount.pointsRedeemed
  let pointsDiscountAmount = discount.pointsDiscountAmount
  let stampDiscountAmount = discount.stampDiscountAmount
  let stampsRedeemed = discount.stampsConsumed
  let catalogDiscountAmount = discount.catalogDiscountAmount
  let catalogPointsRedeemed = discount.catalogPointsCost
  let finalTotal = discount.finalTotal
  let clamped = false

  // either/or: a catalog reward uses the points slot for an EXACT (all-or-nothing)
  // debit; otherwise the points slot is free-form points-as-₺ (partial, whole-₺).
  const catalogActive = discount.catalogPointsCost > 0
  const pointsToDebit = catalogActive ? discount.catalogPointsCost : discount.pointsRedeemed

  // Commit the redemption debit (atomic, double-spend-safe). May clamp under
  // concurrency → recompute the WHOLE stack from the ACTUAL debits (a clamped
  // free-item claim changes the member-% base, so re-stack rather than patch).
  if (customerId && discount.scopeKey && (pointsToDebit > 0 || discount.stampsConsumed > 0)) {
    const { pointsDebited, stampsDebited } = await redeemForOrder({
      customerId,
      scopeKey: discount.scopeKey,
      restaurantId: input.restaurantId,
      orderId,
      points: pointsToDebit,
      stamps: discount.stampsConsumed,
      pointsRate: discount.pointsRate,
      pointsExact: catalogActive, // catalog = all-or-nothing on the exact pointCost
    })
    const actualStamp = stampsDebited > 0 ? discount.stampDiscountAmount : 0
    // Catalog all-or-nothing: free item stands only if the full pointCost debited.
    const catalogClaimed = catalogActive && pointsDebited >= discount.catalogPointsCost
    const actualCatalog = catalogClaimed ? discount.catalogDiscountAmount : 0
    const reStack = computeDiscountStack({
      subtotal: discount.subtotal,
      stampDiscountAmount: actualStamp,
      catalogDiscountAmount: actualCatalog,
      memberPct: discount.memberDiscountPct,
      // points-as-₺ re-stack only when no catalog reward; catalog points don't feed here.
      requestedPoints: catalogActive ? 0 : pointsDebited,
      pointsBalance: catalogActive ? 0 : pointsDebited,
      pointsRate: discount.pointsRate,
    })
    memberDiscountAmount = reStack.memberDiscountAmount
    pointsDiscountAmount = reStack.pointsDiscountAmount
    pointsRedeemed = catalogActive ? 0 : pointsDebited
    stampDiscountAmount = reStack.stampDiscountAmount
    stampsRedeemed = stampsDebited
    catalogDiscountAmount = reStack.catalogDiscountAmount
    catalogPointsRedeemed = catalogClaimed ? pointsDebited : 0
    finalTotal = reStack.finalTotal
    if (reStack.finalTotal !== discount.finalTotal) {
      clamped = true
      const upd = supabase.from('orders') as unknown as {
        update: (row: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> }
      }
      await upd.update({ total: reStack.finalTotal }).eq('id', orderId)
    }
  }

  return {
    ok: true,
    orderId,
    breakdown: {
      subtotal: discount.subtotal,
      memberDiscountAmount,
      memberDiscountPct: discount.memberDiscountPct,
      pointsDiscountAmount,
      pointsRedeemed,
      stampDiscountAmount,
      stampsRedeemed,
      rewardItemName: discount.rewardItemName,
      catalogDiscountAmount,
      catalogPointsRedeemed,
      catalogItemName: discount.catalogItemName,
      finalTotal,
      clamped,
    },
  }
}
