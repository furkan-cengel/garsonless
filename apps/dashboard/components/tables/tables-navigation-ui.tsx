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
