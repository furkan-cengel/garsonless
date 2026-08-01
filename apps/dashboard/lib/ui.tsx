import type { CSSProperties, ReactNode } from 'react'
import type { AppIcon as Icon } from '@garsonless/ui/icons'
import { AppIcons as I } from '@garsonless/ui/icons'

export { I }
export type { Icon }

/* ============================================================
   STYLE CONSTANTS
   ============================================================ */
export const S = {
  label: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-3)',
  } satisfies CSSProperties,
  mono: {
    fontFamily: "'Geist Mono', ui-monospace, monospace",
    fontVariantNumeric: 'tabular-nums',
  } satisfies CSSProperties,
  caption: {
    fontSize: 12,
    color: 'var(--text-2)',
  } satisfies CSSProperties,
}

/* ============================================================
   BUTTON STYLE HELPERS
   Returns CSSProperties for use with style={}
   ============================================================ */
export function btnPrimary(overrides?: CSSProperties): CSSProperties {
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
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 1px 0 rgba(0,0,0,.04)',
    ...overrides,
  }
}

export function btnGhost(overrides?: CSSProperties): CSSProperties {
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
    ...overrides,
  }
}

/* ============================================================
   PRIMITIVE COMPONENTS
   ============================================================ */

interface IconButtonProps {
  icon: ReactNode
  ariaLabel?: string
  onClick?: () => void
  active?: boolean
  size?: number
  className?: string
  initialFocus?: boolean
}

export function IconButton({ icon, ariaLabel, onClick, active, size = 28, className, initialFocus = false }: IconButtonProps) {
  return (
    <button
      type="button"
      className={className}
      data-modal-initial-focus={initialFocus ? '' : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)' }}
      onMouseLeave={e => { e.currentTarget.style.background = active ? 'var(--surface-inset)' : 'transparent' }}
      style={{
        height: size,
        width: size,
        padding: 0,
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--surface-inset)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-2)',
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 120ms',
      }}
    >
      {icon}
    </button>
  )
}

type TagTone = 'neutral' | 'positive' | 'warning' | 'critical' | 'info'

const TAG_TONES: Record<TagTone, { bg: string; fg: string }> = {
  neutral:  { bg: 'var(--surface-3)',   fg: 'var(--text-2)' },
  positive: { bg: 'var(--positive-bg)', fg: 'var(--positive)' },
  warning:  { bg: 'var(--warning-bg)',  fg: 'var(--warning)' },
  critical: { bg: 'var(--critical-bg)', fg: 'var(--critical)' },
  info:     { bg: 'var(--info-bg)',     fg: 'var(--info)' },
}

interface TagProps {
  children: ReactNode
  tone?: TagTone
}

export function Tag({ children, tone = 'neutral' }: TagProps) {
  const t = TAG_TONES[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: t.bg,
        color: t.fg,
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 7px',
        borderRadius: 999,
        lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  )
}

export function Skeleton({ width, height, style }: { width?: number | string; height?: number | string; style?: CSSProperties }) {
  return (
    <div style={{
      width: width ?? '100%',
      height: height ?? 16,
      background: 'var(--surface-3)',
      borderRadius: 4,
      animation: 'skeleton-pulse 1.5s ease-in-out infinite',
      ...style,
    }} />
  )
}

export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px', color: 'var(--text-3)', textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, marginBottom: 8, color: 'var(--text-4)' }}>—</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>{title}</div>
      {sub && <div style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
