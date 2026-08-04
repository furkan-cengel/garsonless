'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { CartDrawer, ThemeProvider, useTheme, type CartItem, type MenuItem } from '@garsonless/ui'
import { AppIcons as I } from '@garsonless/ui/icons'
import {
  type AuthPreviewState,
  type CheckoutPreviewState,
  type GarsonlessTheme,
} from '@garsonless/design-engine'
import MemberSheet from './components/MemberSheet'
import PaymentModal from './components/PaymentModal'

export function ExperienceStatePreview({
  restaurantName,
  logoUrl,
  theme,
  surface,
  state,
  menuItems = [],
}: {
  restaurantName: string
  logoUrl: string | null
  theme: GarsonlessTheme
  surface: 'auth' | 'checkout'
  state: AuthPreviewState | CheckoutPreviewState
  menuItems?: MenuItem[]
}) {
  return <ThemeProvider initialTheme={theme} isPreview initialRestaurantName={restaurantName} initialLogoUrl={logoUrl}><PreviewCanvas surface={surface} state={state} restaurantName={restaurantName} logoUrl={logoUrl} menuItems={menuItems} /></ThemeProvider>
}

function PreviewCanvas({
  surface,
  state,
  restaurantName,
  logoUrl,
  menuItems,
}: {
  surface: 'auth' | 'checkout'
  state: AuthPreviewState | CheckoutPreviewState
  restaurantName: string
  logoUrl: string | null
  menuItems: MenuItem[]
}) {
  const { theme } = useTheme()
  if (surface === 'auth') {
    return (
      <main data-experience-preview="auth" data-component="auth-surface" style={{ minHeight: '100dvh', background: theme.bg }}>
        <MemberSheet
          onClose={() => undefined}
          onVerified={() => undefined}
          restaurantName={restaurantName}
          tableLabel="Menü"
          oauthProviders={['google']}
          welcomeBonus={200}
          previewState={state as AuthPreviewState}
        />
      </main>
    )
  }

  return <CheckoutProductionPreview
    state={state as CheckoutPreviewState}
    restaurantName={restaurantName}
    logoUrl={logoUrl}
    menuItems={menuItems}
  />
}

function CheckoutProductionPreview({
  state,
  restaurantName,
  logoUrl,
  menuItems,
}: {
  state: CheckoutPreviewState
  restaurantName: string
  logoUrl: string | null
  menuItems: MenuItem[]
}) {
  const { theme } = useTheme()
  const checkoutOverride = theme.surfaces?.checkout.override ?? {}
  const previewVars = {
    '--p-bg': checkoutOverride.background ?? theme.bg,
    '--p-card': checkoutOverride.surface ?? theme.cardColor ?? '#ffffff',
    '--p-text': checkoutOverride.text ?? theme.textColor ?? '#1c1d20',
    '--p-text-2': checkoutOverride.mutedText ?? theme.mutedTextColor ?? '#6c6f76',
    '--p-accent': checkoutOverride.accent ?? theme.accent,
    '--p-accent-soft': checkoutOverride.accentSoft ?? theme.accentSoft,
    '--p-border': checkoutOverride.fieldBorder ?? theme.borderColor ?? '#e3e4e7',
    '--p-body': checkoutOverride.bodyFont ?? theme.bodyFont,
  } as CSSProperties
  const initialItems = useMemo(() => previewCartItems(menuItems), [menuItems])
  const [items, setItems] = useState<CartItem[]>(initialItems)
  useEffect(() => setItems(initialItems), [initialItems])

  const updateQuantity = (cartId: string, quantity: number) => {
    setItems((current) => current.map((item) => item.cartId === cartId ? { ...item, quantity: Math.max(0, quantity) } : item))
  }
  const total = items.reduce((sum, item) => sum + (item.price + item.modifiersPriceDelta) * item.quantity, 0)

  return (
    <main data-experience-preview="checkout" data-component="checkout-surface" style={previewVars}>
      <style>{CHECKOUT_PREVIEW_CSS}</style>
      <CheckoutMenuBackdrop restaurantName={restaurantName} logoUrl={logoUrl} item={items[0] ?? null} />
      {state === 'cart' ? (
        <CartDrawer
          isOpen
          items={items}
          isPlacing={false}
          onClose={() => undefined}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={(cartId) => updateQuantity(cartId, 0)}
          onPlaceOrder={() => undefined}
          canCheckout
          onPay={() => undefined}
          onSplitBill={() => undefined}
          billSummary={{ total, count: 1 }}
          onOpenBill={() => undefined}
        />
      ) : (
        <PaymentModal
          orderId="preview-order-a104"
          total={total || 180}
          restaurantId="preview-restaurant"
          tableToken="preview-table"
          restaurantName={restaurantName}
          tableLabel="Masa BAF7"
          deviceId="preview-device"
          initialBuyerName="Örnek Misafir"
          onClose={() => undefined}
          onSuccess={() => undefined}
          onPayAtTable={async () => true}
          onDeferred={() => undefined}
          previewState={state}
        />
      )}
    </main>
  )
}

function previewCartItems(menuItems: MenuItem[]): CartItem[] {
  const candidate = menuItems.find((item) => item.is_available && item.images.length > 0)
    ?? menuItems.find((item) => item.is_available)
  return [{
    cartId: 'preview-cart-item',
    itemId: candidate?.id ?? 'preview-menu-item',
    name: candidate?.name ?? 'Menemen',
    price: candidate?.price ?? 180,
    quantity: 1,
    modifiers: [],
    modifiersPriceDelta: 0,
    modifierNames: [],
    removedIngredientIds: [],
    removedIngredientNames: [],
    energyKcal: candidate?.energy_kcal ?? null,
    imageUrl: candidate?.images[0] ?? null,
  }]
}

function CheckoutMenuBackdrop({ restaurantName, logoUrl, item }: { restaurantName: string; logoUrl: string | null; item: CartItem | null }) {
  return <div className="checkout-preview-menu" aria-hidden="true">
    <header><span className="checkout-preview-menu-button"><I.menu size={18} /></span>{logoUrl ? <Image src={logoUrl} alt="" width={42} height={42} unoptimized /> : <strong>{restaurantName}</strong>}<span className="checkout-preview-menu-button"><I.userCircle size={18} /></span></header>
    <div className="checkout-preview-table"><span>● Masa BAF7</span><b>Hesap · ₺180,00</b></div>
    <nav><span>Kahvaltı</span><span>İçecekler</span><span>Kahveler</span><span>Tatlılar</span></nav>
    <section><h1>Öne çıkanlar</h1><article>{item?.imageUrl ? <Image src={item.imageUrl} alt="" width={210} height={150} unoptimized /> : <div /> }<strong>{item?.name ?? 'Menemen'}</strong><small>Menüden taze seçimler</small></article></section>
  </div>
}

const CHECKOUT_PREVIEW_CSS = `
[data-experience-preview="checkout"]{min-height:100dvh;position:relative;overflow:hidden;background:var(--p-bg,#f8f9fa);font-family:var(--p-body,system-ui,sans-serif)}.checkout-preview-menu{min-height:100dvh;background:var(--p-bg,#f8f9fa);color:var(--p-text,#1c1d20)}.checkout-preview-menu header{height:74px;padding:0 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--p-border,#e3e4e7);background:var(--p-card,#fff)}.checkout-preview-menu header img{width:42px;height:42px;border-radius:10px;object-fit:cover}.checkout-preview-menu header strong{max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.checkout-preview-menu-button{width:42px;height:42px;display:grid;place-items:center;border-radius:999px;background:var(--p-accent-soft,#e9f8ef);color:var(--p-accent,#2e7d52)}.checkout-preview-table{height:44px;padding:0 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--p-border,#e3e4e7);font-size:12px}.checkout-preview-table span{color:var(--p-accent,#2e7d52)}.checkout-preview-table b{padding:7px 11px;border-radius:999px;background:var(--p-accent-soft,#e9f8ef);color:var(--p-accent,#2e7d52)}.checkout-preview-menu nav{padding:18px;display:flex;gap:9px;overflow:hidden}.checkout-preview-menu nav span{padding:9px 13px;border:1px solid var(--p-border,#e3e4e7);border-radius:999px;white-space:nowrap;font-size:12px}.checkout-preview-menu section{padding:0 18px}.checkout-preview-menu h1{font-size:24px}.checkout-preview-menu article{width:min(210px,70%);overflow:hidden;border:1px solid var(--p-border,#e3e4e7);border-radius:16px;background:var(--p-card,#fff)}.checkout-preview-menu article img,.checkout-preview-menu article>div{width:100%;height:150px;display:block;object-fit:cover;background:var(--p-accent-soft,#e9f8ef)}.checkout-preview-menu article strong,.checkout-preview-menu article small{display:block;padding:10px 12px 0}.checkout-preview-menu article small{padding-top:2px;padding-bottom:12px;color:var(--p-text-2,#6c6f76)}@media(prefers-reduced-motion:reduce){[data-experience-preview="checkout"] *{animation:none!important;transition:none!important}}
`
