import type { GarsonlessTheme } from '@garsonless/design-engine'
import { getSectionDefinitionId } from '@garsonless/design-engine/section-blocks'
import type { MenuItem } from '@garsonless/ui/menu'
import { resolveComboRibbonGroups } from '@garsonless/ui/themes/default/comboRibbonModel'
import type { ComboAddRequest } from '@garsonless/ui/themes'
import type { ComboIntent } from './combo-intent-params.ts'

export { readComboIntent, removeComboIntentFromUrl } from './combo-intent-params.ts'

/**
 * Rebuild a combo from the current theme and available catalog. URL parameters
 * are identifiers only; prices and products always come from live data.
 */
export function resolveComboIntent(
  intent: ComboIntent,
  theme: GarsonlessTheme,
  items: MenuItem[],
  fallbackConfig?: Record<string, string> | null,
): ComboAddRequest | null {
  const homeBlock = theme.surfaces?.home.blocks?.find(
    (block) => block.enabled && block.id === intent.sectionInstanceId && (block.sectionId === 'combo-ribbon' || block.sectionId === 'promo-slider'),
  )
  const menuBlock = (theme.pageBlocks ?? []).find(
    (block) => block.id === intent.sectionInstanceId && ['combo-ribbon', 'promo-slider'].includes(getSectionDefinitionId(block) ?? ''),
  )
  const liveConfig = homeBlock || menuBlock
    ? theme.sectionSettings?.[intent.sectionInstanceId]
      ?? theme.sectionSettings?.['combo-ribbon']
      ?? {}
    : null
  const isPromoSliderBlock = homeBlock?.sectionId === 'promo-slider'
    || Boolean(menuBlock && getSectionDefinitionId(menuBlock) === 'promo-slider')
  // The single-use handoff is the exact config of the card the guest clicked.
  // Prefer it over a destination theme that may still be one preview update behind.
  const normalizeConfig = (config: Record<string, string>) => {
    if (!isPromoSliderBlock) return config
    return {
      ...config,
      selectionMode: 'manual',
      comboCount: '1',
      itemsPerCombo: config.comboItem3Id ? '3' : '2',
      combo1Item1Id: config.comboItem1Id ?? '',
      combo1Item2Id: config.comboItem2Id ?? '',
      combo1Item3Id: config.comboItem3Id ?? '',
      combo1Price: config.comboPrice ?? '',
      combo1Title: config.comboTitle ?? '',
    }
  }
  const resolved = [fallbackConfig, liveConfig].flatMap((config) => {
    if (!config) return []
    const normalized = normalizeConfig(config)
    const group = resolveComboRibbonGroups(normalized, items).find((candidate) => candidate.index === intent.comboIndex)
    return group ? [{ config: normalized, group }] : []
  })[0]
  if (!resolved) return null

  const { config, group } = resolved
  const customTitle = config[`combo${group.index}Title`]?.trim()
  return {
    sectionInstanceId: intent.sectionInstanceId,
    comboIndex: group.index,
    title: customTitle || (config.editorialVersion === '2'
      ? `${group.items.length} Ürünlük Kombo`
      : group.items.map((item) => item.name).join(' + ')),
    items: group.items,
    catalogTotal: group.catalogTotal,
    total: group.total,
  }
}
