'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { OrderStatus } from '@garsonless/db/types'
import type { KitchenOrderProjection } from '@garsonless/application/tables'
import { ALLERGEN_LABELS, readOrderCustomerTierSnapshot, readOrderLineSnapshots } from '@garsonless/db/browser'
import ElapsedTimer from './ElapsedTimer'
import { updateOrderStatusAction } from '../lib/actions/orders'

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'preparing',
  pending_approval: 'preparing',
  sent_to_kitchen: 'preparing',
  paid: 'preparing',
  preparing: 'ready',
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Beklemede',
  pending_approval: 'Onay bekleniyor',
  sent_to_kitchen: 'Mutfağa gönderildi',
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  served: 'Servis edildi',
  cancelled: 'İptal',
  paid: 'Ödendi',
}

interface KitchenCardProps {
  order: KitchenOrderProjection
  restaurantId: string
  activeStationId: 'expo' | 'unassigned' | string
  tableLabel?: string
}

export default function KitchenCard({ order, restaurantId, activeStationId, tableLabel }: KitchenCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const items = readOrderLineSnapshots(order.items)
  const nextStatus = NEXT_STATUS[order.status as OrderStatus]
  const tier = readOrderCustomerTierSnapshot(order.customer_tier)
  const isExpo = activeStationId === 'expo'
  const stationKeys = new Set(items.map((item) => item.station?.id ?? 'unassigned'))
  const isSingleStationOrder = stationKeys.size <= 1
  const visibleItems = isExpo
    ? items
    : items.filter((item) => item.station?.id === activeStationId)
  const stationSummary = Array.from(items.filter((item) => item.station !== null).reduce((map, item) => {
    const station = item.station!
    const prev = map.get(station.id) ?? { name: station.name, color: station.color, count: 0 }
    prev.count += 1
    map.set(station.id, prev)
    return map
  }, new Map<string, { name: string; color: string; count: number }>()).values())
  const stationBlocksFinalReady = !isExpo && nextStatus === 'ready' && !isSingleStationOrder
  const blockedReason = stationBlocksFinalReady
    ? 'Son kontrol tamamlar'
    : order.status === 'ready' ? 'Garson teslim edecek' : ''
  const canAdvance = !!nextStatus && !stationBlocksFinalReady

  async function handleTap() {
    if (!nextStatus || loading || !canAdvance) return
    setLoading(true)
    setError(null)
    const result = await updateOrderStatusAction(
      order.id,
      nextStatus,
      restaurantId,
      activeStationId,
    )
    if ('error' in result && result.error === 'Kitchen session expired') {
      window.location.reload()
      return
    }
    if ('error' in result) setError(result.error)
    setLoading(false)
  }

  return (
    <motion.div
      data-order-id={order.id}
      data-station-scope={activeStationId}
      layout
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={[
        'bg-surface rounded-lg border border-border p-4 select-none',
        tier?.priorityService ? 'border-l-4 border-l-warning' : '',
        loading ? 'opacity-50' : '',
        'transition-all',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-text">
            {order.table_id
              ? tableLabel ?? `Masa ${order.table_id.slice(0, 4).toUpperCase()}`
              : 'Gel-al'}
          </span>
          {(order.paid_at !== null || order.status === 'paid') && (
            <span className="text-[10px] font-extrabold tracking-wide px-2 py-0.5 rounded-full bg-success/15 text-success">
              ÖDENDİ
            </span>
          )}
          {tier?.priorityService && (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wide px-2 py-0.5 rounded-full bg-warning/15 text-warning">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: tier.color }}
              />
              ÖNCELİKLİ · {tier.name}
            </span>
          )}
          <span className="text-xs text-text-muted font-mono">
            #{order.id.slice(-6).toUpperCase()}
          </span>
        </div>
        <ElapsedTimer createdAt={order.created_at} />
      </div>

      <ul className="space-y-2 mb-3">
        {visibleItems.map((item, i) => {
          const modifierNames = item.modifiers
            .map((modifier) => `${modifier.optionName}${modifier.quantity > 1 ? ` ×${modifier.quantity}` : ''}`)
            .join(', ')
          return (
            <li key={i} className="flex items-start gap-2">
              <span className="text-primary font-bold text-sm min-w-[22px]">{item.quantity}×</span>
              <div>
                <span className="text-sm text-text leading-tight">{item.name}</span>
                {isExpo && item.station && (
                  <span
                    className="ml-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-text-muted"
                    style={{ background: `${item.station.color}26` }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.station.color }} />
                    {item.station.name}
                  </span>
                )}
                {modifierNames && (
                  <p className="text-xs text-text-muted mt-0.5">{modifierNames}</p>
                )}
                {item.removedIngredients.length > 0 && (
                  <p className="text-xs font-extrabold text-red-600 mt-1">
                    ÇIKAR: {item.removedIngredients.map((ingredient) => ingredient.name).join(', ')}
                  </p>
                )}
                {item.allergens.length > 0 && (
                  <p className="text-[11px] font-bold text-warning mt-1">
                    ALERJEN: {item.allergens.map((code) => ALLERGEN_LABELS[code]).join(', ')}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {isExpo && stationSummary.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {stationSummary.map((station) => (
            <span
              key={station.name}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-text-muted"
              style={{ background: `${station.color}22` }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: station.color }} />
              {station.name} {station.count}
            </span>
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-border">
        {canAdvance && nextStatus ? (
          <button
            type="button"
            disabled={loading}
            onClick={handleTap}
            className="h-11 w-full rounded-md bg-primary px-4 text-sm font-extrabold text-white transition-colors hover:bg-secondary disabled:cursor-wait disabled:opacity-60"
          >
            {loading
              ? 'Güncelleniyor…'
              : nextStatus === 'preparing' ? 'Hazırlamaya başla' : 'Hazır olarak işaretle'}
          </button>
        ) : (
          <div className="flex h-10 items-center justify-center rounded-md bg-surface-2 px-3 text-xs font-bold text-text-muted">
            {blockedReason || STATUS_LABELS[order.status as OrderStatus]}
          </div>
        )}
        {error && (
          <p className="mt-2 text-center text-xs font-semibold text-danger">{error}</p>
        )}
      </div>
    </motion.div>
  )
}
