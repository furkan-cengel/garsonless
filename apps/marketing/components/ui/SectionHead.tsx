import type { ReactNode } from 'react'
import { Eyebrow } from './Eyebrow'

type Tone = 'brand' | 'warm' | 'ink' | 'cream'

interface SectionHeadProps {
  eyebrow?: ReactNode
  title: ReactNode
  sub?: ReactNode
  align?: 'center' | 'left'
  tone?: Tone
  maxW?: number
}

export function SectionHead({ eyebrow, title, sub, align = 'center', tone, maxW = 720 }: SectionHeadProps) {
  return (
    <div style={{
      textAlign: align, maxWidth: maxW,
      margin: align === 'center' ? '0 auto 56px' : '0 0 48px',
    }}>
      {eyebrow && (
        <div style={{ marginBottom: 16 }}>
          <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
        </div>
      )}
      <h2 className="font-display" style={{
        fontSize: 'clamp(34px, 4vw, 52px)', fontWeight: 500, letterSpacing: '-0.025em',
        lineHeight: 1.1, margin: 0, color: 'var(--ink)',
      }}>{title}</h2>
      {sub && (
        <p style={{
          fontSize: 17, color: 'var(--ink-2)', lineHeight: 1.55,
          margin: '18px auto 0', maxWidth: 600,
        }}>{sub}</p>
      )}
    </div>
  )
}
