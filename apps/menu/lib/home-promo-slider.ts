import type { HomeSurfaceBlock } from '@garsonless/design-engine'
import type { MenuItem } from '@garsonless/ui/menu'
import { deriveActivePromoSliderCampaigns } from '@garsonless/ui/themes/default/promoSliderCampaignModel'

export function deriveHomePromoSliderCampaigns({
  blocks,
  sectionSettings,
  items,
  now,
}: {
  blocks: HomeSurfaceBlock[]
  sectionSettings: Record<string, Record<string, string>>
  items: MenuItem[]
  now?: number
}) {
  return deriveActivePromoSliderCampaigns({
    pageBlocks: blocks.filter((block) => block.enabled).map((block) => ({ type: 'section' as const, id: block.id, sectionId: block.sectionId })),
    sectionSettings,
    items,
    ...(now !== undefined ? { now } : {}),
  })
}
