'use client'

import { useCallback } from 'react'
import type {
  AuthContrastIssue,
  AuthPreviewState,
  CheckoutContrastIssue,
  CheckoutPreviewState,
  MenuCardContrastIssue,
  MenuCartContrastIssue,
  MenuFooterContrastIssue,
  MenuHeaderContrastIssue,
  MenuNavigationContrastIssue,
  MenuThemeContrastIssue,
  ThemeEditorSurface,
} from '@garsonless/design-engine'

interface ThemePublishGuidanceOptions {
  authContrastIssues: AuthContrastIssue[]
  checkoutContrastIssues: CheckoutContrastIssue[]
  menuHeaderContrastIssues: MenuHeaderContrastIssue[]
  menuCardContrastIssues: MenuCardContrastIssue[]
  menuCartContrastIssues: MenuCartContrastIssue[]
  menuFooterContrastIssues: MenuFooterContrastIssue[]
  menuNavigationContrastIssues: MenuNavigationContrastIssue[]
  menuThemeContrastIssues: MenuThemeContrastIssue[]
  taskBased: boolean
  selectGroup: (groupId: string) => void
  setExperienceSurface: (surface: ThemeEditorSurface) => void
  setAuthState: (state: AuthPreviewState) => void
  setCheckoutState: (state: CheckoutPreviewState) => void
  setActiveSurface: (surface: 'design' | 'preview') => void
  flashToast: (message: string) => void
  handlePublish: () => Promise<void>
}

export function useThemePublishGuidance({
  authContrastIssues,
  checkoutContrastIssues,
  menuHeaderContrastIssues,
  menuCardContrastIssues,
  menuCartContrastIssues,
  menuFooterContrastIssues,
  menuNavigationContrastIssues,
  menuThemeContrastIssues,
  taskBased,
  selectGroup,
  setExperienceSurface,
  setAuthState,
  setCheckoutState,
  setActiveSurface,
  flashToast,
  handlePublish,
}: ThemePublishGuidanceOptions) {
  const publishBlockedReason = authContrastIssues.length > 0
    ? 'Giriş yüzeyindeki kritik kontrast sorunlarını düzelt'
    : checkoutContrastIssues.length > 0
      ? 'Checkout yüzeyindeki kritik kontrast sorunlarını düzelt'
      : menuHeaderContrastIssues.length > 0
      ? 'Menü Header kritik kontrast sorunlarını düzelt'
        : menuThemeContrastIssues.length > 0
          ? 'Tema paletindeki kritik kontrast sorunlarını düzelt'
          : menuNavigationContrastIssues.length > 0
          ? 'Menü navigasyonu kritik kontrast sorunlarını düzelt'
          : menuCardContrastIssues.length > 0
            ? 'Ürün kartı kritik kontrast sorunlarını düzelt'
          : menuCartContrastIssues.length > 0
            ? 'Sepet kritik kontrast sorunlarını düzelt'
          : menuFooterContrastIssues.length > 0
            ? 'Footer kritik kontrast sorunlarını düzelt'
          : undefined

  const handlePublishRequest = useCallback(() => {
    const issue = authContrastIssues[0] ?? checkoutContrastIssues[0] ?? menuHeaderContrastIssues[0] ?? menuThemeContrastIssues[0] ?? menuNavigationContrastIssues[0] ?? menuCardContrastIssues[0] ?? menuCartContrastIssues[0] ?? menuFooterContrastIssues[0]
    if (!issue) {
      void handlePublish()
      return
    }

    if (authContrastIssues.length > 0) {
      setExperienceSurface('auth')
      setAuthState('join')
    } else if (checkoutContrastIssues.length > 0) {
      setExperienceSurface('checkout')
      setCheckoutState('cart')
    } else {
      setExperienceSurface('menu')
      selectGroup(menuHeaderContrastIssues.length ? 'header' : menuThemeContrastIssues.length ? 'theme' : menuNavigationContrastIssues.length ? 'nav' : menuCardContrastIssues.length ? 'cards' : menuCartContrastIssues.length ? 'cart' : 'footer')
    }
    if (taskBased) setActiveSurface('design')
    flashToast(`Yayın engeli açıldı: ${issue.label} ${issue.ratio}:1 · gereken ${issue.minimum}:1`)
  }, [
    authContrastIssues,
    checkoutContrastIssues,
    flashToast,
    handlePublish,
    menuCardContrastIssues,
    menuCartContrastIssues,
    menuFooterContrastIssues,
    menuHeaderContrastIssues,
    menuNavigationContrastIssues,
    menuThemeContrastIssues,
    setActiveSurface,
    selectGroup,
    setAuthState,
    setCheckoutState,
    setExperienceSurface,
    taskBased,
  ])

  return { publishBlockedReason, handlePublishRequest }
}
