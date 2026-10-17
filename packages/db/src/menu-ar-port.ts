import { err, ok, type Result } from '@garsonless/domain'
import type { MenuArItemState, MenuArPort, MenuArVersion, PublishedMenuAr, PublishedMenuArPort } from '@garsonless/application/menu-ar'
import { createServiceClient } from './service-client'

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>

// The AR RPCs are not in the generated types yet; call them through one narrow cast.
function rpc(): Rpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as Rpc
}

/** Database errors become stable codes; raw SQL text never leaves the adapter. */
function failure(message: string): Result<never> {
  const code = /menu_ar_[a-z_]+/.exec(message)?.[0] ?? 'menu_ar_unavailable'
  return err(code)
}

type VersionRow = {
  id: string
  glb_asset_id: string
  usdz_asset_id: string | null
  glbUrl: string | null
  usdzUrl: string | null
  poster_url: string | null
  width_mm: number | null
  depth_mm: number | null
  height_mm: number | null
  portion_note: string | null
  published_at: string | null
}

function version(row: VersionRow | null): MenuArVersion | null {
  if (!row) return null
  return {
    id: row.id,
    glbAssetId: row.glb_asset_id,
    usdzAssetId: row.usdz_asset_id,
    glbUrl: row.glbUrl ?? null,
    usdzUrl: row.usdzUrl ?? null,
    posterUrl: row.poster_url,
    widthMm: row.width_mm,
    depthMm: row.depth_mm,
    heightMm: row.height_mm,
    portionNote: row.portion_note,
    publishedAt: row.published_at,
  }
}

export function createMenuArPort(): MenuArPort {
  return {
    async readAccess({ restaurantId }) {
      const { data, error } = await createServiceClient()
        .from('restaurant_ar_access' as never)
        .select('enabled')
        .eq('restaurant_id', restaurantId)
        .maybeSingle()
      if (error) return failure(error.message)
      return ok(Boolean((data as { enabled?: boolean } | null)?.enabled))
    },
    async readItem({ restaurantId, menuItemId }) {
      const { data, error } = await rpc()('read_menu_item_ar', { p_restaurant: restaurantId, p_item: menuItemId })
      if (error) return failure(error.message)
      const raw = (data ?? {}) as { accessEnabled?: boolean; draft?: VersionRow | null; publishedVersionId?: string | null }
      const state: MenuArItemState = {
        accessEnabled: raw.accessEnabled === true,
        draft: version(raw.draft ?? null),
        publishedVersionId: raw.publishedVersionId ?? null,
      }
      return ok(state)
    },
    async saveDraft(input) {
      const { data, error } = await rpc()('save_menu_item_ar_draft', {
        p_restaurant: input.restaurantId,
        p_actor: input.actorId,
        p_item: input.menuItemId,
        p_glb_asset: input.glbAssetId,
        p_usdz_asset: input.usdzAssetId,
        p_poster_url: input.posterUrl,
        p_width_mm: input.widthMm,
        p_depth_mm: input.depthMm,
        p_height_mm: input.heightMm,
        p_portion_note: input.portionNote,
      })
      if (error) return failure(error.message)
      return ok({ versionId: String(data) })
    },
    async publish({ restaurantId, menuItemId, versionId }) {
      const { error } = await rpc()('publish_menu_item_ar', { p_restaurant: restaurantId, p_item: menuItemId, p_version: versionId })
      return error ? failure(error.message) : ok(null)
    },
    async unpublish({ restaurantId, menuItemId }) {
      const { error } = await rpc()('unpublish_menu_item_ar', { p_restaurant: restaurantId, p_item: menuItemId })
      return error ? failure(error.message) : ok(null)
    },
  }
}

type PublishedRow = {
  menu_item_id: string
  version_id: string
  glb_url: string
  usdz_url: string | null
  poster_url: string | null
  width_mm: number | null
  depth_mm: number | null
  height_mm: number | null
  portion_note: string | null
}

export function createPublishedMenuArPort(): PublishedMenuArPort {
  return {
    async readPublished({ restaurantId }) {
      const { data, error } = await rpc()('read_published_menu_ar', { p_restaurant: restaurantId })
      if (error) return failure(error.message)
      const rows = (Array.isArray(data) ? data : []) as PublishedRow[]
      return ok(rows.map((row): PublishedMenuAr => ({
        menuItemId: row.menu_item_id,
        versionId: row.version_id,
        glbUrl: row.glb_url,
        usdzUrl: row.usdz_url,
        posterUrl: row.poster_url,
        widthMm: row.width_mm,
        depthMm: row.depth_mm,
        heightMm: row.height_mm,
        portionNote: row.portion_note,
      })))
    },
  }
}
