export interface FreebieOrderLine {
  itemId: string
  quantity: number
  promotion?: {
    sectionInstanceId: string
    kind: 'discount-badge' | 'daily-special' | 'promo-slider'
    offer?: 'freebie'
    instanceId?: string
    role?: 'qualifier' | 'reward'
  }
}

export interface FreebieCatalogItem {
  id: string
  category_id: string
  price: number
  is_available: boolean
}

interface FreebieThemeTokens {
  pageBlocks?: Array<{ type?: unknown; id?: unknown; sectionId?: unknown }>
  surfaces?: { home?: { blocks?: Array<{ id?: unknown; sectionId?: unknown; enabled?: unknown }> } }
  sectionSettings?: Record<string, unknown>
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function setting(settings: Record<string, unknown>, key: string) {
  const value = settings[key]
  return typeof value === 'string' ? value : undefined
}

function publishedBlocks(tokens: FreebieThemeTokens) {
  const menu = Array.isArray(tokens.pageBlocks) ? tokens.pageBlocks : []
  const home = record(record(tokens.surfaces)?.['home'])
  const homeBlocks = Array.isArray(home?.['blocks']) ? home['blocks'].flatMap((entry) => {
    const block = record(entry)
    return block?.['enabled'] === true ? [{ type: 'section', id: block['id'], sectionId: block['sectionId'] }] : []
  }) : []
  return [...menu, ...homeBlocks]
}

function sourceMode(settings: Record<string, unknown>) {
  const value = setting(settings, 'sourceMode')
  if (value === 'active' || value === 'mixed' || value === 'manual') return value
  return Object.keys(settings).some((key) => /^(coupon|flash|freebie|loyalty|combo)/.test(key)) ? 'manual' : 'active'
}

function timingActive(settings: Record<string, unknown>, now: number) {
  if (setting(settings, 'freebieTimingEnabled') !== 'true') return true
  const startsAt = Date.parse(setting(settings, 'freebieStartsAt') ?? '')
  const endsAt = Date.parse(setting(settings, 'freebieEndsAt') ?? '')
  return Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt <= now && endsAt > now
}

export function resolveFreebiePriceOverrides(input: {
  lines: FreebieOrderLine[]
  tokens: FreebieThemeTokens
  catalogItems: FreebieCatalogItem[]
  now?: number
}): { ok: true; pricesByLine: Map<number, number>; rewardLineIndexes: Set<number> } | { ok: false; error: string } {
  const indexes = input.lines.flatMap((line, index) => line.promotion?.offer === 'freebie' ? [index] : [])
  if (indexes.length === 0) return { ok: true, pricesByLine: new Map(), rewardLineIndexes: new Set() }
  const blocks = publishedBlocks(input.tokens)
  const sectionSettings = record(input.tokens.sectionSettings) ?? {}
  const catalog = new Map(input.catalogItems.filter((item) => item.is_available).map((item) => [item.id, item]))
  const groups = new Map<string, number[]>()
  for (const index of indexes) {
    const promotion = input.lines[index]?.promotion
    if (!promotion?.instanceId || promotion.kind !== 'promo-slider') return { ok: false, error: 'Hediye kampanyası kimliği geçersiz.' }
    groups.set(promotion.instanceId, [...(groups.get(promotion.instanceId) ?? []), index])
  }

  const pricesByLine = new Map<number, number>()
  const rewardLineIndexes = new Set<number>()
  for (const groupIndexes of groups.values()) {
    if (groupIndexes.length !== 2) return { ok: false, error: 'Her kampanya grubunda bir uygun ürün ve bir hediye bulunmalıdır.' }
    const qualifierIndex = groupIndexes.find((index) => input.lines[index]?.promotion?.role === 'qualifier')
    const rewardIndex = groupIndexes.find((index) => input.lines[index]?.promotion?.role === 'reward')
    if (qualifierIndex === undefined || rewardIndex === undefined) return { ok: false, error: 'Hediye kampanyası rolleri geçersiz.' }
    const qualifierLine = input.lines[qualifierIndex]!
    const rewardLine = input.lines[rewardIndex]!
    const promotion = qualifierLine.promotion!
    if (rewardLine.promotion?.sectionInstanceId !== promotion.sectionInstanceId || qualifierLine.quantity !== rewardLine.quantity || qualifierLine.quantity < 1) return { ok: false, error: 'Hediye adedi uygun ürün adediyle aynı olmalıdır.' }
    const block = blocks.find((candidate) => candidate.id === promotion.sectionInstanceId)
    if (block?.type !== 'section' || (block.sectionId ?? block.id) !== 'promo-slider') return { ok: false, error: 'Hediye kampanyası artık yayında değil.' }
    const settings = record(sectionSettings[promotion.sectionInstanceId]) ?? record(sectionSettings['promo-slider'])
    if (!settings || sourceMode(settings) === 'active' || setting(settings, 'freebieEnabled') !== 'true' || setting(settings, 'freebieOfferType') !== 'gift-with-purchase') return { ok: false, error: 'Hediye kampanyası artık etkin değil.' }
    if (!timingActive(settings, input.now ?? Date.now())) return { ok: false, error: 'Hediye kampanyası henüz başlamadı veya sona erdi.' }
    const qualifierItem = catalog.get(qualifierLine.itemId)
    const rewardItem = catalog.get(rewardLine.itemId)
    if (!qualifierItem || !rewardItem) return { ok: false, error: 'Kampanya ürünlerinden biri artık satışta değil.' }
    const qualifierIds = [1, 2, 3, 4].flatMap((index) => {
      const id = setting(settings, `freebieQualifierItem${index}Id`)?.trim()
      return id ? [id] : []
    })
    const qualifierCategoryId = setting(settings, 'freebieQualifierCategoryId')?.trim()
    const qualifierAllowed = setting(settings, 'freebieQualifierMode') === 'products'
      ? qualifierIds.includes(qualifierItem.id)
      : qualifierItem.category_id === qualifierCategoryId
    const rewardIds = [1, 2, 3, 4].flatMap((index) => {
      const id = setting(settings, `freebieRewardItem${index}Id`)?.trim()
      return id ? [id] : []
    })
    const duplicatedConfiguration = new Set(qualifierIds).size !== qualifierIds.length || new Set(rewardIds).size !== rewardIds.length
    const overlappingConfiguration = qualifierIds.some((id) => rewardIds.includes(id))
      || (setting(settings, 'freebieQualifierMode') !== 'products' && rewardIds.some((id) => catalog.get(id)?.category_id === qualifierCategoryId))
    if (duplicatedConfiguration || overlappingConfiguration) return { ok: false, error: 'Hediye kampanyası ürün grupları geçersiz.' }
    if (!qualifierAllowed || !rewardIds.includes(rewardItem.id) || qualifierItem.id === rewardItem.id) return { ok: false, error: 'Kampanya ürünleri değişmiş. Menüyü yenileyin.' }
    pricesByLine.set(qualifierIndex, qualifierItem.price)
    pricesByLine.set(rewardIndex, 0)
    rewardLineIndexes.add(rewardIndex)
  }
  return { ok: true, pricesByLine, rewardLineIndexes }
}
