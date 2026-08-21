'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type {
  AccountPreviewState,
  AuthPreviewState,
  CheckoutPreviewState,
  ThemeEditorSurface,
} from '@garsonless/design-engine'

const SURFACES = new Set<ThemeEditorSurface>(['home', 'menu', 'auth', 'account', 'checkout'])

export function useThemeExperienceSurface(homeEnabled: boolean, experienceV2Enabled: boolean, initialHomeSectionId: string | null) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requestedSurface = searchParams.get('surface')
  const initialSurface = experienceV2Enabled && SURFACES.has(requestedSurface as ThemeEditorSurface)
    ? requestedSurface as ThemeEditorSurface
    : homeEnabled ? 'home' : 'menu'
  const [surface, setSurfaceState] = useState<ThemeEditorSurface>(initialSurface)
  const [authState, setAuthState] = useState<AuthPreviewState>('join')
  const [accountState, setAccountState] = useState<AccountPreviewState>('overview')
  const [checkoutState, setCheckoutState] = useState<CheckoutPreviewState>('cart')
  const [selectedHomeSectionId, setSelectedHomeSectionId] = useState<string | null>(initialHomeSectionId)

  useEffect(() => {
    if (!experienceV2Enabled) {
      setSurfaceState('menu')
      return
    }
    if (SURFACES.has(requestedSurface as ThemeEditorSurface)) {
      setSurfaceState(requestedSurface as ThemeEditorSurface)
    }
  }, [experienceV2Enabled, requestedSurface])

  const setSurface = useCallback((next: ThemeEditorSurface) => {
    if (!experienceV2Enabled) return
    if (next === surface) return
    setSurfaceState(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set('surface', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [experienceV2Enabled, pathname, router, searchParams, surface])

  return {
    surface,
    setSurface,
    authState,
    setAuthState,
    accountState,
    setAccountState,
    checkoutState,
    setCheckoutState,
    selectedHomeSectionId,
    setSelectedHomeSectionId,
  }
}
