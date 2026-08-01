'use client'

import { useState } from 'react'
import type { MenuItem } from './types'
import { useTheme } from './ThemeContext'
import { formatTRY } from './formatCurrency'
import { DietaryBadges, ProductAllergenSummary, hasAllergenInformation } from './FoodInfoBadges'
import { isProductConfigurable } from './productConfiguration'

interface ProductCardProps {
  item: MenuItem
  onOpen: (item: MenuItem) => void
  onQuickAdd: (item: MenuItem) => void
  cols?: number
  cartQuantity?: number
  onIncrement?: () => void
  onDecrement?: () => void
  imagePriority?: boolean
}

const ASPECT_MAP: Record<string, string> = {
  '1:1': '1/1',
  '4:3': '4/3',
  '16:9': '16/9',
}

const SHADOW_MAP: Record<string, string> = {
  none: 'none',
  soft: '0 1px 2px rgba(15,17,21,.04), 0 6px 14px -8px rgba(15,17,21,.10)',
  hard: '0 4px 0 0 rgba(15,17,21,.12), 0 1px 0 0 rgba(15,17,21,.06)',
}

function FoodMeta({ item }: { item: MenuItem }) {
  const hasDietaryBadge = item.is_vegan || item.is_vegetarian || item.is_halal
  const hasAllergenNotice = hasAllergenInformation(item)
  if (item.energy_kcal === null && !hasDietaryBadge && !hasAllergenNotice) return null

  return (
    <div data-component="food-meta" style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        {item.energy_kcal !== null && (
          <span style={{ fontSize: 10, fontWeight: 750, color: 'var(--p-text-2)' }}>{item.energy_kcal} kcal</span>
        )}
        <DietaryBadges item={item} compact />
      </div>
      {hasAllergenNotice && <ProductAllergenSummary item={item} />}
    </div>
  )
}

export function ProductCard({ item, onOpen, onQuickAdd, cols, cartQuantity = 0, onIncrement, onDecrement, imagePriority = false }: ProductCardProps) {
  const { theme } = useTheme()
  const [hovered, setHovered] = useState(false)
  const effectiveCols = cols ?? theme.cols
  const narrow = effectiveCols >= 3
  const horizontal = !narrow && theme.cardLayout === 'horizontal'
  const minimal = theme.cardLayout === 'minimal'
  const aspect = narrow ? '1/1' : (ASPECT_MAP[theme.cardImageAspect] ?? '4/3')
  const shadow = SHADOW_MAP[theme.shadow] ?? SHADOW_MAP.soft
  const hasModifiers = isProductConfigurable(item)
  const inCart = cartQuantity > 0
  const nameColor = 'var(--p-accent)'
  const nameFontSize = 13.5
  const showImage = theme.cardShowImage ?? true
  const imageUrl = item.images[0] ?? null
  const hasProductImage = imageUrl !== null
  const mediaVisible = showImage
  const titleLines = Number(theme.cardTitleLines ?? 2)
  const descriptionLines = Number(theme.cardDescriptionLines ?? 2)
  const density = theme.cardDensity ?? 'normal'
  const contentPadding = density === 'compact' ? (narrow ? '6px 7px 8px' : '8px 10px 10px') : density === 'spacious' ? (narrow ? '10px 10px 12px' : '14px 16px 16px') : (narrow ? '8px 8px 10px' : '10px 12px 12px')
  const hoverStyle = hovered && theme.motion !== 'none'
    ? theme.cardHover === 'lift'
      ? { transform: 'translateY(-3px)', boxShadow: `${shadow}, 0 10px 24px rgba(15,17,21,.12)` }
      : theme.cardHover === 'glow'
        ? { boxShadow: `${shadow}, 0 0 0 3px color-mix(in srgb, var(--p-cta) 24%, transparent)` }
        : {}
    : {}

  const cardBase: React.CSSProperties = {
    background: 'var(--p-card)',
    borderRadius: `${theme.radius}px`,
    overflow: 'hidden',
    position: 'relative',
    cursor: 'pointer',
    transition: 'box-shadow 150ms ease, transform 150ms ease',
    boxShadow: inCart ? `${shadow}, 0 0 0 2px var(--p-cta)` : shadow,
    border: theme.border === 'none' ? 'none' : `var(--p-border-w) solid var(--p-border)`,
    ...hoverStyle,
  }

  const hoverProps = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  }

  if (minimal) {
    return (
      <div
        id={`product-${item.id}`}
        data-component="card"
        style={{ ...cardBase, display: 'flex', alignItems: 'center', gap: 12, padding: density === 'compact' ? '9px 11px' : density === 'spacious' ? '15px 17px' : '12px 14px' }}
        {...hoverProps}
      >
        <CardOpenButton itemName={item.name} onOpen={() => onOpen(item)} radius={theme.radius} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{
              fontWeight: 700, color: nameColor, fontSize: nameFontSize,
              flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{item.name}</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--p-text)', flexShrink: 0 }}>{formatTRY(item.price)}</span>
            {inCart && (
              <span style={{
                width: 20, height: 20, borderRadius: 999, flexShrink: 0,
                background: 'var(--p-cta)', color: 'var(--p-cta-text)',
                fontSize: 11, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{cartQuantity}</span>
            )}
          </div>
          {theme.cardShowDesc && item.description && (
            <div style={{ fontSize: 11.5, color: 'var(--p-text-2)', marginTop: 2 }}>{item.description}</div>
          )}
          <FoodMeta item={item} />
        </div>
      </div>
    )
  }

  return (
    <div
      id={`product-${item.id}`}
      data-component="card"
      data-image-state={hasProductImage ? 'available' : 'missing'}
      style={{ ...cardBase, display: 'flex', flexDirection: horizontal ? 'row' : 'column' }}
      {...hoverProps}
    >
      <CardOpenButton itemName={item.name} onOpen={() => onOpen(item)} radius={theme.radius} />
      {mediaVisible && <div style={{
        ...(horizontal ? { width: theme.cardHorizontalImageWidth ?? 92, flexShrink: 0 } : { aspectRatio: aspect, width: '100%' }),
        background: theme.cardPlaceholderStyle === 'accent'
          ? 'var(--p-accent-soft)'
          : theme.cardPlaceholderStyle === 'outline'
            ? 'transparent'
            : 'linear-gradient(135deg, #f3f4f6 0%, #e6e7eb 100%)',
        borderBottom: theme.cardPlaceholderStyle === 'outline' && !horizontal ? '1px dashed var(--p-border)' : undefined,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#bfc1c6', position: 'relative', overflow: 'hidden',
      }}>
        {hasProductImage ? (
          <img
            src={imageUrl} alt={item.name}
            loading={imagePriority ? 'eager' : 'lazy'}
            fetchPriority={imagePriority ? 'high' : 'auto'}
            decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: theme.cardImageFit ?? 'cover', objectPosition: theme.cardImagePosition ?? 'center' }}
          />
        ) : (
          <ImagePlaceholderIcon />
        )}
        {theme.cardShowTag && hasModifiers && (
          <span style={{
            position: 'absolute', top: 8, left: 8,
            background: 'var(--p-card)', color: 'var(--p-accent)',
            fontSize: narrow ? 9 : 10, fontWeight: 700, letterSpacing: '.02em',
            padding: narrow ? '2px 5px' : '3px 7px', borderRadius: 999,
            boxShadow: '0 1px 3px rgba(0,0,0,.08)',
          }}>Seçenekler</span>
        )}
        {inCart && (
          <div style={{
            position: 'absolute', top: 6, right: 6, zIndex: 2,
            width: 20, height: 20, borderRadius: 999,
            background: 'var(--p-cta)', color: 'var(--p-cta-text)',
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{cartQuantity}</div>
        )}
      </div>}
      <div style={{ padding: contentPadding, display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        {!mediaVisible && theme.cardShowTag && hasModifiers && (
          <span style={{
            alignSelf: 'flex-start', marginBottom: 7,
            background: 'var(--p-accent-soft)', color: 'var(--p-accent)',
            fontSize: narrow ? 9 : 10, fontWeight: 700, letterSpacing: '.02em',
            padding: narrow ? '2px 5px' : '3px 7px', borderRadius: 999,
          }}>Seçenekler</span>
        )}
        <div style={{
          fontWeight: 700, color: nameColor, fontSize: nameFontSize, lineHeight: 1.2,
          overflow: 'hidden',
          display: '-webkit-box' as React.CSSProperties['display'],
          WebkitLineClamp: narrow ? 1 : titleLines,
          WebkitBoxOrient: 'vertical',
        } as React.CSSProperties}>{item.name}</div>
        {!narrow && theme.cardShowDesc && item.description && (
          <div style={{ fontSize: 11.5, color: 'var(--p-text-2)', marginTop: 3, flex: 1, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: descriptionLines }}>
            {item.description}
          </div>
        )}
        <FoodMeta item={item} />
        <ProductCTA
          item={item}
          ctaStyle={theme.cardCtaStyle}
          narrow={narrow}
          cartQuantity={cartQuantity}
          onQuickAdd={() => onQuickAdd(item)}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
          hidePrice={false}
          priceAlign={theme.cardPriceAlign ?? 'left'}
          iconKind={theme.cardCtaIcon ?? 'plus'}
        />
      </div>
    </div>
  )
}

function ProductCTA({ item, ctaStyle, narrow, cartQuantity = 0, onQuickAdd, onIncrement, onDecrement, hidePrice = false, priceAlign = 'left', iconKind = 'plus' }: {
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
}) {
  const inCart = cartQuantity > 0
  const btnSz = 44

  const stepper = (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: narrow ? 3 : 5,
        background: 'var(--p-cta)', borderRadius: 999,
        padding: narrow ? '2px 4px' : '3px 5px',
        flexShrink: 0, position: 'relative', zIndex: 2,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={`${item.name} adedini azalt`}
        onClick={(e) => { e.stopPropagation(); onDecrement?.() }}
        style={{
          width: btnSz, height: btnSz, border: 'none',
          background: 'rgba(0,0,0,0.15)', borderRadius: '50%',
          color: 'var(--p-cta-text)', fontSize: narrow ? 13 : 15,
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 0, lineHeight: 1,
        }}
      >−</button>
      <span style={{
        color: 'var(--p-cta-text)', fontSize: narrow ? 11 : 13, fontWeight: 700,
        minWidth: narrow ? 12 : 16, textAlign: 'center',
      }}>{cartQuantity}</span>
      <button
        type="button"
        disabled={cartQuantity >= 99}
        aria-label={`${item.name} adedini artır`}
        onClick={(e) => { e.stopPropagation(); onIncrement?.() }}
        style={{
          width: btnSz, height: btnSz, border: 'none',
          background: 'rgba(0,0,0,0.15)', borderRadius: '50%',
          color: 'var(--p-cta-text)', fontSize: narrow ? 13 : 15,
          cursor: cartQuantity >= 99 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 0, lineHeight: 1,
          opacity: cartQuantity >= 99 ? 0.5 : 1,
        }}
      >+</button>
    </div>
  )

  if (ctaStyle === 'full') {
    return (
      <div style={{ marginTop: 'auto', paddingTop: 10, position: 'relative', zIndex: 2 }}>
        {inCart ? (
          <div style={{ display: 'flex', flexDirection: priceAlign === 'right' ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
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
            <button type="button" style={{
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
      <div style={{ display: 'flex', flexDirection: priceAlign === 'right' ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 10, gap: 4, position: 'relative', zIndex: 2 }}>
        {!hidePrice && (
          <span style={{
            fontWeight: 700, fontSize: 13, color: 'var(--p-text)',
            textAlign: priceAlign,
            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{formatTRY(item.price)}</span>
        )}
        {inCart ? stepper : (
          <button type="button" style={{
            background: 'var(--p-cta)', color: 'var(--p-cta-text)', border: 'none',
            minWidth: 44, minHeight: 44, padding: narrow ? '3px 8px' : '4px 11px',
            borderRadius: 999, cursor: 'pointer',
            fontSize: narrow ? 11 : 11.5, fontWeight: 600,
            flexShrink: 0,
          }} aria-label={`${item.name} sepete ekle`} onClick={(e) => { e.stopPropagation(); onQuickAdd?.() }}>{narrow ? '+' : 'Ekle'}</button>
        )}
      </div>
    )
  }

  // icon (default)
  return (
    <div style={{ display: 'flex', flexDirection: priceAlign === 'right' ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: hidePrice ? 'flex-end' : 'space-between', marginTop: 'auto', paddingTop: 10, gap: 4, position: 'relative', zIndex: 2 }}>
      {!hidePrice && (
        <span style={{
          fontWeight: 700, fontSize: 13, color: 'var(--p-text)',
          textAlign: priceAlign,
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{formatTRY(item.price)}</span>
      )}
      {inCart ? stepper : (
        <button type="button" style={{
          width: 44, height: 44, borderRadius: 999, border: 'none',
          background: 'var(--p-cta)', color: 'var(--p-cta-text)', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(15,17,21,.16)',
          flexShrink: 0,
        }} aria-label={`${item.name} sepete ekle`} onClick={(e) => { e.stopPropagation(); onQuickAdd?.() }}>
          <CardCtaIcon kind={iconKind} />
        </button>
      )}
    </div>
  )
}

function CardOpenButton({ itemName, onOpen, radius }: { itemName: string; onOpen: () => void; radius: number }) {
  return (
    <button
      type="button"
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
