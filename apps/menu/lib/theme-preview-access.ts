import {
  resolveThemePreviewSigningSecret,
  verifyThemePreviewAccessToken,
} from '@garsonless/db/server'

export function hasThemePreviewAccess(input: {
  token: string | string[] | undefined
  restaurantId: string
  slug: string
}): boolean {
  return verifyThemePreviewAccessToken(
    typeof input.token === 'string' ? input.token : null,
    { restaurantId: input.restaurantId, slug: input.slug },
    resolveThemePreviewSigningSecret(),
  )
}
