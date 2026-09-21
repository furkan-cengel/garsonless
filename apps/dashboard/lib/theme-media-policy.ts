const THEME_MEDIA_IMAGE_MAX_BYTES = 8 * 1024 * 1024
const THEME_MEDIA_ICON_MAX_BYTES = 2 * 1024 * 1024
export const THEME_MEDIA_VIDEO_MAX_BYTES = 8 * 1024 * 1024
export const THEME_MEDIA_VIDEO_MAX_SECONDS = 15
export const THEME_MEDIA_MAX_PIXELS = 24_000_000

const THEME_MEDIA_PURPOSES = [
  'section-image',
  'section-icon',
  'gallery-image',
  'home-hero-poster',
  'auth-header-background',
  'auth-header-logo',
] as const

export type ThemeMediaPurpose = (typeof THEME_MEDIA_PURPOSES)[number]

const THEME_MEDIA_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type ThemeMediaInputMime = (typeof THEME_MEDIA_ALLOWED_TYPES)[number]

export function isThemeMediaPurpose(value: string): value is ThemeMediaPurpose {
  return THEME_MEDIA_PURPOSES.includes(value as ThemeMediaPurpose)
}

export function themeMediaMaximumBytes(purpose: ThemeMediaPurpose): number {
  return purpose === 'section-icon' || purpose === 'auth-header-logo'
    ? THEME_MEDIA_ICON_MAX_BYTES
    : THEME_MEDIA_IMAGE_MAX_BYTES
}

export function themeMediaMaximumEdge(purpose: ThemeMediaPurpose): number {
  return purpose === 'section-icon' || purpose === 'auth-header-logo' ? 512 : 2_400
}

export function validateThemeMediaMetadata(input: {
  size: number
  type: string
  purpose: ThemeMediaPurpose
}): { ok: true } | { ok: false; error: string } {
  const noun = input.purpose === 'section-icon'
    ? 'İkon'
    : input.purpose === 'auth-header-logo' ? 'Logo' : 'Görsel'
  if (input.size <= 0) return { ok: false, error: `Boş ${noun.toLocaleLowerCase('tr-TR')} dosyası yüklenemez.` }
  if (input.size > themeMediaMaximumBytes(input.purpose)) {
    const maximumMb = themeMediaMaximumBytes(input.purpose) / (1024 * 1024)
    return { ok: false, error: `${noun} en fazla ${maximumMb} MB olabilir.` }
  }
  if (!THEME_MEDIA_ALLOWED_TYPES.includes(input.type as ThemeMediaInputMime)) {
    return { ok: false, error: `${noun} için yalnız JPEG, PNG veya WebP yükleyin.` }
  }
  return { ok: true }
}

function themeMediaStoragePrefix(restaurantId: string): string {
  return `restaurants/${restaurantId}/theme/`
}

export function parseOwnedThemeMediaPath(input: {
  publicUrl: string
  restaurantId: string
  storageOrigin: string
}): string | null {
  let parsed: URL
  let allowedOrigin: string
  try {
    parsed = new URL(input.publicUrl)
    allowedOrigin = new URL(input.storageOrigin).origin
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  if (parsed.origin !== allowedOrigin) return null

  const marker = '/storage/v1/object/public/restaurant-assets/'
  const markerIndex = parsed.pathname.indexOf(marker)
  if (markerIndex < 0) return null

  let path: string
  try {
    path = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length))
  } catch {
    return null
  }

  const libraryPrefix = `restaurants/${input.restaurantId}/library/`
  if (path.startsWith(libraryPrefix) && /^[0-9a-f-]{36}\/(image\.webp|menu\.webp|logo\.webp|video\.(mp4|webm))$/i.test(path.slice(libraryPrefix.length))) return path

  const expectedPrefix = themeMediaStoragePrefix(input.restaurantId)
  if (!path.startsWith(expectedPrefix)) return null
  const suffix = path.slice(expectedPrefix.length)
  if (!/^(?:(?:section-image|section-icon|gallery-image|home-hero-poster|auth-header-background|auth-header-logo)\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp|home-hero-video\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:mp4|webm))$/i.test(suffix)) return null
  return path
}

export function themeDocumentContainsMediaUrl(value: unknown, targetUrl: string): boolean {
  if (value === targetUrl) return true
  if (Array.isArray(value)) return value.some((entry) => themeDocumentContainsMediaUrl(entry, targetUrl))
  if (!value || typeof value !== 'object') return false
  return Object.values(value as Record<string, unknown>)
    .some((entry) => themeDocumentContainsMediaUrl(entry, targetUrl))
}
