import type { ReactNode } from 'react'

type Tone = 'brand' | 'warm' | 'ink' | 'cream'

const TONES: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: 'var(--brand-soft)', fg: 'var(--brand)' },
  warm:  { bg: '#fbeee2',           fg: 'var(--accent)' },
  ink:   { bg: 'var(--ink)',        fg: 'var(--accent-2)' },
  cream: { bg: 'var(--bg-2)',       fg: 'var(--ink-2)' },
}

export function Eyebrow({ children, tone = 'brand' }: { children: ReactNode; tone?: Tone }) {
  const t = TONES[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 999,
      background: t.bg, color: t.fg,
      fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: 999, background: t.fg,
        animation: tone === 'ink' ? 'pulse-soft 2s infinite' : 'none',
      }} />
      {children}
    </span>
  )
}
