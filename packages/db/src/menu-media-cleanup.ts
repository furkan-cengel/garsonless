import { createServiceClient } from './service-client'
import { createRestaurantAssetStoragePort, isCanonicalRestaurantAssetPath } from './restaurant-asset-storage-port'
import { readAllPages } from './read-all-pages'

function ownedMenuMediaPath(publicUrl: string, restaurantId: string, storageOrigin: string): string | null {
  try {
    const url = new URL(publicUrl)
    const prefix = '/storage/v1/object/public/restaurant-assets/'
    if (url.origin !== new URL(storageOrigin).origin || url.search || url.hash || !url.pathname.startsWith(prefix)) return null
    const path = url.pathname.slice(prefix.length)
    return path.startsWith(`restaurants/${restaurantId}/items/`) && isCanonicalRestaurantAssetPath(path) ? path : null
  } catch { return null }
}

/** Called only for newly uploaded draft images, never for retired published media. */
export async function removeUnreferencedMenuMedia(input: { publicUrl: string; restaurantId: string; storageOrigin: string }) {
  const path = ownedMenuMediaPath(input.publicUrl, input.restaurantId, input.storageOrigin)
  if (!path) return false
  const service = createServiceClient()
  const [items, categories, themes, drafts, history] = await Promise.all([
    service.from('menu_items').select('id').contains('images', JSON.stringify([input.publicUrl])).limit(1),
    service.from('menu_categories').select('id').eq('image_url', input.publicUrl).limit(1),
    readAllPages((from, to) => service.from('theme_configs').select('tokens').order('restaurant_id').range(from, to)),
    readAllPages((from, to) => service.from('theme_drafts').select('tokens').order('restaurant_id').range(from, to)),
    readAllPages((from, to) => service.from('theme_config_history').select('tokens').order('id').range(from, to)),
  ])
  if ([items, categories, themes, drafts, history].some((result) => result.error)) throw new Error('Media reference lookup failed')
  if (items.data?.length || categories.data?.length
    || JSON.stringify(themes.data).includes(input.publicUrl)
    || JSON.stringify(drafts.data).includes(input.publicUrl)
    || JSON.stringify(history.data).includes(input.publicUrl)) return false
  await createRestaurantAssetStoragePort().remove(path)
  return true
}
