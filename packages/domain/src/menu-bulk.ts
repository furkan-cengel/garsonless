/** Shared, framework-free bulk editor contract. Prices are base product prices. */
export const MENU_BULK_FIELDS = ['name', 'description', 'price', 'category_id', 'is_available'] as const
export const MENU_BULK_LIMIT = 500
export type MenuBulkValues = { name: string; description: string | null; price: number; category_id: string; is_available: boolean }
export type MenuBulkItem = MenuBulkValues & { id: string; updated_at: string }
export type MenuBulkPatch = { id: string; expectedUpdatedAt: string; changes: Partial<MenuBulkValues> }
export type MenuBulkChange = { id: string; name: string; before: Partial<MenuBulkValues>; after: Partial<MenuBulkValues>; beforeVersion: string; afterVersion?: string }
export type MenuBulkOperation = { id: string; actor_id: string; actor_label: string; actor_email?: string | null; actor_role?: string | null; created_at: string; undo_of: string | null; undone_by: string | null; count: number }
export type MenuBulkResult = { ok: true; changes: MenuBulkChange[]; operation?: MenuBulkOperation; history?: MenuBulkOperation[]; items?: MenuBulkItem[] } | { ok: false; error: string; conflicts?: string[] }
export type MenuBulkRule =
  | { field: 'price'; mode: 'percent-up' | 'percent-down' | 'add' | 'subtract' | 'set'; value: string; rounding: 1 | 100 | 500 | 1000 }
  | { field: 'name' | 'description'; mode: 'replace' | 'prefix' | 'suffix' | 'set' | 'clear'; value: string; find?: string }
  | { field: 'category_id'; value: string }
  | { field: 'is_available'; value: boolean }

/** Decimal input accepts Turkish grouping/commas; no binary floating-point arithmetic. */
export function parseBulkDecimal(raw: string): bigint {
  let text = raw.trim()
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('En fazla iki ondalık basamaklı bir sayı girin.')
  const [whole = '0', fraction = ''] = text.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}
export function bulkPrice(raw: string): number {
  const cents = parseBulkDecimal(raw)
  if (cents < 1n || cents > 9999999999n) throw new Error('Fiyat 0,01–99.999.999,99 TL arasında olmalı.')
  return Number(cents) / 100
}
export function applyMenuBulkRule(item: MenuBulkValues, rule: MenuBulkRule): MenuBulkValues {
  if (rule.field === 'price') {
    const original = parseBulkDecimal(item.price.toFixed(2))
    const value = parseBulkDecimal(rule.value)
    let numerator: bigint
    let denominator = 1n
    if (rule.mode === 'percent-up' || rule.mode === 'percent-down') {
      numerator = original * (10000n + (rule.mode === 'percent-up' ? value : -value))
      denominator = 10000n
    } else numerator = rule.mode === 'set' ? value : original + (rule.mode === 'add' ? value : -value)
    if (numerator <= 0n) throw new Error('Fiyat sıfır veya negatif olamaz.')
    const step = BigInt(rule.rounding)
    const divisor = denominator * step
    const cents = ((numerator * 2n + divisor) / (2n * divisor)) * step
    return { ...item, price: bulkPrice((Number(cents) / 100).toFixed(2)) }
  }
  if (rule.field === 'category_id') return { ...item, category_id: rule.value }
  if (rule.field === 'is_available') return { ...item, is_available: rule.value }
  const current = item[rule.field] ?? ''
  if (rule.mode === 'replace' && !rule.find) throw new Error('Aranacak metni girin.')
  const next = rule.mode === 'replace' ? current.split(rule.find!).join(rule.value)
    : rule.mode === 'prefix' ? rule.value + current
    : rule.mode === 'suffix' ? current + rule.value
    : rule.mode === 'clear' ? '' : rule.value
  return { ...item, [rule.field]: rule.field === 'description' && !next ? null : next }
}
export function menuBulkPatches(original: MenuBulkItem[], edited: MenuBulkValues[]): MenuBulkPatch[] {
  return original.flatMap((item, index) => {
    const next = edited[index]
    if (!next) throw new Error('Ürün seçimi değişti.')
    const changes: Partial<MenuBulkValues> = {}
    for (const field of MENU_BULK_FIELDS) {
      if (item[field] !== next[field]) Object.assign(changes, { [field]: next[field] })
    }
    return Object.keys(changes).length ? [{ id: item.id, expectedUpdatedAt: item.updated_at, changes }] : []
  })
}
export function validateMenuBulkPatches(patches: MenuBulkPatch[]): string | null {
  if (!patches.length || patches.length > MENU_BULK_LIMIT || new Set(patches.map(p => p.id)).size !== patches.length) return '1–500 farklı ürün seçin.'
  if (new TextEncoder().encode(JSON.stringify(patches)).byteLength > 650000) return 'Metinler tek işlem sınırını aşıyor. Daha az ürün seçin.'
  for (const patch of patches) {
    const value = patch.changes
    if (Object.keys(value).some(key => !MENU_BULK_FIELDS.includes(key as typeof MENU_BULK_FIELDS[number]))) return 'Desteklenmeyen alan.'
    if (value.name !== undefined && (!value.name.trim() || [...value.name].length > 100)) return 'Ürün adı 1–100 karakter olmalı.'
    if (value.description != null && [...value.description].length > 500) return 'Açıklama en fazla 500 karakter olabilir.'
    if (value.price !== undefined && (!Number.isFinite(value.price) || value.price < .01 || value.price > 99999999.99 || Math.abs(value.price * 100 - Math.round(value.price * 100)) > .00001)) return 'Geçersiz fiyat.'
    if (value.category_id !== undefined && !value.category_id) return 'Kategori seçin.'
  }
  return null
}
