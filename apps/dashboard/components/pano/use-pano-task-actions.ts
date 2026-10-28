'use client'

import { useCallback, useState } from 'react'
import { updateOrderStatus } from '../../lib/actions/orders'
import { resolveServiceRequest } from '../../lib/actions/service-requests'
import type { PanoTask } from './pano-shift-model'

/**
 * Runs a task's command and hides the task at once; a failure brings it back
 * with a message. Approval goes through the feed's approval controller so both
 * places agree on an order's state.
 */
export function usePanoTaskActions({
  restaurantId,
  approveOrder,
  onDone,
}: {
  restaurantId: string
  approveOrder: (orderId: string) => Promise<void>
  onDone: () => void
}) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  const run = useCallback(async (task: PanoTask) => {
    const action = task.action
    if (!action || action.kind === 'open' || busy) return
    setBusy(task.id)
    setMessage(null)
    let error: string | null = null
    if (action.kind === 'approve') await approveOrder(action.orderId)
    else if (action.kind === 'serve') {
      const result = await updateOrderStatus(action.orderId, 'served', restaurantId).catch(() => ({ error: 'İşlem yapılamadı.' }))
      if ('error' in result) error = result.error
    } else {
      const result = await resolveServiceRequest(action.requestId, restaurantId).catch(() => ({ error: 'İşlem yapılamadı.' }))
      if ('error' in result) error = result.error
    }
    setBusy(null)
    if (error) {
      setMessage({ text: `${task.title}: ${error}`, error: true })
      return
    }
    setHidden((current) => new Set(current).add(task.id))
    setMessage({ text: `${task.title.split(' · ')[0]}: ${task.actionLabel.toLocaleLowerCase('tr-TR')}.`, error: false })
    onDone()
  }, [approveOrder, busy, onDone, restaurantId])

  return { hidden, busy, message, dismissMessage: () => setMessage(null), run }
}
