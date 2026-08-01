import type { OpenTableSession } from './tables'

export const TABLE_LATE_AFTER_MINUTES = 45

export type TableOperationalState = 'empty' | 'new' | 'open' | 'late'

export interface TableOperationalProjection {
  state: TableOperationalState
  elapsedMinutes: number
  remainingTotal: number
  isSettled: boolean
}

export function projectTableOperation(
  session: OpenTableSession | undefined,
  now: number,
): TableOperationalProjection {
  if (!session) {
    return { state: 'empty', elapsedMinutes: 0, remainingTotal: 0, isSettled: false }
  }

  const openedAt = new Date(session.openedAt).getTime()
  const elapsedMinutes = Number.isFinite(openedAt)
    ? Math.max(0, Math.floor((now - openedAt) / 60_000))
    : 0
  const remainingTotal = Math.max(0, session.unpaidTotal - session.splitSettledTotal)
  const isSettled = session.orderCount > 0
    && remainingTotal === 0
    && session.splitDeclaredCashTotal === 0
    && !session.hasUnfinished

  return {
    state: elapsedMinutes >= TABLE_LATE_AFTER_MINUTES
      ? 'late'
      : session.orderCount === 0
        ? 'new'
        : 'open',
    elapsedMinutes,
    remainingTotal,
    isSettled,
  }
}
