import type { GarsonlessTheme } from '@garsonless/design-engine'
import { getSectionDefinitionId } from '@garsonless/design-engine/section-blocks'

const PROMO_SLIDES = [
  { prefix: 'coupon', defaultOn: true },
  { prefix: 'flash', defaultOn: true },
  { prefix: 'freebie', defaultOn: false },
  { prefix: 'loyalty', defaultOn: false },
] as const

function slideEnabled(values: Record<string, string>, prefix: string, fallback: boolean) {
  const value = values[`${prefix}Enabled`]
  return value === 'true' || (value !== 'false' && fallback)
}

export function resolvePromoSliderSourceMode(values: Record<string, string>) {
  if (values.sourceMode === 'active' || values.sourceMode === 'mixed' || values.sourceMode === 'manual') return values.sourceMode
  return Object.keys(values).some((key) => PROMO_SLIDES.some(({ prefix }) => key.startsWith(prefix))) ? 'manual' : 'active'
}

export function getPromoSliderSettingIssues(
  values: Record<string, string>,
  now = Date.now(),
  catalogItems: Array<{ id: string; categoryId: string }> = [],
) {
  const issues: string[] = []
  const legacySpecialCardsDefaultOn = resolvePromoSliderSourceMode(values) !== 'active'
  if (slideEnabled(values, 'flash', legacySpecialCardsDefaultOn) && values.flashCountdownEnabled === 'true') {
    const endsAt = Date.parse(values.flashCampaignEndsAt ?? '')
    if (!Number.isFinite(endsAt) || endsAt <= now) issues.push('Flash sayaç için gelecekte geçerli bir bitiş tarihi seçin.')
  }
  if (slideEnabled(values, 'flash', legacySpecialCardsDefaultOn) && values.flashOfferType === 'buy-2-pay-1') {
    const selected = [values.flashItem1Id, values.flashItem2Id, values.flashItem3Id, values.flashItem4Id]
      .map((id) => id?.trim())
      .filter(Boolean)
    if (selected.length === 0) issues.push('Flash 2 al 1 öde kampanyası için en az bir ürün seçin.')
    if (new Set(selected).size !== selected.length) issues.push('Flash 2 al 1 öde ürünleri birbirinden farklı olmalıdır.')
  }
  if (slideEnabled(values, 'freebie', false) && values.freebieOfferType === 'gift-with-purchase') {
    const qualifierMode = values.freebieQualifierMode === 'products' ? 'products' : 'category'
    const qualifierIds = [1, 2, 3, 4].flatMap((index) => {
      const id = values[`freebieQualifierItem${index}Id`]?.trim()
      return id ? [id] : []
    })
    const rewardIds = [1, 2, 3, 4].flatMap((index) => {
      const id = values[`freebieRewardItem${index}Id`]?.trim()
      return id ? [id] : []
    })
    if (qualifierMode === 'category' && !values.freebieQualifierCategoryId?.trim()) issues.push('Bedava ürün kampanyası için uygun ürün kategorisi seçin.')
    if (qualifierMode === 'products' && qualifierIds.length === 0) issues.push('Bedava ürün kampanyası için en az bir uygun ürün seçin.')
    if (rewardIds.length === 0) issues.push('Bedava ürün kampanyası için en az bir hediye ürün seçin.')
    if (new Set(qualifierIds).size !== qualifierIds.length) issues.push('Bedava ürün uygun ürünleri birbirinden farklı olmalıdır.')
    if (new Set(rewardIds).size !== rewardIds.length) issues.push('Bedava ürün hediyeleri birbirinden farklı olmalıdır.')
    if (qualifierIds.some((id) => rewardIds.includes(id))) issues.push('Bir ürün aynı kampanyada hem uygun ürün hem hediye olamaz.')
    if (qualifierMode === 'category' && values.freebieQualifierCategoryId?.trim()) {
      const qualifierCategoryId = values.freebieQualifierCategoryId.trim()
      const rewardOverlapsCategory = rewardIds.some((id, index) => {
        const catalogCategory = catalogItems.find((item) => item.id === id)?.categoryId
        const storedCategory = values[`freebieRewardItem${index + 1}IdCategoryId`]?.trim()
        return (catalogCategory || storedCategory) === qualifierCategoryId
      })
      if (rewardOverlapsCategory) issues.push('Hediye ürün, uygun ürün olarak seçilen kategorinin içinde olamaz.')
    }
    if (values.freebieTimingEnabled === 'true') {
      const startsAt = Date.parse(values.freebieStartsAt ?? '')
      const endsAt = Date.parse(values.freebieEndsAt ?? '')
      if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt >= endsAt) issues.push('Bedava ürün kampanyası için geçerli bir başlangıç ve bitiş tarihi seçin.')
      else if (endsAt <= now) issues.push('Bedava ürün kampanyasının bitiş tarihi gelecekte olmalıdır.')
    }
    const freebieProductIds = new Set([...qualifierIds, ...rewardIds])
    const conflictingIds = new Set<string>()
    if (slideEnabled(values, 'flash', legacySpecialCardsDefaultOn) && values.flashOfferType === 'buy-2-pay-1') {
      for (const id of [values.flashItem1Id, values.flashItem2Id, values.flashItem3Id, values.flashItem4Id]) if (id?.trim()) conflictingIds.add(id.trim())
    }
    if ([...freebieProductIds].some((id) => conflictingIds.has(id))) issues.push('Bedava ürün kampanyasındaki ürünler 2 al 1 öde kampanyasıyla çakışamaz.')
  }
  for (const prefix of ['flash', 'freebie'] as const) {
    if (!slideEnabled(values, prefix, prefix === 'flash' && legacySpecialCardsDefaultOn)) continue
    if (prefix === 'freebie' && values.freebieOfferType === 'gift-with-purchase') continue
    if (prefix === 'flash' && values.flashOfferType === 'buy-2-pay-1') continue
    const targetType = values[`${prefix}TargetType`]
      || (prefix === 'freebie' && values.freebieCategoryId ? 'category' : 'none')
    const label = prefix === 'flash' ? 'Flash' : 'Bedava ürün'
    if (targetType === 'category' && !values[`${prefix}CategoryId`]?.trim() && !(prefix === 'freebie' && values.freebieCategoryId?.trim())) {
      issues.push(`${label} kartı için hedef kategori seçin.`)
    }
    if (targetType === 'product' && !values[`${prefix}ProductId`]?.trim()) issues.push(`${label} kartı için hedef ürün seçin.`)
  }
  return issues
}

export function getThemePromoSliderIssues(theme: GarsonlessTheme, now = Date.now()) {
  const instances = new Set<string>()
  for (const block of theme.pageBlocks ?? []) {
    if (block.type === 'section' && getSectionDefinitionId(block) === 'promo-slider') instances.add(block.id)
  }
  for (const block of theme.surfaces?.home.blocks ?? []) {
    if (block.enabled && block.sectionId === 'promo-slider') instances.add(block.id)
  }
  return Array.from(instances).flatMap((instanceId) => getPromoSliderSettingIssues(
    theme.sectionSettings?.[instanceId] ?? theme.sectionSettings?.['promo-slider'] ?? {},
    now,
  ))
}
