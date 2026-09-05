import type { GarsonlessTheme } from './schema'
import { inspectAuthSurfaceContrast } from './auth-surface-policy'
import { inspectCheckoutSurfaceContrast } from './checkout-surface-policy'
import { inspectMenuHeaderContrast } from './menu-surface-policy'
import { inspectMenuThemeContrast } from './menu-theme-surface-policy'
import { inspectMenuNavigationContrast } from './menu-navigation-surface-policy'
import { inspectMenuCardSurfaceContrast } from './menu-card-surface-policy'
import { inspectMenuCartContrast } from './menu-cart-surface-policy'
import { inspectMenuFooterContrast } from './menu-footer-surface-policy'

/** One publication contract shared by editor guidance and server enforcement. */
export function inspectThemePublishContrast(theme: GarsonlessTheme) {
  return {
    authContrastIssues: inspectAuthSurfaceContrast(theme),
    checkoutContrastIssues: inspectCheckoutSurfaceContrast(theme),
    menuHeaderContrastIssues: inspectMenuHeaderContrast(theme),
    menuThemeContrastIssues: inspectMenuThemeContrast(theme),
    menuNavigationContrastIssues: inspectMenuNavigationContrast(theme),
    menuCardContrastIssues: inspectMenuCardSurfaceContrast(theme),
    menuCartContrastIssues: inspectMenuCartContrast(theme),
    menuFooterContrastIssues: inspectMenuFooterContrast(theme),
  }
}
