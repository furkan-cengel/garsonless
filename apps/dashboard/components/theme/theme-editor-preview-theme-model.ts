import type { GarsonlessTheme } from '@garsonless/design-engine'
import { SECTION_LIBRARY_IDS } from './theme-editor-section-registry'
import {
  buildPageBlocks,
  normalizePageBlocksForCategoryScope,
  type MenuCategory,
} from './theme-page-flow-model'

export function createThemeEditorPreviewDeriver(
  defaults: GarsonlessTheme,
  menuCategories: MenuCategory[],
) {
  return (overrides: Partial<GarsonlessTheme>): GarsonlessTheme => {
    const merged = { ...defaults, ...overrides } as GarsonlessTheme
    const pageBlocks = normalizePageBlocksForCategoryScope(
      buildPageBlocks(merged, menuCategories, SECTION_LIBRARY_IDS),
      menuCategories,
    )

    return {
      ...merged,
      pageBlocks,
      sections: pageBlocks
        .filter((block) => block.type === 'section')
        .map((block) => block.id),
    }
  }
}
