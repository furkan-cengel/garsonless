import { allocateBundlePrice, parseBundlePrice, resolveComboRibbonSelection } from '@garsonless/domain/menu'

export interface ComboOrderLine {
  itemId: string
  quantity: number
  combo?: {
    instanceId: string
    sectionInstanceId: string
    comboIndex: number
  }
}

export interface ComboCatalogItem {
  id: string
  price: number
  position: number
  is_available: boolean
}

export interface PublishedThemeTokens {
  pageBlocks?: Array<{
    type?: unknown
    id?: unknown
    sectionId?: unknown
  }>
  surfaces?: {
    home?: {
      enabled?: unknown
      blocks?: Array<{ id?: unknown; sectionId?: unknown; enabled?: unknown }>
    }
  }
  sectionSettings?: Record<string, unknown>
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function stringSetting(settings: Record<string, unknown>, key: string): string | undefined {
  const value = settings[key]
  return typeof value === 'string' ? value : undefined
}

function publishedSectionBlocks(tokens: PublishedThemeTokens) {
  const menuBlocks = Array.isArray(tokens.pageBlocks) ? tokens.pageBlocks : []
  const surfaces = recordValue(tokens.surfaces)
  const home = recordValue(surfaces?.['home'])
  const homeBlocks = home?.['enabled'] === true && Array.isArray(home['blocks'])
    ? home['blocks'].flatMap((value) => {
        const block = recordValue(value)
        return block?.['enabled'] === true
          ? [{ type: 'section', id: block['id'], sectionId: block['sectionId'] }]
          : []
      })
    : []
  return [...menuBlocks, ...homeBlocks]
}

function promoSliderSourceMode(settings: Record<string, unknown>) {
  const stored = stringSetting(settings, 'sourceMode')
  if (stored === 'active' || stored === 'mixed' || stored === 'manual') return stored
  return Object.keys(settings).some((key) => /^(coupon|flash|freebie|loyalty|combo)/.test(key)) ? 'manual' : 'active'
}

function normalizePromoSliderCombo(settings: Record<string, unknown>): Record<string, unknown> | null {
  if (
    promoSliderSourceMode(settings) === 'active'
    || stringSetting(settings, 'comboEnabled') === 'false'
    || stringSetting(settings, 'comboTargetType') !== 'cart'
  ) return null
  const ids = [1, 2, 3]
    .map((index) => stringSetting(settings, `comboItem${index}Id`)?.trim())
    .filter((id): id is string => Boolean(id))
  if (ids.length < 2 || new Set(ids).size !== ids.length) return null
  const configuredPrice = parseBundlePrice(stringSetting(settings, 'comboPrice'))
  if (configuredPrice === null) return null
  return {
    ...settings,
    selectionMode: 'manual',
    comboCount: '1',
    itemsPerCombo: String(ids.length),
    combo1Item1Id: ids[0],
    combo1Item2Id: ids[1],
    ...(ids[2] ? { combo1Item3Id: ids[2] } : {}),
    combo1Price: String(configuredPrice),
    ...(stringSetting(settings, 'comboDiscountPolicy') ? { combo1DiscountPolicy: stringSetting(settings, 'comboDiscountPolicy') } : {}),
  }
}

/**
 * Re-resolve combo membership and its promotional price from the published
 * theme. A browser can identify the combo instance it clicked, but it cannot
 * choose the products or discounted amount that the order engine accepts.
 */
export function resolveComboPriceOverrides(input: {
  lines: ComboOrderLine[]
  tokens: PublishedThemeTokens
  catalogItems: ComboCatalogItem[]
}): { ok: true; pricesByLine: Map<number, number>; loyaltyStackingAllowed: boolean } | { ok: false; error: string } {
  const comboLineIndexes = input.lines.flatMap((line, index) => line.combo ? [index] : [])
  if (comboLineIndexes.length === 0) return { ok: true, pricesByLine: new Map(), loyaltyStackingAllowed: true }

  const pageBlocks = publishedSectionBlocks(input.tokens)
  const sectionSettings = recordValue(input.tokens.sectionSettings) ?? {}
  const catalogById = new Map(input.catalogItems.map((item) => [item.id, item]))
  const groups = new Map<string, number[]>()

  for (const lineIndex of comboLineIndexes) {
    const combo = input.lines[lineIndex]?.combo
    if (!combo) continue
    const indexes = groups.get(combo.instanceId) ?? []
    indexes.push(lineIndex)
    groups.set(combo.instanceId, indexes)
  }

  const pricesByLine = new Map<number, number>()
  let loyaltyStackingAllowed = true
  for (const lineIndexes of groups.values()) {
    const firstLine = input.lines[lineIndexes[0]!]
    const combo = firstLine?.combo
    if (!firstLine || !combo) return { ok: false, error: 'Kombo doğrulanamadı.' }

    const sameIdentity = lineIndexes.every((index) => {
      const candidate = input.lines[index]?.combo
      return candidate?.sectionInstanceId === combo.sectionInstanceId
        && candidate.comboIndex === combo.comboIndex
    })
    const sameQuantity = lineIndexes.every((index) => input.lines[index]?.quantity === firstLine.quantity)
    if (!sameIdentity || !sameQuantity) {
      return { ok: false, error: 'Kombo içeriği değişmiş. Menüyü yenileyip tekrar deneyin.' }
    }

    const block = pageBlocks.find((candidate) => candidate.id === combo.sectionInstanceId)
    const sectionDefinitionId = block?.sectionId ?? block?.id
    if (block?.type !== 'section' || (sectionDefinitionId !== 'combo-ribbon' && sectionDefinitionId !== 'promo-slider')) {
      return { ok: false, error: 'Kombo artık yayında değil. Menüyü yenileyin.' }
    }

    const storedSettings = recordValue(sectionSettings[combo.sectionInstanceId])
      ?? recordValue(sectionSettings[sectionDefinitionId])
    if (!storedSettings) return { ok: false, error: 'Kombo ayarları bulunamadı.' }
    const settings = sectionDefinitionId === 'promo-slider'
      ? normalizePromoSliderCombo(storedSettings)
      : storedSettings
    if (!settings) return { ok: false, error: 'Kombo artık etkin değil. Menüyü yenileyin.' }
    if (sectionDefinitionId === 'promo-slider' && combo.comboIndex !== 1) {
      return { ok: false, error: 'Kombo artık yayında değil. Menüyü yenileyin.' }
    }

    const resolution = resolveComboRibbonSelection(settings, input.catalogItems.map((item) => ({
      id: item.id,
      price: Number(item.price),
      position: item.position,
      isAvailable: item.is_available,
    })))
    const expectedGroup = resolution.groups.find((candidate) => candidate.index === combo.comboIndex)
    if (!expectedGroup) {
      const invalidPrice = resolution.issues.some((issue) => issue.comboIndex === combo.comboIndex && issue.code === 'invalid-campaign-price')
      return { ok: false, error: invalidPrice ? 'Kombo kampanya fiyatı normal toplamdan düşük olmalıdır.' : 'Kombo içeriği değişmiş. Menüyü yenileyip tekrar deneyin.' }
    }
    const expectedItems = expectedGroup.itemIds.flatMap((itemId) => {
      const item = catalogById.get(itemId)
      return item ? [item] : []
    })
    if (expectedItems.length !== expectedGroup.itemIds.length || expectedItems.length !== lineIndexes.length) {
      return { ok: false, error: 'Kombo içeriği değişmiş. Menüyü yenileyip tekrar deneyin.' }
    }
    const sentItemIds = lineIndexes.map((index) => input.lines[index]?.itemId ?? '')
    if (new Set(sentItemIds).size !== sentItemIds.length
      || expectedItems.some((item) => !sentItemIds.includes(item.id))) {
      return { ok: false, error: 'Kombo içeriği değişmiş. Menüyü yenileyip tekrar deneyin.' }
    }

    if (sectionDefinitionId === 'promo-slider' && !expectedGroup.hasPromotionalPrice) {
      return { ok: false, error: 'Kombo kampanya fiyatı geçersiz. Menüyü yenileyin.' }
    }
    const discountPolicy = stringSetting(settings, `combo${combo.comboIndex}DiscountPolicy`)
    if (expectedGroup.hasPromotionalPrice && discountPolicy === 'combo-only') loyaltyStackingAllowed = false
    const allocatedPrices = allocateBundlePrice(
      expectedItems.map((item) => Number(item.price)),
      expectedGroup.total,
    )
    const priceByItemId = new Map(expectedItems.map((item, index) => [item.id, allocatedPrices[index] ?? Number(item.price)]))
    for (const lineIndex of lineIndexes) {
      const itemId = input.lines[lineIndex]?.itemId
      const price = itemId ? priceByItemId.get(itemId) : undefined
      if (price === undefined) return { ok: false, error: 'Kombo fiyatı doğrulanamadı.' }
      pricesByLine.set(lineIndex, price)
    }
  }

  return { ok: true, pricesByLine, loyaltyStackingAllowed }
}
