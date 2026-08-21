export const FREEBIE_HANDOFF_STORAGE_KEY = 'garsonless:freebie-handoff:v1'
const FREEBIE_HANDOFF_MAX_AGE_MS = 5 * 60 * 1000

interface FreebieIntentHandoff {
  restaurantSlug: string
  sectionInstanceId: string
  config: Record<string, string>
  createdAt: number
}

type FreebieHandoffStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

function pickFreebieConfig(config: Record<string, string>): Record<string, string> {
  const exactKeys = new Set([
    'sourceMode',
    'freebieEnabled',
    'freebieOfferType',
    'freebieQualifierMode',
    'freebieQualifierCategoryId',
    'freebieTimingEnabled',
    'freebieStartsAt',
    'freebieEndsAt',
    'freebieTitle',
  ])
  return Object.fromEntries(Object.entries(config).filter(([key, value]) => (
    typeof value === 'string'
    && value.length <= 1_000
    && (exactKeys.has(key) || /^freebie(?:Qualifier|Reward)Item[1-4]Id$/.test(key))
  )))
}

export function storeFreebieIntentHandoff(
  storage: FreebieHandoffStorage,
  value: Omit<FreebieIntentHandoff, 'createdAt' | 'config'> & { config: Record<string, string> },
  now = Date.now(),
) {
  try {
    storage.setItem(FREEBIE_HANDOFF_STORAGE_KEY, JSON.stringify({
      ...value,
      config: pickFreebieConfig(value.config),
      createdAt: now,
    }))
    return true
  } catch {
    return false
  }
}

export function consumeFreebieIntentHandoff(
  storage: FreebieHandoffStorage,
  sectionInstanceId: string,
  restaurantSlug: string,
  now = Date.now(),
): Record<string, string> | null {
  let raw: string | null
  try {
    raw = storage.getItem(FREEBIE_HANDOFF_STORAGE_KEY)
    storage.removeItem(FREEBIE_HANDOFF_STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<FreebieIntentHandoff>
    if (
      value.restaurantSlug !== restaurantSlug
      || value.sectionInstanceId !== sectionInstanceId
      || typeof value.createdAt !== 'number'
      || now < value.createdAt
      || now - value.createdAt > FREEBIE_HANDOFF_MAX_AGE_MS
      || !value.config
      || typeof value.config !== 'object'
    ) return null
    return pickFreebieConfig(value.config as Record<string, string>)
  } catch {
    return null
  }
}
