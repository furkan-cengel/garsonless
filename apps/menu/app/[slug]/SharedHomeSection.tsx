'use client'

import { CustomSectionRenderer } from '@garsonless/ui/themes/default/CustomSectionRenderer'
import { deriveActivePromoSliderCampaigns } from '@garsonless/ui/themes/default/promoSliderCampaignModel'
import { useMemo } from 'react'
import type { HomeV2BlockProps } from './HomeV2Block'

export default function SharedHomeSection({ block, onOpenProduct, storeStatus, ...props }: HomeV2BlockProps) {
  const activeCampaigns = useMemo(() => deriveActivePromoSliderCampaigns({
    pageBlocks: [{ type: 'section' as const, id: block.id, sectionId: block.sectionId }],
    sectionSettings: props.theme.sectionSettings ?? {},
    items: props.items,
  }), [block.id, block.sectionId, props.items, props.theme.sectionSettings])
  return <CustomSectionRenderer
    {...props}
    activeCampaigns={activeCampaigns}
    renderContext="home"
    sectionId={block.sectionId}
    sectionInstanceId={block.id}
    {...(storeStatus ? { storeStatus } : {})}
    onQuickAdd={onOpenProduct}
  />
}
