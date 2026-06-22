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
  applyGarsonlessTheme,
  applyPageConfig,
  applyComponentConfig,
  applyFullConfig,
  buildFontsUrl,
  buildFontsUrlFromTheme,
} from './apply'
