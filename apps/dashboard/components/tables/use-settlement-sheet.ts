'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { settleSessionAndClose } from '../../lib/actions/settlement'
import type { SettlementOrder, SettlementShare } from '../../lib/actions/settlement'
import {
  confirmCashShare,
  reconcileCardShare as reconcileCardShareAction,
  releaseUnstartedCardShare,
} from '../../lib/actions/split'
import { closeTableSession } from '../../lib/actions/tables'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import { SETTLEMENT_LOAD_ERROR } from './settlement-load'
import {
  clearSessionSettlementCache,
  loadSessionSettlement,
  settlementLoadKey,
} from './settlement-data-load'
import {
  deriveSettlementProjection,
  fillSettlementMethods,
  toggleSettlementMethod,
} from './settlement-sheet-model'
import { createTableMutationRunner } from './table-mutation-runner'
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
  const runMutation = useMemo(createTableMutationRunner, [])
  const [orders, setOrders] = useState<SettlementOrder[] | null>(null)
  const [shares, setShares] = useState<SettlementShare[]>([])
  const [loadState, setLoadState] = useState<SettlementLoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [staged, setStaged] = useState<Record<string, SettlementMethod>>({})
  const [error, setError] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)
  const [confirmingShareId, setConfirmingShareId] = useState<string | null>(null)
  const [resolvingShareId, setResolvingShareId] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [abnormal, setAbnormal] = useState(false)
  const [abnormalReason, setAbnormalReason] = useState('')
  const loadKey = settlementLoadKey(restaurantId, session)

  const reload = useCallback(() => {
    clearSessionSettlementCache(restaurantId, session.sessionId)
    setLoadState('loading')
    setStaged({})
    setReloadKey((value) => value + 1)
  }, [restaurantId, session.sessionId])

  useEffect(() => {
    let active = true
    setLoadState('loading')
    setLoadError(null)
    void loadSessionSettlement(restaurantId, session.sessionId, loadKey)
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
  }, [session.sessionId, restaurantId, loadKey, reloadKey])

  const projection = useMemo(
    () => deriveSettlementProjection(orders, shares, staged),
    [orders, shares, staged],
  )
  const busy = committing || confirmingShareId !== null || resolvingShareId !== null

  const setMethod = useCallback((orderId: string, method: SettlementMethod) => {
    setStaged((current) => toggleSettlementMethod(current, orderId, method))
  }, [])

  const fillAll = useCallback((method: SettlementMethod) => {
    setStaged((current) => fillSettlementMethods(current, projection.unpaid, method))
  }, [projection.unpaid])

  const mutate = useCallback((action: () => Promise<void>, kind: 'commit' | 'confirm' | 'resolve', shareId?: string) => runMutation({
    action,
    onStart: () => {
      setError(null)
      if (kind === 'commit') setCommitting(true)
      else if (kind === 'confirm') setConfirmingShareId(shareId ?? null)
      else setResolvingShareId(shareId ?? null)
    },
    onFailure: () => {
      setError('İşlemin sonucu doğrulanamadı. Adisyon yeniden yükleniyor; tekrar işlem yapmadan güncel tahsilatı kontrol edin.')
      reload()
    },
    onFinish: () => {
      setCommitting(false)
      setConfirmingShareId(null)
      setResolvingShareId(null)
    },
  }), [reload, runMutation])

  const updateShare = useCallback((action: () => Promise<{ error: string } | { success: true }>, kind: 'confirm' | 'resolve', shareId: string) => mutate(async () => {
    const result = await action()
    reload()
    if ('error' in result) setError(result.error)
    else onSettled()
  }, kind, shareId), [mutate, reload, onSettled])

  const confirmShare = (shareId: string) => updateShare(() => confirmCashShare(shareId, restaurantId), 'confirm', shareId)
  const releaseCardShare = (shareId: string) => updateShare(() => releaseUnstartedCardShare(shareId, restaurantId), 'resolve', shareId)
  const reconcileCardShare = (shareId: string) => updateShare(() => reconcileCardShareAction(shareId, restaurantId), 'resolve', shareId)

  const commit = () => mutate(async () => {
    if (loadState !== 'ready') return
    if (projection.isSplitMode && projection.unpaid.length > 0) {
      setError('Bu adisyon split ödeme ile devam ediyor. Önce tüm paylar ödensin veya nakit beyanları garson tarafından onaylansın.')
      reload()
      return
    }
    const settlements = projection.unpaid.flatMap((order) => {
      const method = staged[order.id]
      return method ? [{ orderId: order.id, method }] : []
    })
    const closeResult = await settleSessionAndClose({ restaurantId, sessionId: session.sessionId, settlements })
    if ('error' in closeResult) {
      setError(closeResult.error)
      reload()
      return
    }
    clearSessionSettlementCache(restaurantId, session.sessionId)
    onSettled()
    setDone(true)
  }, 'commit')

  const confirmAbnormal = () => mutate(async () => {
    const reason = abnormalReason.trim()
    if (!reason || loadState !== 'ready') return
    const result = await closeTableSession(session.sessionId, restaurantId, { abnormalReason: reason })
    if ('error' in result) {
      setError(result.error)
      reload()
      return
    }
    onSessionClosed()
  }, 'commit')

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
    resolvingShareId,
    done,
    abnormal,
    abnormalReason,
    busy,
    projection,
    reload,
    setMethod,
    fillAll,
    confirmShare,
    releaseCardShare,
    reconcileCardShare,
    commit,
    confirmAbnormal,
    setAbnormal,
    setAbnormalReason,
    cancelAbnormal,
  }
}
