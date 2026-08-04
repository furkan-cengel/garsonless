export type {
  AuthErrorIcon,
  AuthErrorStateTheme,
  AuthPreviewState,
  AuthHeaderTheme,
  AuthOtpStateTheme,
  AuthStateContentAlign,
  AuthStateContentWidth,
  AuthStateLayoutTheme,
  AuthSuccessIcon,
  AuthSuccessStateTheme,
  AuthSurfaceStatesTheme,
  AuthSurfaceTheme,
  CheckoutErrorIcon,
  CheckoutErrorStateTheme,
  CheckoutPaymentContentWidth,
  CheckoutPaymentDensity,
  CheckoutPaymentLayoutTheme,
  CheckoutPaymentStateTheme,
  CheckoutPreviewState,
  CheckoutResultContentAlign,
  CheckoutResultContentWidth,
  CheckoutResultLayoutTheme,
  CheckoutSuccessIcon,
  CheckoutSuccessStateTheme,
  CheckoutSurfaceStatesTheme,
  CheckoutSurfaceTheme,
  CheckoutTablePaymentIcon,
  CheckoutTablePaymentStateTheme,
  GarsonlessTheme,
  HomeSectionType,
  HomeSectionDefinitionId,
  HomeSurfaceBlock,
  HomeSurfaceSection,
  HomeSurfaceTheme,
  ThemeEditorSurface,
  ThemePageBlock,
  ThemeSectionVisibility,
  ThemeSectionVisibilityMode,
  ThemeSurfaceOverride,
  ThemeSurfaces,
} from './schema'
export { DEFAULT_AUTH_STATES, DEFAULT_CHECKOUT_STATES, DEFAULT_THEME } from './schema'

export {
  resolveAuthErrorState,
  resolveAuthOtpState,
  resolveAuthSuccessState,
  type ResolvedAuthErrorStateTheme,
  type ResolvedAuthOtpStateTheme,
  type ResolvedAuthStateLayoutTheme,
  type ResolvedAuthSuccessStateTheme,
} from './auth-state-policy'

export {
  AUTH_SURFACE_DEFAULTS,
  contrastRatio,
  inspectAuthSurfaceContrast,
  resolveAuthSurfacePalette,
  type AuthContrastIssue,
  type AuthSurfacePalette,
} from './auth-surface-policy'

export {
  resolveCheckoutErrorState,
  resolveCheckoutPaymentState,
  resolveCheckoutSuccessState,
  resolveCheckoutTablePaymentState,
  type ResolvedCheckoutErrorStateTheme,
  type ResolvedCheckoutPaymentLayoutTheme,
  type ResolvedCheckoutPaymentStateTheme,
  type ResolvedCheckoutResultLayoutTheme,
  type ResolvedCheckoutSuccessStateTheme,
  type ResolvedCheckoutTablePaymentStateTheme,
} from './checkout-state-policy'

export {
  inspectCheckoutSurfaceContrast,
  resolveCheckoutSurfacePalette,
  type CheckoutContrastIssue,
  type CheckoutSurfacePalette,
} from './checkout-surface-policy'

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
export {
  resolveMenuActionPlacements,
  type MenuActionCapabilities,
  type MenuActionPlacements,
} from './menu-action-placement'
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

export {
  THEME_PREVIEW_CHANNEL,
  THEME_PREVIEW_VERSION,
  createFullThemePreviewCommand,
  createOpenThemeNavDrawerCommand,
  createSetThemePreviewContextCommand,
  createScrollToThemeComponentCommand,
  createThemeAppliedEvent,
  createThemeComponentClickEvent,
  createThemePreviewReadyEvent,
  parseThemePreviewCommand,
  parseThemePreviewEvent,
  type ThemePreviewCommand,
  type ThemePreviewContext,
  type ThemePreviewEvent,
} from './theme-preview-protocol'
