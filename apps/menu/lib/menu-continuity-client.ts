import type { CustomerAuthSurface } from './customer-auth-intent'
import type { CustomerReorderPreviewView } from './customer-account-contract'

const AUTH_CONTEXT_KEY = 'masabu-customer-auth-context-v1'
const REORDER_DRAFT_PREFIX = 'masabu-reorder-draft-v1:'
const FAVORITES_PREFIX = 'masabu-guest-favorites-v1:'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SURFACES: ReadonlySet<string> = new Set(['menu', 'cart', 'order', 'bill', 'split', 'service'])

export interface PendingCustomerAuthContext {
  restaurantId: string
  restaurantSlug: string
  tableToken: string | null
  surface: CustomerAuthSurface
  expiresAt: number
}

export function storePendingCustomerAuthContext(input: Omit<PendingCustomerAuthContext, 'expiresAt'>): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(AUTH_CONTEXT_KEY, JSON.stringify({ ...input, expiresAt: Date.now() + 10 * 60_000 }))
}

export function consumePendingCustomerAuthContext(input: {
  restaurantId: string
  restaurantSlug: string
  tableToken: string | null
  now?: number
}): PendingCustomerAuthContext | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(AUTH_CONTEXT_KEY)
  localStorage.removeItem(AUTH_CONTEXT_KEY)
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    const valid = value['restaurantId'] === input.restaurantId
      && value['restaurantSlug'] === input.restaurantSlug
      && (value['tableToken'] ?? null) === input.tableToken
      && typeof value['surface'] === 'string'
      && SURFACES.has(value['surface'])
      && typeof value['expiresAt'] === 'number'
      && value['expiresAt'] > (input.now ?? Date.now())
    return valid ? value as unknown as PendingCustomerAuthContext : null
  } catch {
    return null
  }
}

interface StoredReorderDraft {
  version: 1
  restaurantSlug: string
  expiresAt: number
  lines: NonNullable<CustomerReorderPreviewView['lines'][number]['cartLine']>[]
}

export function storeReorderDraft(preview: CustomerReorderPreviewView): void {
  if (typeof sessionStorage === 'undefined') return
  const lines = preview.lines.flatMap((line) => line.cartLine ? [line.cartLine] : [])
  if (lines.length === 0) return
  const value: StoredReorderDraft = {
    version: 1,
    restaurantSlug: preview.restaurant.slug,
    expiresAt: Date.now() + 10 * 60_000,
    lines,
  }
  sessionStorage.setItem(`${REORDER_DRAFT_PREFIX}${preview.restaurant.slug}`, JSON.stringify(value))
}

export function consumeReorderDraft(restaurantSlug: string, now = Date.now()): StoredReorderDraft['lines'] {
  if (typeof sessionStorage === 'undefined') return []
  const key = `${REORDER_DRAFT_PREFIX}${restaurantSlug}`
  const raw = sessionStorage.getItem(key)
  sessionStorage.removeItem(key)
  if (!raw) return []
  try {
    const value = JSON.parse(raw) as StoredReorderDraft
    if (value.version !== 1 || value.restaurantSlug !== restaurantSlug || value.expiresAt <= now || !Array.isArray(value.lines)) return []
    return value.lines.slice(0, 100).filter((line) =>
      line && UUID_PATTERN.test(line.itemId) && Number.isInteger(line.quantity) && line.quantity > 0,
    )
  } catch {
    return []
  }
}

export function readGuestFavoriteIds(restaurantId: string): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const value = JSON.parse(localStorage.getItem(`${FAVORITES_PREFIX}${restaurantId}`) ?? 'null') as {
      version?: unknown
      itemIds?: unknown
    } | null
    if (value?.version !== 1 || !Array.isArray(value.itemIds)) return []
    return [...new Set(value.itemIds.filter((itemId): itemId is string => typeof itemId === 'string' && UUID_PATTERN.test(itemId)))].slice(0, 100)
  } catch {
    return []
  }
}

export function writeGuestFavoriteIds(restaurantId: string, itemIds: Iterable<string>): void {
  if (typeof localStorage === 'undefined') return
  const valid = [...new Set(itemIds)].filter((itemId) => UUID_PATTERN.test(itemId)).slice(0, 100)
  localStorage.setItem(`${FAVORITES_PREFIX}${restaurantId}`, JSON.stringify({ version: 1, itemIds: valid }))
}

export function clearGuestFavoriteIds(restaurantId: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(`${FAVORITES_PREFIX}${restaurantId}`)
}
