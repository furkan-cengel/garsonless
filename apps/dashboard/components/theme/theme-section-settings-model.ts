import type { SectionSettingField } from './theme-editor-properties-model'

const PROMO_SLIDES = [
  { prefix: 'coupon', defaultOn: true },
  { prefix: 'flash', defaultOn: true },
  { prefix: 'freebie', defaultOn: false },
  { prefix: 'loyalty', defaultOn: false },
  { prefix: 'combo', defaultOn: true },
] as const

type MenuItemRef = {
  id: string
  name: string
  categoryId: string
  categoryName: string
  price?: number
  images?: unknown
  isAvailable?: boolean
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

const LEGACY_PROMO_MANUAL_PREFIXES = ['coupon', 'flash', 'freebie', 'loyalty', 'combo'] as const

export function resolvePromoSliderSourceMode(values: Record<string, string>) {
  const stored = values.sourceMode
  if (stored === 'active' || stored === 'mixed' || stored === 'manual') return stored
  const hasLegacyManualSettings = Object.keys(values).some((key) =>
    LEGACY_PROMO_MANUAL_PREFIXES.some((prefix) => key.startsWith(prefix)),
  )
  return hasLegacyManualSettings ? 'manual' : 'active'
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
  const comboItemCount = Math.min(3, Math.max(2, Number(values.itemsPerCombo) || 2))
  const promoSlider = isPromoSliderFields(fields)
  const promoSourceMode = promoSlider ? resolvePromoSliderSourceMode(values) : 'active'
  const featuredScroll = fields.some((field) => field.key === 'cardWidth' && field.label === 'Kart Genişliği')
  const sectionPromotion = fields.some((field) =>
    ['discountMode', 'countdownEnabled', 'campaignEndsAt', 'countdownLabel', 'timerBgColor', 'timerTextColor']
      .includes(field.key),
  )

  return fields.filter((field) => {
    if (field.key === 'targetId' && targetType !== 'category' && targetType !== 'product') return false
    if (field.key === 'targetUrl' && targetType !== 'link') return false
    if (field.key === 'linkText' && targetType !== 'link') return false
    if (field.key === 'eyebrow' && values.showEyebrow === 'false') return false
    if (field.key === 'title' && values.showTitle === 'false') return false
    if (field.key === 'body' && values.showBody === 'false') return false
    if (field.key === 'repeatText' && values.showRepeatText === 'false') return false
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
      if (field.key === 'activeCampaignIds' && promoSourceMode === 'manual') return false
      if (field.key === 'manualHeading' && promoSourceMode === 'active') return false
      if (
        ['flashCampaignEndsAt', 'flashCountdownLabel'].includes(field.key) &&
        values.flashCountdownEnabled !== 'true'
      ) return false
      if (
        promoSourceMode === 'active' &&
        (field.key === 'couponHeading' || LEGACY_PROMO_MANUAL_PREFIXES.some((prefix) => field.key.startsWith(prefix)))
      ) return false
      const slide = PROMO_SLIDES.find(({ prefix }) =>
        field.key.startsWith(prefix) &&
        field.key !== `${prefix}Heading` &&
        field.key !== `${prefix}Enabled`,
      )
      if (slide && !promoSlideOn(values, slide.prefix, slide.defaultOn)) return false
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
  if (field.default !== undefined) return String(field.default)
  if (!promoSlider || !field.key.endsWith('Enabled')) return ''
  const slide = PROMO_SLIDES.find(({ prefix }) => field.key === `${prefix}Enabled`)
  return slide?.defaultOn ? 'true' : 'false'
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
