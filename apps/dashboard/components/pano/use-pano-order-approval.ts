'use client'

import { useCallback, useRef, useState } from 'react'
import { updateOrderStatus } from '../../lib/actions/orders'

export type PanoOrderApprovalState = {
  isPending: boolean
  error: string | null
}

type PanoOrderApprovalStates = Record<string, PanoOrderApprovalState | undefined>

/** Owns optimistic-safe order approval command state for the live activity feed. */
export function usePanoOrderApproval({
  restaurantId,
  onApproved,
}: {
  restaurantId: string
  onApproved: (orderId: string, status: string) => void
}) {
  const [states, setStates] = useState<PanoOrderApprovalStates>({})
  const pendingOrderIds = useRef(new Set<string>())

  const approveOrder = useCallback(async (orderId: string) => {
    if (pendingOrderIds.current.has(orderId)) return
    pendingOrderIds.current.add(orderId)

    setStates((current) => ({ ...current, [orderId]: { isPending: true, error: null } }))
    try {
      const result = await updateOrderStatus(orderId, 'sent_to_kitchen', restaurantId)
      if ('error' in result) {
        setStates((current) => ({ ...current, [orderId]: { isPending: false, error: result.error } }))
        return
      }
      setStates((current) => ({ ...current, [orderId]: { isPending: false, error: null } }))
      onApproved(orderId, 'sent_to_kitchen')
    } catch {
      setStates((current) => ({ ...current, [orderId]: { isPending: false, error: 'Sipariş onaylanamadı.' } }))
    } finally {
      pendingOrderIds.current.delete(orderId)
    }
  }, [onApproved, restaurantId])

  return { approvalStates: states, approveOrder }
}
