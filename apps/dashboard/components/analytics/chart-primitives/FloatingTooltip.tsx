'use client'

import type { ReactNode } from 'react'

/**
 * Follow-cursor tooltip positioner for the NON-recharts charts (the CSS heatmap
 * in P2). recharts charts don't use this — recharts positions its own single
 * tooltip. `position: fixed` escapes any Card `overflow` (same approach the
 * dashboard modals use — no portal needed). Clamped so it never leaves the
 * viewport. Purely visual: pointer-events none.
 */
export default function FloatingTooltip({
  x, y, visible, children,
}: {
  x: number
  y: number
  visible: boolean
  children: ReactNode
}) {
  if (!visible) return null
  const OFFSET = 14
  const flipX = x > (typeof window !== 'undefined' ? window.innerWidth : 1440) - 180
  const style = {
    position: 'fixed' as const,
    top: y + OFFSET,
    left: flipX ? undefined : x + OFFSET,
    right: flipX ? (typeof window !== 'undefined' ? window.innerWidth : 1440) - x + OFFSET : undefined,
    zIndex: 45,
    pointerEvents: 'none' as const,
  }
  return <div style={style}>{children}</div>
}
