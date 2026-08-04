import {
  DEFAULT_THEME,
  type GarsonlessTheme,
  type HomeSectionDefinitionId,
  type HomeSurfaceBlock,
  type HomeSurfaceTheme,
} from '@garsonless/design-engine'

const HOME_SECTION_IDS = new Set<HomeSectionDefinitionId>([
  'hero-banner',
  'storefront-video-hero',
  'promo-strip',
  'featured-scroll',
  'chef-pick',
  'combo-ribbon',
  'discount-badge',
  'daily-special',
  'promo-slider',
  'gallery',
])

function uniqueBlockId(sectionId: HomeSectionDefinitionId, blocks: readonly HomeSurfaceBlock[]) {
  const base = `home-${sectionId}`
  if (!blocks.some((block) => block.id === base)) return base
  let suffix = 2
  while (blocks.some((block) => block.id === `${base}--${suffix}`)) suffix += 1
  return `${base}--${suffix}`
}

export function createHomeBlock(sectionId: HomeSectionDefinitionId, blocks: readonly HomeSurfaceBlock[]): HomeSurfaceBlock {
  return { id: uniqueBlockId(sectionId, blocks), sectionId, enabled: true }
}

export function ensureHomeV2(theme: GarsonlessTheme): {
  home: HomeSurfaceTheme & { compositionVersion: 2; blocks: HomeSurfaceBlock[] }
  sectionSettings: Record<string, Record<string, string>>
  upgraded: boolean
} {
  const source = theme.surfaces?.home ?? DEFAULT_THEME.surfaces!.home
  if (source.compositionVersion === 2 && source.blocks) {
    const sourceBlocks = source.blocks
    const sectionSettings = { ...(theme.sectionSettings ?? {}) }
    const blocks = sourceBlocks.flatMap((block) => {
      const rawSectionId = String(block.sectionId)
      const oldVideoHero = rawSectionId === 'storefront-hero' && sectionSettings[block.id]?.mediaType === 'video'
      const nextSectionId = oldVideoHero ? 'storefront-video-hero' : rawSectionId
      if (!HOME_SECTION_IDS.has(nextSectionId as HomeSectionDefinitionId)) {
        delete sectionSettings[block.id]
        return []
      }
      if (oldVideoHero) {
        const nextSettings = { ...sectionSettings[block.id] }
        delete nextSettings.mediaType
        sectionSettings[block.id] = nextSettings
      }
      return [{ ...block, sectionId: nextSectionId as HomeSectionDefinitionId }]
    })
    const upgraded = blocks.length !== sourceBlocks.length || blocks.some((block, index) => block.sectionId !== sourceBlocks[index]?.sectionId)
    return {
      home: { ...source, compositionVersion: 2, blocks },
      sectionSettings,
      upgraded,
    }
  }

  const sectionSettings = { ...(theme.sectionSettings ?? {}) }
  // Legacy yayın aynen kalır; editör ilk V2 düzenlemesini boş bir akışla
  // başlatır ve işletme Menü kataloğundaki gerçek bileşenleri seçer.
  const blocks: HomeSurfaceBlock[] = []
  return {
    home: { ...source, compositionVersion: 2, blocks },
    sectionSettings,
    upgraded: true,
  }
}

export function homeV2Patch(
  theme: GarsonlessTheme,
  home: HomeSurfaceTheme & { compositionVersion: 2; blocks: HomeSurfaceBlock[] },
  sectionSettings: Record<string, Record<string, string>>,
): Partial<GarsonlessTheme> {
  const surfaces = theme.surfaces ?? DEFAULT_THEME.surfaces!
  return {
    experienceVersion: 2,
    surfaces: { ...surfaces, home },
    sectionSettings,
  }
}

export function projectHomeV2ForEditor(theme: GarsonlessTheme): GarsonlessTheme {
  const state = ensureHomeV2(theme)
  if (!state.upgraded) return theme
  return {
    ...theme,
    ...homeV2Patch(theme, state.home, state.sectionSettings),
  }
}
