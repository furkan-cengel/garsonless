'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OrderStatus } from '@garsonless/db/types'
import type { OrderSummaryItem } from '@garsonless/ui'

export interface OrderMetaSnapshot {
  items: OrderSummaryItem[]
  total: number
  createdAt: string
  paid: boolean
}

export type OrderView = 'sheet' | 'bubble' | null

interface OrderState {
  orderId: string | null
  status: OrderStatus | null
  meta: OrderMetaSnapshot | null
  view: OrderView
  isPlacing: boolean
  error: string | null
  setOrder: (orderId: string) => void
  setStatus: (status: OrderStatus) => void
  setMeta: (meta: OrderMetaSnapshot | null) => void
  setView: (view: OrderView) => void
  setIsPlacing: (val: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
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
      setOrder: (orderId) => set({ orderId, status: 'pending_approval', error: null }),
      setStatus: (status) => set({ status }),
      setMeta: (meta) => set({ meta }),
      setView: (view) => set({ view }),
      setIsPlacing: (isPlacing) => set({ isPlacing }),
      setError: (error) => set({ error, isPlacing: false }),
      reset: () => set({ orderId: null, status: null, meta: null, view: null, isPlacing: false, error: null }),
    }),
    {
      name: 'garsonless-active-order',
      skipHydration: true,
      // status is NOT persisted — it's re-fetched from the DB on restore.
      partialize: (state) => ({
        orderId: state.orderId,
        meta: state.meta,
        view: state.view,
      }),
    },
  ),
)
