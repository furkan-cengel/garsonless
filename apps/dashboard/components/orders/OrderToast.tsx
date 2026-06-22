'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Order } from './useOrdersRealtime'
import { formatCurrency } from '../../lib/utils'
import { I } from '../../lib/ui'

interface Props {
  order: Order | null
  onDismiss: () => void
}

export default function OrderToast({ order, onDismiss }: Props) {
  useEffect(() => {
    if (!order) return
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [order, onDismiss])

  return (
    <AnimatePresence>
      {order && (
        <motion.div
          initial={{ opacity: 0, y: -56, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -56, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 340, damping: 26 }}
          style={{
            position: 'fixed', top: 16, left: '50%',
            zIndex: 200, width: 320,
            background: 'var(--night, #1a1612)', color: '#fff',
            borderRadius: 14,
            boxShadow: '0 20px 60px -12px rgba(0,0,0,.55)',
            padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'rgba(255,208,137,.18)', color: '#ffd089',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <I.bell size={18} strokeWidth={2} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Yeni sipariş!</p>
            <p style={{
              fontSize: 12, color: 'rgba(255,255,255,.6)', margin: '2px 0 0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {(order.items as unknown as { name: string }[])[0]?.name ?? 'Sipariş'}
              {' · '}
              {formatCurrency(order.total)}
            </p>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
              border: 'none', background: 'rgba(255,255,255,.1)',
              color: 'rgba(255,255,255,.7)', fontSize: 16,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: 0,
            }}
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
