'use client'

import { CartIconSvg, formatTRY, useTheme } from '@garsonless/ui'
import { resolveMenuActionPlacements } from '@garsonless/design-engine/menu-action-placement'
import { useCartStore } from '../../../lib/store/useCartStore'

export default function FloatingCartTrigger({ onClick }: { onClick: () => void }) {
  const { theme } = useTheme()
  const cartItems = useCartStore((state) => state.items)
  const count = cartItems.reduce((total, item) => total + item.quantity, 0)
  const subtotal = cartItems.reduce(
    (total, item) => total + (item.price + item.modifiersPriceDelta) * item.quantity,
    0,
  )
  const configuredStyle = theme.cartFooterTriggerStyle
    ?? (theme.cartStyle === 'banner' ? 'bar' : theme.cartStyle === 'fab' ? 'fab' : 'pill')
  const style = configuredStyle === 'tabbar' ? 'pill' : configuredStyle
  if (resolveMenuActionPlacements(theme).cart !== 'footer' || count === 0 || style === 'none') return null

  const showBadge = theme.cartShowBadge
  const showSubtotal = theme.cartShowSubtotal ?? true
  const badge = showBadge ? (
    <span style={BADGE_STYLE}>{count > 99 ? '99+' : count}</span>
  ) : null

  if (style === 'fab') {
    return (
      <button type="button" aria-label={`Sepeti aç, ${count} ürün`} onClick={onClick} style={FAB_STYLE}>
        <CartIconSvg kind={theme.cartIcon} color="#fff" size={24} />
        {badge}
      </button>
    )
  }

  if (style === 'thumbs') {
    return (
      <div style={THUMBS_WRAP_STYLE}>
        <button type="button" aria-label={`Sepeti aç, ${count} ürün`} onClick={onClick} style={THUMBS_BUTTON_STYLE}>
          <span style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            {cartItems.slice(0, 3).map((item, index) => (
              <span key={`${item.cartId}-${index}`} style={{ ...THUMB_STYLE, marginLeft: index ? -12 : 0, zIndex: 4 - index }}>
                {item.name.slice(0, 1).toLocaleUpperCase('tr')}
              </span>
            ))}
            <span style={{ marginLeft: 10, color: '#fff', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{count} ürün</span>
          </span>
          <span style={THUMBS_TOTAL_STYLE}>{showSubtotal ? formatTRY(subtotal) : theme.cartButtonText || 'Aç'} →</span>
        </button>
      </div>
    )
  }

  if (style === 'bar') {
    return (
      <div style={BAR_WRAP_STYLE}>
        <button type="button" aria-label={`Sepeti aç, ${count} ürün`} onClick={onClick} style={BAR_BUTTON_STYLE}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}><CartIconSvg kind={theme.cartIcon} color="#fff" size={22} />{badge}</span>
            <span style={ELLIPSIS_STYLE}>{theme.cartButtonText || 'Sepeti gör'}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            {showSubtotal && <span style={{ fontSize: 16, fontWeight: 900 }}>{formatTRY(subtotal)}</span>}
            <span style={BAR_ARROW_STYLE}>→</span>
          </span>
        </button>
      </div>
    )
  }

  const tone = PILL_TONES[theme.cartPillTone ?? 'dark']
  const edge = theme.cartPillPosition === 'edge'
  return (
    <button
      type="button"
      aria-label={`Sepeti aç, ${count} ürün`}
      onClick={onClick}
      style={{
        ...PILL_STYLE,
        bottom: edge ? 0 : 20,
        left: edge ? 0 : 16,
        right: edge ? 0 : 16,
        maxWidth: edge ? 'none' : 430,
        margin: edge ? 0 : '0 auto',
        minHeight: edge ? 72 : 66,
        padding: edge ? '14px 18px 18px' : '12px 14px',
        background: tone.background,
        color: tone.foreground,
        border: `1px solid ${tone.border}`,
        borderRadius: edge ? `${Math.max(theme.radius + 6, 18)}px ${Math.max(theme.radius + 6, 18)}px 0 0` : Math.max(theme.radius + 8, 18),
        boxShadow: tone.shadow,
      }}
    >
      <span style={{ ...PILL_ICON_STYLE, background: tone.chipBg, color: tone.chipFg }}>
        <CartIconSvg kind={theme.cartIcon} color="currentColor" size={22} />{badge}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
        <span style={ELLIPSIS_STYLE}>{theme.cartButtonText || 'Sepeti gör'}</span>
        {(theme.cartShowItemCount ?? true) && <span style={{ ...ELLIPSIS_STYLE, fontSize: 11.5, fontWeight: 500, color: tone.muted }}>{count} ürün sepette</span>}
      </span>
      {showSubtotal && <span style={{ ...ELLIPSIS_STYLE, flexShrink: 0, fontWeight: 800, fontSize: 16, maxWidth: 116 }}>{formatTRY(subtotal)}</span>}
    </button>
  )
}

const BADGE_STYLE: React.CSSProperties = { position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, fontSize: 10, fontWeight: 900, backgroundColor: 'var(--p-cta)', color: 'var(--p-cta-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }
const FAB_STYLE: React.CSSProperties = { position: 'fixed', bottom: 'calc(24px + env(safe-area-inset-bottom))', right: 20, width: 60, height: 60, borderRadius: '50%', backgroundColor: 'var(--p-accent)', color: '#fff', border: 'none', cursor: 'pointer', zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 14px 30px -10px rgba(46,125,82,.55)' }
const THUMBS_WRAP_STYLE: React.CSSProperties = { position: 'fixed', left: 14, right: 14, bottom: 18, zIndex: 30, maxWidth: 430, margin: '0 auto' }
const THUMBS_BUTTON_STYLE: React.CSSProperties = { width: '100%', minHeight: 58, borderRadius: 999, border: 'none', background: 'var(--p-text)', color: 'var(--p-cta-text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '0 8px 0 10px', fontFamily: 'var(--p-body)', boxShadow: '0 16px 34px -12px rgba(15,23,42,.48)', cursor: 'pointer' }
const THUMB_STYLE: React.CSSProperties = { width: 34, height: 34, borderRadius: 999, background: '#fff', color: 'var(--p-accent)', border: '2px solid var(--p-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900 }
const THUMBS_TOTAL_STYLE: React.CSSProperties = { height: 40, padding: '0 15px', borderRadius: 999, background: 'var(--p-cta)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap' }
const BAR_WRAP_STYLE: React.CSSProperties = { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, maxWidth: 430, margin: '0 auto', padding: '12px 12px 14px', background: 'linear-gradient(to top, var(--p-bg) 68%, rgba(255,255,255,0))' }
const BAR_BUTTON_STYLE: React.CSSProperties = { width: '100%', minHeight: 58, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '0 8px 0 16px', background: 'var(--p-accent)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', boxShadow: '0 14px 28px -10px rgba(46,125,82,.48)', cursor: 'pointer', fontFamily: 'var(--p-body)' }
const BAR_ARROW_STYLE: React.CSSProperties = { width: 38, height: 42, borderRadius: 12, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center', fontSize: 18 }
const ELLIPSIS_STYLE: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const PILL_STYLE: React.CSSProperties = { position: 'fixed', display: 'flex', alignItems: 'center', gap: 12, fontWeight: 650, fontSize: 15, cursor: 'pointer', zIndex: 30, fontFamily: 'var(--p-body)', overflow: 'hidden' }
const PILL_ICON_STYLE: React.CSSProperties = { position: 'relative', flexShrink: 0, width: 42, height: 42, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const PILL_TONES = {
  dark: { background: 'var(--p-text)', foreground: '#fff', muted: 'rgba(255,255,255,.72)', chipBg: 'rgba(255,255,255,.12)', chipFg: '#fff', border: 'rgba(255,255,255,.08)', shadow: '0 18px 42px rgba(15,23,42,.24)' },
  accent: { background: 'linear-gradient(135deg, var(--p-accent), var(--p-cta))', foreground: '#fff', muted: 'rgba(255,255,255,.78)', chipBg: 'rgba(255,255,255,.16)', chipFg: '#fff', border: 'rgba(255,255,255,.14)', shadow: '0 18px 42px rgba(46,125,82,.28)' },
  light: { background: '#fff', foreground: 'var(--p-text)', muted: 'var(--p-text-2)', chipBg: 'var(--p-accent-soft)', chipFg: 'var(--p-accent)', border: 'var(--p-border, rgba(0,0,0,.08))', shadow: '0 18px 42px rgba(15,23,42,.14)' },
} as const
