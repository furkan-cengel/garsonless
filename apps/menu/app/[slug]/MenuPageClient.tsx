'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import {
  ThemeProvider,
  ProductCard,
  ProductModal,
  CartDrawer,
  OrderConfirmation,
  OrderBubble,
  OrderToastNotification,
  ServiceRequestFab,
  TableBillSheet,
  useTheme,
  formatTRY,
  CartIconSvg,
  THEME_REGISTRY,
  DietaryFilterBar,
  itemMatchesDietaryFilters,
} from '@garsonless/ui'
import type { MenuItem, MenuCategory, OrderSummaryItem, BillOrder, DietaryFilter, StoreInfo } from '@garsonless/ui'
import type { TableSessionInfo, SessionOrderRow } from '../../lib/queries'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { Tables, OrderStatus, MemberBalances } from '@garsonless/db'
import { useCartStore } from '../../lib/store/useCartStore'
import { useOrderStore } from '../../lib/store/useOrderStore'
import { createMenuBrowserClient } from '../../lib/supabase'
import { useWaiterCall } from '../../lib/hooks/useWaiterCall'
import SplitBillModal from './components/SplitBillModal'
import MemberSheet from './components/MemberSheet'

const PaymentModal = dynamic(() => import('./components/PaymentModal'))

function statusPhase(status: OrderStatus): number {
  if (status === 'preparing') return 1
  if (status === 'ready') return 2
  if (status === 'served') return 3
  return 0
}

function FloatingCartTrigger({ onClick }: { onClick: () => void }) {
  const { theme } = useTheme()
  const cartItems = useCartStore((s) => s.items)
  const count = cartItems.reduce((sum, i) => sum + i.quantity, 0)
  const subtotal = cartItems.reduce(
    (sum, i) => sum + (i.price + i.modifiersPriceDelta) * i.quantity,
    0,
  )
  const style = theme.cartStyle
  const footerStyle = theme.cartFooterTriggerStyle ?? (style === 'banner' ? 'bar' : style === 'fab' ? 'fab' : 'pill')
  const iconKind = theme.cartIcon
  const showBadge = theme.cartShowBadge
  const radius = theme.radius
  const showSubtotal = theme.cartShowSubtotal ?? true
  const showItemCount = theme.cartShowItemCount ?? true
  const pillPosition = theme.cartPillPosition ?? 'floating'
  const pillTone = theme.cartPillTone ?? 'dark'
  const spainBar = theme.bodyFont === 'Hanken Grotesk'
  const spainActionLabel = theme.cartButtonText || 'Pay'

  if (spainBar) {
    if (theme.cartStyle === 'fab') {
      return (
        <button
          type="button"
          onClick={onClick}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 20,
            zIndex: 45,
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: 'none',
            background: 'var(--p-cta)',
            color: '#fff',
            boxShadow: '0 18px 36px rgba(28,28,25,.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <CartIconSvg kind={iconKind} color="currentColor" size={25} />
          {showBadge && count > 0 && (
            <span style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 22,
              height: 22,
              padding: '0 6px',
              borderRadius: 999,
              background: '#7eb928',
              color: '#fff',
              border: '2px solid #fff',
              fontSize: 11,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>{count}</span>
          )}
        </button>
      )
    }

    if (theme.cartStyle === 'pill') {
      return (
        <button
          type="button"
          onClick={onClick}
          style={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            right: 20,
            maxWidth: 390,
            margin: '0 auto',
            zIndex: 45,
            height: 66,
            border: 'none',
            borderRadius: 18,
            background: '#1c1c19',
            color: '#fff',
            padding: '0 18px',
            boxShadow: '0 18px 42px rgba(28,28,25,.24)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            fontFamily: 'var(--p-body)',
          }}
        >
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <CartIconSvg kind={iconKind} color="currentColor" size={22} />
            {showBadge && count > 0 && (
              <span style={{
                position: 'absolute',
                top: -11,
                right: -11,
                minWidth: 20,
                height: 20,
                borderRadius: 999,
                background: '#7eb928',
                fontSize: 11,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>{count}</span>
            )}
          </span>
          <span style={{ flex: 1, textAlign: 'left', fontSize: 16, fontWeight: 700 }}>{spainActionLabel}</span>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{formatTRY(subtotal || 0)}</span>
        </button>
      )
    }

    return (
      <footer
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: 430,
          margin: '0 auto',
          zIndex: 45,
          borderRadius: '12px 12px 0 0',
          background: '#000',
          color: '#fff',
          padding: '20px 24px 14px',
          boxShadow: '0 -8px 28px rgba(28,28,25,.18)',
          fontFamily: 'var(--p-body)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <button
            type="button"
            onClick={onClick}
            style={{
              minWidth: 0,
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              padding: 0,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 28, lineHeight: '34px', fontWeight: 650 }}>
                {formatTRY(subtotal || 0)}
              </span>
              <span style={{ opacity: 0.6, display: 'inline-flex' }}>
                <InfoIcon />
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'rgba(255,255,255,.7)',
              fontSize: 14,
              lineHeight: '20px',
              letterSpacing: '0.05em',
              fontWeight: 500,
            }}>
              <span>Total Table 12</span>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,.3)' }} />
              <span>4 persons</span>
            </div>
          </button>
          <button
            type="button"
            onClick={onClick}
            style={{
              border: 'none',
              borderRadius: 999,
              background: 'var(--p-cta)',
              color: '#fff',
              padding: '12px 24px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <CartIconSvg kind={iconKind} color="currentColor" size={20} />
            {spainActionLabel}
          </button>
        </div>
        {showBadge && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            marginTop: 20,
            paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,.1)',
          }}>
            <SpainTab active icon={<MenuTabIcon />} label="Menu" />
            <SpainTab icon={<CartIconSvg kind="cart" color="currentColor" size={20} />} label="Order" />
            <SpainTab icon={<PaymentSmallIcon />} label="Split" />
            <SpainTab icon={<ServiceIcon />} label="Service" />
          </div>
        )}
      </footer>
    )
  }

  if (count === 0 || footerStyle === 'none') return null

  const toneStyles = {
    dark: {
      background: 'var(--p-text)',
      foreground: '#fff',
      muted: 'rgba(255,255,255,.72)',
      chipBg: 'rgba(255,255,255,.12)',
      chipFg: '#fff',
      border: 'rgba(255,255,255,.08)',
      shadow: '0 18px 42px rgba(15,23,42,.24)',
    },
    accent: {
      background: 'linear-gradient(135deg, var(--p-accent), var(--p-cta))',
      foreground: '#fff',
      muted: 'rgba(255,255,255,.78)',
      chipBg: 'rgba(255,255,255,.16)',
      chipFg: '#fff',
      border: 'rgba(255,255,255,.14)',
      shadow: '0 18px 42px rgba(46,125,82,.28)',
    },
    light: {
      background: '#ffffff',
      foreground: 'var(--p-text)',
      muted: 'var(--p-text-2)',
      chipBg: 'var(--p-accent-soft)',
      chipFg: 'var(--p-accent)',
      border: 'var(--p-border, rgba(0,0,0,.08))',
      shadow: '0 18px 42px rgba(15,23,42,.14)',
    },
  }[pillTone]
  const edge = pillPosition === 'edge'
  const badge = showBadge && count > 0 ? (
    <span style={{
      position: 'absolute',
      top: -6,
      right: -6,
      minWidth: 18,
      height: 18,
      padding: '0 4px',
      borderRadius: 999,
      fontSize: 10,
      fontWeight: 900,
      backgroundColor: 'var(--p-cta)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid #fff',
    }}>{count > 99 ? '99+' : count}</span>
  ) : null

  if (footerStyle === 'fab') {
    return (
      <button
        onClick={onClick}
        style={{
          position: 'fixed', bottom: 24, right: 20,
          width: 60, height: 60, borderRadius: '50%',
          backgroundColor: 'var(--p-accent)', color: '#fff',
          border: 'none', cursor: 'pointer', zIndex: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 14px 30px -10px rgba(46,125,82,.55)',
        }}
      >
        <CartIconSvg kind={iconKind} color="#fff" size={24} />
        {badge}
      </button>
    )
  }

  if (footerStyle === 'tabbar') {
    const tabs = [
      { icon: <MenuTabIcon />, label: 'Menü', active: false },
      { icon: <SearchSmallIcon />, label: 'Ara', active: false },
      { icon: <CartIconSvg kind={iconKind} color="currentColor" size={21} />, label: 'Sepet', active: true },
    ]
    return (
      <nav style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        maxWidth: 430,
        margin: '0 auto',
        height: 68,
        borderTop: '1px solid var(--p-border, rgba(0,0,0,.08))',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '6px 18px 10px',
        boxShadow: '0 -12px 28px rgba(15,23,42,.08)',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={tab.label === 'Sepet' ? onClick : undefined}
            style={{
              position: 'relative',
              border: 'none',
              background: 'transparent',
              color: tab.active ? 'var(--p-accent)' : 'var(--p-text-3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'var(--p-body)',
              fontSize: 10.5,
              fontWeight: tab.active ? 850 : 650,
              cursor: tab.active ? 'pointer' : 'default',
            }}
          >
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              {tab.icon}
              {tab.active ? badge : null}
            </span>
            {tab.label}
          </button>
        ))}
      </nav>
    )
  }

  if (footerStyle === 'thumbs') {
    const thumbs = cartItems.slice(0, 3).map((item) => item.name.slice(0, 1).toLocaleUpperCase('tr'))
    return (
      <div style={{ position: 'fixed', left: 14, right: 14, bottom: 18, zIndex: 30, maxWidth: 430, margin: '0 auto' }}>
        <button
          type="button"
          onClick={onClick}
          style={{
            width: '100%',
            minHeight: 58,
            borderRadius: 999,
            border: 'none',
            background: 'var(--p-text)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            padding: '0 8px 0 10px',
            fontFamily: 'var(--p-body)',
            boxShadow: '0 16px 34px -12px rgba(15,23,42,.48)',
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            {thumbs.map((label, index) => (
              <span key={`${label}-${index}`} style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                background: '#fff',
                color: 'var(--p-accent)',
                border: '2px solid var(--p-text)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 900,
                marginLeft: index ? -12 : 0,
                zIndex: 4 - index,
              }}>
                {label}
              </span>
            ))}
            <span style={{ marginLeft: 10, color: '#fff', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {count} ürün
            </span>
          </span>
          <span style={{
            height: 40,
            padding: '0 15px',
            borderRadius: 999,
            background: 'var(--p-cta)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 900,
            whiteSpace: 'nowrap',
          }}>
            {showSubtotal ? formatTRY(subtotal) : theme.cartButtonText || 'Aç'} →
          </span>
        </button>
      </div>
    )
  }

  if (footerStyle === 'bar') {
    return (
      <div style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        maxWidth: 430,
        margin: '0 auto',
        padding: '12px 12px 14px',
        background: 'linear-gradient(to top, var(--p-bg) 68%, rgba(255,255,255,0))',
      }}>
        <button
          onClick={onClick}
          style={{
            width: '100%',
            minHeight: 58,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            padding: '0 8px 0 16px',
            background: 'var(--p-accent)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            border: 'none',
            boxShadow: '0 14px 28px -10px rgba(46,125,82,.48)',
            cursor: 'pointer',
            fontFamily: 'var(--p-body)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
              <CartIconSvg kind={iconKind} color="#fff" size={22} />
              {badge}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{theme.cartButtonText || 'Sepeti gör'}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            {showSubtotal && <span style={{ fontSize: 16, fontWeight: 900 }}>{formatTRY(subtotal)}</span>}
            <span style={{ width: 38, height: 42, borderRadius: 12, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center', fontSize: 18 }}>→</span>
          </span>
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: edge ? 0 : 20,
        left: edge ? 0 : 16,
        right: edge ? 0 : 16,
        maxWidth: edge ? 'none' : 430,
        margin: edge ? 0 : '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: edge ? 72 : 66,
        padding: edge ? '14px 18px 18px' : '12px 14px',
        background: toneStyles.background,
        color: toneStyles.foreground,
        fontWeight: 650,
        fontSize: 15,
        border: `1px solid ${toneStyles.border}`,
        borderRadius: edge ? `${Math.max(radius + 6, 18)}px ${Math.max(radius + 6, 18)}px 0 0` : Math.max(radius + 8, 18),
        boxShadow: toneStyles.shadow,
        cursor: 'pointer', zIndex: 30,
        fontFamily: 'var(--p-body)',
        overflow: 'hidden',
      }}
    >
      <span style={{
        position: 'relative',
        flexShrink: 0,
        width: 42,
        height: 42,
        borderRadius: 999,
        background: toneStyles.chipBg,
        color: toneStyles.chipFg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <CartIconSvg kind={iconKind} color="currentColor" size={22} />
        {showBadge && count > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            minWidth: 20, height: 20, padding: '0 5px',
            borderRadius: 999, fontSize: 10, fontWeight: 800,
            backgroundColor: 'var(--p-cta)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid currentColor',
          }}>{count > 99 ? '99+' : count}</span>
        )}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{theme.cartButtonText || 'Sepeti gör'}</span>
        {showItemCount && (
          <span style={{ fontSize: 11.5, fontWeight: 500, color: toneStyles.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {count} ürün sepette
          </span>
        )}
      </span>
      {showSubtotal && (
        <span style={{
          flexShrink: 0,
          fontWeight: 800,
          fontSize: 16,
          letterSpacing: '-0.01em',
          maxWidth: 116,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{formatTRY(subtotal)}</span>
      )}
    </button>
  )
}

function SpainTab({ active = false, icon, label }: { active?: boolean; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      style={{
        border: 'none',
        background: 'transparent',
        color: active ? '#fff' : 'rgba(255,255,255,.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 0,
        fontSize: 10,
        lineHeight: 1,
        letterSpacing: '0.1em',
        fontWeight: active ? 800 : 500,
        textTransform: 'uppercase',
      }}
    >
      <span style={{ display: 'inline-flex' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  )
}

function PaymentSmallIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </svg>
  )
}

function SearchSmallIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function MenuTabIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 3a1 1 0 0 1 1 1v7.2a3.2 3.2 0 0 1-2 2.96V20a1 1 0 1 1-2 0v-5.84a3.2 3.2 0 0 1-2-2.96V4a1 1 0 0 1 2 0v7.2a1.2 1.2 0 0 0 2.4 0V4a1 1 0 0 1 1-1Zm10.5 0A2.5 2.5 0 0 1 20 5.5V20a1 1 0 1 1-2 0v-5h-3V5.5A2.5 2.5 0 0 1 17.5 3Z" />
    </svg>
  )
}

function ServiceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 18h16M6 18v-1a6 6 0 0 1 12 0v1M12 7V4" />
      <path d="M10 4h4" />
    </svg>
  )
}

interface Props {
  restaurant: Tables<'restaurants'>
  categories: MenuCategory[]
  items: MenuItem[]
  theme: GarsonlessTheme
  templateId: string
  tableId?: string
  tableLabel?: string | null
  initialTableSession?: TableSessionInfo | null
  initialSessionOrders?: SessionOrderRow[]
  initialMember?: { name: string | null } | null
  initialMemberBalances?: MemberBalances | null
  isPreview?: boolean
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function readStoreInfo(settings: unknown): StoreInfo | null {
  if (!isPlainRecord(settings)) return null
  const rawContact = isPlainRecord(settings['contact']) ? settings['contact'] : null
  const rawHours = isPlainRecord(settings['hours']) ? settings['hours'] : null

  const contact: NonNullable<StoreInfo['contact']> = {}
  if (rawContact) {
    for (const key of ['phone', 'email', 'website', 'address', 'district', 'city', 'zip', 'instagram', 'facebook', 'tiktok', 'whatsapp'] as const) {
      const value = cleanString(rawContact[key])
      if (value) contact[key] = value
    }
  }

  const hours: NonNullable<StoreInfo['hours']> = {}
  if (rawHours) {
    for (const [day, value] of Object.entries(rawHours)) {
      if (!isPlainRecord(value)) continue
      const open = cleanString(value['open'])
      const close = cleanString(value['close'])
      const active = typeof value['active'] === 'boolean' ? value['active'] : Boolean(open && close)
      hours[day] = { ...(open ? { open } : {}), ...(close ? { close } : {}), active }
    }
  }

  const hasContact = Object.keys(contact).length > 0
  const hasHours = Object.keys(hours).length > 0
  if (!hasContact && !hasHours) return null
  return {
    ...(hasContact ? { contact } : {}),
    ...(hasHours ? { hours } : {}),
  }
}

export function MenuPageClient({
  restaurant,
  categories,
  items,
  theme,
  templateId,
  tableId,
  tableLabel,
  initialTableSession = null,
  initialSessionOrders = [],
  initialMember = null,
  initialMemberBalances = null,
  isPreview = false,
}: Props) {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [dietaryFilters, setDietaryFilters] = useState<DietaryFilter[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null)
  const [paymentTotal, setPaymentTotal] = useState(0)
  const [isSplitOpen, setIsSplitOpen] = useState(false)
  // Table bill (adisyon) state
  const [tableSession, setTableSession] = useState<TableSessionInfo | null>(initialTableSession)
  const [billOrders, setBillOrders] = useState<BillOrder[]>(initialSessionOrders)
  const [isBillOpen, setIsBillOpen] = useState(false)
  const [billRefreshing, setBillRefreshing] = useState(false)
  const [billClosedNotice, setBillClosedNotice] = useState(false)
  const tableSessionId = tableSession?.id ?? null
  // Membership (loyalty) — Phase 2: identity + earning balances
  const [member, setMember] = useState<{ name: string | null } | null>(initialMember)
  const [memberBalances, setMemberBalances] = useState<MemberBalances | null>(initialMemberBalances)
  const [isMemberOpen, setIsMemberOpen] = useState(false)
  const storeInfo = useMemo(() => readStoreInfo(restaurant.settings), [restaurant.settings])
  const loyaltyConfig = (restaurant.settings as Record<string, unknown> | null)?.['loyalty'] as
    | {
        stamp_enabled?: boolean; points_enabled?: boolean; points_redeem_rate?: number; member_discount_pct?: number; reward_item_id?: string
        welcome_bonus_points?: number; reward_catalog?: Array<{ itemId?: string; pointCost?: number; tag?: string | null }>
      }
    | undefined
  const loyaltyEnabled = Boolean(loyaltyConfig?.stamp_enabled || loyaltyConfig?.points_enabled)
  const pointsRate = Math.max(1, loyaltyConfig?.points_redeem_rate ?? 100)
  const memberPct = Math.max(0, Math.min(100, loyaltyConfig?.member_discount_pct ?? 0))
  const rewardItemId = typeof loyaltyConfig?.reward_item_id === 'string' ? loyaltyConfig.reward_item_id : null
  const welcomeBonus = Math.max(0, loyaltyConfig?.welcome_bonus_points ?? 0)
  // Resolve the configured reward catalog (item ids → live menu-item names) for the
  // member-home teaser/sheet + cart redemption (15c).
  const rewardCatalog = (loyaltyConfig?.reward_catalog ?? [])
    .map((r) => {
      const item = items.find((it) => it.id === r.itemId)
      if (!item || typeof r.pointCost !== 'number' || r.pointCost <= 0) return null
      return { itemId: item.id, name: item.name, pointCost: r.pointCost, tag: r.tag ?? null }
    })
    .filter((r): r is { itemId: string; name: string; pointCost: number; tag: string | null } => r !== null)
  // Phase 3a/3b/3c: points redemption + member-% + stamp free item (cart preview).
  // redeemPoints is the requested POINTS count; the cart works in ₺ (redeemTl = redeemPoints / rate).
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [claimStamp, setClaimStamp] = useState(false)
  // 15c: active catalog reward claim (the menu-item id), or null.
  const [catalogItemId, setCatalogItemId] = useState<string | null>(null)
  const [discountPreview, setDiscountPreview] = useState<
    { subtotal: number; memberDiscountAmount: number; memberDiscountPct: number; memberTierName: string | null; pointsDiscountAmount: number; stampDiscountAmount: number; rewardItemName: string | null; catalogDiscountAmount: number; catalogItemName: string | null; catalogPointsCost: number; finalTotal: number } | null
  >(null)

  const refetchBalances = useCallback(async () => {
    if (!loyaltyEnabled) return
    try {
      const res = await fetch(`/api/loyalty/balances?restaurantId=${restaurant.id}`)
      if (!res.ok) return // 401 = not a member; leave balances null
      const json = (await res.json()) as { ok: boolean; balances?: MemberBalances | null }
      if (json.ok) setMemberBalances(json.balances ?? null)
    } catch {
      /* best-effort live refresh */
    }
  }, [loyaltyEnabled, restaurant.id])

  // Member logout: clear the httpOnly cookie server-side, then drop all member
  // state so the Header chip flips back to "Üye ol" without a hard refresh.
  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/loyalty/logout', { method: 'POST' })
    } catch {
      /* clear local state regardless */
    }
    setMember(null)
    setMemberBalances(null)
    setRedeemPoints(0)
    setClaimStamp(false)
    setCatalogItemId(null)
    setDiscountPreview(null)
    setIsMemberOpen(false)
  }, [])

  const canRedeem = Boolean(member && memberBalances?.pointsEnabled && (memberBalances?.points ?? 0) > 0)
  const stampClaimable = Boolean(member && memberBalances?.stampEnabled && memberBalances?.stampUnlocked && rewardItemId)
  // Preview whenever a member could get ANY discount: points, standing member-%,
  // a full stamp card, or an active catalog reward. (Reward-in-cart + affordability
  // are enforced server-side.)
  const canPreview = Boolean(member && (canRedeem || memberPct > 0 || stampClaimable || catalogItemId != null))
  // Minimize-to-bubble presentation state (sheet animation + notifications are ephemeral)
  const [sheetClosing, setSheetClosing] = useState(false)
  const [unseen, setUnseen] = useState(0)
  const [toastPhase, setToastPhase] = useState<number | null>(null)
  const [bubbleWiggle, setBubbleWiggle] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wiggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPhaseRef = useRef<number | null>(null)

  const sessionId = useCartStore((s) => s.sessionId)
  const deviceId = useCartStore((s) => s.deviceId)

  const cartItems = useCartStore((s) => s.items)
  const storedTableId = useCartStore((s) => s.tableId)
  const subtotal = useCartStore((s) => s.subtotal)
  const addItem = useCartStore((s) => s.addItem)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const clearCart = useCartStore((s) => s.clearCart)
  const setStoreTableId = useCartStore((s) => s.setTableId)

  // Effective table identity: the route param wins (fresh scan), else the
  // device's stored table. The adisyon (table bill) is keyed on the table
  // SESSION existing — not on the route param — so the "Hesap" chip shows on
  // /maf-lounge too when the device already has an open table.
  const effectiveTableId = tableId ?? storedTableId

  const {
    callState: waiterCallState,
    callWaiter,
    sendServiceRequest,
  } = useWaiterCall(restaurant.id, effectiveTableId ?? null)

  // Discount preview (server-computed; NO client money math). Debounced; refetched
  // when cart or requested redemption changes. Guests / non-redeemers → null.
  useEffect(() => {
    if (!canPreview || cartItems.length === 0) { setDiscountPreview(null); return }
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/loyalty/preview-discount', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId: restaurant.id,
            items: cartItems.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
              selectedModifiers: i.modifiers,
              removedIngredientIds: i.removedIngredientIds,
            })),
            redeemPoints,
            redeemStampClaim: claimStamp,
            catalogItemId,
          }),
        })
        if (!res.ok) return
        const json = (await res.json()) as {
          ok: boolean
          preview?: { subtotal: number; memberDiscountAmount: number; memberDiscountPct: number; memberTierName: string | null; pointsDiscountAmount: number; stampDiscountAmount: number; rewardItemName: string | null; catalogDiscountAmount: number; catalogItemName: string | null; catalogPointsCost: number; finalTotal: number }
        }
        if (json.ok && json.preview) setDiscountPreview(json.preview)
      } catch { /* preview is best-effort */ }
    }, 250)
    return () => clearTimeout(t)
  }, [canPreview, cartItems, redeemPoints, claimStamp, catalogItemId, restaurant.id])

  const orderId = useOrderStore((s) => s.orderId)
  const orderStatus = useOrderStore((s) => s.status)
  const orderMeta = useOrderStore((s) => s.meta)
  const orderView = useOrderStore((s) => s.view)
  const isPlacing = useOrderStore((s) => s.isPlacing)
  const setOrder = useOrderStore((s) => s.setOrder)
  const setOrderStatus = useOrderStore((s) => s.setStatus)
  const setOrderMeta = useOrderStore((s) => s.setMeta)
  const setOrderView = useOrderStore((s) => s.setView)
  const setIsPlacing = useOrderStore((s) => s.setIsPlacing)
  const setError = useOrderStore((s) => s.setError)
  const resetOrder = useOrderStore((s) => s.reset)

  const snapshotOrderItems = (): OrderSummaryItem[] =>
    cartItems.map((i) => ({
      quantity: i.quantity,
      name: i.name,
      unitPrice: i.price + i.modifiersPriceDelta,
      modifierNames: i.modifierNames,
      removedIngredientNames: i.removedIngredientNames,
      ...(i.originalPrice !== undefined && i.originalPrice !== i.price
        ? { originalPrice: i.originalPrice + i.modifiersPriceDelta }
        : {}),
    }))

  useEffect(() => {
    void useCartStore.persist.rehydrate()
  }, [])

  // Restore a persisted active order on page load: re-fetch its current
  // status (never trust the stale one), then resume as a bubble.
  useEffect(() => {
    let cancelled = false
    const restore = async () => {
      await useOrderStore.persist.rehydrate()
      if (cancelled) return
      const state = useOrderStore.getState()
      if (!state.orderId) return
      // Never restore into a full-screen sheet uninvited
      if (state.view === 'sheet') state.setView('bubble')

      const tooOld =
        !state.meta?.createdAt ||
        Date.now() - new Date(state.meta.createdAt).getTime() > 6 * 3_600_000
      if (tooOld) {
        state.reset()
        return
      }

      const supabase = createMenuBrowserClient()
      const { data } = await supabase
        .from('orders')
        .select('status, paid_at')
        .eq('id', state.orderId)
        .maybeSingle()
      if (cancelled) return

      const row = data as { status: string; paid_at: string | null } | null
      const fetched = row?.status as OrderStatus | undefined
      if (!fetched || fetched === 'served' || fetched === 'cancelled') {
        useOrderStore.getState().reset()
        return
      }
      prevPhaseRef.current = statusPhase(fetched)
      useOrderStore.getState().setStatus(fetched)
      if (row?.paid_at) {
        const { meta, setMeta } = useOrderStore.getState()
        if (meta && !meta.paid) setMeta({ ...meta, paid: true })
      }
      useOrderStore.getState().setView('bubble')
    }
    void restore()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (tableId && tableId !== storedTableId) {
      setStoreTableId(tableId)
    }
  }, [tableId, storedTableId, setStoreTableId])

  useEffect(() => {
    if (tableId || !storedTableId) return
    let cancelled = false
    const validateStoredTable = async () => {
      const supabase = createMenuBrowserClient()
      const { data, error } = await supabase
        .from('tables')
        .select('id')
        .eq('id', storedTableId)
        .eq('restaurant_id', restaurant.id)
        .is('deleted_at', null)
        .maybeSingle()
      if (!cancelled && !error && !data) setStoreTableId(null)
    }
    void validateStoredTable()
    return () => { cancelled = true }
  }, [restaurant.id, tableId, storedTableId, setStoreTableId])

  const handleAddToCart = useCallback(
    (
      item: MenuItem,
      modifiers: ReturnType<typeof useCartStore.getState>['items'][0]['modifiers'],
      quantity: number,
      removedIngredientIds: string[],
    ) => {
      addItem(item, modifiers, item.modifier_groups, quantity, undefined, removedIngredientIds)
    },
    [addItem],
  )

  const handleOpenProduct = useCallback((item: MenuItem) => {
    setSelectedItem(item)
  }, [])

  const handleQuickAdd = useCallback((item: MenuItem, originalPrice?: number) => {
    if (item.modifier_groups.length > 0 || item.ingredients.some((ingredient) => ingredient.removable)) {
      setSelectedItem(item)
    } else {
      addItem(item, [], [], 1, originalPrice)
      setIsCartOpen(true)
    }
  }, [addItem])

  // 15c: claim a catalog reward → ensure the reward item is in the cart (add one
  // if missing), set the catalog intent (server validates + debits), drop any
  // points-as-₺ request (either/or), then jump to the cart.
  const handleRedeemCatalog = useCallback((itemId: string) => {
    const item = items.find((it) => it.id === itemId)
    if (!item) return
    if (!cartItems.some((ci) => ci.itemId === itemId)) addItem(item, [], [], 1)
    setCatalogItemId(itemId)
    setRedeemPoints(0)
    setIsMemberOpen(false)
    setIsCartOpen(true)
  }, [items, cartItems, addItem])

  // If the claimed reward item is no longer in the cart, drop the catalog intent.
  useEffect(() => {
    if (catalogItemId && !cartItems.some((ci) => ci.itemId === catalogItemId)) setCatalogItemId(null)
  }, [catalogItemId, cartItems])

  type OrderBreakdown = { subtotal: number; pointsDiscountAmount: number; finalTotal: number; pointsRedeemed: number; clamped: boolean }
  const orderBody = () => ({
    restaurantId: restaurant.id,
    slug: restaurant.slug, // server cross-checks slug→restaurant.id (anti-spoof)
    tableId: effectiveTableId ?? null,
    sessionId,
    items: cartItems.map((i) => ({
      itemId: i.itemId,
      quantity: i.quantity,
      selectedModifiers: i.modifiers,
      removedIngredientIds: i.removedIngredientIds,
    })),
    redeemPoints,
    redeemStampClaim: claimStamp,
    catalogItemId,
  })

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) return
    setIsPlacing(true)
    const summaryItems = snapshotOrderItems()

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderBody()),
    })

    const json = (await res.json()) as { success: boolean; data?: { orderId: string; breakdown: OrderBreakdown }; error?: string }

    if (!json.success || !json.data) {
      setError(json.error ?? 'Failed to place order')
      return
    }

    // Server is the source of truth for money — use the recomputed finalTotal.
    setOrderMeta({ items: summaryItems, total: json.data.breakdown.finalTotal, createdAt: new Date().toISOString(), paid: false })
    setOrder(json.data.orderId)
    setOrderView('sheet')
    prevPhaseRef.current = 0
    if (effectiveTableId) void refreshBill()
    if (member) void refetchBalances() // points were just debited
    clearCart()
    setRedeemPoints(0)
    setClaimStamp(false)
    setCatalogItemId(null)
    setDiscountPreview(null)
    setIsCartOpen(false)
    setIsPlacing(false)
  }

  const handlePayClick = async () => {
    if (cartItems.length === 0) return
    setIsPlacing(true)
    const summaryItems = snapshotOrderItems()
    const previewedTotal = discountPreview?.finalTotal ?? subtotal()

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderBody()),
    })

    const json = (await res.json()) as { success: boolean; data?: { orderId: string; breakdown: OrderBreakdown }; error?: string }

    if (!json.success || !json.data) {
      setIsPlacing(false)
      setError(json.error ?? 'Failed to place order')
      return
    }

    const finalTotal = json.data.breakdown.finalTotal

    // Addition C: never silently charge more than the customer saw. If a
    // concurrent redeem clamped the discount (amount went UP), re-confirm.
    if (json.data.breakdown.clamped && finalTotal > previewedTotal) {
      const ok = window.confirm(
        `Puan bakiyen değiştiği için tutar güncellendi.\nYeni tutar: ${formatTRY(finalTotal)}\nÖdemeye devam edilsin mi?`,
      )
      if (!ok) {
        // Order is already placed (pay-later); just don't open İyzico now.
        setOrderMeta({ items: summaryItems, total: finalTotal, createdAt: new Date().toISOString(), paid: false })
        setOrder(json.data.orderId)
        setOrderView('sheet')
        prevPhaseRef.current = 0
        if (member) void refetchBalances()
        clearCart(); setRedeemPoints(0); setClaimStamp(false); setCatalogItemId(null); setDiscountPreview(null)
        setIsCartOpen(false); setIsPlacing(false)
        return
      }
    }

    setIsPlacing(false)
    // The order exists before checkout starts, but is NOT paid until the
    // verified İyzico callback says so. Keep it trackable even if the customer
    // closes checkout or chooses table settlement.
    setOrderMeta({ items: summaryItems, total: finalTotal, createdAt: new Date().toISOString(), paid: false })
    setOrder(json.data.orderId)
    setOrderView('bubble')
    prevPhaseRef.current = 0
    if (effectiveTableId) void refreshBill()
    if (member) void refetchBalances()
    clearCart()
    setRedeemPoints(0)
    setClaimStamp(false)
    setCatalogItemId(null)
    setDiscountPreview(null)
    setIsCartOpen(false)
    setPaymentTotal(finalTotal)
    setPaymentOrderId(json.data.orderId)
  }

  const subscribeRealtime = useCallback(
    (oid: string, onStatusChange: (status: OrderStatus, paidAt: string | null) => void) => {
      const supabase = createMenuBrowserClient()
      // Unique topic per subscription: the browser client is a singleton, and
      // two subscribers (page + confirmation sheet) on the same topic would
      // throw "cannot add postgres_changes callbacks after subscribe()".
      const channel = supabase
        .channel(`order-${oid}-${Math.random().toString(36).slice(2, 8)}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${oid}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            const newStatus = payload.new['status'] as OrderStatus | undefined
            const paidAt = (payload.new['paid_at'] as string | null | undefined) ?? null
            if (newStatus) onStatusChange(newStatus, paidAt)
          },
        )
        .subscribe()

      return () => {
        void supabase.removeChannel(channel)
      }
    },
    [],
  )

  // Keep order status flowing into the store even while minimized to the bubble
  // (OrderConfirmation's own subscription only lives while the sheet is open).
  useEffect(() => {
    if (!orderId) return
    return subscribeRealtime(orderId, (next, paidAt) => {
      setOrderStatus(next)
      if (paidAt) {
        const { meta, setMeta } = useOrderStore.getState()
        if (meta && !meta.paid) setMeta({ ...meta, paid: true })
      }
      // The member's own order hit an earning trigger (served / paid) → the
      // ledger may have changed. Refetch balances (cookie-scoped service read).
      if (member) void refetchBalances()
    })
  }, [orderId, subscribeRealtime, setOrderStatus, member, refetchBalances])

  // Bubble notifications: phase moved forward while minimized → unseen + wiggle + toast
  useEffect(() => {
    if (!orderStatus || orderStatus === 'cancelled') {
      prevPhaseRef.current = null
      return
    }
    const phase = statusPhase(orderStatus)
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase
    if (prev === null || phase <= prev) return
    if (orderView !== 'bubble') return

    setUnseen((u) => u + 1)
    setToastPhase(phase)
    setBubbleWiggle(true)
    if (wiggleTimerRef.current) clearTimeout(wiggleTimerRef.current)
    wiggleTimerRef.current = setTimeout(() => setBubbleWiggle(false), 650)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastPhase(null), 4200)
  }, [orderStatus, orderView])

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    if (wiggleTimerRef.current) clearTimeout(wiggleTimerRef.current)
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  // ─── Table bill (adisyon) ───
  const refreshBill = useCallback(async (): Promise<'open' | 'closed' | 'none'> => {
    if (!effectiveTableId) return 'none'
    const supabase = createMenuBrowserClient()
    const { data: sess } = await supabase
      .from('table_sessions')
      .select('id, opened_at')
      .eq('restaurant_id', restaurant.id)
      .eq('table_id', effectiveTableId)
      .is('closed_at', null)
      .maybeSingle()
    const sessionRow = sess as { id: string; opened_at: string } | null
    if (!sessionRow) {
      setTableSession(null)
      return 'closed'
    }
    const { data: rows } = await supabase
      .from('orders')
      .select('id, status, total, paid_at, created_at, items')
      .eq('table_session_id', sessionRow.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    setTableSession({ id: sessionRow.id, openedAt: sessionRow.opened_at })
    setBillOrders(((rows ?? []) as Array<{
      id: string; status: string; total: number; paid_at: string | null; created_at: string; items: unknown
    }>).map((row) => ({
      id: row.id,
      status: row.status,
      total: Number(row.total),
      paidAt: row.paid_at,
      createdAt: row.created_at,
      itemCount: Array.isArray(row.items) ? row.items.length : 0,
    })))
    return 'open'
  }, [effectiveTableId, restaurant.id])

  async function openBill() {
    setIsBillOpen(true)
    setBillClosedNotice(false)
    setBillRefreshing(true)
    const result = await refreshBill()
    setBillRefreshing(false)
    // Cheap close detection: restaurant closed the adisyon while we held stale state
    if (result === 'closed') setBillClosedNotice(true)
  }

  function closeBill() {
    setIsBillOpen(false)
    if (billClosedNotice) {
      setBillOrders([])
      setBillClosedNotice(false)
    }
  }

  // Live bill: another device's order lands in the open session → refresh list
  useEffect(() => {
    if (!tableSessionId) return
    const supabase = createMenuBrowserClient()
    const channel = supabase
      .channel(`bill-${tableSessionId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `table_session_id=eq.${tableSessionId}` },
        () => { void refreshBill() },
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [tableSessionId, refreshBill])

  // Non-table route gap-fill: when the device already has an open table (stored
  // table hydrates after mount) but the page wasn't a /table/{id} SSR render,
  // fetch the open session so the "Hesap" chip can appear. The /table/{id} path
  // supplies initialTableSession via SSR, so we skip there (no double-fetch).
  useEffect(() => {
    if (effectiveTableId && !initialTableSession) void refreshBill()
  }, [effectiveTableId, initialTableSession, refreshBill])

  const billSummary = (() => {
    const active = billOrders.filter((o) => o.status !== 'cancelled')
    if (!tableSession || active.length === 0) return null
    return { total: active.reduce((sum, o) => sum + o.total, 0), count: billOrders.length }
  })()

  function openOrderSheet() {
    setUnseen(0)
    setToastPhase(null)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setSheetClosing(false)
    setOrderView('sheet')
  }

  function handleSheetClose() {
    const finished = orderStatus === 'served' || orderStatus === 'cancelled'
    if (finished) {
      // reset() also clears meta/view, which wipes the persisted entry
      resetOrder()
      setUnseen(0)
      setToastPhase(null)
      prevPhaseRef.current = null
      return
    }
    // Minimize: play ob-sheet-down, then switch to the bubble
    setSheetClosing(true)
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => {
      setSheetClosing(false)
      setOrderView('bubble')
    }, 340)
  }

  const filteredItems = useMemo(
    () => dietaryFilters.length === 0
      ? items
      : items.filter((item) => itemMatchesDietaryFilters(item, dietaryFilters)),
    [dietaryFilters, items],
  )
  const visibleCategories = useMemo(() => {
    if (dietaryFilters.length === 0) return categories
    const visibleIds = new Set(filteredItems.map((item) => item.category_id))
    let changed = true
    while (changed) {
      changed = false
      for (const category of categories) {
        if (!visibleIds.has(category.id) || !category.parent_id || visibleIds.has(category.parent_id)) continue
        visibleIds.add(category.parent_id)
        changed = true
      }
    }
    return categories.filter((category) => visibleIds.has(category.id))
  }, [categories, dietaryFilters.length, filteredItems])

  const itemsByCategory = visibleCategories.reduce<Record<string, MenuItem[]>>((acc, cat) => {
    acc[cat.id] = filteredItems.filter((i) => i.category_id === cat.id)
    return acc
  }, {})

  const categoryMeta = visibleCategories.reduce<Record<string, { imageUrl: string | null; itemCount: number }>>((acc, cat) => {
    const collectIds = (categoryId: string): string[] => [
      categoryId,
      ...visibleCategories
        .filter((category) => category.parent_id === categoryId)
        .flatMap((category) => collectIds(category.id)),
    ]
    const categoryIds = collectIds(cat.id)
    const catItems = categoryIds.flatMap((categoryId) => itemsByCategory[categoryId] ?? [])
    const firstImage = catItems.find((item) => item.images.length > 0)?.images[0] ?? null
    acc[cat.id] = {
      imageUrl: firstImage,
      itemCount: catItems.length,
    }
    return acc
  }, {})

  const toggleDietaryFilter = useCallback((filter: DietaryFilter) => {
    setDietaryFilters((current) => current.includes(filter)
      ? current.filter((candidate) => candidate !== filter)
      : [...current, filter])
  }, [])

  function renderItems(catId: string) {
    const catItems = itemsByCategory[catId] ?? []
    return (
      <>
        {catItems.map((item) => {
          const cartQuantity = cartItems
            .filter((ci) => ci.itemId === item.id)
            .reduce((sum, ci) => sum + ci.quantity, 0)
          return (
            <ProductCard
              key={item.id}
              item={item}
              onOpen={handleOpenProduct}
              onQuickAdd={handleQuickAdd}
              cartQuantity={cartQuantity}
              onIncrement={() => {
                const existing = cartItems.find((ci) => ci.itemId === item.id)
                if (existing) updateQuantity(existing.cartId, existing.quantity + 1)
                else addItem(item, [], [], 1)
              }}
              onDecrement={() => {
                const existing = cartItems.find((ci) => ci.itemId === item.id)
                if (!existing) return
                if (existing.quantity > 1) updateQuantity(existing.cartId, existing.quantity - 1)
                else removeItem(existing.cartId)
              }}
            />
          )
        })}
      </>
    )
  }

  const entry = THEME_REGISTRY[templateId]
  const ThemeMenuPage = entry?.MenuPage ?? THEME_REGISTRY['default']!.MenuPage

  if (orderId && orderStatus && orderView === 'sheet') {
    return (
      <ThemeProvider initialTheme={theme} isPreview={isPreview} initialRestaurantName={restaurant.name} initialLogoUrl={restaurant.logo_url ?? null}>
        <OrderConfirmation
          orderId={orderId}
          initialStatus={orderStatus}
          onSubscribeRealtime={subscribeRealtime}
          onDone={handleSheetClose}
          isPaid={orderMeta?.paid ?? false}
          tableLabel={tableLabel ?? null}
          createdAt={orderMeta?.createdAt ?? null}
          items={orderMeta?.items ?? []}
          total={orderMeta?.total ?? 0}
          closing={sheetClosing}
          {...(effectiveTableId ? { onCallWaiter: callWaiter, waiterCallState } : {})}
        />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider
      initialTheme={theme}
      isPreview={isPreview}
      initialRestaurantName={restaurant.name}
      initialLogoUrl={restaurant.logo_url ?? null}
    >
      <ThemeMenuPage
        categories={visibleCategories}
        categoryMeta={categoryMeta}
        renderItems={renderItems}
        menuFilters={(
          <DietaryFilterBar
            selected={dietaryFilters}
            onToggle={toggleDietaryFilter}
          />
        )}
        orderStatus={orderId && orderStatus && orderView === 'bubble' ? (
          <OrderBubble
            phase={statusPhase(orderStatus)}
            unseen={unseen}
            justChanged={bubbleWiggle}
            onOpen={openOrderSheet}
          />
        ) : null}
        filterEmptyState={dietaryFilters.length > 0 && filteredItems.length === 0 ? (
          <div
            data-component="filter-empty-state"
            role="status"
            style={{
              margin: '18px var(--p-pad) 28px',
              padding: '18px 16px',
              border: 'var(--p-border-w) solid var(--p-border)',
              borderRadius: 'min(var(--p-radius), 12px)',
              background: 'var(--p-card)',
              color: 'var(--p-text-2)',
              textAlign: 'center',
              fontSize: 13,
              lineHeight: 1.45,
              fontWeight: 650,
            }}
          >
            Seçili filtrelere uyan ürün yok.
          </div>
        ) : null}
        tableId={effectiveTableId}
        {...(tableLabel ? { tableLabel } : {})}
        cartSummary={{
          count: cartItems.reduce((sum, item) => sum + item.quantity, 0),
          subtotal: cartItems.reduce((sum, item) => sum + (item.price + item.modifiersPriceDelta) * item.quantity, 0),
        }}
        onOpenCart={() => setIsCartOpen(true)}
        items={filteredItems}
        onQuickAdd={handleQuickAdd}
        billSummary={billSummary}
        onOpenBill={() => { void openBill() }}
        memberSummary={loyaltyEnabled ? {
          name: member?.name ?? null,
          ...(member && memberBalances ? {
            stamps: memberBalances.stamps,
            stampGoal: memberBalances.stampGoal,
            points: memberBalances.points,
            stampEnabled: memberBalances.stampEnabled,
            pointsEnabled: memberBalances.pointsEnabled,
            tierColor: memberBalances.tier.color,
          } : {}),
        } : null}
        onOpenMember={loyaltyEnabled ? () => setIsMemberOpen(true) : undefined}
        memberLoyalty={member && memberBalances && memberBalances.stampEnabled
          ? { filled: memberBalances.stamps, total: memberBalances.stampGoal }
          : null}
        storeInfo={storeInfo}
      />

      <ProductModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onAddToCart={handleAddToCart}
      />

      <CartDrawer
        isOpen={isCartOpen}
        items={cartItems}
        isPlacing={isPlacing}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onPlaceOrder={handlePlaceOrder}
        onPay={handlePayClick}
        onSplitBill={() => { setIsCartOpen(false); setIsSplitOpen(true) }}
        billSummary={billSummary}
        onOpenBill={() => { setIsCartOpen(false); void openBill() }}
        pointsRedeem={canRedeem && !catalogItemId ? {
          balance: memberBalances?.points ?? 0,
          rate: pointsRate,
          redeemTl: Math.floor(redeemPoints / pointsRate),
          onChange: (redeemTl: number) => setRedeemPoints(Math.max(0, redeemTl) * pointsRate),
        } : null}
        stampReward={stampClaimable ? {
          cardFull: true,
          rewardName: items.find((it) => it.id === rewardItemId)?.name ?? null,
          rewardInCart: cartItems.some((ci) => ci.itemId === rewardItemId),
          claimed: claimStamp,
          onToggle: (v: boolean) => setClaimStamp(v),
        } : null}
        catalogReward={catalogItemId ? {
          itemName: rewardCatalog.find((r) => r.itemId === catalogItemId)?.name ?? 'ürün',
          pointCost: rewardCatalog.find((r) => r.itemId === catalogItemId)?.pointCost ?? 0,
          onClear: () => setCatalogItemId(null),
        } : null}
        discountPreview={discountPreview}
      />

      {isBillOpen && (
        <TableBillSheet
          orders={billOrders}
          openedAt={tableSession?.openedAt ?? null}
          closedNotice={billClosedNotice}
          refreshing={billRefreshing}
          onClose={closeBill}
          {...(effectiveTableId ? { onCallWaiter: callWaiter, waiterCallState } : {})}
        />
      )}

      {!isCartOpen && (
        <FloatingCartTrigger onClick={() => setIsCartOpen(true)} />
      )}

      {effectiveTableId && !isCartOpen && !isBillOpen && !selectedItem && !isMemberOpen && !isSplitOpen && !paymentOrderId && (
        <ServiceRequestFab
          tableLabel={tableLabel ?? null}
          onRequest={sendServiceRequest}
        />
      )}

      {orderId && orderStatus && orderView === 'bubble' && toastPhase !== null && (
        <OrderToastNotification phase={toastPhase} onOpen={openOrderSheet} />
      )}

      {paymentOrderId && (
        <PaymentModal
          orderId={paymentOrderId}
          total={paymentTotal}
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          tableLabel={tableLabel ?? null}
          deviceId={deviceId}
          initialBuyerName={member?.name ?? null}
          onClose={() => setPaymentOrderId(null)}
          onSuccess={() => {
            // Only the verified callback reaches this branch.
            const currentMeta = useOrderStore.getState().meta
            if (currentMeta) setOrderMeta({ ...currentMeta, paid: true })
            setPaymentOrderId(null)
            setOrderView('sheet')
          }}
          {...(effectiveTableId ? {
            onPayAtTable: callWaiter,
            onDeferred: () => setOrderView('sheet'),
          } : {})}
        />
      )}

      {isMemberOpen && (
        <MemberSheet
          onClose={() => setIsMemberOpen(false)}
          balances={member ? memberBalances : null}
          memberName={member?.name ?? null}
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          welcomeBonus={welcomeBonus}
          rewardCatalog={rewardCatalog}
          onRedeemCatalog={handleRedeemCatalog}
          onRefresh={refetchBalances}
          onVerified={(m) => { setMember(m); void refetchBalances() }}
          {...(member ? { onLogout: handleLogout } : {})}
        />
      )}

      {isSplitOpen && tableSessionId && (
        <SplitBillModal
          restaurantId={restaurant.id}
          slug={restaurant.slug}
          tableSessionId={tableSessionId}
          onClose={() => setIsSplitOpen(false)}
        />
      )}

    </ThemeProvider>
  )
}
