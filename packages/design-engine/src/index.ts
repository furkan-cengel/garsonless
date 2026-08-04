export type {
  AuthErrorIcon,
  AuthErrorStateTheme,
  AuthPreviewState,
  AuthHeaderTheme,
  AuthOtpStateTheme,
  AuthStateLayoutTheme,
  AuthSuccessIcon,
  AuthSuccessStateTheme,
  AuthSurfaceStatesTheme,
  CheckoutErrorIcon,
  CheckoutErrorStateTheme,
  CheckoutPaymentLayoutTheme,
  CheckoutPaymentStateTheme,
  CheckoutPreviewState,
  CheckoutResultLayoutTheme,
  CheckoutSuccessIcon,
  CheckoutSuccessStateTheme,
  CheckoutSurfaceStatesTheme,
  CheckoutTablePaymentIcon,
  CheckoutTablePaymentStateTheme,
  GarsonlessTheme,
  HomeSectionDefinitionId,
  HomeSurfaceBlock,
  HomeSurfaceSection,
  HomeSurfaceTheme,
  ThemeEditorSurface,
  ThemePageBlock,
  ThemeSectionVisibility,
  ThemeSectionVisibilityMode,
  ThemeSurfaces,
} from './schema'
export { DEFAULT_THEME } from './schema'

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
  inspectAuthSurfaceContrast,
  resolveAuthSurfacePalette,
  type AuthContrastIssue,
} from './auth-surface-policy'

export {
  resolveCheckoutErrorState,
  resolveCheckoutPaymentState,
  resolveCheckoutSuccessState,
  resolveCheckoutTablePaymentState,
} from './checkout-state-policy'

export {
  inspectCheckoutSurfaceContrast,
  resolveCheckoutSurfacePalette,
  type CheckoutContrastIssue,
} from './checkout-surface-policy'

export { TEMPLATES } from './templates'
export { CANONICAL_THEME_ID } from './theme-policy'
export {
  resolveMenuActionPlacements,
  type MenuActionPlacements,
} from './menu-action-placement'
export {
  isThemeTemplateId,
  resolveTheme,
  sanitizeThemeTokens,
} from './theme-policy'

export {
  getSectionDefinitionId,
  getSectionVisibility,
  getUniqueSectionDefinitionIds,
  isSectionBlockVisibleInContext,
} from './section-blocks'
export {
  applyGarsonlessTheme,
  buildFontsUrlFromTheme,
} from './apply'

export {
  createFullThemePreviewCommand,
  createOpenThemeNavDrawerCommand,
  createScrollToThemeComponentCommand,
  parseThemePreviewEvent,
  type ThemePreviewCommand,
  type ThemePreviewContext,
} from './theme-preview-protocol'
