import type { GarsonlessTheme, HomeSectionDefinitionId } from '@garsonless/design-engine'
import { createInitialSectionSettings, HOME_SECTION_LIBRARY, SECTION_GROUPS } from './theme-editor-section-registry'
import { createHomeBlock, ensureHomeV2, homeV2Patch } from './home-theme-editor-model'

export function createHomeThemeEditorController({
  theme,
  query,
  group,
  setQuery,
  setGroup,
  openPicker,
  closePicker,
  updateTheme,
  selectBlock,
  showDesignSurface,
}: {
  theme: GarsonlessTheme
  query: string
  group: (typeof SECTION_GROUPS)[number]
  setQuery: (value: string) => void
  setGroup: (value: (typeof SECTION_GROUPS)[number]) => void
  openPicker: () => void
  closePicker: () => void
  updateTheme: (patch: Partial<GarsonlessTheme>) => void
  selectBlock: (id: string) => void
  showDesignSurface: () => void
}) {
  const state = ensureHomeV2(theme)
  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')
  const filteredSections = HOME_SECTION_LIBRARY.filter((section) =>
    (group === 'Tümü' || section.group === group)
    && (!normalizedQuery || `${section.label} ${section.sub} ${section.group}`.toLocaleLowerCase('tr-TR').includes(normalizedQuery)))
  const groups = SECTION_GROUPS.filter((candidate) => candidate === 'Tümü' || HOME_SECTION_LIBRARY.some((section) => section.group === candidate))
  return {
    state,
    filteredSections,
    groups,
    open: () => { setGroup('Tümü'); setQuery(''); openPicker() },
    add: (sectionId: string) => {
      const definition = HOME_SECTION_LIBRARY.find((section) => section.id === sectionId)
      if (!definition) return
      if (definition.singleton) {
        const existing = state.home.blocks.find((block) => block.sectionId === sectionId)
        if (existing) {
          selectBlock(existing.id)
          closePicker()
          showDesignSurface()
          return
        }
      }
      const block = createHomeBlock(definition.id as HomeSectionDefinitionId, state.home.blocks)
      const blocks = sectionId === 'storefront-video-hero'
        ? [block, ...state.home.blocks]
        : [...state.home.blocks, block]
      const initialSettings = createInitialSectionSettings(sectionId)
      const sectionSettings = Object.keys(initialSettings).length > 0
        ? { ...state.sectionSettings, [block.id]: initialSettings }
        : state.sectionSettings
      updateTheme(homeV2Patch(theme, { ...state.home, blocks }, sectionSettings))
      selectBlock(block.id)
      closePicker()
      showDesignSurface()
    },
  }
}
