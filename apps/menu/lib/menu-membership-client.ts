import type { CartItem } from '@garsonless/ui/menu'
import { broadcastCustomerSessionEvent } from './customer-auth-client'

export interface MembershipDiscountPreview {
  subtotal: number
  memberDiscountAmount: number
  memberDiscountPct: number
  memberTierName: string | null
  pointsDiscountAmount: number
  stampDiscountAmount: number
  rewardItemName: string | null
  catalogDiscountAmount: number
  catalogItemName: string | null
  catalogPointsCost: number
  finalTotal: number
  loyaltySuppressedByPromotion?: boolean
}

export async function fetchMembershipDiscountPreview(input: {
  restaurantId: string
  items: CartItem[]
  redeemPoints: number
  redeemStampClaim: boolean
  catalogItemId: string | null
  signal: AbortSignal
}): Promise<MembershipDiscountPreview | null> {
  const response = await fetch('/api/loyalty/preview-discount', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: input.signal,
    body: JSON.stringify({
      restaurantId: input.restaurantId,
      items: input.items.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        selectedModifiers: item.modifiers,
        removedIngredientIds: item.removedIngredientIds,
        ...(item.productNote ? { productNote: item.productNote } : {}),
        ...(item.recommendationSourceItemId ? { recommendationSourceItemId: item.recommendationSourceItemId } : {}),
        ...(item.combo ? { combo: item.combo } : {}),
        ...(item.promotion ? { promotion: item.promotion } : {}),
      })),
      redeemPoints: input.redeemPoints,
      redeemStampClaim: input.redeemStampClaim,
      catalogItemId: input.catalogItemId,
    }),
  })
  if (!response.ok) return null
  const payload = await response.json() as { ok: boolean; preview?: MembershipDiscountPreview }
  return payload.ok && payload.preview ? payload.preview : null
}

export async function logoutCustomerDevice(scope: 'device' | 'all' = 'device'): Promise<boolean> {
  try {
    const response = await fetch('/api/account/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope }),
    })
    if (!response.ok) return false
    broadcastCustomerSessionEvent('signed-out')
    return true
  } catch {
    return false
  }
}
