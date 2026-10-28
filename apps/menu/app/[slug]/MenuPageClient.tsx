'use client'

import { EMPTY_MENU_TRANSLATIONS, type MenuLocale, type PublicMenuTranslations } from '@garsonless/domain/menu-translation'
import { MenuLocaleProvider } from '@garsonless/ui/menu/MenuLocaleContext'
import { MenuLanguageControl } from './components/MenuLanguageControl'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { productImageDelivery } from '../../lib/product-image-delivery'
import {
  ThemeProvider,
  ProductCard,
  OrderBubble,
  OrderToastNotification,
  orderStatusPhase,
  ServiceRequestFab,
  useTheme,
  DietaryFilterBar,
  isProductConfigurable,
} from '@garsonless/ui/menu'
import type {
  MenuCategory,
  CartItem,
  MenuFilterDefinition,
  MenuItem,
  ProductModalSubmitOptions,
  SectionPromotionContext,
  SelectedModifier,
} from '@garsonless/ui/menu'
import type { ComboAddRequest, FreebieAddRequest, MemberOpenTarget } from '@garsonless/ui/themes'
import { readStoreInfo } from '@garsonless/ui/themes/storeInfo'
import { allocateBundlePrice } from '@garsonless/domain/menu'
import type { ServiceRequestType } from '@garsonless/domain/tables'
import type { PublicRestaurant, TableSessionInfo, SessionOrderRow } from '../../lib/queries'
import { MENU_CART_PREVIEW_EVENT, resolveMenuHeaderTheme, type AccountPreviewState, type GarsonlessTheme, type MenuCartPreviewState } from '@garsonless/design-engine'
import { getSectionDefinitionId } from '@garsonless/design-engine/section-blocks'
import { resolveMenuActionPlacements } from '@garsonless/design-engine/menu-action-placement'
import type { MemberBalances } from '@garsonless/db/types'
import { useCartStore } from '../../lib/store/useCartStore'
import { useWaiterCall } from '../../lib/hooks/useWaiterCall'
import { useMenuCatalog } from '../../lib/hooks/useMenuCatalog'
import { participatesInAutomaticProductCampaign } from '../../lib/cart-quantity-projection'
import { useMenuMembership } from '../../lib/hooks/useMenuMembership'
import { useMenuCheckout } from '../../lib/hooks/useMenuCheckout'
import { useOrderTracking } from '../../lib/hooks/useOrderTracking'
import { useTableBill } from '../../lib/hooks/useTableBill'
import type { CustomerFavoriteView, CustomerReorderPreviewView } from '../../lib/customer-account-contract'
import type { AccountActions } from './components/AccountCenter'
import { RewardNoticeCard } from './components/RewardNoticeCard'
import { ReviewPrompt } from './components/ReviewPrompt'
import type { CustomerAuthSurface } from '../../lib/customer-auth-intent'
import type { CustomerAuthOAuthProvider } from '../../lib/customer-auth-contract'
import { DefaultMenuPage } from '@garsonless/ui/themes/default/MenuPage'
import { readComboIntent, removeComboIntentFromUrl, resolveComboIntent } from '../../lib/combo-intent'
import { consumeComboIntentHandoff, readPreviewComboConfig } from '../../lib/combo-intent-params'
import { resolveAutomaticPromotionForItem, resolvePromotionIntent } from '../../lib/promotion-intent'
import { normalizeCartQuantityForStep } from '../../lib/store/cartIdentity'
import { getNextFreebieCampaignTransition, resolveFreebieCampaign, resolveFreebieCampaigns } from '../../lib/freebie-campaign'
import { consumeFreebieIntentHandoff } from '../../lib/freebie-intent-params'
import { FreebieCampaignPicker } from './components/FreebieCampaignPicker'

// The product dialog stays out of the initial bundle but is warmed once the
// page is idle, so the first tap does not wait for the chunk on slow networks.
const loadProductModal = () => import('@garsonless/ui/menu/ProductModal').then((module) => module.ProductModal)
const ProductModal = dynamic(loadProductModal)
// Published 3D models only: model-viewer (three.js) loads on the first "3D incele".
const MenuArViewer = dynamic(() => import('./MenuArViewer').then((module) => module.MenuArViewer), { ssr: false })
const CartDrawer = dynamic(() => import('@garsonless/ui/menu/CartDrawer').then((module) => module.CartDrawer))
const OrderConfirmation = dynamic(
  () => import('@garsonless/ui/menu/OrderConfirmation').then((module) => module.OrderConfirmation),
  { loading: () => <p role="status" style={{ padding: 24, textAlign: 'center' }}>Sipariş yükleniyor…</p> },
)
const TableBillSheet = dynamic(() => import('@garsonless/ui/menu/TableBillSheet').then((module) => module.TableBillSheet))
const PaymentModal = dynamic(() => import('./components/PaymentModal'))
const MemberSheet = dynamic(() => import('./components/MemberSheet'), { ssr: false })
const SplitBillModal = dynamic(() => import('./components/SplitBillModal'))
const CustomerSessionSynchronizer = dynamic(
  () => import('../../lib/components/CustomerSessionSynchronizer'),
  { ssr: false },
)
const MenuFavoritesController = dynamic(
  () => import('../../lib/components/MenuFavoritesController'),
  { ssr: false },
)
const LazyFloatingCartTrigger = dynamic(
  () => import('./components/FloatingCartTrigger'),
  { ssr: false },
)

interface RequestButtonsOverlayProps {
  enabled: boolean
  tableToken: string | null
  tableLabel: string | null
  hidden: boolean
  onRequest: (type: ServiceRequestType) => Promise<boolean>
  open: boolean
  onOpenChange: (open: boolean) => void
}

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
  const liveMenuTheme = useMemo(() => resolveMenuHeaderTheme(liveTheme), [liveTheme])
  const config = useMemo(() => {
    const block = (liveMenuTheme.pageBlocks ?? []).find(
      (candidate) => candidate.type === 'section' && getSectionDefinitionId(candidate) === 'request-buttons',
    )
    if (block) {
      return liveMenuTheme.sectionSettings?.[block.id]
        ?? liveMenuTheme.sectionSettings?.['request-buttons']
        ?? {}
    }
    return liveMenuTheme.sections?.includes('request-buttons')
      ? (liveMenuTheme.sectionSettings?.['request-buttons'] ?? {})
      : null
  }, [liveMenuTheme.pageBlocks, liveMenuTheme.sectionSettings, liveMenuTheme.sections])

  if (!enabled || config === null || (!tableToken && !isPreview) || (hidden && !open)) return null

  const placements = resolveMenuActionPlacements(liveMenuTheme)

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
  menuTranslations?: PublicMenuTranslations
  initialMenuLocale?: MenuLocale
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
  initialCustomerAuthReturn?: 'success' | 'error' | null
  /** Server-gated, allowlisted smoke fixture. Never inferred by production clients. */
  accountPreviewState?: AccountPreviewState
  isPreview?: boolean
  /** Server-resolved plan/override entitlement for the global request tool. */
  requestButtonsEnabled?: boolean
  /** Server-resolved Pro entitlement for cart and QR ordering. */
  guestOrderingEnabled?: boolean
  /** Server-resolved Pro entitlement for member/CRM surfaces. */
  customerAccountsEnabled?: boolean
  /** Server-verified intersection of the app allowlist and hosted providers. */
  customerAuthProviders?: readonly CustomerAuthOAuthProvider[]
  emailOtpEnabled?: boolean
  phoneOtpEnabled?: boolean
  initialOpenCart?: boolean
  initialProductId?: string | null
  initialPromotionSectionId?: string | null
  initialPromotionKind?: string | null
  homeEnabled?: boolean
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

interface FreebieLineSelection {
  modifiers: SelectedModifier[]
  removedIngredientIds: string[]
  productNote?: string
}

interface PendingFreebie {
  request: FreebieAddRequest
  instanceId: string
  qualifier: MenuItem | null
  reward: MenuItem | null
  quantity: number
  stage: 'picker' | 'qualifier' | 'reward'
  qualifierSelection?: FreebieLineSelection
  rewardSelection?: FreebieLineSelection
  replaceCartIds?: string[]
}

function createClientId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `combo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function getComboModifierTotal(item: MenuItem, modifiers: SelectedModifier[]): number {
  return modifiers.reduce((total, selection) => {
    for (const group of item.modifier_groups) {
      const option = group.options.find((candidate) => candidate.id === selection.option_id)
      if (option) return total + option.price_delta * (selection.quantity ?? 1)
    }
    return total
  }, 0)
}

function ComboIntentConsumer({
  enabled,
  cartScopeReady,
  restaurantSlug,
  items,
  onAddCombo,
  onInvalid,
}: {
  enabled: boolean
  cartScopeReady: boolean
  restaurantSlug: string
  items: MenuItem[]
  onAddCombo: (request: ComboAddRequest) => void
  onInvalid: () => void
}) {
  const { theme, isPreview } = useTheme()
  const consumedRef = useRef(false)

  useEffect(() => {
    if (!enabled || !cartScopeReady || consumedRef.current) return
    const params = new URLSearchParams(window.location.search)
    if (!params.has('comboSection') && !params.has('comboIndex')) return
    consumedRef.current = true
    const intent = readComboIntent(window.location.search)
    if (!intent) {
      window.history.replaceState(window.history.state, '', removeComboIntentFromUrl(window.location))
      onInvalid()
      return
    }

    const storedConfig = consumeComboIntentHandoff(window.sessionStorage, intent, restaurantSlug)
    const fallbackConfig = isPreview
      ? storedConfig ?? readPreviewComboConfig(window.location.search, intent)
      : null
    window.history.replaceState(window.history.state, '', removeComboIntentFromUrl(window.location))
    const request = resolveComboIntent(intent, theme, items, fallbackConfig)
    if (request) onAddCombo(request)
    else onInvalid()
  }, [cartScopeReady, enabled, isPreview, items, onAddCombo, onInvalid, restaurantSlug, theme])

  return null
}

function FreebieIntentConsumer({ enabled, cartScopeReady, theme, items, restaurantSlug, isPreview, onAddFreebie }: { enabled: boolean; cartScopeReady: boolean; theme: GarsonlessTheme; items: MenuItem[]; restaurantSlug: string; isPreview: boolean; onAddFreebie: (request: FreebieAddRequest) => void }) {
  const consumedRef = useRef(false)
  useEffect(() => {
    if (!enabled || !cartScopeReady || consumedRef.current) return
    const params = new URLSearchParams(window.location.search)
    const sectionInstanceId = params.get('freebieSection')?.trim()
    if (!sectionInstanceId) return
    consumedRef.current = true
    params.delete('freebieSection')
    const query = params.size ? `?${params.toString()}` : ''
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query}${window.location.hash}`)
    const fallbackSettings = isPreview
      ? consumeFreebieIntentHandoff(window.sessionStorage, sectionInstanceId, restaurantSlug)
      : null
    const request = resolveFreebieCampaign({ theme, items, sectionInstanceId, fallbackSettings })
    if (request) onAddFreebie(request)
  }, [cartScopeReady, enabled, isPreview, items, onAddFreebie, restaurantSlug, theme])
  return null
}

export function MenuPageClient({
  menuTranslations = EMPTY_MENU_TRANSLATIONS,
  initialMenuLocale = 'tr',
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
  initialCustomerAuthReturn = null,
  accountPreviewState = undefined,
  isPreview = false,
  requestButtonsEnabled = false,
  guestOrderingEnabled = false,
  customerAccountsEnabled = false,
  customerAuthProviders = [],
  emailOtpEnabled = true,
  phoneOtpEnabled = false,
  initialOpenCart = false,
  initialProductId = null,
  initialPromotionSectionId = null,
  initialPromotionKind = null,
  homeEnabled = false,
}: Props) {
  const [menuLocale, setMenuLocale] = useState<MenuLocale>(initialMenuLocale)
  const changeMenuLocale = (value: MenuLocale) => {
    setMenuLocale(value)
    document.cookie = `masabu_menu_locale=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
    const url = new URL(window.location.href)
    url.searchParams.set('lang', value)
    window.history.replaceState(window.history.state, '', url)
  }
  const effectiveMenuLocale = menuTranslations.enabled ? menuLocale : 'tr'
  const orderingEnabled = guestOrderingEnabled
  const [runtimeTheme, setRuntimeTheme] = useState(theme)
  useEffect(() => {
    const root = document.documentElement
    root.dataset['menuHydrated'] = 'true'
    // Separates JS needed to become interactive from idle prefetches in perf budgets.
    performance.mark('menu:hydrated')
    return () => {
      delete root.dataset['menuHydrated']
    }
  }, [])

  useEffect(() => {
    const idle = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }
    const warm = () => { void loadProductModal() }
    if (idle.requestIdleCallback) {
      const handle = idle.requestIdleCallback(warm, { timeout: 2_000 })
      return () => idle.cancelIdleCallback?.(handle)
    }
    const timer = window.setTimeout(warm, 1_000)
    return () => window.clearTimeout(timer)
  }, [])

  const initialPromotion = resolvePromotionIntent({
    theme,
    items,
    itemId: initialProductId,
    sectionInstanceId: initialPromotionSectionId,
    kind: initialPromotionKind,
  })
  const [arItem, setArItem] = useState<MenuItem | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(() => initialPromotion?.item ?? (initialProductId ? items.find((item) => item.id === initialProductId) ?? null : null))
  const [pendingCombo, setPendingCombo] = useState<PendingCombo | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(() => initialPromotion
    ? { originalPrice: initialPromotion.originalPrice, promotion: initialPromotion.promotion }
    : null)
  const [pendingFreebie, setPendingFreebie] = useState<PendingFreebie | null>(null)
  const [campaignNotice, setCampaignNotice] = useState<string | null>(null)
  const [freebieClock, setFreebieClock] = useState(() => Date.now())
  const [menuFilters, setMenuFilters] = useState<MenuFilterDefinition[]>([])
  const [isCartOpen, setIsCartOpen] = useState(orderingEnabled && initialOpenCart)
  const [hasOpenedCart, setHasOpenedCart] = useState(false)
  const [cartPreviewState, setCartPreviewState] = useState<MenuCartPreviewState | null>(null)
  const [previewCartQuantity, setPreviewCartQuantity] = useState(1)
  const [hasOpenedProduct, setHasOpenedProduct] = useState(false)
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null)
  const [paymentTotal, setPaymentTotal] = useState(0)
  const [isSplitOpen, setIsSplitOpen] = useState(false)
  const [isServiceRequestsOpen, setIsServiceRequestsOpen] = useState(false)
  const [customerAuthReturn, setCustomerAuthReturn] = useState<'success' | 'error' | null>(initialCustomerAuthReturn)
  const [customerAuthSurface, setCustomerAuthSurface] = useState<CustomerAuthSurface>('menu')
  const [memberTarget, setMemberTarget] = useState<MemberOpenTarget>('overview')
  const [pendingAuthSurface, setPendingAuthSurface] = useState<CustomerAuthSurface | null>(null)
  const [cartScopeReady, setCartScopeReady] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [favoriteToggleRequest, setFavoriteToggleRequest] = useState<{ itemId: string; requestId: number } | null>(null)
  const authContextConsumedRef = useRef(false)

  useEffect(() => {
    if (isCartOpen) setHasOpenedCart(true)
  }, [isCartOpen])

  useEffect(() => {
    if (!isPreview || !orderingEnabled) return
    const handleCartPreview = (event: Event) => {
      const state = (event as CustomEvent<{ state: MenuCartPreviewState | null }>).detail?.state ?? null
      setCartPreviewState(state)
      setPreviewCartQuantity(1)
      const shouldOpen = state === 'filled' || state === 'empty'
      setIsCartOpen(shouldOpen)
      if (shouldOpen) setHasOpenedCart(true)
    }
    window.addEventListener(MENU_CART_PREVIEW_EVENT, handleCartPreview)
    return () => window.removeEventListener(MENU_CART_PREVIEW_EVENT, handleCartPreview)
  }, [isPreview, orderingEnabled])

  useEffect(() => {
    if (selectedItem) setHasOpenedProduct(true)
  }, [selectedItem])
  const storeInfo = useMemo(() => readStoreInfo(restaurant.settings), [restaurant.settings])
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const automaticPromotionsByItemId = useMemo(() => new Map(items.flatMap((item) => {
    const promotion = resolveAutomaticPromotionForItem({ theme: runtimeTheme, item })
    return promotion ? [[item.id, promotion] as const] : []
  })), [items, runtimeTheme])
  const freebieCampaigns = useMemo(() => resolveFreebieCampaigns(runtimeTheme, items, freebieClock), [freebieClock, items, runtimeTheme])
  const freebieCampaignsBySection = useMemo(() => new Map(freebieCampaigns.map((campaign) => [campaign.sectionInstanceId, campaign])), [freebieCampaigns])
  const automaticFreebiesByItemId = useMemo(() => new Map(freebieCampaigns.flatMap((campaign) => campaign.qualifierItems.map((item) => [item.id, campaign] as const))), [freebieCampaigns])

  useEffect(() => {
    const nextTransition = getNextFreebieCampaignTransition(runtimeTheme, freebieClock)
    if (nextTransition === null) return
    const timeout = window.setTimeout(
      () => setFreebieClock(Date.now()),
      Math.max(50, Math.min(nextTransition - freebieClock + 50, 2_147_000_000)),
    )
    return () => window.clearTimeout(timeout)
  }, [freebieClock, runtimeTheme])

  const sessionId = useCartStore((s) => s.sessionId)
  const deviceId = useCartStore((s) => s.deviceId)

  const cartItems = useCartStore((s) => s.items)
  const previewCartItems = useMemo<CartItem[]>(() => {
    if (!cartPreviewState || cartPreviewState === 'empty' || previewCartQuantity <= 0) return []
    const source = items.find((item) => item.is_available) ?? items[0]
    return [{
      cartId: 'theme-editor-preview-cart-item',
      itemId: source?.id ?? 'preview-item',
      name: source?.name ?? 'Örnek ürün',
      price: source?.price ?? 180,
      quantity: previewCartQuantity,
      modifiers: [],
      modifiersPriceDelta: 0,
      modifierNames: ['Örnek seçenek'],
      removedIngredientIds: [],
      removedIngredientNames: [],
      productNote: 'Editör önizlemesi',
      energyKcal: source?.energy_kcal ?? 250,
      imageUrl: source?.images?.[0] ?? null,
    }]
  }, [cartPreviewState, items, previewCartQuantity])
  const effectiveCartItems = isPreview && cartPreviewState !== null ? previewCartItems : cartItems
  const previewCartSummary = useMemo(() => ({
    count: effectiveCartItems.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: effectiveCartItems.reduce((sum, item) => sum + (item.price + item.modifiersPriceDelta) * item.quantity, 0),
  }), [effectiveCartItems])
  const storedTableToken = useCartStore((s) => s.tableId)
  const subtotal = useCartStore((s) => s.subtotal)
  const storeAddItem = useCartStore((s) => s.addItem)
  // Canonical Turkish fields only cross the cart boundary, including recommendations/combos.
  const addItem = useCallback<typeof storeAddItem>((item, modifiers, groups, ...rest) => {
    const canonical = items.find((source) => source.id === item.id)
    if (!canonical) return
    storeAddItem({ ...item, name: canonical.name, description: canonical.description, ingredients: canonical.ingredients, modifier_groups: canonical.modifier_groups }, modifiers, canonical.modifier_groups, ...rest)
  }, [storeAddItem, items])
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const attachPromotion = useCartStore((s) => s.attachPromotion)
  const detachPromotion = useCartStore((s) => s.detachPromotion)
  const clearCart = useCartStore((s) => s.clearCart)
  const clearRestaurantCarts = useCartStore((s) => s.clearRestaurantCarts)
  const bindCartScope = useCartStore((s) => s.bindScope)
  const clearTableScope = useCartStore((s) => s.clearTableScope)

  useEffect(() => {
    const processedFreebieInstances = new Set<string>()
    for (const cartItem of cartItems) {
      // "Yanında iyi gider" lines are deliberately standard-price additions.
      // Never upgrade them into an automatic product-card campaign merely
      // because the recommended item is also campaign-eligible.
      if (!participatesInAutomaticProductCampaign(cartItem)) continue
      if (cartItem.promotion) {
        if (cartItem.promotion.offer === 'freebie') {
          const instanceId = cartItem.promotion.instanceId
          if (instanceId && processedFreebieInstances.has(instanceId)) continue
          if (instanceId) processedFreebieInstances.add(instanceId)
          const campaign = freebieCampaignsBySection.get(cartItem.promotion.sectionInstanceId)
          const group = instanceId
            ? cartItems.filter((item) => item.promotion?.offer === 'freebie' && item.promotion.instanceId === instanceId)
            : []
          const qualifier = group.find((item) => item.promotion?.role === 'qualifier')
          const reward = group.find((item) => item.promotion?.role === 'reward')
          const valid = Boolean(
            campaign
            && instanceId
            && group.length === 2
            && qualifier
            && reward
            && qualifier.quantity === reward.quantity
            && qualifier.promotion?.sectionInstanceId === campaign.sectionInstanceId
            && reward.promotion?.sectionInstanceId === campaign.sectionInstanceId
            && campaign.qualifierItems.some((item) => item.id === qualifier.itemId)
            && campaign.rewardItems.some((item) => item.id === reward.itemId),
          )
          if (!valid) {
            for (const paired of group.length > 0 ? group : [cartItem]) removeItem(paired.cartId)
            setCampaignNotice('Hediye kampanyası artık geçerli olmadığı için bağlı ürünler sepetten kaldırıldı.')
            setIsCartOpen(true)
          } else if (reward && (reward.price !== 0 || reward.originalPrice !== itemById.get(reward.itemId)?.price)) {
            attachPromotion(
              reward.cartId,
              0,
              itemById.get(reward.itemId)?.price ?? reward.originalPrice ?? reward.price,
              reward.promotion!,
              reward.quantity,
            )
          }
          continue
        }
        const automaticPromotion = automaticPromotionsByItemId.get(cartItem.itemId)
        if (cartItem.promotion.kind === 'promo-slider' && !automaticPromotion) {
          const catalogPrice = itemById.get(cartItem.itemId)?.price ?? cartItem.originalPrice ?? cartItem.price
          detachPromotion(cartItem.cartId, catalogPrice)
          continue
        }
        const normalizedQuantity = normalizeCartQuantityForStep(
          cartItem.quantity,
          automaticPromotion?.promotion.quantityStep ?? cartItem.promotion.quantityStep ?? 1,
        )
        if (automaticPromotion && (
          cartItem.price !== automaticPromotion.item.price
          || cartItem.originalPrice !== automaticPromotion.originalPrice
          || cartItem.promotion.sectionInstanceId !== automaticPromotion.promotion.sectionInstanceId
          || cartItem.promotion.kind !== automaticPromotion.promotion.kind
          || cartItem.promotion.quantityStep !== automaticPromotion.promotion.quantityStep
          || normalizedQuantity !== cartItem.quantity
        )) {
          attachPromotion(
            cartItem.cartId,
            automaticPromotion.item.price,
            automaticPromotion.originalPrice,
            automaticPromotion.promotion,
            normalizedQuantity,
          )
        } else if (normalizedQuantity !== cartItem.quantity) {
          updateQuantity(cartItem.cartId, normalizedQuantity)
        }
        continue
      }
      const automaticPromotion = automaticPromotionsByItemId.get(cartItem.itemId)
      const step = automaticPromotion?.promotion.quantityStep ?? 1
      if (!automaticPromotion || step < 2) continue
      attachPromotion(
        cartItem.cartId,
        automaticPromotion.item.price,
        automaticPromotion.originalPrice,
        automaticPromotion.promotion,
        normalizeCartQuantityForStep(cartItem.quantity, step),
      )
    }
  }, [attachPromotion, automaticPromotionsByItemId, cartItems, detachPromotion, freebieCampaignsBySection, itemById, removeItem, updateQuantity])

  useEffect(() => {
    if (!pendingPromotion || pendingPromotion.promotion.kind !== 'promo-slider' || !selectedItem) return
    const automaticPromotion = automaticPromotionsByItemId.get(selectedItem.id)
    if (!automaticPromotion) {
      setPendingPromotion(null)
      setSelectedItem(itemById.get(selectedItem.id) ?? null)
      return
    }
    if (
      selectedItem.price !== automaticPromotion.item.price
      || pendingPromotion.originalPrice !== automaticPromotion.originalPrice
      || pendingPromotion.promotion.sectionInstanceId !== automaticPromotion.promotion.sectionInstanceId
      || pendingPromotion.promotion.quantityStep !== automaticPromotion.promotion.quantityStep
    ) {
      setSelectedItem(automaticPromotion.item)
      setPendingPromotion({
        originalPrice: automaticPromotion.originalPrice,
        promotion: automaticPromotion.promotion,
      })
    }
  }, [automaticPromotionsByItemId, itemById, pendingPromotion, selectedItem])

  // Effective table identity: the route param wins (fresh scan), else the
  // device's stored table. The adisyon (table bill) is keyed on the table
  // SESSION existing — not on the route param — so the "Hesap" chip shows on
  // /maf-lounge too when the device already has an open table.
  const effectiveTableToken = tableToken ?? storedTableToken
  const homeHref = homeEnabled
    ? tableToken
      ? `/${encodeURIComponent(restaurant.slug)}/table/${encodeURIComponent(tableToken)}`
      : `/${encodeURIComponent(restaurant.slug)}`
    : null

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
    couponDraft,
    setCouponDraft,
    couponCode,
    couponError,
    couponPending,
    applyCoupon,
    removeCoupon,
    rejectCoupon,
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
    initialOpen: initialCustomerAuthReturn !== null || accountPreviewState !== undefined,
  })

  const availableFavoriteItemIds = useMemo(
    () => new Set(items.filter((item) => item.is_available).map((item) => item.id)),
    [items],
  )

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    const params = new URLSearchParams(window.location.search)
    if (!params.has('__customerAuthPreview') && !params.has('__customerAccountPreview')) return
    document.documentElement.dataset.customerAuthPreview = 'true'
    setIsMemberOpen(true)
    return () => { delete document.documentElement.dataset.customerAuthPreview }
  }, [setIsMemberOpen])

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
    restaurantId: restaurant.id,
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

  const restoreCustomerSurface = useCallback((surface: CustomerAuthSurface) => {
    setIsMemberOpen(false)
    setCustomerAuthReturn(null)
    switch (surface) {
      case 'cart':
        setIsCartOpen(true)
        break
      case 'order':
        if (orderId) openOrderSheet()
        break
      case 'bill':
        if (effectiveTableToken) void openBill()
        break
      case 'split':
        if (effectiveTableToken && tableSessionId) setIsSplitOpen(true)
        break
      case 'service':
        if (effectiveTableToken) setIsServiceRequestsOpen(true)
        break
      case 'menu':
        break
    }
  }, [effectiveTableToken, openBill, openOrderSheet, orderId, setIsMemberOpen, tableSessionId])

  useEffect(() => {
    if (!cartScopeReady || !customerAuthReturn || authContextConsumedRef.current) return
    let cancelled = false
    void import('../../lib/menu-continuity-client').then(({ consumePendingCustomerAuthContext }) => {
      if (cancelled || authContextConsumedRef.current) return
      authContextConsumedRef.current = true
      const context = consumePendingCustomerAuthContext({
        restaurantId: restaurant.id,
        restaurantSlug: restaurant.slug,
        tableToken: effectiveTableToken ?? null,
      })
      if (!context) return
      setCustomerAuthSurface(context.surface)
      setMemberTarget(context.memberTarget ?? 'overview')
      setPendingAuthSurface(context.surface)
    })
    return () => { cancelled = true }
  }, [cartScopeReady, customerAuthReturn, effectiveTableToken, restaurant.id, restaurant.slug])

  const handleMemberClose = useCallback(() => {
    const surface = pendingAuthSurface
    setPendingAuthSurface(null)
    if (surface) {
      restoreCustomerSurface(surface)
      return
    }
    setIsMemberOpen(false)
    setCustomerAuthReturn(null)
  }, [pendingAuthSurface, restoreCustomerSurface, setIsMemberOpen])

  const handleAuthContextComplete = useCallback((surface: CustomerAuthSurface) => {
    void import('../../lib/menu-continuity-client').then(({ consumePendingCustomerAuthContext }) => {
      consumePendingCustomerAuthContext({
        restaurantId: restaurant.id,
        restaurantSlug: restaurant.slug,
        tableToken: effectiveTableToken ?? null,
      })
    })
    if (surface !== 'menu') restoreCustomerSurface(surface)
  }, [effectiveTableToken, restaurant.id, restaurant.slug, restoreCustomerSurface])

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
    couponCode,
    onCouponError: rejectCoupon,
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
    let cancelled = false
    const restore = async () => {
      await useCartStore.persist.rehydrate()
      if (cancelled) return
      bindCartScope(restaurant.id, tableToken ?? null)
      if (!cancelled) setCartScopeReady(true)
    }
    void restore()
    return () => { cancelled = true }
  }, [bindCartScope, restaurant.id, tableToken])

  useEffect(() => {
    if (!cartScopeReady || orderingEnabled) return
    clearRestaurantCarts(restaurant.id)
    setIsCartOpen(false)
    setHasOpenedCart(false)
    setCartPreviewState(null)
  }, [cartScopeReady, clearRestaurantCarts, orderingEnabled, restaurant.id])

  useEffect(() => {
    if (!cartScopeReady || tableToken || !storedTableToken) return
    let cancelled = false
    const validateStoredTable = async () => {
      const response = await fetch(`/api/table-state?token=${encodeURIComponent(storedTableToken)}`, { cache: 'no-store' })
      if (!cancelled && !response.ok) clearTableScope(restaurant.id)
    }
    void validateStoredTable()
    return () => { cancelled = true }
  }, [cartScopeReady, clearTableScope, restaurant.id, storedTableToken, tableToken])

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
    const automaticPromotion = automaticPromotionsByItemId.get(item.id)
    const freebie = automaticPromotion ? null : automaticFreebiesByItemId.get(item.id)
    setPendingFreebie(freebie ? { request: freebie, instanceId: createClientId(), qualifier: item, reward: null, quantity: 1, stage: 'qualifier' } : null)
    setPendingPromotion(automaticPromotion
      ? { originalPrice: automaticPromotion.originalPrice, promotion: automaticPromotion.promotion }
      : null)
    setSelectedItem(automaticPromotion?.item ?? item)
  }, [automaticFreebiesByItemId, automaticPromotionsByItemId])

  const handleQuickAdd = useCallback((item: MenuItem, originalPrice?: number, promotion?: SectionPromotionContext) => {
    const automaticPromotion = promotion ? null : automaticPromotionsByItemId.get(item.id)
    const freebie = promotion || automaticPromotion ? null : automaticFreebiesByItemId.get(item.id)
    if (freebie) {
      setPendingPromotion(null)
      setPendingFreebie({ request: freebie, instanceId: createClientId(), qualifier: item, reward: null, quantity: 1, stage: isProductConfigurable(item) ? 'qualifier' : 'picker' })
      setSelectedItem(isProductConfigurable(item) ? item : null)
      return
    }
    const effectiveItem = automaticPromotion?.item ?? item
    const effectivePromotion = automaticPromotion?.promotion ?? promotion
    const effectiveOriginalPrice = automaticPromotion?.originalPrice ?? originalPrice
    const quantityStep = effectivePromotion?.quantityStep ?? 1
    if (isProductConfigurable(effectiveItem)) {
      setPendingPromotion(effectivePromotion ? { originalPrice: effectiveOriginalPrice ?? effectiveItem.price, promotion: effectivePromotion } : null)
      setSelectedItem(effectiveItem)
    } else {
      addItem(effectiveItem, [], [], quantityStep, effectiveOriginalPrice, [], undefined, effectivePromotion)
      setIsCartOpen(true)
    }
  }, [addItem, automaticFreebiesByItemId, automaticPromotionsByItemId])

  useEffect(() => {
    const prefix = '#product-'
    if (!window.location.hash.startsWith(prefix)) return
    const itemId = decodeURIComponent(window.location.hash.slice(prefix.length))
    const item = itemById.get(itemId)
    if (!item?.is_available) return
    setPendingPromotion(null)
    setSelectedItem(item)
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
  }, [itemById])

  const addReorderLinesToCart = useCallback((lines: Array<NonNullable<CustomerReorderPreviewView['lines'][number]['cartLine']>>) => {
    let added = 0
    for (const line of lines) {
      const item = itemById.get(line.itemId)
      if (!item?.is_available) continue
      addItem(
        item,
        line.selectedModifiers,
        item.modifier_groups,
        line.quantity,
        undefined,
        line.removedIngredientIds,
        undefined,
        undefined,
        line.productNote,
      )
      added += 1
    }
    if (added > 0) setIsCartOpen(true)
    return added
  }, [addItem, itemById])

  useEffect(() => {
    if (!cartScopeReady) return
    let cancelled = false
    void import('../../lib/menu-continuity-client').then(({ consumeReorderDraft }) => {
      if (!cancelled) addReorderLinesToCart(consumeReorderDraft(restaurant.slug))
    })
    return () => { cancelled = true }
  }, [addReorderLinesToCart, cartScopeReady, restaurant.slug])

  const handleOpenFavorite = useCallback<AccountActions['openFavorite']>((favorite: CustomerFavoriteView) => {
    if (favorite.restaurant.slug !== restaurant.slug) {
      window.location.assign(`/${encodeURIComponent(favorite.restaurant.slug)}#product-${encodeURIComponent(favorite.item.id)}`)
      return { ok: true }
    }
    const item = itemById.get(favorite.item.id)
    if (!item?.is_available) return { ok: false, error: 'Bu favori ürün şu anda menüde bulunmuyor.' }
    handleOpenProduct(item)
    return { ok: true }
  }, [handleOpenProduct, itemById, restaurant.slug])

  const handleApplyReorder = useCallback<AccountActions['applyReorder']>(async (preview: CustomerReorderPreviewView) => {
    if (preview.restaurant.slug !== restaurant.slug) {
      const { storeReorderDraft } = await import('../../lib/menu-continuity-client')
      storeReorderDraft(preview)
      window.location.assign(`/${encodeURIComponent(preview.restaurant.slug)}`)
      return { ok: true }
    }
    const added = addReorderLinesToCart(preview.lines.flatMap((line) => line.cartLine ? [line.cartLine] : []))
    return added > 0 ? { ok: true } : { ok: false, error: 'Siparişteki ürünler güncel menüye eklenemedi.' }
  }, [addReorderLinesToCart, restaurant.slug])

  const accountActions = useMemo<AccountActions>(() => ({
    openFavorite: handleOpenFavorite,
    applyReorder: handleApplyReorder,
    logout: async (scope) => await handleLogout(scope)
      ? { ok: true }
      : { ok: false, error: 'Çıkış tamamlanamadı. Bağlantını kontrol edip tekrar dene.' },
  }), [handleApplyReorder, handleLogout, handleOpenFavorite])

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
    setCampaignNotice(null)
    setPendingPromotion(null)
    setPendingFreebie(null)
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
      instanceId: createClientId(),
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

  const addResolvedFreebieToCart = useCallback((freebie: PendingFreebie) => {
    if (!freebie.qualifier || !freebie.reward) return
    const qualifierSelection = freebie.qualifierSelection ?? { modifiers: [], removedIngredientIds: [] }
    const rewardSelection = freebie.rewardSelection ?? { modifiers: [], removedIngredientIds: [] }
    const identity = { sectionInstanceId: freebie.request.sectionInstanceId, kind: 'promo-slider' as const, offer: 'freebie' as const, instanceId: freebie.instanceId }
    for (const cartId of freebie.replaceCartIds ?? []) removeItem(cartId)
    addItem(
      freebie.qualifier,
      qualifierSelection.modifiers,
      freebie.qualifier.modifier_groups,
      freebie.quantity,
      undefined,
      qualifierSelection.removedIngredientIds,
      undefined,
      { ...identity, role: 'qualifier' },
      qualifierSelection.productNote,
    )
    addItem(
      { ...freebie.reward, price: 0 },
      rewardSelection.modifiers,
      freebie.reward.modifier_groups,
      freebie.quantity,
      freebie.reward.price,
      rewardSelection.removedIngredientIds,
      undefined,
      { ...identity, role: 'reward' },
      rewardSelection.productNote,
    )
    setPendingFreebie(null)
    setCampaignNotice(null)
    setSelectedItem(null)
    setIsCartOpen(true)
  }, [addItem, removeItem])

  const handleAddFreebie = useCallback((request: FreebieAddRequest) => {
    setPendingCombo(null)
    setPendingPromotion(null)
    setSelectedItem(null)
    setPendingFreebie({ request, instanceId: createClientId(), qualifier: null, reward: null, quantity: 1, stage: 'picker' })
  }, [])

  const handleFreebieChoose = useCallback((qualifier: MenuItem, reward: MenuItem) => {
    if (!pendingFreebie) return
    const next: PendingFreebie = { ...pendingFreebie, qualifier, reward }
    if (!next.qualifierSelection && isProductConfigurable(qualifier)) {
      setPendingFreebie({ ...next, stage: 'qualifier' })
      setSelectedItem(qualifier)
      return
    }
    if (isProductConfigurable(reward)) {
      setPendingFreebie({ ...next, stage: 'reward' })
      setSelectedItem({ ...reward, price: 0 })
      return
    }
    addResolvedFreebieToCart(next)
  }, [addResolvedFreebieToCart, pendingFreebie])

  const handleModalAdd = useCallback((
    item: MenuItem,
    modifiers: SelectedModifier[],
    quantity: number,
    removedIngredientIds: string[],
    options?: ProductModalSubmitOptions,
  ) => {
    if (pendingFreebie) {
      const selection = { modifiers, removedIngredientIds, ...(options?.productNote ? { productNote: options.productNote } : {}) }
      if (pendingFreebie.stage === 'qualifier') {
        const next = { ...pendingFreebie, qualifier: item, quantity, qualifierSelection: selection }
        if (!next.reward) {
          setPendingFreebie({ ...next, stage: 'picker' })
          setSelectedItem(null)
        } else if (isProductConfigurable(next.reward)) {
          setPendingFreebie({ ...next, stage: 'reward' })
          setSelectedItem({ ...next.reward, price: 0 })
        } else addResolvedFreebieToCart(next)
        return
      }
      if (pendingFreebie.stage === 'reward') {
        addResolvedFreebieToCart({ ...pendingFreebie, reward: { ...item, price: pendingFreebie.reward?.price ?? item.price }, rewardSelection: selection })
        return
      }
    }
    if (!pendingCombo) {
      if (pendingPromotion) {
        addItem(
          item,
          modifiers,
          item.modifier_groups,
          quantity,
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
  }, [addItem, addResolvedComboToCart, addResolvedFreebieToCart, handleAddToCart, pendingCombo, pendingFreebie, pendingPromotion])

  const handleCartQuantity = useCallback((cartId: string, quantity: number) => {
    const target = cartItems.find((item) => item.cartId === cartId)
    if (target?.promotion?.offer === 'freebie' && target.promotion.instanceId) {
      const normalizedQuantity = Math.max(0, Math.min(99, Math.round(quantity)))
      for (const item of cartItems) {
        if (item.promotion?.offer === 'freebie' && item.promotion.instanceId === target.promotion.instanceId) updateQuantity(item.cartId, normalizedQuantity)
      }
      return
    }
    if (!target?.combo) {
      if (target?.promotion?.kind === 'promo-slider' && !automaticPromotionsByItemId.has(target.itemId)) {
        detachPromotion(target.cartId, itemById.get(target.itemId)?.price ?? target.originalPrice ?? target.price)
        updateQuantity(cartId, normalizeCartQuantityForStep(quantity, 1))
        return
      }
      const step = target?.promotion?.quantityStep ?? 1
      updateQuantity(cartId, normalizeCartQuantityForStep(quantity, step))
      return
    }
    const normalizedQuantity = Math.max(0, Math.min(99, Math.round(quantity)))
    for (const item of cartItems) {
      if (item.combo?.instanceId === target.combo.instanceId) {
        updateQuantity(item.cartId, normalizedQuantity)
      }
    }
  }, [automaticPromotionsByItemId, cartItems, detachPromotion, itemById, updateQuantity])

  const handleCartRemove = useCallback((cartId: string) => {
    const target = cartItems.find((item) => item.cartId === cartId)
    if (target?.promotion?.offer === 'freebie' && target.promotion.instanceId) {
      for (const item of cartItems) {
        if (item.promotion?.offer === 'freebie' && item.promotion.instanceId === target.promotion.instanceId) removeItem(item.cartId)
      }
      return
    }
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

  const handleChangeFreebieReward = useCallback((cartId: string) => {
    const target = cartItems.find((item) => item.cartId === cartId)
    const instanceId = target?.promotion?.offer === 'freebie' ? target.promotion.instanceId : null
    if (!instanceId) return
    const group = cartItems.filter((item) => item.promotion?.offer === 'freebie' && item.promotion.instanceId === instanceId)
    const qualifierLine = group.find((item) => item.promotion?.role === 'qualifier')
    const qualifier = qualifierLine ? itemById.get(qualifierLine.itemId) : null
    const campaign = target ? freebieCampaignsBySection.get(target.promotion?.sectionInstanceId ?? '') : null
    if (!qualifierLine || !qualifier || !campaign) return
    setIsCartOpen(false)
    setPendingFreebie({
      request: campaign,
      instanceId,
      qualifier,
      reward: null,
      quantity: qualifierLine.quantity,
      stage: 'picker',
      qualifierSelection: { modifiers: qualifierLine.modifiers, removedIngredientIds: qualifierLine.removedIngredientIds, ...(qualifierLine.productNote ? { productNote: qualifierLine.productNote } : {}) },
      replaceCartIds: group.map((item) => item.cartId),
    })
  }, [cartItems, freebieCampaignsBySection, itemById])

  const closePendingFreebie = useCallback(() => {
    const shouldReturnToCart = Boolean(pendingFreebie?.replaceCartIds?.length)
    setPendingFreebie(null)
    setSelectedItem(null)
    if (shouldReturnToCart) setIsCartOpen(true)
  }, [pendingFreebie?.replaceCartIds])

  const comboModalContext = useMemo(() => {
    if (!pendingCombo) return undefined
    const currentItemIndex = pendingCombo.configurationIndices[pendingCombo.cursor]
    const configuredModifierTotal = Object.entries(pendingCombo.selections).reduce((total, [rawIndex, selection]) => {
      const comboItem = pendingCombo.request.items[Number(rawIndex)]
      return comboItem ? total + getComboModifierTotal(comboItem, selection.modifiers) : total
    }, 0)
    return {
      baseTotal: pendingCombo.request.total + configuredModifierTotal,
      items: pendingCombo.request.items.map((comboItem, index) => ({
        id: comboItem.id,
        name: comboItem.name,
        imageUrl: comboItem.images[0] ?? null,
        state: index === currentItemIndex
          ? 'current' as const
          : pendingCombo.selections[index]
            ? 'ready' as const
            : pendingCombo.configurationIndices.includes(index)
              ? 'upcoming' as const
              : 'included' as const,
      })),
    }
  }, [pendingCombo])

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
    cartQuantityByItemId,
    cartSummary,
  } = useMenuCatalog({ items, categories, menuFilters, cartItems })

  const toggleMenuFilter = useCallback((filter: MenuFilterDefinition) => {
    setMenuFilters((current) => current.some((candidate) => candidate.id === filter.id)
      ? current.filter((candidate) => candidate.id !== filter.id)
      : [...current, filter])
  }, [])

  function renderItems(catId: string, prioritizeFirstImage = false) {
    const catItems = itemsByCategory[catId] ?? []
    const firstCardItemId = prioritizeFirstImage
      ? catItems.find((item) => item.images.length > 0)?.id
      : undefined
    return (
      <>
        {catItems.map((item) => {
          const cartQuantity = cartQuantityByItemId.get(item.id) ?? 0
          const automaticPromotion = automaticPromotionsByItemId.get(item.id)
          const automaticFreebie = automaticPromotion ? null : automaticFreebiesByItemId.get(item.id)
          return (
            <ProductCard
              key={item.id}
              item={item}
              onOpen={handleOpenProduct}
              onQuickAdd={handleQuickAdd}
              promotionLabel={automaticPromotion?.promotion.quantityStep === 2 ? '2 al 1 öde' : automaticFreebie ? 'Hediye fırsatı' : undefined}
              orderingEnabled={orderingEnabled}
              cartQuantity={orderingEnabled ? cartQuantity : 0}
              {...(customerAccountsEnabled && member ? {
                isFavorite: favoriteIds.has(item.id),
                onToggleFavorite: () => setFavoriteToggleRequest((current) => ({ itemId: item.id, requestId: (current?.requestId ?? 0) + 1 })),
              } : {})}
              imagePriority={item.id === firstCardItemId}
              imageDelivery={productImageDelivery(item.images[0])}
              onIncrement={() => {
                if (automaticFreebie) {
                  const paired = cartItems.find((ci) => ci.itemId === item.id && ci.promotion?.offer === 'freebie' && ci.promotion.role === 'qualifier')
                  if (paired) handleCartQuantity(paired.cartId, paired.quantity + 1)
                  else handleQuickAdd(item)
                  return
                }
                const existing = cartItems.find((ci) => ci.itemId === item.id && !ci.combo && (
                  automaticPromotion
                    ? ci.promotion?.sectionInstanceId === automaticPromotion.promotion.sectionInstanceId
                    : !ci.promotion || ci.promotion.kind === 'promo-slider'
                ))
                if (existing) {
                  if (!automaticPromotion && existing.promotion?.kind === 'promo-slider') {
                    detachPromotion(existing.cartId, item.price)
                  }
                  updateQuantity(existing.cartId, existing.quantity + (automaticPromotion?.promotion.quantityStep ?? 1))
                }
                else handleQuickAdd(item)
              }}
              onDecrement={() => {
                if (automaticFreebie) {
                  const paired = cartItems.find((ci) => ci.itemId === item.id && ci.promotion?.offer === 'freebie' && ci.promotion.role === 'qualifier')
                  if (!paired) return
                  if (paired.quantity > 1) handleCartQuantity(paired.cartId, paired.quantity - 1)
                  else handleCartRemove(paired.cartId)
                  return
                }
                const existing = cartItems.find((ci) => ci.itemId === item.id && !ci.combo && (
                  automaticPromotion
                    ? ci.promotion?.sectionInstanceId === automaticPromotion.promotion.sectionInstanceId
                    : !ci.promotion || ci.promotion.kind === 'promo-slider'
                ))
                if (!existing) return
                const step = automaticPromotion?.promotion.quantityStep ?? 1
                if (!automaticPromotion && existing.promotion?.kind === 'promo-slider') {
                  detachPromotion(existing.cartId, item.price)
                }
                if (existing.quantity > step) updateQuantity(existing.cartId, existing.quantity - step)
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
      <ThemeProvider initialTheme={theme} isPreview={isPreview} initialRestaurantName={restaurant.name} initialLogoUrl={restaurant.logo_url ?? null} onThemeChange={setRuntimeTheme}>
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
      onThemeChange={setRuntimeTheme}
    >
      <ComboIntentConsumer
        enabled={orderingEnabled}
        cartScopeReady={cartScopeReady}
        restaurantSlug={restaurant.slug}
        items={items}
        onAddCombo={handleAddCombo}
        onInvalid={() => {
          setCampaignNotice('Bu kombo güncellendi veya artık yayında değil. Menüdeki güncel kampanyaları inceleyin.')
          setIsCartOpen(true)
        }}
      />
      <FreebieIntentConsumer enabled={orderingEnabled} cartScopeReady={cartScopeReady} theme={runtimeTheme} items={items} restaurantSlug={restaurant.slug} isPreview={isPreview} onAddFreebie={handleAddFreebie} />
      <CustomerSessionSynchronizer authenticated={customerAccountsEnabled && Boolean(member)} />
      <RewardNoticeCard restaurantId={restaurant.id} enabled={!isPreview && customerAccountsEnabled && loyaltyEnabled && Boolean(member)} />
      <ReviewPrompt restaurantId={restaurant.id} restaurantName={restaurant.name} enabled={!isPreview && customerAccountsEnabled && Boolean(member)} />
      {customerAccountsEnabled && <MenuFavoritesController
        restaurantId={restaurant.id}
        authenticated={Boolean(member)}
        availableItemIds={availableFavoriteItemIds}
        toggleRequest={favoriteToggleRequest}
        onChange={setFavoriteIds}
      />}
      <MenuLocaleProvider locale={effectiveMenuLocale} data={menuTranslations}>
      {menuTranslations.enabled && <MenuLanguageControl locale={effectiveMenuLocale} onChange={changeMenuLocale} />}
      <DefaultMenuPage
        categories={visibleCategories}
        categoryMeta={categoryMeta}
        renderItems={renderItems}
        menuFilters={(
          <DietaryFilterBar
            selected={menuFilters}
            onToggle={toggleMenuFilter}
            onClear={() => setMenuFilters([])}
            onSelectionChange={setMenuFilters}
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
        filterEmptyState={menuFilters.length > 0 && filteredItems.length === 0 ? (
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
            {effectiveMenuLocale === 'en' ? 'No items match the selected filters.' : 'Seçili filtrelere uyan ürün yok.'}
          </div>
        ) : null}
        tableId={effectiveTableToken}
        {...(tableLabel ? { tableLabel } : {})}
        homeHref={homeHref}
        {...(orderingEnabled ? {
          cartSummary: isPreview && cartPreviewState !== null ? previewCartSummary : cartSummary,
          onOpenCart: () => setIsCartOpen(true),
        } : {})}
        items={filteredItems}
        onQuickAdd={orderingEnabled ? handleQuickAdd : () => {}}
        {...(orderingEnabled ? { onAddCombo: handleAddCombo } : {})}
        comboInteractionState={orderingEnabled ? 'enabled' : 'ordering-disabled'}
        onAddFreebie={orderingEnabled ? handleAddFreebie : () => {}}
        billSummary={billSummary}
        onOpenBill={() => { void openBill() }}
        memberSummary={{
          authenticated: customerAccountsEnabled && Boolean(member),
          name: member?.name ?? null,
          welcomeBonus: loyaltyEnabled ? welcomeBonus : 0,
          ...(member && memberBalances ? {
            stamps: memberBalances.stamps,
            stampGoal: memberBalances.stampGoal,
            points: memberBalances.points,
            stampEnabled: memberBalances.stampEnabled,
            pointsEnabled: memberBalances.pointsEnabled,
            tierColor: memberBalances.tier.color,
          } : {}),
        }}
        onOpenMember={(target: MemberOpenTarget = 'overview') => { setCustomerAuthSurface('menu'); setMemberTarget(target); setIsMemberOpen(true) }}
        {...(requestButtonsEnabled ? {
          onServiceRequest: isPreview ? async () => true : sendServiceRequest,
          onOpenServiceRequests: () => setIsServiceRequestsOpen(true),
        } : {})}
        memberLoyalty={member && memberBalances && (memberBalances.stampEnabled || memberBalances.pointsEnabled)
          ? {
              filled: memberBalances.stamps,
              total: memberBalances.stampGoal,
              points: memberBalances.points,
              pointsEnabled: memberBalances.pointsEnabled,
              stampsEnabled: memberBalances.stampEnabled,
              tierName: memberBalances.tier.name,
            }
          : null}
        editorPreview={isPreview}
        storeInfo={storeInfo}
      />

      </MenuLocaleProvider>

      <MenuLocaleProvider locale={effectiveMenuLocale} data={menuTranslations}>
      <FreebieCampaignPicker
        campaign={pendingFreebie?.stage === 'picker' ? pendingFreebie.request : null}
        qualifier={pendingFreebie?.stage === 'picker' ? pendingFreebie.qualifier : null}
        onClose={closePendingFreebie}
        onChoose={handleFreebieChoose}
      />

      {hasOpenedProduct && <ProductModal
        item={selectedItem}
        onClose={() => {
          setSelectedItem(null)
          setPendingCombo(null)
          setPendingPromotion(null)
          closePendingFreebie()
        }}
        onAddToCart={handleModalAdd}
        onOpenAr={setArItem}
        orderingEnabled={orderingEnabled}
        recommendationItems={!pendingCombo && !pendingPromotion && !pendingFreebie
          ? (selectedItem?.recommended_item_ids ?? []).flatMap((id) => {
              const candidate = itemById.get(id)
              const recommendation = candidate?.is_available ? candidate : undefined
              return recommendation ? [recommendation] : []
            })
          : []}
        contextLabel={pendingFreebie ? pendingFreebie.stage === 'reward' ? 'Hediye ürün' : 'Kampanyalı ana ürün' : pendingCombo ? `Kombo ürünü ${(pendingCombo.configurationIndices[pendingCombo.cursor] ?? 0) + 1}/${pendingCombo.request.items.length}` : pendingPromotion ? 'Kampanyalı ürün' : undefined}
        contextTitle={pendingFreebie ? pendingFreebie.request.title : pendingCombo ? `${pendingCombo.request.title} · ${pendingCombo.request.items.length} ürün birlikte sepete eklenecek` : pendingPromotion?.promotion.quantityStep === 2 ? '2’li paketler halinde eklenir' : pendingPromotion ? 'Seçeneklerinizi tamamlayın' : undefined}
        comboContext={comboModalContext}
        promotionLabel={pendingFreebie?.stage === 'reward' ? 'Hediye · taban fiyat ₺0' : pendingPromotion?.promotion.quantityStep === 2 ? '2 al 1 öde' : undefined}
        quantityStep={pendingPromotion?.promotion.quantityStep ?? 1}
        lockQuantity={Boolean(pendingCombo) || pendingFreebie?.stage === 'reward'}
        submitLabel={pendingFreebie
          ? pendingFreebie.stage === 'reward' ? 'Hediyeyi ekle' : 'Kaydet ve hediyeni seç'
          : pendingCombo
          ? pendingCombo.cursor + 1 < pendingCombo.configurationIndices.length
            ? 'Seçimi kaydet ve devam et'
            : 'Komboyu sepete ekle'
          : pendingPromotion?.promotion.quantityStep === 2
            ? '2’li paketi sepete ekle'
            : undefined}
        closeAfterAdd={!pendingCombo && !pendingFreebie}
      />}
      {arItem?.ar && <MenuArViewer item={arItem} onClose={() => setArItem(null)} />}
      </MenuLocaleProvider>

      {orderingEnabled && hasOpenedCart && <CartDrawer
        isOpen={isCartOpen}
        items={effectiveCartItems}
        isPlacing={isPlacing}
        orderError={campaignNotice ?? orderError}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={isPreview && cartPreviewState !== null
          ? (_cartId, quantity) => { setPreviewCartQuantity(Math.max(0, quantity)); if (quantity <= 0) setCartPreviewState('empty') }
          : handleCartQuantity}
        onRemoveItem={isPreview && cartPreviewState !== null
          ? () => { setPreviewCartQuantity(0); setCartPreviewState('empty') }
          : handleCartRemove}
        onChangeFreebieReward={handleChangeFreebieReward}
        onPlaceOrder={isPreview && cartPreviewState !== null ? () => {} : handlePlaceOrder}
        canCheckout={Boolean(effectiveTableToken) || Boolean(isPreview && cartPreviewState)}
        checkoutUnavailableReason={!effectiveTableToken && !(isPreview && cartPreviewState) ? checkoutUnavailableMessage : undefined}
        returnFocusSelector={resolveMenuActionPlacements(runtimeTheme).cart === 'drawer' ? '[aria-controls="menu-nav-drawer"]' : '[aria-label^="Sepeti aç"]'}
        onPay={effectiveTableToken ? handlePayClick : undefined}
        onSplitBill={effectiveTableToken ? () => { setIsCartOpen(false); setIsSplitOpen(true) } : undefined}
        billSummary={billSummary}
        onOpenBill={() => { setIsCartOpen(false); void openBill() }}
        pointsRedeem={!cartPreviewState && canRedeem && !catalogItemId ? {
          balance: memberBalances?.points ?? 0,
          rate: pointsRate,
          redeemTl: Math.floor(redeemPoints / pointsRate),
          onChange: (redeemTl: number) => setRedeemPoints(Math.max(0, redeemTl) * pointsRate),
        } : null}
        stampReward={!cartPreviewState && stampClaimable ? {
          cardFull: true,
          rewardName: (rewardItemId ? itemById.get(rewardItemId) : undefined)?.name ?? null,
          rewardInCart: cartItems.some((ci) => ci.itemId === rewardItemId),
          claimed: claimStamp,
          onToggle: (v: boolean) => setClaimStamp(v),
        } : null}
        catalogReward={!cartPreviewState && catalogItemId ? {
          itemName: rewardCatalog.find((r) => r.itemId === catalogItemId)?.name ?? 'ürün',
          pointCost: rewardCatalog.find((r) => r.itemId === catalogItemId)?.pointCost ?? 0,
          onClear: () => setCatalogItemId(null),
        } : null}
        discountPreview={cartPreviewState ? null : discountPreview}
        coupon={cartPreviewState ? null : {
          draft: couponDraft,
          appliedCode: couponCode,
          appliedName: discountPreview?.couponName ?? null,
          discountAmount: discountPreview?.couponDiscountAmount ?? 0,
          error: couponError,
          pending: couponPending,
          blocksCheckout: Boolean(couponCode && couponError),
          onDraftChange: setCouponDraft,
          onApply: applyCoupon,
          onRemove: removeCoupon,
        }}
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

      {orderingEnabled && !isCartOpen && effectiveCartItems.length > 0 && (
        <LazyFloatingCartTrigger items={effectiveCartItems} onClick={() => setIsCartOpen(true)} />
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
          onClose={handleMemberClose}
          balances={member ? memberBalances : null}
          authenticated={Boolean(member)}
          memberName={member?.name ?? null}
          restaurantId={restaurant.id}
          restaurantSlug={restaurant.slug}
          restaurantName={restaurant.name}
          tableLabel={tableLabel ?? null}
          tableToken={effectiveTableToken ?? null}
          guestSessionId={sessionId}
          deviceId={deviceId}
          authSurface={customerAuthSurface}
          initialTarget={memberTarget}
          authReturn={customerAuthReturn}
          oauthProviders={customerAuthProviders}
          emailOtpEnabled={emailOtpEnabled}
          phoneOtpEnabled={phoneOtpEnabled}
          welcomeBonus={welcomeBonus}
          rewardCatalog={rewardCatalog}
          onRedeemCatalog={handleRedeemCatalog}
          onRefresh={refetchBalances}
          onVerified={(m) => { setMember(m); void refetchBalances() }}
          onAuthContextComplete={handleAuthContextComplete}
          accountActions={accountActions}
          {...(accountPreviewState ? { accountPreviewState, accountPreviewHistoryEnabled: true } : {})}
        />
      )}

      {isSplitOpen && tableSessionId && (
        <SplitBillModal
          slug={restaurant.slug}
          tableToken={effectiveTableToken!}
          tableSessionId={tableSessionId}
          deviceId={deviceId}
          initialBuyerName={member?.name ?? null}
          onClose={() => setIsSplitOpen(false)}
        />
      )}

    </ThemeProvider>
  )
}
