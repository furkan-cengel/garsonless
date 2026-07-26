import {
  getSectionDefinitionId,
  type GarsonlessTheme,
  type ThemePageBlock,
} from '@garsonless/design-engine'
import { resolveSectionCampaignTiming } from '@garsonless/domain/menu'

const AUTO_EXPIRING_SECTION_DEFINITIONS = new Set(['discount-badge', 'daily-special'])

export type TimedSectionInstance = {
  id: string
  endsAtMs: number
}

export function getTimedSectionInstances(
  pageBlocks: ThemePageBlock[],
  sectionSettings: GarsonlessTheme['sectionSettings'],
  now = Date.now(),
): TimedSectionInstance[] {
  return pageBlocks.flatMap((block) => {
    if (block.type !== 'section') return []
    const definitionId = getSectionDefinitionId(block)
    if (!definitionId || !AUTO_EXPIRING_SECTION_DEFINITIONS.has(definitionId)) return []
    const settings = sectionSettings?.[block.id] ?? sectionSettings?.[definitionId] ?? {}
    const timing = resolveSectionCampaignTiming({
      enabled: settings.countdownEnabled,
      endsAt: settings.campaignEndsAt,
      now,
    })
    return timing.enabled && timing.valid && timing.endsAtMs !== null
      ? [{ id: block.id, endsAtMs: timing.endsAtMs }]
      : []
  })
}

export function pruneExpiredTimedSections(
  pageBlocks: ThemePageBlock[],
  sectionSettings: GarsonlessTheme['sectionSettings'],
  now = Date.now(),
) {
  const expiredIds = getTimedSectionInstances(pageBlocks, sectionSettings, now)
    .filter((section) => section.endsAtMs <= now)
    .map((section) => section.id)
  if (expiredIds.length === 0) {
    return { expiredIds, pageBlocks, sectionSettings: sectionSettings ?? {} }
  }

  const expired = new Set(expiredIds)
  const nextSettings = { ...(sectionSettings ?? {}) }
  for (const id of expiredIds) delete nextSettings[id]

  return {
    expiredIds,
    pageBlocks: pageBlocks.filter((block) => !(block.type === 'section' && expired.has(block.id))),
    sectionSettings: nextSettings,
  }
}
