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
  couponId: string | null
  couponCode: string | null
  couponName: string | null
  couponDiscountAmount: number
  couponStackingPolicy: 'exclusive' | 'combine_loyalty' | null
  finalTotal: number
  loyaltySuppressedByPromotion?: boolean
}

export type CheckoutDiscountPreviewResult =
  | { ok: true; preview: MembershipDiscountPreview }
  | { ok: false; code: string | null; error: string }

export async function fetchCheckoutDiscountPreview(input: {
  restaurantId: string
  items: CartItem[]
  redeemPoints: number
  redeemStampClaim: boolean
  catalogItemId: string | null
  couponCode: string | null
  signal: AbortSignal
}): Promise<CheckoutDiscountPreviewResult> {
  const response = await fetch('/api/checkout/preview', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: input.signal,
    body: JSON.stringify({
      restaurantId: input.restaurantId,
      items: input.items.map((item) => ({
        itemId: item.itemId, quantity: item.quantity, selectedModifiers: item.modifiers,
        removedIngredientIds: item.removedIngredientIds,
        ...(item.productNote ? { productNote: item.productNote } : {}),
        ...(item.recommendationSourceItemId ? { recommendationSourceItemId: item.recommendationSourceItemId } : {}),
        ...(item.combo ? { combo: item.combo } : {}),
        ...(item.promotion ? { promotion: item.promotion } : {}),
      })),
      redeemPoints: input.redeemPoints,
      redeemStampClaim: input.redeemStampClaim,
      catalogItemId: input.catalogItemId,
      couponCode: input.couponCode,
    }),
  })
  const payload = await response.json().catch(() => null) as { ok?: boolean; preview?: MembershipDiscountPreview; code?: string; error?: string } | null
  if (response.ok && payload?.ok && payload.preview) return { ok: true, preview: payload.preview }
  return { ok: false, code: payload?.code ?? null, error: payload?.error ?? 'İndirim doğrulanamadı.' }
}

export async function fetchMembershipDiscountPreview(input: {
  restaurantId: string
  items: CartItem[]
  redeemPoints: number
  redeemStampClaim: boolean
  catalogItemId: string | null
  signal: AbortSignal
}): Promise<MembershipDiscountPreview | null> {
  const result = await fetchCheckoutDiscountPreview({ ...input, couponCode: null })
  return result.ok ? result.preview : null
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
