import type { SectionSettingField } from './theme-editor-properties-model'
import { resolvePromoSliderSourceMode } from '../../lib/promo-slider-validation'

export { getPromoSliderSettingIssues, resolvePromoSliderSourceMode } from '../../lib/promo-slider-validation'
export { getComboRibbonSettingIssues, getThemeComboRibbonIssues } from '../../lib/combo-ribbon-validation'

const PROMO_SLIDES = [
  { prefix: 'coupon', defaultOn: true },
  { prefix: 'flash', defaultOn: true },
  { prefix: 'freebie', defaultOn: false },
  { prefix: 'loyalty', defaultOn: false },
] as const

type MenuItemRef = {
  id: string
  name: string
  categoryId: string
  categoryName: string
  price?: number
  images?: unknown
  isAvailable?: boolean
  position?: number
}

export type SectionSettingLayout = 'inline' | 'toggle' | 'range' | 'stacked'

export interface SectionSettingGroup {
  id: string
  title: string | null
  description: string | null
  fields: SectionSettingField[]
}

const STACKED_SETTING_TYPES = new Set<SectionSettingField['type']>([
  'textarea',
  'color',
  'product-select',
  'campaign-multi-select',
  'coupon-select',
  'icon-grid',
])

export function getSectionSettingLayout(field: SectionSettingField): SectionSettingLayout {
  if (field.type === 'toggle') return 'toggle'
  if (field.type === 'range') return 'range'
  if (STACKED_SETTING_TYPES.has(field.type)) return 'stacked'
  return 'inline'
}

export function groupSectionSettingFields(fields: SectionSettingField[]): SectionSettingGroup[] {
  const groups: SectionSettingGroup[] = []
  let current: SectionSettingGroup = { id: 'general', title: null, description: null, fields: [] }

  const commit = () => {
    if (current.fields.length > 0) groups.push(current)
  }

  for (const field of fields) {
    if (field.type === 'heading') {
      commit()
      current = { id: field.key, title: field.label, description: field.description ?? null, fields: [] }
      continue
    }
    current.fields.push(field)
  }
  commit()

  return groups
}

function boundedCount(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(3, Math.max(1, parsed))
}

function promoSlideOn(values: Record<string, string>, prefix: string, fallback: boolean) {
  const value = values[`${prefix}Enabled`]
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

export function isPromoSliderFields(fields: SectionSettingField[]) {
  return fields.some((field) => field.key === 'sourceMode' || field.key === 'couponHeading')
}

export function isChefPickFields(fields: SectionSettingField[]) {
  return fields.some((field) => field.key === 'item1Id')
    && fields.some((field) => field.key === 'selectionMode')
}

export function isComboRibbonFields(fields: SectionSettingField[]) {
  return fields.some((field) => field.key === 'combo1Item1Id')
    && fields.some((field) => field.key === 'itemsPerCombo')
}

export function getChefPickSettingIssues(
  values: Record<string, string>,
  menuItems: MenuItemRef[],
) {
  if ((values.selectionMode || 'automatic') !== 'manual') return []
  const count = Math.min(4, Math.max(1, Number(values.itemCount) || 3))
  const byId = new Map(menuItems.map((item) => [item.id, item]))
  const seen = new Set<string>()
  const issues: string[] = []
  let validCount = 0

  for (let slot = 1; slot <= count; slot += 1) {
    const id = values[`item${slot}Id`]?.trim()
    if (!id) continue
    if (seen.has(id)) {
      issues.push(`Ürün ${slot}, daha önce seçilen bir ürünü tekrarlıyor.`)
      continue
    }
    seen.add(id)
    const item = byId.get(id)
    if (!item) {
      issues.push(`Ürün ${slot} artık menüde bulunmuyor.`)
      continue
    }
    if (item.isAvailable === false) {
      issues.push(`${item.name} pasif olduğu için yayınlanmayacak.`)
      continue
    }
    validCount += 1
  }

  if (validCount < count) issues.push(`${count} ürünlük alan için ${validCount} geçerli ürün seçildi.`)
  return issues
}

/**
 * An empty stored value intentionally means "follow every active campaign".
 * When the user starts from that state and turns one campaign off, persist all
 * of the *other* active ids instead of accidentally selecting only the card
 * they clicked.
 */
export function togglePromoSliderCampaignSelection(
  currentValue: string,
  campaignId: string,
  activeCampaignIds: string[],
) {
  const activeIds = Array.from(new Set(activeCampaignIds.map((id) => id.trim()).filter(Boolean)))
  const selectedIds = new Set(currentValue.split(',').map((id) => id.trim()).filter(Boolean))

  if (selectedIds.size === 0) {
    const remaining = activeIds.filter((id) => id !== campaignId)
    return remaining.length > 0 ? remaining.join(',') : ''
  }

  // Retire ids belonging to a campaign that has since expired or been removed.
  const next = new Set(Array.from(selectedIds).filter((id) => activeIds.includes(id)))
  if (next.has(campaignId)) {
    // The slider should never silently jump back to "all" because the final
    // explicit selection was unchecked. Keep that final card selected.
    if (next.size === 1) return Array.from(next).join(',')
    next.delete(campaignId)
  } else {
    next.add(campaignId)
  }
  return Array.from(next).join(',')
}

export function getVisibleSectionSettingFields(
  fields: SectionSettingField[],
  values: Record<string, string>,
) {
  const targetType = values.targetType || 'none'
  const comboCount = boundedCount(values.comboCount, 2)
  const comboItemCount = Math.min(4, Math.max(2, Number(values.itemsPerCombo) || 2))
  const promoSlider = isPromoSliderFields(fields)
  const legacyPromoSpecialCardsDefaultOn = promoSlider && resolvePromoSliderSourceMode(values) !== 'active'
  const featuredScroll = fields.some((field) => field.key === 'cardWidth' && field.label === 'Kart Genişliği')
  const sectionPromotion = fields.some((field) =>
    ['discountMode', 'countdownEnabled', 'campaignEndsAt', 'countdownLabel', 'timerBgColor', 'timerTextColor']
      .includes(field.key),
  )
  const videoHero = fields.some((field) => field.key === 'contentPlacement')
  const modernVideoHero = videoHero && values.editorialVersion === '2'
  const videoHeroHasContent = !['showStatus', 'showEyebrow', 'showTitle', 'showBody']
    .every((key) => values[key] === 'false')

  return fields.filter((field) => {
    if (videoHero && modernVideoHero && ['align', 'contentPositionX', 'contentPositionY'].includes(field.key)) return false
    if (videoHero && !modernVideoHero && field.key === 'contentPlacement') return false
    if (videoHero && !videoHeroHasContent && ['contentPlacement', 'align', 'contentPositionX', 'contentPositionY', 'contentWidth'].includes(field.key)) return false
    if (field.key === 'targetId' && targetType !== 'category' && targetType !== 'product') return false
    if (field.key === 'targetUrl' && targetType !== 'link') return false
    if (field.key === 'linkText' && targetType !== 'link') return false
    if (field.key === 'eyebrow' && values.showEyebrow === 'false') return false
    if (field.key === 'title' && values.showTitle === 'false') return false
    if (field.key === 'body' && values.showBody === 'false') return false
    if ((field.key === 'exploreLabel' || field.key === 'animateExplore') && values.showExplore === 'false') return false
    if (field.key === 'quote' && values.showQuote === 'false') return false
    if (field.key === 'cta' && values.showCta === 'false') return false
    if ((field.key === 'imageFit' || field.key === 'imagePosition') && values.imageMode === 'none') return false
    if (field.key === 'overlay' && values.imageMode !== undefined && values.imageMode !== 'background') return false
    if (field.key === 'speed' && values.animation === 'static') return false
    if ((field.key === 'direction' || field.key === 'pauseOnHover') && values.animation !== undefined && values.animation !== 'marquee') return false
    if (field.key.startsWith('item') && field.key.endsWith('Id')) {
      if ((values.selectionMode || 'automatic') !== 'manual') return false
      const itemNumber = Number(field.key.match(/^item(\d+)Id$/)?.[1] ?? 0)
      const supportedItemCount = Math.max(
        1,
        ...fields.map(({ key }) => Number(key.match(/^item(\d+)Id$/)?.[1] ?? 0)),
      )
      const itemCount = Math.min(supportedItemCount, Math.max(1, Number(values.itemCount) || 3))
      if (itemNumber > itemCount) return false
    }
    if (field.key === 'subtitle' && values.showSubtitle === 'false') return false
    if (field.key === 'badgeText' && values.showBadge === 'false') return false
    if (field.key === 'viewAllText' && values.showViewAll === 'false') return false
    if (/^tile\d+Label$/.test(field.key) && values.showLabels === 'false') return false
    if (field.key === 'labelsHeading' && values.showLabels === 'false') return false
    if (field.key === 'columns' && fields.some(({ key }) => key === 'maxItems') && (values.layout || 'mosaic') !== 'grid') return false
    if (field.key === 'mosaicPattern' && (values.layout || 'mosaic') !== 'mosaic') return false
    if (featuredScroll && field.key === 'targetType' && values.showViewAll === 'false') return false
    const comboProductMatch = field.key.match(/^combo(\d+)Item(\d+)Id$/)
    if (comboProductMatch) {
      if ((values.selectionMode || 'automatic') !== 'manual') return false
      if (Number(comboProductMatch[2]) > comboItemCount) return false
    }
    if (
      ['imageShape', 'imageSize', 'imageFit', 'imagePosition'].includes(field.key) &&
      (values.showImages === 'false' || values.showImage === 'false')
    ) return false
    if (sectionPromotion && field.key === 'discountPercent' && (values.discountMode || 'percentage') !== 'percentage') return false
    if (sectionPromotion && field.key === 'campaignPrice' && (values.discountMode || 'percentage') !== 'fixed-price') return false
    if (sectionPromotion && field.key === 'discountPolicy' && (values.discountMode || 'percentage') === 'none') return false
    if (
      sectionPromotion &&
      ['campaignEndsAt', 'countdownLabel', 'timerBgColor', 'timerTextColor'].includes(field.key) &&
      values.countdownEnabled !== 'true'
    ) return false
    if (['buttonStyle', 'buttonIcon', 'buttonSize', 'buttonBgColor', 'buttonTextColor'].includes(field.key) && values.ctaMode !== 'custom') return false
    if (field.key === 'ctaText' && values.ctaMode === 'custom' && (values.buttonStyle || 'icon') === 'icon') return false

    if (promoSlider) {
      if (
        ['flashCampaignEndsAt', 'flashCountdownLabel'].includes(field.key) &&
        values.flashCountdownEnabled !== 'true'
      ) return false
      const flashOfferType = values.flashOfferType || 'none'
      const freebieOfferType = values.freebieOfferType || 'promo-only'
      const freebieQualifierMode = values.freebieQualifierMode || 'category'
      if (/^flashItem[1-4]Id$/.test(field.key) && flashOfferType !== 'buy-2-pay-1') return false
      if (field.key === 'flashDiscountPolicy' && flashOfferType !== 'buy-2-pay-1') return false
      if (/^freebie(?:Qualifier|Reward)/.test(field.key) && freebieOfferType !== 'gift-with-purchase') return false
      if (['freebieTimingEnabled', 'freebieStartsAt', 'freebieEndsAt'].includes(field.key) && freebieOfferType !== 'gift-with-purchase') return false
      if (field.key === 'freebieQualifierCategoryId' && freebieQualifierMode !== 'category') return false
      if (/^freebieQualifierItem[1-4]Id$/.test(field.key) && freebieQualifierMode !== 'products') return false
      if (['freebieStartsAt', 'freebieEndsAt'].includes(field.key) && values.freebieTimingEnabled !== 'true') return false
      if (field.key === 'freebieEmoji' && values.freebieImageSource && values.freebieImageSource !== 'emoji') return false
      if (['freebieImageFit', 'freebieImagePosition'].includes(field.key) && ['emoji', 'none'].includes(values.freebieImageSource || 'emoji')) return false
      for (const prefix of ['flash', 'freebie', 'loyalty'] as const) {
        if (
          prefix === 'flash'
          && flashOfferType !== 'none'
          && [`${prefix}TargetType`, `${prefix}CategoryId`, `${prefix}ProductId`, `${prefix}CtaText`].includes(field.key)
        ) return false
        const targetType = values[`${prefix}TargetType`]
          || (prefix === 'loyalty' ? 'member' : prefix === 'freebie' && values.freebieCategoryId ? 'category' : 'none')
        if (field.key === `${prefix}CategoryId` && targetType !== 'category') return false
        if (field.key === `${prefix}ProductId` && targetType !== 'product') return false
        if (field.key === `${prefix}CtaText` && targetType === 'none') return false
        if (prefix === 'freebie' && freebieOfferType === 'gift-with-purchase' && [`${prefix}TargetType`, `${prefix}CategoryId`, `${prefix}ProductId`].includes(field.key)) return false
      }
      const slide = PROMO_SLIDES.find(({ prefix }) =>
        field.key.startsWith(prefix) &&
        field.key !== `${prefix}Heading` &&
        field.key !== `${prefix}Enabled`,
      )
      if (slide && !promoSlideOn(values, slide.prefix, slide.defaultOn && legacyPromoSpecialCardsDefaultOn)) return false
    }

    if (field.key.startsWith('combo2') && comboCount < 2) return false
    if (field.key.startsWith('combo3') && comboCount < 3) return false

    return true
  })
}

export function resolveSectionSettingValue(
  field: SectionSettingField,
  values: Record<string, string>,
  promoSlider = isPromoSliderFields([field]),
) {
  const stored = values[field.key]
  if (stored !== undefined) return stored
  if (promoSlider && field.key === 'sourceMode') return resolvePromoSliderSourceMode(values)
  if (field.key === 'contentPositionX') {
    if (values.align === 'center') return '50'
    if (values.align === 'right') return '100'
  }
  if (field.default !== undefined) return String(field.default)
  if (!promoSlider || !field.key.endsWith('Enabled')) return ''
  const slide = PROMO_SLIDES.find(({ prefix }) => field.key === `${prefix}Enabled`)
  const legacySpecialCardsDefaultOn = resolvePromoSliderSourceMode(values) !== 'active'
  return slide?.defaultOn && legacySpecialCardsDefaultOn ? 'true' : 'false'
}

export function getSectionSettingLabel(field: SectionSettingField, targetType: string) {
  if (field.key !== 'targetId') return field.label
  return targetType === 'category' ? 'Kategori' : 'Ürün'
}

export function sectionSettingControlId(key: string) {
  return `section-field-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

export function groupMenuItems(items: MenuItemRef[]) {
  const groups: Array<{ categoryName: string; items: MenuItemRef[] }> = []
  const indexes = new Map<string, number>()
  for (const item of items) {
    let index = indexes.get(item.categoryName)
    if (index === undefined) {
      index = groups.length
      indexes.set(item.categoryName, index)
      groups.push({ categoryName: item.categoryName, items: [] })
    }
    groups[index]!.items.push(item)
  }
  return groups
}
