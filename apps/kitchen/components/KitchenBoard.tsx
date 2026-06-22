'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { createKitchenBrowserClient } from '../lib/supabase'
import type { Tables, OrderStatus } from '@garsonless/db'
import { sortOrdersByPriorityThenCreatedAt } from '@garsonless/db/order-client'
import KitchenCard from './KitchenCard'
import { getKitchenOrderAction } from '../lib/actions/orders'

interface Column {
  id: string
  label: string
  statuses: OrderStatus[]
  accent: string
}

const COLUMNS: Column[] = [
  {
    id: 'new',
    label: 'Yeni Siparişler',
    statuses: ['pending', 'pending_approval', 'sent_to_kitchen', 'paid'],
    accent: 'border-warning/50',
  },
  {
    id: 'preparing',
    label: 'Hazırlanıyor',
    statuses: ['preparing'],
    accent: 'border-primary/50',
  },
  {
    id: 'done',
    label: 'Hazır',
    statuses: ['ready'],
    accent: 'border-success/50',
  },
]

interface Restaurant {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

interface KitchenBoardProps {
  restaurant: Restaurant
  initialOrders: Tables<'orders'>[]
  restaurantId: string
  kitchenToken: string
  tableLabels?: Record<string, string>
}

export default function KitchenBoard({
  restaurant,
  initialOrders,
  restaurantId,
  kitchenToken,
  tableLabels = {},
}: KitchenBoardProps) {
  const [orders, setOrders] = useState<Tables<'orders'>[]>(() => sortOrdersByPriorityThenCreatedAt(initialOrders))

  useEffect(() => {
    let alive = true
    const supabase = createKitchenBrowserClient()
    const channel = supabase
      .channel(`kitchen:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload: { eventType: string; new: unknown }) => {
          const raw = payload.new as Tables<'orders'>
          if (!raw?.id) return
          if (payload.eventType === 'UPDATE' && (raw.status === 'served' || raw.status === 'cancelled')) {
            setOrders((prev) =>
              sortOrdersByPriorityThenCreatedAt(prev.filter((o) => o.id !== raw.id)),
            )
            return
          }

          const result = await getKitchenOrderAction(raw.id, restaurantId, kitchenToken)
          const order = 'order' in result ? result.order : raw
          if (!alive) return
          if (order.status === 'served' || order.status === 'cancelled') {
            setOrders((prev) => sortOrdersByPriorityThenCreatedAt(prev.filter((o) => o.id !== order.id)))
            return
          }
          setOrders((prev) =>
            sortOrdersByPriorityThenCreatedAt([
              ...prev.filter((o) => o.id !== order.id),
              order,
            ]),
          )
        },
      )
      .subscribe()

    return () => {
      alive = false
      void supabase.removeChannel(channel)
    }
  }, [restaurantId, kitchenToken])

  const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="px-6 py-4 border-b border-border flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
        </span>
        <span className="font-semibold text-text">{restaurant.name}</span>
        <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded">
          Mutfak Ekranı
        </span>
        <span className="text-text-muted text-sm ml-auto tabular-nums">{now}</span>
      </header>

      <div className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-hidden">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => col.statuses.includes(o.status as OrderStatus))
          return (
            <div
              key={col.id}
              className={`flex flex-col rounded-[14px] border ${col.accent} bg-surface/30 overflow-hidden`}
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="font-semibold text-text text-sm">{col.label}</span>
                <span className="text-xs bg-surface-2 text-text-muted px-2 py-0.5 rounded-full font-mono">
                  {colOrders.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <AnimatePresence mode="popLayout">
                  {colOrders.map((order) => (
                    <KitchenCard
                      key={order.id}
                      order={order}
                      restaurantId={restaurantId}
                      kitchenToken={kitchenToken}
                      {...(order.table_id && tableLabels[order.table_id] ? { tableLabel: tableLabels[order.table_id] } : {})}
                    />
                  ))}
                </AnimatePresence>

                {colOrders.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-text-muted text-sm">
                    —
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
