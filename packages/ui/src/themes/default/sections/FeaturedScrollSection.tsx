'use client'

import React, { useRef, useState } from 'react'
import type { CSSProperties, UIEvent } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { AppIcons } from '../../../icons'
import { formatTRY } from '../../../menu/formatCurrency'
import type { MenuItem } from '../../../menu/types'
import { ProductAllergenSummary } from '../../../menu/FoodInfoBadges'
import { customSectionShell, makeReaders, resolveSectionTarget } from '../lib/sectionHelpers'
import { resolveFeaturedScrollItems } from './featuredScrollModel'

type FeaturedTheme = Pick<GarsonlessTheme, 'cardCtaStyle' | 'cardCtaIcon' | 'cta' | 'ctaTextColor'>

const BUTTON_SIZE = { small: 30, medium: 34, large: 40 } as const

export function FeaturedScrollSection({
  config,
  items = [],
  onQuickAdd,
  theme,
}: {
  config: Record<string, string>
  items?: MenuItem[]
  onQuickAdd?: (item: MenuItem, originalPrice?: number) => void
  theme?: FeaturedTheme
}) {
  const { text, number, bool } = makeReaders(config)
  const selectedItems = resolveFeaturedScrollItems(config, items)
  const railRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const showTitle = bool('showTitle', true)
  const showSubtitle = bool('showSubtitle', true)
  const showDescription = bool('showProductDescription', true)
  const showImages = bool('showImages', true)
  const showBadge = bool('showBadge', true)
  const showDots = bool('showDots', true)
  const showViewAll = bool('showViewAll', false)
  const salesSource = selectedItems.find((item) => item.featuredSalesSource)?.featuredSalesSource
  const defaultSubtitle = salesSource === 'previous-day'
    ? 'Dünün en çok tercih edilenleri'
    : salesSource === 'today'
      ? 'Bugün en çok tercih edilenler'
      : 'Öne çıkan ürünler'
  const configuredSubtitle = text('subtitle', '').trim()
  const subtitle = !configuredSubtitle || configuredSubtitle === 'Bugün en çok tercih edilenler'
    ? defaultSubtitle
    : configuredSubtitle
  const target = resolveSectionTarget(config)
  const cardWidth = number('cardWidth', 172)
  const imageHeight = number('imageHeight', 116)
  const cardRadius = number('cardRadius', 16)
  const cardGap = number('cardGap', 12)
  const sectionTop = number('sectionTop', 20)
  const sectionBottom = number('sectionBottom', 22)
  const imageFit = text('imageFit', 'cover') === 'contain' ? 'contain' : 'cover'
  const imagePosition = text('imagePosition', 'center')
  const sectionBg = text('sectionBgColor', 'transparent')
  const titleColor = text('titleColor', 'var(--p-text)')
  const subtitleColor = text('subtitleColor', 'var(--p-muted)')
  const cardBg = text('cardBgColor', 'var(--p-card)')
  const cardBorder = text('cardBorderColor', 'var(--p-border)')
  const cardText = text('cardTextColor', 'var(--p-text)')
  const cardMuted = text('cardMutedColor', 'var(--p-muted)')
  const imageBg = text('imageBgColor', 'var(--p-soft)')
  const badgeBg = text('badgeBgColor', 'color-mix(in srgb, var(--p-text) 76%, transparent)')
  const badgeText = text('badgeTextColor', '#ffffff')
  const ctaMode = text('ctaMode', 'inherit') === 'custom' ? 'custom' : 'inherit'
  const buttonStyle = ctaMode === 'inherit' ? (theme?.cardCtaStyle ?? 'icon') : text('buttonStyle', 'icon')
  const buttonIcon = ctaMode === 'inherit' ? (theme?.cardCtaIcon ?? 'plus') : text('buttonIcon', 'plus')
  const buttonSizeName = text('buttonSize', 'medium') as keyof typeof BUTTON_SIZE
  const buttonSize = BUTTON_SIZE[buttonSizeName] ?? BUTTON_SIZE.medium
  const buttonBackground = ctaMode === 'inherit' ? 'var(--p-cta)' : text('buttonBgColor', 'var(--p-cta)')
  const buttonColor = ctaMode === 'inherit' ? 'var(--p-cta-text)' : text('buttonTextColor', 'var(--p-cta-text)')

  if (selectedItems.length === 0 && onQuickAdd) return null

  const updateActiveIndex = (event: UIEvent<HTMLDivElement>) => {
    const index = Math.round(event.currentTarget.scrollLeft / Math.max(1, cardWidth + cardGap))
    setActiveIndex(Math.min(Math.max(index, 0), Math.max(0, selectedItems.length - 1)))
  }

  const moveTo = (index: number) => {
    railRef.current?.scrollTo({ left: index * (cardWidth + cardGap), behavior: 'smooth' })
    setActiveIndex(index)
  }

  const viewAllProps = target.kind === 'external'
    ? { href: target.href, target: '_blank', rel: 'noreferrer' }
    : target.kind === 'anchor'
      ? { href: target.href }
      : null

  return (
    <section
      data-component="custom-section"
      data-section-kind="featured-scroll"
      data-featured-source={salesSource ?? 'catalog'}
      aria-label={text('title', 'Öne Çıkanlar')}
      style={{ ...customSectionShell, paddingLeft: 0, paddingRight: 0 }}
    >
      <style>{`
        .garsonless-featured-card {
          transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
        }
        .garsonless-featured-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--p-shadow);
          border-color: color-mix(in srgb, var(--featured-accent) 30%, var(--featured-border)) !important;
        }
        .garsonless-featured-add {
          transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease;
        }
        .garsonless-featured-add:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.05); }
        .garsonless-featured-add:not(:disabled):active { transform: scale(.94); }
        .garsonless-featured-add:focus-visible,
        .garsonless-featured-dot:focus-visible,
        .garsonless-featured-all:focus-visible { outline: 2px solid var(--featured-accent); outline-offset: 3px; }
        .garsonless-featured-rail { scrollbar-width: none; }
        .garsonless-featured-rail::-webkit-scrollbar { display: none; }
        @media (prefers-reduced-motion: reduce) {
          .garsonless-featured-card, .garsonless-featured-add { transition: none !important; }
          .garsonless-featured-card:hover, .garsonless-featured-add:not(:disabled):hover { transform: none; }
        }
      `}</style>
      <div style={{
        '--featured-accent': buttonBackground,
        '--featured-border': cardBorder,
        background: sectionBg,
        paddingTop: sectionTop,
        paddingBottom: sectionBottom,
        overflow: 'hidden',
      } as CSSProperties}>
        {(showTitle || showSubtitle || (showViewAll && viewAllProps)) && (
          <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, padding: '0 var(--p-pad) 13px' }}>
            <div style={{ minWidth: 0 }}>
              {showTitle && <h2 style={{ margin: 0, color: titleColor, fontFamily: 'var(--p-display)', fontSize: 21, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.1 }}>{text('title', 'Öne Çıkanlar')}</h2>}
              {showSubtitle && <p style={{ margin: '5px 0 0', color: subtitleColor, fontSize: 12.5, lineHeight: 1.35 }}>{subtitle}</p>}
            </div>
            {showViewAll && viewAllProps && (
              <a className="garsonless-featured-all" {...viewAllProps} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--p-accent)', fontSize: 12.5, fontWeight: 800, textDecoration: 'none' }}>
                {text('viewAllText', 'Tümü')} <AppIcons.arrow size={13} aria-hidden="true" />
              </a>
            )}
          </header>
        )}

        {selectedItems.length > 0 ? (
          <div
            ref={railRef}
            className="garsonless-featured-rail"
            onScroll={updateActiveIndex}
            style={{ display: 'flex', gap: cardGap, overflowX: 'auto', padding: '2px var(--p-pad) 14px', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
          >
            {selectedItems.map((item) => (
              <article key={item.id} className="garsonless-featured-card" data-featured-item={item.id} data-featured-sales-quantity={item.featuredSalesQuantity} style={{ flex: `0 0 ${cardWidth}px`, scrollSnapAlign: 'start', background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: cardRadius, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0, boxShadow: '0 1px 4px color-mix(in srgb, var(--p-text) 7%, transparent)' }}>
                {showImages && (
                  <div style={{ position: 'relative', height: imageHeight, flexShrink: 0, background: imageBg, overflow: 'hidden' }}>
                    {item.images[0] ? <img src={item.images[0]} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: imageFit, objectPosition: imagePosition, display: 'block' }} /> : <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: cardMuted }}><AppIcons.image size={24} aria-hidden="true" /></span>}
                    {showBadge && <span style={{ position: 'absolute', top: 8, left: 8, zIndex: 1, maxWidth: 'calc(100% - 16px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '4px 9px', borderRadius: 999, background: badgeBg, color: badgeText, fontSize: 10, fontWeight: 800, letterSpacing: '.02em', backdropFilter: 'blur(3px)' }}>{text('badgeText', 'Öne çıkan')}</span>}
                  </div>
                )}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, padding: '11px 12px 12px' }}>
                  <h3 style={{ margin: 0, color: cardText, fontSize: 14, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-.01em' }}>{item.name}</h3>
                  {showDescription && <p style={{ margin: 0, minHeight: 31, color: cardMuted, fontSize: 11.5, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description || 'Detayları görmek için ürünü inceleyin.'}</p>}
                  <ProductAllergenSummary item={item} />
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 4 }}>
                    <span style={{ color: cardText, fontSize: 15, fontWeight: 850, letterSpacing: '-.01em' }}>{formatTRY(item.price)}</span>
                    <button type="button" className="garsonless-featured-add" data-cta-source={ctaMode} data-cta-icon={buttonIcon} disabled={!onQuickAdd} aria-label={`${item.name} sepete ekle`} onClick={() => onQuickAdd?.(item)} style={{ minWidth: buttonStyle === 'icon' ? buttonSize : Math.max(64, buttonSize * 1.8), height: buttonSize, padding: buttonStyle === 'icon' ? 0 : '0 12px', border: 0, borderRadius: buttonStyle === 'full' ? 10 : 999, background: buttonBackground, color: buttonColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'var(--p-body)', fontSize: 11.5, fontWeight: 800, cursor: onQuickAdd ? 'pointer' : 'default', opacity: onQuickAdd ? 1 : .62, flexShrink: 0 }}>
                      <FeaturedCtaIcon kind={buttonIcon} size={Math.max(15, Math.round(buttonSize * .45))} />
                      {buttonStyle !== 'icon' && <span>{text('ctaText', 'Ekle')}</span>}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div data-featured-empty style={{ margin: '0 var(--p-pad)', padding: 18, border: '1px dashed var(--p-border)', borderRadius: cardRadius, color: cardMuted, textAlign: 'center', fontSize: 12 }}>Öne çıkanlar için yayınlanan ürünlerden seçim yapın.</div>
        )}

        {showDots && selectedItems.length > 1 && (
          <div role="group" aria-label="Öne çıkan ürün sayfaları" style={{ display: 'flex', justifyContent: 'center', gap: 5, paddingTop: 2 }}>
            {selectedItems.map((item, index) => <button key={item.id} type="button" className="garsonless-featured-dot" aria-label={`${index + 1}. ürüne git`} aria-current={activeIndex === index ? 'true' : undefined} onClick={() => moveTo(index)} style={{ width: activeIndex === index ? 16 : 5, height: 5, padding: 0, border: 0, borderRadius: 999, background: activeIndex === index ? buttonBackground : cardBorder, cursor: 'pointer', transition: 'width 180ms ease, background 180ms ease' }} />)}
          </div>
        )}
      </div>
    </section>
  )
}

function FeaturedCtaIcon({ kind, size }: { kind: string; size: number }) {
  if (kind === 'cart') return <AppIcons.cart size={size} aria-hidden="true" />
  if (kind === 'bag') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
  return <AppIcons.plus size={size} aria-hidden="true" />
}
