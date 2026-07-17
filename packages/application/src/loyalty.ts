import {
  err,
  hasSameRestaurant,
  ok,
  type CustomerActorContext,
  type MemberBalances,
  type Result,
} from '@garsonless/domain'

export type { MemberBalances } from '@garsonless/domain'

export interface LoyaltyDiscountLine {
  itemId: string
  quantity: number
  modifiersPriceDelta: number
}

export interface LoyaltyDiscountPreviewInput {
  restaurantId: string
  lines: LoyaltyDiscountLine[]
  requestedPointsRedeem?: number
  requestedStampClaim?: boolean
  requestedCatalogReward?: { itemId: string } | null
}

export interface LoyaltyQueryPort<TDiscount> {
  readMemberBalances(input: {
    customerId: string
    restaurantId: string
  }): Promise<MemberBalances | null>
  previewDiscount(input: LoyaltyDiscountPreviewInput & {
    customerId: string | null
  }): Promise<TDiscount>
}

export async function readMemberLoyalty<TDiscount>(
  context: CustomerActorContext,
  port: LoyaltyQueryPort<TDiscount>,
): Promise<Result<MemberBalances | null>> {
  return ok(await port.readMemberBalances({
    customerId: context.customerId,
    restaurantId: context.restaurantId,
  }))
}

export async function previewLoyaltyDiscount<TDiscount>(
  context: CustomerActorContext | null,
  input: LoyaltyDiscountPreviewInput,
  port: LoyaltyQueryPort<TDiscount>,
): Promise<Result<TDiscount>> {
  if (context && !hasSameRestaurant(context, input.restaurantId)) return err('Not authorized')
  return ok(await port.previewDiscount({
    ...input,
    customerId: context?.customerId ?? null,
    requestedPointsRedeem: context ? (input.requestedPointsRedeem ?? 0) : 0,
    requestedStampClaim: context ? (input.requestedStampClaim ?? false) : false,
    requestedCatalogReward: context ? (input.requestedCatalogReward ?? null) : null,
  }))
}

export function customerActorContext(input: {
  authUserId: string
  customerId: string
  restaurantId: string
}): CustomerActorContext {
  return { actor: 'customer-member', ...input }
}
