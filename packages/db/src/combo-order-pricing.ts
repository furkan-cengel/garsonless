import { allocateBundlePrice, parseBundlePrice } from '@garsonless/domain/menu'

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

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
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

  const pageBlocks = Array.isArray(input.tokens.pageBlocks) ? input.tokens.pageBlocks : []
  const sectionSettings = recordValue(input.tokens.sectionSettings) ?? {}
  const availableItems = input.catalogItems
    .filter((item) => item.is_available)
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
  const availableById = new Map(availableItems.map((item) => [item.id, item]))
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
    if (block?.type !== 'section' || sectionDefinitionId !== 'combo-ribbon') {
      return { ok: false, error: 'Kombo artık yayında değil. Menüyü yenileyin.' }
    }

    const settings = recordValue(sectionSettings[combo.sectionInstanceId])
      ?? recordValue(sectionSettings['combo-ribbon'])
    if (!settings) return { ok: false, error: 'Kombo ayarları bulunamadı.' }

    const comboCount = boundedInteger(stringSetting(settings, 'comboCount'), 2, 1, 3)
    const itemsPerCombo = boundedInteger(stringSetting(settings, 'itemsPerCombo'), 2, 2, 3)
    if (combo.comboIndex < 1 || combo.comboIndex > comboCount) {
      return { ok: false, error: 'Kombo artık yayında değil. Menüyü yenileyin.' }
    }

    const selectionMode = stringSetting(settings, 'selectionMode') === 'manual' ? 'manual' : 'automatic'
    let expectedItems: ComboCatalogItem[] = []
    if (selectionMode === 'manual') {
      const seen = new Set<string>()
      for (let itemIndex = 1; itemIndex <= 3; itemIndex += 1) {
        const itemId = stringSetting(settings, `combo${combo.comboIndex}Item${itemIndex}Id`)?.trim()
        const item = itemId ? availableById.get(itemId) : undefined
        if (!item || seen.has(item.id)) continue
        seen.add(item.id)
        expectedItems.push(item)
        if (expectedItems.length === itemsPerCombo) break
      }
    } else {
      const start = (combo.comboIndex - 1) * itemsPerCombo
      expectedItems = availableItems.slice(start, start + itemsPerCombo)
    }

    if (expectedItems.length < 2 || expectedItems.length !== lineIndexes.length) {
      return { ok: false, error: 'Kombo içeriği değişmiş. Menüyü yenileyip tekrar deneyin.' }
    }
    const sentItemIds = lineIndexes.map((index) => input.lines[index]?.itemId ?? '')
    if (new Set(sentItemIds).size !== sentItemIds.length
      || expectedItems.some((item) => !sentItemIds.includes(item.id))) {
      return { ok: false, error: 'Kombo içeriği değişmiş. Menüyü yenileyip tekrar deneyin.' }
    }

    const catalogTotal = expectedItems.reduce((sum, item) => sum + Number(item.price), 0)
    const configuredPrice = parseBundlePrice(settings[`combo${combo.comboIndex}Price`])
    const discountPolicy = stringSetting(settings, `combo${combo.comboIndex}DiscountPolicy`)
    const hasPromotionalPrice = configuredPrice !== null && configuredPrice < catalogTotal
    if (hasPromotionalPrice && discountPolicy === 'combo-only') loyaltyStackingAllowed = false
    const allocatedPrices = allocateBundlePrice(
      expectedItems.map((item) => Number(item.price)),
      configuredPrice ?? catalogTotal,
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
