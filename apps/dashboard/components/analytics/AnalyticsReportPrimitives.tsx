import type { CSSProperties, ReactNode } from 'react'

const mono = { fontFamily: "'Geist Mono', ui-monospace, monospace" } as CSSProperties

export function AnalyticsKpi({
  label,
  value,
  delta,
  down,
  direction,
  tone,
  hint,
}: {
  label: string
  value: string
  delta: string
  down?: boolean
  direction?: 'up' | 'down' | 'flat'
  tone?: 'positive' | 'critical' | 'neutral'
  hint?: string
}) {
  const resolvedTone = tone ?? (delta === '—' ? 'neutral' : down ? 'critical' : 'positive')
  const resolvedDirection = direction ?? (delta === '—' ? 'flat' : down ? 'down' : 'up')
  const neutral = resolvedTone === 'neutral'
  const positive = resolvedTone === 'positive'
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 500 }}>{label}</div>
      <div style={{ ...mono, fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', marginTop: 4, color: 'var(--text)' }}>{value}</div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, minHeight: 19 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '2px 7px', borderRadius: 999,
          background: neutral ? 'var(--surface-3)' : positive ? 'var(--positive-bg)' : 'var(--critical-bg)',
          color: neutral ? 'var(--text-3)' : positive ? 'var(--positive)' : 'var(--critical)',
          fontSize: 10.5, fontWeight: 600,
        }}>{resolvedDirection === 'up' ? '↑ ' : resolvedDirection === 'down' ? '↓ ' : ''}{delta}</div>
        {hint && <span style={{ fontSize: 10.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{hint}</span>}
      </div>
    </div>
  )
}

export function AnalyticsCard({
  title,
  subtitle,
  children,
  style,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 12,
      border: '1px solid var(--border)', overflow: 'hidden', ...style,
    }}>
      <div style={{
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--divider)',
      }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      <div>{children}</div>
    </div>
  )
}
