'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { createKitchenBrowserClient } from '../lib/supabase'
import type { Tables, OrderStatus } from '@garsonless/db'
import { readOrderLineSnapshots, sortOrdersByPriorityThenCreatedAt } from '@garsonless/db/order-client'
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
  stations: Tables<'kitchen_stations'>[]
}

export default function KitchenBoard({
  restaurant,
  initialOrders,
  restaurantId,
  kitchenToken,
  tableLabels = {},
  stations,
}: KitchenBoardProps) {
  const [orders, setOrders] = useState<Tables<'orders'>[]>(() => sortOrdersByPriorityThenCreatedAt(initialOrders))
  const [activeStationId, setActiveStationId] = useState<'expo' | 'unassigned' | string>('expo')
  const [now, setNow] = useState('--:--')

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

  useEffect(() => {
    const updateClock = () => setNow(new Date().toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    }))
    updateClock()
    const timer = window.setInterval(updateClock, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const stationTabs = [
    { id: 'expo' as const, name: 'Tüm İstasyonlar', color: '#ffffff' },
    ...stations.map((station) => ({ id: station.id, name: station.name, color: station.color })),
  ]
  const ordersForActiveStation = activeStationId === 'expo'
    ? orders
    : orders.filter((order) => readOrderLineSnapshots(order.items).some((item) =>
        item.station?.id === activeStationId,
      ))
  const stationCounts = new Map<string, number>()
  for (const order of orders) {
    const seen = new Set<string>()
    for (const item of readOrderLineSnapshots(order.items)) {
      if (item.station) seen.add(item.station.id)
    }
    for (const id of seen) stationCounts.set(id, (stationCounts.get(id) ?? 0) + 1)
  }
  const activeStation = stationTabs.find((station) => station.id === activeStationId) ?? stationTabs[0]

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-surface px-4 py-4 md:px-6">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
          </span>
          <span className="font-semibold text-text">{restaurant.name}</span>
          <span className="text-xs font-semibold text-text-muted">Mutfak Ekranı</span>
          <span className="ml-auto font-mono text-sm tabular-nums text-text">{now}</span>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {stationTabs.map((station) => {
            const active = activeStationId === station.id
            const count = station.id === 'expo' ? orders.length : stationCounts.get(station.id) ?? 0
            return (
              <button
                key={station.id}
                type="button"
                aria-label={`${station.name} istasyonunu göster`}
                aria-pressed={active}
                onClick={() => setActiveStationId(station.id)}
                className={[
                  'inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-bold transition-colors',
                  active ? 'border-primary bg-primary text-white' : 'border-border bg-background text-text-muted hover:text-text',
                ].join(' ')}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: station.color }} />
                {station.name}
                <span className={[
                  'rounded px-1.5 py-0.5 font-mono text-[10px]',
                  active ? 'bg-white/15 text-white' : 'bg-surface-2 text-text-muted',
                ].join(' ')}>{count}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: activeStation?.color }} />
          <span className="font-semibold text-text">{activeStation?.name}</span>
          <span>·</span>
          <span>{activeStationId === 'expo' ? 'Tüm siparişler' : 'Yalnız bu istasyonun kalemleri'}</span>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-auto p-3 lg:grid-cols-3 lg:overflow-hidden lg:p-4">
        {COLUMNS.map((col) => {
          const colOrders = ordersForActiveStation.filter((o) => col.statuses.includes(o.status as OrderStatus))
          return (
            <div
              key={col.id}
              className={`flex min-h-[220px] flex-col overflow-hidden rounded-lg border ${col.accent} bg-surface/30 lg:min-h-0`}
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
                      activeStationId={activeStationId}
                      {...(order.table_id && tableLabels[order.table_id] ? { tableLabel: tableLabels[order.table_id] } : {})}
                    />
                  ))}
                </AnimatePresence>

                {colOrders.length === 0 && (
                  <div className="flex h-24 items-center justify-center text-sm font-medium text-text-muted">
                    Bu aşamada sipariş yok
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
