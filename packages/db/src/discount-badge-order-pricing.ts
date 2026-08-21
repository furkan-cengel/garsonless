import {
  resolveSectionCampaignTiming,
  resolveSectionPromotionPrice,
} from '@garsonless/domain/menu'

export interface DiscountBadgeOrderLine {
  itemId: string
  quantity: number
  promotion?: {
    sectionInstanceId: string
    kind: 'discount-badge' | 'daily-special' | 'promo-slider'
    offer?: 'freebie'
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
  surfaces?: {
    home?: {
      enabled?: unknown
      blocks?: Array<{
        id?: unknown
        sectionId?: unknown
        enabled?: unknown
      }>
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

function publishedSectionBlocks(tokens: DiscountBadgeThemeTokens) {
  const menuBlocks = Array.isArray(tokens.pageBlocks) ? tokens.pageBlocks : []
  const home = recordValue(tokens.surfaces)?.['home']
  const homeRecord = recordValue(home)
  // An enabled campaign block remains a restaurant-wide pricing rule even
  // when the optional Home landing surface itself is turned off.
  const homeBlocks = Array.isArray(homeRecord?.['blocks'])
    ? homeRecord['blocks'].flatMap((value) => {
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
  const promotionLineIndexes = input.lines.flatMap((line, index) => line.promotion && line.promotion.offer !== 'freebie' ? [index] : [])
  if (promotionLineIndexes.length === 0) {
    return { ok: true, pricesByLine: new Map(), loyaltyStackingAllowed: true }
  }

  const pageBlocks = publishedSectionBlocks(input.tokens)
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
    if (!line || !promotion || !['discount-badge', 'daily-special', 'promo-slider'].includes(promotion.kind)) {
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

    const promoSlider = promotion.kind === 'promo-slider'
    if (promoSlider && (
      promoSliderSourceMode(settings) === 'active'
      || stringSetting(settings, 'flashEnabled') === 'false'
      || stringSetting(settings, 'flashOfferType') !== 'buy-2-pay-1'
    )) {
      return { ok: false, error: '2 al 1 öde kampanyası artık etkin değil. Menüyü yenileyin.' }
    }

    const timing = resolveSectionCampaignTiming({
      enabled: stringSetting(settings, promoSlider ? 'flashCountdownEnabled' : 'countdownEnabled'),
      endsAt: stringSetting(settings, promoSlider ? 'flashCampaignEndsAt' : 'campaignEndsAt'),
      ...(input.now !== undefined ? { now: input.now } : {}),
    })
    if (timing.enabled && !timing.valid) {
      return { ok: false, error: 'Kampanya bitiş zamanı geçersiz. Menüyü yenileyin.' }
    }
    if (!timing.active) {
      return { ok: false, error: 'Kampanyanın süresi doldu. Menüyü yenileyin.' }
    }

    const eligibleProductIds = promoSlider
      ? [1, 2, 3, 4].map((index) => stringSetting(settings, `flashItem${index}Id`)?.trim()).filter((id): id is string => Boolean(id))
      : [stringSetting(settings, 'productId')?.trim()].filter((id): id is string => Boolean(id))
    if (eligibleProductIds.length === 0 || !eligibleProductIds.includes(line.itemId)) {
      return { ok: false, error: 'Kampanya ürünü değişmiş. Menüyü yenileyin.' }
    }
    const item = catalogById.get(line.itemId)
    if (!item) return { ok: false, error: 'Kampanya ürünü artık satışta değil.' }

    const discountMode = promoSlider ? 'buy-2-pay-1' : stringSetting(settings, 'discountMode')
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
    if (stringSetting(settings, promoSlider ? 'flashDiscountPolicy' : 'discountPolicy') === 'promotion-only') {
      loyaltyStackingAllowed = false
    }
  }

  return { ok: true, pricesByLine, loyaltyStackingAllowed }
}
