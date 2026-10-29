export type {
  AuthErrorIcon,
  AuthErrorStateTheme,
  AuthPreviewState,
  AccountPreviewState,
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
  HomeChromeOverrides,
  HomeChromeTarget,
  HomeChromeThemeOverride,
  HomeSectionDefinitionId,
  HomeSurfaceBlock,
  HomeSurfaceSection,
  HomeSurfaceTheme,
  MenuChromeOverrides,
  MenuFilterPresetId,
  MenuHeaderThemeOverride,
  MenuSurfaceTheme,
  ThemeMenuCustomFilter,
  ThemeEditorSurface,
  ThemePageBlock,
  ThemeSectionVisibility,
  ThemeSectionVisibilityMode,
  ThemeSurfaces,
} from './schema'
export { DEFAULT_THEME } from './schema'

export {
  groupMenuPageBlocksByPlacement,
  normalizeMenuPageBlockCategoryScope,
  resolveMenuPageFlow,
  type MenuPageFlowCategory,
  type ResolveMenuPageFlowInput,
} from './menu-page-flow'

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

export {
  inspectHomeSurfaceContrast,
  resolveHomeSectionColorConfig,
  resolveHomeChromeTheme,
  resolveHomeSurfacePalette,
  snapshotLegacyHomeSectionColors,
  type HomeColorToken,
  type HomeContrastIssue,
  type HomeSurfacePalette,
} from './home-surface-policy'

export {
  inspectMenuHeaderContrast,
  resolveMenuHeaderTheme,
  type MenuHeaderContrastIssue,
} from './menu-surface-policy'

export {
  inspectMenuCardSurfaceContrast,
  type MenuCardContrastIssue,
} from './menu-card-surface-policy'

export {
  buildMenuCartContrastRepairPatch,
  inspectMenuCartContrast,
  resolveReadableMenuForeground,
  type MenuCartContrastIssue,
} from './menu-cart-surface-policy'

export {
  inspectMenuNavigationContrast,
  type MenuNavigationContrastIssue,
} from './menu-navigation-surface-policy'

export {
  buildMenuFooterContrastRepairPatch,
  inspectMenuFooterContrast,
  resolveMenuFooterPalette,
  type MenuFooterContrastIssue,
  type MenuFooterPalette,
} from './menu-footer-surface-policy'

export {
  buildMenuThemeContrastRepairPatch,
  inspectMenuThemeContrast,
  type MenuThemeColorField,
  type MenuThemeContrastIssue,
} from './menu-theme-surface-policy'

export { TEMPLATES } from './templates'
export { CANONICAL_THEME_ID } from './theme-policy'
export {
  resolveFooterCartClearance,
  resolveMenuActionPlacements,
  type FooterCartClearance,
  type FooterCartTriggerStyle,
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
  ADVANCED_THEME_SECTION_IDS,
  VIDEO_HERO_SECTION_ID,
  gatedThemeSectionIds,
  gatedThemeSectionProjection,
  hasSameGatedThemeSections,
  projectThemeForSectionAccess,
  type ThemeSectionAccess,
} from './theme-entitlement-projection'
export {
  applyGarsonlessTheme,
  buildFontsUrlFromTheme,
  resolveThemeFontFamily,
} from './apply'

export {
  createFullThemePreviewCommand,
  createOpenThemeNavDrawerCommand,
  createRevealMenuPageBlockCommand,
  createSetMenuCartPreviewStateCommand,
  createScrollToThemeComponentCommand,
  createThemePreviewNavigationEvent,
  parseThemePreviewEvent,
  MENU_CART_PREVIEW_EVENT,
  type ThemePreviewCommand,
  type ThemePreviewContext,
  type MenuCartPreviewState,
  type MenuPageBlockRevealTarget,
} from './theme-preview-protocol'

export { inspectThemePublishContrast } from './theme-publish-validation'
