export type { GarsonlessTheme } from './schema'
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
export type { TemplateId } from './templates'
export {
  isThemeTemplateId,
  normalizeThemeTemplateId,
  resolveTheme,
  sanitizeThemeTokens,
} from './theme-policy'

export {
  applyGarsonlessTheme,
  applyPageConfig,
  applyComponentConfig,
  applyFullConfig,
  buildFontsUrl,
  buildFontsUrlFromTheme,
} from './apply'
