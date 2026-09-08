'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { CartItem } from './types'
import { useTheme } from './ThemeContext'
import { formatTRY } from './formatCurrency'
import { AppIcons as I } from '../icons'

export interface CartPointsRedeem {
  balance: number       // points balance
  rate: number          // points needed for ₺1
  redeemTl: number      // currently requested ₺ discount (controlled)
  onChange: (redeemTl: number) => void
}

export interface CartDiscountPreview {
  subtotal: number
  memberDiscountAmount: number
  memberDiscountPct: number
  memberTierName?: string | null
  pointsDiscountAmount: number
  stampDiscountAmount: number
  rewardItemName: string | null
  catalogDiscountAmount: number
  catalogItemName: string | null
  couponCode?: string | null
  couponName?: string | null
  couponDiscountAmount?: number
  couponStackingPolicy?: 'exclusive' | 'combine_loyalty' | null
  finalTotal: number
  loyaltySuppressedByPromotion?: boolean
}

export interface CartStampReward {
  cardFull: boolean        // stamps >= goal
  rewardName: string | null
  rewardInCart: boolean
  claimed: boolean         // current toggle state
  onToggle: (v: boolean) => void
}

export interface CartCatalogReward {
  itemName: string         // the claimed catalog reward item
  pointCost: number        // points it costs
  onClear: () => void      // cancel the catalog claim
}

export interface CartCouponControl {
  draft: string
  appliedCode: string | null
  appliedName: string | null
  discountAmount: number
  error: string | null
  pending: boolean
  blocksCheckout: boolean
  onDraftChange: (value: string) => void
  onApply: () => void
  onRemove: () => void
}

interface CartDrawerProps {
  isOpen: boolean
  items: CartItem[]
  isPlacing: boolean
  orderError?: string | null
  onClose: () => void
  onUpdateQuantity: (cartId: string, quantity: number) => void
  onRemoveItem: (cartId: string) => void
  onChangeFreebieReward?: (cartId: string) => void
  onPlaceOrder: () => void
  canCheckout?: boolean
  checkoutUnavailableReason?: string
  onPay?: () => void
  onSplitBill?: () => void
  billSummary?: { total: number; count: number } | null
  onOpenBill?: (() => void) | undefined
  /** Member points redemption (preview); null for guests / points disabled. */
  pointsRedeem?: CartPointsRedeem | null
  /** Stamp → free item claim (3c); null when not a member / stamps disabled. */
  stampReward?: CartStampReward | null
  /** Active catalog reward claim (15c); null when none. Hides the points slider. */
  catalogReward?: CartCatalogReward | null
  discountPreview?: CartDiscountPreview | null
  coupon?: CartCouponControl | null
  /** Fallback used when the opening control unmounts while the dialog is open. */
  returnFocusSelector?: string
}

export function CartDrawer({
  isOpen,
  items,
  isPlacing,
  orderError = null,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onChangeFreebieReward,
  onPlaceOrder,
  canCheckout = true,
  checkoutUnavailableReason,
  onPay,
  onSplitBill,
  billSummary,
  onOpenBill,
  pointsRedeem = null,
  stampReward = null,
  catalogReward = null,
  discountPreview = null,
  coupon = null,
  returnFocusSelector,
}: CartDrawerProps) {
  const visibleItems = items.filter((i) => i.quantity > 0)
  const total = visibleItems.reduce((sum, i) => sum + (i.price + i.modifiersPriceDelta) * i.quantity, 0)
  // Max ₺ redeemable: limited by points balance value and the bill itself.
  const maxRedeemTl = pointsRedeem
    ? Math.max(0, Math.min(Math.floor(pointsRedeem.balance / pointsRedeem.rate), Math.floor(total)))
    : 0
  const memberDiscount = discountPreview?.memberDiscountAmount ?? 0
  const memberPct = discountPreview?.memberDiscountPct ?? 0
  const memberTierName = discountPreview?.memberTierName ?? null
  const pointsDiscount = discountPreview?.pointsDiscountAmount ?? 0
  const stampDiscount = discountPreview?.stampDiscountAmount ?? 0
  const catalogDiscount = discountPreview?.catalogDiscountAmount ?? 0
  const couponDiscount = discountPreview?.couponDiscountAmount ?? coupon?.discountAmount ?? 0
  const exclusiveCouponApplied = Boolean(
    coupon?.appliedCode
    && !coupon.error
    && couponDiscount > 0
    && discountPreview?.couponStackingPolicy === 'exclusive',
  )
  const catalogName = discountPreview?.catalogItemName ?? catalogReward?.itemName ?? 'ürün'
  const rewardName = discountPreview?.rewardItemName ?? stampReward?.rewardName ?? 'ürün'
  const hasDiscount = stampDiscount > 0 || catalogDiscount > 0 || couponDiscount > 0 || memberDiscount > 0 || pointsDiscount > 0
  const displayTotal = discountPreview ? discountPreview.finalTotal : total
  const loyaltySuppressedByPromotion = discountPreview?.loyaltySuppressedByPromotion ?? false
  const { theme } = useTheme()
  const checkoutTheme = theme.surfaces?.checkout
  const checkoutOverride = checkoutTheme?.override ?? {}
  const radius = checkoutOverride.radius ?? theme.radius
  const showSubtotal = theme.cartShowSubtotal ?? true
  const showItemCount = theme.cartShowItemCount ?? true
  const primaryActionText = theme.cartPrimaryActionText || 'Sipariş ver'
  const checkoutPreset = checkoutTheme?.preset ?? (theme.cartDrawerTone === 'accentHeader' ? 'brand-header' : 'clean')
  const checkoutSheetSize = checkoutTheme?.sheetSize ?? 'standard'
  const checkoutSheetMaxWidth = checkoutSheetSize === 'compact' ? 400 : checkoutSheetSize === 'large' ? 680 : 520
  const checkoutSheetMaxHeight = checkoutSheetSize === 'compact' ? '76dvh' : checkoutSheetSize === 'large' ? '94dvh' : '88dvh'
  const headerIsAccent = checkoutPreset === 'brand-header'
  const checkoutVars = {
    '--p-bg': checkoutOverride.background ?? theme.bg,
    '--p-card': checkoutOverride.surface ?? theme.cardColor ?? '#ffffff',
    '--p-text': checkoutOverride.text ?? theme.textColor ?? '#1c1d20',
    '--p-text-2': checkoutOverride.mutedText ?? theme.mutedTextColor ?? '#6c6f76',
    '--p-accent': checkoutOverride.accent ?? theme.accent,
    '--p-accent-soft': checkoutOverride.accentSoft ?? theme.accentSoft,
    '--p-cta': checkoutOverride.cta ?? theme.cta,
    '--p-cta-text': checkoutOverride.ctaText ?? theme.ctaTextColor ?? '#ffffff',
    '--p-border': checkoutOverride.fieldBorder ?? theme.borderColor ?? '#e3e4e7',
    '--p-body': checkoutOverride.bodyFont ?? theme.bodyFont,
  } satisfies Record<`--${string}`, string>
  const itemCount = visibleItems.reduce((sum, i) => sum + i.quantity, 0)
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const [quantityAnnouncement, setQuantityAnnouncement] = useState('')
  const prefersReducedMotion = useReducedMotion()

  const updateQuantity = (item: CartItem, quantity: number) => {
    onUpdateQuantity(item.cartId, quantity)
    setQuantityAnnouncement(quantity > 0
      ? `${item.name} adedi ${quantity} oldu.`
      : `${item.name} sepetten çıkarıldı.`)
  }

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const drawer = drawerRef.current
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return }
      if (event.key !== 'Tab' || !drawer) return
      const focusable = [...drawer.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      if (focusable.length === 0) { event.preventDefault(); drawer.focus(); return }
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      const target = returnFocusRef.current
      const targetBelongsToClosingDialog = Boolean(target?.closest('[role="dialog"]'))
      if (target?.isConnected && !targetBelongsToClosingDialog) target.focus()
      else {
        const fallback = returnFocusSelector
          ? document.querySelector<HTMLElement>(returnFocusSelector)
          : null
        ;(fallback
          ?? document.querySelector<HTMLElement>('[aria-label^="Sepeti aç"]')
          ?? document.querySelector<HTMLElement>('[aria-controls="menu-nav-drawer"]'))?.focus()
      }
    }
  }, [isOpen, returnFocusSelector])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            aria-hidden="true"
            style={{ position: 'fixed', inset: 0, zIndex: 40, backgroundColor: 'rgba(15,23,42,0.42)', backdropFilter: 'blur(2px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.16 }}
            onClick={onClose}
          />

          <motion.div
            key="drawer"
            ref={drawerRef}
            data-component="cart"
            data-checkout-preset={checkoutPreset}
            data-checkout-sheet-size={checkoutSheetSize}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            tabIndex={-1}
            style={{
              ...checkoutVars,
              background: 'var(--p-bg)',
              color: 'var(--p-text)',
              borderRadius: `${Math.max(radius + 14, 24)}px ${Math.max(radius + 14, 24)}px 0 0`,
              boxShadow: '0 -24px 70px rgba(15,23,42,0.26)',
              position: 'fixed',
              left: 0, right: 0, bottom: 0,
              width: '100%',
              maxWidth: checkoutSheetMaxWidth,
              maxHeight: checkoutSheetMaxHeight,
              margin: '0 auto',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid var(--p-border)',
              overflow: 'hidden',
              fontFamily: 'var(--p-body)',
              lineHeight: 'var(--p-line-body)',
            }}
            variants={{ hidden: { y: '100%' }, visible: { y: 0 } }}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div role="status" aria-live="polite" aria-atomic="true" style={VISUALLY_HIDDEN_STYLE}>{quantityAnnouncement}</div>
            <div style={{
              background: headerIsAccent ? 'var(--p-cta)' : 'var(--p-card)',
              color: headerIsAccent ? 'var(--p-cta-text)' : 'var(--p-text)',
              padding: '12px 18px 14px',
              borderBottom: headerIsAccent ? 'none' : '1px solid rgba(15,23,42,.08)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 10 }}>
                <div style={{ height: 4, width: 42, borderRadius: 9999, backgroundColor: headerIsAccent ? 'color-mix(in srgb, currentColor 48%, transparent)' : 'rgba(15,23,42,.16)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <h2 id="cart-drawer-title" style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'inherit', letterSpacing: '-0.01em' }}>Sepetiniz</h2>
                  {showItemCount && (
                    <p aria-live="polite" style={{ fontSize: 12, margin: '3px 0 0', color: headerIsAccent ? 'color-mix(in srgb, currentColor 78%, transparent)' : 'var(--p-text-2)' }}>
                      {itemCount > 0 ? `${itemCount} ürün siparişe hazır` : theme.cartEmptyText || 'Sepetiniz boş'}
                    </p>
                  )}
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Sepeti kapat"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    color: 'inherit',
                    background: headerIsAccent ? 'color-mix(in srgb, currentColor 16%, transparent)' : 'var(--p-accent-soft)',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg aria-hidden="true" width={18} height={18} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div
              data-component="cart-scroll-region"
              role="region"
              aria-label="Sepet içeriği"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                scrollbarGutter: 'stable',
              }}
            >
            {billSummary && billSummary.count > 0 && onOpenBill && (
              <button
                type="button"
                onClick={onOpenBill}
                style={{
                  margin: '10px 14px 0', minHeight: 44, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--p-accent-soft)', border: 'none', borderRadius: 12,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--p-accent)' }}>
                  Masa hesabı · {billSummary.count} sipariş
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--p-accent)' }}>
                  {formatTRY(billSummary.total)} →
                </span>
              </button>
            )}

            <div data-component="cart-items-region" style={{ padding: visibleItems.length === 0 ? 0 : '12px 14px' }}>
              {visibleItems.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, gap: 12, padding: 24 }}>
                  <span style={{
                    width: 64,
                    height: 64,
                    borderRadius: 22,
                    background: 'var(--p-accent-soft)',
                    color: 'var(--p-accent)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 30,
                    boxShadow: '0 14px 34px rgba(15,23,42,.08)',
                  }}><I.cart size={29} strokeWidth={1.8} /></span>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 15, fontWeight: 750, margin: 0, color: 'var(--p-text)' }}>{theme.cartEmptyText || 'Sepetiniz boş'}</p>
                    <p style={{ fontSize: 12, margin: '5px 0 0', color: 'var(--p-text-2)' }}>Beğendiğiniz ürünleri ekleyince burada görünecek.</p>
                  </div>
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {visibleItems.map((item, idx) => (
                    <li
                      key={item.cartId}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: item.imageUrl ? '58px minmax(0,1fr) auto' : 'minmax(0,1fr) auto',
                        gap: 12,
                        padding: 12,
                        border: '1px solid var(--p-border)',
                        borderRadius: Math.max(radius + 6, 16),
                        background: 'var(--p-card)',
                        boxShadow: idx === 0 ? '0 12px 28px rgba(15,23,42,.07)' : '0 6px 18px rgba(15,23,42,.05)',
                        alignItems: 'start',
                      }}
                    >
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl} alt={item.name}
                          loading="lazy"
                          decoding="async"
                          style={{ height: 58, width: 58, borderRadius: `${Math.max(10, radius)}px`, objectFit: 'cover', flexShrink: 0 }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, margin: '0 0 3px', color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                          {item.originalPrice && item.originalPrice !== item.price && (
                            <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--p-cta)', color: 'var(--p-cta-text)', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>İndirimli</span>
                          )}
                        </p>
                        <div style={{ margin: '0 0 9px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {item.originalPrice && item.originalPrice !== item.price && (
                            <span style={{ fontSize: 11, color: 'var(--p-text-2)', textDecoration: 'line-through', opacity: 0.6 }}>
                              {formatTRY(item.originalPrice)}
                            </span>
                          )}
                          <span style={{ fontSize: 11.5, color: item.originalPrice && item.originalPrice !== item.price ? 'var(--p-cta)' : 'var(--p-text-2)', fontWeight: item.originalPrice && item.originalPrice !== item.price ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {formatTRY(item.price + item.modifiersPriceDelta)} / adet{item.modifiers.length > 0 ? ' · Seçenekli' : ''}
                          </span>
                        </div>
                        {(item.modifierNames.length > 0 || item.removedIngredientNames.length > 0 || item.energyKcal !== null || item.productNote || item.recommendationSourceItemId) && (
                          <div style={{ margin: '-3px 0 9px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {item.recommendationSourceItemId && (
                              <span style={{ width: 'fit-content', padding: '2px 6px', borderRadius: 999, background: 'var(--p-accent-soft)', color: 'var(--p-accent)', fontSize: 9.5, fontWeight: 800 }}>Yanında iyi gider</span>
                            )}
                            {item.modifierNames.length > 0 && (
                              <span style={{ fontSize: 10.5, color: 'var(--p-text-2)' }}>
                                {item.modifierNames.join(', ')}
                              </span>
                            )}
                            {item.removedIngredientNames.length > 0 && (
                              <span style={{ fontSize: 10.5, color: '#b42318', fontWeight: 800 }}>
                                ÇIKAR: {item.removedIngredientNames.join(', ')}
                              </span>
                            )}
                            {item.energyKcal !== null && (
                              <span style={{ fontSize: 10.5, color: 'var(--p-text-2)' }}>{item.energyKcal} kcal</span>
                            )}
                            {item.productNote && (
                              <span style={{ padding: '5px 7px', borderRadius: 7, background: 'rgba(15,23,42,.05)', color: 'var(--p-text)', fontSize: 10.5, fontWeight: 700, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>Not: {item.productNote}</span>
                            )}
                          </div>
                        )}
                        {item.promotion?.quantityStep === 2 && (
                          <div
                            data-component="cart-buy-two-pay-one"
                            style={{
                              width: 'fit-content', margin: '-2px 0 9px', padding: '4px 8px', borderRadius: 999,
                              background: 'var(--p-accent-soft)', color: 'var(--p-accent)', fontSize: 10.5, fontWeight: 850,
                            }}
                          >
                            2 al 1 öde · 2 adet {formatTRY((item.price + item.modifiersPriceDelta) * 2)}
                          </div>
                        )}
                        {item.promotion?.offer === 'freebie' && (
                          <div data-component="cart-freebie-badge" style={{ width: 'fit-content', margin: '-2px 0 9px', padding: '4px 8px', borderRadius: 999, background: 'var(--p-accent-soft)', color: 'var(--p-accent)', fontSize: 10.5, fontWeight: 850 }}>
                            {item.promotion.role === 'reward' ? 'Hediye · taban fiyat ₺0' : 'Hediye kampanyası'}
                          </div>
                        )}
                        {item.promotion?.offer === 'freebie' && item.promotion.role === 'reward' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11.5, color: 'var(--p-text-2)', fontWeight: 750 }}>Adet: {item.quantity}</span>
                            {onChangeFreebieReward && <button type="button" onClick={() => onChangeFreebieReward(item.cartId)} style={{ marginLeft: 'auto', minHeight: 44, padding: '0 10px', border: 0, background: 'transparent', color: 'var(--p-accent)', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}>Değiştir</button>}
                          </div>
                        ) : <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item, item.quantity - (item.promotion?.quantityStep ?? 1))}
                            style={{
                              height: 44, width: 44, display: 'grid', placeItems: 'center', padding: 0, lineHeight: 0,
                              border: 'none', borderRadius: 999, background: 'transparent', color: 'var(--p-accent)', cursor: 'pointer',
                            }}
                          aria-label={`${item.name} adedini azalt`}><span style={{ width: 32, height: 32, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--p-accent-soft)' }}><I.minus size={15} /></span></button>
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--p-text)', minWidth: 18, textAlign: 'center' }}>
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item, item.quantity + (item.promotion?.quantityStep ?? 1))}
                            style={{
                              height: 44, width: 44, display: 'grid', placeItems: 'center', padding: 0, lineHeight: 0,
                              border: 'none', borderRadius: 999, background: 'transparent', color: 'var(--p-cta-text)', cursor: 'pointer',
                            }}
                          aria-label={`${item.name} adedini artır`}><span style={{ width: 32, height: 32, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--p-cta)' }}><I.plus size={15} /></span></button>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.cartId)}
                            aria-label={`${item.name} ürününü sepetten kaldır`}
                            style={{ marginLeft: 'auto', minHeight: 44, background: 'none', border: 'none', fontSize: 11.5, color: 'var(--p-text-2)', cursor: 'pointer', padding: '4px 8px' }}
                          >Kaldır</button>
                        </div>
                        }
                      </div>
                      <p style={{ fontSize: 13.5, fontWeight: 850, color: 'var(--p-text)', flexShrink: 0, margin: 0, whiteSpace: 'nowrap' }}>
                        {formatTRY((item.price + item.modifiersPriceDelta) * item.quantity)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {visibleItems.length > 0 && (
              <div data-component="cart-details-region" style={{
                padding: '2px 16px 16px',
              }}>
                {coupon && (
                  <div data-component="cart-coupon" style={{ marginBottom: 12, padding: 12, borderRadius: 14, border: '1px solid var(--p-border)', background: 'var(--p-card)' }}>
                    {coupon.appliedCode && !coupon.error && couponDiscount > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 850, color: 'var(--p-text)' }}>{coupon.appliedName ?? 'Kupon uygulandı'}</div>
                          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--p-accent)', fontWeight: 750 }}>{coupon.appliedCode} · -{formatTRY(couponDiscount)}</div>
                        </div>
                        <button type="button" onClick={coupon.onRemove} style={{ minHeight: 44, padding: '0 12px', borderRadius: 9, border: '1px solid var(--p-border)', background: 'transparent', color: 'var(--p-text-2)', fontSize: 11.5, fontWeight: 750, cursor: 'pointer' }}>Kaldır</button>
                      </div>
                    ) : (
                      <form onSubmit={(event) => { event.preventDefault(); coupon.onApply() }}>
                        <label htmlFor="cart-coupon-code" style={{ display: 'block', marginBottom: 7, fontSize: 12.5, fontWeight: 800, color: 'var(--p-text)' }}>Kupon kodun var mı?</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8 }}>
                          <input
                            id="cart-coupon-code"
                            value={coupon.draft}
                            onChange={(event) => coupon.onDraftChange(event.target.value)}
                            disabled={coupon.pending}
                            autoCapitalize="characters"
                            autoComplete="off"
                            maxLength={32}
                            placeholder="KUPON KODU"
                            aria-invalid={Boolean(coupon.error)}
                            aria-describedby={coupon.error ? 'cart-coupon-error' : undefined}
                            style={{ minWidth: 0, height: 44, borderRadius: 10, border: `1px solid ${coupon.error ? '#dc2626' : 'var(--p-border)'}`, background: 'var(--p-bg)', color: 'var(--p-text)', padding: '0 11px', font: 'inherit', fontSize: 12.5, fontWeight: 750, textTransform: 'uppercase', outline: 'none' }}
                          />
                          <button type="submit" disabled={coupon.pending || !coupon.draft.trim()} style={{ minWidth: 76, height: 44, border: 0, borderRadius: 10, padding: '0 13px', background: 'var(--p-cta)', color: 'var(--p-cta-text)', fontSize: 12, fontWeight: 800, cursor: coupon.pending ? 'wait' : 'pointer', opacity: coupon.pending || !coupon.draft.trim() ? .6 : 1 }}>{coupon.pending ? 'Kontrol…' : 'Uygula'}</button>
                        </div>
                        {coupon.error && <div id="cart-coupon-error" role="alert" aria-live="polite" style={{ marginTop: 7, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, color: '#b42318', fontSize: 11, lineHeight: 1.4 }}><span>{coupon.error}</span>{coupon.appliedCode && <button type="button" onClick={coupon.onRemove} style={{ minHeight: 44, padding: '0 8px', border: 0, background: 'none', color: 'inherit', fontWeight: 800, cursor: 'pointer' }}>Temizle</button>}</div>}
                      </form>
                    )}
                  </div>
                )}
                {!loyaltySuppressedByPromotion && !exclusiveCouponApplied && stampReward && stampReward.cardFull && (
                  stampReward.rewardInCart ? (
                    <button
                      type="button"
                      data-component="cart-stamp-claim"
                      onClick={() => stampReward.onToggle(!stampReward.claimed)}
                      style={{
                        width: '100%', marginBottom: 12, padding: '10px 12px', borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        minHeight: 44,
                        background: stampReward.claimed ? 'var(--p-cta)' : 'var(--p-accent-soft)',
                        color: stampReward.claimed ? 'var(--p-cta-text)' : 'var(--p-accent)',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 12.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        <I.gift size={16} /> Bedava {stampReward.rewardName ?? 'ürün'} {stampReward.claimed ? 'eklendi' : 'ekle'}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 800 }}>{stampReward.claimed ? '✓' : '+'}</span>
                    </button>
                  ) : (
                    <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--p-accent-soft)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--p-accent)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        <I.gift size={16} /> Kartın doldu! {stampReward.rewardName ?? 'Ödül ürününü'} ekle, bedava olsun.
                      </span>
                    </div>
                  )
                )}

                {!loyaltySuppressedByPromotion && !exclusiveCouponApplied && catalogReward && (
                  <div data-component="cart-catalog-reward" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--p-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--p-accent)', display: 'flex', alignItems: 'center', gap: 7 }}><I.gift size={16} /> Bedava {catalogReward.itemName}</div>
                      <div style={{ fontSize: 11, color: 'var(--p-text-2)', marginTop: 1 }}>{catalogReward.pointCost} puan ile</div>
                    </div>
                    <button type="button" onClick={catalogReward.onClear}
                      style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: 'none', background: 'var(--p-card)', color: 'var(--p-text-2)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      Vazgeç
                    </button>
                  </div>
                )}

                {loyaltySuppressedByPromotion && (
                  <div
                    role="status"
                    data-component="cart-promotion-stacking-notice"
                    style={{
                      marginBottom: 12,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid color-mix(in srgb, var(--p-accent) 24%, transparent)',
                      background: 'var(--p-accent-soft)',
                      color: 'var(--p-text-2)',
                      fontSize: 11.5,
                      lineHeight: 1.45,
                    }}
                  >
                    <strong style={{ display: 'block', color: 'var(--p-text)', fontSize: 12.5, marginBottom: 2 }}>
                      Kampanya uygulanıyor
                    </strong>
                    Bu seçim yalnız kampanya fiyatıyla sunulduğu için üye indirimi ve ödüller bu siparişte birleştirilemez.
                  </div>
                )}

                {exclusiveCouponApplied && coupon && (
                  <div
                    role="status"
                    data-component="cart-exclusive-coupon-notice"
                    style={{
                      marginBottom: 12,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid color-mix(in srgb, var(--p-accent) 24%, transparent)',
                      background: 'var(--p-accent-soft)',
                      color: 'var(--p-text-2)',
                      fontSize: 11.5,
                      lineHeight: 1.45,
                    }}
                  >
                    <strong style={{ display: 'block', color: 'var(--p-text)', fontSize: 12.5, marginBottom: 2 }}>
                      Kupon veya üyelik avantajı
                    </strong>
                    Bu kupon puan, damga ve üye indirimiyle birleşmez. Puan kullanmak için önce kuponu kaldırın.
                    <button
                      type="button"
                      onClick={coupon.onRemove}
                      style={{ display: 'block', marginTop: 7, minHeight: 44, borderRadius: 8, border: '1px solid var(--p-accent)', background: 'transparent', color: 'var(--p-accent)', padding: '0 10px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}
                    >
                      Kuponu kaldır ve puan kullan
                    </button>
                  </div>
                )}

                {!loyaltySuppressedByPromotion && !exclusiveCouponApplied && !catalogReward && pointsRedeem && maxRedeemTl > 0 && (
                  <div data-component="cart-points-redeem" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--p-accent-soft)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--p-accent)', display: 'flex', alignItems: 'center', gap: 7 }}><I.star size={15} /> Puan kullan</div>
                        <div style={{ fontSize: 11, color: 'var(--p-text-2)', marginTop: 1 }}>
                          {pointsRedeem.balance} puan · {pointsRedeem.rate} puan = ₺1
                        </div>
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button type="button" aria-label="Azalt"
                          onClick={() => pointsRedeem.onChange(Math.max(0, pointsRedeem.redeemTl - 1))}
                        style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', padding: 0, lineHeight: 0, borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--p-accent)', cursor: 'pointer' }}><span style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 999, background: 'var(--p-card)' }}><I.minus size={13} /></span></button>
                        <span style={{ minWidth: 56, textAlign: 'center', fontSize: 14, fontWeight: 800, color: 'var(--p-text)' }}>{formatTRY(pointsRedeem.redeemTl)}</span>
                        <button type="button" aria-label="Artır"
                          onClick={() => pointsRedeem.onChange(Math.min(maxRedeemTl, pointsRedeem.redeemTl + 1))}
                          style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', padding: 0, lineHeight: 0, borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--p-cta-text)', cursor: 'pointer' }}><span style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 999, background: 'var(--p-cta)' }}><I.plus size={13} /></span></button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button type="button" onClick={() => pointsRedeem.onChange(maxRedeemTl)}
                        style={{ flex: 1, minHeight: 44, borderRadius: 8, border: '1px solid var(--p-accent)', background: 'transparent', color: 'var(--p-accent)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                        Tümünü kullan ({formatTRY(maxRedeemTl)})
                      </button>
                      {pointsRedeem.redeemTl > 0 && (
                        <button type="button" onClick={() => pointsRedeem.onChange(0)}
                          style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: 'none', background: 'var(--p-card)', color: 'var(--p-text-2)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                          Vazgeç
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {showSubtotal && (
                  <>
                    {hasDiscount && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12.5, color: 'var(--p-text-2)' }}>Ara toplam</span>
                          <span style={{ fontSize: 13.5, color: 'var(--p-text-2)' }}>{formatTRY(discountPreview?.subtotal ?? total)}</span>
                        </div>
                        {stampDiscount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (catalogDiscount > 0 || memberDiscount > 0 || pointsDiscount > 0) ? 4 : 8 }}>
                            <span style={{ fontSize: 12.5, color: 'var(--p-accent)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><I.gift size={15} /> Bedava {rewardName}</span>
                            <span style={{ fontSize: 13.5, color: 'var(--p-accent)', fontWeight: 800 }}>-{formatTRY(stampDiscount)}</span>
                          </div>
                        )}
                        {catalogDiscount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (memberDiscount > 0 || pointsDiscount > 0) ? 4 : 8 }}>
                            <span style={{ fontSize: 12.5, color: 'var(--p-accent)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><I.gift size={15} /> Ödül: {catalogName}</span>
                            <span style={{ fontSize: 13.5, color: 'var(--p-accent)', fontWeight: 800 }}>-{formatTRY(catalogDiscount)}</span>
                          </div>
                        )}
                        {couponDiscount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (memberDiscount > 0 || pointsDiscount > 0) ? 4 : 8 }}>
                            <span style={{ fontSize: 12.5, color: 'var(--p-accent)', fontWeight: 700 }}>Kupon{discountPreview?.couponCode ? ` · ${discountPreview.couponCode}` : ''}</span>
                            <span style={{ fontSize: 13.5, color: 'var(--p-accent)', fontWeight: 800 }}>-{formatTRY(couponDiscount)}</span>
                          </div>
                        )}
                        {memberDiscount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: pointsDiscount > 0 ? 4 : 8 }}>
                            <span style={{ fontSize: 12.5, color: 'var(--p-accent)', fontWeight: 700 }}>{memberTierName ? `Üye indirimi (${memberTierName} %${memberPct})` : `Üye indirimi %${memberPct}`}</span>
                            <span style={{ fontSize: 13.5, color: 'var(--p-accent)', fontWeight: 800 }}>-{formatTRY(memberDiscount)}</span>
                          </div>
                        )}
                        {pointsDiscount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 12.5, color: 'var(--p-accent)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><I.star size={15} /> Puan indirimi</span>
                            <span style={{ fontSize: 13.5, color: 'var(--p-accent)', fontWeight: 800 }}>-{formatTRY(pointsDiscount)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
                {!canCheckout && checkoutUnavailableReason && (
                  <div
                    role="status"
                    data-component="cart-checkout-unavailable"
                    style={{
                      marginBottom: 10,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid color-mix(in srgb, var(--p-accent) 28%, transparent)',
                      background: 'var(--p-accent-soft)',
                      color: 'var(--p-text)',
                      fontSize: 12,
                      fontWeight: 700,
                      lineHeight: 1.45,
                    }}
                  >
                    {checkoutUnavailableReason}
                  </div>
                )}
                {orderError && (
                  <div
                    role="alert"
                    data-component="cart-order-error"
                    style={{
                      marginBottom: 10,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid rgba(180,35,24,.28)',
                      background: 'rgba(180,35,24,.08)',
                      color: '#b42318',
                      fontSize: 12,
                      fontWeight: 750,
                      lineHeight: 1.45,
                    }}
                  >
                    {orderError}
                  </div>
                )}
                {canCheckout && (onPay ?? onSplitBill) && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    {onPay && (
                      <button
                        type="button"
                        onClick={onPay}
                        disabled={isPlacing || Boolean(coupon?.blocksCheckout) || Boolean(coupon?.pending)}
                        style={{
                          flex: 1, minHeight: 48, padding: '11px 14px', fontSize: 13, fontWeight: 750,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          border: '1px solid rgba(15,23,42,.1)', color: 'var(--p-text)',
                          backgroundColor: 'var(--p-card)', borderRadius: `${Math.max(radius, 12)}px`, cursor: coupon?.blocksCheckout || coupon?.pending ? 'not-allowed' : 'pointer', opacity: coupon?.blocksCheckout || coupon?.pending ? .55 : 1,
                        }}
                      >
                        <I.card size={18} strokeWidth={1.9} style={{ color: 'var(--p-accent)' }} />
                        <span>Ödeme Yap</span>
                      </button>
                    )}
                    {onSplitBill && (
                      <button
                        type="button"
                        onClick={onSplitBill}
                        style={{
                          flex: 1, minHeight: 48, padding: '11px 14px', fontSize: 13, fontWeight: 750,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          border: '1px solid rgba(15,23,42,.1)', color: 'var(--p-text)',
                          backgroundColor: 'var(--p-card)', borderRadius: `${Math.max(radius, 12)}px`, cursor: 'pointer',
                        }}
                      >
                        <I.users size={18} strokeWidth={1.9} style={{ color: 'var(--p-accent)' }} />
                        <span>Kişi Başı Hesapla</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>

            {visibleItems.length > 0 && (
              <div
                data-component="cart-action-tray"
                style={{
                  flexShrink: 0,
                  padding: '10px 16px calc(12px + env(safe-area-inset-bottom))',
                  borderTop: '1px solid var(--p-border)',
                  background: 'color-mix(in srgb, var(--p-card) 96%, transparent)',
                  boxShadow: '0 -14px 30px rgba(15,23,42,.08)',
                  backdropFilter: 'blur(14px)',
                }}
              >
                {showSubtotal && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--p-text-2)', fontWeight: 650 }}>Toplam</span>
                    <span style={{ fontSize: 19, fontWeight: 850, color: 'var(--p-text)', letterSpacing: '-0.02em' }}>{formatTRY(displayTotal)}</span>
                  </div>
                )}
                <button
                  type="button"
                  data-component="cart-primary-action"
                  aria-busy={isPlacing}
                  onClick={onPlaceOrder}
                  disabled={isPlacing || !canCheckout || Boolean(coupon?.blocksCheckout) || Boolean(coupon?.pending)}
                  style={{
                    width: '100%', minHeight: 52, padding: '12px 16px',
                    fontSize: 15, fontWeight: 800,
                    background: 'var(--p-cta)', color: 'var(--p-cta-text)',
                    border: 'none', borderRadius: `${Math.max(radius + 4, 16)}px`,
                    cursor: isPlacing || !canCheckout || coupon?.blocksCheckout || coupon?.pending ? 'not-allowed' : 'pointer',
                    opacity: isPlacing || !canCheckout || coupon?.blocksCheckout || coupon?.pending ? 0.6 : 1,
                    transition: prefersReducedMotion ? 'none' : 'opacity 150ms ease',
                    boxShadow: '0 10px 22px rgba(15,23,42,.16)',
                  }}
                >
                  {isPlacing ? 'Sipariş veriliyor…' : coupon?.pending ? 'Kupon kontrol ediliyor…' : coupon?.blocksCheckout ? 'Kuponu düzeltin' : canCheckout ? primaryActionText : 'Masadaki QR kodu okutun'}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

const VISUALLY_HIDDEN_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}
