'use client'

import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { rotateTableQrToken } from '../../lib/actions/tables'
import { replaceTableQrToken } from './tables-builder-model'
import type { TableItem } from './tables-builder-types'

interface UseTableQrTokenRotationOptions {
  restaurantId: string
  setTables: Dispatch<SetStateAction<TableItem[]>>
  onError: (message: string) => void
}

function rotationFailureMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'QR kodu döndürülemedi. Lütfen tekrar deneyin.'
}

export function useTableQrTokenRotation({
  restaurantId,
  setTables,
  onError,
}: UseTableQrTokenRotationOptions) {
  const [target, setTarget] = useState<TableItem | null>(null)
  const [rotating, setRotating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestRotation = useCallback((table: TableItem) => {
    if (rotating) return
    setError(null)
    setTarget(table)
  }, [rotating])

  const cancelRotation = useCallback(() => {
    if (rotating) return
    setError(null)
    setTarget(null)
  }, [rotating])

  const confirmRotation = useCallback(async () => {
    if (!target || rotating) return

    setRotating(true)
    setError(null)
    try {
      const result = await rotateTableQrToken({ restaurantId, tableId: target.id })
      if ('error' in result) {
        setError(result.error)
        onError(result.error)
        return
      }
      setTables((current) => replaceTableQrToken(current, target.id, result.token))
      setTarget(null)
    } catch (caught) {
      const message = rotationFailureMessage(caught)
      setError(message)
      onError(message)
    } finally {
      setRotating(false)
    }
  }, [onError, restaurantId, rotating, setTables, target])

  return {
    target,
    rotating,
    error,
    requestRotation,
    cancelRotation,
    confirmRotation,
  }
}
