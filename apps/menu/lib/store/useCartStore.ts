'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, MenuItem, ModifierGroup, SelectedModifier } from '@garsonless/ui/menu'
import { canonicalModifierSignature, canonicalRemovalSignature, clampCartQuantity } from './cartIdentity'
import { menuTenantScopeKey } from '../menu-scope-key'

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

interface CartScopeSnapshot {
  items: CartItem[]
  sessionId: string
  tableId: string | null
}

interface CartState {
  items: CartItem[]
  sessionId: string
  deviceId: string
  tableId: string | null
  scopeKey: string | null
  scopes: Record<string, CartScopeSnapshot>
  lastTableByRestaurant: Record<string, string>
  legacyUnbound: boolean
  bindScope: (restaurantId: string, tableToken: string | null) => void
  clearTableScope: (restaurantId: string) => void
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
      scopeKey: null,
      scopes: {},
      lastTableByRestaurant: {},
      legacyUnbound: false,

      bindScope: (restaurantId, tableToken) => set((state) => {
        const resolvedTable = tableToken ?? state.lastTableByRestaurant[restaurantId] ?? null
        const nextScopeKey = menuTenantScopeKey(restaurantId, resolvedTable)
        if (state.scopeKey === nextScopeKey && !state.legacyUnbound) return state
        const scopes = state.scopeKey
          ? { ...state.scopes, [state.scopeKey]: snapshotCartScope(state) }
          : { ...state.scopes }
        const existing = scopes[nextScopeKey]
        const useLegacy = state.legacyUnbound
        const next = useLegacy
          ? snapshotCartScope({ items: state.items, sessionId: state.sessionId, tableId: resolvedTable })
          : existing ?? { items: [], sessionId: generateId(), tableId: resolvedTable }
        return {
          ...state,
          ...next,
          tableId: resolvedTable,
          scopeKey: nextScopeKey,
          scopes: { ...scopes, [nextScopeKey]: { ...next, tableId: resolvedTable } },
          lastTableByRestaurant: resolvedTable
            ? { ...state.lastTableByRestaurant, [restaurantId]: resolvedTable }
            : state.lastTableByRestaurant,
          legacyUnbound: false,
        }
      }),

      clearTableScope: (restaurantId) => set((state) => {
        const lastTableByRestaurant = { ...state.lastTableByRestaurant }
        delete lastTableByRestaurant[restaurantId]
        const nextScopeKey = menuTenantScopeKey(restaurantId, null)
        const scopes = state.scopeKey ? { ...state.scopes, [state.scopeKey]: snapshotCartScope(state) } : { ...state.scopes }
        const next = scopes[nextScopeKey] ?? { items: [], sessionId: generateId(), tableId: null }
        return { ...state, ...next, tableId: null, scopeKey: nextScopeKey, scopes, lastTableByRestaurant, legacyUnbound: false }
      }),

      setTableId: (tableId) => set((state) => withActiveCartScope(state, { tableId })),

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
          set((state) => withActiveCartScope(state, {
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

        set((state) => withActiveCartScope(state, { items: [...state.items, cartItem] }))
      },

      removeItem: (cartId) =>
        set((state) => withActiveCartScope(state, { items: state.items.filter((i) => i.cartId !== cartId) })),

      updateQuantity: (cartId, quantity) => {
        const normalizedQuantity = clampCartQuantity(quantity)
        set((state) => withActiveCartScope(state, {
          items:
            normalizedQuantity <= 0
              ? state.items.filter((i) => i.cartId !== cartId)
              : state.items.map((i) => (i.cartId === cartId ? { ...i, quantity: normalizedQuantity } : i)),
        }))
      },

      clearCart: () => set((state) => withActiveCartScope(state, { items: [] })),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      subtotal: () =>
        get().items.reduce(
          (sum, i) => sum + (i.price + i.modifiersPriceDelta) * i.quantity,
          0,
        ),
    }),
    {
      name: 'garsonless-cart',
      version: 6,
      migrate: (persisted, version) => {
        const state = persisted as Partial<CartState> & { items?: Partial<CartItem>[] }
        const items = (state.items ?? []).map((item) => ({
          ...item,
          modifierNames: item.modifierNames ?? [],
          removedIngredientIds: item.removedIngredientIds ?? [],
          removedIngredientNames: item.removedIngredientNames ?? [],
          energyKcal: item.energyKcal ?? null,
          productNote: typeof item.productNote === 'string' ? item.productNote.slice(0, 500) : undefined,
          recommendationSourceItemId: typeof item.recommendationSourceItemId === 'string' ? item.recommendationSourceItemId : undefined,
        })) as CartItem[]
        return {
          ...state,
          items,
          scopeKey: version >= 6 ? state.scopeKey ?? null : null,
          scopes: version >= 6 ? state.scopes ?? {} : {},
          lastTableByRestaurant: version >= 6 ? state.lastTableByRestaurant ?? {} : {},
          legacyUnbound: version < 6 || state.legacyUnbound === true,
        } as CartState
      },
      skipHydration: true,
      partialize: (state) => ({
        items: state.items,
        sessionId: state.sessionId,
        deviceId: state.deviceId,
        tableId: state.tableId,
        scopeKey: state.scopeKey,
        scopes: state.scopes,
        lastTableByRestaurant: state.lastTableByRestaurant,
        legacyUnbound: state.legacyUnbound,
      }),
    },
  ),
)

function snapshotCartScope(state: Pick<CartScopeSnapshot, 'items' | 'sessionId' | 'tableId'>): CartScopeSnapshot {
  return { items: state.items, sessionId: state.sessionId, tableId: state.tableId }
}

function withActiveCartScope(state: CartState, patch: Partial<CartScopeSnapshot>): Partial<CartState> {
  const next = { ...snapshotCartScope(state), ...patch }
  return state.scopeKey
    ? { ...patch, scopes: { ...state.scopes, [state.scopeKey]: next } }
    : patch
}
