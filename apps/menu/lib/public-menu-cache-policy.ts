export const PUBLIC_MENU_CACHE_SECONDS = 300

export function publicMenuCacheKey(
  resource: 'categories' | 'items',
  restaurantId: string,
  revision: number,
): string[] {
  return [`public-menu-${resource}-v2`, restaurantId, String(revision)]
}
