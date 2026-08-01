import { projectTableOperation } from '@garsonless/application/table-operations'
import type { PanoOperationalSource } from '@garsonless/application/read-models'
import type { TableStatusData } from './queries/insights-shared'

export function projectPanoTableStatuses(
  source: Pick<PanoOperationalSource, 'tables' | 'openTableSessions'>,
  now: number,
): TableStatusData[] {
  const sessionByTable = new Map(source.openTableSessions.map((session) => [session.tableId, session]))

  return source.tables
    .filter((table) => table.deletedAt === null)
    .map((table) => {
      const session = sessionByTable.get(table.id)
      const operation = projectTableOperation(session, now)
      if (!session) {
        return {
          id: table.id,
          label: table.label,
          status: 'empty' as const,
          time: 0,
          total: 0,
          sessionId: null,
          openedAt: null,
          unpaidTotal: 0,
          splitSettledTotal: 0,
          splitDeclaredCashTotal: 0,
          orderCount: 0,
          hasUnfinished: false,
        }
      }

      const status: TableStatusData['status'] = operation.isSettled
        ? 'paid'
        : operation.state === 'open'
          ? 'active'
          : operation.state

      return {
        id: table.id,
        label: table.label,
        status,
        time: operation.elapsedMinutes,
        total: operation.remainingTotal > 0 ? operation.remainingTotal : session.total,
        sessionId: session.sessionId,
        openedAt: session.openedAt,
        unpaidTotal: session.unpaidTotal,
        splitSettledTotal: session.splitSettledTotal,
        splitDeclaredCashTotal: session.splitDeclaredCashTotal,
        orderCount: session.orderCount,
        hasUnfinished: session.hasUnfinished,
      }
    })
}
