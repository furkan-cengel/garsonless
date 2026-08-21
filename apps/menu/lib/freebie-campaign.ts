import type { GarsonlessTheme } from '@garsonless/design-engine'
import { getSectionDefinitionId } from '@garsonless/design-engine/section-blocks'
import type { FreebieAddRequest } from '@garsonless/ui/themes'
import type { MenuItem } from '@garsonless/ui/menu'

function sourceMode(settings: Record<string, string>) {
  if (settings.sourceMode === 'active' || settings.sourceMode === 'mixed' || settings.sourceMode === 'manual') return settings.sourceMode
  return Object.keys(settings).some((key) => /^(coupon|flash|freebie|loyalty|combo)/.test(key)) ? 'manual' : 'active'
}

function publishedSliderIds(theme: GarsonlessTheme) {
  const ids = new Set<string>()
  for (const block of theme.pageBlocks ?? []) {
    if (block.type === 'section' && getSectionDefinitionId(block) === 'promo-slider') ids.add(block.id)
  }
  for (const block of theme.surfaces?.home.blocks ?? []) {
    if (block.enabled && block.sectionId === 'promo-slider') ids.add(block.id)
  }
  return [...ids]
}

function campaignTimingActive(settings: Record<string, string>, now: number) {
  if (settings.freebieTimingEnabled !== 'true') return true
  const startsAt = Date.parse(settings.freebieStartsAt ?? '')
  const endsAt = Date.parse(settings.freebieEndsAt ?? '')
  return Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt <= now && endsAt > now
}

export function getNextFreebieCampaignTransition(theme: GarsonlessTheme, now = Date.now()) {
  let next: number | null = null
  for (const sectionInstanceId of publishedSliderIds(theme)) {
    const settings = theme.sectionSettings?.[sectionInstanceId] ?? theme.sectionSettings?.['promo-slider'] ?? {}
    if (sourceMode(settings) === 'active' || settings.freebieEnabled !== 'true' || settings.freebieOfferType !== 'gift-with-purchase' || settings.freebieTimingEnabled !== 'true') continue
    for (const raw of [settings.freebieStartsAt, settings.freebieEndsAt]) {
      const timestamp = Date.parse(raw ?? '')
      if (Number.isFinite(timestamp) && timestamp > now && (next === null || timestamp < next)) next = timestamp
    }
  }
  return next
}

export function resolveFreebieCampaign(input: {
  theme: GarsonlessTheme
  items: MenuItem[]
  sectionInstanceId: string
  now?: number
  fallbackSettings?: Record<string, string> | null
}): FreebieAddRequest | null {
  const available = input.items.filter((item) => item.is_available)
  const liveSettings = input.theme.sectionSettings?.[input.sectionInstanceId] ?? input.theme.sectionSettings?.['promo-slider'] ?? {}
  for (const settings of [input.fallbackSettings, liveSettings]) {
    if (!settings || sourceMode(settings) === 'active' || settings.freebieEnabled !== 'true' || settings.freebieOfferType !== 'gift-with-purchase' || !campaignTimingActive(settings, input.now ?? Date.now())) continue
    const qualifierCategoryId = settings.freebieQualifierMode === 'products' ? '' : settings.freebieQualifierCategoryId?.trim() ?? ''
    const qualifierItems = settings.freebieQualifierMode === 'products'
      ? [1, 2, 3, 4].flatMap((index) => {
          const id = settings[`freebieQualifierItem${index}Id`]?.trim()
          return id ? available.find((item) => item.id === id) ?? [] : []
        })
      : available.filter((item) => item.category_id === qualifierCategoryId)
    const rewardItems = [1, 2, 3, 4].flatMap((index) => {
      const id = settings[`freebieRewardItem${index}Id`]?.trim()
      return id ? available.find((item) => item.id === id) ?? [] : []
    })
    if (qualifierItems.length === 0 || rewardItems.length === 0) continue
    if (qualifierItems.some((item) => rewardItems.some((reward) => reward.id === item.id))) continue
    return {
      sectionInstanceId: input.sectionInstanceId,
      title: settings.freebieTitle?.trim() || 'Ürün al, hediyeni seç',
      ...(qualifierCategoryId ? { qualifierCategoryId } : {}),
      qualifierItems,
      rewardItems,
    }
  }
  return null
}

export function resolveFreebieCampaigns(theme: GarsonlessTheme, items: MenuItem[], now = Date.now()) {
  return publishedSliderIds(theme).flatMap((sectionInstanceId) => {
    const campaign = resolveFreebieCampaign({ theme, items, sectionInstanceId, now })
    return campaign ? [campaign] : []
  })
}

export function resolveAutomaticFreebieForItem(theme: GarsonlessTheme, items: MenuItem[], itemId: string, now = Date.now()) {
  return resolveFreebieCampaigns(theme, items, now).find((campaign) => campaign.qualifierItems.some((item) => item.id === itemId)) ?? null
}
