'use client'

import type { ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'

/**
 * ResponsiveContainer wrapper at a fixed height + honest empty-state passthrough.
 * When the data is empty it renders the report's existing empty message (never an
 * empty axis/chart), preserving the Wave-1 empty-state discipline.
 */
export default function ChartFrame({
  height = 280,
  isEmpty,
  emptyText,
  children,
}: {
  height?: number
  isEmpty: boolean
  emptyText: string
  children: ReactElement
}) {
  if (isEmpty) {
    return (
      <div style={{ padding: '46px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        {emptyText}
      </div>
    )
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}
