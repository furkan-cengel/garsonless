'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import {
  resolveSectionCampaignTiming,
  resolveSectionPromotionPrice,
} from '@garsonless/domain/menu'
import { AppIcons } from '../../../icons'
import { formatTRY } from '../../../menu/formatCurrency'
import type { MenuItem, SectionPromotionContext } from '../../../menu/types'
import { ProductAllergenSummary } from '../../../menu/FoodInfoBadges'
import { customSectionShell, makeReaders } from '../lib/sectionHelpers'

type DailySpecialTheme = Pick<GarsonlessTheme, 'cardCtaStyle' | 'cardCtaIcon' | 'cta' | 'ctaTextColor'>

const BUTTON_SIZE = { small: 34, medium: 40, large: 46 } as const

export function DailySpecialBlock({
  sectionInstanceId,
  config,
  items = [],
  onQuickAdd,
  theme,
  actionMode = 'order',
}: {
  sectionInstanceId: string
  config: Record<string, string>
  items?: MenuItem[]
  onQuickAdd?: (item: MenuItem, originalPrice?: number, promotion?: SectionPromotionContext) => void
  theme?: DailySpecialTheme
  actionMode?: 'order' | 'discover'
}) {
  const { text, number, bool } = makeReaders(config)
  const productId = config.productId?.trim() ?? ''
  const item = items.find((candidate) => candidate.id === productId && candidate.is_available)
  const discountMode = text('discountMode', 'none')
  const hasPromotion = discountMode !== 'none'
  const pricing = item && hasPromotion
    ? resolveSectionPromotionPrice({
        catalogPrice: item.price,
        mode: discountMode,
        percentage: config.discountPercent ?? '20',
        ...(config.campaignPrice !== undefined ? { fixedPrice: config.campaignPrice } : {}),
      })
    : null
  const timing = resolveSectionCampaignTiming({
    enabled: config.countdownEnabled,
    endsAt: config.campaignEndsAt,
  })

  if (timing.enabled && timing.valid && !timing.active) return null

  const layout = text('layout', 'split') === 'stack' ? 'stack' : 'split'
  const showImage = bool('showImage', true)
  const imageFit = text('imageFit', 'cover') === 'contain' ? 'contain' : 'cover'
  const imagePosition = text('imagePosition', 'center')
  const surface = text('bgColor', '#fdf6ec')
  const contentSurface = text('cardColor', '#ffffff')
  const textColor = text('textColor', '#1c2618')
  const mutedColor = text('mutedColor', textColor)
  const accent = text('accentColor', '#a13b7a')
  const radius = number('radius', 20)
  const cardRadius = number('cardRadius', 16)
  const padding = number('padding', 16)
  const imageSize = Math.min(180, Math.max(76, number('imageSize', layout === 'stack' ? 150 : 122)))
  const ctaMode = text('ctaMode', 'inherit') === 'custom' ? 'custom' : 'inherit'
  const buttonStyle = actionMode === 'discover' ? 'pill' : ctaMode === 'inherit' ? (theme?.cardCtaStyle ?? 'pill') : text('buttonStyle', 'pill')
  const buttonIcon = actionMode === 'discover' ? 'arrow' : ctaMode === 'inherit' ? (theme?.cardCtaIcon ?? 'plus') : text('buttonIcon', 'plus')
  const buttonSizeName = text('buttonSize', 'medium') as keyof typeof BUTTON_SIZE
  const buttonSize = BUTTON_SIZE[buttonSizeName] ?? BUTTON_SIZE.medium
  const buttonBackground = ctaMode === 'inherit' ? 'var(--p-cta)' : text('buttonBgColor', accent)
  const buttonColor = ctaMode === 'inherit' ? 'var(--p-cta-text)' : text('buttonTextColor', '#ffffff')
  const title = config.title?.trim() || item?.name || 'Günün özeli'
  const body = config.body?.trim() || item?.description || 'Bugün mutfağın öne çıkan lezzeti.'
  const policyCombines = text('discountPolicy', 'combine-loyalty') !== 'promotion-only'
  const priceReady = !hasPromotion || Boolean(pricing)
  const isReady = Boolean(item && priceReady && timing.active)

  const addToCart = () => {
    if (!item || !priceReady || !timing.active || !onQuickAdd) return
    if (!pricing) {
      onQuickAdd(item)
      return
    }
    onQuickAdd(
      { ...item, price: pricing.price },
      item.price,
      { sectionInstanceId, kind: 'daily-special' },
    )
  }

  return (
    <section
      id={`custom-section-${sectionInstanceId}`}
      data-component="custom-section"
      data-section-kind="daily-special"
      data-promotion-state={isReady ? 'ready' : 'configuration-required'}
      style={customSectionShell}
    >
      <style>{`
        .garsonless-daily-special {
          container-type: inline-size;
          transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
        }
        .garsonless-daily-special:hover { transform: translateY(-2px); box-shadow: var(--p-shadow); }
        .garsonless-daily-layout {
          display: grid;
          grid-template-columns: var(--daily-grid-columns);
          gap: var(--daily-grid-gap);
        }
        .garsonless-daily-media {
          align-self: start;
          width: 100%;
          height: var(--daily-image-size);
          min-height: 0;
          overflow: hidden;
        }
        .garsonless-daily-layout[data-layout="split"] .garsonless-daily-media {
          aspect-ratio: 1 / 1;
        }
        @container (max-width: 330px) {
          .garsonless-daily-layout[data-layout="split"] {
            --daily-grid-columns: minmax(0, 1fr) !important;
            --daily-grid-gap: 12px !important;
          }
          .garsonless-daily-layout[data-layout="split"] .garsonless-daily-media {
            aspect-ratio: 16 / 9;
            height: auto;
            max-height: 156px;
          }
        }
        .garsonless-daily-add { transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease; }
        .garsonless-daily-add:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.05); box-shadow: 0 8px 18px -12px var(--daily-accent); }
        .garsonless-daily-add:not(:disabled):active { transform: scale(.97); }
        .garsonless-daily-add:focus-visible { outline: 2px solid var(--daily-accent); outline-offset: 3px; }
        .garsonless-daily-timer { contain: layout paint; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 1; }
        @media (prefers-reduced-motion: reduce) {
          .garsonless-daily-special, .garsonless-daily-add { transition: none !important; }
          .garsonless-daily-special:hover, .garsonless-daily-add:not(:disabled):hover { transform: none; }
        }
      `}</style>
      <div
        className="garsonless-daily-special garsonless-daily-layout"
        data-layout={layout}
        style={{
          '--daily-accent': accent,
          '--daily-grid-columns': layout === 'split' && showImage ? `${imageSize}px minmax(0, 1fr)` : 'minmax(0, 1fr)',
          '--daily-grid-gap': `${layout === 'split' ? 15 : 12}px`,
          '--daily-image-size': `${imageSize}px`,
          padding,
          borderRadius: radius,
          border: `1px solid color-mix(in srgb, ${accent} 22%, transparent)`,
          background: surface,
          color: textColor,
          overflow: 'hidden',
          boxShadow: '0 2px 10px color-mix(in srgb, var(--p-text) 6%, transparent)',
        } as CSSProperties}
      >
        {showImage && (
          <div
            className="garsonless-daily-media"
            data-daily-media="true"
            style={{
              borderRadius: Math.min(cardRadius, 14),
              background: `color-mix(in srgb, ${accent} 9%, ${contentSurface})`,
            }}
          >
            {item?.images[0] ? (
              <img
                src={item.images[0]}
                alt=""
                loading="lazy"
                decoding="async"
                style={{ width: '100%', height: '100%', objectFit: imageFit, objectPosition: imagePosition, display: 'block' }}
              />
            ) : (
              <div aria-hidden style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: accent, opacity: .6 }}>
                <AppIcons.image size={26} />
              </div>
            )}
          </div>
        )}

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7 }}>
            <span style={{ color: accent, fontSize: 9.5, fontWeight: 900, letterSpacing: '.14em', textTransform: 'uppercase' }}>
              {config.eyebrow?.trim() || 'GÜNÜN ÖZELİ'}
            </span>
            {pricing && (
              <span style={{ padding: '2px 6px', borderRadius: 999, background: `color-mix(in srgb, ${accent} 10%, ${contentSurface})`, color: accent, fontSize: 9, fontWeight: 850, lineHeight: 1.35 }}>
                %{pricing.percentage} avantaj
              </span>
            )}
          </div>
          <h2 style={{ margin: '5px 0 0', fontFamily: 'var(--p-display)', fontSize: 23, lineHeight: 1.08, letterSpacing: '-.02em', color: textColor }}>
            {title}
          </h2>
          {body && (
            <p style={{ margin: '7px 0 0', color: mutedColor, opacity: .72, fontSize: 12, lineHeight: 1.42, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {body}
            </p>
          )}
          {item && <ProductAllergenSummary item={item} style={{marginTop:8}} />}
          {config.chefNote?.trim() && (
            <p style={{ margin: '8px 0 0', paddingLeft: 9, borderLeft: `2px solid ${accent}`, color: mutedColor, opacity: .76, fontFamily: 'var(--p-display)', fontSize: 11, fontStyle: 'italic', lineHeight: 1.4 }}>
              {config.chefNote.trim()}
            </p>
          )}

          {timing.enabled && timing.valid && timing.endsAtMs !== null && (
            <DailyCountdown
              endsAtMs={timing.endsAtMs}
              label={config.countdownLabel?.trim() || 'Bugün sona eriyor'}
              background={text('timerBgColor', contentSurface)}
              color={text('timerTextColor', accent)}
            />
          )}

          {item && priceReady && timing.active ? (
            <div style={{ marginTop: 12, padding: '10px 11px', borderRadius: cardRadius, background: contentSurface, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 7 }}>
                  <strong style={{ color: textColor, fontSize: 17, lineHeight: 1 }}>
                    {formatTRY(pricing?.price ?? item.price)}
                  </strong>
                  {pricing && <del style={{ color: mutedColor, opacity: .55, fontSize: 12, fontWeight: 700 }}>{formatTRY(item.price)}</del>}
                </div>
                {pricing && <span style={{ display: 'block', marginTop: 4, color: accent, fontSize: 10.5, fontWeight: 800 }}>{formatTRY(pricing.savings)} kazanç</span>}
              </div>
              <button
                type="button"
                className="garsonless-daily-add"
                data-cta-source={ctaMode}
                data-cta-icon={buttonIcon}
                disabled={!onQuickAdd}
                aria-label={`${item.name} ürününü ${actionMode === 'discover' ? 'incele' : `${pricing ? 'günün özeli fiyatıyla ' : ''}sepete ekle`}`}
                onClick={addToCart}
                style={{
                  minWidth: buttonStyle === 'icon' ? buttonSize : Math.max(74, buttonSize * 1.9),
                  height: buttonSize,
                  padding: buttonStyle === 'icon' ? 0 : '0 13px',
                  border: 0,
                  borderRadius: buttonStyle === 'full' ? 10 : 999,
                  background: buttonBackground,
                  color: buttonColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontFamily: 'var(--p-body)',
                  fontSize: 11.5,
                  fontWeight: 850,
                  cursor: onQuickAdd ? 'pointer' : 'default',
                  flexShrink: 0,
                }}
              >
                <DailyCtaIcon kind={buttonIcon} size={Math.max(15, Math.round(buttonSize * .43))} />
                {buttonStyle !== 'icon' && <span>{actionMode === 'discover' ? 'İncele' : config.cta?.trim() || 'Sepete ekle'}</span>}
              </button>
            </div>
          ) : (
            <div role="status" style={{ marginTop: 12, padding: '11px 12px', borderRadius: cardRadius, border: `1px dashed color-mix(in srgb, ${accent} 38%, transparent)`, background: contentSurface, color: mutedColor, fontSize: 11.5, lineHeight: 1.4 }}>
              {!item
                ? 'Günün özeli için satışta olan bir ürün seçin.'
                : timing.enabled && !timing.valid
                  ? 'Süreli yayın için geçerli bir bitiş tarihi ve saati seçin.'
                  : 'Kampanya fiyatı ürünün normal fiyatından düşük olmalı.'}
            </div>
          )}

          {pricing && isReady && (
            <p style={{ margin: '8px 2px 0', color: mutedColor, opacity: .58, fontSize: 9.5, lineHeight: 1.35 }}>
              {policyCombines ? 'Üyelik avantajlarıyla birlikte kullanılabilir.' : 'Bu özel fiyat diğer üyelik indirimleriyle birleşmez.'}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function DailyCountdown({ endsAtMs, label, background, color }: { endsAtMs: number; label: string; background: string; color: string }) {
  const timerRef = useRef<HTMLDivElement>(null)
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, endsAtMs - Date.now()))

  useEffect(() => {
    let interval: number | undefined
    const update = () => {
      const next = Math.max(0, endsAtMs - Date.now())
      setRemainingMs(next)
      if (next === 0) {
        const section = timerRef.current?.closest<HTMLElement>('section[data-section-kind="daily-special"]')
        if (section) section.hidden = true
        if (interval !== undefined) window.clearInterval(interval)
      }
    }
    update()
    if (endsAtMs > Date.now()) interval = window.setInterval(update, 1000)
    return () => { if (interval !== undefined) window.clearInterval(interval) }
  }, [endsAtMs])

  return (
    <div ref={timerRef} role="timer" aria-live="off" className="garsonless-daily-timer" style={{ marginTop: 10, minHeight: 52, padding: '8px 10px', borderRadius: 12, background, color, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 10, fontSize: 10.5, fontWeight: 750 }}>
      <span style={{ minWidth: 0, opacity: .76, lineHeight: 1.4 }}>{label}</span>
      <strong style={{ width: '14ch', whiteSpace: 'nowrap', textAlign: 'right', fontSize: 12, lineHeight: 1, letterSpacing: '.04em' }}>
        {formatCountdown(remainingMs)}
      </strong>
    </div>
  )
}

function formatCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000))
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const clock = [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
  return days > 0 ? `${days} gün · ${clock}` : clock
}

function DailyCtaIcon({ kind, size }: { kind: string; size: number }) {
  if (kind === 'arrow') return <AppIcons.arrow size={size} aria-hidden="true" />
  if (kind === 'cart') return <AppIcons.cart size={size} aria-hidden="true" />
  if (kind === 'bag') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
  return <AppIcons.plus size={size} aria-hidden="true" />
}
