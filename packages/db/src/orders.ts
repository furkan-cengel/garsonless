import { createServiceClient } from './client'
import type { Json } from './types.gen'
import type { OrderStatus } from './enums'
import { computeOrderDiscount, type OrderLineInput } from './loyalty'
import { resolveComboPriceOverrides, type ComboCatalogItem } from './combo-order-pricing'
import { resolveDiscountBadgePriceOverrides } from './discount-badge-order-pricing'
import {
  buildOrderLineSnapshot,
  type OrderLineSnapshot,
  type OrderLineStationSnapshot,
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
  productNote?: string
  recommendationSourceItemId?: string
  name?: string
  price?: number
  modifiersPriceDelta?: number
  combo?: {
    instanceId: string
    sectionInstanceId: string
    comboIndex: number
  }
  promotion?: {
    sectionInstanceId: string
    kind: 'discount-badge' | 'daily-special'
  }
}

export interface CreateOrderInput {
  restaurantId: string
  tableId: string | null
  sessionId: string
  /** Client-stable key: retries return the original order instead of duplicating it. */
  requestId: string
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
type CategoryForOrder = { id: string; vat_rate: number | null; kitchen_station_id: string | null }
type MenuItemRowForOrder = Omit<ResolvableMenuItem, 'vat_rate' | 'kitchenStation'> & {
  category_id: string
  vat_rate: number | null
  kitchen_station_id: string | null
}
type KitchenStationForOrder = OrderLineStationSnapshot & { is_active: boolean; position: number }
function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

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
  | { ok: true; snapshots: OrderLineSnapshot[]; discountLines: OrderLineInput[]; loyaltyStackingAllowed: boolean }
  | { ok: false; error: string }
> {
  const supabase = createServiceClient()
  const { data: categories, error: categoryError } = await supabase
    .from('menu_categories')
    .select('id, vat_rate, kitchen_station_id')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
  if (categoryError) return { ok: false, error: 'Failed to resolve menu' }

  const categoryRows = (categories ?? []) as CategoryForOrder[]
  const categoryIds = categoryRows.map((row) => row.id)
  const categoryVatById = new Map(categoryRows.map((row) => [row.id, row.vat_rate]))
  const categoryStationById = new Map(categoryRows.map((row) => [row.id, row.kitchen_station_id]))
  const itemIds = [...new Set(inputLines.map((line) => line.itemId))]
  if (categoryIds.length === 0 || itemIds.length === 0) {
    return { ok: false, error: 'Menu item not found' }
  }
  const { data: stations, error: stationsError } = await supabase
    .from('kitchen_stations')
    .select('id, name, color, is_active, position')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .order('position')
  if (stationsError) return { ok: false, error: 'Failed to resolve kitchen stations' }
  const stationById = new Map(
    ((stations ?? []) as KitchenStationForOrder[]).map((station) => [
      station.id,
      { id: station.id, name: station.name, color: station.color },
    ]),
  )

  const { data, error } = await supabase
    .from('menu_items')
    .select('id, category_id, name, price, vat_rate, kitchen_station_id, is_available, ingredients, energy_kcal, may_contain_allergens, contains_allergens, contains_alcohol, contains_pork, modifier_groups')
    .in('id', itemIds)
    .in('category_id', categoryIds)
    .is('deleted_at', null)
  if (error) return { ok: false, error: 'Failed to resolve menu' }

  const byId = new Map(
    ((data ?? []) as MenuItemRowForOrder[]).map((item): [string, MenuItemForOrder] => [
      item.id,
      {
        ...item,
        vat_rate: item.vat_rate ?? categoryVatById.get(item.category_id) ?? null,
        kitchenStation: stationById.get(item.kitchen_station_id ?? categoryStationById.get(item.category_id) ?? '') ?? null,
      },
    ]),
  )

  const recommendationLines = inputLines.filter(
    (line): line is CreateOrderLine & { recommendationSourceItemId: string } => Boolean(line.recommendationSourceItemId),
  )
  const recommendationKeys = new Set<string>()
  if (recommendationLines.length > 0) {
    for (const line of recommendationLines) {
      if (line.recommendationSourceItemId === line.itemId) {
        return { ok: false, error: 'Geçersiz ürün önerisi.' }
      }
    }
    const { data: recommendationRows, error: recommendationError } = await supabase
      .from('menu_item_recommendations')
      .select('source_item_id, recommended_item_id')
      .eq('restaurant_id', restaurantId)
      .in('source_item_id', [...new Set(recommendationLines.map((line) => line.recommendationSourceItemId))])
      .in('recommended_item_id', [...new Set(recommendationLines.map((line) => line.itemId))])
    if (recommendationError) return { ok: false, error: 'Ürün önerisi doğrulanamadı.' }
    for (const row of recommendationRows ?? []) {
      recommendationKeys.add(`${row.source_item_id}:${row.recommended_item_id}`)
    }
    if (recommendationLines.some((line) => !recommendationKeys.has(`${line.recommendationSourceItemId}:${line.itemId}`))) {
      return { ok: false, error: 'Geçersiz ürün önerisi.' }
    }
  }

  let promotionalPricesByLine = new Map<number, number>()
  let loyaltyStackingAllowed = true
  if (inputLines.some((line) => line.combo && line.promotion)) {
    return { ok: false, error: 'Bir ürün aynı anda birden fazla kampanyaya bağlanamaz.' }
  }
  if (inputLines.some((line) => line.combo || line.promotion)) {
    const [{ data: themeConfig, error: themeError }, { data: comboCatalog, error: comboCatalogError }] = await Promise.all([
      supabase
        .from('theme_configs')
        .select('tokens')
        .eq('restaurant_id', restaurantId)
        .maybeSingle(),
      supabase
        .from('menu_items')
        .select('id, price, position, is_available')
        .in('category_id', categoryIds)
        .is('deleted_at', null),
    ])
    if (themeError || comboCatalogError) return { ok: false, error: 'Kampanya doğrulanamadı.' }
    const tokens = recordValue((themeConfig as { tokens?: unknown } | null)?.tokens) ?? {}
    const catalogItems = (comboCatalog ?? []) as ComboCatalogItem[]
    if (inputLines.some((line) => line.combo)) {
      const comboResolution = resolveComboPriceOverrides({
        lines: inputLines,
        tokens,
        catalogItems,
      })
      if (!comboResolution.ok) return comboResolution
      promotionalPricesByLine = comboResolution.pricesByLine
      loyaltyStackingAllowed = comboResolution.loyaltyStackingAllowed
    }
    if (inputLines.some((line) => line.promotion)) {
      const promotionResolution = resolveDiscountBadgePriceOverrides({
        lines: inputLines,
        tokens,
        catalogItems,
      })
      if (!promotionResolution.ok) return promotionResolution
      for (const [lineIndex, price] of promotionResolution.pricesByLine) {
        promotionalPricesByLine.set(lineIndex, price)
      }
      loyaltyStackingAllowed = loyaltyStackingAllowed && promotionResolution.loyaltyStackingAllowed
    }
  }

  const snapshots: OrderLineSnapshot[] = []
  const discountLines: OrderLineInput[] = []

  for (const [lineIndex, line] of inputLines.entries()) {
    const item = byId.get(line.itemId)
    if (!item) return { ok: false, error: 'Menu item is not available' }
    const built = buildOrderLineSnapshot({
      item,
      quantity: line.quantity,
      selections: incomingSelections(line),
      removedIngredientIds: line.removedIngredientIds ?? [],
      ...(line.productNote !== undefined ? { productNote: line.productNote } : {}),
      ...(line.recommendationSourceItemId !== undefined ? { recommendationSourceItemId: line.recommendationSourceItemId } : {}),
    })
    if (!built.ok) return built
    const promotionalPrice = promotionalPricesByLine.get(lineIndex)
    snapshots.push(promotionalPrice === undefined
      ? built.snapshot
      : {
          ...built.snapshot,
          price: promotionalPrice,
          ...(promotionalPrice !== item.price ? { originalPrice: item.price } : {}),
        })
    discountLines.push({
      itemId: item.id,
      quantity: line.quantity,
      modifiersPriceDelta: built.snapshot.modifiersPriceDelta,
      ...(promotionalPrice !== undefined ? { basePriceOverride: promotionalPrice } : {}),
    })
  }

  return { ok: true, snapshots, discountLines, loyaltyStackingAllowed }
}

export async function createOrder(
  input: CreateOrderInput,
): Promise<{ ok: true; orderId: string; breakdown: OrderDiscountBreakdown } | { ok: false; error: string }> {
  const supabase = createServiceClient()

  const existingTable = supabase.from.bind(supabase) as unknown as (name: string) => {
    select: (cols: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: { id: string; discount_breakdown: unknown } | null; error: unknown }>
      }
    }
  }
  const { data: existing } = await existingTable('orders')
    .select('id, discount_breakdown')
    .eq('request_id', input.requestId)
    .maybeSingle()
  if (existing) {
    if (existing.discount_breakdown && typeof existing.discount_breakdown === 'object') {
      return { ok: true, orderId: existing.id, breakdown: existing.discount_breakdown as unknown as OrderDiscountBreakdown }
    }
    return { ok: false, error: 'Order request is still processing' }
  }
  const resolved = await resolveOrderLines(input.restaurantId, input.lines)
  if (!resolved.ok) return resolved

  // Validate table ownership early, but do not open an adisyon until every
  // fallible menu/discount validation has completed.
  if (input.tableId) {
    const { data: table } = await supabase
      .from('tables')
      .select('id')
      .eq('id', input.tableId)
      .eq('restaurant_id', input.restaurantId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!table) return { ok: false, error: 'Table not found for this restaurant' }

  }

  const customerId = input.customerId ?? null

  // SERVER-AUTHORITATIVE discount: subtotal recomputed from DB prices, points
  // validated against the real balance. Client totals are never trusted.
  const discount = await computeOrderDiscount({
    customerId: resolved.loyaltyStackingAllowed ? customerId : null,
    restaurantId: input.restaurantId,
    lines: resolved.discountLines,
    requestedPointsRedeem: input.redeemPoints ?? 0,
    requestedStampClaim: input.redeemStampClaim ?? false,
    requestedCatalogReward: input.catalogItemId ? { itemId: input.catalogItemId } : null,
  })

  // Table orders attach to the table's open session (adisyon); this is delayed
  // until immediately before insertion so invalid carts cannot leave an empty
  // session behind.
  let tableSessionId: string | null = null
  if (input.tableId) {
    const { data: sessionId, error: sessionError } = await supabase.rpc('open_or_get_table_session', {
      p_restaurant_id: input.restaurantId,
      p_table_id: input.tableId,
    })
    if (sessionError || !sessionId) return { ok: false, error: 'Failed to open table session' }
    tableSessionId = sessionId as string
  }

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
      source: 'customer',
      request_id: input.requestId,
      customer_id: customerId,
      customer_tier: discount.customerTierSnapshot,
      items: resolved.snapshots as unknown as Json,
      total: discount.finalTotal, // optimistic; corrected below if redeem clamps
      status: 'pending_approval' as OrderStatus,
    })
    .select('id')
    .single()

  if (error || !data) {
    // A concurrent retry may have won the request-id uniqueness race. Return
    // that completed order instead of surfacing a spurious create failure.
    const { data: winner } = await existingTable('orders')
      .select('id, discount_breakdown')
      .eq('request_id', input.requestId)
      .maybeSingle()
    if (winner?.discount_breakdown && typeof winner.discount_breakdown === 'object') {
      return {
        ok: true,
        orderId: winner.id,
        breakdown: winner.discount_breakdown as unknown as OrderDiscountBreakdown,
      }
    }
    return { ok: false, error: 'Failed to create order' }
  }
  const orderId = data.id

  const catalogActive = discount.catalogPointsCost > 0
  const pointsToDebit = catalogActive ? discount.catalogPointsCost : discount.pointsRedeemed
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: Array<{ final_total: number; discount_breakdown: unknown }> | null; error: { message?: string } | null }>
  const { data: finalized, error: finalizeError } = await rpc('finalize_order_discount', {
    p_order: orderId,
    p_restaurant: input.restaurantId,
    p_customer: customerId,
    p_scope_key: discount.scopeKey,
    p_subtotal: discount.subtotal,
    p_member_pct: discount.memberDiscountPct,
    p_points_requested: catalogActive ? 0 : pointsToDebit,
    p_points_rate: discount.pointsRate,
    p_stamps_requested: discount.stampsConsumed,
    p_stamp_discount: discount.stampDiscountAmount,
    p_reward_item_name: discount.rewardItemName,
    p_catalog_points_cost: discount.catalogPointsCost,
    p_catalog_discount: discount.catalogDiscountAmount,
    p_catalog_item_name: discount.catalogItemName,
    p_preview_total: discount.finalTotal,
  })
  const finalRow = finalized?.[0]
  if (finalizeError || !finalRow?.discount_breakdown) {
    // No ledger debit can survive an RPC failure, but remove the unfinished
    // shell so a retry with the same request id can safely start over.
    await supabase.from('orders').delete().eq('id', orderId)
    return { ok: false, error: 'Failed to finalize order total' }
  }

  return {
    ok: true,
    orderId,
    breakdown: finalRow.discount_breakdown as unknown as OrderDiscountBreakdown,
  }
}
