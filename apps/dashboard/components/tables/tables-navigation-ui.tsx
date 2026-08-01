import React from 'react'
import { AppIconNodes, AppIcons } from '@garsonless/ui/icons'

export const TABLES_NAV_ICONS = {
  search: AppIconNodes.search,
  plus: AppIconNodes.plus,
  check: AppIconNodes.check,
  close: AppIconNodes.close,
  more: AppIconNodes.more,
  bellSmall: <AppIcons.bell size={11} />,
}

export const TABLES_NAV_STYLES = {
  label: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-3)',
  },
  mono: {
    fontFamily: "'Geist Mono', ui-monospace, monospace",
    fontVariantNumeric: 'tabular-nums' as const,
  },
}

export function tablesNavPrimaryButton(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 12px',
    borderRadius: 7,
    border: '1px solid var(--action)',
    background: 'var(--action)',
    color: 'var(--on-action)',
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 1px 0 rgba(0,0,0,.04)',
  }
}

export function tablesNavGhostButton(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 10px',
    borderRadius: 7,
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }
}

export function TablesMiniQR({ seed }: { seed: string }) {
  let hash = 0
  for (let index = 0; index < seed.length; index++) hash = (hash * 31 + seed.charCodeAt(index)) | 0
  const random = (index: number) => {
    const value = ((hash ^ (index * 2654435761)) >>> 0)
    return (value % 100) / 100
  }
  const cells: [number, number][] = []
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      if (random(y * 7 + x) > 0.55) cells.push([x, y])
    }
  }
  return (
    <svg width="20" height="20" viewBox="0 0 14 14">
      <rect x="0" y="0" width="4" height="4" fill="#111113" rx=".5" />
      <rect x="1" y="1" width="2" height="2" fill="#fff" />
      <rect x="10" y="0" width="4" height="4" fill="#111113" rx=".5" />
      <rect x="11" y="1" width="2" height="2" fill="#fff" />
      <rect x="0" y="10" width="4" height="4" fill="#111113" rx=".5" />
      <rect x="1" y="11" width="2" height="2" fill="#fff" />
      {cells.map(([x, y], index) => (
        (x < 4 && y < 4) || (x > 9 && y < 4) || (x < 4 && y > 9)
          ? null
          : <rect key={index} x={x * 2} y={y * 2} width="1.6" height="1.6" fill="#111113" />
      ))}
    </svg>
  )
}
