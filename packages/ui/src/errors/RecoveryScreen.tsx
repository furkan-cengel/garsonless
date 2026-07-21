'use client'

import type { CSSProperties } from 'react'

type RecoveryScreenProps = {
  kind: 'error' | 'not-found'
  title: string
  description: string
  code: string
  homeHref: string
  homeLabel: string
  retryLabel?: string
  onRetry?: () => void
  dark?: boolean
}

function WarningMark({ kind }: { kind: RecoveryScreenProps['kind'] }) {
  if (kind === 'not-found') {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="24" cy="24" r="18" />
        <path d="m29 18-4 11-11 4 4-11 11-4Z" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 6 43 40H5L24 6Z" />
      <path d="M24 18v10" />
      <path d="M24 35h.01" />
    </svg>
  )
}

/** A dependency-free recovery view for Next error and not-found boundaries. */
export function RecoveryScreen({
  kind,
  title,
  description,
  code,
  homeHref,
  homeLabel,
  retryLabel = 'Tekrar dene',
  onRetry,
  dark = false,
}: RecoveryScreenProps) {
  const palette = dark
    ? { page: '#151617', card: '#202224', text: '#f6f7f8', muted: '#b5bac0', line: '#373a3e', accent: '#5dd39e', tint: 'rgba(93, 211, 158, .14)' }
    : { page: '#f8f9f8', card: '#ffffff', text: '#1c1d20', muted: '#6e737b', line: '#e4e7e5', accent: '#147a4d', tint: '#e6f4ec' }

  const styles: Record<string, CSSProperties> = {
    page: { minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '24px', background: palette.page, color: palette.text, fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif" },
    card: { width: 'min(100%, 510px)', padding: '32px', borderRadius: '24px', background: palette.card, border: `1px solid ${palette.line}`, boxShadow: dark ? '0 18px 48px rgba(0,0,0,.24)' : '0 18px 48px rgba(23,34,27,.10)' },
    icon: { width: 52, height: 52, display: 'grid', placeItems: 'center', borderRadius: '16px', background: palette.tint, color: palette.accent, marginBottom: '22px' },
    title: { margin: 0, fontSize: 'clamp(24px, 4vw, 32px)', letterSpacing: '-.045em', lineHeight: 1.12 },
    description: { margin: '12px 0 0', maxWidth: 440, color: palette.muted, fontSize: '16px', lineHeight: 1.55 },
    code: { display: 'inline-flex', marginTop: '22px', padding: '6px 10px', borderRadius: '999px', background: dark ? '#2b2e31' : '#f2f4f3', color: palette.muted, fontSize: '12px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
    actions: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '28px' },
    primary: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 16px', borderRadius: 12, border: 0, background: palette.text, color: palette.card, textDecoration: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 700 },
    secondary: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 16px', borderRadius: 12, border: `1px solid ${palette.line}`, background: 'transparent', color: palette.text, textDecoration: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 700 },
  }

  return (
    <main style={styles.page}>
      <section aria-labelledby="recovery-title" style={styles.card}>
        <div style={styles.icon}><WarningMark kind={kind} /></div>
        <h1 id="recovery-title" style={styles.title}>{title}</h1>
        <p style={styles.description}>{description}</p>
        <span style={styles.code}>Hata kodu: {code}</span>
        <div style={styles.actions}>
          {onRetry ? <button type="button" onClick={onRetry} style={styles.primary}>{retryLabel}</button> : null}
          <a href={homeHref} style={styles.secondary}>{homeLabel}</a>
        </div>
      </section>
    </main>
  )
}
