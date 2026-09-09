/** Server-owned exclusions use immutable restaurant IDs, never mutable slugs. */
export function excludedRestaurantIds(value: string | undefined): Set<string> {
  const ids = (value ?? '').split(',').map((id) => id.trim().toLowerCase()).filter(Boolean)
  if (ids.some((id) => !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id))) {
    throw new Error('MENU_NOINDEX_RESTAURANT_IDS must contain comma-separated UUIDs')
  }
  return new Set(ids)
}

export function isRestaurantIndexable(id: string, exclusions = process.env['MENU_NOINDEX_RESTAURANT_IDS']): boolean {
  return !excludedRestaurantIds(exclusions).has(id.toLowerCase())
}

export function hasIndexableStorefront(homeEnabled: boolean, experienceEnabled: boolean): boolean {
  return homeEnabled && experienceEnabled
}

export function menuCanonicalPath(slug: string, isMenu: boolean, storefront: boolean): string {
  return `/${encodeURIComponent(slug)}${isMenu && storefront ? '/menu' : ''}`
}

export function privateMenuPath(pathname: string, params: URLSearchParams): boolean {
  return pathname.startsWith('/theme-preview/') || /^\/[^/]+\/table\//.test(pathname) || params.has('preview')
}
