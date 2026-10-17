import type { DashboardActorContext, Result } from '@garsonless/domain'
import { err, hasSameRestaurant, ok } from '@garsonless/domain'

/** A saved model version as the dashboard edits it. */
export interface MenuArVersion {
  id: string
  glbAssetId: string
  usdzAssetId: string | null
  glbUrl: string | null
  usdzUrl: string | null
  posterUrl: string | null
  widthMm: number | null
  depthMm: number | null
  heightMm: number | null
  portionNote: string | null
  publishedAt: string | null
}

export interface MenuArItemState {
  accessEnabled: boolean
  draft: MenuArVersion | null
  publishedVersionId: string | null
}

/** What the public menu needs for one item; only published versions exist here. */
export interface PublishedMenuAr {
  menuItemId: string
  versionId: string
  glbUrl: string
  usdzUrl: string | null
  posterUrl: string | null
  widthMm: number | null
  depthMm: number | null
  heightMm: number | null
  portionNote: string | null
}

export interface MenuArDraftInput {
  restaurantId: string
  menuItemId: string
  glbAssetId: string
  usdzAssetId: string | null
  posterUrl: string | null
  widthMm: number | null
  depthMm: number | null
  heightMm: number | null
  portionNote: string | null
}

export interface MenuArPort {
  readAccess(input: { restaurantId: string }): Promise<Result<boolean>>
  readItem(input: { restaurantId: string; menuItemId: string }): Promise<Result<MenuArItemState>>
  saveDraft(input: MenuArDraftInput & { actorId: string }): Promise<Result<{ versionId: string }>>
  publish(input: { restaurantId: string; menuItemId: string; versionId: string }): Promise<Result<null>>
  unpublish(input: { restaurantId: string; menuItemId: string }): Promise<Result<null>>
}

export interface PublishedMenuArPort {
  readPublished(input: { restaurantId: string }): Promise<Result<PublishedMenuAr[]>>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function requireMenu(context: DashboardActorContext, restaurantId: string): Result<true> {
  if (!hasSameRestaurant(context, restaurantId) || !(context.isOwner || context.permissions.includes('menu'))) {
    return err('Not authorized')
  }
  return ok(true)
}

function size(value: number | null, min: number): boolean {
  return value === null || (Number.isInteger(value) && value >= min && value <= 1000)
}

/** Shape rules mirrored by the database checks, so bad input never reaches it. */
export function validateMenuArDraft(input: MenuArDraftInput): Result<MenuArDraftInput> {
  if (![input.restaurantId, input.menuItemId, input.glbAssetId].every((id) => UUID.test(id))) return err('Invalid model selection')
  if (input.usdzAssetId !== null && !UUID.test(input.usdzAssetId)) return err('Invalid model selection')
  if (!size(input.widthMm, 10) || !size(input.depthMm, 10) || !size(input.heightMm, 5)) return err('Invalid model size')
  const portionNote = input.portionNote?.trim() || null
  if (portionNote && portionNote.length > 120) return err('Portion note too long')
  const posterUrl = input.posterUrl?.trim() || null
  if (posterUrl && (!posterUrl.startsWith('https://') || posterUrl.length > 2000)) return err('Invalid poster')
  return ok({ ...input, portionNote, posterUrl })
}

export async function readMenuItemAr(context: DashboardActorContext, input: { restaurantId: string; menuItemId: string }, port: MenuArPort) {
  const access = requireMenu(context, input.restaurantId)
  if (!access.ok) return access
  if (!UUID.test(input.menuItemId)) return err('Invalid menu item')
  return port.readItem(input)
}

export async function saveMenuItemArDraft(context: DashboardActorContext, input: MenuArDraftInput, port: MenuArPort) {
  const access = requireMenu(context, input.restaurantId)
  if (!access.ok) return access
  const enabled = await port.readAccess({ restaurantId: input.restaurantId })
  if (!enabled.ok) return enabled
  if (!enabled.value) return err('AR access disabled')
  const valid = validateMenuArDraft(input)
  if (!valid.ok) return valid
  return port.saveDraft({ ...valid.value, actorId: context.userId })
}

export async function publishMenuItemAr(context: DashboardActorContext, input: { restaurantId: string; menuItemId: string; versionId: string }, port: MenuArPort) {
  const access = requireMenu(context, input.restaurantId)
  if (!access.ok) return access
  if (!UUID.test(input.menuItemId) || !UUID.test(input.versionId)) return err('Invalid model version')
  const enabled = await port.readAccess({ restaurantId: input.restaurantId })
  if (!enabled.ok) return enabled
  if (!enabled.value) return err('AR access disabled')
  return port.publish(input)
}

/** Unpublishing stays possible even after access is switched off. */
export async function unpublishMenuItemAr(context: DashboardActorContext, input: { restaurantId: string; menuItemId: string }, port: MenuArPort) {
  const access = requireMenu(context, input.restaurantId)
  if (!access.ok) return access
  if (!UUID.test(input.menuItemId)) return err('Invalid menu item')
  return port.unpublish(input)
}

export async function readRestaurantArAccess(context: DashboardActorContext, restaurantId: string, port: MenuArPort) {
  if (!hasSameRestaurant(context, restaurantId)) return err('Not authorized')
  return port.readAccess({ restaurantId })
}

/** Public menu read: the port only ever returns published models of AR-enabled restaurants. */
export async function readPublishedMenuAr(restaurantId: string, port: PublishedMenuArPort) {
  if (!UUID.test(restaurantId)) return ok([] as PublishedMenuAr[])
  return port.readPublished({ restaurantId })
}
