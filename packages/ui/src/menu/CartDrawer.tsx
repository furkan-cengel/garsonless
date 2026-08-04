'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'
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

interface CartDrawerProps {
  isOpen: boolean
  items: CartItem[]
  isPlacing: boolean
  orderError?: string | null
  onClose: () => void
  onUpdateQuantity: (cartId: string, quantity: number) => void
  onRemoveItem: (cartId: string) => void
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
}

export function CartDrawer({
  isOpen,
  items,
  isPlacing,
  orderError = null,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
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
  const catalogName = discountPreview?.catalogItemName ?? catalogReward?.itemName ?? 'ürün'
  const rewardName = discountPreview?.rewardItemName ?? stampReward?.rewardName ?? 'ürün'
  const hasDiscount = stampDiscount > 0 || catalogDiscount > 0 || memberDiscount > 0 || pointsDiscount > 0
  const displayTotal = discountPreview ? discountPreview.finalTotal : total
  const loyaltySuppressedByPromotion = discountPreview?.loyaltySuppressedByPromotion ?? false
  const { theme } = useTheme()
  const checkoutTheme = theme.surfaces?.checkout
  const checkoutOverride = checkoutTheme?.override ?? {}
  const radius = checkoutOverride.radius ?? theme.radius
  const drawerTone = theme.cartDrawerTone ?? 'clean'
  const showSubtotal = theme.cartShowSubtotal ?? true
  const showItemCount = theme.cartShowItemCount ?? true
  const primaryActionText = theme.cartPrimaryActionText || 'Sipariş ver'
  const checkoutPreset = checkoutTheme?.preset ?? 'clean'
  const checkoutSheetSize = checkoutTheme?.sheetSize ?? 'standard'
  const checkoutSheetMaxWidth = checkoutSheetSize === 'compact' ? 400 : checkoutSheetSize === 'large' ? 680 : 520
  const checkoutSheetMaxHeight = checkoutSheetSize === 'compact' ? '76dvh' : checkoutSheetSize === 'large' ? '94dvh' : '88dvh'
  const headerIsAccent = checkoutPreset === 'brand-header' || drawerTone === 'accentHeader'
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
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (!isOpen) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const drawer = drawerRef.current
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
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
      else document.querySelector<HTMLElement>('[aria-label^="Sepeti aç"]')?.focus()
    }
  }, [isOpen, onClose])

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
            }}
            variants={{ hidden: { y: '100%' }, visible: { y: 0 } }}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div style={{
              background: headerIsAccent ? 'linear-gradient(135deg, var(--p-accent), var(--p-cta))' : 'var(--p-card)',
              color: headerIsAccent ? '#fff' : 'var(--p-text)',
              padding: '12px 18px 14px',
              borderBottom: headerIsAccent ? 'none' : '1px solid rgba(15,23,42,.08)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 10 }}>
                <div style={{ height: 4, width: 42, borderRadius: 9999, backgroundColor: headerIsAccent ? 'rgba(255,255,255,.48)' : 'rgba(15,23,42,.16)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <h2 id="cart-drawer-title" style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'inherit', letterSpacing: '-0.01em' }}>Sepetiniz</h2>
                  {showItemCount && (
                    <p aria-live="polite" style={{ fontSize: 12, margin: '3px 0 0', color: headerIsAccent ? 'rgba(255,255,255,.78)' : 'var(--p-text-2)' }}>
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
                    background: headerIsAccent ? 'rgba(255,255,255,.16)' : 'var(--p-accent-soft)',
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

            {billSummary && billSummary.count > 0 && onOpenBill && (
              <button
                type="button"
                onClick={onOpenBill}
                style={{
                  margin: '10px 14px 0', padding: '10px 14px',
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

            <div style={{ flex: 1, overflowY: 'auto', padding: visibleItems.length === 0 ? 0 : '12px 14px' }}>
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
                  }}>🛒</span>
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
                            2 al 1 öde · ikili paket
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.cartId, item.quantity - (item.promotion?.quantityStep ?? 1))}
                            style={{
                              height: 36, width: 36, display: 'grid', placeItems: 'center', padding: 0, lineHeight: 0,
                              border: 'none', borderRadius: 999,
                              background: 'var(--p-accent-soft)', color: 'var(--p-accent)', cursor: 'pointer',
                            }}
                          aria-label={`${item.name} adedini azalt`}><I.minus size={15} /></button>
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--p-text)', minWidth: 18, textAlign: 'center' }}>
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.cartId, item.quantity + (item.promotion?.quantityStep ?? 1))}
                            style={{
                              height: 36, width: 36, display: 'grid', placeItems: 'center', padding: 0, lineHeight: 0,
                              border: 'none', borderRadius: 999,
                              backgroundColor: 'var(--p-cta)', color: 'var(--p-cta-text)', cursor: 'pointer',
                            }}
                          aria-label={`${item.name} adedini artır`}><I.plus size={15} /></button>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.cartId)}
                            aria-label={`${item.name} ürününü sepetten kaldır`}
                            style={{ marginLeft: 'auto', minHeight: 44, background: 'none', border: 'none', fontSize: 11.5, color: 'var(--p-text-2)', cursor: 'pointer', padding: '4px 8px' }}
                          >Kaldır</button>
                        </div>
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
              <div style={{
                padding: '14px 16px calc(18px + env(safe-area-inset-bottom))',
                borderTop: '1px solid rgba(15,23,42,.08)',
                background: 'color-mix(in srgb, var(--p-card) 94%, transparent)',
                boxShadow: '0 -12px 28px rgba(15,23,42,.06)',
              }}>
                {!loyaltySuppressedByPromotion && stampReward && stampReward.cardFull && (
                  stampReward.rewardInCart ? (
                    <button
                      type="button"
                      data-component="cart-stamp-claim"
                      onClick={() => stampReward.onToggle(!stampReward.claimed)}
                      style={{
                        width: '100%', marginBottom: 12, padding: '10px 12px', borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        background: stampReward.claimed ? 'var(--p-accent)' : 'var(--p-accent-soft)',
                        color: stampReward.claimed ? '#fff' : 'var(--p-accent)',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 12.5, fontWeight: 800 }}>
                        🎁 Bedava {stampReward.rewardName ?? 'ürün'} {stampReward.claimed ? 'eklendi' : 'ekle'}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 800 }}>{stampReward.claimed ? '✓' : '+'}</span>
                    </button>
                  ) : (
                    <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--p-accent-soft)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--p-accent)' }}>
                        🎁 Kartın doldu! {stampReward.rewardName ?? 'Ödül ürününü'} ekle, bedava olsun.
                      </span>
                    </div>
                  )
                )}

                {!loyaltySuppressedByPromotion && catalogReward && (
                  <div data-component="cart-catalog-reward" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--p-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--p-accent)' }}>🎁 Bedava {catalogReward.itemName}</div>
                      <div style={{ fontSize: 11, color: 'var(--p-text-2)', marginTop: 1 }}>{catalogReward.pointCost} puan ile</div>
                    </div>
                    <button type="button" onClick={catalogReward.onClear}
                      style={{ height: 28, padding: '0 12px', borderRadius: 8, border: 'none', background: 'var(--p-card)', color: 'var(--p-text-2)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
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

                {!loyaltySuppressedByPromotion && !catalogReward && pointsRedeem && maxRedeemTl > 0 && (
                  <div data-component="cart-points-redeem" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--p-accent-soft)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--p-accent)' }}>⭐ Puan kullan</div>
                        <div style={{ fontSize: 11, color: 'var(--p-text-2)', marginTop: 1 }}>
                          {pointsRedeem.balance} puan · {pointsRedeem.rate} puan = ₺1
                        </div>
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button type="button" aria-label="Azalt"
                          onClick={() => pointsRedeem.onChange(Math.max(0, pointsRedeem.redeemTl - 1))}
                        style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', padding: 0, lineHeight: 0, borderRadius: 999, border: 'none', background: 'var(--p-card)', color: 'var(--p-accent)', cursor: 'pointer' }}><I.minus size={13} /></button>
                        <span style={{ minWidth: 56, textAlign: 'center', fontSize: 14, fontWeight: 800, color: 'var(--p-text)' }}>−{formatTRY(pointsRedeem.redeemTl)}</span>
                        <button type="button" aria-label="Artır"
                          onClick={() => pointsRedeem.onChange(Math.min(maxRedeemTl, pointsRedeem.redeemTl + 1))}
                          style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', padding: 0, lineHeight: 0, borderRadius: 999, border: 'none', background: 'var(--p-accent)', color: '#fff', cursor: 'pointer' }}><I.plus size={13} /></button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button type="button" onClick={() => pointsRedeem.onChange(maxRedeemTl)}
                        style={{ flex: 1, height: 28, borderRadius: 8, border: '1px solid var(--p-accent)', background: 'transparent', color: 'var(--p-accent)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                        Tümünü kullan (−{formatTRY(maxRedeemTl)})
                      </button>
                      {pointsRedeem.redeemTl > 0 && (
                        <button type="button" onClick={() => pointsRedeem.onChange(0)}
                          style={{ height: 28, padding: '0 12px', borderRadius: 8, border: 'none', background: 'var(--p-card)', color: 'var(--p-text-2)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
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
                            <span style={{ fontSize: 12.5, color: 'var(--p-accent)', fontWeight: 700 }}>🎁 Bedava {rewardName}</span>
                            <span style={{ fontSize: 13.5, color: 'var(--p-accent)', fontWeight: 800 }}>−{formatTRY(stampDiscount)}</span>
                          </div>
                        )}
                        {catalogDiscount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (memberDiscount > 0 || pointsDiscount > 0) ? 4 : 8 }}>
                            <span style={{ fontSize: 12.5, color: 'var(--p-accent)', fontWeight: 700 }}>🎁 Ödül: {catalogName}</span>
                            <span style={{ fontSize: 13.5, color: 'var(--p-accent)', fontWeight: 800 }}>−{formatTRY(catalogDiscount)}</span>
                          </div>
                        )}
                        {memberDiscount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: pointsDiscount > 0 ? 4 : 8 }}>
                            <span style={{ fontSize: 12.5, color: 'var(--p-accent)', fontWeight: 700 }}>{memberTierName ? `Üye indirimi (${memberTierName} %${memberPct})` : `Üye indirimi %${memberPct}`}</span>
                            <span style={{ fontSize: 13.5, color: 'var(--p-accent)', fontWeight: 800 }}>−{formatTRY(memberDiscount)}</span>
                          </div>
                        )}
                        {pointsDiscount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 12.5, color: 'var(--p-accent)', fontWeight: 700 }}>⭐ Puan indirimi</span>
                            <span style={{ fontSize: 13.5, color: 'var(--p-accent)', fontWeight: 800 }}>−{formatTRY(pointsDiscount)}</span>
                          </div>
                        )}
                      </>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, color: 'var(--p-text-2)' }}>Toplam</span>
                      <span style={{ fontSize: 20, fontWeight: 850, color: 'var(--p-text)', letterSpacing: '-0.02em' }}>{formatTRY(displayTotal)}</span>
                    </div>
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
                <button
                  type="button"
                  aria-busy={isPlacing}
                  onClick={onPlaceOrder}
                  disabled={isPlacing || !canCheckout}
                  style={{
                    width: '100%', padding: '14px 0',
                    fontSize: 15, fontWeight: 800,
                    background: 'var(--p-cta)', color: 'var(--p-cta-text)',
                    border: 'none', borderRadius: `${Math.max(radius + 4, 16)}px`,
                    cursor: isPlacing || !canCheckout ? 'not-allowed' : 'pointer',
                    opacity: isPlacing || !canCheckout ? 0.6 : 1,
                    transition: 'opacity 150ms ease',
                    boxShadow: '0 12px 24px rgba(15,23,42,.18)',
                  }}
                >
                  {isPlacing ? 'Sipariş veriliyor…' : canCheckout ? primaryActionText : 'Masadaki QR kodu okutun'}
                </button>

                {canCheckout && (onPay ?? onSplitBill) && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    {onPay && (
                      <button
                        type="button"
                        onClick={onPay}
                        style={{
                          flex: 1, padding: '11px 0', fontSize: 13, fontWeight: 750,
                          border: '1px solid rgba(15,23,42,.1)', color: 'var(--p-text)',
                          backgroundColor: 'var(--p-card)', borderRadius: `${Math.max(radius, 12)}px`, cursor: 'pointer',
                        }}
                      >💳 Ödeme Yap</button>
                    )}
                    {onSplitBill && (
                      <button
                        type="button"
                        onClick={onSplitBill}
                        style={{
                          flex: 1, padding: '11px 0', fontSize: 13, fontWeight: 750,
                          border: '1px solid rgba(15,23,42,.1)', color: 'var(--p-text)',
                          backgroundColor: 'var(--p-card)', borderRadius: `${Math.max(radius, 12)}px`, cursor: 'pointer',
                        }}
                      >÷ Kişi Başı Hesapla</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
