import {
  resolveSectionCampaignTiming,
  resolveSectionPromotionPrice,
} from '@garsonless/domain/menu'

export interface DiscountBadgeOrderLine {
  itemId: string
  quantity: number
  promotion?: {
    sectionInstanceId: string
    kind: 'discount-badge' | 'daily-special'
  }
}

export interface DiscountBadgeCatalogItem {
  id: string
  price: number
  is_available: boolean
}

export interface DiscountBadgeThemeTokens {
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

/**
 * Re-resolves a section promotion click from the published theme. The browser
 * may identify the section it clicked, but the selected product, campaign
 * price and stacking policy remain server-authoritative.
 */
export function resolveDiscountBadgePriceOverrides(input: {
  lines: DiscountBadgeOrderLine[]
  tokens: DiscountBadgeThemeTokens
  catalogItems: DiscountBadgeCatalogItem[]
  now?: number
}): { ok: true; pricesByLine: Map<number, number>; loyaltyStackingAllowed: boolean } | { ok: false; error: string } {
  const promotionLineIndexes = input.lines.flatMap((line, index) => line.promotion ? [index] : [])
  if (promotionLineIndexes.length === 0) {
    return { ok: true, pricesByLine: new Map(), loyaltyStackingAllowed: true }
  }

  const pageBlocks = Array.isArray(input.tokens.pageBlocks) ? input.tokens.pageBlocks : []
  const sectionSettings = recordValue(input.tokens.sectionSettings) ?? {}
  const catalogById = new Map(
    input.catalogItems
      .filter((item) => item.is_available)
      .map((item) => [item.id, item]),
  )
  const pricesByLine = new Map<number, number>()
  let loyaltyStackingAllowed = true

  for (const lineIndex of promotionLineIndexes) {
    const line = input.lines[lineIndex]
    const promotion = line?.promotion
    if (!line || !promotion || (promotion.kind !== 'discount-badge' && promotion.kind !== 'daily-special')) {
      return { ok: false, error: 'Kampanya doğrulanamadı.' }
    }

    const block = pageBlocks.find((candidate) => candidate.id === promotion.sectionInstanceId)
    const sectionDefinitionId = block?.sectionId ?? block?.id
    if (block?.type !== 'section' || sectionDefinitionId !== promotion.kind) {
      return { ok: false, error: 'Kampanya artık yayında değil. Menüyü yenileyin.' }
    }

    const settings = recordValue(sectionSettings[promotion.sectionInstanceId])
      ?? recordValue(sectionSettings[promotion.kind])
    if (!settings) return { ok: false, error: 'Kampanya ayarları bulunamadı.' }

    const timing = resolveSectionCampaignTiming({
      enabled: stringSetting(settings, 'countdownEnabled'),
      endsAt: stringSetting(settings, 'campaignEndsAt'),
      ...(input.now !== undefined ? { now: input.now } : {}),
    })
    if (timing.enabled && !timing.valid) {
      return { ok: false, error: 'Kampanya bitiş zamanı geçersiz. Menüyü yenileyin.' }
    }
    if (!timing.active) {
      return { ok: false, error: 'Kampanyanın süresi doldu. Menüyü yenileyin.' }
    }

    const configuredProductId = stringSetting(settings, 'productId')?.trim()
    if (!configuredProductId || configuredProductId !== line.itemId) {
      return { ok: false, error: 'Kampanya ürünü değişmiş. Menüyü yenileyin.' }
    }
    const item = catalogById.get(configuredProductId)
    if (!item) return { ok: false, error: 'Kampanya ürünü artık satışta değil.' }

    const discountMode = stringSetting(settings, 'discountMode')
      ?? (promotion.kind === 'daily-special' ? 'none' : 'percentage')
    if (discountMode === 'none') {
      return { ok: false, error: 'Bu bölümde özel fiyat artık etkin değil. Menüyü yenileyin.' }
    }

    const pricing = resolveSectionPromotionPrice({
      catalogPrice: Number(item.price),
      mode: discountMode,
      percentage: stringSetting(settings, 'discountPercent') ?? '20',
      ...(stringSetting(settings, 'campaignPrice') !== undefined
        ? { fixedPrice: stringSetting(settings, 'campaignPrice') }
        : {}),
    })
    if (!pricing) return { ok: false, error: 'Kampanya fiyatı geçersiz. Menüyü yenileyin.' }

    if (pricing.kind === 'buy-2-pay-1' && (line.quantity < pricing.quantity || line.quantity % pricing.quantity !== 0)) {
      return { ok: false, error: '2 al 1 öde kampanyası yalnız ikili adetlerle kullanılabilir.' }
    }

    pricesByLine.set(lineIndex, pricing.price)
    if (stringSetting(settings, 'discountPolicy') === 'promotion-only') {
      loyaltyStackingAllowed = false
    }
  }

  return { ok: true, pricesByLine, loyaltyStackingAllowed }
}
