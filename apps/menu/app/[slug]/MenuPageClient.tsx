'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  ThemeProvider,
  ProductCard,
  OrderBubble,
  OrderToastNotification,
  orderStatusPhase,
  ServiceRequestFab,
  useTheme,
  formatTRY,
  CartIconSvg,
  DietaryFilterBar,
  readStoreInfo,
  isProductConfigurable,
} from '@garsonless/ui'
import type {
  ComboAddRequest,
  DietaryFilter,
  MenuCategory,
  MenuItem,
  ProductModalSubmitOptions,
  SectionPromotionContext,
  SelectedModifier,
} from '@garsonless/ui'
import { allocateBundlePrice } from '@garsonless/domain/menu'
import type { ServiceRequestType } from '@garsonless/domain/tables'
import type { PublicRestaurant, TableSessionInfo, SessionOrderRow } from '../../lib/queries'
import { getSectionDefinitionId, resolveMenuActionPlacements, type GarsonlessTheme } from '@garsonless/design-engine'
import type { MemberBalances } from '@garsonless/db/types'
import { useCartStore } from '../../lib/store/useCartStore'
import { useWaiterCall } from '../../lib/hooks/useWaiterCall'
import { useMenuCatalog } from '../../lib/hooks/useMenuCatalog'
import { useMenuMembership } from '../../lib/hooks/useMenuMembership'
import { useMenuCheckout } from '../../lib/hooks/useMenuCheckout'
import { useOrderTracking } from '../../lib/hooks/useOrderTracking'
import { useTableBill } from '../../lib/hooks/useTableBill'
import { DefaultMenuPage } from '@garsonless/ui/themes/default/MenuPage'

const ProductModal = dynamic(() => import('@garsonless/ui/menu/ProductModal').then((module) => module.ProductModal))
const CartDrawer = dynamic(() => import('@garsonless/ui/menu/CartDrawer').then((module) => module.CartDrawer))
const OrderConfirmation = dynamic(
  () => import('@garsonless/ui/menu/OrderConfirmation').then((module) => module.OrderConfirmation),
  { loading: () => <p role="status" style={{ padding: 24, textAlign: 'center' }}>Sipariş yükleniyor…</p> },
)
const TableBillSheet = dynamic(() => import('@garsonless/ui/menu/TableBillSheet').then((module) => module.TableBillSheet))
const PaymentModal = dynamic(() => import('./components/PaymentModal'))
const MemberSheet = dynamic(() => import('./components/MemberSheet'))
const SplitBillModal = dynamic(() => import('./components/SplitBillModal'))

function FloatingCartTrigger({ onClick }: { onClick: () => void }) {
  const { theme } = useTheme()
  const cartItems = useCartStore((s) => s.items)
  const count = cartItems.reduce((sum, i) => sum + i.quantity, 0)
  const subtotal = cartItems.reduce(
    (sum, i) => sum + (i.price + i.modifiersPriceDelta) * i.quantity,
    0,
  )
  const style = theme.cartStyle
  const configuredFooterStyle = theme.cartFooterTriggerStyle ?? (style === 'banner' ? 'bar' : style === 'fab' ? 'fab' : 'pill')
  const footerStyle = configuredFooterStyle === 'tabbar' ? 'pill' : configuredFooterStyle
  const iconKind = theme.cartIcon
  const showBadge = theme.cartShowBadge
  const radius = theme.radius
  const showSubtotal = theme.cartShowSubtotal ?? true
  const showItemCount = theme.cartShowItemCount ?? true
  const pillPosition = theme.cartPillPosition ?? 'floating'
  const pillTone = theme.cartPillTone ?? 'dark'
  if (resolveMenuActionPlacements(theme).cart !== 'footer') return null

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
      color: 'var(--p-cta-text)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid #fff',
    }}>{count > 99 ? '99+' : count}</span>
  ) : null

  if (footerStyle === 'fab') {
    return (
      <button
        type="button"
        aria-label={`Sepeti aç, ${count} ürün`}
        onClick={onClick}
        style={{
          position: 'fixed', bottom: 'calc(24px + env(safe-area-inset-bottom))', right: 20,
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

  if (footerStyle === 'thumbs') {
    const thumbs = cartItems.slice(0, 3).map((item) => item.name.slice(0, 1).toLocaleUpperCase('tr'))
    return (
      <div style={{ position: 'fixed', left: 14, right: 14, bottom: 18, zIndex: 30, maxWidth: 430, margin: '0 auto' }}>
        <button
          type="button"
          aria-label={`Sepeti aç, ${count} ürün`}
          onClick={onClick}
          style={{
            width: '100%',
            minHeight: 58,
            borderRadius: 999,
            border: 'none',
            background: 'var(--p-text)',
            color: 'var(--p-cta-text)',
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
          type="button"
          aria-label={`Sepeti aç, ${count} ürün`}
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
      type="button"
      aria-label={`Sepeti aç, ${count} ürün`}
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
            backgroundColor: 'var(--p-cta)', color: 'var(--p-cta-text)',
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

interface RequestButtonsOverlayProps {
  enabled: boolean
  tableToken: string | null
  tableLabel: string | null
  hidden: boolean
  onRequest: (type: ServiceRequestType) => Promise<boolean>
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Resolve the global request tool from the live ThemeContext instead of the
 * server-rendered theme prop. Theme Editor updates that context over postMessage,
 * so newly-added request buttons become visible without publishing or reloading.
 */
function RequestButtonsOverlay({
  enabled,
  tableToken,
  tableLabel,
  hidden,
  onRequest,
  open,
  onOpenChange,
}: RequestButtonsOverlayProps) {
  const { theme: liveTheme, isPreview } = useTheme()
  const config = useMemo(() => {
    const block = (liveTheme.pageBlocks ?? []).find(
      (candidate) => candidate.type === 'section' && getSectionDefinitionId(candidate) === 'request-buttons',
    )
    if (block) {
      return liveTheme.sectionSettings?.[block.id]
        ?? liveTheme.sectionSettings?.['request-buttons']
        ?? {}
    }
    return liveTheme.sections?.includes('request-buttons')
      ? (liveTheme.sectionSettings?.['request-buttons'] ?? {})
      : null
  }, [liveTheme.pageBlocks, liveTheme.sectionSettings, liveTheme.sections])

  if (!enabled || config === null || (!tableToken && !isPreview) || (hidden && !open)) return null

  const placements = resolveMenuActionPlacements(liveTheme)

  return (
    <ServiceRequestFab
      tableLabel={tableLabel}
      onRequest={isPreview ? async () => true : onRequest}
      config={config}
      trigger={placements.service === 'floating' ? 'floating' : 'none'}
      open={open}
      onOpenChange={onOpenChange}
    />
  )
}

interface Props {
  restaurant: PublicRestaurant
  categories: MenuCategory[]
  items: MenuItem[]
  theme: GarsonlessTheme
  templateId: string
  /** Revocable public QR credential; internal table IDs never reach this client. */
  tableToken?: string
  tableLabel?: string | null
  initialTableSession?: TableSessionInfo | null
  initialSessionOrders?: SessionOrderRow[]
  initialMember?: { name: string | null } | null
  initialMemberBalances?: MemberBalances | null
  isPreview?: boolean
  /** Server-resolved plan/override entitlement for the global request tool. */
  requestButtonsEnabled?: boolean
}

interface PendingComboSelection {
  modifiers: SelectedModifier[]
  removedIngredientIds: string[]
  productNote?: string
}

interface PendingCombo {
  request: ComboAddRequest
  instanceId: string
  pricedItems: MenuItem[]
  configurationIndices: number[]
  cursor: number
  selections: Record<number, PendingComboSelection>
}

interface PendingPromotion {
  originalPrice: number
  promotion: SectionPromotionContext
}

export function MenuPageClient({
  restaurant,
  categories,
  items,
  theme,
  tableToken,
  tableLabel,
  initialTableSession = null,
  initialSessionOrders = [],
  initialMember = null,
  initialMemberBalances = null,
  isPreview = false,
  requestButtonsEnabled = false,
}: Props) {
  useEffect(() => {
    const root = document.documentElement
    root.dataset['menuHydrated'] = 'true'
    return () => {
      delete root.dataset['menuHydrated']
    }
  }, [])

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [pendingCombo, setPendingCombo] = useState<PendingCombo | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null)
  const [dietaryFilters, setDietaryFilters] = useState<DietaryFilter[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [hasOpenedCart, setHasOpenedCart] = useState(false)
  const [hasOpenedProduct, setHasOpenedProduct] = useState(false)
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null)
  const [paymentTotal, setPaymentTotal] = useState(0)
  const [isSplitOpen, setIsSplitOpen] = useState(false)
  const [isServiceRequestsOpen, setIsServiceRequestsOpen] = useState(false)

  useEffect(() => {
    if (isCartOpen) setHasOpenedCart(true)
  }, [isCartOpen])

  useEffect(() => {
    if (selectedItem) setHasOpenedProduct(true)
  }, [selectedItem])
  const storeInfo = useMemo(() => readStoreInfo(restaurant.settings), [restaurant.settings])
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  const sessionId = useCartStore((s) => s.sessionId)
  const deviceId = useCartStore((s) => s.deviceId)

  const cartItems = useCartStore((s) => s.items)
  const storedTableToken = useCartStore((s) => s.tableId)
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
  const effectiveTableToken = tableToken ?? storedTableToken

  const {
    member,
    setMember,
    memberBalances,
    isMemberOpen,
    setIsMemberOpen,
    loyaltyEnabled,
    pointsRate,
    rewardItemId,
    welcomeBonus,
    rewardCatalog,
    redeemPoints,
    setRedeemPoints,
    claimStamp,
    setClaimStamp,
    catalogItemId,
    setCatalogItemId,
    discountPreview,
    canRedeem,
    stampClaimable,
    refetchBalances,
    clearRedemption,
    handleLogout,
  } = useMenuMembership({
    restaurantId: restaurant.id,
    restaurantSettings: restaurant.settings,
    itemById,
    cartItems,
    initialMember,
    initialBalances: initialMemberBalances,
  })

  const {
    orderId,
    orderStatus,
    orderMeta,
    orderView,
    isPlacing,
    orderError,
    sheetClosing,
    unseen,
    toastPhase,
    bubbleWiggle,
    setIsPlacing,
    setError,
    setOrderView,
    subscribeRealtime,
    startTracking,
    openOrderSheet,
    handleSheetClose,
    markPaidAndOpenSheet,
  } = useOrderTracking({
    tableToken: effectiveTableToken ?? null,
    sessionId,
    memberActive: Boolean(member),
    onMemberActivity: refetchBalances,
  })

  const {
    tableSession,
    tableSessionId,
    billOrders,
    isBillOpen,
    billRefreshing,
    billClosedNotice,
    billSummary,
    refreshBill,
    openBill,
    closeBill,
  } = useTableBill({
    tableToken: effectiveTableToken ?? null,
    initialSession: initialTableSession,
    initialOrders: initialSessionOrders,
  })

  const {
    checkoutUnavailableMessage,
    handlePlaceOrder,
    handlePayClick,
  } = useMenuCheckout({
    restaurantSlug: restaurant.slug,
    tableToken: effectiveTableToken ?? null,
    sessionId,
    cartItems,
    subtotal,
    redeemPoints,
    claimStamp,
    catalogItemId,
    previewTotal: discountPreview?.finalTotal ?? null,
    memberActive: Boolean(member),
    setIsPlacing,
    setError,
    startTracking,
    refreshBill,
    refetchBalances,
    clearCart,
    clearRedemption,
    closeCart: () => setIsCartOpen(false),
    onPaymentReady: (orderId, total) => {
      setPaymentTotal(total)
      setPaymentOrderId(orderId)
    },
  })

  const {
    callState: waiterCallState,
    callWaiter,
    sendServiceRequest,
  } = useWaiterCall(effectiveTableToken ?? null)

  useEffect(() => {
    void useCartStore.persist.rehydrate()
  }, [])

  useEffect(() => {
    if (tableToken && tableToken !== storedTableToken) {
      setStoreTableId(tableToken)
    }
  }, [tableToken, storedTableToken, setStoreTableId])

  useEffect(() => {
    if (tableToken || !storedTableToken) return
    let cancelled = false
    const validateStoredTable = async () => {
      const response = await fetch(`/api/table-state?token=${encodeURIComponent(storedTableToken)}`, { cache: 'no-store' })
      if (!cancelled && !response.ok) setStoreTableId(null)
    }
    void validateStoredTable()
    return () => { cancelled = true }
  }, [tableToken, storedTableToken, setStoreTableId])

  const handleAddToCart = useCallback(
    (
      item: MenuItem,
      modifiers: ReturnType<typeof useCartStore.getState>['items'][0]['modifiers'],
      quantity: number,
      removedIngredientIds: string[],
      options?: ProductModalSubmitOptions,
    ) => {
      addItem(item, modifiers, item.modifier_groups, quantity, undefined, removedIngredientIds, undefined, undefined, options?.productNote)
      for (const recommendation of options?.recommendations ?? []) {
        addItem(
          recommendation.item,
          recommendation.modifiers,
          recommendation.item.modifier_groups,
          quantity,
          undefined,
          recommendation.removedIngredientIds,
          undefined,
          undefined,
          recommendation.productNote,
          item.id,
        )
      }
      setIsCartOpen(true)
    },
    [addItem],
  )

  const handleOpenProduct = useCallback((item: MenuItem) => {
    setPendingPromotion(null)
    setSelectedItem(item)
  }, [])

  const handleQuickAdd = useCallback((item: MenuItem, originalPrice?: number, promotion?: SectionPromotionContext) => {
    const quantityStep = promotion?.quantityStep ?? 1
    if (isProductConfigurable(item)) {
      setPendingPromotion(promotion ? { originalPrice: originalPrice ?? item.price, promotion } : null)
      setSelectedItem(item)
    } else {
      addItem(item, [], [], quantityStep, originalPrice, [], undefined, promotion)
      setIsCartOpen(true)
    }
  }, [addItem])

  const addResolvedComboToCart = useCallback((combo: PendingCombo) => {
    combo.pricedItems.forEach((pricedItem, index) => {
      const selection = combo.selections[index] ?? { modifiers: [], removedIngredientIds: [] }
      const catalogItem = combo.request.items[index]
      if (!catalogItem) return
      addItem(
        pricedItem,
        selection.modifiers,
        catalogItem.modifier_groups,
        1,
        catalogItem.price,
        selection.removedIngredientIds,
        {
          instanceId: combo.instanceId,
          sectionInstanceId: combo.request.sectionInstanceId,
          comboIndex: combo.request.comboIndex,
        },
        undefined,
        selection.productNote,
      )
    })
    setPendingCombo(null)
    setSelectedItem(null)
    setIsCartOpen(true)
  }, [addItem])

  const handleAddCombo = useCallback((request: ComboAddRequest) => {
    setPendingPromotion(null)
    const allocatedPrices = allocateBundlePrice(
      request.items.map((item) => item.price),
      request.total,
    )
    const pricedItems = request.items.map((item, index) => ({
      ...item,
      price: allocatedPrices[index] ?? item.price,
    }))
    const configurationIndices = request.items.flatMap((item, index) =>
      isProductConfigurable(item)
        ? [index]
        : [],
    )
    const combo: PendingCombo = {
      request,
      instanceId: crypto.randomUUID(),
      pricedItems,
      configurationIndices,
      cursor: 0,
      selections: {},
    }
    if (configurationIndices.length === 0) {
      addResolvedComboToCart(combo)
      return
    }
    setPendingCombo(combo)
    setSelectedItem(pricedItems[configurationIndices[0]!] ?? null)
  }, [addResolvedComboToCart])

  const handleModalAdd = useCallback((
    item: MenuItem,
    modifiers: SelectedModifier[],
    quantity: number,
    removedIngredientIds: string[],
    options?: ProductModalSubmitOptions,
  ) => {
    if (!pendingCombo) {
      if (pendingPromotion) {
        addItem(
          item,
          modifiers,
          item.modifier_groups,
          quantity * (pendingPromotion.promotion.quantityStep ?? 1),
          pendingPromotion.originalPrice,
          removedIngredientIds,
          undefined,
          pendingPromotion.promotion,
          options?.productNote,
        )
        setPendingPromotion(null)
        setIsCartOpen(true)
      } else {
        handleAddToCart(item, modifiers, quantity, removedIngredientIds, options)
      }
      return
    }

    const itemIndex = pendingCombo.configurationIndices[pendingCombo.cursor]
    if (itemIndex === undefined) return
    const nextSelections = {
      ...pendingCombo.selections,
      [itemIndex]: { modifiers, removedIngredientIds, ...(options?.productNote ? { productNote: options.productNote } : {}) },
    }
    const nextCursor = pendingCombo.cursor + 1
    if (nextCursor >= pendingCombo.configurationIndices.length) {
      addResolvedComboToCart({ ...pendingCombo, selections: nextSelections })
      return
    }
    const nextCombo = { ...pendingCombo, cursor: nextCursor, selections: nextSelections }
    setPendingCombo(nextCombo)
    const nextItemIndex = nextCombo.configurationIndices[nextCursor]
    setSelectedItem(nextItemIndex === undefined ? null : nextCombo.pricedItems[nextItemIndex] ?? null)
  }, [addItem, addResolvedComboToCart, handleAddToCart, pendingCombo, pendingPromotion])

  const handleCartQuantity = useCallback((cartId: string, quantity: number) => {
    const target = cartItems.find((item) => item.cartId === cartId)
    if (!target?.combo) {
      const step = target?.promotion?.quantityStep ?? 1
      const maximum = Math.max(step, Math.floor(99 / step) * step)
      const normalizedQuantity = quantity <= 0
        ? 0
        : Math.min(maximum, Math.max(step, Math.round(quantity / step) * step))
      updateQuantity(cartId, normalizedQuantity)
      return
    }
    const normalizedQuantity = Math.max(0, Math.min(99, Math.round(quantity)))
    for (const item of cartItems) {
      if (item.combo?.instanceId === target.combo.instanceId) {
        updateQuantity(item.cartId, normalizedQuantity)
      }
    }
  }, [cartItems, updateQuantity])

  const handleCartRemove = useCallback((cartId: string) => {
    const target = cartItems.find((item) => item.cartId === cartId)
    if (!target?.combo) {
      removeItem(cartId)
      return
    }
    for (const item of cartItems) {
      if (item.combo?.instanceId === target.combo.instanceId) {
        removeItem(item.cartId)
      }
    }
  }, [cartItems, removeItem])

  // 15c: claim a catalog reward → ensure the reward item is in the cart (add one
  // if missing), set the catalog intent (server validates + debits), drop any
  // points-as-₺ request (either/or), then jump to the cart.
  const handleRedeemCatalog = useCallback((itemId: string) => {
    const item = itemById.get(itemId)
    if (!item) return
    if (!cartItems.some((ci) => ci.itemId === itemId)) addItem(item, [], [], 1)
    setCatalogItemId(itemId)
    setRedeemPoints(0)
    setIsMemberOpen(false)
    setIsCartOpen(true)
  }, [itemById, cartItems, addItem, setCatalogItemId, setRedeemPoints, setIsMemberOpen])

  const {
    filteredItems,
    visibleCategories,
    itemsByCategory,
    categoryMeta,
    firstCardItemId,
    cartQuantityByItemId,
    cartSummary,
  } = useMenuCatalog({ items, categories, dietaryFilters, cartItems })

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
          const cartQuantity = cartQuantityByItemId.get(item.id) ?? 0
          return (
            <ProductCard
              key={item.id}
              item={item}
              onOpen={handleOpenProduct}
              onQuickAdd={handleQuickAdd}
              cartQuantity={cartQuantity}
              imagePriority={item.id === firstCardItemId}
              onIncrement={() => {
                const existing = cartItems.find((ci) => ci.itemId === item.id && !ci.combo && !ci.promotion)
                if (existing) updateQuantity(existing.cartId, existing.quantity + 1)
                else addItem(item, [], [], 1)
              }}
              onDecrement={() => {
                const existing = cartItems.find((ci) => ci.itemId === item.id && !ci.combo && !ci.promotion)
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
          {...(effectiveTableToken ? { onCallWaiter: callWaiter, waiterCallState } : {})}
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
      <DefaultMenuPage
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
            phase={orderStatusPhase(orderStatus)}
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
        tableId={effectiveTableToken}
        {...(tableLabel ? { tableLabel } : {})}
        cartSummary={cartSummary}
        onOpenCart={() => setIsCartOpen(true)}
        items={filteredItems}
        onQuickAdd={handleQuickAdd}
        onAddCombo={handleAddCombo}
        billSummary={billSummary}
        onOpenBill={() => { void openBill() }}
        memberSummary={loyaltyEnabled ? {
          name: member?.name ?? null,
          welcomeBonus,
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
        onServiceRequest={isPreview ? async () => true : sendServiceRequest}
        onOpenServiceRequests={() => setIsServiceRequestsOpen(true)}
        memberLoyalty={member && memberBalances && memberBalances.stampEnabled
          ? { filled: memberBalances.stamps, total: memberBalances.stampGoal }
          : null}
        storeInfo={storeInfo}
      />

      {hasOpenedProduct && <ProductModal
        item={selectedItem}
        onClose={() => {
          setSelectedItem(null)
          setPendingCombo(null)
          setPendingPromotion(null)
        }}
        onAddToCart={handleModalAdd}
        recommendationItems={!pendingCombo && !pendingPromotion
          ? (selectedItem?.recommended_item_ids ?? []).flatMap((id) => {
              const candidate = itemById.get(id)
              const recommendation = candidate?.is_available ? candidate : undefined
              return recommendation ? [recommendation] : []
            })
          : []}
        contextLabel={pendingCombo ? `Kombo ${pendingCombo.cursor + 1}/${pendingCombo.configurationIndices.length}` : pendingPromotion ? 'Kampanyalı ürün' : undefined}
        contextTitle={pendingCombo?.request.title ?? (pendingPromotion ? 'Seçeneklerinizi tamamlayın' : undefined)}
        lockQuantity={Boolean(pendingCombo)}
        submitLabel={pendingCombo
          ? pendingCombo.cursor + 1 < pendingCombo.configurationIndices.length
            ? 'Seçimi kaydet ve devam et'
            : 'Komboyu sepete ekle'
          : undefined}
        closeAfterAdd={!pendingCombo}
      />}

      {hasOpenedCart && <CartDrawer
        isOpen={isCartOpen}
        items={cartItems}
        isPlacing={isPlacing}
        orderError={orderError}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={handleCartQuantity}
        onRemoveItem={handleCartRemove}
        onPlaceOrder={handlePlaceOrder}
        canCheckout={Boolean(effectiveTableToken)}
        checkoutUnavailableReason={!effectiveTableToken ? checkoutUnavailableMessage : undefined}
        onPay={effectiveTableToken ? handlePayClick : undefined}
        onSplitBill={effectiveTableToken ? () => { setIsCartOpen(false); setIsSplitOpen(true) } : undefined}
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
          rewardName: (rewardItemId ? itemById.get(rewardItemId) : undefined)?.name ?? null,
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
      />}

      {isBillOpen && (
        <TableBillSheet
          orders={billOrders}
          openedAt={tableSession?.openedAt ?? null}
          closedNotice={billClosedNotice}
          refreshing={billRefreshing}
          onClose={closeBill}
          {...(effectiveTableToken ? { onCallWaiter: callWaiter, waiterCallState } : {})}
        />
      )}

      {!isCartOpen && (
        <FloatingCartTrigger onClick={() => setIsCartOpen(true)} />
      )}

      <RequestButtonsOverlay
        enabled={requestButtonsEnabled}
        tableToken={effectiveTableToken ?? null}
        tableLabel={tableLabel ?? null}
        hidden={isCartOpen || isBillOpen || Boolean(selectedItem) || isMemberOpen || isSplitOpen || Boolean(paymentOrderId)}
        onRequest={sendServiceRequest}
        open={isServiceRequestsOpen}
        onOpenChange={setIsServiceRequestsOpen}
      />

      {orderId && orderStatus && orderView === 'bubble' && toastPhase !== null && (
        <OrderToastNotification phase={toastPhase} onOpen={openOrderSheet} />
      )}

      {paymentOrderId && (
        <PaymentModal
          orderId={paymentOrderId}
          total={paymentTotal}
          restaurantId={restaurant.id}
          tableToken={effectiveTableToken!}
          restaurantName={restaurant.name}
          tableLabel={tableLabel ?? null}
          deviceId={deviceId}
          initialBuyerName={member?.name ?? null}
          onClose={() => setPaymentOrderId(null)}
          onSuccess={() => {
            setPaymentOrderId(null)
            markPaidAndOpenSheet()
          }}
          {...(effectiveTableToken ? {
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
          restaurantSlug={restaurant.slug}
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
          slug={restaurant.slug}
          tableToken={effectiveTableToken!}
          tableSessionId={tableSessionId}
          onClose={() => setIsSplitOpen(false)}
        />
      )}

    </ThemeProvider>
  )
}
