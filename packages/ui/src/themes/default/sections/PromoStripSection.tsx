import React from 'react'

import { makeReaders } from '../lib/sectionHelpers'

const PROMO_STRIP_CSS = `
  @keyframes garsonless-promo-marquee {
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(-50%, 0, 0); }
  }
  @keyframes garsonless-promo-fade {
    0%, 100% { opacity: .72; }
    50% { opacity: 1; }
  }
  .garsonless-promo-surface.is-actionable:hover { filter: brightness(1.06); }
  .garsonless-promo-surface.is-actionable:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--p-cta) 44%, transparent);
    outline-offset: 2px;
  }
  .garsonless-promo-surface.is-pausable:hover .garsonless-promo-track,
  .garsonless-promo-surface.is-pausable:focus-visible .garsonless-promo-track {
    animation-play-state: paused !important;
  }
  @media (prefers-reduced-motion: reduce) {
    .garsonless-promo-track {
      animation: none !important;
      transform: none !important;
    }
    .garsonless-promo-sequence[aria-hidden="true"] { display: none !important; }
  }
`

export function PromoStripSection({ config, forcedHref }: { config: Record<string, string>; forcedHref?: string }) {
  const { text, number, bool } = makeReaders(config)
  const optionalText = (key: string, fallback: string) => Object.prototype.hasOwnProperty.call(config, key)
    ? (config[key] ?? '').trim()
    : fallback
  const title = optionalText('title', 'İLK SİPARİŞE %20 İNDİRİM')
  const message = bool('showTitle', true) ? title : ''
  if (!message) return null

  const animation = resolveAnimation(text('animation', 'marquee'))
  const direction = text('direction', 'right')
  const duration = clamp(number('speed', 18), 6, 40)
  const height = clamp(number('height', 40), 32, 64)
  const actionable = Boolean(forcedHref)
  const pausable = animation === 'marquee' && bool('pauseOnHover', true)
  const surfaceStyle: React.CSSProperties = {
    minHeight: height,
    background: text('bgColor', 'var(--p-text)'),
    color: text('textColor', 'var(--p-card)'),
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    fontSize: 12,
    fontWeight: 850,
    letterSpacing: '0.04em',
    lineHeight: 1.25,
    textDecoration: 'none',
    transition: 'filter 150ms ease',
    cursor: actionable ? 'pointer' : 'default',
  }
  const className = [
    'garsonless-promo-surface',
    actionable ? 'is-actionable' : '',
    pausable ? 'is-pausable' : '',
  ].filter(Boolean).join(' ')
  const content = (
    <PromoStripContent
      animation={animation}
      direction={direction}
      duration={duration}
      message={message}
      accentColor={text('accentColor', 'var(--p-cta)')}
    />
  )

  return (
    <section data-component="custom-section" aria-label="Promosyon duyurusu" style={{ padding: '14px 0 2px' }}>
      <style>{PROMO_STRIP_CSS}</style>
      {forcedHref ? (
        <a className={className} href={forcedHref} aria-label={message} style={surfaceStyle}>{content}</a>
      ) : (
        <div className={className} aria-label={message} style={surfaceStyle}>
          {content}
        </div>
      )}
    </section>
  )
}

function PromoStripContent({
  animation,
  direction,
  duration,
  message,
  accentColor,
}: {
  animation: 'marquee' | 'static' | 'fade'
  direction: string
  duration: number
  message: string
  accentColor: string
}) {
  if (animation !== 'marquee') {
    return (
      <span
        className="garsonless-promo-track"
        aria-hidden
        style={{
          display: 'block',
          width: '100%',
          minWidth: 0,
          overflow: 'hidden',
          padding: '0 16px',
          textAlign: 'center',
          textOverflow: 'ellipsis',
          animation: animation === 'fade' ? `garsonless-promo-fade ${duration}s ease-in-out infinite` : undefined,
        }}
      >
        <PromoMessage message={message} accentColor={accentColor} />
      </span>
    )
  }

  return (
    <span
      className="garsonless-promo-track"
      aria-hidden
      data-direction={direction === 'left' ? 'right' : 'left'}
      style={{
        display: 'flex',
        width: 'max-content',
        willChange: 'transform',
        animation: `garsonless-promo-marquee ${duration}s linear infinite`,
        animationDirection: direction === 'left' ? 'reverse' : 'normal',
      }}
    >
      <PromoSequence message={message} accentColor={accentColor} />
      <PromoSequence message={message} accentColor={accentColor} duplicate />
    </span>
  )
}

function PromoSequence({ message, accentColor, duplicate = false }: {
  message: string
  accentColor: string
  duplicate?: boolean
}) {
  return (
    <span
      className="garsonless-promo-sequence"
      aria-hidden={duplicate ? 'true' : undefined}
      style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, gap: 28, paddingRight: 28 }}
    >
      {[0, 1].map((item) => (
        <PromoMessage key={item} message={message} accentColor={accentColor} />
      ))}
    </span>
  )
}

function PromoMessage({ message, accentColor }: {
  message: string
  accentColor: string
}) {
  return (
    <span className="garsonless-promo-item" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: accentColor }}>{message}</span>
    </span>
  )
}

function resolveAnimation(value: string): 'marquee' | 'static' | 'fade' {
  if (value === 'static' || value === 'fade') return value
  return 'marquee'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
