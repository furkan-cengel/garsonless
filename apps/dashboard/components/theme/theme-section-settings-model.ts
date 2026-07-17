import type { SectionSettingField } from './theme-editor-properties-model'

const PROMO_SLIDES = [
  { prefix: 'coupon', defaultOn: true },
  { prefix: 'flash', defaultOn: true },
  { prefix: 'freebie', defaultOn: false },
  { prefix: 'loyalty', defaultOn: false },
  { prefix: 'combo', defaultOn: true },
] as const

type MenuItemRef = { id: string; name: string; categoryId: string; categoryName: string }

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
  return fields.some((field) => field.key === 'couponHeading')
}

export function getVisibleSectionSettingFields(
  fields: SectionSettingField[],
  values: Record<string, string>,
) {
  const targetType = values.targetType || 'none'
  const comboCount = boundedCount(values.comboCount, 3)
  const comboIconCounts: Record<'combo1' | 'combo2' | 'combo3', number> = {
    combo1: boundedCount(values.combo1IconCount, 2),
    combo2: boundedCount(values.combo2IconCount, 2),
    combo3: boundedCount(values.combo3IconCount, 2),
  }
  const promoSlider = isPromoSliderFields(fields)

  return fields.filter((field) => {
    if (field.key === 'targetId' && targetType !== 'category' && targetType !== 'product') return false
    if (field.key === 'targetUrl' && targetType !== 'link') return false

    if (promoSlider) {
      const slide = PROMO_SLIDES.find(({ prefix }) =>
        field.key.startsWith(prefix) &&
        field.key !== `${prefix}Heading` &&
        field.key !== `${prefix}Enabled`,
      )
      if (slide && !promoSlideOn(values, slide.prefix, slide.defaultOn)) return false
    }

    if (field.key.startsWith('combo2') && comboCount < 2) return false
    if (field.key.startsWith('combo3') && comboCount < 3) return false

    for (const prefix of ['combo1', 'combo2', 'combo3'] as const) {
      if (field.key === `${prefix}Icon2` && comboIconCounts[prefix] < 2) return false
      if (field.key === `${prefix}Icon3` && comboIconCounts[prefix] < 3) return false
    }
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
  const groups: Array<{ categoryName: string; items: Array<{ id: string; name: string }> }> = []
  const indexes = new Map<string, number>()
  for (const item of items) {
    let index = indexes.get(item.categoryName)
    if (index === undefined) {
      index = groups.length
      indexes.set(item.categoryName, index)
      groups.push({ categoryName: item.categoryName, items: [] })
    }
    groups[index]!.items.push({ id: item.id, name: item.name })
  }
  return groups
}
