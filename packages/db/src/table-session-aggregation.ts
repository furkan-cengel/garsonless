import type { OpenTableSession } from '@garsonless/application/tables'

export type OpenSessionRow = {
  id: string
  table_id: string
  opened_at: string
}

export type OpenSessionOrderRow = {
  table_session_id: string
  total: number
  status: string
  paid_at: string | null
}

export type OpenSessionShareRow = {
  table_session_id: string
  amount: number | null
  method: string | null
  status: string
}

export function aggregateOpenTableSessions(
  sessions: Iterable<OpenSessionRow>,
  orders: Iterable<OpenSessionOrderRow>,
  shares: Iterable<OpenSessionShareRow>,
): OpenTableSession[] {
  const result: OpenTableSession[] = []
  const bySessionId = new Map<string, OpenTableSession>()

  for (const session of sessions) {
    const projection: OpenTableSession = {
      sessionId: session.id,
      tableId: session.table_id,
      openedAt: session.opened_at,
      total: 0,
      unpaidTotal: 0,
      splitSettledTotal: 0,
      splitDeclaredCashTotal: 0,
      orderCount: 0,
      hasUnfinished: false,
    }
    result.push(projection)
    bySessionId.set(session.id, projection)
  }

  for (const order of orders) {
    const projection = bySessionId.get(order.table_session_id)
    if (!projection || order.status === 'cancelled') continue

    const total = Number(order.total)
    projection.total += total
    if (order.paid_at === null) projection.unpaidTotal += total
    projection.orderCount += 1
    if (order.status !== 'served') projection.hasUnfinished = true
  }

  for (const share of shares) {
    const projection = bySessionId.get(share.table_session_id)
    if (!projection) continue

    const amount = Number(share.amount ?? 0)
    if (share.status === 'settled') projection.splitSettledTotal += amount
    if (share.status === 'declared' && share.method === 'cash') {
      projection.splitDeclaredCashTotal += amount
    }
  }

  return result
}
