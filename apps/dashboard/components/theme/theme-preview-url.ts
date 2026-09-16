import { CANONICAL_THEME_ID, isThemeTemplateId, type ThemeEditorSurface, type AuthPreviewState, type AccountPreviewState, type CheckoutPreviewState } from '@garsonless/design-engine'

export function buildThemePreviewUrl(input: {
  menuBaseUrl: string
  restaurantSlug: string
  templateId: string
  previewAccessToken: string
  surface: ThemeEditorSurface
  authState: string
  accountState: string
  checkoutState: string
}): string {
  const params = new URLSearchParams({ preview: '1', surface: input.surface })
  params.set('template', isThemeTemplateId(input.templateId) ? input.templateId : CANONICAL_THEME_ID)
  params.set('previewAccess', input.previewAccessToken)
  if (input.surface === 'auth') params.set('state', input.authState)
  if (input.surface === 'account') params.set('state', input.accountState)
  if (input.surface === 'checkout') params.set('state', input.checkoutState)
  const path = input.surface === 'menu'
    ? `/${encodeURIComponent(input.restaurantSlug)}/menu`
    : `/theme-preview/${encodeURIComponent(input.restaurantSlug)}`
  return `${input.menuBaseUrl.replace(/\/$/, '')}${path}?${params.toString()}`
}

export function buildThemePreviewContext(surface: ThemeEditorSurface, authState: AuthPreviewState, accountState: AccountPreviewState, checkoutState: CheckoutPreviewState) {
  return {
    surface,
    ...(surface === 'auth' ? { state: authState } : {}),
    ...(surface === 'account' ? { state: accountState } : {}),
    ...(surface === 'checkout' ? { state: checkoutState } : {}),
  } as const
}
