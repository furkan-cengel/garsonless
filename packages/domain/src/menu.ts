export const ALLERGEN_CODES = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'tree_nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const

export type AllergenCode = (typeof ALLERGEN_CODES)[number]

export const ALLERGEN_LABELS: Record<AllergenCode, string> = {
  gluten: 'Gluten',
  crustaceans: 'Kabuklular',
  eggs: 'Yumurta',
  fish: 'Balık',
  peanuts: 'Yer fıstığı',
  soy: 'Soya',
  milk: 'Süt',
  tree_nuts: 'Sert kabuklu meyveler',
  celery: 'Kereviz',
  mustard: 'Hardal',
  sesame: 'Susam',
  sulphites: 'Kükürt dioksit ve sülfitler',
  lupin: 'Acı bakla',
  molluscs: 'Yumuşakçalar',
}

const ALLERGEN_SET = new Set<string>(ALLERGEN_CODES)

export function normalizeAllergenCodes(value: unknown): AllergenCode[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((code): code is AllergenCode =>
    typeof code === 'string' && ALLERGEN_SET.has(code),
  ))]
}

export interface DietaryClaims {
  vegetarian: boolean
  vegan: boolean
  halal: boolean
  containsAlcohol: boolean
  containsPork: boolean
}

export function getDietaryClaimsConflict(claims: DietaryClaims): string | null {
  if (claims.vegan && !claims.vegetarian) {
    return 'Vegan olarak işaretlenen ürün vejetaryen de olmalıdır'
  }
  if (claims.halal && (claims.containsAlcohol || claims.containsPork)) {
    return 'Helal olarak işaretlenen ürün alkol veya domuz kaynaklı bileşen içeremez'
  }
  return null
}

export type MenuNumericParseResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string }

export function parseMenuNumericInput(
  input: unknown,
  options: {
    required?: boolean
    integer?: boolean
    min?: number
    max?: number
  } = {},
): MenuNumericParseResult {
  const raw = typeof input === 'number'
    ? String(input)
    : typeof input === 'string'
      ? input.trim()
      : ''
  if (!raw) {
    return options.required
      ? { ok: false, error: 'Bu alan için geçerli bir sayı girin' }
      : { ok: true, value: null }
  }
  if (!/^-?\d+(?:[.,]\d+)?$/.test(raw)) {
    return { ok: false, error: 'Geçersiz sayı biçimi' }
  }
  const value = Number(raw.replace(',', '.'))
  if (!Number.isFinite(value)) return { ok: false, error: 'Geçersiz sayı biçimi' }
  if (options.integer && !Number.isInteger(value)) {
    return { ok: false, error: 'Bu alan tam sayı olmalıdır' }
  }
  if (options.min !== undefined && value < options.min) {
    return { ok: false, error: `Değer en az ${options.min} olmalıdır` }
  }
  if (options.max !== undefined && value > options.max) {
    return { ok: false, error: `Değer en fazla ${options.max} olmalıdır` }
  }
  return { ok: true, value }
}

export function normalizeMenuNumericText(value: string): string {
  return value.replace(',', '.').replace(/[^\d.-]/g, '')
}

/** Parses an optional merchant-entered bundle price. Empty/zero values mean
 * "use the catalogue total"; malformed or negative values fail closed. */
export function parseBundlePrice(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const raw = String(value).trim().replace(/\s/g, '').replace(/[^\d,.-]/g, '')
  if (!raw || raw.startsWith('-')) return null
  const commaIndex = raw.lastIndexOf(',')
  const dotIndex = raw.lastIndexOf('.')
  let normalized = raw
  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? ',' : '.'
    const thousandsSeparator = decimalSeparator === ',' ? /\./g : /,/g
    normalized = raw.replace(thousandsSeparator, '').replace(decimalSeparator, '.')
  } else if (commaIndex >= 0) {
    const parts = raw.split(',')
    normalized = parts.length === 2
      ? `${parts[0]}.${parts[1]}`
      : `${parts.slice(0, -1).join('')}.${parts.at(-1)}`
  } else if ((raw.match(/\./g) ?? []).length > 1) {
    const parts = raw.split('.')
    const last = parts.at(-1) ?? ''
    normalized = last.length <= 2
      ? `${parts.slice(0, -1).join('')}.${last}`
      : parts.join('')
  }
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null
}

export const COMBO_RIBBON_MIN_ITEMS = 2
export const COMBO_RIBBON_MAX_ITEMS = 4
export const COMBO_RIBBON_MAX_GROUPS = 3

export type ComboRibbonSelectionIssueCode =
  | 'duplicate-item'
  | 'insufficient-items'
  | 'invalid-campaign-price'
  | 'missing-item'
  | 'missing-selection'
  | 'unavailable-item'

export interface ComboRibbonCatalogProduct {
  id: string
  price: number
  position: number
  isAvailable: boolean
}

export interface ComboRibbonSelectionIssue {
  code: ComboRibbonSelectionIssueCode
  comboIndex: number
  itemIndex?: number
  itemId?: string
  expectedCount?: number
  resolvedCount?: number
}

export interface ComboRibbonSelectionGroup {
  index: number
  itemIds: string[]
  catalogTotal: number
  total: number
  savings: number
  savingsPercent: number
  hasPromotionalPrice: boolean
  hasLegacyNonPromotionalPrice: boolean
}

function boundedComboInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

/**
 * Canonical combo membership and price rule shared by editor diagnostics,
 * storefront rendering and server-side order verification.
 */
export function resolveComboRibbonSelection(
  config: Record<string, unknown>,
  products: ComboRibbonCatalogProduct[],
): { groups: ComboRibbonSelectionGroup[]; issues: ComboRibbonSelectionIssue[] } {
  const comboCount = boundedComboInteger(config.comboCount, 2, 1, COMBO_RIBBON_MAX_GROUPS)
  const itemsPerCombo = boundedComboInteger(config.itemsPerCombo, 2, COMBO_RIBBON_MIN_ITEMS, COMBO_RIBBON_MAX_ITEMS)
  const ordered = [...products].sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
  const available = ordered.filter((product) => product.isAvailable)
  const catalogById = new Map(ordered.map((product) => [product.id, product]))
  const availableById = new Map(available.map((product) => [product.id, product]))
  const manual = (config.selectionMode || 'automatic') === 'manual'
  const modern = config.editorialVersion === '2'
  const groups: ComboRibbonSelectionGroup[] = []
  const issues: ComboRibbonSelectionIssue[] = []

  for (let comboIndex = 1; comboIndex <= comboCount; comboIndex += 1) {
    let selected: ComboRibbonCatalogProduct[] = []
    if (manual) {
      const seen = new Set<string>()
      for (let itemIndex = 1; itemIndex <= itemsPerCombo; itemIndex += 1) {
        const rawItemId = config[`combo${comboIndex}Item${itemIndex}Id`]
        const itemId = typeof rawItemId === 'string' ? rawItemId.trim() : ''
        if (!itemId) {
          issues.push({ code: 'missing-selection', comboIndex, itemIndex })
          continue
        }
        if (seen.has(itemId)) {
          issues.push({ code: 'duplicate-item', comboIndex, itemIndex, itemId })
          continue
        }
        seen.add(itemId)
        const item = availableById.get(itemId)
        if (!item) {
          issues.push({ code: catalogById.has(itemId) ? 'unavailable-item' : 'missing-item', comboIndex, itemIndex, itemId })
          continue
        }
        selected.push(item)
      }
    } else {
      const start = (comboIndex - 1) * itemsPerCombo
      selected = available.slice(start, start + itemsPerCombo)
    }

    if (selected.length < itemsPerCombo) {
      issues.push({ code: 'insufficient-items', comboIndex, expectedCount: itemsPerCombo, resolvedCount: selected.length })
    }
    if (selected.length < COMBO_RIBBON_MIN_ITEMS || (modern && selected.length !== itemsPerCombo)) continue

    const catalogTotal = Math.round(selected.reduce((sum, product) => sum + product.price, 0) * 100) / 100
    const configuredPrice = parseBundlePrice(config[`combo${comboIndex}Price`])
    if (modern && configuredPrice !== null && configuredPrice >= catalogTotal) {
      issues.push({ code: 'invalid-campaign-price', comboIndex })
      continue
    }
    const total = configuredPrice ?? catalogTotal
    const savings = Math.max(0, Math.round((catalogTotal - total) * 100) / 100)
    groups.push({
      index: comboIndex,
      itemIds: selected.map((product) => product.id),
      catalogTotal,
      total,
      savings,
      savingsPercent: catalogTotal > 0 ? Math.round((savings / catalogTotal) * 100) : 0,
      hasPromotionalPrice: configuredPrice !== null && configuredPrice < catalogTotal,
      hasLegacyNonPromotionalPrice: !modern && configuredPrice !== null && configuredPrice >= catalogTotal,
    })
  }

  return { groups, issues }
}

export type SectionPromotionPricing =
  | { kind: 'percentage'; percentage: number; price: number; savings: number }
  | { kind: 'fixed-price'; percentage: number; price: number; savings: number }
  | {
      kind: 'buy-2-pay-1'
      percentage: 50
      /** Effective unit price used by the existing order-line model. */
      price: number
      /** Savings per unit; the campaign card exposes the full pair saving. */
      savings: number
      quantity: 2
      originalTotal: number
      totalPrice: number
    }

export type SectionCampaignTiming =
  | { enabled: false; active: true; endsAtMs: null; remainingMs: null; valid: true }
  | { enabled: true; active: boolean; endsAtMs: number; remainingMs: number; valid: true }
  | { enabled: true; active: false; endsAtMs: null; remainingMs: 0; valid: false }

/**
 * Resolves a persisted absolute campaign deadline. The editor stores ISO-8601
 * values, so browser and server evaluate the same instant regardless of their
 * timezone. Invalid enabled schedules fail closed on the server.
 */
export function resolveSectionCampaignTiming(input: {
  enabled: unknown
  endsAt: unknown
  now?: number
}): SectionCampaignTiming {
  const enabled = input.enabled === true || input.enabled === 'true'
  if (!enabled) {
    return { enabled: false, active: true, endsAtMs: null, remainingMs: null, valid: true }
  }

  const rawEndsAt = typeof input.endsAt === 'string' ? input.endsAt.trim() : ''
  const endsAtMs = rawEndsAt ? Date.parse(rawEndsAt) : Number.NaN
  if (!Number.isFinite(endsAtMs)) {
    return { enabled: true, active: false, endsAtMs: null, remainingMs: 0, valid: false }
  }

  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now()
  const remainingMs = Math.max(0, endsAtMs - now)
  return {
    enabled: true,
    active: remainingMs > 0,
    endsAtMs,
    remainingMs,
    valid: true,
  }
}

/**
 * Resolves a merchant-configured section promotion against a catalogue price.
 * Both the menu renderer and the server-side order resolver use this rule so
 * the displayed amount cannot drift from the amount accepted at checkout.
 */
export function resolveSectionPromotionPrice(input: {
  catalogPrice: number
  mode: unknown
  percentage?: unknown
  fixedPrice?: unknown
}): SectionPromotionPricing | null {
  const catalogPrice = Math.round(Number(input.catalogPrice) * 100) / 100
  if (!Number.isFinite(catalogPrice) || catalogPrice <= 0) return null

  if (input.mode === 'buy-2-pay-1') {
    const catalogCents = Math.round(catalogPrice * 100)
    // Never charge more than the advertised single-product price for a pair.
    // Odd kuruş values are rounded down by one kuruş in the customer's favour.
    const effectiveUnitCents = Math.floor(catalogCents / 2)
    if (effectiveUnitCents <= 0) return null
    const price = effectiveUnitCents / 100
    const totalPrice = (effectiveUnitCents * 2) / 100
    return {
      kind: 'buy-2-pay-1',
      percentage: 50,
      price,
      savings: Math.round((catalogPrice - price) * 100) / 100,
      quantity: 2,
      originalTotal: Math.round(catalogPrice * 2 * 100) / 100,
      totalPrice,
    }
  }

  if (input.mode === 'fixed-price') {
    const price = parseBundlePrice(input.fixedPrice)
    if (price === null || price >= catalogPrice) return null
    const savings = Math.round((catalogPrice - price) * 100) / 100
    return {
      kind: 'fixed-price',
      price,
      savings,
      percentage: Math.max(1, Math.min(99, Math.round((savings / catalogPrice) * 100))),
    }
  }

  const percentage = Number(input.percentage)
  if (!Number.isFinite(percentage) || percentage < 1 || percentage > 90) return null
  const normalizedPercentage = Math.round(percentage)
  const price = Math.round(catalogPrice * (100 - normalizedPercentage)) / 100
  if (price <= 0 || price >= catalogPrice) return null
  return {
    kind: 'percentage',
    percentage: normalizedPercentage,
    price,
    savings: Math.round((catalogPrice - price) * 100) / 100,
  }
}

/** Distributes a bundle total over its products in exact cents. This lets the
 * existing cart/order-line model remain intact while the sum is guaranteed to
 * equal the merchant's configured bundle price. Modifier deltas are separate. */
export function allocateBundlePrice(prices: number[], bundlePrice: number): number[] {
  if (prices.length === 0) return []
  const targetCents = Math.max(0, Math.round(bundlePrice * 100))
  const sourceCents = prices.map((price) => Math.max(0, Math.round(price * 100)))
  const sourceTotal = sourceCents.reduce((sum, price) => sum + price, 0)
  if (sourceTotal === 0) {
    const base = Math.floor(targetCents / prices.length)
    return prices.map((_, index) => (base + (index < targetCents % prices.length ? 1 : 0)) / 100)
  }
  let allocated = 0
  return sourceCents.map((price, index) => {
    const cents = index === sourceCents.length - 1
      ? targetCents - allocated
      : Math.floor((targetCents * price) / sourceTotal)
    allocated += cents
    return cents / 100
  })
}

export function separateAllergenDeclarations(
  containsValue: unknown,
  tracesValue: unknown,
): { contains: AllergenCode[]; traces: AllergenCode[] } {
  const contains = normalizeAllergenCodes(containsValue)
  const containsSet = new Set(contains)
  return {
    contains,
    traces: normalizeAllergenCodes(tracesValue).filter((code) => !containsSet.has(code)),
  }
}

export function toggleAllergenDeclaration(
  containsValue: unknown,
  tracesValue: unknown,
  code: AllergenCode,
  target: 'contains' | 'trace',
): { contains: AllergenCode[]; traces: AllergenCode[] } {
  const { contains, traces } = separateAllergenDeclarations(containsValue, tracesValue)
  if (target === 'contains') {
    return contains.includes(code)
      ? { contains: contains.filter((candidate) => candidate !== code), traces }
      : { contains: [...contains, code], traces: traces.filter((candidate) => candidate !== code) }
  }
  if (contains.includes(code)) return { contains, traces }
  return {
    contains,
    traces: traces.includes(code)
      ? traces.filter((candidate) => candidate !== code)
      : [...traces, code],
  }
}

export function moveListItem<T>(
  items: readonly T[],
  index: number,
  direction: -1 | 1,
): T[] {
  const target = index + direction
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items]
  const next = [...items]
  const current = next[index]
  const adjacent = next[target]
  if (current === undefined || adjacent === undefined) return next
  next[index] = adjacent
  next[target] = current
  return next
}

export function applyReviewInvalidatingPatch<T extends { reviewed: boolean }>(
  current: T,
  patch: Partial<T>,
): T {
  const explicitlySetsReview = Object.prototype.hasOwnProperty.call(patch, 'reviewed')
  return {
    ...current,
    ...patch,
    ...(explicitlySetsReview ? {} : { reviewed: false }),
  }
}

export function calculateMarginPercent(price: number, cost: number | null): number | null {
  if (!Number.isFinite(price) || price <= 0 || cost === null || !Number.isFinite(cost) || cost < 0) {
    return null
  }
  return Math.round(((price - cost) / price) * 100)
}
