import React from 'react'

import { makeReaders, customSectionShell, resolveSectionTarget } from '../lib/sectionHelpers'

export function HeroSection({
  sectionId,
  config,
  restaurantName,
  pageDescription,
  onOpenCart,
  forcedHref,
}: {
  sectionId: string
  config: Record<string, string>
  restaurantName: string
  pageDescription?: string | undefined
  onOpenCart?: (() => void) | undefined
  forcedHref?: string | undefined
}) {
  const { text, number, bool } = makeReaders(config)
  const optionalText = (key: string, fallback: string) => Object.prototype.hasOwnProperty.call(config, key)
    ? (config[key] ?? '').trim()
    : fallback
  const imageUrl = text('imageUrl', '')
  const imageMode = text('imageMode', 'background')
  const imageFit = text('imageFit', 'cover') === 'contain' ? 'contain' : 'cover'
  const imagePosition = resolveImagePosition(text('imagePosition', 'center'))
  const bgStart = text('bgStart', 'var(--p-accent)')
  const bgEnd = text('bgEnd', '#d97757')
  const textColor = text('textColor', sectionId === 'hero-banner' ? '#ffffff' : 'var(--p-text)')
  const overlay = number('overlay', imageUrl ? 25 : 0) / 100
  const align = text('align', 'left') as 'left' | 'center' | 'right'
  const target = resolveSectionTarget(config)
  const eyebrow = optionalText('eyebrow', sectionId === 'hero-banner' ? 'Gün özel' : 'Hoş geldiniz')
  const title = optionalText('title', restaurantName)
  const body = optionalText('body', pageDescription || 'Favorilerinizi keşfedin, siparişinizi masanızdan kolayca oluşturun.')
  const cta = optionalText('cta', 'Sipariş ver')
  const showEyebrow = bool('showEyebrow', true) && Boolean(eyebrow)
  const showTitle = bool('showTitle', true) && Boolean(title)
  const showBody = bool('showBody', true) && Boolean(body)
  const showCta = sectionId === 'hero-banner' && Boolean(cta) && (Boolean(forcedHref) || (target.kind !== 'none' && (target.kind !== 'cart' || Boolean(onOpenCart))))
  const sideImage = Boolean(imageUrl && imageMode === 'side')
  const heroBackground = imageUrl && imageMode === 'background'
    ? `linear-gradient(rgba(0,0,0,${overlay}), rgba(0,0,0,${overlay})), url("${imageUrl}") ${imagePosition}/${imageFit} no-repeat, linear-gradient(135deg, ${bgStart}, ${bgEnd})`
    : sectionId === 'hero-banner'
      ? `linear-gradient(135deg, ${bgStart}, ${bgEnd})`
      : 'linear-gradient(135deg, var(--p-accent-soft), rgba(255,255,255,.72))'
  return (
    <section data-component="custom-section" style={customSectionShell}>
      <div style={{
        minHeight: number('height', 168),
        borderRadius: text('radius', '') ? number('radius', 16) : 'calc(var(--p-radius) + 4px)',
        background: heroBackground,
        border: 'var(--p-border-w) solid var(--p-border)',
        padding: number('padding', 18),
        color: textColor,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: sideImage && align === 'right' ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: sideImage ? 16 : 0,
      }}>
        <div style={{
          minWidth: 0,
          width: sideImage ? '58%' : '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
          textAlign: align,
          position: 'relative',
          zIndex: 1,
        }}>
          {showEyebrow && <p style={{
            margin: '0 0 8px',
            color: sectionId === 'hero-banner' ? textColor : 'var(--p-accent)',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            opacity: 0.82,
          }}>
            {eyebrow}
          </p>}
          {showTitle && <h2 style={{
            margin: 0,
            color: textColor,
            fontFamily: 'var(--p-display)',
            fontSize: 'calc(var(--p-fs) + 10px)',
            lineHeight: 1.08,
          }}>
            {title}
          </h2>}
          {showBody && <p style={{
            margin: '10px 0 0',
            color: sectionId === 'hero-banner' ? textColor : 'var(--p-text-2)',
            fontSize: 'var(--p-fs)',
            lineHeight: 'calc(var(--p-lh) * 1em)',
            maxWidth: 280,
            opacity: 0.82,
          }}>
            {body}
          </p>}
          {showCta && !forcedHref && target.kind === 'cart' && (
            <button type="button" onClick={onOpenCart} style={ctaStyle(text('buttonBg', '#ffffff'), text('buttonText', 'var(--p-accent)'))}>
              {cta}
            </button>
          )}
          {showCta && !forcedHref && (target.kind === 'anchor' || target.kind === 'external') && (
            <a
              href={target.href}
              {...(target.kind === 'external' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              style={ctaStyle(text('buttonBg', '#ffffff'), text('buttonText', 'var(--p-accent)'))}
            >
              {cta}
            </a>
          )}
          {showCta && forcedHref && (
            <a href={forcedHref} style={ctaStyle(text('buttonBg', '#ffffff'), text('buttonText', 'var(--p-accent)'))}>{cta}</a>
          )}
        </div>
        {sideImage && (
          <img
            alt=""
            src={imageUrl}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            style={{
              flex: '0 0 38%',
              width: '38%',
              alignSelf: 'stretch',
              minHeight: 112,
              objectFit: imageFit,
              objectPosition: imagePosition,
              borderRadius: 18,
              opacity: 0.94,
            }}
          />
        )}
      </div>
    </section>
  )
}

function resolveImagePosition(value: string): 'center' | 'top' | 'bottom' | 'left' | 'right' {
  if (value === 'top' || value === 'bottom' || value === 'left' || value === 'right') return value
  return 'center'
}

function ctaStyle(background: string, color: string) {
  return {
    marginTop: 16,
    border: 'none',
    borderRadius: 999,
    background,
    color,
    padding: '9px 14px',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.2,
    textDecoration: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const
}
