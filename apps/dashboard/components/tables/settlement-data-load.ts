'use client'

import {
  getSessionSettlement,
  type SettlementOrder,
  type SettlementShare,
} from '../../lib/actions/settlement'
import {
  clearRecentSettlementLoads,
  reuseSettlementLoad,
  SETTLEMENT_LOAD_ERROR,
  withSettlementLoadRetry,
} from './settlement-load'
import type { TransferOrdersSessionRevision } from './transfer-orders-load'

const SETTLEMENT_CACHE_TTL_MS = 30_000
type SettlementResult = { orders: SettlementOrder[]; shares: SettlementShare[] } | { error: string }

export function settlementLoadKey(restaurantId: string, session: TransferOrdersSessionRevision): string {
  return [
    'settlement',
    restaurantId,
    session.sessionId,
    session.orderCount,
    session.total,
    session.unpaidTotal,
    session.splitSettledTotal,
    session.splitDeclaredCashTotal,
  ].join(':')
}

export function loadSessionSettlement(restaurantId: string, sessionId: string, loadKey: string) {
  return reuseSettlementLoad(
    loadKey,
    () => withSettlementLoadRetry(
      () => getSessionSettlement(sessionId, restaurantId),
      (result) => 'error' in result && result.error === SETTLEMENT_LOAD_ERROR,
    ),
    {
      resultTtlMs: SETTLEMENT_CACHE_TTL_MS,
      shouldCache: (result: SettlementResult) => !('error' in result),
    },
  )
}

export function prefetchSessionSettlement(restaurantId: string, session: TransferOrdersSessionRevision): void {
  void loadSessionSettlement(restaurantId, session.sessionId, settlementLoadKey(restaurantId, session))
    .catch(() => undefined)
}

export function clearSessionSettlementCache(restaurantId: string, sessionId: string): void {
  clearRecentSettlementLoads(`settlement:${restaurantId}:${sessionId}:`)
}
