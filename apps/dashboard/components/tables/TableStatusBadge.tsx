import { TABLE_OPERATIONAL_COPY, TABLE_OPERATIONAL_SHORT_COPY, type TableOperationalState } from './tables-operation-model'

const CIRCLE = 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0'

/* Each state has its own glyph so states stay distinct without color (see .tb-state in TABLES_SHELL_CSS). */
const STATE_ICON_PATH: Record<TableOperationalState, string> = {
  empty: CIRCLE,
  new: `${CIRCLE} M12 8v8 M8 12h8`,
  open: `${CIRCLE} M12 7.5v4.5l3 2`,
  late: 'M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z M12 9v4.5 M12 17h.01',
  stale: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  paid: `${CIRCLE} M8 12.3l2.7 2.7L16.2 9.5`,
}

export function TableStatusIcon({ state, size = 12 }: { state: TableOperationalState; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={STATE_ICON_PATH[state]} />
    </svg>
  )
}

export function TableStatusBadge({ state, full = false, className = '' }: { state: TableOperationalState; full?: boolean; className?: string }) {
  return (
    <span className={`tb-state tb-state--${state}${className ? ` ${className}` : ''}`}>
      <TableStatusIcon state={state} />
      {full ? TABLE_OPERATIONAL_COPY[state] : TABLE_OPERATIONAL_SHORT_COPY[state]}
    </span>
  )
}
