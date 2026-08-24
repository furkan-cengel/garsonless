'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { OpenTableSessionView } from './tables-builder-types'
import { prefetchSessionSettlement } from './settlement-data-load'
import { prefetchTransferableOrders } from './transfer-orders-load'

export function useTableOperationPrefetch({
  restaurantId,
  openSessions,
  setDetailTableId,
}: {
  restaurantId: string
  openSessions: Record<string, OpenTableSessionView>
  setDetailTableId: Dispatch<SetStateAction<string | null>>
}) {
  const preparedSettlementKeys = useRef(new Set<string>())

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const sessions = Object.values(openSessions)
        .filter((session) => session.orderCount > 0)
        .sort((left, right) => right.unpaidTotal - left.unpaidTotal || left.openedAt.localeCompare(right.openedAt))
        .slice(0, 3)
      if (sessions.length === 0) return
      void import('./SettlementSheet').catch(() => undefined)
      for (const session of sessions) {
        const revision = [session.sessionId, session.orderCount, session.total, session.unpaidTotal, session.splitSettledTotal, session.splitDeclaredCashTotal].join(':')
        if (preparedSettlementKeys.current.has(revision)) continue
        preparedSettlementKeys.current.add(revision)
        prefetchSessionSettlement(restaurantId, session)
      }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [openSessions, restaurantId])

  const prefetchOperations = useCallback((tableId: string) => {
    const session = openSessions[tableId]
    if (!session) return
    void import('./TableTransferDialog').catch(() => undefined)
    void import('./SettlementSheet').catch(() => undefined)
    prefetchTransferableOrders(restaurantId, session)
    prefetchSessionSettlement(restaurantId, session)
  }, [openSessions, restaurantId])

  const openTableDetail = useCallback((tableId: string) => {
    setDetailTableId(tableId)
    prefetchOperations(tableId)
  }, [prefetchOperations, setDetailTableId])

  return { openTableDetail, prefetchOperations }
}
