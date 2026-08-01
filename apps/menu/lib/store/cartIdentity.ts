import type { SelectedModifier } from '@garsonless/ui'

export const MAX_CART_ITEM_QUANTITY = 99

export function clampCartQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1
  return Math.max(0, Math.min(MAX_CART_ITEM_QUANTITY, Math.round(quantity)))
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
