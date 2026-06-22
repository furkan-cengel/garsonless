'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, MenuItem, ModifierGroup, SelectedModifier } from '@garsonless/ui'

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

interface CartState {
  items: CartItem[]
  sessionId: string
  deviceId: string
  tableId: string | null
  setTableId: (tableId: string | null) => void
  addItem: (
    item: MenuItem,
    modifiers: SelectedModifier[],
    modifierGroups: ModifierGroup[],
    quantity: number,
    originalPrice?: number,
  ) => void
  removeItem: (cartId: string) => void
  updateQuantity: (cartId: string, quantity: number) => void
  clearCart: () => void
  totalItems: () => number
  subtotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      sessionId: generateId(),
      deviceId: generateId(),
      tableId: null,

      setTableId: (tableId) => set({ tableId }),

      addItem: (item, modifiers, modifierGroups, quantity, originalPrice) => {
        const modifiersPriceDelta = modifiers.reduce((total, sel) => {
          for (const group of modifierGroups) {
            const option = group.options.find((o) => o.id === sel.option_id)
            if (option) return total + option.price_delta * (sel.quantity ?? 1)
          }
          return total
        }, 0)

        const serializedModifiers = JSON.stringify(modifiers)
        const existingIndex = get().items.findIndex(
          (ci) => ci.itemId === item.id && JSON.stringify(ci.modifiers) === serializedModifiers,
        )

        if (existingIndex >= 0) {
          set((state) => ({
            items: state.items.map((ci, i) =>
              i === existingIndex ? { ...ci, quantity: ci.quantity + quantity } : ci,
            ),
          }))
          return
        }

        const cartItem: CartItem = {
          cartId: generateId(),
          itemId: item.id,
          name: item.name,
          price: item.price,
          quantity,
          modifiers,
          modifiersPriceDelta,
          imageUrl: item.images?.[0] ?? null,
          ...(originalPrice !== undefined && originalPrice !== item.price ? { originalPrice } : {}),
        }

        set((state) => ({ items: [...state.items, cartItem] }))
      },

      removeItem: (cartId) =>
        set((state) => ({ items: state.items.filter((i) => i.cartId !== cartId) })),

      updateQuantity: (cartId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.cartId !== cartId)
              : state.items.map((i) => (i.cartId === cartId ? { ...i, quantity } : i)),
        })),

      clearCart: () => set({ items: [] }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      subtotal: () =>
        get().items.reduce(
          (sum, i) => sum + (i.price + i.modifiersPriceDelta) * i.quantity,
          0,
        ),
    }),
    {
      name: 'garsonless-cart',
      skipHydration: true,
      partialize: (state) => ({
        items: state.items,
        sessionId: state.sessionId,
        deviceId: state.deviceId,
        tableId: state.tableId,
      }),
    },
  ),
)
