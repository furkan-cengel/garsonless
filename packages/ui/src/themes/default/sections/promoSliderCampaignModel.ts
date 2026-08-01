import { getSectionDefinitionId, type ThemePageBlock } from '@garsonless/design-engine'
import {
  resolveSectionCampaignTiming,
  resolveSectionPromotionPrice,
} from '@garsonless/domain/menu'
import type { MenuItem } from '../../../menu/types'
import type { AllergenCode } from '../../../menu/types'
import { getDefiniteAllergens, sortAllergenCodes } from '../../../menu/FoodInfoBadges'
import { resolveComboRibbonGroups } from './comboRibbonModel'

export type PromoSliderCampaignKind = 'discount-badge' | 'daily-special' | 'combo-ribbon'

export interface PromoSliderCampaign {
  id: string
  sectionInstanceId: string
  kind: PromoSliderCampaignKind
  sourceLabel: string
  title: string
  subtitle: string
  badge: string
  imageUrl: string
  price?: number
  oldPrice?: number
  backgroundColor: string
  accentColor: string
  textColor: string
  allergens: AllergenCode[]
  hasCrossContact: boolean
  /** Absolute campaign deadline. The slider uses this to retire a stale slide without a page refresh. */
  expiresAtMs?: number
  /** Optional label configured on the source campaign section. */
  countdownLabel?: string
}

interface DerivePromoSliderCampaignsInput {
  pageBlocks?: ThemePageBlock[]
  sectionSettings?: Record<string, Record<string, string>>
  items?: MenuItem[]
  now?: number
}

function configFor(
  block: ThemePageBlock,
  sectionId: string,
  settings: Record<string, Record<string, string>>,
) {
  return settings[block.id] ?? settings[sectionId] ?? {}
}

function availableItem(items: MenuItem[], productId: string | undefined) {
  const id = productId?.trim()
  return id ? items.find((item) => item.id === id && item.is_available) : undefined
}

function allergenProjection(items: MenuItem[]) {
  return {
    allergens: sortAllergenCodes(items.flatMap((item) => getDefiniteAllergens(item))),
    hasCrossContact: items.some((item) => item.may_contain_allergens.length > 0 || Boolean(item.cross_contact_note)),
  }
}

function resolveCampaignTiming(config: Record<string, string>, now: number) {
  return resolveSectionCampaignTiming({
    enabled: config.countdownEnabled,
    endsAt: config.campaignEndsAt,
    now,
  })
}

/**
 * Builds the slider's live source from the campaign sections that already
 * exist in page flow. The slider never invents a second promotion rule: its
 * price, schedule and product all come from the canonical campaign section.
 */
export function deriveActivePromoSliderCampaigns({
  pageBlocks = [],
  sectionSettings = {},
  items = [],
  now = Date.now(),
}: DerivePromoSliderCampaignsInput): PromoSliderCampaign[] {
  const campaigns: PromoSliderCampaign[] = []

  for (const block of pageBlocks) {
    const sectionId = getSectionDefinitionId(block)
    if (!sectionId || block.type !== 'section') continue
    if (sectionId !== 'discount-badge' && sectionId !== 'daily-special' && sectionId !== 'combo-ribbon') continue
    const config = configFor(block, sectionId, sectionSettings)
    const timing = resolveCampaignTiming(config, now)
    if (!timing.active) continue
    const countdownLabel = config.countdownLabel?.trim()
    const expiry = timing.enabled && timing.valid
      ? {
          expiresAtMs: timing.endsAtMs,
          ...(countdownLabel ? { countdownLabel } : {}),
        }
      : {}

    if (sectionId === 'combo-ribbon') {
      for (const group of resolveComboRibbonGroups(config, items)) {
        const prefix = `combo${group.index}`
        campaigns.push({
          id: `${block.id}:combo:${group.index}`,
          sectionInstanceId: block.id,
          kind: 'combo-ribbon',
          sourceLabel: 'Kombo Şerit',
          title: config[`${prefix}Title`]?.trim() || group.items.map((item) => item.name).join(' + '),
          subtitle: `${group.items.length} ürün birlikte`,
          badge: config[`${prefix}Badge`]?.trim() || `${group.items.length} ÜRÜN`,
          imageUrl: group.items.find((item) => item.images[0])?.images[0] ?? '',
          price: group.total,
          ...(group.hasSpecialPrice ? { oldPrice: group.catalogTotal } : {}),
          backgroundColor: config[`${prefix}Color`]?.trim() || (group.index === 1 ? '#26a69a' : group.index === 2 ? '#ee6c4d' : '#d8a72f'),
          accentColor: config.accentColor?.trim() || '#e86b3d',
          textColor: config[`${prefix}TextColor`]?.trim() || '#ffffff',
          ...allergenProjection(group.items),
          ...expiry,
        })
      }
      continue
    }

    const item = availableItem(items, config.productId)
    if (!item) continue

    if (sectionId === 'daily-special') {
      const discountMode = config.discountMode || 'none'
      const pricing = discountMode === 'none'
        ? null
        : resolveSectionPromotionPrice({
            catalogPrice: item.price,
            mode: discountMode,
            percentage: config.discountPercent ?? '20',
            ...(config.campaignPrice !== undefined ? { fixedPrice: config.campaignPrice } : {}),
          })
      if (discountMode !== 'none' && !pricing) continue
      campaigns.push({
        id: block.id,
        sectionInstanceId: block.id,
        kind: 'daily-special',
        sourceLabel: 'Günün Özeli',
        title: config.title?.trim() || item.name,
        subtitle: config.body?.trim() || item.description || 'Bugün mutfağın öne çıkan lezzeti.',
        badge: config.eyebrow?.trim() || 'GÜNÜN ÖZELİ',
        imageUrl: item.images[0] ?? '',
        price: pricing?.price ?? item.price,
        ...(pricing ? { oldPrice: item.price } : {}),
        backgroundColor: config.bgColor?.trim() || '#fdf6ec',
        accentColor: config.accentColor?.trim() || '#a13b7a',
        textColor: config.textColor?.trim() || '#1c2618',
        ...allergenProjection([item]),
        ...expiry,
      })
      continue
    }

    const pricing = resolveSectionPromotionPrice({
      catalogPrice: item.price,
      mode: config.discountMode ?? 'percentage',
      percentage: config.discountPercent ?? '20',
      ...(config.campaignPrice !== undefined ? { fixedPrice: config.campaignPrice } : {}),
    })
    if (!pricing) continue
    campaigns.push({
      id: block.id,
      sectionInstanceId: block.id,
      kind: 'discount-badge',
      sourceLabel: 'İndirim Rozeti',
      title: config.title?.trim() || item.name,
      subtitle: config.body?.trim() || item.description || 'Seçili üründe menüye özel avantaj.',
      badge: pricing.kind === 'buy-2-pay-1' ? '2 AL 1 ÖDE' : `%${pricing.percentage} AVANTAJ`,
      imageUrl: item.images[0] ?? '',
      price: pricing.kind === 'buy-2-pay-1' ? pricing.totalPrice : pricing.price,
      oldPrice: pricing.kind === 'buy-2-pay-1' ? pricing.originalTotal : item.price,
      backgroundColor: config.bgColor?.trim() || '#f5f7dc',
      accentColor: config.accentColor?.trim() || '#2e7d52',
      textColor: config.textColor?.trim() || '#1c2618',
      ...allergenProjection([item]),
      ...expiry,
    })
  }

  return campaigns
}

export function selectPromoSliderCampaigns(campaigns: PromoSliderCampaign[], selectedIds: string | undefined) {
  const ids = new Set((selectedIds ?? '').split(',').map((id) => id.trim()).filter(Boolean))
  return ids.size === 0 ? campaigns : campaigns.filter((campaign) => ids.has(campaign.id))
}
