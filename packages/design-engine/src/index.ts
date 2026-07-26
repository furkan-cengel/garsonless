export type {
  GarsonlessTheme,
  ThemePageBlock,
  ThemeSectionVisibility,
  ThemeSectionVisibilityMode,
} from './schema'
export { DEFAULT_THEME } from './schema'

export type {
  MenuPageConfig,
  PageConfig,
  HeaderConfig,
  CategoryNavConfig,
  ProductCardConfig,
  CartDrawerConfig,
} from './schema'
export { DEFAULT_CONFIG } from './schema'

export { TEMPLATES } from './templates'
export { CANONICAL_THEME_ID } from './theme-policy'
export type { TemplateId } from './templates'
export {
  isThemeTemplateId,
  normalizeThemeTemplateId,
  resolveTheme,
  sanitizeThemeTokens,
} from './theme-policy'

export {
  getSectionDefinitionId,
  getSectionVisibility,
  getUniqueSectionDefinitionIds,
  isSectionBlockVisibleInContext,
} from './section-blocks'
export type {
  SectionVisibilityCategory,
  SectionVisibilityContext,
} from './section-blocks'

export {
  applyGarsonlessTheme,
  applyPageConfig,
  applyComponentConfig,
  applyFullConfig,
  buildFontsUrl,
  buildFontsUrlFromTheme,
} from './apply'
