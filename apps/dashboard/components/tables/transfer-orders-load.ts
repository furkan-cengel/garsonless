'use client'

import {
  getTransferableSessionOrders,
  type TransferableSessionOrder,
} from '../../lib/actions/tables'
import {
  reuseSettlementLoad,
  withSettlementLoadRetry,
} from './settlement-load'

const TRANSFER_ORDERS_CACHE_TTL_MS = 30_000

export type TransferOrdersSessionRevision = {
  sessionId: string
  orderCount: number
  total: number
  unpaidTotal: number
  splitSettledTotal: number
  splitDeclaredCashTotal: number
}

export function transferOrdersLoadKey(
  restaurantId: string,
  session: TransferOrdersSessionRevision,
): string {
  return [
    'transfer',
    restaurantId,
    session.sessionId,
    session.orderCount,
    session.total,
    session.unpaidTotal,
    session.splitSettledTotal,
    session.splitDeclaredCashTotal,
  ].join(':')
}

export function loadTransferableOrders(
  restaurantId: string,
  sessionId: string,
  loadKey: string,
) {
  return reuseSettlementLoad(
    loadKey,
    () => withSettlementLoadRetry(
      () => getTransferableSessionOrders(sessionId, restaurantId),
      (result) => 'error' in result && result.code === 'READ_FAILED',
    ),
    {
      resultTtlMs: TRANSFER_ORDERS_CACHE_TTL_MS,
      shouldCache: (result): result is TransferableSessionOrder[] => Array.isArray(result),
    },
  )
}

export function prefetchTransferableOrders(
  restaurantId: string,
  session: TransferOrdersSessionRevision,
): void {
  void loadTransferableOrders(
    restaurantId,
    session.sessionId,
    transferOrdersLoadKey(restaurantId, session),
  ).catch(() => undefined)
}
