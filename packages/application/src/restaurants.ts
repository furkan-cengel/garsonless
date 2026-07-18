import {
  err,
  hasSameRestaurant,
  ok,
  type DashboardActorContext,
  type Result,
} from '@garsonless/domain'

const MEMBER_SETTINGS_KEYS = new Set([
  'store',
  'contact',
  'hours',
  'tax',
  'languages',
  'notifications',
  'orders',
])

export interface RestaurantSettingsPort {
  patchSettings(input: {
    restaurantId: string
    patch: Record<string, unknown>
  }): Promise<Result<'updated' | 'not_found'>>
}

export type StandType = 'basic' | 'premium' | 'custom'

export interface StandRequestInput {
  restaurantId: string
  contactName: string
  email: string
  phone: string
  tableCount: number
  standType: StandType
  notes?: string
}

export interface StandRequestPort {
  readRestaurantName(restaurantId: string): Promise<Result<string | null>>
  claimSlot(input: {
    restaurantId: string
    requestedBy: string
    windowSeconds: number
  }): Promise<Result<string | null>>
  releaseSlot(input: {
    restaurantId: string
    requestedBy: string
    claimedAt: string
  }): Promise<Result<null>>
}

export interface StandRequestNotificationPort {
  send(input: Omit<StandRequestInput, 'restaurantId'> & {
    restaurantName: string
  }): Promise<Result<null>>
}

function requireSection(
  context: DashboardActorContext,
  restaurantId: string,
  section: 'settings' | 'tables',
): Result<true> {
  return hasSameRestaurant(context, restaurantId) && context.permissions.includes(section)
    ? ok(true)
    : err('Not authorized')
}

export async function patchRestaurantSettings(
  context: DashboardActorContext,
  input: { restaurantId: string; patch: Record<string, unknown> },
  port: RestaurantSettingsPort,
): Promise<Result<null>> {
  const access = requireSection(context, input.restaurantId, 'settings')
  if (!access.ok) return access
  if (
    !context.isOwner
    && !Object.keys(input.patch).every((key) => MEMBER_SETTINGS_KEYS.has(key))
  ) {
    return err('Not authorized')
  }
  if (Object.keys(input.patch).length === 0) return ok(null)

  const updated = await port.patchSettings(input)
  if (!updated.ok) return updated
  return updated.value === 'updated' ? ok(null) : err('Not found')
}

export async function requestQrStands(
  context: DashboardActorContext,
  input: StandRequestInput,
  port: StandRequestPort,
  notificationPort: StandRequestNotificationPort,
): Promise<Result<null>> {
  const access = requireSection(context, input.restaurantId, 'tables')
  if (!access.ok) return access

  const restaurantName = await port.readRestaurantName(input.restaurantId)
  if (!restaurantName.ok) return restaurantName
  if (!restaurantName.value) return err('Restaurant not found')

  const claim = await port.claimSlot({
    restaurantId: input.restaurantId,
    requestedBy: context.userId,
    windowSeconds: 600,
  })
  if (!claim.ok) return claim
  if (!claim.value) return err('Yeni bir talep göndermek için 10 dakika bekleyin.')

  const sent = await notificationPort.send({
    restaurantName: restaurantName.value,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    tableCount: input.tableCount,
    standType: input.standType,
    ...(input.notes ? { notes: input.notes } : {}),
  })
  if (!sent.ok) {
    await port.releaseSlot({
      restaurantId: input.restaurantId,
      requestedBy: context.userId,
      claimedAt: claim.value,
    })
    return sent
  }
  return ok(null)
}
