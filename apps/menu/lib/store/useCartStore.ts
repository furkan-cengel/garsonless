'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, MenuItem, ModifierGroup, SelectedModifier } from '@garsonless/ui'
import { canonicalModifierSignature, canonicalRemovalSignature, clampCartQuantity } from './cartIdentity'

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
    removedIngredientIds?: string[],
    combo?: CartItem['combo'],
    promotion?: CartItem['promotion'],
    productNote?: string,
    recommendationSourceItemId?: string,
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

      addItem: (item, modifiers, modifierGroups, quantity, originalPrice, removedIngredientIds = [], combo, promotion, productNote, recommendationSourceItemId) => {
        const normalizedQuantity = Math.max(1, clampCartQuantity(quantity))
        const modifiersPriceDelta = modifiers.reduce((total, sel) => {
          for (const group of modifierGroups) {
            const option = group.options.find((o) => o.id === sel.option_id)
            if (option) return total + option.price_delta * (sel.quantity ?? 1)
          }
          return total
        }, 0)
        const modifierNames = modifiers.flatMap((selection) => {
          for (const group of modifierGroups) {
            const option = group.options.find((candidate) => candidate.id === selection.option_id)
            if (option) return [option.name]
          }
          return []
        })
        const removedIngredientNames = removedIngredientIds.flatMap((id) => {
          const ingredient = item.ingredients.find((candidate) => candidate.id === id)
          return ingredient ? [ingredient.name] : []
        })
        const calorieDelta = modifiers.reduce((total, selection) => {
          for (const group of modifierGroups) {
            const option = group.options.find((candidate) => candidate.id === selection.option_id)
            if (option) return total + option.calorie_delta * (selection.quantity ?? 1)
          }
          return total
        }, 0)

        const serializedModifiers = canonicalModifierSignature(modifiers)
        const serializedRemovals = canonicalRemovalSignature(removedIngredientIds)
        const normalizedNote = productNote?.replace(/\r\n?/g, '\n').trim().slice(0, 500) ?? ''
        const existingIndex = get().items.findIndex(
          (ci) => ci.itemId === item.id &&
            canonicalModifierSignature(ci.modifiers) === serializedModifiers &&
            canonicalRemovalSignature(ci.removedIngredientIds ?? []) === serializedRemovals &&
            (ci.combo?.instanceId ?? null) === (combo?.instanceId ?? null) &&
            (ci.promotion?.sectionInstanceId ?? null) === (promotion?.sectionInstanceId ?? null) &&
            (ci.productNote ?? '') === normalizedNote &&
            (ci.recommendationSourceItemId ?? null) === (recommendationSourceItemId ?? null),
        )

        if (existingIndex >= 0) {
          set((state) => ({
            items: state.items.map((ci, i) =>
              i === existingIndex ? { ...ci, quantity: clampCartQuantity(ci.quantity + normalizedQuantity) } : ci,
            ),
          }))
          return
        }

        const cartItem: CartItem = {
          cartId: generateId(),
          itemId: item.id,
          name: item.name,
          price: item.price,
          quantity: normalizedQuantity,
          modifiers,
          modifiersPriceDelta,
          modifierNames,
          removedIngredientIds,
          removedIngredientNames,
          energyKcal: item.energy_kcal === null
            ? null
            : Math.max(0, Math.round(item.energy_kcal + calorieDelta)),
          imageUrl: item.images?.[0] ?? null,
          ...(originalPrice !== undefined && originalPrice !== item.price ? { originalPrice } : {}),
          ...(combo ? { combo } : {}),
          ...(promotion ? { promotion } : {}),
          ...(normalizedNote ? { productNote: normalizedNote } : {}),
          ...(recommendationSourceItemId ? { recommendationSourceItemId } : {}),
        }

        set((state) => ({ items: [...state.items, cartItem] }))
      },

      removeItem: (cartId) =>
        set((state) => ({ items: state.items.filter((i) => i.cartId !== cartId) })),

      updateQuantity: (cartId, quantity) => {
        const normalizedQuantity = clampCartQuantity(quantity)
        set((state) => ({
          items:
            normalizedQuantity <= 0
              ? state.items.filter((i) => i.cartId !== cartId)
              : state.items.map((i) => (i.cartId === cartId ? { ...i, quantity: normalizedQuantity } : i)),
        }))
      },

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
      version: 5,
      migrate: (persisted) => {
        const state = persisted as Partial<CartState> & { items?: Partial<CartItem>[] }
        return {
          ...state,
          items: (state.items ?? []).map((item) => ({
            ...item,
            modifierNames: item.modifierNames ?? [],
            removedIngredientIds: item.removedIngredientIds ?? [],
            removedIngredientNames: item.removedIngredientNames ?? [],
            energyKcal: item.energyKcal ?? null,
            productNote: typeof item.productNote === 'string' ? item.productNote.slice(0, 500) : undefined,
            recommendationSourceItemId: typeof item.recommendationSourceItemId === 'string' ? item.recommendationSourceItemId : undefined,
          })),
        } as CartState
      },
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
