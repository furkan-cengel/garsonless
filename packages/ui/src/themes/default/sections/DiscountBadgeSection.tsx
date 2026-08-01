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

type DiscountBadgeTheme = Pick<GarsonlessTheme, 'cardCtaStyle' | 'cardCtaIcon' | 'cta' | 'ctaTextColor'>

const BUTTON_SIZE = { small: 34, medium: 40, large: 46 } as const

export function DiscountBadgeSection({
  sectionInstanceId,
  config,
  items = [],
  onQuickAdd,
  theme,
}: {
  sectionInstanceId: string
  config: Record<string, string>
  items?: MenuItem[]
  onQuickAdd?: (item: MenuItem, originalPrice?: number, promotion?: SectionPromotionContext) => void
  theme?: DiscountBadgeTheme
}) {
  const { text, number, bool } = makeReaders(config)
  const configuredProductId = config.productId?.trim() ?? ''
  const item = items.find((candidate) => candidate.id === configuredProductId && candidate.is_available)
  const pricing = item
    ? resolveSectionPromotionPrice({
        catalogPrice: item.price,
        mode: config.discountMode ?? 'percentage',
        percentage: config.discountPercent ?? '20',
        ...(config.campaignPrice !== undefined ? { fixedPrice: config.campaignPrice } : {}),
      })
    : null
  const timing = resolveSectionCampaignTiming({
    enabled: config.countdownEnabled,
    endsAt: config.campaignEndsAt,
  })

  const layout = text('layout', 'split') === 'stack' ? 'stack' : 'split'
  const showImage = bool('showImage', true)
  const showSavings = bool('showSavings', true)
  const showPolicyNote = bool('showPolicyNote', true)
  const imageShape = text('imageShape', 'rounded')
  const imageFit = text('imageFit', 'cover') === 'contain' ? 'contain' : 'cover'
  const imagePosition = text('imagePosition', 'center')
  const surface = text('bgColor', '#f5f7dc')
  const cardSurface = text('cardColor', '#ffffff')
  const textColor = text('textColor', '#1c2618')
  const mutedColor = text('mutedColor', textColor)
  const accent = text('accentColor', '#2e7d52')
  const radius = number('radius', 20)
  const cardRadius = number('cardRadius', 16)
  const padding = number('padding', 16)
  const imageSize = number('imageSize', layout === 'stack' ? 132 : 112)
  const ctaMode = text('ctaMode', 'inherit') === 'custom' ? 'custom' : 'inherit'
  const buttonStyle = ctaMode === 'inherit' ? (theme?.cardCtaStyle ?? 'pill') : text('buttonStyle', 'pill')
  const buttonIcon = ctaMode === 'inherit' ? (theme?.cardCtaIcon ?? 'plus') : text('buttonIcon', 'plus')
  const buttonSizeName = text('buttonSize', 'medium') as keyof typeof BUTTON_SIZE
  const buttonSize = BUTTON_SIZE[buttonSizeName] ?? BUTTON_SIZE.medium
  const buttonBackground = ctaMode === 'inherit' ? 'var(--p-cta)' : text('buttonBgColor', accent)
  const buttonColor = ctaMode === 'inherit' ? 'var(--p-cta-text)' : text('buttonTextColor', '#ffffff')
  const policyCombines = text('discountPolicy', 'combine-loyalty') !== 'promotion-only'
  const imageRadius = imageShape === 'circle' ? 999 : imageShape === 'square' ? 4 : Math.min(cardRadius, 14)
  const isReady = Boolean(item && pricing && timing.active)

  if (timing.enabled && timing.valid && !timing.active) return null

  const title = config.title?.trim() || item?.name || 'Kampanyalı ürün'
  const body = config.body?.trim() || item?.description || 'Seçili üründe menüye özel avantaj.'
  const percentageLabel = pricing?.kind === 'buy-2-pay-1'
    ? '2 AL 1 ÖDE'
    : pricing
      ? `%${pricing.percentage}`
      : `%${config.discountPercent?.trim() || '20'}`

  const addPromotion = () => {
    if (!item || !pricing || !timing.active || !onQuickAdd) return
    onQuickAdd(
      { ...item, price: pricing.price },
      item.price,
      {
        sectionInstanceId,
        kind: 'discount-badge',
        ...(pricing.kind === 'buy-2-pay-1' ? { quantityStep: pricing.quantity } : {}),
      },
    )
  }

  return (
    <section
      id={`custom-section-${sectionInstanceId}`}
      data-component="custom-section"
      data-section-kind="discount-badge"
      data-promotion-state={isReady ? 'ready' : 'configuration-required'}
      style={customSectionShell}
    >
      <style>{`
        .garsonless-discount-card {
          transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
        }
        .garsonless-discount-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--p-shadow);
          border-color: color-mix(in srgb, var(--discount-accent) 34%, transparent) !important;
        }
        .garsonless-discount-add { transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease; }
        .garsonless-discount-add:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.05); box-shadow: 0 8px 18px -12px var(--discount-accent); }
        .garsonless-discount-add:not(:disabled):active { transform: scale(.97); }
        .garsonless-discount-add:focus-visible { outline: 2px solid var(--discount-accent); outline-offset: 3px; }
        .garsonless-discount-media {
          align-self: start;
          isolation: isolate;
        }
        .garsonless-discount-offer-chip {
          max-width: 100%;
          white-space: nowrap;
        }
        .garsonless-discount-timer {
          contain: layout paint;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1, "zero" 1;
        }
        .garsonless-discount-clock { white-space: nowrap; }
        @media (prefers-reduced-motion: reduce) {
          .garsonless-discount-card, .garsonless-discount-add { transition: none !important; }
          .garsonless-discount-card:hover, .garsonless-discount-add:not(:disabled):hover { transform: none; }
        }
      `}</style>
      <div
        className="garsonless-discount-card"
        style={{
          '--discount-accent': accent,
          display: 'grid',
          gridTemplateColumns: layout === 'split' && showImage ? `${imageSize}px minmax(0, 1fr)` : 'minmax(0, 1fr)',
          gap: layout === 'split' ? 15 : 12,
          alignItems: 'stretch',
          padding,
          borderRadius: radius,
          border: `1px solid color-mix(in srgb, ${accent} 18%, transparent)`,
          background: surface,
          color: textColor,
          overflow: 'hidden',
          boxShadow: '0 2px 10px color-mix(in srgb, var(--p-text) 6%, transparent)',
        } as CSSProperties}
      >
        {showImage && (
          <div className="garsonless-discount-media" style={{
            position: 'relative',
            width: '100%',
            height: imageSize,
            aspectRatio: layout === 'split' ? '1 / 1' : 'auto',
            borderRadius: imageRadius,
            overflow: 'hidden',
            background: cardSurface,
            display: 'grid',
            placeItems: 'center',
          }}>
            {item?.images[0] ? (
              <img src={item.images[0]} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: imageFit, objectPosition: imagePosition, display: 'block' }} />
            ) : (
              <AppIcons.image size={28} aria-hidden="true" style={{ color: accent, opacity: .62 }} />
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, padding: layout === 'stack' ? '1px 2px 2px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
            <span style={{ color: accent, fontSize: 10.5, fontWeight: 850, letterSpacing: '.12em', textTransform: 'uppercase' }}>
              {config.eyebrow?.trim() || 'MENÜYE ÖZEL'}
            </span>
            <span
              className="garsonless-discount-offer-chip"
              style={{
                padding: '3px 7px',
                borderRadius: 999,
                border: `1px solid color-mix(in srgb, ${accent} 22%, transparent)`,
                background: `color-mix(in srgb, ${accent} 9%, ${cardSurface})`,
                color: accent,
                fontSize: 9.5,
                lineHeight: 1.2,
                fontWeight: 850,
                letterSpacing: '.025em',
              }}
            >
              {pricing?.kind === 'buy-2-pay-1' ? percentageLabel : `${percentageLabel} avantaj`}
            </span>
          </div>
          <h2 style={{ margin: '5px 0 0', fontFamily: 'var(--p-display)', fontSize: 22, lineHeight: 1.08, letterSpacing: '-.02em', color: textColor }}>
            {title}
          </h2>
          <p style={{ margin: '7px 0 0', color: mutedColor, opacity: .72, fontSize: 12, lineHeight: 1.42, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {body}
          </p>
          {item && <ProductAllergenSummary item={item} style={{marginTop:8}} />}

          {timing.enabled && timing.valid && (
            <CampaignCountdown
              endsAtMs={timing.endsAtMs}
              label={config.countdownLabel?.trim() || 'Fırsatın bitmesine'}
              background={text('timerBgColor', cardSurface)}
              color={text('timerTextColor', accent)}
            />
          )}

          {item && pricing && timing.active ? (
            <div style={{ marginTop: 13, padding: '10px 11px', borderRadius: cardRadius, background: cardSurface, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 7 }}>
                  <strong style={{ color: textColor, fontSize: 17, lineHeight: 1 }}>
                    {pricing.kind === 'buy-2-pay-1'
                      ? `2 ürün · ${formatTRY(pricing.totalPrice)}`
                      : formatTRY(pricing.price)}
                  </strong>
                  <del style={{ color: mutedColor, opacity: .55, fontSize: 12, fontWeight: 700 }}>
                    {formatTRY(pricing.kind === 'buy-2-pay-1' ? pricing.originalTotal : item.price)}
                  </del>
                </div>
                {showSavings && (
                  <span style={{ display: 'block', marginTop: 4, color: accent, fontSize: 10.5, fontWeight: 800 }}>
                    {formatTRY(pricing.kind === 'buy-2-pay-1' ? pricing.originalTotal - pricing.totalPrice : pricing.savings)} kazanç
                  </span>
                )}
              </div>
              <button
                type="button"
                className="garsonless-discount-add"
                data-cta-source={ctaMode}
                data-cta-icon={buttonIcon}
                disabled={!onQuickAdd || !timing.active}
                aria-label={pricing.kind === 'buy-2-pay-1'
                  ? `${item.name} ürününden iki adedi 2 al 1 öde kampanyasıyla sepete ekle`
                  : `${item.name} kampanyalı olarak sepete ekle`}
                onClick={addPromotion}
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
                <DiscountCtaIcon kind={buttonIcon} size={Math.max(15, Math.round(buttonSize * .43))} />
                {buttonStyle !== 'icon' && <span>{config.cta?.trim() || 'Fırsatı ekle'}</span>}
              </button>
            </div>
          ) : (
            <div role="status" style={{ marginTop: 13, padding: '11px 12px', borderRadius: cardRadius, border: `1px dashed color-mix(in srgb, ${accent} 38%, transparent)`, background: cardSurface, color: mutedColor, fontSize: 11.5, lineHeight: 1.4 }}>
              {!item
                ? 'Bu kampanya için satışta olan bir ürün seçin.'
                : timing.enabled && !timing.valid
                  ? 'Süreli kampanya için geçerli bir bitiş tarihi ve saati seçin.'
                  : 'Geçerli bir indirim oranı veya kampanya fiyatı girin.'}
            </div>
          )}

          {showPolicyNote && isReady && (
            <p style={{ margin: '8px 2px 0', color: mutedColor, opacity: .58, fontSize: 9.5, lineHeight: 1.35 }}>
              {policyCombines ? 'Üyelik avantajlarıyla birlikte kullanılabilir.' : 'Bu kampanya diğer üyelik indirimleriyle birleşmez.'}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function CampaignCountdown({ endsAtMs, label, background, color }: {
  endsAtMs: number
  label: string
  background: string
  color: string
}) {
  const timerRef = useRef<HTMLDivElement>(null)
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, endsAtMs - Date.now()))

  useEffect(() => {
    let interval: number | undefined
    const update = () => {
      const next = Math.max(0, endsAtMs - Date.now())
      setRemainingMs(next)
      if (next === 0) {
        const section = timerRef.current?.closest<HTMLElement>('section[data-section-kind="discount-badge"]')
        if (section) section.hidden = true
        if (interval !== undefined) window.clearInterval(interval)
      }
    }
    update()
    if (endsAtMs > Date.now()) interval = window.setInterval(update, 1000)
    return () => {
      if (interval !== undefined) window.clearInterval(interval)
    }
  }, [endsAtMs])

  return (
    <div
      ref={timerRef}
      role="timer"
      aria-live="off"
      className="garsonless-discount-timer"
      style={{
        marginTop: 10,
        minHeight: 54,
        padding: '8px 10px',
        borderRadius: 12,
        background,
        color,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 10,
        fontSize: 10.5,
        fontWeight: 750,
      }}
    >
      <span style={{ minWidth: 0, opacity: .76, lineHeight: 1.4 }}>{label}</span>
      <strong
        className="garsonless-discount-clock"
        style={{
          width: remainingMs >= 86_400_000 ? '14ch' : '8.5ch',
          textAlign: 'right',
          fontSize: 12,
          lineHeight: 1,
          letterSpacing: '.04em',
        }}
      >
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

function DiscountCtaIcon({ kind, size }: { kind: string; size: number }) {
  if (kind === 'cart') return <AppIcons.cart size={size} aria-hidden="true" />
  if (kind === 'bag') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
  return <AppIcons.plus size={size} aria-hidden="true" />
}
