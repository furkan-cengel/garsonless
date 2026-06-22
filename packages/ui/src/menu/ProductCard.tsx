'use client'

import type { MenuItem } from './types'
import { useTheme } from './ThemeContext'
import { formatTRY } from './formatCurrency'

interface ProductCardProps {
  item: MenuItem
  onOpen: (item: MenuItem) => void
  onQuickAdd: (item: MenuItem) => void
  cols?: number
  cartQuantity?: number
  onIncrement?: () => void
  onDecrement?: () => void
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

export function ProductCard({ item, onOpen, onQuickAdd, cols, cartQuantity = 0, onIncrement, onDecrement }: ProductCardProps) {
  const { theme } = useTheme()
  const effectiveCols = cols ?? theme.cols
  const narrow = effectiveCols >= 3
  const horizontal = !narrow && theme.cardLayout === 'horizontal'
  const minimal = theme.cardLayout === 'minimal'
  const spainList = horizontal && theme.bodyFont === 'Hanken Grotesk'
  const aspect = narrow ? '1/1' : (ASPECT_MAP[theme.cardImageAspect] ?? '4/3')
  const shadow = SHADOW_MAP[theme.shadow] ?? SHADOW_MAP.soft
  const hasModifiers = item.modifier_groups.length > 0
  const inCart = cartQuantity > 0
  const nameColor = 'var(--p-accent)'
  const nameFontSize = 13.5

  const cardBase: React.CSSProperties = {
    background: spainList ? 'var(--p-accent-soft)' : 'var(--p-card)',
    borderRadius: `${theme.radius}px`,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'box-shadow 150ms ease',
    boxShadow: inCart ? `${shadow}, 0 0 0 2px var(--p-cta)` : shadow,
    border: theme.border === 'none' ? 'none' : `var(--p-border-w) solid var(--p-border)`,
  }

  const interactiveProps = {
    onClick: () => onOpen(item),
    role: 'button' as const,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      onOpen(item)
    },
  }

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    onQuickAdd(item)
  }

  if (minimal) {
    return (
      <div
        id={`product-${item.id}`}
        data-component="card"
        style={{ ...cardBase, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}
        {...interactiveProps}
      >
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
                background: 'var(--p-cta)', color: '#fff',
                fontSize: 11, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{cartQuantity}</span>
            )}
          </div>
          {theme.cardShowDesc && item.description && (
            <div style={{ fontSize: 11.5, color: 'var(--p-text-2)', marginTop: 2 }}>{item.description}</div>
          )}
        </div>
      </div>
    )
  }

  if (spainList) {
    return (
      <div
        id={`product-${item.id}`}
        data-component="card"
        style={{
          ...cardBase,
          minHeight: 132,
          display: 'flex',
          flexDirection: 'row',
          transition: 'transform 120ms ease',
        }}
        {...interactiveProps}
      >
        <div style={{
          width: 128,
          flexShrink: 0,
          background: 'linear-gradient(135deg, #ddd9d5 0%, #e6e2dd 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#747878',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {item.images[0] ? (
            <img
              src={item.images[0]}
              alt={item.name}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <ImagePlaceholderIcon />
          )}
          {theme.cardShowTag && hasModifiers && (
            <span style={{
              position: 'absolute',
              top: 8,
              left: 8,
              borderRadius: 999,
              background: 'rgba(255,255,255,.82)',
              color: '#1c1c19',
              padding: '4px 8px',
              fontSize: 10,
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              Chef
            </span>
          )}
        </div>
        <div style={{
          padding: 12,
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <h4 style={{
                margin: 0,
                fontSize: 20,
                lineHeight: '28px',
                fontWeight: 600,
                color: '#1c1c19',
                minWidth: 0,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {item.name}
              </h4>
              <span style={{
                color: '#1c1c19',
                fontSize: 18,
                lineHeight: '26px',
                fontWeight: 400,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {formatTRY(item.price)}
              </span>
            </div>
            {theme.cardShowDesc && item.description && (
              <p style={{
                margin: '8px 0 0',
                color: '#444748',
                fontSize: 14,
                lineHeight: '20px',
                letterSpacing: '0.05em',
                fontWeight: 500,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {item.description}
              </p>
            )}
          </div>
          <div
            style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            {inCart ? (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDecrement?.() }}
                  style={spainCircleButton(false)}
                >
                  −
                </button>
                <span style={{ fontSize: 16, lineHeight: '24px', fontWeight: 700, color: '#1c1c19' }}>
                  {cartQuantity}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onIncrement?.() }}
                  style={spainCircleButton(true)}
                >
                  +
                </button>
              </>
            ) : theme.cardCtaStyle === 'icon' ? (
              <button
                type="button"
                onClick={handleQuickAdd}
                style={spainCircleButton(true)}
              >
                +
              </button>
            ) : theme.cardCtaStyle === 'full' ? (
              <button
                type="button"
                onClick={handleQuickAdd}
                style={{
                  height: 32,
                  border: 'none',
                  borderRadius: 8,
                  background: 'var(--p-cta)',
                  color: '#fff',
                  padding: '0 18px',
                  fontSize: 14,
                  lineHeight: '20px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Add to order
              </button>
            ) : (
              <button
                type="button"
                onClick={handleQuickAdd}
                style={{
                  minWidth: 74,
                  height: 32,
                  border: 'none',
                  borderRadius: 999,
                  background: 'var(--p-cta)',
                  color: '#fff',
                  padding: '0 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  fontSize: 14,
                  lineHeight: '20px',
                  letterSpacing: '0.05em',
                  fontWeight: 650,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
                Add
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      id={`product-${item.id}`}
      data-component="card"
      style={{ ...cardBase, display: 'flex', flexDirection: horizontal ? 'row' : 'column' }}
      {...interactiveProps}
    >
      <div style={{
        ...(horizontal ? { width: spainList ? 128 : 92, minHeight: spainList ? 132 : undefined, flexShrink: 0 } : { aspectRatio: aspect, width: '100%' }),
        background: 'linear-gradient(135deg, #f3f4f6 0%, #e6e7eb 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#bfc1c6', position: 'relative', overflow: 'hidden',
      }}>
        {item.images[0] ? (
          <img
            src={item.images[0]} alt={item.name}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
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
            background: 'var(--p-cta)', color: '#fff',
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{cartQuantity}</div>
        )}
      </div>
      <div style={{ padding: spainList ? 12 : narrow ? '8px 8px 10px' : '10px 12px 12px', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: spainList ? 600 : 700, color: nameColor, fontSize: spainList ? 20 : nameFontSize, lineHeight: spainList ? '28px' : 1.2,
          overflow: 'hidden',
          display: '-webkit-box' as React.CSSProperties['display'],
          WebkitLineClamp: narrow ? 1 : 2,
          WebkitBoxOrient: 'vertical',
        } as React.CSSProperties}>{item.name}</div>
        {!narrow && theme.cardShowDesc && item.description && (
          <div style={{ fontSize: spainList ? 14 : 11.5, color: 'var(--p-text-2)', marginTop: spainList ? 8 : 3, flex: 1, lineHeight: spainList ? '20px' : 1.35 }}>
            {item.description}
          </div>
        )}
        <ProductCTA
          item={item}
          ctaStyle={theme.cardCtaStyle}
          narrow={narrow}
          cartQuantity={cartQuantity}
          onQuickAdd={() => onQuickAdd(item)}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
          hidePrice={false}
        />
      </div>
    </div>
  )
}

function ProductCTA({ item, ctaStyle, narrow, cartQuantity = 0, onQuickAdd, onIncrement, onDecrement, hidePrice = false }: {
  item: MenuItem
  ctaStyle: string
  narrow: boolean
  cartQuantity?: number
  onQuickAdd?: (() => void) | undefined
  onIncrement?: (() => void) | undefined
  onDecrement?: (() => void) | undefined
  hidePrice?: boolean
}) {
  const inCart = cartQuantity > 0
  const btnSz = narrow ? 18 : 22

  const stepper = (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: narrow ? 3 : 5,
        background: 'var(--p-cta)', borderRadius: 999,
        padding: narrow ? '2px 4px' : '3px 5px',
        flexShrink: 0,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDecrement?.() }}
        style={{
          width: btnSz, height: btnSz, border: 'none',
          background: 'rgba(0,0,0,0.15)', borderRadius: '50%',
          color: '#fff', fontSize: narrow ? 13 : 15,
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 0, lineHeight: 1,
        }}
      >−</button>
      <span style={{
        color: '#fff', fontSize: narrow ? 11 : 13, fontWeight: 700,
        minWidth: narrow ? 12 : 16, textAlign: 'center',
      }}>{cartQuantity}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onIncrement?.() }}
        style={{
          width: btnSz, height: btnSz, border: 'none',
          background: 'rgba(0,0,0,0.15)', borderRadius: '50%',
          color: '#fff', fontSize: narrow ? 13 : 15,
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 0, lineHeight: 1,
        }}
      >+</button>
    </div>
  )

  if (ctaStyle === 'full') {
    return (
      <div style={{ marginTop: 10 }}>
        {inCart ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            {!hidePrice && (
              <span style={{
                fontWeight: 700, fontSize: 13, color: 'var(--p-text)',
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
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{formatTRY(item.price)}</span>
            )}
            <button style={{
              background: 'var(--p-cta)', color: '#fff', border: 'none',
              padding: '7px 0', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, width: '100%',
            }} onClick={(e) => { e.stopPropagation(); onQuickAdd?.() }}>Sepete ekle</button>
          </>
        )}
      </div>
    )
  }

  if (ctaStyle === 'pill') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 4 }}>
        {!hidePrice && (
          <span style={{
            fontWeight: 700, fontSize: 13, color: 'var(--p-text)',
            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{formatTRY(item.price)}</span>
        )}
        {inCart ? stepper : (
          <button style={{
            background: 'var(--p-cta)', color: '#fff', border: 'none',
            padding: narrow ? '3px 8px' : '4px 11px',
            borderRadius: 999, cursor: 'pointer',
            fontSize: narrow ? 11 : 11.5, fontWeight: 600,
            flexShrink: 0,
          }} onClick={(e) => { e.stopPropagation(); onQuickAdd?.() }}>{narrow ? '+' : 'Ekle'}</button>
        )}
      </div>
    )
  }

  // icon (default)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: hidePrice ? 'flex-end' : 'space-between', marginTop: 10, gap: 4 }}>
      {!hidePrice && (
        <span style={{
          fontWeight: 700, fontSize: 13, color: 'var(--p-text)',
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{formatTRY(item.price)}</span>
      )}
      {inCart ? stepper : (
        <button style={{
          width: 28, height: 28, borderRadius: 999, border: 'none',
          background: 'var(--p-cta)', color: '#fff', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(15,17,21,.16)',
          flexShrink: 0,
        }} onClick={(e) => { e.stopPropagation(); onQuickAdd?.() }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
    </div>
  )
}

function spainCircleButton(filled: boolean): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: filled ? 'none' : '1px solid #c4c7c7',
    background: filled ? 'var(--p-cta)' : 'transparent',
    color: filled ? '#fff' : '#444748',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    lineHeight: 1,
    cursor: 'pointer',
    padding: 0,
  }
}

function ImagePlaceholderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.7" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
    </svg>
  )
}
