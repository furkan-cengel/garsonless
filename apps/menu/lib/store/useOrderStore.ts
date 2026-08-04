'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OrderStatus } from '@garsonless/db/types'
import type { OrderSummaryItem } from '@garsonless/ui'
import { menuTenantScopeKey } from '../menu-scope-key'

interface OrderMetaSnapshot {
  items: OrderSummaryItem[]
  total: number
  createdAt: string
  paid: boolean
}

type OrderView = 'sheet' | 'bubble' | null

interface OrderState {
  orderId: string | null
  status: OrderStatus | null
  meta: OrderMetaSnapshot | null
  view: OrderView
  isPlacing: boolean
  error: string | null
  scopeKey: string | null
  scopes: Record<string, OrderScopeSnapshot>
  legacyUnbound: boolean
  bindScope: (restaurantId: string, tableToken: string | null) => void
  setOrder: (orderId: string) => void
  setStatus: (status: OrderStatus) => void
  setMeta: (meta: OrderMetaSnapshot | null) => void
  setView: (view: OrderView) => void
  setIsPlacing: (val: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

interface OrderScopeSnapshot {
  orderId: string | null
  meta: OrderMetaSnapshot | null
  view: OrderView
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set) => ({
      orderId: null,
      status: null,
      meta: null,
      view: null,
      isPlacing: false,
      error: null,
      scopeKey: null,
      scopes: {},
      legacyUnbound: false,
      bindScope: (restaurantId, tableToken) => set((state) => {
        const nextScopeKey = menuTenantScopeKey(restaurantId, tableToken)
        if (state.scopeKey === nextScopeKey && !state.legacyUnbound) return state
        const scopes = state.scopeKey ? { ...state.scopes, [state.scopeKey]: snapshotOrderScope(state) } : { ...state.scopes }
        const next = state.legacyUnbound
          ? snapshotOrderScope(state)
          : scopes[nextScopeKey] ?? { orderId: null, meta: null, view: null }
        return { ...state, ...next, status: null, error: null, isPlacing: false, scopeKey: nextScopeKey, scopes: { ...scopes, [nextScopeKey]: next }, legacyUnbound: false }
      }),
      setOrder: (orderId) => set((state) => withActiveOrderScope(state, { orderId, status: 'pending_approval', error: null })),
      setStatus: (status) => set({ status }),
      setMeta: (meta) => set((state) => withActiveOrderScope(state, { meta })),
      setView: (view) => set((state) => withActiveOrderScope(state, { view })),
      setIsPlacing: (isPlacing) => set({ isPlacing }),
      setError: (error) => set({ error, isPlacing: false }),
      reset: () => set((state) => withActiveOrderScope(state, { orderId: null, status: null, meta: null, view: null, isPlacing: false, error: null })),
    }),
    {
      name: 'garsonless-active-order',
      version: 2,
      skipHydration: true,
      migrate: (persisted, version) => {
        const state = persisted as Partial<OrderState>
        return {
          ...state,
          scopeKey: version >= 2 ? state.scopeKey ?? null : null,
          scopes: version >= 2 ? state.scopes ?? {} : {},
          legacyUnbound: version < 2 || state.legacyUnbound === true,
        } as OrderState
      },
      // status is NOT persisted — it's re-fetched from the DB on restore.
      partialize: (state) => ({
        orderId: state.orderId,
        meta: state.meta,
        view: state.view,
        scopeKey: state.scopeKey,
        scopes: state.scopes,
        legacyUnbound: state.legacyUnbound,
      }),
    },
  ),
)

function snapshotOrderScope(state: Pick<OrderScopeSnapshot, 'orderId' | 'meta' | 'view'>): OrderScopeSnapshot {
  return { orderId: state.orderId, meta: state.meta, view: state.view }
}

function withActiveOrderScope(state: OrderState, patch: Partial<OrderState>): Partial<OrderState> {
  const next = { ...snapshotOrderScope(state), ...patch }
  const snapshot: OrderScopeSnapshot = { orderId: next.orderId ?? null, meta: next.meta ?? null, view: next.view ?? null }
  return state.scopeKey ? { ...patch, scopes: { ...state.scopes, [state.scopeKey]: snapshot } } : patch
}
