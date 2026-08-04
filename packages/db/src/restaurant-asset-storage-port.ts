import { Buffer } from 'node:buffer'

import { createServiceClient } from './client'

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
const SAFE_ASSET_PATHS = [
  new RegExp(`^${UUID}/${UUID}/logo-${UUID}\\.(jpg|png|webp)$`, 'i'),
  new RegExp(`^restaurants/${UUID}/(items|categories)/${UUID}/${UUID}\\.(jpg|png|webp|avif)$`, 'i'),
  new RegExp(`^restaurants/${UUID}/theme/(section-image|section-icon|gallery-image|home-hero-poster|auth-header-background|auth-header-logo)/${UUID}\\.webp$`, 'i'),
  new RegExp(`^restaurants/${UUID}/theme/home-hero-video/${UUID}\\.(mp4|webm)$`, 'i'),
]

export function isCanonicalRestaurantAssetPath(path: string): boolean {
  return SAFE_ASSET_PATHS.some((pattern) => pattern.test(path))
}

export interface RestaurantAssetStoragePort {
  uploadImmutable(input: {
    path: string
    bytes: Uint8Array
    contentType: string
  }): Promise<{ publicUrl: string }>
  remove(path: string): Promise<void>
}

export function createRestaurantAssetStoragePort(): RestaurantAssetStoragePort {
  return {
    async uploadImmutable(input) {
      if (!isCanonicalRestaurantAssetPath(input.path)) {
        throw new Error('Invalid restaurant asset path')
      }
      const service = createServiceClient()
      const { error } = await service.storage
        .from('restaurant-assets')
        .upload(input.path, Buffer.from(input.bytes), {
          cacheControl: '31536000',
          contentType: input.contentType,
          upsert: false,
        })
      if (error) throw error
      const { data } = service.storage.from('restaurant-assets').getPublicUrl(input.path)
      return { publicUrl: data.publicUrl }
    },

    async remove(path) {
      if (!isCanonicalRestaurantAssetPath(path)) {
        throw new Error('Invalid restaurant asset path')
      }
      const { error } = await createServiceClient().storage
        .from('restaurant-assets')
        .remove([path])
      if (error) throw error
    },
  }
}
