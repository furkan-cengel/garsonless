export interface CustomerAccountView {
  profile: {
    name: string | null
    email: { value: string; verified: true } | null
    phone: { value: string; verified: true } | null
    memberSince: string
  }
  loyalty: CustomerAccountLoyaltyView[]
  consents: CustomerAccountConsentView[]
  privacy: {
    deletionRequest: {
      id: string
      status: string
      requestedAt: string
    } | null
  }
}

export interface CustomerAccountLoyaltyView {
  restaurant: {
    id: string
    slug: string
    name: string
    logoUrl: string | null
  }
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

/**
 * The restaurant-scoped loyalty endpoint is the freshest source while a guest
 * is inside a menu. The global account projection can briefly lag behind that
 * endpoint (for example immediately after joining a restaurant). Keep the
 * global list, but upsert the current restaurant snapshot and place it first.
 */
export function mergeCurrentRestaurantLoyalty(
  account: CustomerAccountView,
  current: CustomerAccountLoyaltyView | null | undefined,
): CustomerAccountView {
  if (!current) return account
  const otherRestaurants = account.loyalty.filter((loyalty) => (
    loyalty.restaurant.id !== current.restaurant.id
    && loyalty.restaurant.slug !== current.restaurant.slug
  ))
  return { ...account, loyalty: [current, ...otherRestaurants] }
}

interface CustomerAccountConsentView {
  restaurant: {
    id: string
    slug: string
    name: string
  }
  contactData: boolean
  marketing: boolean
}

interface CustomerLoyaltyActivityView {
  id: string
  type: 'points' | 'stamp' | 'visit'
  direction: 'earn' | 'redeem' | 'refund' | 'reversal'
  delta: number
  reason: string
  createdAt: string
}

export interface CustomerLoyaltyActivityPageView {
  items: CustomerLoyaltyActivityView[]
  nextCursor: string | null
}

export interface CustomerPrivacyExportView {
  requestId: string
  status: 'completed'
  fileName: string
  data: Record<string, unknown>
}

export interface CustomerDeleteRequestView {
  requestId: string
  status: 'pending_review' | 'approved' | 'rejected' | 'fulfilled'
  requestedAt: string
  message: string
}

export type CustomerOrderFilter = 'active' | 'past'

interface CustomerOrderRestaurantView {
  slug: string
  name: string
  logoUrl: string | null
}

export interface CustomerOrderSummaryView {
  id: string
  restaurant: CustomerOrderRestaurantView
  placedAt: string
  updatedAt: string
  total: number
  status: CustomerOrderStatusView
  paid: boolean
  itemCount: number
  itemNames: string[]
}

export interface CustomerOrdersPageView {
  items: CustomerOrderSummaryView[]
  nextCursor: string | null
}

export interface CustomerOrderDetailView extends CustomerOrderSummaryView {
  items: CustomerOrderLineView[]
  payment: { label: string; paidAt: string } | null
  savings: number
  cancellationReason: string | null
}

export interface CustomerFavoriteView {
  restaurant: CustomerOrderRestaurantView
  item: {
    id: string
    name: string
    description: string | null
    price: number
    imageUrl: string | null
  }
  createdAt: string
}

export interface CustomerFavoritesView {
  items: CustomerFavoriteView[]
}

type CustomerReorderDifferenceKind =
  | 'unavailable'
  | 'name_changed'
  | 'price_changed'
  | 'modifier_changed'
  | 'removal_changed'
  | 'campaign_removed'
  | 'configuration_required'

export interface CustomerReorderPreviewView {
  orderId: string
  restaurant: CustomerOrderRestaurantView
  originalTotal: number
  currentSubtotal: number
  canApply: boolean
  lines: Array<{
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
  }>
}

export interface CustomerOrderLineView {
  name: string
  quantity: number
  unitPrice: number
  originalUnitPrice: number | null
  modifiers: string[]
  removedIngredients: string[]
  note: string | null
  campaignGift?: true
}

export interface CustomerOrderStatusView {
  code: 'pending' | 'pending_approval' | 'sent_to_kitchen' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled'
  label: string
  tone: 'neutral' | 'progress' | 'ready' | 'success' | 'danger'
}

interface CustomerOrderCursorValue {
  createdAt: string
  id: string
}

interface CustomerLoyaltyCursorValue {
  createdAt: string
  id: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseCustomerAccountPatch(value: unknown): { name: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const keys = Object.keys(value)
  if (keys.length !== 1 || keys[0] !== 'name') return null
  const name = (value as Record<string, unknown>)['name']
  if (typeof name !== 'string') return null
  const normalized = name.replace(/\s+/g, ' ').trim()
  return normalized.length >= 2 && normalized.length <= 80 ? { name: normalized } : null
}

export function parseCustomerConsentUpdate(value: unknown): {
  restaurantId: string
  consentType: 'contact_data' | 'marketing'
  grant: boolean
} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (Object.keys(row).some((key) => !['restaurantId', 'consentType', 'grant'].includes(key))) return null
  return typeof row['restaurantId'] === 'string' && UUID_PATTERN.test(row['restaurantId'])
    && (row['consentType'] === 'contact_data' || row['consentType'] === 'marketing')
    && typeof row['grant'] === 'boolean'
    ? {
        restaurantId: row['restaurantId'],
        consentType: row['consentType'],
        grant: row['grant'],
      }
    : null
}

export function parseCustomerPrivacyExport(value: unknown): { requestId: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  return Object.keys(row).length === 1 && typeof row['requestId'] === 'string' && UUID_PATTERN.test(row['requestId'])
    ? { requestId: row['requestId'] }
    : null
}

export function parseCustomerDeleteRequest(value: unknown): { requestId: string; confirmation: 'HESABIMI SİL' } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  return Object.keys(row).length === 2
    && typeof row['requestId'] === 'string' && UUID_PATTERN.test(row['requestId'])
    && row['confirmation'] === 'HESABIMI SİL'
    ? { requestId: row['requestId'], confirmation: 'HESABIMI SİL' }
    : null
}

export function parseCustomerFavoritePut(value: unknown): { restaurantId: string; menuItemIds: string[] } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (Object.keys(row).some((key) => key !== 'restaurantId' && key !== 'menuItemIds')) return null
  if (typeof row['restaurantId'] !== 'string' || !UUID_PATTERN.test(row['restaurantId'])) return null
  if (!Array.isArray(row['menuItemIds']) || row['menuItemIds'].length < 1 || row['menuItemIds'].length > 100) return null
  const menuItemIds = [...new Set(row['menuItemIds'])]
  if (menuItemIds.some((itemId) => typeof itemId !== 'string' || !UUID_PATTERN.test(itemId))) return null
  return { restaurantId: row['restaurantId'], menuItemIds: menuItemIds as string[] }
}

export function parseCustomerFavoriteDelete(value: unknown): { restaurantId: string; menuItemId: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (Object.keys(row).some((key) => key !== 'restaurantId' && key !== 'menuItemId')) return null
  return typeof row['restaurantId'] === 'string' && UUID_PATTERN.test(row['restaurantId'])
    && typeof row['menuItemId'] === 'string' && UUID_PATTERN.test(row['menuItemId'])
    ? { restaurantId: row['restaurantId'], menuItemId: row['menuItemId'] }
    : null
}

export function encodeCustomerOrderCursor(value: CustomerOrderCursorValue): string {
  return Buffer.from(JSON.stringify({ v: 1, c: value.createdAt, i: value.id }), 'utf8').toString('base64url')
}

export function decodeCustomerOrderCursor(value: string | null): CustomerOrderCursorValue | null {
  if (!value || value.length > 512) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>
    if (parsed['v'] !== 1 || typeof parsed['c'] !== 'string' || typeof parsed['i'] !== 'string') return null
    const date = new Date(parsed['c'])
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== parsed['c'] || !UUID_PATTERN.test(parsed['i'])) return null
    return { createdAt: parsed['c'], id: parsed['i'] }
  } catch {
    return null
  }
}

export function encodeCustomerLoyaltyCursor(value: CustomerLoyaltyCursorValue): string {
  return Buffer.from(JSON.stringify({ v: 1, a: value.createdAt, i: value.id }), 'utf8').toString('base64url')
}

export function decodeCustomerLoyaltyCursor(value: string | null): CustomerLoyaltyCursorValue | null {
  if (!value || value.length > 512) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>
    if (parsed['v'] !== 1 || typeof parsed['a'] !== 'string' || typeof parsed['i'] !== 'string') return null
    const date = new Date(parsed['a'])
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== parsed['a'] || !UUID_PATTERN.test(parsed['i'])) return null
    return { createdAt: parsed['a'], id: parsed['i'] }
  } catch {
    return null
  }
}

export function customerOrderStatus(value: string, paidAt: string | null): CustomerOrderStatusView {
  if (paidAt && value !== 'cancelled') return { code: 'paid', label: 'Tamamlandı', tone: 'success' }
  switch (value) {
    case 'pending': return { code: 'pending', label: 'Alındı', tone: 'neutral' }
    case 'pending_approval': return { code: 'pending_approval', label: 'Onay bekliyor', tone: 'neutral' }
    case 'sent_to_kitchen': return { code: 'sent_to_kitchen', label: 'Mutfağa iletildi', tone: 'progress' }
    case 'preparing': return { code: 'preparing', label: 'Hazırlanıyor', tone: 'progress' }
    case 'ready': return { code: 'ready', label: 'Hazır', tone: 'ready' }
    case 'served': return { code: 'served', label: 'Servis edildi', tone: 'ready' }
    case 'paid': return { code: 'paid', label: 'Tamamlandı', tone: 'success' }
    case 'cancelled': return { code: 'cancelled', label: 'İptal edildi', tone: 'danger' }
    default: return { code: 'pending', label: 'İşleniyor', tone: 'neutral' }
  }
}

export function projectCustomerOrderLines(value: unknown): CustomerOrderLineView[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 100).flatMap((entry): CustomerOrderLineView[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const row = entry as Record<string, unknown>
    const name = safeString(row['name'], 160)
    if (!name) return []
    const price = safeMoney(row['price'])
    const modifierDelta = safeMoney(row['modifiersPriceDelta'])
    const originalPrice = typeof row['originalPrice'] === 'number' ? safeMoney(row['originalPrice']) : null
    const promotion = row['promotion'] && typeof row['promotion'] === 'object' && !Array.isArray(row['promotion'])
      ? row['promotion'] as Record<string, unknown>
      : null
    const campaignGift = promotion?.['offer'] === 'freebie' && promotion['role'] === 'reward'
    return [{
      name,
      quantity: Math.max(1, Math.min(99, Math.floor(safeNumber(row['quantity'], 1)))),
      unitPrice: price + modifierDelta,
      originalUnitPrice: originalPrice === null ? null : originalPrice + modifierDelta,
      modifiers: safeNameList(row['modifiers'], 'name'),
      removedIngredients: safeNameList(row['removedIngredients'], 'name'),
      note: safeString(row['productNote'], 500) || null,
      ...(campaignGift ? { campaignGift: true as const } : {}),
    }]
  })
}

export function customerOrderSavings(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0
  const row = value as Record<string, unknown>
  return Math.max(0,
    safeMoney(row['memberDiscountAmount'])
      + safeMoney(row['pointsDiscountAmount'])
      + safeMoney(row['stampDiscountAmount'])
      + safeMoney(row['catalogDiscountAmount']),
  )
}

export function customerPaymentLabel(value: string | null): string {
  switch (value) {
    case 'iyzico': return 'Online ödeme'
    case 'cash': return 'Nakit'
    case 'pos': return 'Kart / POS'
    case 'comp': return 'İkram'
    case 'split': return 'Hesap bölüşme'
    default: return 'Ödeme tamamlandı'
  }
}

function safeNameList(value: unknown, key: string): string[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 30).flatMap((entry): string[] => {
    if (typeof entry === 'string') return safeString(entry, 120) ? [safeString(entry, 120)] : []
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const name = safeString((entry as Record<string, unknown>)[key], 120)
    const quantity = Math.max(1, Math.min(20, Math.floor(safeNumber((entry as Record<string, unknown>)['quantity'], 1))))
    return name ? [quantity > 1 ? `${name} × ${quantity}` : name] : []
  })
}

function safeString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function safeMoney(value: unknown): number {
  return Math.max(0, Math.round(safeNumber(value, 0) * 100) / 100)
}
