'use client'

import { useEffect, useRef, useState } from 'react'
import type { MenuItem } from './types'
import { useTheme } from './ThemeContext'
import { formatTRY } from './formatCurrency'
import { DietaryBadges, ProductAllergenSummary, hasAllergenInformation } from './FoodInfoBadges'
import { isProductConfigurable } from './productConfiguration'
import { AppIcons } from '../icons'
import { TAG_SHIMMER_TARGET_CLASS, tagShimmerScopeClass } from './tagShimmer'

interface ProductCardProps {
  item: MenuItem
  onOpen: (item: MenuItem) => void
  onQuickAdd: (item: MenuItem) => void
  promotionLabel?: string
  orderingEnabled?: boolean
  cols?: number
  cartQuantity?: number
  onIncrement?: () => void
  onDecrement?: () => void
  imagePriority?: boolean
  isFavorite?: boolean
  onToggleFavorite?: () => void
}

const SHADOW_MAP: Record<string, string> = {
  none: 'none',
  soft: '0 1px 2px rgba(15,17,21,.04), 0 6px 14px -8px rgba(15,17,21,.10)',
  hard: '0 4px 0 0 rgba(15,17,21,.12), 0 1px 0 0 rgba(15,17,21,.06)',
}

function FoodMeta({ item, inline = false }: { item: MenuItem; inline?: boolean }) {
  const hasDietaryBadge = item.is_vegan || item.is_vegetarian || item.is_halal
  const hasAllergenNotice = hasAllergenInformation(item)
  if (item.energy_kcal === null && !hasDietaryBadge && !hasAllergenNotice) return null

  return (
    <div data-component="food-meta" data-layout={inline ? 'inline' : 'stacked'} style={{
      display: 'flex', flexDirection: inline ? 'row' : 'column', alignItems: inline ? 'center' : undefined,
      gap: 5, marginTop: inline ? 5 : 6, minWidth: 0, flexWrap: inline ? 'wrap' : undefined,
    }}>
      <div data-component={inline ? 'food-meta-primary' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: inline ? 'nowrap' : 'wrap', minWidth: 0 }}>
        {item.energy_kcal !== null && (
          <span style={{ fontSize: 10, fontWeight: 750, color: 'var(--p-text-2)', flexShrink: 0 }}>{item.energy_kcal} kcal</span>
        )}
        <DietaryBadges item={item} compact {...(inline ? { singleLine: true } : {})} />
      </div>
      {hasAllergenNotice && <ProductAllergenSummary item={item} maxVisible={inline ? 2 : 3} {...(inline ? { style: { flexShrink: 0 } } : {})} />}
    </div>
  )
}

export function ProductCard({ item, onOpen, onQuickAdd, promotionLabel, orderingEnabled = true, cartQuantity = 0, onIncrement, onDecrement, imagePriority = false, isFavorite = false, onToggleFavorite }: ProductCardProps) {
  const { theme } = useTheme()
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardWidth, setCardWidth] = useState<number | null>(null)
  const narrow = cardWidth !== null && cardWidth < 180
  const horizontal = theme.cardLayout === 'horizontal'
  const minimal = theme.cardLayout === 'minimal'
  const aspect = narrow ? '1/1' : '4/3'
  const cardRadius = theme.cardRadius ?? theme.radius
  const cardShadow = theme.cardShadow ?? theme.shadow
  const cardBorder = theme.cardBorder ?? theme.border
  const shadow = SHADOW_MAP[cardShadow] ?? SHADOW_MAP.soft
  const hasModifiers = isProductConfigurable(item)
  const inCart = cartQuantity > 0
  const nameColor = 'var(--p-accent)'
  const nameFontSize = 'clamp(13px, calc(var(--p-fs) * .9), 16px)'
  const showImage = theme.cardShowImage ?? true
  const imageUrl = item.images[0] ?? null
  const hasProductImage = imageUrl !== null
  const mediaVisible = showImage
  const titleLines = Number(theme.cardTitleLines ?? 2)
  const descriptionLines = Number(theme.cardDescriptionLines ?? 2)
  const density = theme.cardDensity ?? 'normal'
  const contentPadding = density === 'compact' ? (narrow ? '6px 7px 8px' : '8px 10px 10px') : density === 'spacious' ? (narrow ? '10px 10px 12px' : '14px 16px 16px') : (narrow ? '8px 8px 10px' : '10px 12px 12px')
  const horizontalMinHeight = density === 'compact' ? 104 : density === 'spacious' ? 128 : 116
  const horizontalImageWidth = Math.max(92, Math.min(160, theme.cardHorizontalImageWidth ?? 92))
  const minimalMinHeight = density === 'compact' ? 52 : density === 'spacious' ? 68 : 60
  const restingShadow = inCart ? `${shadow}, 0 0 0 2px var(--p-cta)` : shadow

  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const updateWidth = (width: number) => {
      const rounded = Math.round(width)
      setCardWidth((current) => current === rounded ? current : rounded)
    }
    updateWidth(card.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (typeof width === 'number') updateWidth(width)
    })
    observer.observe(card)
    return () => observer.disconnect()
  }, [])

  const cardBase = {
    background: 'var(--p-card)',
    borderRadius: `${cardRadius}px`,
    overflow: 'hidden',
    position: 'relative',
    cursor: 'pointer',
    transition: 'box-shadow 150ms ease, transform 150ms ease',
    boxShadow: restingShadow,
    border: cardBorder === 'none' ? 'none' : `${cardBorder === 'solid' ? 2 : 1}px solid var(--p-border)`,
    '--product-card-shadow': restingShadow,
  } as React.CSSProperties

  if (minimal) {
    return (
      <div
        ref={cardRef}
        id={`product-${item.id}`}
        data-component="card"
        data-product-card
        data-card-width={narrow ? 'narrow' : 'regular'}
        data-card-layout="minimal"
        data-card-hover={theme.cardHover}
        data-card-motion={theme.motion === 'none' ? 'none' : 'enabled'}
        className={tagShimmerScopeClass(theme)}
        style={{
          ...cardBase, display: 'flex', alignItems: 'center', gap: 4,
          minHeight: minimalMinHeight,
          padding: density === 'compact' ? '4px 6px' : density === 'spacious' ? '12px 10px' : '8px 8px',
        }}
      >
        <CardOpenButton itemName={item.name} onOpen={() => onOpen(item)} radius={cardRadius} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontWeight: 700, color: nameColor, fontSize: nameFontSize,
            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{item.name}</span>
          {promotionLabel && <PromotionBadge label={promotionLabel} compact inline />}
          {!promotionLabel && theme.cardShowTag && hasModifiers && <OptionBadge compact />}
        </div>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--p-text)', flexShrink: 0 }}>{formatTRY(item.price)}</span>
        {onToggleFavorite && <FavoriteButton placement="inline" itemName={item.name} favorite={isFavorite} onToggle={onToggleFavorite} />}
        <ProductCTA
          item={item}
          ctaStyle="icon"
          narrow
          cartQuantity={cartQuantity}
          onQuickAdd={orderingEnabled ? () => onQuickAdd(item) : undefined}
          onIncrement={orderingEnabled ? onIncrement : undefined}
          onDecrement={orderingEnabled ? onDecrement : undefined}
          hidePrice
          compactRow
          iconKind={theme.cardCtaIcon ?? 'plus'}
        />
      </div>
    )
  }

  if (horizontal) {
    return (
      <div
        ref={cardRef}
        id={`product-${item.id}`}
        data-component="card"
        data-product-card
        data-card-layout="horizontal"
        data-card-width={narrow ? 'narrow' : 'regular'}
        data-card-hover={theme.cardHover}
        data-card-motion={theme.motion === 'none' ? 'none' : 'enabled'}
        data-image-state={hasProductImage ? 'available' : 'missing'}
        className={tagShimmerScopeClass(theme)}
        style={{ ...cardBase, display: 'flex', minHeight: horizontalMinHeight }}
      >
        <CardOpenButton itemName={item.name} onOpen={() => onOpen(item)} radius={cardRadius} />
        {mediaVisible && <div data-component="product-card-media" style={{
          width: `clamp(92px, ${horizontalImageWidth}px, 42%)`, flexShrink: 0,
          background: theme.cardPlaceholderStyle === 'accent'
            ? 'var(--p-accent-soft)'
            : theme.cardPlaceholderStyle === 'outline'
              ? 'transparent'
              : 'linear-gradient(135deg, #f3f4f6 0%, #e6e7eb 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#bfc1c6', position: 'relative', overflow: 'hidden',
        }}>
          {hasProductImage ? (
            <img
              src={imageUrl} alt={item.name}
              loading={imagePriority ? 'eager' : 'lazy'}
              fetchPriority={imagePriority ? 'high' : 'auto'}
              decoding="async"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: theme.cardImagePosition ?? 'center' }}
            />
          ) : <ImagePlaceholderIcon />}
        </div>}
        <div style={{ padding: contentPadding, display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {(promotionLabel || (theme.cardShowTag && hasModifiers)) && (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                  {promotionLabel && <PromotionBadge label={promotionLabel} compact inline />}
                  {theme.cardShowTag && hasModifiers && <OptionBadge compact />}
                </div>
              )}
              <div style={{
                fontWeight: 700, color: nameColor, fontSize: nameFontSize, lineHeight: 'var(--p-line-tight)',
                overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
              }}>{item.name}</div>
            </div>
            {onToggleFavorite && <FavoriteButton placement="inline" itemName={item.name} favorite={isFavorite} onToggle={onToggleFavorite} />}
          </div>
          {theme.cardShowDesc && item.description && (
            <div style={{
              fontSize: 'clamp(11px, calc(var(--p-fs) * .77), 14px)', color: 'var(--p-text-2)',
              marginTop: 3, lineHeight: 'var(--p-line-body)', overflow: 'hidden', display: '-webkit-box',
              WebkitBoxOrient: 'vertical', WebkitLineClamp: 1,
            }}>{item.description}</div>
          )}
          <FoodMeta item={item} inline />
          <ProductCTA
            item={item}
            ctaStyle={theme.cardCtaStyle}
            narrow={false}
            cartQuantity={cartQuantity}
            onQuickAdd={orderingEnabled ? () => onQuickAdd(item) : undefined}
            onIncrement={orderingEnabled ? onIncrement : undefined}
            onDecrement={orderingEnabled ? onDecrement : undefined}
            priceAlign={theme.cardPriceAlign ?? 'left'}
            iconKind={theme.cardCtaIcon ?? 'plus'}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      id={`product-${item.id}`}
      data-component="card"
      data-product-card
      data-card-layout="vertical"
      data-card-width={narrow ? 'narrow' : 'regular'}
      data-card-hover={theme.cardHover}
      data-card-motion={theme.motion === 'none' ? 'none' : 'enabled'}
      className={tagShimmerScopeClass(theme)}
      data-image-state={hasProductImage ? 'available' : 'missing'}
      style={{ ...cardBase, display: 'flex', flexDirection: 'column' }}
    >
      <CardOpenButton itemName={item.name} onOpen={() => onOpen(item)} radius={cardRadius} />
      {onToggleFavorite && <FavoriteButton itemName={item.name} favorite={isFavorite} onToggle={onToggleFavorite} />}
      {mediaVisible && <div data-component="product-card-media" style={{
        aspectRatio: aspect, width: '100%',
        background: theme.cardPlaceholderStyle === 'accent'
          ? 'var(--p-accent-soft)'
          : theme.cardPlaceholderStyle === 'outline'
            ? 'transparent'
            : 'linear-gradient(135deg, #f3f4f6 0%, #e6e7eb 100%)',
        borderBottom: theme.cardPlaceholderStyle === 'outline' ? '1px dashed var(--p-border)' : undefined,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#bfc1c6', position: 'relative', overflow: 'hidden',
      }}>
        {hasProductImage ? (
          <img
            src={imageUrl} alt={item.name}
            loading={imagePriority ? 'eager' : 'lazy'}
            fetchPriority={imagePriority ? 'high' : 'auto'}
            decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: theme.cardImagePosition ?? 'center' }}
          />
        ) : (
          <ImagePlaceholderIcon />
        )}
        {(promotionLabel || (theme.cardShowTag && hasModifiers)) && (
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, pointerEvents: 'none' }}>
            {promotionLabel && <PromotionBadge label={promotionLabel} compact={narrow} />}
            {theme.cardShowTag && hasModifiers && (
              <OptionBadge compact={narrow} overlay />
            )}
          </div>
        )}
        {inCart && (
          <div style={{
            position: 'absolute', top: 6, right: onToggleFavorite ? 56 : 6, zIndex: 2,
            width: 20, height: 20, borderRadius: 999,
            background: 'var(--p-cta)', color: 'var(--p-cta-text)',
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{cartQuantity}</div>
        )}
      </div>}
      <div style={{ padding: contentPadding, display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        {!mediaVisible && (promotionLabel || (theme.cardShowTag && hasModifiers)) && (
          <div style={{ alignSelf: 'flex-start', marginBottom: 7, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {promotionLabel && <PromotionBadge label={promotionLabel} compact={narrow} />}
            {theme.cardShowTag && hasModifiers && (
              <OptionBadge compact={narrow} />
            )}
          </div>
        )}
        <div style={{
          fontWeight: 700, color: nameColor, fontSize: nameFontSize, lineHeight: 'var(--p-line-tight)',
          overflow: 'hidden',
          display: '-webkit-box' as React.CSSProperties['display'],
          WebkitLineClamp: narrow ? 1 : titleLines,
          WebkitBoxOrient: 'vertical',
        } as React.CSSProperties}>{item.name}</div>
        {!narrow && theme.cardShowDesc && item.description && (
          <div style={{ fontSize: 'var(--p-text-sm)', color: 'var(--p-text-2)', marginTop: 3, flex: 1, lineHeight: 'var(--p-line-body)', overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: descriptionLines }}>
            {item.description}
          </div>
        )}
        <FoodMeta item={item} />
        <ProductCTA
          item={item}
          ctaStyle={theme.cardCtaStyle}
          narrow={narrow}
          cartQuantity={cartQuantity}
          onQuickAdd={orderingEnabled ? () => onQuickAdd(item) : undefined}
          onIncrement={orderingEnabled ? onIncrement : undefined}
          onDecrement={orderingEnabled ? onDecrement : undefined}
          hidePrice={false}
          priceAlign={theme.cardPriceAlign ?? 'left'}
          iconKind={theme.cardCtaIcon ?? 'plus'}
        />
      </div>
    </div>
  )
}

function PromotionBadge({ label, compact = false, inline = false }: { label: string; compact?: boolean; inline?: boolean }) {
  return (
    <span
      data-component="product-promotion-badge"
      className={TAG_SHIMMER_TARGET_CLASS}
      style={{
        display: 'inline-flex', alignItems: 'center', width: 'fit-content',
        marginBottom: inline ? 0 : compact ? 5 : 0,
        background: 'var(--p-cta)', color: 'var(--p-cta-text)',
        fontSize: compact ? 9 : 10, fontWeight: 850, letterSpacing: '.02em', lineHeight: 1.2,
        padding: compact ? '3px 6px' : '4px 8px', borderRadius: 999,
        boxShadow: '0 2px 6px rgba(15,17,21,.14)',
      }}
    >
      {label}
    </span>
  )
}

function OptionBadge({ compact = false, overlay = false }: { compact?: boolean; overlay?: boolean }) {
  return (
    <span className={TAG_SHIMMER_TARGET_CLASS} style={{
      background: overlay ? 'var(--p-card)' : 'var(--p-accent-soft)', color: 'var(--p-accent)',
      fontSize: compact ? 9 : 10, fontWeight: 700, letterSpacing: '.02em', lineHeight: 1.2,
      padding: compact ? '2px 5px' : '3px 7px', borderRadius: 999, flexShrink: 0,
      boxShadow: overlay ? '0 1px 3px rgba(0,0,0,.08)' : undefined,
    }}>Seçenekler</span>
  )
}

function FavoriteButton({ itemName, favorite, onToggle, placement = 'overlay' }: { itemName: string; favorite: boolean; onToggle: () => void; placement?: 'overlay' | 'inline' }) {
  return (
    <button
      type="button"
      data-card-favorite-action="true"
      aria-label={favorite ? `${itemName} favorilerden çıkar` : `${itemName} favorilere ekle`}
      aria-pressed={favorite}
      onClick={(event) => { event.stopPropagation(); onToggle() }}
      style={{
        position: placement === 'overlay' ? 'absolute' : 'relative',
        top: placement === 'overlay' ? 6 : undefined,
        right: placement === 'overlay' ? 6 : undefined,
        zIndex: 3, flexShrink: 0,
        width: 44, height: 44, borderRadius: '50%',
        padding: 0, border: 'none', background: 'transparent',
        display: 'grid', placeItems: 'center', cursor: 'pointer',
        touchAction: 'manipulation',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 38, height: 38, borderRadius: '50%',
          border: '1px solid color-mix(in srgb,var(--p-border) 85%,transparent)',
          background: favorite ? 'var(--p-cta)' : 'color-mix(in srgb,var(--p-card) 90%,transparent)',
          color: favorite ? 'var(--p-cta-text)' : 'var(--p-text)',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 3px 10px rgba(15,17,21,.11)',
          backdropFilter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      >
        <AppIcons.heart size={17} fill={favorite ? 'currentColor' : 'none'} />
      </span>
    </button>
  )
}

function ProductCTA({ item, ctaStyle, narrow, cartQuantity = 0, onQuickAdd, onIncrement, onDecrement, hidePrice = false, priceAlign = 'left', iconKind = 'plus', compactRow = false }: {
  item: MenuItem
  ctaStyle: string
  narrow: boolean
  cartQuantity?: number
  onQuickAdd?: (() => void) | undefined
  onIncrement?: (() => void) | undefined
  onDecrement?: (() => void) | undefined
  hidePrice?: boolean
  priceAlign?: 'left' | 'right'
  iconKind?: 'plus' | 'cart' | 'bag'
  compactRow?: boolean
}) {
  const inCart = cartQuantity > 0
  const btnSz = 44
  const actionVisualSize = narrow ? 30 : 32
  const stepperVisualSize = narrow ? 24 : 28
  const stepperTrackInset = narrow ? 8 : 6
  const stepperIconSize = narrow ? 13 : 14

  if (!onQuickAdd) {
    return hidePrice ? null : (
      <div style={{ marginTop: 'auto', paddingTop: 10, textAlign: priceAlign }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--p-text)' }}>{formatTRY(item.price)}</span>
      </div>
    )
  }

  const stepper = (
    <div
      data-card-stepper="true"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 0,
        width: btnSz * 2, height: btnSz, background: 'transparent', borderRadius: 999,
        padding: 0,
        flexShrink: 0, position: 'relative', zIndex: 2,
        alignSelf: narrow ? (priceAlign === 'right' ? 'flex-end' : 'flex-start') : undefined,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        aria-hidden="true"
        data-card-stepper-track="true"
        style={{
          position: 'absolute', inset: `${stepperTrackInset}px 0`, borderRadius: 999,
          background: 'var(--p-cta)',
          boxShadow: '0 2px 6px rgba(15,17,21,.16)',
          pointerEvents: 'none',
        }}
      />
      <button
        type="button"
        data-card-quantity-action="decrement"
        aria-label={`${item.name} adedini azalt`}
        onClick={(e) => { e.stopPropagation(); onDecrement?.() }}
        style={{
          width: btnSz, height: btnSz, border: 'none',
          background: 'transparent', borderRadius: '50%',
          color: 'var(--p-cta-text)', cursor: 'pointer', display: 'grid',
          placeItems: 'center', padding: 0, lineHeight: 0, position: 'relative', zIndex: 1,
        }}
      >
        <span
          aria-hidden="true"
          data-card-stepper-visual="true"
          style={{
            width: stepperVisualSize, height: stepperVisualSize, borderRadius: '50%',
            background: 'rgba(0,0,0,0.15)', display: 'grid', placeItems: 'center',
            pointerEvents: 'none',
          }}
        ><AppIcons.minus size={stepperIconSize} /></span>
      </button>
      <span style={{
        color: 'var(--p-cta-text)', fontSize: narrow ? 10 : 11.5, fontWeight: 750,
        minWidth: narrow ? 10 : 14, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
        position: 'absolute', left: '50%', transform: 'translateX(-50%)', zIndex: 1,
        pointerEvents: 'none',
      }}>{cartQuantity}</span>
      <button
        type="button"
        data-card-quantity-action="increment"
        disabled={cartQuantity >= 99}
        aria-label={`${item.name} adedini artır`}
        onClick={(e) => { e.stopPropagation(); onIncrement?.() }}
        style={{
          width: btnSz, height: btnSz, border: 'none',
          background: 'transparent', borderRadius: '50%',
          color: 'var(--p-cta-text)', cursor: cartQuantity >= 99 ? 'not-allowed' : 'pointer', display: 'grid',
          placeItems: 'center', padding: 0, lineHeight: 0, position: 'relative', zIndex: 1,
          opacity: cartQuantity >= 99 ? 0.5 : 1,
        }}
      >
        <span
          aria-hidden="true"
          data-card-stepper-visual="true"
          style={{
            width: stepperVisualSize, height: stepperVisualSize, borderRadius: '50%',
            background: 'rgba(0,0,0,0.15)', display: 'grid', placeItems: 'center',
            pointerEvents: 'none',
          }}
        ><AppIcons.plus size={stepperIconSize} /></span>
      </button>
    </div>
  )

  if (ctaStyle === 'full') {
    return (
      <div style={{ marginTop: 'auto', paddingTop: compactRow ? 0 : 10, position: 'relative', zIndex: 2 }}>
        {inCart ? (
          <div style={{ display: 'flex', flexDirection: narrow ? 'column' : priceAlign === 'right' ? 'row-reverse' : 'row', alignItems: narrow ? (priceAlign === 'right' ? 'flex-end' : 'flex-start') : 'center', justifyContent: 'space-between', gap: narrow ? 8 : 4 }}>
            {!hidePrice && (
              <span style={{
                fontWeight: 700, fontSize: 13, color: 'var(--p-text)',
                textAlign: priceAlign,
                flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{formatTRY(item.price)}</span>
            )}
            {stepper}
          </div>
        ) : (
          <>
            {!hidePrice && (
              <span style={{
                fontWeight: 700, fontSize: 13, color: 'var(--p-text)',
                display: 'block', marginBottom: 6,
                textAlign: priceAlign,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{formatTRY(item.price)}</span>
            )}
            <button type="button" data-card-cta-action="true" style={{
              background: 'var(--p-cta)', color: 'var(--p-cta-text)', border: 'none',
              minHeight: 44, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, width: '100%',
            }} aria-label={`${item.name} sepete ekle`} onClick={(e) => { e.stopPropagation(); onQuickAdd?.() }}>Sepete ekle</button>
          </>
        )}
      </div>
    )
  }

  if (ctaStyle === 'pill') {
    return (
      <div style={{ display: 'flex', flexDirection: inCart && narrow ? 'column' : priceAlign === 'right' ? 'row-reverse' : 'row', alignItems: inCart && narrow ? (priceAlign === 'right' ? 'flex-end' : 'flex-start') : 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: compactRow ? 0 : 10, gap: inCart && narrow ? 8 : 4, position: 'relative', zIndex: 2 }}>
        {!hidePrice && (
          <span style={{
            fontWeight: 700, fontSize: 13, color: 'var(--p-text)',
            textAlign: priceAlign,
            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{formatTRY(item.price)}</span>
        )}
        {inCart ? stepper : (
          <button type="button" data-card-cta-action="true" style={{
            width: 44, height: 44, padding: 0,
            background: 'transparent', color: 'var(--p-cta-text)', border: 'none',
            borderRadius: 999, cursor: 'pointer', display: 'grid', placeItems: 'center',
            flexShrink: 0,
          }} aria-label={`${item.name} sepete ekle`} onClick={(e) => { e.stopPropagation(); onQuickAdd?.() }}>
            <span
              aria-hidden="true"
              data-card-cta-visual="true"
              style={{
                minWidth: actionVisualSize, height: actionVisualSize,
                padding: narrow ? '0 7px' : '0 10px', borderRadius: 999,
                background: 'var(--p-cta)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(15,17,21,.16)',
                fontSize: narrow ? 11 : 11.5, fontWeight: 600, pointerEvents: 'none',
              }}
            >{narrow ? '+' : 'Ekle'}</span>
          </button>
        )}
      </div>
    )
  }

  // icon (default)
  return (
    <div style={{ display: 'flex', flexDirection: inCart && narrow ? 'column' : priceAlign === 'right' ? 'row-reverse' : 'row', alignItems: inCart && narrow ? (priceAlign === 'right' ? 'flex-end' : 'flex-start') : 'center', justifyContent: hidePrice ? 'flex-end' : 'space-between', marginTop: 'auto', paddingTop: compactRow ? 0 : 10, gap: inCart && narrow ? 8 : 4, position: 'relative', zIndex: 2 }}>
      {!hidePrice && (
        <span style={{
          fontWeight: 700, fontSize: 13, color: 'var(--p-text)',
          textAlign: priceAlign,
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{formatTRY(item.price)}</span>
      )}
      {inCart ? stepper : (
        <button type="button" data-card-cta-action="true" style={{
          width: 44, height: 44, borderRadius: 999, border: 'none',
          padding: 0, background: 'transparent', color: 'var(--p-cta-text)', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }} aria-label={`${item.name} sepete ekle`} onClick={(e) => { e.stopPropagation(); onQuickAdd?.() }}>
          <span
            aria-hidden="true"
            data-card-cta-visual="true"
            style={{
              width: actionVisualSize, height: actionVisualSize, borderRadius: 999,
              background: 'var(--p-cta)', display: 'grid', placeItems: 'center',
              boxShadow: '0 2px 6px rgba(15,17,21,.16)', pointerEvents: 'none',
            }}
          >
            <CardCtaIcon kind={iconKind} />
          </span>
        </button>
      )}
    </div>
  )
}

function CardOpenButton({ itemName, onOpen, radius }: { itemName: string; onOpen: () => void; radius: number }) {
  return (
    <button
      type="button"
      className="product-card-open"
      aria-label={`${itemName} detayını aç`}
      onClick={onOpen}
      style={{
        position: 'absolute', inset: 0, zIndex: 1, width: '100%', height: '100%',
        padding: 0, border: 0, borderRadius: `${radius}px`, background: 'transparent', cursor: 'pointer',
      }}
    />
  )
}

function CardCtaIcon({ kind }: { kind: 'plus' | 'cart' | 'bag' }) {
  if (kind === 'cart') return <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 4h2l2 11h10l2-8H6"/><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/></svg>
  if (kind === 'bag') return <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
  return <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
}

function ImagePlaceholderIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.7" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
    </svg>
  )
}
