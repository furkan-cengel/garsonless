'use client'

import { CustomSectionRenderer } from '@garsonless/ui/themes/default/CustomSectionRenderer'
import type { HomeV2BlockProps } from './HomeV2Block'

export default function SharedHomeSection({ block, onOpenProduct, onAddCombo, onAddFreebie, onSelectCategory, activeCampaigns, editorPreview, storeStatus, ...props }: HomeV2BlockProps) {
  return <CustomSectionRenderer
    {...props}
    activeCampaigns={activeCampaigns}
    renderContext="home"
    sectionId={block.sectionId}
    sectionInstanceId={block.id}
    comboInteractionState={onAddCombo ? 'enabled' : editorPreview ? 'preview' : 'ordering-disabled'}
    {...(storeStatus ? { storeStatus } : {})}
    onQuickAdd={onOpenProduct}
    {...(onAddCombo ? { onAddCombo: (combo) => onAddCombo(combo, block.sectionId === 'promo-slider' ? {
      selectionMode: 'manual',
      comboCount: '1',
      itemsPerCombo: String(combo.items.length),
      ...Object.fromEntries(combo.items.map((item, index) => [`combo1Item${index + 1}Id`, item.id])),
      combo1Price: String(combo.total),
      combo1Title: combo.title,
    } : props.config) } : {})}
    {...(onAddFreebie ? { onAddFreebie } : {})}
    {...(onSelectCategory ? { onSelectCategory } : {})}
    editorPreview={editorPreview}
  />
}
