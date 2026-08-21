import type { CartItem } from '@garsonless/ui/menu'

export function participatesInAutomaticProductCampaign(cartItem: Pick<CartItem, 'combo' | 'recommendationSourceItemId'>) {
  return !cartItem.combo && !cartItem.recommendationSourceItemId
}

/**
 * Projects only ordinary catalogue-card lines. Combo and recommendation
 * lines keep their own cart identity and must not activate a product card's
 * campaign stepper.
 */
export function buildCatalogCartQuantityByItemId(cartItems: CartItem[]) {
  const quantities = new Map<string, number>()
  for (const cartItem of cartItems) {
    if (!participatesInAutomaticProductCampaign(cartItem)) continue
    quantities.set(
      cartItem.itemId,
      (quantities.get(cartItem.itemId) ?? 0) + cartItem.quantity,
    )
  }
  return quantities
}
