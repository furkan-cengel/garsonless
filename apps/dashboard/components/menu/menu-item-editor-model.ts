export interface MenuItemEditorSnapshot {
  name: string
  description: string
  price: string
  cost: string
  vatMode: 'category' | 'custom'
  vatRate: string
  stationMode: 'category' | 'custom'
  kitchenStationId: string
  isAvailable: boolean
  earnsStamp: boolean
  nutrition: unknown
  images: unknown
  modifiers: unknown
}

export function isMenuItemEditorDirty(
  current: MenuItemEditorSnapshot,
  initial: MenuItemEditorSnapshot,
) {
  return current.name !== initial.name ||
    current.description !== initial.description ||
    current.price !== initial.price ||
    current.cost !== initial.cost ||
    current.vatMode !== initial.vatMode ||
    (current.vatMode === 'custom' && current.vatRate !== initial.vatRate) ||
    current.stationMode !== initial.stationMode ||
    (current.stationMode === 'custom' && current.kitchenStationId !== initial.kitchenStationId) ||
    current.isAvailable !== initial.isAvailable ||
    current.earnsStamp !== initial.earnsStamp ||
    JSON.stringify(current.nutrition) !== JSON.stringify(initial.nutrition) ||
    JSON.stringify(current.images) !== JSON.stringify(initial.images) ||
    JSON.stringify(current.modifiers) !== JSON.stringify(initial.modifiers)
}
