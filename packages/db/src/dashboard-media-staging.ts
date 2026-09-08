import { createServiceClient } from './service-client'

export const MEDIA_STAGING_BUCKET = 'restaurant-media-staging'
export type StagedMediaResult = { error: string } | { url: string; width?: number; height?: number; mime?: string; durationSeconds?: number }
export type MediaUploadMetadata = { size: number; type: string; entityId?: string; kind?: 'items' | 'categories'; purpose?: string }
export type MediaUploadRow = {
  id: string; user_id: string; restaurant_id: string; kind: 'menu-image' | 'theme-image' | 'theme-video'
  metadata: MediaUploadMetadata; path: string; status: 'pending' | 'processing' | 'finished'
  result: StagedMediaResult | null; created_at: string; expires_at: string
}

/** Service-only RPC; no credentials, storage paths or actor IDs come from the browser at finalize. */
export function createDashboardMediaStagingPort() {
  const client = createServiceClient()
  const rpc = client.rpc.bind(client) as unknown as (
    name: 'dashboard_media_staging', args: { p_op: string; p_input: Record<string, unknown> },
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  async function operation<T>(op: string, input: Record<string, unknown>): Promise<T> {
    const { data, error } = await rpc('dashboard_media_staging', { p_op: op, p_input: input })
    if (error) throw new Error(error.message)
    return data as T
  }
  return {
    create: (input: { id: string; userId: string; restaurantId: string; kind: string; metadata: MediaUploadMetadata; path: string }) => operation<MediaUploadRow>('create', input),
    read: (id: string, userId: string) => operation<MediaUploadRow | null>('read', { id, userId }),
    claim: (id: string, userId: string) => operation<MediaUploadRow | null>('claim', { id, userId }),
    release: (id: string, userId: string) => operation<MediaUploadRow | null>('release', { id, userId }),
    finish: (id: string, userId: string, result: StagedMediaResult) => operation<MediaUploadRow | null>('finish', { id, userId, result }),
    expired: () => operation<MediaUploadRow[]>('expired', {}),
    removeRecords: (ids: string[]) => operation<null>('remove-many', { ids }),
    async removeObjects(paths: string[]) {
      const { error } = await client.storage.from(MEDIA_STAGING_BUCKET).remove(paths)
      if (error) throw error
    },
    removeRecord: (id: string) => operation<MediaUploadRow | null>('remove', { id }),
    async sign(path: string) {
      const { data, error } = await client.storage.from(MEDIA_STAGING_BUCKET).createSignedUploadUrl(path, { upsert: false })
      if (error) throw error
      return data.signedUrl
    },
    async download(path: string) {
      const { data, error } = await client.storage.from(MEDIA_STAGING_BUCKET).download(path)
      if (error) throw error
      return data
    },
    async removeObject(path: string) {
      const { error } = await client.storage.from(MEDIA_STAGING_BUCKET).remove([path])
      if (error) throw error
    },
  }
}
