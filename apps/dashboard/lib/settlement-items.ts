import { readOrderLineSnapshots } from '@garsonless/db/browser'

interface SettlementItemModifier {
  groupName: string | null
  optionName: string
  quantity: number
}

export interface SettlementLineItem {
  lineIndex: number
  name: string
  quantity: number
  unitPrice: number
  total: number
  productNote: string | null
  modifiers: SettlementItemModifier[]
  removedIngredients: string[]
}

/**
 * Projects the versioned order snapshot into the deliberately small shape used
 * by table settlement surfaces. Parsing stays centralized in the DB package so
 * historical and canonical snapshots follow the same compatibility rules.
 */
export function projectSettlementItems(value: unknown): SettlementLineItem[] {
  return readOrderLineSnapshots(value).map((line, lineIndex) => ({
    lineIndex,
    name: line.name,
    quantity: line.quantity,
    unitPrice: line.price + line.modifiersPriceDelta,
    total: (line.price + line.modifiersPriceDelta) * line.quantity,
    productNote: line.productNote ?? null,
    modifiers: line.modifiers.map((modifier) => ({
      groupName: modifier.groupName || null,
      optionName: modifier.optionName,
      quantity: modifier.quantity,
    })),
    removedIngredients: line.removedIngredients.map((ingredient) => ingredient.name),
  }))
}
