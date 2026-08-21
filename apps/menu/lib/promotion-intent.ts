import type { GarsonlessTheme } from '@garsonless/design-engine'
import { getSectionDefinitionId } from '@garsonless/design-engine/section-blocks'
import {
  resolveSectionCampaignTiming,
  resolveSectionPromotionPrice,
} from '@garsonless/domain/menu'
import type { MenuItem, SectionPromotionContext } from '@garsonless/ui/menu'

export type PromotionIntentKind = SectionPromotionContext['kind']

export interface ResolvedPromotionIntent {
  item: MenuItem
  originalPrice: number
  promotion: SectionPromotionContext
}

function hasPublishedSection(theme: GarsonlessTheme, sectionInstanceId: string, kind: PromotionIntentKind) {
  const menuBlock = (theme.pageBlocks ?? []).find((block) => block.id === sectionInstanceId)
  if (menuBlock?.type === 'section' && getSectionDefinitionId(menuBlock) === kind) return true
  // Campaign rules are restaurant-wide once their block is enabled. The Home
  // landing page may be disabled while the same offer still applies to items
  // added from the Menu surface.
  return Boolean(theme.surfaces?.home.blocks?.some(
    (block) => block.enabled && block.id === sectionInstanceId && block.sectionId === kind,
  ))
}

function publishedPromoSliderInstanceIds(theme: GarsonlessTheme) {
  const ids = new Set<string>()
  for (const block of theme.pageBlocks ?? []) {
    if (block.type === 'section' && getSectionDefinitionId(block) === 'promo-slider') ids.add(block.id)
  }
  for (const block of theme.surfaces?.home.blocks ?? []) {
    if (block.enabled && block.sectionId === 'promo-slider') ids.add(block.id)
  }
  return [...ids]
}

function promoSliderSourceMode(config: Record<string, string>) {
  if (config.sourceMode === 'active' || config.sourceMode === 'mixed' || config.sourceMode === 'manual') return config.sourceMode
  return Object.keys(config).some((key) => /^(coupon|flash|freebie|loyalty|combo)/.test(key)) ? 'manual' : 'active'
}

/**
 * Restores only the identity of a promotion selected on the Home surface.
 * Product membership, timing and price are rebuilt from the current theme and
 * catalogue; URL values can never choose a discount amount.
 */
export function resolvePromotionIntent(input: {
  theme: GarsonlessTheme
  items: MenuItem[]
  itemId: string | null | undefined
  sectionInstanceId: string | null | undefined
  kind: string | null | undefined
  now?: number
}): ResolvedPromotionIntent | null {
  if (input.kind !== 'discount-badge' && input.kind !== 'daily-special' && input.kind !== 'promo-slider') return null
  const sectionInstanceId = input.sectionInstanceId?.trim()
  const itemId = input.itemId?.trim()
  if (!sectionInstanceId || !itemId || !hasPublishedSection(input.theme, sectionInstanceId, input.kind)) return null
  const item = input.items.find((candidate) => candidate.id === itemId && candidate.is_available)
  if (!item) return null
  const config = input.theme.sectionSettings?.[sectionInstanceId]
    ?? input.theme.sectionSettings?.[input.kind]
    ?? {}

  const promoSlider = input.kind === 'promo-slider'
  if (promoSlider) {
    if (
      promoSliderSourceMode(config) === 'active'
      || config.flashEnabled === 'false'
      || config.flashOfferType !== 'buy-2-pay-1'
    ) return null
    const eligibleIds = [1, 2, 3, 4].map((index) => config[`flashItem${index}Id`]?.trim()).filter(Boolean)
    if (!eligibleIds.includes(item.id)) return null
  } else if (config.productId?.trim() !== item.id) {
    return null
  }

  const timing = resolveSectionCampaignTiming({
    enabled: config[promoSlider ? 'flashCountdownEnabled' : 'countdownEnabled'],
    endsAt: config[promoSlider ? 'flashCampaignEndsAt' : 'campaignEndsAt'],
    ...(input.now !== undefined ? { now: input.now } : {}),
  })
  if (!timing.active) return null
  const mode = promoSlider ? 'buy-2-pay-1' : config.discountMode ?? (input.kind === 'daily-special' ? 'none' : 'percentage')
  if (mode === 'none') return null
  const pricing = resolveSectionPromotionPrice({
    catalogPrice: item.price,
    mode,
    percentage: config.discountPercent ?? '20',
    ...(config.campaignPrice !== undefined ? { fixedPrice: config.campaignPrice } : {}),
  })
  if (!pricing) return null
  return {
    item: { ...item, price: pricing.price },
    originalPrice: item.price,
    promotion: {
      sectionInstanceId,
      kind: input.kind,
      ...(pricing.kind === 'buy-2-pay-1' ? { quantityStep: pricing.quantity } : {}),
    },
  }
}

/** Resolves a live automatic campaign for ordinary product-card additions. */
export function resolveAutomaticPromotionForItem(input: {
  theme: GarsonlessTheme
  item: MenuItem
  now?: number
}): ResolvedPromotionIntent | null {
  for (const sectionInstanceId of publishedPromoSliderInstanceIds(input.theme)) {
    const resolved = resolvePromotionIntent({
      theme: input.theme,
      items: [input.item],
      itemId: input.item.id,
      sectionInstanceId,
      kind: 'promo-slider',
      ...(input.now !== undefined ? { now: input.now } : {}),
    })
    if (resolved) return resolved
  }
  return null
}
