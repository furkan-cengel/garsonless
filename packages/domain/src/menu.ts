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
