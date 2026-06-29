'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Tables, OrderStatus } from '@garsonless/db'
import { ALLERGEN_LABELS, readOrderCustomerTierSnapshot, readOrderLineSnapshots } from '@garsonless/db/order-client'
import ElapsedTimer from './ElapsedTimer'
import { updateOrderStatusAction } from '../lib/actions/orders'

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'preparing',
  pending_approval: 'preparing',
  sent_to_kitchen: 'preparing',
  paid: 'preparing',
  preparing: 'ready',
  ready: 'served',
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
  order: Tables<'orders'>
  restaurantId: string
  kitchenToken: string
  tableLabel?: string
}

export default function KitchenCard({ order, restaurantId, kitchenToken, tableLabel }: KitchenCardProps) {
  const [loading, setLoading] = useState(false)

  const items = readOrderLineSnapshots(order.items)
  const nextStatus = NEXT_STATUS[order.status as OrderStatus]
  const tier = readOrderCustomerTierSnapshot(order.customer_tier)

  async function handleTap() {
    if (!nextStatus || loading) return
    setLoading(true)
    await updateOrderStatusAction(order.id, nextStatus, restaurantId, kitchenToken)
    setLoading(false)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={handleTap}
      className={[
        'bg-surface rounded-[14px] border border-border p-4 select-none',
        nextStatus ? 'cursor-pointer hover:border-primary/50 active:scale-[0.98]' : 'cursor-default',
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
        {items.map((item, i) => {
          const modifierNames = item.modifiers
            .map((modifier) => `${modifier.optionName}${modifier.quantity > 1 ? ` ×${modifier.quantity}` : ''}`)
            .join(', ')
          return (
            <li key={i} className="flex items-start gap-2">
              <span className="text-primary font-bold text-sm min-w-[22px]">{item.quantity}×</span>
              <div>
                <span className="text-sm text-text leading-tight">{item.name}</span>
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

      {nextStatus && (
        <div className="text-center pt-1 border-t border-border">
          <span className="text-xs px-3 py-1 rounded-full bg-primary/15 text-primary">
            → {STATUS_LABELS[nextStatus]}
          </span>
        </div>
      )}
    </motion.div>
  )
}
