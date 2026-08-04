'use client'

import type { CSSProperties } from 'react'
import { normalizeProgress } from './spinner-model'

const spinnerTokens = {
  action: 'var(--action, var(--p-cta, currentColor))',
  actionSoft: 'var(--surface-inset, var(--p-accent-soft, #ececef))',
  text: 'var(--text, var(--p-text, currentColor))',
  muted: 'var(--text-3, var(--p-text-2, currentColor))',
  surface: 'var(--surface-2, var(--p-card, #fafafa))',
  border: 'var(--border, var(--p-border, #e7e7ea))',
  positive: 'var(--positive, var(--p-accent, #137a4d))',
  warning: 'var(--warning, #a55a00)',
} as const

/* ── 1) HERO SPINNER — Coffee cup w/ rotating arc + steam + DotPulse ── */

interface HeroSpinnerProps {
  size?: number
  label?: string
}

export function HeroSpinner({ size = 96, label = 'Yükleniyor...' }: HeroSpinnerProps) {
  return (
    <div role="status" aria-live="polite" aria-label={label || 'Yükleniyor'} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      <div aria-hidden="true" style={{
        position: 'relative', width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Outer rotating arc */}
        <svg className="gl-spinner-arc" width={size} height={size} viewBox="0 0 100 100" style={{
          position: 'absolute', inset: 0,
        }}>
          <circle cx="50" cy="50" r="44" fill="none" stroke={spinnerTokens.actionSoft} strokeWidth="3" />
          <circle cx="50" cy="50" r="44" fill="none"
            stroke={spinnerTokens.action} strokeWidth="3" strokeLinecap="round"
            className="gl-spinner-dash" />
        </svg>

        {/* Steam — 3 wisps */}
        <div style={{
          position: 'absolute', left: '50%', top: '12%',
          transform: 'translateX(-50%)',
          display: 'flex', gap: 4,
        }}>
          {[0, 1, 2].map(i => (
            <span className="gl-spinner-steam" key={i} style={{
              width: 3, height: 3, borderRadius: 99,
              background: spinnerTokens.action,
              animationDelay: `${i * 0.4}s`,
              opacity: 0,
            }} />
          ))}
        </div>

        {/* Cup */}
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 40 40" style={{ position: 'relative', zIndex: 1 }}>
          <ellipse cx="20" cy="34" rx="14" ry="2" fill={spinnerTokens.warning} opacity={0.5} />
          <path d="M9 16h22v12a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4Z" fill={spinnerTokens.text} />
          <ellipse cx="20" cy="16" rx="11" ry="1.5" fill={spinnerTokens.action} />
          <ellipse cx="20" cy="16" rx="10" ry="1" fill={spinnerTokens.positive} opacity={0.9} />
          <path d="M31 20h2a3 3 0 0 1 0 6h-2" fill="none" stroke={spinnerTokens.text} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      {label && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 17, fontWeight: 500, letterSpacing: '-0.01em',
            color: spinnerTokens.text,
          }}>{label}</div>
          <DotPulse />
        </div>
      )}
    </div>
  )
}

export function DotPulse() {
  return (
    <div aria-hidden="true" style={{ display: 'inline-flex', gap: 5, marginTop: 8 }}>
      {[0, 1, 2].map(i => (
        <span className="gl-spinner-dot" key={i} style={{
          width: 5, height: 5, borderRadius: 99, background: spinnerTokens.muted,
          animationDelay: `${i * 0.16}s`,
        }} />
      ))}
    </div>
  )
}

/* ── 2) INLINE SPINNER — for buttons & small contexts ── */

interface InlineSpinnerProps {
  size?: number
  color?: string
}

export function InlineSpinner({ size = 16, color = 'currentColor' }: InlineSpinnerProps) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="2.5" opacity={0.2} />
      <circle className="gl-spinner-inline" cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="14 60" />
    </svg>
  )
}

interface LoadingStatusProps {
  label: string
  showLabel?: boolean
  size?: number
  color?: string
  className?: string
  style?: CSSProperties
}

export function LoadingStatus({ label, showLabel = true, size = 16, color = 'currentColor', className, style }: LoadingStatusProps) {
  return (
    <span className={`gl-loading-status${className ? ` ${className}` : ''}`} style={style} role="status" aria-live="polite" aria-atomic="true">
      <InlineSpinner size={size} color={color} />
      <span className={showLabel ? undefined : 'gl-visually-hidden'}>{label}</span>
    </span>
  )
}

/* ── 3) DOTS — three bouncing dots ── */

interface DotsSpinnerProps {
  color?: string
}

export function DotsSpinner({ color = spinnerTokens.text }: DotsSpinnerProps) {
  return (
    <div aria-hidden="true" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span className="gl-spinner-dot" key={i} style={{
          width: 8, height: 8, borderRadius: 99, background: color,
          animationDelay: `${i * 0.16}s`,
        }} />
      ))}
    </div>
  )
}

/* ── 4) BREW BAR — progress bar with gradient + shimmer ── */

interface BrewBarProps {
  progress: number
  label: string
}

export function BrewBar({ progress, label }: BrewBarProps) {
  const normalized = normalizeProgress(progress)
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={normalized} style={{ width: 280 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 11, color: spinnerTokens.muted, marginBottom: 8,
      }}>
        <span style={{ fontFamily: 'monospace', letterSpacing: '.05em' }}>DEMLENİYOR</span>
        <span style={{ fontFamily: 'monospace' }}>{normalized}%</span>
      </div>
      <div style={{
        height: 8, background: spinnerTokens.surface, borderRadius: 99,
        border: `1px solid ${spinnerTokens.border}`, overflow: 'hidden',
        position: 'relative',
      }}>
        <div className="gl-brew-fill" style={{
          height: '100%', width: `${normalized}%`,
          background: `linear-gradient(90deg, ${spinnerTokens.positive} 0%, ${spinnerTokens.action} 100%)`,
          borderRadius: 99,
          position: 'relative', overflow: 'hidden',
        }}>
          <div aria-hidden="true" className="gl-brew-shimmer" style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.35) 50%, transparent 100%)',
          }} />
        </div>
      </div>
    </div>
  )
}

/* ── 5) SKELETON CARD — content placeholder for product cards ── */

export function SkeletonCard() {
  const shimmerStyle = {
    background: `linear-gradient(90deg, ${spinnerTokens.surface} 0%, ${spinnerTokens.border} 50%, ${spinnerTokens.surface} 100%)`,
    backgroundSize: '200% 100%',
  } as const

  return (
    <div style={{
      width: '100%', boxSizing: 'border-box', padding: 12,
      background: 'var(--surface, var(--p-card, #fff))', borderRadius: 8,
      border: `1px solid ${spinnerTokens.border}`,
    }}>
      <div aria-hidden="true" className="gl-skeleton-shimmer" style={{ aspectRatio: '4/3', borderRadius: 8, marginBottom: 10, ...shimmerStyle }} />
      <div aria-hidden="true" className="gl-skeleton-shimmer" style={{ height: 12, borderRadius: 4, width: '70%', marginBottom: 6, ...shimmerStyle }} />
      <div aria-hidden="true" className="gl-skeleton-shimmer" style={{ height: 10, borderRadius: 4, width: '50%', ...shimmerStyle, animationDelay: '0.2s' }} />
    </div>
  )
}

/* ── 6) LOGOMARK SPINNER — 'g' lockup with rotating gradient ring ── */

interface LogomarkSpinnerProps {
  size?: number
}

export function LogomarkSpinner({ size = 64 }: LogomarkSpinnerProps) {
  return (
    <div aria-hidden="true" style={{ position: 'relative', width: size, height: size }}>
      <svg className="gl-spinner-slow" width={size} height={size} viewBox="0 0 64 64" style={{
        position: 'absolute', inset: 0,
      }}>
        <defs>
          <linearGradient id="gradRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={spinnerTokens.action} />
            <stop offset="50%" stopColor={spinnerTokens.positive} />
            <stop offset="100%" stopColor={spinnerTokens.warning} />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="28" fill="none" stroke="url(#gradRing)" strokeWidth="2.5"
          strokeLinecap="round" strokeDasharray="44 130" />
      </svg>
      <div style={{
        position: 'absolute', inset: '14%',
        background: spinnerTokens.text, color: spinnerTokens.warning,
        borderRadius: '24%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Fraunces, Georgia, serif', fontWeight: 600,
        fontSize: size * 0.5, lineHeight: 1,
      }}>g</div>
    </div>
  )
}

/* ── 7) BAR SPINNER — equalizer-style bars ── */

interface BarSpinnerProps {
  color?: string
}

export function BarSpinner({ color = spinnerTokens.text }: BarSpinnerProps) {
  return (
    <div aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 3, height: 22 }}>
      {[0.6, 1.0, 0.4, 0.8].map((_, i) => (
        <span className="gl-spinner-bar" key={i} style={{
          width: 4, height: '100%', background: color, borderRadius: 2,
          animationDelay: `${i * 0.12}s`,
          transformOrigin: 'bottom',
        }} />
      ))}
    </div>
  )
}
