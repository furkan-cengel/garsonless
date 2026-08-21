export const COMBO_SECTION_PARAM = 'comboSection'
export const COMBO_INDEX_PARAM = 'comboIndex'
export const COMBO_ITEM_PARAM = 'comboItem'
export const COMBO_TOTAL_PARAM = 'comboTotal'
export const COMBO_TITLE_PARAM = 'comboTitle'
export const COMBO_HANDOFF_STORAGE_KEY = 'garsonless:combo-handoff:v1'
const COMBO_HANDOFF_MAX_AGE_MS = 5 * 60 * 1000

export interface ComboIntent {
  sectionInstanceId: string
  comboIndex: number
}

interface ComboIntentHandoff extends ComboIntent {
  restaurantSlug: string
  config: Record<string, string>
  createdAt: number
}

type ComboHandoffStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

function pickComboConfig(config: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(config).filter(([key, value]) => (
    typeof value === 'string'
    && value.length <= 1_000
    && (
      key === 'editorialVersion'
      || key === 'selectionMode'
      || key === 'itemsPerCombo'
      || key === 'comboCount'
      || /^combo[1-3](?:Item[1-4]Id|Price|Title|DiscountPolicy)$/.test(key)
    )
  )))
}

export function storeComboIntentHandoff(
  storage: ComboHandoffStorage,
  value: Omit<ComboIntentHandoff, 'createdAt' | 'config'> & { config: Record<string, string> },
  now = Date.now(),
): boolean {
  try {
    storage.setItem(COMBO_HANDOFF_STORAGE_KEY, JSON.stringify({
      ...value,
      config: pickComboConfig(value.config),
      createdAt: now,
    }))
    return true
  } catch {
    return false
  }
}

export function consumeComboIntentHandoff(
  storage: ComboHandoffStorage,
  intent: ComboIntent,
  restaurantSlug: string,
  now = Date.now(),
): Record<string, string> | null {
  let raw: string | null
  try {
    raw = storage.getItem(COMBO_HANDOFF_STORAGE_KEY)
    storage.removeItem(COMBO_HANDOFF_STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const value = JSON.parse(raw) as Partial<ComboIntentHandoff>
    if (
      value.restaurantSlug !== restaurantSlug
      || value.sectionInstanceId !== intent.sectionInstanceId
      || value.comboIndex !== intent.comboIndex
      || typeof value.createdAt !== 'number'
      || now < value.createdAt
      || now - value.createdAt > COMBO_HANDOFF_MAX_AGE_MS
      || !value.config
      || typeof value.config !== 'object'
    ) return null
    return pickComboConfig(value.config as Record<string, string>)
  } catch {
    return null
  }
}

export function readComboIntent(search: string): ComboIntent | null {
  const params = new URLSearchParams(search)
  const sectionInstanceId = params.get(COMBO_SECTION_PARAM)?.trim() ?? ''
  const comboIndex = Number(params.get(COMBO_INDEX_PARAM))
  if (!sectionInstanceId || !Number.isInteger(comboIndex) || comboIndex < 1 || comboIndex > 3) return null
  return { sectionInstanceId, comboIndex }
}

/**
 * Preview-only fallback for unsaved Home blocks. The destination still maps
 * these ids to its live catalog before constructing a cart request.
 */
export function readPreviewComboConfig(search: string, intent: ComboIntent): Record<string, string> | null {
  const params = new URLSearchParams(search)
  const itemIds = params.getAll(COMBO_ITEM_PARAM).map((value) => value.trim())
  const total = Number(params.get(COMBO_TOTAL_PARAM))
  const title = params.get(COMBO_TITLE_PARAM)?.trim() ?? ''
  if (
    itemIds.length < 2
    || itemIds.length > 4
    || new Set(itemIds).size !== itemIds.length
    || itemIds.some((id) => !id || id.length > 128)
    || !Number.isFinite(total)
    || total <= 0
    || total > 10_000_000
    || title.length > 200
  ) return null

  const prefix = `combo${intent.comboIndex}`
  return {
    selectionMode: 'manual',
    comboCount: String(intent.comboIndex),
    itemsPerCombo: String(itemIds.length),
    ...Object.fromEntries(itemIds.map((id, index) => [`${prefix}Item${index + 1}Id`, id])),
    [`${prefix}Price`]: String(total),
    ...(title ? { [`${prefix}Title`]: title } : {}),
  }
}

export function removeComboIntentFromUrl(url: Pick<URL, 'pathname' | 'search' | 'hash'>): string {
  const params = new URLSearchParams(url.search)
  params.delete(COMBO_SECTION_PARAM)
  params.delete(COMBO_INDEX_PARAM)
  params.delete(COMBO_ITEM_PARAM)
  params.delete(COMBO_TOTAL_PARAM)
  params.delete(COMBO_TITLE_PARAM)
  const query = params.size > 0 ? `?${params.toString()}` : ''
  return `${url.pathname}${query}${url.hash}`
}
