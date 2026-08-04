'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSessionSettlement, settleOrder } from '../../lib/actions/settlement'
import type { SettlementOrder, SettlementShare } from '../../lib/actions/settlement'
import { confirmCashShare } from '../../lib/actions/split'
import { closeTableSession } from '../../lib/actions/tables'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import { SETTLEMENT_LOAD_ERROR, withSettlementLoadTimeout } from './settlement-load'
import {
  deriveSettlementProjection,
  fillSettlementMethods,
  toggleSettlementMethod,
} from './settlement-sheet-model'
import type { SettlementMethod } from './settlement-sheet-model'

export type SettlementLoadState = 'loading' | 'ready' | 'error'

type UseSettlementSheetInput = {
  restaurantId: string
  session: OpenSessionInfo
  onSettled: () => void
  onSessionClosed: () => void
}

export function useSettlementSheet({
  restaurantId,
  session,
  onSettled,
  onSessionClosed,
}: UseSettlementSheetInput) {
  const [orders, setOrders] = useState<SettlementOrder[] | null>(null)
  const [shares, setShares] = useState<SettlementShare[]>([])
  const [loadState, setLoadState] = useState<SettlementLoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [staged, setStaged] = useState<Record<string, SettlementMethod>>({})
  const [error, setError] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)
  const [confirmingShareId, setConfirmingShareId] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [abnormal, setAbnormal] = useState(false)
  const [abnormalReason, setAbnormalReason] = useState('')

  const reload = useCallback(() => setReloadKey((value) => value + 1), [])

  useEffect(() => {
    let active = true
    setLoadState('loading')
    setLoadError(null)
    void withSettlementLoadTimeout(() => getSessionSettlement(session.sessionId, restaurantId))
      .then((result) => {
        if (!active) return
        if ('error' in result) {
          setLoadError(result.error)
          setLoadState('error')
          return
        }
        setOrders(result.orders)
        setShares(result.shares)
        setLoadState('ready')
      })
      .catch(() => {
        if (!active) return
        setLoadError(SETTLEMENT_LOAD_ERROR)
        setLoadState('error')
      })
    return () => {
      active = false
    }
  }, [session.sessionId, restaurantId, reloadKey])

  const projection = useMemo(
    () => deriveSettlementProjection(orders, shares, staged),
    [orders, shares, staged],
  )
  const busy = committing

  const setMethod = useCallback((orderId: string, method: SettlementMethod) => {
    setStaged((current) => toggleSettlementMethod(current, orderId, method))
  }, [])

  const fillAll = useCallback((method: SettlementMethod) => {
    setStaged((current) => fillSettlementMethods(current, projection.unpaid, method))
  }, [projection.unpaid])

  const confirmShare = useCallback(async (shareId: string) => {
    setError(null)
    setConfirmingShareId(shareId)
    const result = await confirmCashShare(shareId, restaurantId)
    setConfirmingShareId(null)
    if ('error' in result) {
      setError(result.error)
      reload()
      return
    }
    reload()
    onSettled()
  }, [restaurantId, reload, onSettled])

  const commit = useCallback(async () => {
    setError(null)
    setCommitting(true)
    if (projection.isSplitMode && projection.unpaid.length > 0) {
      setError('Bu adisyon split ödeme ile devam ediyor. Önce tüm paylar ödensin veya nakit beyanları garson tarafından onaylansın.')
      setCommitting(false)
      reload()
      return
    }
    for (const order of projection.unpaid) {
      const method = staged[order.id]
      if (!method) continue
      const result = await settleOrder(order.id, restaurantId, method)
      if ('error' in result) {
        setError(result.error)
        setCommitting(false)
        reload()
        return
      }
    }
    const closeResult = await closeTableSession(session.sessionId, restaurantId)
    setCommitting(false)
    if ('error' in closeResult) {
      setError(closeResult.error)
      reload()
      return
    }
    onSettled()
    setDone(true)
  }, [projection.isSplitMode, projection.unpaid, staged, restaurantId, session.sessionId, reload, onSettled])

  const confirmAbnormal = useCallback(async () => {
    const reason = abnormalReason.trim()
    if (!reason) return
    setError(null)
    setCommitting(true)
    const result = await closeTableSession(session.sessionId, restaurantId, { abnormalReason: reason })
    setCommitting(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    onSessionClosed()
  }, [abnormalReason, session.sessionId, restaurantId, onSessionClosed])

  const cancelAbnormal = useCallback(() => {
    setAbnormal(false)
    setAbnormalReason('')
  }, [])

  return {
    orders,
    shares,
    loadState,
    loadError,
    staged,
    error,
    committing,
    confirmingShareId,
    done,
    abnormal,
    abnormalReason,
    busy,
    projection,
    reload,
    setMethod,
    fillAll,
    confirmShare,
    commit,
    confirmAbnormal,
    setAbnormal,
    setAbnormalReason,
    cancelAbnormal,
  }
}
