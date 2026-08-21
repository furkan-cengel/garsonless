import type { CartItem, SelectedModifier } from '@garsonless/ui/menu'

export const MAX_CART_ITEM_QUANTITY = 99

export function clampCartQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1
  return Math.max(0, Math.min(MAX_CART_ITEM_QUANTITY, Math.round(quantity)))
}

/** Keeps multi-buy lines inside complete packs (2, 4, 6...) at every store boundary. */
export function normalizeCartQuantityForStep(quantity: number, quantityStep = 1): number {
  const clamped = clampCartQuantity(quantity)
  if (clamped <= 0) return 0
  const step = Math.max(1, Math.min(MAX_CART_ITEM_QUANTITY, Math.round(quantityStep) || 1))
  if (step === 1) return clamped
  const maximumCompleteQuantity = Math.floor(MAX_CART_ITEM_QUANTITY / step) * step
  return Math.min(maximumCompleteQuantity, Math.max(step, Math.ceil(clamped / step) * step))
}

/** Restores a stale promoted line to its catalogue price and ordinary 1-unit controls. */
export function restoreCartItemAfterPromotion(item: CartItem, catalogPrice: number): CartItem {
  const restored: CartItem = {
    ...item,
    price: catalogPrice,
    quantity: normalizeCartQuantityForStep(item.quantity, 1),
  }
  delete restored.originalPrice
  delete restored.promotion
  return restored
}

export function canonicalModifierSignature(modifiers: readonly SelectedModifier[]): string {
  return JSON.stringify(
    modifiers
      .map((modifier) => ({
        group_id: modifier.group_id,
        option_id: modifier.option_id,
        quantity: modifier.quantity ?? 1,
      }))
      .sort((left, right) => (
        left.group_id.localeCompare(right.group_id)
        || left.option_id.localeCompare(right.option_id)
        || left.quantity - right.quantity
      )),
  )
}

export function canonicalRemovalSignature(ids: readonly string[]): string {
  return JSON.stringify([...new Set(ids)].sort())
}
