'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { undoTransfer } from '../../lib/actions/tables'
import {
  beginTransferUndo,
  canUndoTransfer,
  finishTransferUndo,
  transferCompleted,
  type TableTransferFeedback,
} from './table-transfer-feedback-model'

export function useTableTransferFeedback({
  restaurantId,
  onChanged,
}: {
  restaurantId: string
  onChanged: () => void | Promise<unknown>
}) {
  const [feedback, setFeedback] = useState<TableTransferFeedback | null>(null)
  const undoInFlight = useRef<string | null>(null)

  useEffect(() => {
    if (!feedback || (feedback.phase !== 'completed' && feedback.phase !== 'undone')) return
    const timeout = window.setTimeout(
      () => setFeedback((current) => current?.operationId === feedback.operationId ? null : current),
      feedback.phase === 'completed' ? 12_000 : 10_000,
    )
    return () => window.clearTimeout(timeout)
  }, [feedback])

  const notifyCompleted = useCallback((operationId: string) => {
    setFeedback(transferCompleted(operationId))
  }, [])

  const undo = useCallback(async () => {
    if (undoInFlight.current !== null || !feedback || !canUndoTransfer(feedback)) return
    const operationId = feedback.operationId

    undoInFlight.current = operationId
    setFeedback((current) => current?.operationId === operationId ? beginTransferUndo(current) : current)
    try {
      const result = await undoTransfer({ restaurantId, operationId })
      setFeedback((current) => finishTransferUndo(current, operationId, result))
      await onChanged()
    } catch {
      setFeedback((current) => finishTransferUndo(current, operationId, { error: 'Beklenmeyen bir bağlantı hatası oluştu. Lütfen tekrar deneyin.' }))
    } finally {
      if (undoInFlight.current === operationId) undoInFlight.current = null
    }
  }, [feedback, onChanged, restaurantId])

  return {
    feedback,
    notifyCompleted,
    undo,
    dismiss: () => setFeedback(null),
  }
}
