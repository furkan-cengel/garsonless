'use client'

import { useEffect } from 'react'
import type { Order } from './useOrdersRealtime'
import { formatCurrency } from '../../lib/utils'
import { Toaster, toast } from '@/components/ui/toast'

interface Props {
  order: Order | null
  onDismiss: () => void
  /** In-app toast channel; when false the event is cleared without rendering. */
  enabled?: boolean
}

export default function OrderToast({ order, onDismiss, enabled = true }: Props) {
  useEffect(() => {
    if (!order) return
    if (!enabled) { onDismiss(); return }
    const itemName = (order.items as unknown as { name: string }[])[0]?.name ?? 'Sipariş'
    toast.add({
      title: 'Yeni sipariş!',
      description: `${itemName} · ${formatCurrency(order.total)}`,
      type: 'info',
      timeout: 4000,
    })
    onDismiss()
  }, [order, enabled, onDismiss])

  return <Toaster />
}
