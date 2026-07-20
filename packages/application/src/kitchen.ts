import {
  err,
  hasSameRestaurant,
  ok,
  type DashboardActorContext,
  type Result,
} from '@garsonless/domain'

/**
 * Owner-only settings commands for the kitchen display. The dashboard adapter
 * resolves the actor before calling these functions; adapters never grant
 * authority merely from a restaurant id supplied by the browser.
 */
export interface KitchenSettingsCommandPort {
  reorderStations(input: {
    restaurantId: string
    orderedIds: string[]
  }): Promise<Result<null>>
  rotateAccessCredential(input: { restaurantId: string }): Promise<Result<null>>
}

function requireKitchenOwner(
  context: DashboardActorContext,
  restaurantId: string,
): Result<true> {
  return hasSameRestaurant(context, restaurantId) && context.isOwner === true
    ? ok(true)
    : err('Not authorized')
}

export async function reorderKitchenStations(
  context: DashboardActorContext,
  input: { restaurantId: string; orderedIds: string[] },
  port: KitchenSettingsCommandPort,
): Promise<Result<null>> {
  const access = requireKitchenOwner(context, input.restaurantId)
  if (!access.ok) return access
  if (input.orderedIds.length === 0 || input.orderedIds.length > 100) {
    return err('Invalid kitchen station order')
  }
  if (new Set(input.orderedIds).size !== input.orderedIds.length) {
    return err('Invalid kitchen station order')
  }
  return port.reorderStations(input)
}

/** Rotating the credential invalidates every existing KDS session by design. */
export async function rotateKitchenAccessCredential(
  context: DashboardActorContext,
  input: { restaurantId: string },
  port: KitchenSettingsCommandPort,
): Promise<Result<null>> {
  const access = requireKitchenOwner(context, input.restaurantId)
  return access.ok ? port.rotateAccessCredential(input) : access
}
