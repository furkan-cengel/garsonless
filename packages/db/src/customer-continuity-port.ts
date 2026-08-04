import { randomUUID } from 'node:crypto'
import { buildOrderLineSnapshot, readOrderLineSnapshot } from './menu-domain'
import { createServiceClient } from './client'

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null }
type LooseRpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult> }

function rpcClient(): LooseRpcClient {
  return createServiceClient() as unknown as LooseRpcClient
}

export interface CustomerFavoriteRecord {
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  restaurantLogoUrl: string | null
  menuItemId: string
  menuItemName: string
  menuItemDescription: string | null
  menuItemPrice: number
  menuItemImageUrl: string | null
  createdAt: string
}

export async function readCustomerFavorites(input: {
  customerId: string
  restaurantId?: string
}): Promise<CustomerFavoriteRecord[]> {
  const { data, error } = await rpcClient().rpc('read_customer_favorites', {
    p_customer_id: input.customerId,
    p_restaurant_id: input.restaurantId ?? null,
  })
  if (error || !Array.isArray(data)) throw new Error('customer_favorites_read_failed')
  return data.flatMap((value): CustomerFavoriteRecord[] => {
    const row = value as Record<string, unknown>
    if (
      typeof row['restaurant_id'] !== 'string'
      || typeof row['restaurant_slug'] !== 'string'
      || typeof row['restaurant_name'] !== 'string'
      || typeof row['menu_item_id'] !== 'string'
      || typeof row['menu_item_name'] !== 'string'
      || typeof row['created_at'] !== 'string'
    ) return []
    const images = Array.isArray(row['menu_item_images']) ? row['menu_item_images'] : []
    return [{
      restaurantId: row['restaurant_id'],
      restaurantSlug: row['restaurant_slug'],
      restaurantName: row['restaurant_name'],
      restaurantLogoUrl: typeof row['restaurant_logo_url'] === 'string' ? row['restaurant_logo_url'] : null,
      menuItemId: row['menu_item_id'],
      menuItemName: row['menu_item_name'],
      menuItemDescription: typeof row['menu_item_description'] === 'string' ? row['menu_item_description'] : null,
      menuItemPrice: finiteMoney(row['menu_item_price']),
      menuItemImageUrl: typeof images[0] === 'string' ? images[0] : null,
      createdAt: row['created_at'],
    }]
  })
}

export async function putCustomerFavorites(input: {
  customerId: string
  restaurantId: string
  menuItemIds: string[]
}): Promise<string[]> {
  const { data, error } = await rpcClient().rpc('put_customer_favorites', {
    p_customer_id: input.customerId,
    p_restaurant_id: input.restaurantId,
    p_menu_item_ids: input.menuItemIds,
  })
  if (error || !Array.isArray(data)) throw new Error('customer_favorites_write_failed')
  return data.filter((value): value is string => typeof value === 'string')
}

export async function deleteCustomerFavorite(input: {
  customerId: string
  restaurantId: string
  menuItemId: string
}): Promise<boolean> {
  const { data, error } = await rpcClient().rpc('delete_customer_favorite', {
    p_customer_id: input.customerId,
    p_restaurant_id: input.restaurantId,
    p_menu_item_id: input.menuItemId,
  })
  if (error) throw new Error('customer_favorite_delete_failed')
  return data === true
}

export async function claimActiveCustomerGuestOrders(input: {
  customerId: string
  restaurantId: string
  tableToken: string
  guestSessionId: string
  deviceProofHash: string
  requestId?: string
}): Promise<number> {
  const { data, error } = await rpcClient().rpc('claim_active_customer_guest_orders', {
    p_request_id: input.requestId ?? randomUUID(),
    p_customer_id: input.customerId,
    p_restaurant_id: input.restaurantId,
    p_table_token: input.tableToken,
    p_guest_session_id: input.guestSessionId,
    p_device_proof_hash: input.deviceProofHash,
  })
  if (error || typeof data !== 'number') throw new Error('customer_guest_claim_failed')
  return Math.max(0, Math.floor(data))
}

type CustomerReorderDifferenceKind =
  | 'unavailable'
  | 'name_changed'
  | 'price_changed'
  | 'modifier_changed'
  | 'removal_changed'
  | 'campaign_removed'
  | 'configuration_required'

export interface CustomerReorderLineRecord {
  originalName: string
  currentName: string | null
  quantity: number
  originalUnitPrice: number
  currentUnitPrice: number | null
  state: 'ready' | 'changed' | 'unavailable'
  differences: Array<{ kind: CustomerReorderDifferenceKind; label: string }>
  cartLine: {
    itemId: string
    quantity: number
    selectedModifiers: Array<{ group_id: string; option_id: string; quantity?: number }>
    removedIngredientIds: string[]
    productNote?: string
  } | null
}

export interface CustomerReorderPreviewRecord {
  orderId: string
  restaurant: { id: string; slug: string; name: string }
  originalTotal: number
  currentSubtotal: number
  lines: CustomerReorderLineRecord[]
}

export async function previewCustomerOrderReorder(input: {
  customerId: string
  orderId: string
}): Promise<CustomerReorderPreviewRecord | null> {
  const service = createServiceClient()
  const { data: order, error: orderError } = await service
    .from('orders')
    .select('id, restaurant_id, items, total')
    .eq('id', input.orderId)
    .eq('customer_id', input.customerId)
    .is('deleted_at', null)
    .maybeSingle()
  if (orderError) throw new Error('customer_reorder_order_failed')
  if (!order) return null

  const { data: restaurant, error: restaurantError } = await service
    .from('restaurants')
    .select('id, slug, name')
    .eq('id', order.restaurant_id)
    .is('deleted_at', null)
    .maybeSingle()
  if (restaurantError) throw new Error('customer_reorder_restaurant_failed')
  if (!restaurant) return null

  const rawLines = Array.isArray(order.items) ? order.items.slice(0, 100) : []
  const parsedLines = rawLines.map((raw) => ({ raw, parsed: readOrderLineSnapshot(raw) }))
  const itemIds = [...new Set(parsedLines.flatMap(({ parsed }) => parsed?.itemId ? [parsed.itemId] : []))]
  const { data: categories, error: categoryError } = await service
    .from('menu_categories')
    .select('id, vat_rate, kitchen_station_id')
    .eq('restaurant_id', order.restaurant_id)
    .is('deleted_at', null)
  if (categoryError) throw new Error('customer_reorder_categories_failed')
  const categoryRows = categories ?? []
  const categoryById = new Map(categoryRows.map((category) => [category.id, category]))
  const { data: items, error: itemError } = itemIds.length === 0
    ? { data: [], error: null }
    : await service
      .from('menu_items')
      .select('id, category_id, name, price, vat_rate, kitchen_station_id, is_available, deleted_at, ingredients, energy_kcal, may_contain_allergens, contains_allergens, contains_alcohol, contains_pork, modifier_groups')
      .in('id', itemIds)
      .in('category_id', categoryRows.map((category) => category.id))
  if (itemError) throw new Error('customer_reorder_items_failed')
  const itemById = new Map((items ?? []).map((item) => [item.id, item]))

  const lines = parsedLines.flatMap(({ raw, parsed }): CustomerReorderLineRecord[] => {
    if (!parsed) return []
    const row = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
    const originalUnitPrice = finiteMoney(parsed.price + parsed.modifiersPriceDelta)
    const current = itemById.get(parsed.itemId)
    const unavailable = !current || current.deleted_at !== null || current.is_available !== true
    if (unavailable) return [{
      originalName: parsed.name,
      currentName: current?.name ?? null,
      quantity: parsed.quantity,
      originalUnitPrice,
      currentUnitPrice: null,
      state: 'unavailable',
      differences: [{ kind: 'unavailable', label: 'Ürün artık satışta değil' }],
      cartLine: null,
    }]

    const category = categoryById.get(current.category_id)
    const selectedModifiers = parsed.modifiers.map((modifier) => ({
      group_id: modifier.groupId,
      option_id: modifier.optionId,
      ...(modifier.quantity > 1 ? { quantity: modifier.quantity } : {}),
    }))
    const removedIngredientIds = parsed.removedIngredients.map((ingredient) => ingredient.id)
    const built = buildOrderLineSnapshot({
      item: {
        id: current.id,
        name: current.name,
        price: Number(current.price),
        vat_rate: current.vat_rate ?? category?.vat_rate ?? null,
        is_available: true,
        ingredients: current.ingredients,
        energy_kcal: current.energy_kcal,
        may_contain_allergens: current.may_contain_allergens,
        contains_allergens: current.contains_allergens,
        contains_alcohol: current.contains_alcohol,
        contains_pork: current.contains_pork,
        modifier_groups: current.modifier_groups,
        kitchenStation: null,
      },
      quantity: parsed.quantity,
      selections: selectedModifiers,
      removedIngredientIds,
      ...(parsed.productNote ? { productNote: parsed.productNote } : {}),
    })
    if (!built.ok) return [{
      originalName: parsed.name,
      currentName: current.name,
      quantity: parsed.quantity,
      originalUnitPrice,
      currentUnitPrice: finiteMoney(Number(current.price)),
      state: 'unavailable',
      differences: [{ kind: 'configuration_required', label: 'Seçenekler yeniden yapılandırılmalı' }],
      cartLine: null,
    }]

    const differences: CustomerReorderLineRecord['differences'] = []
    const currentUnitPrice = finiteMoney(built.snapshot.price + built.snapshot.modifiersPriceDelta)
    if (built.snapshot.name !== parsed.name) differences.push({ kind: 'name_changed', label: `Ürün adı “${built.snapshot.name}” oldu` })
    if (currentUnitPrice !== originalUnitPrice) differences.push({ kind: 'price_changed', label: `Güncel birim fiyat ${currentUnitPrice.toFixed(2)} TL` })
    if (JSON.stringify(built.snapshot.modifiers.map(modifierFingerprint)) !== JSON.stringify(parsed.modifiers.map(modifierFingerprint))) {
      differences.push({ kind: 'modifier_changed', label: 'Seçenek adları veya fiyatları güncellendi' })
    }
    if (JSON.stringify(built.snapshot.removedIngredients) !== JSON.stringify(parsed.removedIngredients)) {
      differences.push({ kind: 'removal_changed', label: 'Çıkarılan içerikler güncellendi' })
    }
    if (typeof row['originalPrice'] === 'number') {
      differences.push({ kind: 'campaign_removed', label: 'Eski kampanya yeniden uygulanmadı' })
    }
    return [{
      originalName: parsed.name,
      currentName: built.snapshot.name,
      quantity: parsed.quantity,
      originalUnitPrice,
      currentUnitPrice,
      state: differences.length === 0 ? 'ready' : 'changed',
      differences,
      cartLine: {
        itemId: built.snapshot.itemId,
        quantity: built.snapshot.quantity,
        selectedModifiers,
        removedIngredientIds,
        ...(built.snapshot.productNote ? { productNote: built.snapshot.productNote } : {}),
      },
    }]
  })

  return {
    orderId: order.id,
    restaurant: { id: restaurant.id, slug: restaurant.slug, name: restaurant.name },
    originalTotal: finiteMoney(order.total),
    currentSubtotal: finiteMoney(lines.reduce((total, line) => total + (line.currentUnitPrice ?? 0) * line.quantity, 0)),
    lines,
  }
}

function modifierFingerprint(value: { optionId: string; name: string; quantity: number; priceDelta: number }) {
  return [value.optionId, value.name, value.quantity, finiteMoney(value.priceDelta)]
}

function finiteMoney(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value * 100) / 100)
    : typeof value === 'string' && Number.isFinite(Number(value))
      ? Math.max(0, Math.round(Number(value) * 100) / 100)
      : 0
}
