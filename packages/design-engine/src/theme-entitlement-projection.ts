/**
 * Runtime rendering boundary for paid theme sections. A theme created during a
 * Pro trial (or before a downgrade) keeps every persisted block; only the
 * sections the tenant is not entitled to are dropped from the projection that
 * reaches a browser. Nothing here touches persistence, so re-entitling a
 * section brings it back untouched.
 *
 * This module is deliberately pure and browser-safe: the public menu resolves
 * it on the server, and the theme editor resolves it again before pushing a
 * live preview theme into the preview iframe.
 */
import { getSectionDefinitionId } from './section-blocks'
import type { GarsonlessTheme, HomeSectionType } from './schema'

/** Video Hero is billed on its own so it can be sold below Pro as an add-on. */
export const VIDEO_HERO_SECTION_ID = 'storefront-video-hero'

/** Sections covered by the bundled `theme_advanced_sections` entitlement. */
export const ADVANCED_THEME_SECTION_IDS: ReadonlySet<string> = new Set([
  'featured-scroll',
  'chef-pick',
  'combo-ribbon',
  'discount-badge',
  'promo-slider',
  'gallery',
  'request-buttons',
])

/**
 * Legacy `surfaces.home.sections` predate section definition ids. Map each
 * paid section type onto the definition id that bills it so a tenant holding
 * only the Video Hero add-on keeps its legacy hero video.
 */
const LEGACY_HOME_SECTION_BILLING: Partial<Record<HomeSectionType, string>> = {
  'hero-video': VIDEO_HERO_SECTION_ID,
  'featured-products': 'featured-scroll',
  gallery: 'gallery',
  'promo-slider': 'promo-slider',
}

export type ThemeSectionAccess = {
  advancedSections: boolean
  videoHero: boolean
}

/** Section definition ids the tenant may not render. Empty set = no filtering. */
export function gatedThemeSectionIds(access: ThemeSectionAccess): ReadonlySet<string> {
  const gated = new Set<string>()
  if (!access.advancedSections) for (const id of ADVANCED_THEME_SECTION_IDS) gated.add(id)
  if (!access.videoHero) gated.add(VIDEO_HERO_SECTION_ID)
  return gated
}

function legacySectionDefinitionId(type: HomeSectionType): string | null {
  return LEGACY_HOME_SECTION_BILLING[type] ?? null
}

/**
 * Drops every gated section from the runtime projection. The input theme is
 * never mutated; the persisted document keeps all blocks and their settings.
 */
export function projectThemeForSectionAccess(
  theme: GarsonlessTheme,
  access: ThemeSectionAccess,
): GarsonlessTheme {
  const gated = gatedThemeSectionIds(access)
  if (gated.size === 0) return theme

  const removedSettingKeys = new Set<string>()
  const pageBlocks = (theme.pageBlocks ?? []).filter((block) => {
    const sectionId = getSectionDefinitionId(block)
    if (sectionId === null || !gated.has(sectionId)) return true
    removedSettingKeys.add(block.id)
    removedSettingKeys.add(sectionId)
    return false
  })

  const home = theme.surfaces?.home
  const homeBlocks = (home?.blocks ?? []).filter((block) => {
    if (!gated.has(block.sectionId)) return true
    removedSettingKeys.add(block.id)
    removedSettingKeys.add(block.sectionId)
    return false
  })
  const homeSections = (home?.sections ?? []).filter((section) => {
    const sectionId = legacySectionDefinitionId(section.type)
    if (sectionId === null || !gated.has(sectionId)) return true
    removedSettingKeys.add(section.id)
    return false
  })

  const sectionSettings = Object.fromEntries(
    Object.entries(theme.sectionSettings ?? {}).filter(([key]) => !removedSettingKeys.has(key)),
  )

  return {
    ...theme,
    pageBlocks,
    sectionSettings,
    ...(theme.surfaces && home ? {
      surfaces: {
        ...theme.surfaces,
        home: { ...home, blocks: homeBlocks, sections: homeSections },
      },
    } : {}),
  }
}

/**
 * Comparable snapshot of only the gated sections. Publish and draft commands
 * compare it before and after a write so an unentitled tenant can keep its
 * existing paid blocks but cannot add, reorder or reconfigure them.
 */
export function gatedThemeSectionProjection(
  theme: GarsonlessTheme,
  gated: ReadonlySet<string>,
): unknown {
  const settings = theme.sectionSettings ?? {}
  const pageBlocks = (theme.pageBlocks ?? []).flatMap((block, index) => {
    const sectionId = getSectionDefinitionId(block)
    if (sectionId === null || !gated.has(sectionId)) return []
    return [{ index, block, settings: settings[block.id] ?? null, sectionSettings: settings[sectionId] ?? null }]
  })
  const home = theme.surfaces?.home
  const homeSections = (home?.sections ?? []).flatMap((section, index) => {
    const sectionId = legacySectionDefinitionId(section.type)
    if (sectionId === null || !gated.has(sectionId)) return []
    return [{ index, section }]
  })
  const homeBlocks = (home?.blocks ?? []).flatMap((block, index) => (
    gated.has(block.sectionId)
      ? [{ index, block, settings: settings[block.id] ?? null, sectionSettings: settings[block.sectionId] ?? null }]
      : []
  ))
  return { pageBlocks, homeSections, homeBlocks }
}

/** True when both themes carry an identical projection of the gated sections. */
export function hasSameGatedThemeSections(
  left: GarsonlessTheme,
  right: GarsonlessTheme,
  gated: ReadonlySet<string>,
): boolean {
  if (gated.size === 0) return true
  return JSON.stringify(gatedThemeSectionProjection(left, gated))
    === JSON.stringify(gatedThemeSectionProjection(right, gated))
}
