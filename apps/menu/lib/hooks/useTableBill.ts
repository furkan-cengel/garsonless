'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BillOrder } from '@garsonless/ui/menu'
import type { SessionOrderRow, TableSessionInfo } from '../queries'

interface UseTableBillOptions {
  tableToken: string | null
  initialSession: TableSessionInfo | null
  initialOrders: SessionOrderRow[]
}

type RefreshResult = 'open' | 'closed' | 'none'

/** Owns the protected table-session reconciliation and bill-sheet lifecycle. */
export function useTableBill({ tableToken, initialSession, initialOrders }: UseTableBillOptions) {
  const [tableSession, setTableSession] = useState<TableSessionInfo | null>(initialSession)
  const [billOrders, setBillOrders] = useState<BillOrder[]>(initialOrders)
  const [isBillOpen, setIsBillOpen] = useState(false)
  const [billRefreshing, setBillRefreshing] = useState(false)
  const [billClosedNotice, setBillClosedNotice] = useState(false)
  const tableSessionId = tableSession?.id ?? null

  const refreshBill = useCallback(async (): Promise<RefreshResult> => {
    if (!tableToken) return 'none'
    const response = await fetch(`/api/table-state?token=${encodeURIComponent(tableToken)}`, {
      cache: 'no-store',
    })
    const payload = await response.json() as {
      success: boolean
      data?: {
        session: { id: string; opened_at: string } | null
        orders: Array<{
          id: string
          status: string
          total: number
          paid_at: string | null
          created_at: string
          items: unknown
        }>
      }
    }
    if (!payload.success) return 'none'

    const sessionRow = payload.data?.session ?? null
    if (!sessionRow) {
      setTableSession(null)
      return 'closed'
    }

    setTableSession({ id: sessionRow.id, openedAt: sessionRow.opened_at })
    setBillOrders((payload.data?.orders ?? []).map((row) => ({
      id: row.id,
      status: row.status,
      total: Number(row.total),
      paidAt: row.paid_at,
      createdAt: row.created_at,
      itemCount: Array.isArray(row.items) ? row.items.length : 0,
    })))
    return 'open'
  }, [tableToken])

  const openBill = useCallback(async () => {
    setIsBillOpen(true)
    setBillClosedNotice(false)
    setBillRefreshing(true)
    const result = await refreshBill()
    setBillRefreshing(false)
    if (result === 'closed') setBillClosedNotice(true)
  }, [refreshBill])

  const closeBill = useCallback(() => {
    setIsBillOpen(false)
    if (billClosedNotice) {
      setBillOrders([])
      setBillClosedNotice(false)
    }
  }, [billClosedNotice])

  useEffect(() => {
    if (!tableSessionId) return
    const timer = window.setInterval(() => void refreshBill(), 3_000)
    return () => window.clearInterval(timer)
  }, [tableSessionId, refreshBill])

  useEffect(() => {
    if (tableToken && !initialSession) void refreshBill()
  }, [tableToken, initialSession, refreshBill])

  const billSummary = useMemo(() => {
    const activeOrders = billOrders.filter((order) => order.status !== 'cancelled')
    if (!tableSession || activeOrders.length === 0) return null
    return {
      total: activeOrders.reduce((sum, order) => sum + order.total, 0),
      count: billOrders.length,
    }
  }, [billOrders, tableSession])

  return {
    tableSession,
    tableSessionId,
    billOrders,
    isBillOpen,
    billRefreshing,
    billClosedNotice,
    billSummary,
    refreshBill,
    openBill,
    closeBill,
  }
}
