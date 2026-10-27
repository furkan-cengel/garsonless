'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { AppIcons as I } from '@garsonless/ui/icons'
import { formatTRY, LoyaltyCardShell, LoyaltyStampGrid } from '@garsonless/ui/menu'
import type { AccountPreviewState } from '@garsonless/design-engine'
import type { ApiResult } from '../../../lib/customer-auth-contract'
import type {
  CustomerAccountView,
  CustomerAccountLoyaltyView,
  CustomerFavoriteView,
  CustomerFavoritesView,
  CustomerLoyaltyActivityPageView,
  CustomerOrderDetailView,
  CustomerOrderFilter,
  CustomerOrderSummaryView,
  CustomerOrdersPageView,
  CustomerPrivacyExportView,
  CustomerDeleteRequestView,
  CustomerReorderPreviewView,
} from '../../../lib/customer-account-contract'
import { mergeCurrentRestaurantLoyalty } from '../../../lib/customer-account-contract'

interface Props {
  fallbackName: string | null
  onClose: () => void
  onNameChange: (name: string) => void
  actions: AccountActions
  rewardCount?: number
  onOpenRewards?: () => void
  currentRestaurantId?: string
  currentRestaurantSlug?: string
  currentRestaurantName?: string
  currentRestaurantLoyalty?: CustomerAccountLoyaltyView | null
  initialTab?: AccountTab
  previewState?: AccountPreviewState
  previewHistoryEnabled?: boolean
  previewRestaurant?: { id: string; slug: string; name: string; logoUrl: string | null }
}

export type AccountActionResult = { ok: true } | { ok: false; error: string }
export interface AccountActions {
  openFavorite: (favorite: CustomerFavoriteView) => AccountActionResult | Promise<AccountActionResult>
  applyReorder: (preview: CustomerReorderPreviewView) => AccountActionResult | Promise<AccountActionResult>
  logout: (scope: 'device' | 'all') => AccountActionResult | Promise<AccountActionResult>
}

type AccountTab = 'overview' | 'orders' | 'favorites' | 'profile'
type ResourceStatus = 'idle' | 'loading' | 'ready' | 'refreshing' | 'error'

interface OrdersState {
  items: CustomerOrderSummaryView[]
  nextCursor: string | null
  loaded: boolean
  loading: boolean
  error: boolean
}

const EMPTY_ORDERS: OrdersState = { items: [], nextCursor: null, loaded: false, loading: false, error: false }

export default function AccountCenter({ fallbackName, onClose, onNameChange, actions, rewardCount = 0, onOpenRewards, currentRestaurantId, currentRestaurantSlug, currentRestaurantName, currentRestaurantLoyalty, initialTab = 'overview', previewState, previewHistoryEnabled = false, previewRestaurant }: Props) {
  const [tab, setTab] = useState<AccountTab>(initialTab)
  const [account, setAccount] = useState<CustomerAccountView | null>(null)
  const [accountLoading, setAccountLoading] = useState(true)
  const [accountStatus, setAccountStatus] = useState<ResourceStatus>('loading')
  const [accountFetchedAt, setAccountFetchedAt] = useState<number | null>(null)
  const [accountError, setAccountError] = useState(false)
  const [ordersFilter, setOrdersFilter] = useState<CustomerOrderFilter>('active')
  const [orders, setOrders] = useState<Record<CustomerOrderFilter, OrdersState>>({
    active: EMPTY_ORDERS,
    past: EMPTY_ORDERS,
  })
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrderDetailView | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(false)
  const [favorites, setFavorites] = useState<CustomerFavoriteView[]>([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [favoritesLoaded, setFavoritesLoaded] = useState(false)
  const [favoritesError, setFavoritesError] = useState(false)
  const [reorderPreview, setReorderPreview] = useState<CustomerReorderPreviewView | null>(null)
  const [reorderLoading, setReorderLoading] = useState(false)
  const [reorderError, setReorderError] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(fallbackName ?? '')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [logoutBusy, setLogoutBusy] = useState<'device' | 'all' | null>(null)
  const [consentBusy, setConsentBusy] = useState<string | null>(null)
  const [privacyBusy, setPrivacyBusy] = useState<'export' | 'delete' | null>(null)
  const [privacyMessage, setPrivacyMessage] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [confirmAllLogout, setConfirmAllLogout] = useState(false)
  const [previewMode, setPreviewMode] = useState<string | null>(previewState ?? null)
  const embeddedPreview = Boolean(previewState) && !previewHistoryEnabled
  const tabRefs = useRef<Record<AccountTab, HTMLButtonElement | null>>({ overview: null, orders: null, favorites: null, profile: null })
  const reorderHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const requestControllers = useRef(new Map<string, AbortController>())

  useEffect(() => {
    const preview = previewState ?? (process.env.NODE_ENV === 'development'
      ? new URLSearchParams(window.location.search).get('__customerAccountPreview')
      : null)
    setPreviewMode(preview)
    if (preview) {
      if (preview === 'loading') {
        setAccount(null)
        setAccountLoading(true)
        setAccountStatus('loading')
        return
      }
      if (preview === 'error') {
        setAccount(null)
        setAccountLoading(false)
        setAccountError(true)
        setAccountStatus('error')
        setFavoritesError(true)
        return
      }
      const fixture = preview === 'empty'
        ? emptyPreviewAccount(previewRestaurant)
        : accountPreviewFixture(previewRestaurant)
      const activeFixture = preview === 'empty' ? [] : previewOrders(PREVIEW_ACTIVE, previewRestaurant)
      const pastFixture = preview === 'empty' ? [] : previewOrders(PREVIEW_PAST, previewRestaurant)
      const detailFixture = previewOrderDetail(previewRestaurant)
      const reorderFixture = previewReorderFixture(previewRestaurant)
      setAccount(fixture)
      setNameDraft(fixture.profile.name ?? '')
      setOrders({
        active: { items: activeFixture, nextCursor: null, loaded: true, loading: false, error: false },
        past: { items: pastFixture, nextCursor: null, loaded: true, loading: false, error: false },
      })
      if (preview === 'orders' || preview === 'detail') setTab('orders')
      if (preview === 'favorites') setTab('favorites')
      if (preview === 'profile' || preview === 'privacy') setTab('profile')
      if (preview === 'detail') setSelectedOrder(detailFixture)
      if (preview === 'reorder') {
        setTab('orders')
        setSelectedOrder(detailFixture)
        setReorderPreview(reorderFixture)
      }
      setFavorites(preview === 'empty' ? [] : previewFavorites(PREVIEW_FAVORITES, previewRestaurant))
      setFavoritesLoaded(true)
      setFavoritesLoading(false)
      setAccountLoading(false)
      setAccountStatus('ready')
      setAccountFetchedAt(Date.now())
      return
    }
    void loadAccount()
    void loadOrders('active', null)
    return () => abortAllRequests()
    // AccountCenter is remounted when its restaurant fixture changes; keeping this
    // controller keyed to the closed preview state avoids refetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewState])

  useEffect(() => {
    if (previewMode) return
    const refreshVisibleResources = () => {
      if (document.visibilityState === 'hidden') return
      void loadAccount()
      void loadOrders('active', null)
      if (tab === 'favorites' && favoritesLoaded) void loadFavorites()
    }
    window.addEventListener('focus', refreshVisibleResources)
    document.addEventListener('visibilitychange', refreshVisibleResources)
    return () => {
      window.removeEventListener('focus', refreshVisibleResources)
      document.removeEventListener('visibilitychange', refreshVisibleResources)
    }
    // Loader identities follow controller state. Re-subscribing to those identities
    // would cause a refresh loop while the request itself updates that state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoritesLoaded, previewMode, tab])

  function beginRequest(key: string, providedSignal?: AbortSignal) {
    if (providedSignal) return { signal: providedSignal, release: () => undefined }
    requestControllers.current.get(key)?.abort()
    const controller = new AbortController()
    requestControllers.current.set(key, controller)
    return {
      signal: controller.signal,
      release: () => {
        if (requestControllers.current.get(key) === controller) requestControllers.current.delete(key)
      },
    }
  }

  function abortAllRequests() {
    requestControllers.current.forEach((controller) => controller.abort())
    requestControllers.current.clear()
  }

  async function loadAccount(signal?: AbortSignal) {
    const request = beginRequest('account', signal)
    setAccountLoading(account === null)
    setAccountStatus(account === null ? 'loading' : 'refreshing')
    setAccountError(false)
    try {
      const response = await fetch('/api/account', { signal: request.signal, cache: 'no-store' })
      const result = await response.json() as ApiResult<CustomerAccountView>
      if (!response.ok || !result.ok) throw new Error('account_unavailable')
      setAccount(result.data)
      setNameDraft(result.data.profile.name ?? '')
      setAccountFetchedAt(Date.now())
      setAccountStatus('ready')
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setAccountError(true)
        setAccountStatus(account === null ? 'error' : 'ready')
      }
    } finally {
      if (!request.signal.aborted) setAccountLoading(false)
      request.release()
    }
  }

  async function loadFavorites(signal?: AbortSignal) {
    const request = beginRequest('favorites', signal)
    setFavoritesLoading(!favoritesLoaded)
    setFavoritesError(false)
    try {
      const restaurantQuery = currentRestaurantId ? `?restaurantId=${encodeURIComponent(currentRestaurantId)}` : ''
      const response = await fetch(`/api/account/favorites${restaurantQuery}`, { signal: request.signal, cache: 'no-store' })
      const result = await response.json() as ApiResult<CustomerFavoritesView>
      if (!response.ok || !result.ok) throw new Error('favorites_unavailable')
      setFavorites(result.data.items)
      setFavoritesLoaded(true)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setFavoritesError(true)
    } finally {
      if (!request.signal.aborted) setFavoritesLoading(false)
      request.release()
    }
  }

  async function loadOrders(filter: CustomerOrderFilter, cursor: string | null, signal?: AbortSignal) {
    const request = beginRequest(`orders:${filter}`, signal)
    setOrders((current) => ({ ...current, [filter]: { ...current[filter], loading: true, error: false } }))
    try {
      const params = new URLSearchParams({ status: filter, limit: '8' })
      if (cursor) params.set('cursor', cursor)
      const response = await fetch(`/api/account/orders?${params}`, { signal: request.signal, cache: 'no-store' })
      const result = await response.json() as ApiResult<CustomerOrdersPageView>
      if (!response.ok || !result.ok) throw new Error('orders_unavailable')
      setOrders((current) => ({
        ...current,
        [filter]: {
          items: cursor ? [...current[filter].items, ...result.data.items] : result.data.items,
          nextCursor: result.data.nextCursor,
          loaded: true,
          loading: false,
          error: false,
        },
      }))
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setOrders((current) => ({ ...current, [filter]: { ...current[filter], loaded: true, loading: false, error: true } }))
      }
    } finally {
      request.release()
    }
  }

  async function openOrder(order: CustomerOrderSummaryView) {
    setReorderPreview(null)
    setReorderError(false)
    if (previewMode) {
      setSelectedOrder({ ...previewOrderDetail(previewRestaurant), ...order, items: PREVIEW_DETAIL.items })
      if (!embeddedPreview) pushDetailHistory()
      return
    }
    const request = beginRequest('order-detail')
    setDetailLoading(true)
    setDetailError(false)
    try {
      const response = await fetch(`/api/account/orders/${encodeURIComponent(order.id)}`, { signal: request.signal, cache: 'no-store' })
      const result = await response.json() as ApiResult<CustomerOrderDetailView>
      if (!response.ok || !result.ok) throw new Error('order_unavailable')
      setSelectedOrder(result.data)
      pushDetailHistory()
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setDetailError(true)
    } finally {
      if (!request.signal.aborted) setDetailLoading(false)
      request.release()
    }
  }

  async function previewReorder(orderId: string) {
    if (previewMode) {
      setReorderPreview(previewReorderFixture(previewRestaurant))
      window.requestAnimationFrame(() => reorderHeadingRef.current?.focus())
      return
    }
    setReorderLoading(true)
    setReorderError(false)
    try {
      const response = await fetch(`/api/account/orders/${encodeURIComponent(orderId)}/reorder-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const result = await response.json() as ApiResult<CustomerReorderPreviewView>
      if (!response.ok || !result.ok) throw new Error('reorder_unavailable')
      setReorderPreview(result.data)
      window.requestAnimationFrame(() => reorderHeadingRef.current?.focus())
    } catch {
      setReorderError(true)
    } finally {
      setReorderLoading(false)
    }
  }

  function selectTab(next: AccountTab) {
    setTab(next)
    setSelectedOrder(null)
    setReorderPreview(null)
    setDetailError(false)
    if (next === 'orders' && !orders[ordersFilter].loaded && !orders[ordersFilter].loading) {
      void loadOrders(ordersFilter, null)
    }
    if (next === 'favorites' && !favoritesLoaded && !favoritesLoading) void loadFavorites()
  }

  function focusTab(next: AccountTab) {
    selectTab(next)
    window.requestAnimationFrame(() => tabRefs.current[next]?.focus())
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, current: AccountTab) {
    const tabs: AccountTab[] = ['overview', 'orders', 'favorites', 'profile']
    const index = tabs.indexOf(current)
    let next: AccountTab | null = null
    if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length]!
    if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length]!
    if (event.key === 'Home') next = tabs[0]!
    if (event.key === 'End') next = tabs[tabs.length - 1]!
    if (!next) return
    event.preventDefault()
    focusTab(next)
  }

  function pushDetailHistory() {
    const state = window.history.state && typeof window.history.state === 'object' ? window.history.state : {}
    const marker = state.__masabuAccount as { token?: string; view?: string } | undefined
    if (!marker?.token || marker.view === 'detail') return
    window.history.pushState({ ...state, __masabuAccount: { token: marker.token, view: 'detail' } }, '')
  }

  function closeOrderDetail() {
    const marker = window.history.state?.__masabuAccount as { view?: string } | undefined
    if (!embeddedPreview && marker?.view === 'detail') {
      window.history.back()
      return
    }
    setSelectedOrder(null)
    setReorderPreview(null)
  }

  useEffect(() => {
    if (embeddedPreview) return
    const handlePopState = () => {
      const marker = window.history.state?.__masabuAccount as { view?: string } | undefined
      if (marker?.view !== 'detail') {
        setSelectedOrder(null)
        setReorderPreview(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [embeddedPreview])

  function selectOrderFilter(filter: CustomerOrderFilter) {
    setOrdersFilter(filter)
    setSelectedOrder(null)
    if (!orders[filter].loaded && !orders[filter].loading) void loadOrders(filter, null)
  }

  async function saveName() {
    const normalized = nameDraft.replace(/\s+/g, ' ').trim()
    if (normalized.length < 2 || normalized.length > 80 || saveState === 'saving') return
    if (previewMode) {
      setAccount((current) => current ? { ...current, profile: { ...current.profile, name: normalized } } : current)
      onNameChange(normalized)
      setEditingName(false)
      setSaveState('saved')
      return
    }
    setSaveState('saving')
    try {
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: normalized }),
      })
      const result = await response.json() as ApiResult<CustomerAccountView>
      if (!response.ok || !result.ok) throw new Error('profile_update_failed')
      setAccount(result.data)
      onNameChange(normalized)
      setEditingName(false)
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }

  async function logout(scope: 'device' | 'all') {
    if (previewMode) {
      setActionMessage('Önizleme oturumu kapatmaz ve gerçek hesap değişikliği yapmaz.')
      return
    }
    if (logoutBusy) return
    setLogoutBusy(scope)
    setActionMessage(null)
    try {
      const result = await actions.logout(scope)
      if (!result.ok) setActionMessage(result.error)
      else {
        setConfirmAllLogout(false)
        onClose()
      }
    } catch {
      setActionMessage('Çıkış tamamlanamadı. Bağlantını kontrol edip tekrar dene.')
    } finally {
      setLogoutBusy(null)
    }
  }

  async function openFavorite(favorite: CustomerFavoriteView) {
    setActionMessage(null)
    try {
      const result = await actions.openFavorite(favorite)
      if (!result.ok) setActionMessage(result.error)
      else onClose()
    } catch {
      setActionMessage('Favori ürün açılamadı. Tekrar dene.')
    }
  }

  async function applyReorder(preview: CustomerReorderPreviewView) {
    setActionMessage(null)
    try {
      const result = await actions.applyReorder(preview)
      if (!result.ok) setActionMessage(result.error)
      else onClose()
    } catch {
      setActionMessage('Ürünler sepete aktarılamadı. Tekrar dene.')
    }
  }

  async function updateConsent(restaurantId: string, consentType: 'contact_data' | 'marketing', grant: boolean) {
    const key = `${restaurantId}:${consentType}`
    if (consentBusy) return
    setConsentBusy(key)
    setPrivacyMessage(null)
    if (previewMode) {
      setAccount((current) => current ? {
        ...current,
        consents: current.consents.map((consent) => consent.restaurant.id === restaurantId
          ? { ...consent, [consentType === 'marketing' ? 'marketing' : 'contactData']: grant }
          : consent),
      } : current)
      setPrivacyMessage(grant ? 'İzin kaydedildi.' : 'İzin geri çekildi.')
      setConsentBusy(null)
      return
    }
    try {
      const response = await fetch('/api/account/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, consentType, grant }),
      })
      const result = await response.json() as ApiResult<CustomerAccountView>
      if (!response.ok || !result.ok) throw new Error('consent_update_failed')
      setAccount(result.data)
      setPrivacyMessage(grant ? 'İzin kaydedildi.' : 'İzin geri çekildi.')
    } catch {
      setPrivacyMessage('İzin güncellenemedi. Tekrar dene.')
    } finally {
      setConsentBusy(null)
    }
  }

  async function exportPrivacyData() {
    if (privacyBusy) return
    setPrivacyBusy('export')
    setPrivacyMessage(null)
    if (previewMode) {
      setPrivacyMessage('Veri dosyan hazırlandı ve indirildi.')
      setPrivacyBusy(null)
      return
    }
    try {
      const response = await fetch('/api/account/privacy/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: crypto.randomUUID() }),
      })
      const result = await response.json() as ApiResult<CustomerPrivacyExportView>
      if (!response.ok || !result.ok) throw new Error('privacy_export_failed')
      const url = URL.createObjectURL(new Blob([JSON.stringify(result.data.data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = result.data.fileName
      link.click()
      URL.revokeObjectURL(url)
      setPrivacyMessage('Veri dosyan hazırlandı ve indirildi.')
    } catch {
      setPrivacyMessage('Veri dosyası hazırlanamadı. Tekrar dene.')
    } finally {
      setPrivacyBusy(null)
    }
  }

  async function requestDeletion(confirmation: string) {
    if (privacyBusy || confirmation !== 'HESABIMI SİL') return
    setPrivacyBusy('delete')
    setPrivacyMessage(null)
    if (previewMode) {
      setAccount((current) => current ? {
        ...current,
        privacy: { deletionRequest: { id: crypto.randomUUID(), status: 'pending_review', requestedAt: new Date().toISOString() } },
      } : current)
      setPrivacyMessage('Silme talebin incelemeye alındı.')
      setPrivacyBusy(null)
      return
    }
    try {
      const response = await fetch('/api/account/privacy/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: crypto.randomUUID(), confirmation }),
      })
      const result = await response.json() as ApiResult<CustomerDeleteRequestView>
      if (!response.ok || !result.ok) throw new Error('delete_request_failed')
      setAccount((current) => current ? {
        ...current,
        privacy: {
          deletionRequest: {
            id: result.data.requestId,
            status: result.data.status,
            requestedAt: result.data.requestedAt,
          },
        },
      } : current)
      setPrivacyMessage(result.data.message)
    } catch {
      setPrivacyMessage('Silme talebi oluşturulamadı. Tekrar dene.')
    } finally {
      setPrivacyBusy(null)
    }
  }

  const currentOrders = orders[ordersFilter]
  const visibleAccount = useMemo(
    () => account ? mergeCurrentRestaurantLoyalty(account, currentRestaurantLoyalty) : null,
    [account, currentRestaurantLoyalty],
  )
  const firstName = (visibleAccount?.profile.name ?? fallbackName ?? 'Misafir').split(' ')[0]
  const refreshedLabel = accountFetchedAt
    ? new Date(accountFetchedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="ac-root">
      <style>{ACCOUNT_CENTER_CSS}</style>
      <header className="ac-header">
        {selectedOrder ? (
          <button type="button" className="ac-icon-button" onClick={closeOrderDetail} aria-label="Siparişlere dön"><I.chevLeft size={22} /></button>
        ) : <span className="ac-brand-mark" aria-hidden="true"><Image src="/android-chrome-192x192.png" alt="" width={44} height={44} priority /></span>}
        <div className="ac-heading">
          <span>{selectedOrder ? selectedOrder.restaurant.name : 'masabu Hesabım'}</span>
          <strong>{selectedOrder ? 'Sipariş detayı' : `Merhaba, ${firstName}`}</strong>
        </div>
        <button type="button" className="ac-icon-button" onClick={onClose} aria-label="Hesabı kapat"><I.close size={20} /></button>
      </header>

      {!selectedOrder && (
        <div className="ac-tabs" role="tablist" aria-label="Hesap bölümleri">
          <TabButton tab="overview" active={tab === 'overview'} buttonRef={(node) => { tabRefs.current.overview = node }} onClick={() => selectTab('overview')} onKeyDown={handleTabKeyDown} icon={<I.home size={18} />} label="Özet" />
          <TabButton tab="orders" active={tab === 'orders'} buttonRef={(node) => { tabRefs.current.orders = node }} onClick={() => selectTab('orders')} onKeyDown={handleTabKeyDown} icon={<I.receipt size={18} />} label="Siparişler" />
          <TabButton tab="favorites" active={tab === 'favorites'} buttonRef={(node) => { tabRefs.current.favorites = node }} onClick={() => selectTab('favorites')} onKeyDown={handleTabKeyDown} icon={<I.heart size={18} />} label="Favoriler" />
          <TabButton tab="profile" active={tab === 'profile'} buttonRef={(node) => { tabRefs.current.profile = node }} onClick={() => selectTab('profile')} onKeyDown={handleTabKeyDown} icon={<I.user size={18} />} label="Profil" />
        </div>
      )}

      {actionMessage && <div className="ac-action-error" role="alert"><I.warn size={15} />{actionMessage}<button type="button" onClick={() => setActionMessage(null)} aria-label="Mesajı kapat"><I.close size={14} /></button></div>}
      {accountStatus === 'refreshing' && <div className="ac-refresh" role="status"><I.refresh className="ac-spin" size={15} /> Hesabın güncelleniyor…</div>}
      {accountError && account && <div className="ac-refresh" data-error role="status">Güncellenemedi{refreshedLabel ? ` · son güncelleme ${refreshedLabel}` : ''}<button type="button" onClick={() => void loadAccount()}>Tekrar dene</button></div>}
      <main className="ac-content">
        {selectedOrder ? <OrderDetail order={selectedOrder} preview={reorderPreview} loading={reorderLoading} error={reorderError} currentRestaurantSlug={currentRestaurantSlug} reorderHeadingRef={reorderHeadingRef} onPreview={() => void previewReorder(selectedOrder.id)} onApply={() => reorderPreview && void applyReorder(reorderPreview)} /> : detailLoading ? <DetailSkeleton /> : detailError ? <ErrorState label="Sipariş detayı açılamadı." onRetry={() => { setDetailError(false); selectTab('orders') }} /> : null}
        {!selectedOrder && !detailLoading && !detailError && tab === 'overview' && (
          <section className="ac-panel" role="tabpanel" id="account-panel-overview" aria-labelledby="account-tab-overview" tabIndex={0}><Overview
            account={visibleAccount}
            loading={accountLoading}
            activeOrders={orders.active}
            onRetry={() => void loadAccount()}
            onOrders={() => selectTab('orders')}
            onOrder={(order) => void openOrder(order)}
            rewardCount={rewardCount}
            previewMode={previewMode}
            {...(onOpenRewards ? { onOpenRewards } : {})}
          /></section>
        )}
        {!selectedOrder && !detailLoading && !detailError && tab === 'orders' && (
          <section className="ac-panel" role="tabpanel" id="account-panel-orders" aria-labelledby="account-tab-orders" tabIndex={0}><OrdersPanel
            filter={ordersFilter}
            state={currentOrders}
            onFilter={selectOrderFilter}
            onOrder={(order) => void openOrder(order)}
            onRetry={() => void loadOrders(ordersFilter, null)}
            onMore={() => void loadOrders(ordersFilter, currentOrders.nextCursor)}
          /></section>
        )}
        {!selectedOrder && !detailLoading && !detailError && tab === 'favorites' && (
          <section className="ac-panel" role="tabpanel" id="account-panel-favorites" aria-labelledby="account-tab-favorites" tabIndex={0}><FavoritesPanel
            items={favorites}
            loading={favoritesLoading}
            error={favoritesError}
            currentRestaurantSlug={currentRestaurantSlug}
            currentRestaurantName={currentRestaurantName}
            onRetry={() => void loadFavorites()}
            onOpen={(favorite) => void openFavorite(favorite)}
          /></section>
        )}
        {!selectedOrder && !detailLoading && !detailError && tab === 'profile' && (
          <section className="ac-panel" role="tabpanel" id="account-panel-profile" aria-labelledby="account-tab-profile" tabIndex={0}><ProfilePanel
            account={visibleAccount}
            loading={accountLoading}
            editingName={editingName}
            nameDraft={nameDraft}
            saveState={saveState}
            logoutBusy={logoutBusy}
            consentBusy={consentBusy}
            privacyBusy={privacyBusy}
            privacyMessage={privacyMessage}
            hasLogout
            currentRestaurantSlug={currentRestaurantSlug}
            birthdayRestaurantId={previewMode ? null : currentRestaurantId ?? null}
            onNameDraft={setNameDraft}
            onEdit={() => { setEditingName(true); setSaveState('idle') }}
            onCancel={() => { setEditingName(false); setNameDraft(account?.profile.name ?? '') }}
            onSave={() => void saveName()}
            onRetry={() => void loadAccount()}
            onLogout={(scope) => void logout(scope)}
            confirmAllLogout={confirmAllLogout}
            onConfirmAllLogout={setConfirmAllLogout}
            onConsent={(restaurantId, consentType, grant) => void updateConsent(restaurantId, consentType, grant)}
            onExport={() => void exportPrivacyData()}
            onDelete={(confirmation) => void requestDeletion(confirmation)}
          /></section>
        )}
      </main>
    </div>
  )
}

function TabButton({ tab, active, buttonRef, onClick, onKeyDown, icon, label }: { tab: AccountTab; active: boolean; buttonRef: (node: HTMLButtonElement | null) => void; onClick: () => void; onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, tab: AccountTab) => void; icon: React.ReactNode; label: string }) {
  return <button ref={buttonRef} id={`account-tab-${tab}`} type="button" role="tab" aria-selected={active} aria-controls={`account-panel-${tab}`} tabIndex={active ? 0 : -1} className="ac-tab" data-active={active} onClick={onClick} onKeyDown={(event) => onKeyDown(event, tab)}>{icon}<span>{label}</span></button>
}

function Overview({ account, loading, activeOrders, onRetry, onOrders, onOrder, rewardCount, onOpenRewards, previewMode }: {
  account: CustomerAccountView | null
  loading: boolean
  activeOrders: OrdersState
  onRetry: () => void
  onOrders: () => void
  onOrder: (order: CustomerOrderSummaryView) => void
  rewardCount: number
  onOpenRewards?: () => void
  previewMode: string | null
}) {
  if (loading) return <GeometrySkeleton kind="overview" label="Hesabın hazırlanıyor…" />
  if (!account) return <ErrorState label="Hesap bilgileri şu anda alınamıyor." onRetry={onRetry} />
  return (
    <div className="ac-stack">
      <section className="ac-welcome-card">
        <span className="ac-avatar">{initials(account.profile.name)}</span>
        <div><small>Global <span style={{ textTransform: 'none' }}>masabu</span> profili</small><h2>{account.profile.name || 'masabu üyesi'}</h2><p>{account.profile.email?.value || account.profile.phone?.value || 'Doğrulanmış hesabın hazır'}</p></div>
        <span className="ac-verified"><I.shield size={15} /> Doğrulandı</span>
      </section>

      <SectionHeading title="Sadakat kartların" />
      <LoyaltyCards loyalty={account.loyalty} previewMode={previewMode} />
      {rewardCount > 0 && onOpenRewards && (
        <button type="button" className="ac-reward-shortcut" onClick={onOpenRewards}>
          <span><I.gift size={21} /></span><div><strong>Ödül kataloğu</strong><small>{rewardCount} ödül seni bekliyor</small></div><I.chevRight size={18} />
        </button>
      )}

      <SectionHeading title="Aktif siparişler" action={activeOrders.items.length ? 'Tümünü gör' : undefined} onAction={onOrders} />
      {activeOrders.loading && !activeOrders.loaded ? <CompactSkeleton /> : activeOrders.items.length > 0 ? (
        <div className="ac-order-strip">
          {activeOrders.items.slice(0, 2).map((order) => <OrderCard key={order.id} order={order} compact onClick={() => onOrder(order)} />)}
        </div>
      ) : <EmptyState icon={<I.receipt size={24} />} title="Aktif siparişin yok" copy="Yeni siparişlerin burada anlık görünür." />}

    </div>
  )
}

function LoyaltyCards({ loyalty, previewMode }: {
  loyalty: CustomerAccountView['loyalty']
  previewMode: string | null
}) {
  return loyalty.length > 0 ? (
    <div className="ac-loyalty-grid" data-account-loyalty>
      {loyalty.map((entry, index) => (
        <LoyaltyCard
          key={entry.restaurant.slug}
          loyalty={entry}
          preview={previewMode === 'loyalty' && index === 0}
        />
      ))}
    </div>
  ) : <EmptyState icon={<I.gift size={24} />} title="Sadakat kartın henüz yok" copy="Katıldığın restoranların kartları burada gruplanır." />
}

function LoyaltyCard({ loyalty, preview }: {
  loyalty: CustomerAccountView['loyalty'][number]
  preview: boolean
}) {
  const [expanded, setExpanded] = useState(preview)
  const [items, setItems] = useState(preview ? PREVIEW_LOYALTY_ACTIVITY : [])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(preview)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const activityControllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => activityControllerRef.current?.abort(), [])

  async function load(cursor: string | null) {
    if (preview || loading) return
    activityControllerRef.current?.abort()
    const controller = new AbortController()
    activityControllerRef.current = controller
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ restaurantId: loyalty.restaurant.id })
      if (cursor) params.set('cursor', cursor)
      const response = await fetch(`/api/account/loyalty-activity?${params}`, { cache: 'no-store', signal: controller.signal })
      const result = await response.json() as ApiResult<CustomerLoyaltyActivityPageView>
      if (!response.ok || !result.ok) throw new Error('loyalty_activity_failed')
      setItems((current) => cursor ? [...current, ...result.data.items] : result.data.items)
      setNextCursor(result.data.nextCursor)
      setLoaded(true)
    } catch (loadError) {
      if ((loadError as Error).name !== 'AbortError') setError(true)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
      if (activityControllerRef.current === controller) activityControllerRef.current = null
    }
  }

  function toggle() {
    const next = !expanded
    setExpanded(next)
    if (!next) {
      activityControllerRef.current?.abort()
      setLoading(false)
    }
    if (next && !loaded && !loading) void load(null)
  }

  return (
    <article className="ac-loyalty-card" data-expanded={expanded}>
      {loyalty.stampsEnabled && (
        <LoyaltyCardShell
          className="ac-stamp-card"
          background="var(--ml-surface)"
          foreground="var(--ml-text)"
          accent="color-mix(in srgb,var(--ml-accent) 34%,var(--ml-line))"
          style={{ padding: 18 }}
        >
          <div className="ac-stamp-card-head">
            <div className="ac-loyalty-top"><VenueMark name={loyalty.restaurant.name} logoUrl={loyalty.restaurant.logoUrl} /><div><strong>{loyalty.restaurant.name}</strong><span>{loyalty.tier.name} üye</span></div></div>
            <span className="ac-stamp-count">{Math.min(loyalty.stamps, loyalty.stampGoal)}<small>/{loyalty.stampGoal}</small></span>
          </div>
          <strong className="ac-stamp-reward">{loyalty.stampRewardText || `${loyalty.stampGoal} kahve al, 1 kahve bizden`}</strong>
          {loyalty.stampGoal <= 10 ? <LoyaltyStampGrid
              earnedStamps={loyalty.stamps}
              stampGoal={loyalty.stampGoal}
              rewardUnlocked={loyalty.stampUnlocked}
              foreground="var(--ml-text2)"
              filledBackground="var(--ml-accent-soft)"
              filledForeground="var(--ml-accent)"
              rewardColor="var(--ml-gold)"
            /> : <div className="ac-stamp-progress" role="progressbar" aria-label={`${loyalty.restaurant.name} damga ilerlemesi`} aria-valuemin={0} aria-valuemax={loyalty.stampGoal} aria-valuenow={Math.min(loyalty.stamps, loyalty.stampGoal)}><span style={{ width: `${Math.min(100, Math.max(0, loyalty.stamps / loyalty.stampGoal * 100))}%` }} /><small>{Math.min(loyalty.stamps, loyalty.stampGoal)} / {loyalty.stampGoal} damga</small></div>}
          <div className="ac-stamp-status" role="status">
            {loyalty.stampUnlocked
              ? <><I.gift size={16} /> Ödülün hazır</>
              : `${Math.max(loyalty.stampGoal - loyalty.stamps, 0)} damga daha, ödülün hazır`}
          </div>
        </LoyaltyCardShell>
      )}
      <div className="ac-loyalty-values">
        {loyalty.pointsEnabled && <div><small>Puan</small><b>{loyalty.points.toLocaleString('tr-TR')}</b></div>}
        {loyalty.stampsEnabled && <div><small>Kazanılan damga</small><b>{loyalty.stamps}<em>/{loyalty.stampGoal}</em></b></div>}
        {loyalty.pointsEnabled && <div><small>Yaşam boyu</small><b>{loyalty.lifetimePoints.toLocaleString('tr-TR')}</b></div>}
      </div>
      <div className="ac-progress" role="progressbar" aria-label="Üyelik seviyesi ilerlemesi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, loyalty.tierProgress))}><span style={{ width: `${loyalty.tierProgress}%`, background: loyalty.tier.color }} /></div>
      <small className="ac-next-tier">{loyalty.nextTier ? `${loyalty.nextTier.name} seviyesine ilerliyorsun` : 'En üst seviyedesin'}</small>
      <button type="button" className="ac-loyalty-toggle" aria-expanded={expanded} onClick={toggle}>
        <I.history size={17} /> Hareketler {expanded ? 'gizle' : 'göster'}
      </button>
      {expanded && (
        <div className="ac-loyalty-activity" aria-label={`${loyalty.restaurant.name} sadakat hareketleri`}>
          {loading && !loaded ? <span className="ac-activity-message">Hareketler yükleniyor…</span> : error ? (
            <button type="button" className="ac-activity-message" onClick={() => void load(null)}>Hareketler alınamadı · Tekrar dene</button>
          ) : items.length === 0 ? <span className="ac-activity-message">Henüz hareket yok.</span> : items.map((item) => (
            <div className="ac-activity-row" key={item.id} data-direction={item.direction}>
              <span>{activityIcon(item.direction)}</span>
              <div><strong>{activityLabel(item.direction)}</strong><small>{formatDate(item.createdAt)} · {item.type === 'points' ? 'Puan' : item.type === 'stamp' ? 'Damga' : 'Ziyaret'}</small></div>
              <b>{item.delta > 0 ? '+' : ''}{item.delta.toLocaleString('tr-TR')}</b>
            </div>
          ))}
          {nextCursor && <button type="button" className="ac-activity-more" onClick={() => void load(nextCursor)} disabled={loading}>{loading ? 'Yükleniyor…' : 'Daha eski hareketler'}</button>}
        </div>
      )}
    </article>
  )
}

function activityLabel(direction: CustomerLoyaltyActivityPageView['items'][number]['direction']): string {
  if (direction === 'reversal') return 'İade puan düzeltmesi'
  if (direction === 'refund') return 'Harcanan değer iadesi'
  if (direction === 'redeem') return 'Ödülde kullanıldı'
  return 'Sadakat kazanımı'
}

function activityIcon(direction: CustomerLoyaltyActivityPageView['items'][number]['direction']) {
  return direction === 'reversal' ? <I.refresh size={16} /> : direction === 'refund' ? <I.arrow size={16} /> : direction === 'redeem' ? <I.gift size={16} /> : <I.check size={16} />
}

function OrdersPanel({ filter, state, onFilter, onOrder, onRetry, onMore }: {
  filter: CustomerOrderFilter
  state: OrdersState
  onFilter: (filter: CustomerOrderFilter) => void
  onOrder: (order: CustomerOrderSummaryView) => void
  onRetry: () => void
  onMore: () => void
}) {
  const groups = useMemo(() => groupOrders(state.items), [state.items])
  return (
    <div className="ac-stack">
      <div className="ac-segmented" role="group" aria-label="Sipariş durumu">
        <button type="button" data-active={filter === 'active'} onClick={() => onFilter('active')}>Aktif</button>
        <button type="button" data-active={filter === 'past'} onClick={() => onFilter('past')}>Geçmiş</button>
      </div>
      {state.loading && !state.loaded ? <GeometrySkeleton kind="list" label="Siparişlerin yükleniyor…" /> : state.error && groups.length === 0 ? <ErrorState label="Siparişler alınamadı." onRetry={onRetry} /> : groups.length === 0 ? (
        <EmptyState icon={<I.history size={25} />} title={filter === 'active' ? 'Aktif siparişin yok' : 'Geçmiş siparişin yok'} copy={filter === 'active' ? 'Restoranda verdiğin açık siparişler burada görünür.' : 'Tamamlanan siparişlerin restoran bazında gruplanır.'} />
      ) : (
        groups.map((group) => (
          <section className="ac-order-group" key={group.slug}>
            <div className="ac-group-title"><VenueMark name={group.name} /><div><h2>{group.name}</h2><span>{group.orders.length} sipariş</span></div></div>
            <div className="ac-order-list">{group.orders.map((order) => <OrderCard key={order.id} order={order} onClick={() => onOrder(order)} />)}</div>
          </section>
        ))
      )}
      {state.nextCursor && <button type="button" className="ac-more" onClick={onMore} disabled={state.loading}>{state.loading ? 'Yükleniyor…' : 'Daha fazla göster'}</button>}
    </div>
  )
}

function OrderCard({ order, compact = false, onClick }: { order: CustomerOrderSummaryView; compact?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="ac-order-card" data-compact={compact} onClick={onClick} aria-label={`${order.restaurant.name}, ${order.status.label}, sipariş detayını aç`}>
      <div className="ac-order-main"><span className="ac-status" data-tone={order.status.tone}>{order.status.label}</span><strong>{order.restaurant.name}</strong><p>{order.itemNames.join(', ')}{order.itemCount > order.itemNames.length ? ` +${order.itemCount - order.itemNames.length}` : ''}</p></div>
      <div className="ac-order-side"><b>{formatTRY(order.total)}</b><time dateTime={order.placedAt}>{formatDate(order.placedAt)}</time><I.chevRight size={17} /></div>
    </button>
  )
}

function FavoritesPanel({ items, loading, error, currentRestaurantSlug, currentRestaurantName, onRetry, onOpen }: {
  items: CustomerFavoriteView[]
  loading: boolean
  error: boolean
  currentRestaurantSlug?: string
  currentRestaurantName?: string
  onRetry: () => void
  onOpen: (favorite: CustomerFavoriteView) => void
}) {
  const visibleItems = useMemo(
    () => currentRestaurantSlug ? items.filter((favorite) => favorite.restaurant.slug === currentRestaurantSlug) : items,
    [currentRestaurantSlug, items],
  )
  const groups = useMemo(() => groupFavorites(visibleItems), [visibleItems])
  if (loading) return <GeometrySkeleton kind="list" label="Favorilerin yükleniyor…" />
  if (error && visibleItems.length === 0) return <ErrorState label="Favoriler alınamadı." onRetry={onRetry} />
  if (groups.length === 0) return <EmptyState icon={<I.heart size={25} />} title="Bu işletmede henüz favorin yok" copy="Menü kartlarındaki kalp ikonuyla bu işletmedeki sevdiğin ürünleri kaydet." />
  return (
    <div className="ac-stack">
      <section className="ac-favorite-hero">
        <span><I.heart size={22} fill="currentColor" /></span>
        <div><h2>Favori lezzetlerin</h2><p>{currentRestaurantName ?? groups[0]?.name ?? 'Bu işletme'}: {visibleItems.length} favori ürün</p></div>
      </section>
      {groups.map((group) => (
        <section className="ac-order-group" key={group.slug}>
          <div className="ac-group-title"><VenueMark name={group.name} /><div><h2>{group.name}</h2><span>{group.items.length} favori</span></div></div>
          <div className="ac-favorite-grid">
            {group.items.map((favorite) => (
              <button type="button" className="ac-favorite-card" key={favorite.item.id} onClick={() => onOpen(favorite)} aria-label={`${favorite.item.name} ürününü aç`}>
                <span className="ac-favorite-image">{favorite.item.imageUrl ? <span className="ac-favorite-image-visual" style={{ backgroundImage: `url(${JSON.stringify(favorite.item.imageUrl)})` }} /> : <I.heart size={20} />}</span>
                <span className="ac-favorite-copy"><strong>{favorite.item.name}</strong><small>{favorite.item.description || 'Favori ürünün'}</small><b>{formatTRY(favorite.item.price)}</b></span>
                <I.chevRight size={17} />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function OrderDetail({ order, preview, loading, error, currentRestaurantSlug, reorderHeadingRef, onPreview, onApply }: {
  order: CustomerOrderDetailView
  preview: CustomerReorderPreviewView | null
  loading: boolean
  error: boolean
  currentRestaurantSlug?: string
  reorderHeadingRef: React.RefObject<HTMLHeadingElement | null>
  onPreview: () => void
  onApply: () => void
}) {
  return (
    <div className="ac-stack">
      <section className="ac-detail-hero">
        <VenueMark name={order.restaurant.name} />
        <div><span className="ac-status" data-tone={order.status.tone}>{order.status.label}</span><h2>{order.restaurant.name}</h2><time dateTime={order.placedAt}>{formatLongDate(order.placedAt)}</time></div>
        <strong>{formatTRY(order.total)}</strong>
      </section>
      <section className="ac-detail-card">
        <h3>Sipariş içeriği</h3>
        {order.items.map((line, index) => (
          <div className="ac-line" key={`${line.name}-${index}`}>
            <span>{line.quantity}</span>
            <div><strong>{line.name}</strong>{line.campaignGift && <small>Kampanya hediyesi · ₺0</small>}{line.modifiers.length > 0 && <small>{line.modifiers.join(', ')}</small>}{line.removedIngredients.length > 0 && <small>Çıkarılan: {line.removedIngredients.join(', ')}</small>}{line.note && <em>“{line.note}”</em>}</div>
            <b>{formatTRY(line.unitPrice * line.quantity)}</b>
          </div>
        ))}
        {order.savings > 0 && <div className="ac-saving"><span>Toplam kazanç</span><strong>-{formatTRY(order.savings)}</strong></div>}
        <div className="ac-total"><span>Toplam</span><strong>{formatTRY(order.total)}</strong></div>
      </section>
      <section className="ac-detail-card ac-detail-meta">
        <div><I.clock size={18} /><span><small>Sipariş zamanı</small><strong>{formatLongDate(order.placedAt)}</strong></span></div>
        {order.payment && <div><I.card size={18} /><span><small>Ödeme</small><strong>{order.payment.label} · {formatDate(order.payment.paidAt)}</strong></span></div>}
        {order.cancellationReason && <div><I.warn size={18} /><span><small>İptal nedeni</small><strong>{order.cancellationReason}</strong></span></div>}
      </section>
      {!preview && (
        <button type="button" className="ac-reorder-button" onClick={onPreview} disabled={loading}>
          {loading ? <I.refresh className="ac-spin" size={19} /> : <I.refresh size={19} />}
          <span><strong>{loading ? 'Menü doğrulanıyor…' : 'Yeniden sipariş önizlemesi'}</strong><small>Güncel fiyat ve seçenekleri karşılaştır</small></span>
          {!loading && <I.chevRight size={18} />}
        </button>
      )}
      {error && <div className="ac-inline-error" role="alert"><I.warn size={17} /> Önizleme hazırlanamadı.<button type="button" onClick={onPreview}>Tekrar dene</button></div>}
      {preview && <ReorderPreview preview={preview} sameRestaurant={preview.restaurant.slug === currentRestaurantSlug} headingRef={reorderHeadingRef} onApply={onApply} />}
    </div>
  )
}

function ReorderPreview({ preview, sameRestaurant, headingRef, onApply }: { preview: CustomerReorderPreviewView; sameRestaurant: boolean; headingRef: React.RefObject<HTMLHeadingElement | null>; onApply: () => void }) {
  const available = preview.lines.filter((line) => line.cartLine).length
  const unavailable = preview.lines.length - available
  return (
    <section className="ac-reorder-preview" aria-label="Yeniden sipariş farkları">
      <div className="ac-reorder-title"><span><I.shield size={20} /></span><div><h3 ref={headingRef} tabIndex={-1}>Güvenli önizleme</h3><p>Sipariş verilmedi; güncel menü doğrulandı.</p></div></div>
      <div className="ac-reorder-summary"><span><small>Eski toplam</small><b>{formatTRY(preview.originalTotal)}</b></span><I.arrow size={18} /><span><small>Güncel ara toplam</small><b>{formatTRY(preview.currentSubtotal)}</b></span></div>
      <div className="ac-reorder-lines">
        {preview.lines.map((line, index) => (
          <article key={`${line.originalName}-${index}`} data-state={line.state}>
            <span className="ac-reorder-state">{line.state === 'unavailable' ? <I.warn size={16} /> : line.state === 'changed' ? <I.refresh size={16} /> : <I.check size={16} />}</span>
            <div><strong>{line.currentName || line.originalName} × {line.quantity}</strong>{line.differences.length === 0 ? <small>Değişiklik yok</small> : line.differences.map((difference) => <small key={difference.kind}>{difference.label}</small>)}</div>
            <b>{line.currentUnitPrice === null ? 'Yok' : formatTRY(line.currentUnitPrice * line.quantity)}</b>
          </article>
        ))}
      </div>
      {unavailable > 0 && <p className="ac-reorder-note"><I.warn size={16} /> {unavailable} ürün sepete eklenmeyecek.</p>}
      <button type="button" className="ac-reorder-apply" disabled={!preview.canApply} onClick={onApply}>
        <I.cart size={19} /> {sameRestaurant ? `${available} ürünü sepete ekle` : `${preview.restaurant.name} menüsünde devam et`}
      </button>
    </section>
  )
}

function ProfilePanel({ account, loading, editingName, nameDraft, saveState, logoutBusy, consentBusy, privacyBusy, privacyMessage, hasLogout, currentRestaurantSlug, birthdayRestaurantId = null, confirmAllLogout, onConfirmAllLogout, onNameDraft, onEdit, onCancel, onSave, onRetry, onLogout, onConsent, onExport, onDelete }: {
  account: CustomerAccountView | null
  loading: boolean
  editingName: boolean
  nameDraft: string
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  logoutBusy: 'device' | 'all' | null
  consentBusy: string | null
  privacyBusy: 'export' | 'delete' | null
  privacyMessage: string | null
  hasLogout: boolean
  currentRestaurantSlug: string | undefined
  birthdayRestaurantId?: string | null
  confirmAllLogout: boolean
  onConfirmAllLogout: (value: boolean) => void
  onNameDraft: (value: string) => void
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onRetry: () => void
  onLogout: (scope: 'device' | 'all') => void
  onConsent: (restaurantId: string, consentType: 'contact_data' | 'marketing', grant: boolean) => void
  onExport: () => void
  onDelete: (confirmation: string) => void
}) {
  if (loading) return <GeometrySkeleton kind="profile" label="Profilin yükleniyor…" />
  if (!account) return <ErrorState label="Profil bilgileri alınamadı." onRetry={onRetry} />
  return (
    <div className="ac-stack">
      <section className="ac-profile-hero"><span className="ac-avatar ac-avatar-large">{initials(account.profile.name)}</span><h2>{account.profile.name || 'masabu üyesi'}</h2><p>{new Date(account.profile.memberSince).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} tarihinden beri üye</p></section>
      <section className="ac-profile-card">
        <div className="ac-profile-title"><h3>Profil bilgileri</h3>{!editingName && <button type="button" onClick={onEdit}>Düzenle</button>}</div>
        {editingName ? <div className="ac-name-editor"><label>Ad soyad<input value={nameDraft} onChange={(event) => onNameDraft(event.target.value)} maxLength={80} autoFocus /></label><div><button type="button" onClick={onCancel}>Vazgeç</button><button type="button" className="ac-primary-small" disabled={nameDraft.trim().length < 2 || saveState === 'saving'} onClick={onSave}>{saveState === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}</button></div>{saveState === 'error' && <p role="alert">Adın kaydedilemedi. Tekrar dene.</p>}</div> : <ProfileRow icon={<I.user size={19} />} label="Ad soyad" value={account.profile.name || 'Belirtilmedi'} />}
        {account.profile.email && <ProfileRow icon={<I.mail size={19} />} label="E-posta" value={account.profile.email.value} verified />}
        {account.profile.phone && <ProfileRow icon={<I.phoneCall size={19} />} label="Telefon" value={account.profile.phone.value} verified />}
        {!account.profile.phone && <ProfileRow icon={<I.phoneCall size={19} />} label="Telefon" value="Doğrulanmış telefon eklenmedi" muted />}
      </section>
      {saveState === 'saved' && <div className="ac-success" role="status"><I.check size={18} /> Profilin güncellendi.</div>}
      {birthdayRestaurantId && <BirthdayCard restaurantId={birthdayRestaurantId} />}
      <PrivacyPanel
        account={account}
        currentRestaurantSlug={currentRestaurantSlug}
        consentBusy={consentBusy}
        privacyBusy={privacyBusy}
        message={privacyMessage}
        onConsent={onConsent}
        onExport={onExport}
        onDelete={onDelete}
      />
      {hasLogout && <section className="ac-session-card"><h3>Oturumlar</h3><p>Çıkış yaptığında sepetin bu cihazda korunur.</p><button type="button" onClick={() => onLogout('device')} disabled={logoutBusy !== null}><I.logout size={18} />{logoutBusy === 'device' ? 'Çıkılıyor…' : 'Bu cihazdan çık'}</button>{confirmAllLogout ? <div className="ac-session-confirm" role="group" aria-label="Tüm cihazlardan çıkış onayı"><p>Tüm telefon, tablet ve tarayıcılardaki masabu oturumların kapatılacak.</p><div><button type="button" onClick={() => onConfirmAllLogout(false)} disabled={logoutBusy !== null}>Vazgeç</button><button type="button" className="ac-danger-link" onClick={() => onLogout('all')} disabled={logoutBusy !== null}>{logoutBusy === 'all' ? 'Çıkılıyor…' : 'Tümünden çık'}</button></div></div> : <button type="button" className="ac-danger-link" onClick={() => onConfirmAllLogout(true)} disabled={logoutBusy !== null}>Tüm cihazlardan çık</button>}</section>}
    </div>
  )
}

function PrivacyPanel({ account, currentRestaurantSlug, consentBusy, privacyBusy, message, onConsent, onExport, onDelete }: {
  account: CustomerAccountView
  currentRestaurantSlug: string | undefined
  consentBusy: string | null
  privacyBusy: 'export' | 'delete' | null
  message: string | null
  onConsent: (restaurantId: string, consentType: 'contact_data' | 'marketing', grant: boolean) => void
  onExport: () => void
  onDelete: (confirmation: string) => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const consent = account.consents.find((item) => item.restaurant.slug === currentRestaurantSlug) ?? null
  const deletion = account.privacy.deletionRequest
  return (
    <section className="ac-privacy-card">
      <div className="ac-privacy-heading"><span><I.shield size={20} /></span><div><h3>Gizlilik ve izinler</h3><p>İzinlerin restoran bazında, veri hakların global yönetilir.</p></div></div>
      {consent ? (
        <div className="ac-consent-group">
          <strong>{consent.restaurant.name}</strong>
          <label className="ac-consent-row">
            <input
              type="checkbox"
              checked={consent.contactData}
              disabled={consentBusy !== null}
              onChange={(event) => onConsent(consent.restaurant.id, 'contact_data', event.target.checked)}
            />
            <span><b>İletişim verisi izni</b><small>Restoranın doğrulanmış iletişim bilgini işlemesine izin verir.</small></span>
          </label>
          <label className="ac-consent-row">
            <input
              type="checkbox"
              checked={consent.marketing}
              disabled={consentBusy !== null}
              onChange={(event) => onConsent(consent.restaurant.id, 'marketing', event.target.checked)}
            />
            <span><b>Pazarlama iletileri</b><small>Opsiyoneldir, varsayılan olarak kapalıdır ve üstteki izinden ayrıdır.</small></span>
          </label>
        </div>
      ) : <p className="ac-privacy-copy">Bu restoran için yönetilebilir izin bulunmuyor.</p>}
      <div className="ac-data-actions">
        <button type="button" onClick={onExport} disabled={privacyBusy !== null}><I.download size={18} />{privacyBusy === 'export' ? 'Hazırlanıyor…' : 'Verilerimi dışa aktar'}</button>
        {deletion ? (
          <div className="ac-delete-status" role="status"><I.clock size={18} /><span><b>Silme talebi incelemede</b><small>{formatLongDate(deletion.requestedAt)} · Finansal kayıtlar korunur.</small></span></div>
        ) : !deleteOpen ? (
          <button type="button" className="ac-delete-button" onClick={() => setDeleteOpen(true)}><I.warn size={18} />Hesap silme talebi</button>
        ) : (
          <div className="ac-delete-confirm">
            <p>Hesabın hemen silinmez. Yeniden doğrulama ve hukuki inceleme sonrası PII, favori ve tercihlerin anonimleştirilir; mali sipariş kayıtları korunur.</p>
            <label>Onaylamak için <b>HESABIMI SİL</b> yaz
              <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
            </label>
            <div><button type="button" onClick={() => { setDeleteOpen(false); setConfirmation('') }}>Vazgeç</button><button type="button" className="ac-delete-submit" disabled={confirmation !== 'HESABIMI SİL' || privacyBusy !== null} onClick={() => onDelete(confirmation)}>{privacyBusy === 'delete' ? 'Gönderiliyor…' : 'Talebi gönder'}</button></div>
          </div>
        )}
      </div>
      {message && <div className="ac-privacy-message" role="status">{message}</div>}
    </section>
  )
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

/** Day and month for this restaurant only; the business uses it for a birthday reward. */
function BirthdayCard({ restaurantId }: { restaurantId: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'hidden'>('loading')
  const [saved, setSaved] = useState<{ month: number; day: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetch(`/api/account/birthday?restaurantId=${encodeURIComponent(restaurantId)}`)
      .then((response) => response.json() as Promise<ApiResult<{ linked: boolean; birthday: { month: number; day: number } | null }>>)
      .then((result) => {
        if (!live) return
        // Without a link to this restaurant (or on a plan without accounts) there is nothing to save.
        if (!result.ok || !result.data.linked) { setState('hidden'); return }
        setSaved(result.data.birthday)
        setState('ready')
      })
      .catch(() => { if (live) setState('hidden') })
    return () => { live = false }
  }, [restaurantId])

  if (state !== 'ready') return null
  const valid = day !== '' && month !== '' && Number(day) <= new Date(Date.UTC(2024, Number(month), 0)).getUTCDate()

  async function save(next: { month: number; day: number } | null) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/account/birthday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, month: next?.month ?? null, day: next?.day ?? null }),
      })
      const result = await response.json() as ApiResult<unknown>
      if (!response.ok || !result.ok) throw new Error('birthday_save_failed')
      setSaved(next)
      setEditing(false)
    } catch {
      setError('Doğum günün kaydedilemedi. Tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  function startEdit() {
    setDay(saved ? String(saved.day) : '')
    setMonth(saved ? String(saved.month) : '')
    setError(null)
    setEditing(true)
  }

  return (
    <section className="ac-profile-card">
      <div className="ac-profile-title"><h3>Doğum günü</h3>{!editing && <button type="button" onClick={startEdit}>{saved ? 'Değiştir' : 'Ekle'}</button>}</div>
      {editing ? (
        <div className="ac-name-editor">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8, marginTop: 0 }}>
            <label>Gün<select value={day} onChange={(event) => setDay(event.target.value)}><option value="">Seç</option>{Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
            <label>Ay<select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Seç</option>{MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}</select></label>
          </div>
          <div>
            {saved && <button type="button" onClick={() => void save(null)} disabled={busy}>Kaldır</button>}
            <button type="button" onClick={() => setEditing(false)} disabled={busy}>Vazgeç</button>
            <button type="button" className="ac-primary-small" disabled={!valid || busy} onClick={() => void save({ month: Number(month), day: Number(day) })}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
          </div>
          {day !== '' && month !== '' && !valid && <p role="alert">Bu ayda o gün yok.</p>}
          {error && <p role="alert">{error}</p>}
        </div>
      ) : (
        <ProfileRow icon={<I.gift size={19} />} label="Yalnızca gün ve ay · bu restoranla paylaşılır" value={saved ? `${saved.day} ${MONTHS[saved.month - 1]}` : 'Eklenmedi; doğum gününde sürpriz puan kaçırma'} muted={!saved} />
      )}
    </section>
  )
}

function ProfileRow({ icon, label, value, verified = false, muted = false }: { icon: React.ReactNode; label: string; value: string; verified?: boolean; muted?: boolean }) {
  return <div className="ac-profile-row" data-muted={muted}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div>{verified && <em><I.shield size={14} /> Doğrulandı</em>}</div>
}

function SectionHeading({ title, action, onAction }: { title: string; action?: string | undefined; onAction?: () => void }) {
  return <div className="ac-section-heading"><h2>{title}</h2>{action && onAction && <button type="button" onClick={onAction}>{action}<I.chevRight size={15} /></button>}</div>
}

function VenueMark({ name, logoUrl, inverse = false }: { name: string; logoUrl?: string | null; inverse?: boolean }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [logoUrl])
  const showImage = Boolean(logoUrl && !broken)
  return <span
    className="ac-venue-mark"
    data-logo={showImage ? 'image' : 'initial'}
    data-inverse={inverse ? 'true' : undefined}
    aria-hidden="true"
  >{showImage ? <Image src={logoUrl!} alt="" width={56} height={56} unoptimized onError={() => setBroken(true)} /> : name.trim().slice(0, 1).toLocaleUpperCase('tr-TR') || 'M'}</span>
}

function GeometrySkeleton({ kind, label }: { kind: 'overview' | 'profile' | 'list'; label: string }) {
  const blocks = kind === 'overview' ? [76, 250, 88] : kind === 'profile' ? [118, 230, 190] : [88, 88, 88]
  return <div className="ac-geometry-skeleton" role="status" aria-label={label}>{blocks.map((height, index) => <span key={index} style={{ height }} />)}</div>
}

function CompactSkeleton() {
  return <div className="ac-skeleton" aria-label="Siparişler yükleniyor"><span /><span /></div>
}

function DetailSkeleton() {
  return <div className="ac-detail-skeleton" role="status" aria-label="Sipariş detayı yükleniyor"><span /><span /><span /></div>
}

function ErrorState({ label, onRetry }: { label: string; onRetry: () => void }) {
  return <div className="ac-empty" role="alert"><span><I.warn size={25} /></span><h2>{label}</h2><button type="button" onClick={onRetry}>Tekrar dene</button></div>
}

function EmptyState({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return <div className="ac-empty"><span>{icon}</span><h2>{title}</h2><p>{copy}</p></div>
}

function initials(name: string | null): string {
  const parts = (name ?? 'M').trim().split(/\s+/).filter(Boolean)
  return `${parts[0]?.[0] ?? 'M'}${parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''}`.toLocaleUpperCase('tr-TR')
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function formatLongDate(value: string): string {
  return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function groupOrders(items: CustomerOrderSummaryView[]) {
  const groups = new Map<string, { slug: string; name: string; orders: CustomerOrderSummaryView[] }>()
  for (const order of items) {
    const group = groups.get(order.restaurant.slug) ?? { slug: order.restaurant.slug, name: order.restaurant.name, orders: [] }
    group.orders.push(order)
    groups.set(order.restaurant.slug, group)
  }
  return [...groups.values()]
}

function groupFavorites(items: CustomerFavoriteView[]) {
  const groups = new Map<string, { slug: string; name: string; items: CustomerFavoriteView[] }>()
  for (const favorite of items) {
    const group = groups.get(favorite.restaurant.slug) ?? { slug: favorite.restaurant.slug, name: favorite.restaurant.name, items: [] }
    group.items.push(favorite)
    groups.set(favorite.restaurant.slug, group)
  }
  return [...groups.values()]
}

const ACCOUNT_CENTER_CSS = `
.ac-root{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--ml-bg);color:var(--ml-text);font-family:var(--p-body)}
.ac-header{min-height:68px;padding:10px 16px;display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;gap:10px;border-bottom:1px solid var(--ml-line);background:var(--ml-surface);flex:0 0 auto}
.ac-brand-mark,.ac-avatar,.ac-venue-mark{display:grid;place-items:center;flex:0 0 auto;background:linear-gradient(135deg,var(--ml-accent),var(--ml-accent2));color:#fff;font-weight:850}.ac-venue-mark{overflow:hidden}.ac-venue-mark img{display:block;width:100%;height:100%;object-fit:contain;background:var(--ml-surface)}.ac-venue-mark[data-logo=image]{background-color:var(--ml-surface)}.ac-venue-mark[data-inverse=true]{background-color:var(--ml-surface);color:var(--ml-accent);border:1px solid var(--ml-line)}
.ac-brand-mark{width:44px;height:44px;border-radius:14px;overflow:hidden;background:#fff;border:1px solid color-mix(in srgb,#0b0b0d 12%,transparent)}.ac-brand-mark img{display:block;width:100%;height:100%;object-fit:cover}
.ac-heading{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.ac-heading span{font-size:11.5px;color:var(--ml-text2);font-weight:650}.ac-heading strong{font:800 19px/1.2 var(--p-display);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ac-icon-button{width:44px;height:44px;border-radius:50%;border:1px solid var(--ml-line);background:var(--ml-surface);color:var(--ml-text);display:grid;place-items:center;cursor:pointer;flex:0 0 auto}
.ac-tabs{height:62px;padding:6px 10px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;border-bottom:1px solid var(--ml-line);background:var(--ml-surface);flex:0 0 auto}.ac-tab{min-width:0;min-height:48px;border:0;border-radius:13px;background:transparent;color:var(--ml-text2);display:flex;align-items:center;justify-content:center;gap:5px;font:700 11.5px var(--p-body);cursor:pointer}.ac-tab[data-active=true]{background:color-mix(in srgb,var(--ml-accent-soft) 72%,var(--ml-surface));color:var(--ml-text)}
.ac-action-error,.ac-refresh{min-height:38px;padding:7px 16px;display:flex;align-items:center;justify-content:center;gap:7px;border-bottom:1px solid var(--ml-line);font-size:11.5px;font-weight:700;flex:0 0 auto}.ac-action-error{background:color-mix(in srgb,#b14337 9%,var(--ml-surface));color:#8b3028}.ac-action-error button{width:44px;height:44px;margin:-7px -12px -7px auto;border:0;background:transparent;color:inherit;display:grid;place-items:center}.ac-refresh{background:var(--ml-accent-soft);color:var(--ml-accent2)}.ac-refresh[data-error]{background:color-mix(in srgb,#b14337 9%,var(--ml-surface));color:#8b3028}.ac-refresh button{min-height:44px;margin:-6px 0 -6px 4px;border:0;background:transparent;color:inherit;font:800 11.5px var(--p-body);cursor:pointer}
.ac-content{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:18px 16px calc(24px + env(safe-area-inset-bottom))}.ac-panel{max-width:680px;margin:0 auto;outline:none}.ac-stack{display:flex;flex-direction:column;gap:15px;max-width:680px;margin:0 auto}
.ac-welcome-card{position:relative;display:flex;align-items:center;gap:13px;padding:17px;border-radius:20px;color:var(--ml-text);background:var(--ml-surface);border:1px solid var(--ml-line);box-shadow:0 16px 35px -32px rgba(0,0,0,.55)}.ac-avatar{width:52px;height:52px;border-radius:17px;background:var(--ml-accent-soft);border:1px solid color-mix(in srgb,var(--ml-accent) 22%,var(--ml-line));color:var(--ml-text);font-size:16px}.ac-welcome-card>div{min-width:0}.ac-welcome-card small{font-size:10.5px;color:var(--ml-text2)}.ac-welcome-card h2{font:800 20px/1.2 var(--p-display);margin:3px 0}.ac-welcome-card p{font-size:12px;color:var(--ml-text2);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ac-verified{position:absolute;right:13px;top:13px;display:flex;align-items:center;gap:4px;font-size:10px;font-weight:750;background:var(--ml-accent-soft);color:var(--ml-text);padding:5px 8px;border-radius:99px}
.ac-section-heading{display:flex;align-items:center;justify-content:space-between;margin-top:3px}.ac-section-heading h2{font:800 17px/1.2 var(--p-display);margin:0}.ac-section-heading button{min-height:44px;border:0;background:transparent;color:var(--ml-accent);display:flex;align-items:center;gap:2px;font:750 12px var(--p-body);cursor:pointer}
.ac-order-strip,.ac-order-list{display:flex;flex-direction:column;gap:9px}.ac-order-card{width:100%;min-height:88px;padding:13px;border:1px solid var(--ml-line);border-radius:17px;background:var(--ml-surface);color:var(--ml-text);display:flex;align-items:center;gap:12px;text-align:left;cursor:pointer;font-family:var(--p-body);box-shadow:0 10px 25px -26px rgba(0,0,0,.5)}.ac-order-main{flex:1;min-width:0}.ac-order-main>strong{display:block;font-size:14px;margin:5px 0 3px}.ac-order-main p{font-size:11.5px;color:var(--ml-text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0}.ac-status{display:inline-flex;padding:4px 8px;border-radius:99px;font-size:9.5px;font-weight:800;background:#eceef1;color:#616772}.ac-status[data-tone=progress]{background:#e7f0ff;color:#2464a7}.ac-status[data-tone=ready]{background:#fff1ce;color:#936413}.ac-status[data-tone=success]{background:#e6f4ec;color:#277348}.ac-status[data-tone=danger]{background:#fee9e7;color:#a7372d}.ac-order-side{display:grid;grid-template-columns:auto 17px;align-items:center;gap:5px;text-align:right}.ac-order-side b{grid-column:1/3;font-size:14px}.ac-order-side time{font-size:10.5px;color:var(--ml-text2)}
.ac-loyalty-grid{display:grid;grid-template-columns:1fr;gap:10px}.ac-loyalty-card{padding:10px;border-radius:20px;background:var(--ml-surface);border:1px solid var(--ml-line)}.ac-loyalty-card[data-expanded=true]{border-color:color-mix(in srgb,var(--ml-accent) 28%,var(--ml-line))}.ac-stamp-card{min-height:0}.ac-stamp-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.ac-stamp-card .ac-loyalty-top{color:var(--ml-text)}.ac-stamp-card .ac-loyalty-top span{color:var(--ml-text2)}.ac-stamp-count{display:inline-flex;align-items:baseline;min-height:34px;padding:6px 9px;border-radius:11px;background:var(--ml-accent-soft);color:var(--ml-accent2);font:800 19px/1 var(--p-body);font-variant-numeric:tabular-nums}.ac-stamp-count small{font-size:10.5px;color:var(--ml-text2)}.ac-stamp-reward{display:block;margin:14px 0 13px;font:800 17px/1.15 var(--p-display);letter-spacing:-.01em}.ac-stamp-status{min-height:34px;margin-top:11px;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:9px;background:var(--ml-accent-soft);font-size:10.5px;font-weight:750;color:var(--ml-accent2)}.ac-stamp-progress{display:grid;gap:8px}.ac-stamp-progress:before{content:'';grid-area:1/1;height:9px;border-radius:99px;background:var(--ml-line)}.ac-stamp-progress>span{grid-area:1/1;height:9px;z-index:1;border-radius:99px;background:var(--ml-accent)}.ac-stamp-progress small{font-size:11px;color:var(--ml-text2)}.ac-loyalty-top{display:flex;align-items:center;gap:10px;min-width:0}.ac-venue-mark{width:42px;height:42px;border-radius:13px;font-size:15px}.ac-loyalty-top>div{display:flex;flex-direction:column;gap:2px;min-width:0}.ac-loyalty-top strong{font-size:14px;line-height:1.25;overflow-wrap:anywhere}.ac-loyalty-top span{font-size:10.5px;font-weight:750}.ac-loyalty-values{display:flex;flex-wrap:wrap;gap:16px 24px;margin:14px 5px 0}.ac-loyalty-values div{display:flex;flex-direction:column;gap:2px}.ac-loyalty-values small{font-size:10px;color:var(--ml-text2)}.ac-loyalty-values b{font-size:21px}.ac-loyalty-values em{font-size:12px;color:var(--ml-text2);font-style:normal}.ac-progress{height:6px;background:var(--ml-line);border-radius:99px;overflow:hidden;margin:13px 5px 0}.ac-progress span{display:block;height:100%;border-radius:inherit}.ac-next-tier{display:block;color:var(--ml-text2);font-size:10.5px;margin:6px 5px 0}.ac-loyalty-toggle{width:100%;min-height:44px;margin-top:8px;border:0;border-top:1px solid var(--ml-line);background:transparent;color:var(--ml-accent2);display:flex;align-items:center;justify-content:center;gap:7px;font:750 11.5px var(--p-body);cursor:pointer}.ac-loyalty-activity{display:flex;flex-direction:column;border-top:1px solid var(--ml-line)}.ac-activity-row{min-height:58px;display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px;border-bottom:1px solid var(--ml-line)}.ac-activity-row>span{width:32px;height:32px;border-radius:10px;background:#e6f4ec;color:#277348;display:grid;place-items:center}.ac-activity-row[data-direction=redeem]>span,.ac-activity-row[data-direction=reversal]>span{background:#fee9e7;color:#a7372d}.ac-activity-row[data-direction=refund]>span{background:#e7f0ff;color:#2464a7}.ac-activity-row>div{min-width:0;display:flex;flex-direction:column;gap:3px}.ac-activity-row strong{font-size:11.5px}.ac-activity-row small{font-size:9.5px;color:var(--ml-text2)}.ac-activity-row>b{font-size:12.5px}.ac-activity-row[data-direction=redeem]>b,.ac-activity-row[data-direction=reversal]>b{color:#a7372d}.ac-activity-row[data-direction=refund]>b{color:#2464a7}.ac-activity-message{min-height:48px;border:0;background:transparent;color:var(--ml-text2);display:grid;place-items:center;font:650 11px var(--p-body)}button.ac-activity-message{cursor:pointer;color:var(--ml-accent2)}.ac-activity-more{min-height:44px;margin-top:7px;border:0;border-radius:12px;background:var(--ml-accent-soft);color:var(--ml-accent2);font:750 11.5px var(--p-body);cursor:pointer}
.ac-reward-shortcut{width:100%;min-height:68px;padding:11px 13px;border-radius:17px;border:1px solid color-mix(in srgb,var(--ml-gold) 30%,var(--ml-line));background:var(--ml-gold-soft);color:var(--ml-text);display:flex;align-items:center;gap:11px;text-align:left;font-family:var(--p-body);cursor:pointer}.ac-reward-shortcut>span{width:42px;height:42px;border-radius:13px;background:#fff;color:var(--ml-gold);display:grid;place-items:center}.ac-reward-shortcut>div{flex:1;display:flex;flex-direction:column;gap:3px}.ac-reward-shortcut strong{font-size:13px}.ac-reward-shortcut small{font-size:10.5px;color:var(--ml-text2)}
.ac-favorite-hero{display:flex;align-items:center;gap:12px;padding:16px;border-radius:19px;background:linear-gradient(135deg,color-mix(in srgb,var(--ml-cta) 12%,var(--ml-surface)),var(--ml-surface));border:1px solid color-mix(in srgb,var(--ml-cta) 20%,var(--ml-line))}.ac-favorite-hero>span{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;background:color-mix(in srgb,var(--ml-cta) 14%,var(--ml-surface));color:var(--ml-cta)}.ac-favorite-hero h2{font:800 17px var(--p-display);margin:0 0 3px}.ac-favorite-hero p{font-size:11px;color:var(--ml-text2);margin:0}.ac-favorite-grid{display:grid;gap:9px}.ac-favorite-card{width:100%;min-height:78px;padding:9px 12px 9px 9px;border:1px solid var(--ml-line);border-radius:17px;background:var(--ml-surface);color:var(--ml-text);display:flex;align-items:center;gap:11px;text-align:left;font-family:var(--p-body);cursor:pointer}.ac-favorite-image{width:58px;height:58px;border-radius:14px;overflow:hidden;background:var(--ml-accent-soft);color:var(--ml-accent);display:grid;place-items:center;flex:0 0 auto}.ac-favorite-image-visual{width:100%;height:100%;background-position:center;background-size:cover}.ac-favorite-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.ac-favorite-copy strong{font-size:13px}.ac-favorite-copy small{font-size:10.5px;color:var(--ml-text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ac-favorite-copy b{font-size:12px;color:var(--ml-accent)}
.ac-segmented{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:var(--ml-line);padding:4px;border-radius:14px}.ac-segmented button{height:44px;border:0;border-radius:11px;background:transparent;color:var(--ml-text2);font:750 13px var(--p-body);cursor:pointer}.ac-segmented button[data-active=true]{background:var(--ml-surface);color:var(--ml-accent);box-shadow:0 2px 8px rgba(0,0,0,.07)}.ac-order-group{display:flex;flex-direction:column;gap:10px}.ac-group-title{display:flex;align-items:center;gap:9px;padding:3px 2px}.ac-group-title .ac-venue-mark{width:36px;height:36px;border-radius:11px}.ac-group-title h2{font-size:14px;margin:0}.ac-group-title span{font-size:10.5px;color:var(--ml-text2)}.ac-more{min-height:48px;border-radius:14px;border:1px solid var(--ml-line);background:var(--ml-surface);color:var(--ml-accent);font:750 13px var(--p-body);cursor:pointer}
.ac-detail-hero{display:flex;align-items:center;gap:12px;padding:17px;border-radius:19px;background:var(--ml-surface);border:1px solid var(--ml-line)}.ac-detail-hero>div{flex:1;min-width:0}.ac-detail-hero h2{font:800 18px var(--p-display);margin:5px 0 1px}.ac-detail-hero time{font-size:10.5px;color:var(--ml-text2)}.ac-detail-hero>strong{font-size:17px}.ac-detail-card{padding:17px;border-radius:18px;background:var(--ml-surface);border:1px solid var(--ml-line)}.ac-detail-card h3{font-size:13px;margin:0 0 10px}.ac-line{display:grid;grid-template-columns:28px 1fr auto;gap:10px;padding:12px 0;border-bottom:1px solid var(--ml-line)}.ac-line>span{width:28px;height:28px;border-radius:9px;background:var(--ml-accent-soft);color:var(--ml-accent);display:grid;place-items:center;font-size:11px;font-weight:800}.ac-line>div{display:flex;flex-direction:column;gap:3px;min-width:0}.ac-line strong,.ac-line>b{font-size:12.5px}.ac-line small{font-size:10.5px;color:var(--ml-text2)}.ac-line em{font-size:10.5px;color:var(--ml-accent);font-style:normal}.ac-saving,.ac-total{display:flex;justify-content:space-between;padding-top:13px;font-size:12px}.ac-saving{color:#277348}.ac-total{font-size:15px}.ac-detail-meta{display:flex;flex-direction:column;gap:13px}.ac-detail-meta>div{display:flex;align-items:flex-start;gap:10px;color:var(--ml-accent)}.ac-detail-meta span{display:flex;flex-direction:column;gap:2px;color:var(--ml-text)}.ac-detail-meta small{font-size:9.5px;color:var(--ml-text2)}.ac-detail-meta strong{font-size:11.5px}
.ac-reorder-button{width:100%;min-height:72px;padding:11px 14px;border:1px solid color-mix(in srgb,var(--ml-accent) 28%,var(--ml-line));border-radius:18px;background:var(--ml-accent-soft);color:var(--ml-accent2);display:flex;align-items:center;gap:11px;text-align:left;font-family:var(--p-body);cursor:pointer}.ac-reorder-button>span{flex:1;display:flex;flex-direction:column;gap:3px}.ac-reorder-button strong{font-size:13px}.ac-reorder-button small{font-size:10.5px;color:var(--ml-text2)}.ac-inline-error{min-height:48px;padding:9px 12px;border-radius:13px;background:#fee9e7;color:#a7372d;display:flex;align-items:center;gap:8px;font-size:11px}.ac-inline-error button{margin-left:auto;min-height:44px;border:0;background:transparent;color:inherit;font-weight:800}.ac-reorder-preview{padding:16px;border-radius:20px;background:var(--ml-surface);border:1px solid color-mix(in srgb,var(--ml-accent) 28%,var(--ml-line));display:flex;flex-direction:column;gap:13px}.ac-reorder-title{display:flex;align-items:center;gap:10px}.ac-reorder-title>span{width:42px;height:42px;border-radius:13px;background:var(--ml-accent-soft);color:var(--ml-accent2);display:grid;place-items:center}.ac-reorder-title h3{font:800 15px var(--p-display);margin:0}.ac-reorder-title p{font-size:10.5px;color:var(--ml-text2);margin:2px 0 0}.ac-reorder-summary{min-height:64px;padding:10px 13px;border-radius:14px;background:var(--ml-bg);display:grid;grid-template-columns:1fr 24px 1fr;align-items:center;gap:7px;color:var(--ml-text2)}.ac-reorder-summary>span{display:flex;flex-direction:column;gap:3px}.ac-reorder-summary>span:last-child{text-align:right}.ac-reorder-summary small{font-size:9.5px}.ac-reorder-summary b{font-size:14px;color:var(--ml-text)}.ac-reorder-lines{display:flex;flex-direction:column}.ac-reorder-lines article{display:grid;grid-template-columns:32px 1fr auto;gap:9px;padding:11px 0;border-bottom:1px solid var(--ml-line);align-items:start}.ac-reorder-state{width:30px;height:30px;border-radius:10px;background:#e6f4ec;color:#277348;display:grid;place-items:center}.ac-reorder-lines article[data-state=changed] .ac-reorder-state{background:#fff1ce;color:#936413}.ac-reorder-lines article[data-state=unavailable] .ac-reorder-state{background:#fee9e7;color:#a7372d}.ac-reorder-lines article>div{display:flex;flex-direction:column;gap:3px}.ac-reorder-lines strong,.ac-reorder-lines article>b{font-size:11.5px}.ac-reorder-lines small{font-size:9.5px;color:var(--ml-text2)}.ac-reorder-note{display:flex;align-items:center;gap:7px;color:#936413;font-size:10.5px;margin:0}.ac-reorder-apply{min-height:50px;border:0;border-radius:14px;background:var(--ml-accent);color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;font:800 12.5px var(--p-body);cursor:pointer}.ac-reorder-apply:disabled{opacity:.5;cursor:not-allowed}
.ac-profile-hero{text-align:center;padding:18px}.ac-avatar-large{width:72px;height:72px;border-radius:23px;margin:0 auto;background:var(--ml-accent-soft);color:var(--ml-accent2);font-size:21px}.ac-profile-hero h2{font:800 21px var(--p-display);margin:10px 0 3px}.ac-profile-hero p{font-size:11.5px;color:var(--ml-text2);margin:0}.ac-profile-card,.ac-session-card,.ac-privacy-card{padding:16px;border-radius:18px;background:var(--ml-surface);border:1px solid var(--ml-line)}.ac-profile-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:3px}.ac-profile-title h3,.ac-session-card h3{font-size:13px;margin:0}.ac-profile-title button{min-height:44px;border:0;background:transparent;color:var(--ml-accent2);font:750 12px var(--p-body);cursor:pointer}.ac-profile-row{min-height:64px;display:flex;align-items:center;gap:11px;border-top:1px solid var(--ml-line)}.ac-profile-row>span{width:36px;height:36px;border-radius:11px;background:var(--ml-accent-soft);color:var(--ml-accent2);display:grid;place-items:center}.ac-profile-row>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.ac-profile-row small{font-size:9.5px;color:var(--ml-text2)}.ac-profile-row strong{font-size:12.5px;overflow:hidden;text-overflow:ellipsis}.ac-profile-row em{display:flex;align-items:center;gap:3px;color:#277348;font-size:9.5px;font-style:normal;font-weight:750}.ac-profile-row[data-muted=true]{opacity:.72}.ac-name-editor{padding-top:12px;border-top:1px solid var(--ml-line)}.ac-name-editor label{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:750}.ac-name-editor input,.ac-name-editor select{height:48px;border-radius:13px;border:1.5px solid var(--ml-line);padding:0 13px;background:var(--ml-bg);color:var(--ml-text);font:500 14px var(--p-body);outline:none}.ac-name-editor input:focus,.ac-name-editor select:focus{border-color:var(--ml-accent);box-shadow:0 0 0 3px var(--ml-accent-soft)}.ac-name-editor>div{display:flex;justify-content:flex-end;gap:8px;margin-top:9px}.ac-name-editor button{min-height:44px;padding:0 15px;border-radius:12px;border:1px solid var(--ml-line);background:transparent;color:var(--ml-text);font:700 12px var(--p-body)}.ac-name-editor .ac-primary-small{border:0;background:var(--ml-accent);color:#fff}.ac-name-editor p{font-size:11px;color:#a7372d}.ac-success{min-height:48px;border-radius:14px;background:#e6f4ec;color:#277348;display:flex;align-items:center;gap:8px;padding:0 14px;font-size:12px;font-weight:700}.ac-session-card p{font-size:11.5px;color:var(--ml-text2)}.ac-session-card button{width:100%;min-height:48px;border-radius:13px;border:0;background:var(--ml-accent-soft);color:var(--ml-accent2);display:flex;align-items:center;justify-content:center;gap:8px;font:750 12.5px var(--p-body);margin-top:9px;cursor:pointer}.ac-session-card .ac-danger-link{background:transparent;color:#a7372d;border:1px solid color-mix(in srgb,#a7372d 25%,var(--ml-line))}.ac-session-confirm{margin-top:10px;padding:12px;border-radius:14px;background:color-mix(in srgb,#a7372d 7%,var(--ml-surface));border:1px solid color-mix(in srgb,#a7372d 22%,var(--ml-line))}.ac-session-confirm>p{margin:0}.ac-session-confirm>div{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ac-session-confirm button{margin-top:10px}.ac-privacy-card{display:flex;flex-direction:column;gap:14px}.ac-privacy-heading{display:flex;align-items:flex-start;gap:10px}.ac-privacy-heading>span{width:40px;height:40px;border-radius:12px;background:var(--ml-accent-soft);color:var(--ml-accent2);display:grid;place-items:center;flex:0 0 auto}.ac-privacy-heading h3{font-size:13.5px;margin:1px 0 3px}.ac-privacy-heading p,.ac-privacy-copy{font-size:10.5px;line-height:1.45;color:var(--ml-text2);margin:0}.ac-consent-group{display:flex;flex-direction:column;border-top:1px solid var(--ml-line)}.ac-consent-group>strong{font-size:11px;padding:12px 0 6px}.ac-consent-row{min-height:66px;display:grid;grid-template-columns:44px minmax(0,1fr);align-items:center;gap:8px;border-bottom:1px solid var(--ml-line);cursor:pointer}.ac-consent-row input{appearance:none;width:24px;height:24px;margin:0 10px;border:1.5px solid var(--ml-line);border-radius:8px;background:var(--ml-bg);display:grid;place-items:center;cursor:pointer}.ac-consent-row input:checked{background:var(--ml-accent);border-color:var(--ml-accent)}.ac-consent-row input:checked:after{content:'✓';color:#fff;font-size:15px;font-weight:900}.ac-consent-row input:focus-visible{outline:3px solid var(--ml-accent);outline-offset:2px}.ac-consent-row input:disabled{opacity:.55;cursor:wait}.ac-consent-row>span{display:flex;flex-direction:column;gap:3px}.ac-consent-row b{font-size:11.5px}.ac-consent-row small{font-size:9.5px;line-height:1.45;color:var(--ml-text2)}.ac-data-actions{display:flex;flex-direction:column;gap:8px}.ac-data-actions>button{width:100%;min-height:48px;border:0;border-radius:13px;background:var(--ml-accent-soft);color:var(--ml-accent2);display:flex;align-items:center;justify-content:center;gap:8px;font:750 12px var(--p-body);cursor:pointer}.ac-data-actions>button:disabled{opacity:.55;cursor:wait}.ac-data-actions>.ac-delete-button{background:transparent;color:#a7372d;border:1px solid color-mix(in srgb,#a7372d 25%,var(--ml-line))}.ac-delete-confirm{padding:13px;border-radius:14px;background:#fff8f7;border:1px solid color-mix(in srgb,#a7372d 22%,var(--ml-line));display:flex;flex-direction:column;gap:10px}.ac-delete-confirm p{font-size:10.5px;line-height:1.5;color:#74443f;margin:0}.ac-delete-confirm label{display:flex;flex-direction:column;gap:6px;font-size:10.5px;color:#74443f}.ac-delete-confirm input{height:46px;border:1px solid #dbc4c1;border-radius:11px;background:#fff;padding:0 12px;font:650 12px var(--p-body);outline:none}.ac-delete-confirm input:focus{border-color:#a7372d;box-shadow:0 0 0 3px rgba(167,55,45,.1)}.ac-delete-confirm>div{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ac-delete-confirm button{min-height:44px;border-radius:11px;border:1px solid #dbc4c1;background:#fff;color:#74443f;font:750 11.5px var(--p-body)}.ac-delete-confirm .ac-delete-submit{border:0;background:#a7372d;color:#fff}.ac-delete-confirm .ac-delete-submit:disabled{opacity:.45}.ac-delete-status{min-height:58px;padding:10px 12px;border-radius:13px;background:#fff1ce;color:#936413;display:flex;align-items:center;gap:10px}.ac-delete-status span{display:flex;flex-direction:column;gap:3px}.ac-delete-status b{font-size:11.5px}.ac-delete-status small{font-size:9.5px;line-height:1.4}.ac-privacy-message{min-height:44px;border-radius:12px;background:#e6f4ec;color:#277348;display:flex;align-items:center;padding:9px 12px;font-size:11px;font-weight:700}
.ac-loading,.ac-empty{min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:9px;color:var(--ml-text2)}.ac-loading span{font-size:12.5px}.ac-spin{animation:ac-spin .8s linear infinite}.ac-empty>span{width:52px;height:52px;border-radius:16px;background:var(--ml-accent-soft);color:var(--ml-accent2);display:grid;place-items:center}.ac-empty h2{font-size:14px;color:var(--ml-text);margin:3px 0 0}.ac-empty p{font-size:11.5px;line-height:1.5;max-width:260px;margin:0}.ac-empty button{min-height:44px;border:0;border-radius:12px;padding:0 15px;background:var(--ml-accent);color:#fff;font:750 12px var(--p-body)}.ac-skeleton,.ac-detail-skeleton,.ac-geometry-skeleton{display:grid;gap:9px}.ac-skeleton span,.ac-detail-skeleton span,.ac-geometry-skeleton span{border-radius:17px;background:linear-gradient(100deg,var(--ml-line),var(--ml-surface),var(--ml-line));background-size:200% 100%;animation:ac-shimmer 1.4s linear infinite}.ac-skeleton span{height:88px}.ac-detail-skeleton span:first-child{height:98px}.ac-detail-skeleton span:nth-child(2){height:240px}.ac-detail-skeleton span:last-child{height:92px}
@keyframes ac-spin{to{transform:rotate(360deg)}}@keyframes ac-shimmer{to{background-position:-200% 0}}
@media(max-width:359px){.ac-tabs{height:64px;padding-inline:6px;gap:2px}.ac-tab{flex-direction:column;gap:2px;border-radius:11px;font-size:10px;line-height:1}.ac-tab svg{width:16px;height:16px}}
@media(min-width:700px){.ac-content{padding:22px 24px 28px}.ac-loyalty-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ac-loyalty-card[data-expanded=true]{grid-column:1/-1}.ac-order-strip,.ac-favorite-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.ac-tab{font-size:12.5px;gap:7px}}
@media(hover:hover) and (pointer:fine){.ac-tab:hover,.ac-icon-button:hover,.ac-order-card:hover,.ac-favorite-card:hover,.ac-loyalty-toggle:hover{background-color:color-mix(in srgb,var(--ml-accent-soft) 58%,var(--ml-surface));border-color:color-mix(in srgb,var(--ml-accent) 28%,var(--ml-line))}}
.ac-root button:focus-visible,.ac-root input:focus-visible,.ac-panel:focus-visible,.ac-reorder-title h3:focus-visible{outline:3px solid var(--ml-accent);outline-offset:3px}
@media(prefers-reduced-motion:reduce){.ac-root *{animation:none!important;scroll-behavior:auto!important;transition:none!important}}
`

function accountPreviewFixture(restaurant?: Props['previewRestaurant']): CustomerAccountView {
  if (!restaurant) return PREVIEW_ACCOUNT
  return {
    ...PREVIEW_ACCOUNT,
    loyalty: PREVIEW_ACCOUNT.loyalty.map((entry, index) => index === 0 ? { ...entry, restaurant } : entry),
    consents: PREVIEW_ACCOUNT.consents.map((entry, index) => index === 0 ? {
      ...entry,
      restaurant: { id: restaurant.id, slug: restaurant.slug, name: restaurant.name },
    } : entry),
  }
}

function emptyPreviewAccount(restaurant?: Props['previewRestaurant']): CustomerAccountView {
  const account = accountPreviewFixture(restaurant)
  return { ...account, loyalty: [], consents: [] }
}

function previewOrders(items: CustomerOrderSummaryView[], restaurant?: Props['previewRestaurant']): CustomerOrderSummaryView[] {
  if (!restaurant) return items
  return items.map((item, index) => index === 0 ? {
    ...item,
    restaurant: { slug: restaurant.slug, name: restaurant.name, logoUrl: restaurant.logoUrl },
  } : item)
}

function previewOrderDetail(restaurant?: Props['previewRestaurant']): CustomerOrderDetailView {
  if (!restaurant) return PREVIEW_DETAIL
  return { ...PREVIEW_DETAIL, restaurant: { slug: restaurant.slug, name: restaurant.name, logoUrl: restaurant.logoUrl } }
}

function previewFavorites(items: CustomerFavoriteView[], restaurant?: Props['previewRestaurant']): CustomerFavoriteView[] {
  if (!restaurant) return items
  return items.slice(0, 2).map((item) => ({
    ...item,
    restaurant: { slug: restaurant.slug, name: restaurant.name, logoUrl: restaurant.logoUrl },
  }))
}

function previewReorderFixture(restaurant?: Props['previewRestaurant']): CustomerReorderPreviewView {
  if (!restaurant) return PREVIEW_REORDER
  return { ...PREVIEW_REORDER, restaurant: { slug: restaurant.slug, name: restaurant.name, logoUrl: restaurant.logoUrl } }
}

const PREVIEW_ACCOUNT: CustomerAccountView = {
  profile: {
    name: 'Deniz Yılmaz',
    email: { value: 'deniz@ornek.com', verified: true },
    phone: { value: '+90 532 555 24 18', verified: true },
    memberSince: '2025-11-14T10:20:00.000Z',
  },
  loyalty: [
    { restaurant: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', slug: 'test-cafe-b', name: 'Test Cafe B', logoUrl: null }, points: 1280, stamps: 7, stampGoal: 9, stampRewardText: '9 kahve al, 1 kahve bizden', stampUnlocked: false, pointsEnabled: true, stampsEnabled: true, tier: { name: 'Altın', color: '#c8922a' }, nextTier: { name: 'Platin', minimumPoints: 2500 }, tierProgress: 34, lifetimePoints: 1780 },
    { restaurant: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', slug: 'mahalle-firin', name: 'Mahalle Fırın', logoUrl: null }, points: 340, stamps: 8, stampGoal: 8, stampRewardText: '8 kruvasan al, 1 kruvasan bizden', stampUnlocked: true, pointsEnabled: true, stampsEnabled: true, tier: { name: 'Gümüş', color: '#7f8995' }, nextTier: { name: 'Altın', minimumPoints: 1000 }, tierProgress: 48, lifetimePoints: 560 },
  ],
  consents: [
    { restaurant: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', slug: 'test-cafe-b', name: 'Test Cafe B' }, contactData: true, marketing: false },
    { restaurant: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', slug: 'mahalle-firin', name: 'Mahalle Fırın' }, contactData: false, marketing: false },
  ],
  privacy: { deletionRequest: null },
}

const PREVIEW_LOYALTY_ACTIVITY: CustomerLoyaltyActivityPageView['items'] = [
  { id: 'a1111111-1111-4111-8111-111111111111', type: 'points', direction: 'earn', delta: 620, reason: 'Sipariş kazanımı', createdAt: '2026-07-28T18:00:00.000Z' },
  { id: 'a2222222-2222-4222-8222-222222222222', type: 'points', direction: 'reversal', delta: -155, reason: 'Kısmi iade düzeltmesi', createdAt: '2026-07-30T13:25:00.000Z' },
  { id: 'a3333333-3333-4333-8333-333333333333', type: 'points', direction: 'refund', delta: 100, reason: 'Harcanan puan iadesi', createdAt: '2026-07-11T14:31:00.000Z' },
]

const PREVIEW_ACTIVE: CustomerOrderSummaryView[] = [
  { id: '11111111-1111-4111-8111-111111111111', restaurant: { slug: 'test-cafe-b', name: 'Test Cafe B', logoUrl: null }, placedAt: '2026-08-02T11:42:00.000Z', updatedAt: '2026-08-02T11:49:00.000Z', total: 485, status: { code: 'preparing', label: 'Hazırlanıyor', tone: 'progress' }, paid: false, itemCount: 3, itemNames: ['Avokadolu Tost', 'Flat White'] },
  { id: '22222222-2222-4222-8222-222222222222', restaurant: { slug: 'mahalle-firin', name: 'Mahalle Fırın', logoUrl: null }, placedAt: '2026-08-02T09:20:00.000Z', updatedAt: '2026-08-02T09:28:00.000Z', total: 220, status: { code: 'ready', label: 'Hazır', tone: 'ready' }, paid: false, itemCount: 2, itemNames: ['Kruvasan', 'Filtre Kahve'] },
]

const PREVIEW_PAST: CustomerOrderSummaryView[] = [
  { id: '33333333-3333-4333-8333-333333333333', restaurant: { slug: 'test-cafe-b', name: 'Test Cafe B', logoUrl: null }, placedAt: '2026-07-28T17:10:00.000Z', updatedAt: '2026-07-28T18:00:00.000Z', total: 620, status: { code: 'paid', label: 'Tamamlandı', tone: 'success' }, paid: true, itemCount: 4, itemNames: ['Trüflü Burger', 'Patates', 'Limonata'] },
  { id: '44444444-4444-4444-8444-444444444444', restaurant: { slug: 'mahalle-firin', name: 'Mahalle Fırın', logoUrl: null }, placedAt: '2026-07-20T08:35:00.000Z', updatedAt: '2026-07-20T09:02:00.000Z', total: 315, status: { code: 'paid', label: 'Tamamlandı', tone: 'success' }, paid: true, itemCount: 3, itemNames: ['Menemen', 'Ekmek', 'Çay'] },
  { id: '55555555-5555-4555-8555-555555555555', restaurant: { slug: 'test-cafe-b', name: 'Test Cafe B', logoUrl: null }, placedAt: '2026-07-11T14:22:00.000Z', updatedAt: '2026-07-11T14:31:00.000Z', total: 170, status: { code: 'cancelled', label: 'İptal edildi', tone: 'danger' }, paid: false, itemCount: 1, itemNames: ['Soğuk Demleme'] },
]

const PREVIEW_DETAIL: CustomerOrderDetailView = {
  ...PREVIEW_PAST[0]!,
  items: [
    { name: 'Trüflü Burger', quantity: 1, unitPrice: 390, originalUnitPrice: null, modifiers: ['Orta pişmiş', 'Ekstra cheddar'], removedIngredients: ['Soğan'], note: 'Sos ayrı gelsin.' },
    { name: 'Patates', quantity: 1, unitPrice: 110, originalUnitPrice: null, modifiers: ['Trüf mayonez'], removedIngredients: [], note: null },
    { name: 'Limonata', quantity: 2, unitPrice: 60, originalUnitPrice: null, modifiers: [], removedIngredients: [], note: null },
  ],
  payment: { label: 'Kart / POS', paidAt: '2026-07-28T18:00:00.000Z' },
  savings: 40,
  cancellationReason: null,
}

const PREVIEW_FAVORITES: CustomerFavoriteView[] = [
  {
    restaurant: { slug: 'test-cafe-b', name: 'Test Cafe B', logoUrl: null },
    item: {
      id: '66666666-6666-4666-8666-666666666666',
      name: 'Trüflü Burger',
      description: 'Karamelize soğan, cheddar ve trüf mayonez',
      price: 410,
      imageUrl: null,
    },
    createdAt: '2026-08-01T12:20:00.000Z',
  },
  {
    restaurant: { slug: 'test-cafe-b', name: 'Test Cafe B', logoUrl: null },
    item: {
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Flat White',
      description: 'Çift shot espresso ve mikro köpük süt',
      price: 145,
      imageUrl: null,
    },
    createdAt: '2026-07-30T08:45:00.000Z',
  },
  {
    restaurant: { slug: 'mahalle-firin', name: 'Mahalle Fırın', logoUrl: null },
    item: {
      id: '88888888-8888-4888-8888-888888888888',
      name: 'Bademli Kruvasan',
      description: 'Günlük tereyağlı hamur ve badem kreması',
      price: 185,
      imageUrl: null,
    },
    createdAt: '2026-07-24T09:10:00.000Z',
  },
]

const PREVIEW_REORDER: CustomerReorderPreviewView = {
  orderId: PREVIEW_DETAIL.id,
  restaurant: PREVIEW_DETAIL.restaurant,
  originalTotal: 620,
  currentSubtotal: 645,
  canApply: true,
  lines: [
    {
      originalName: 'Trüflü Burger',
      currentName: 'Trüflü Burger',
      quantity: 1,
      originalUnitPrice: 390,
      currentUnitPrice: 420,
      state: 'changed',
      differences: [
        { kind: 'price_changed', label: 'Fiyat 390 ₺’den 420 ₺’ye güncellendi.' },
        { kind: 'campaign_removed', label: 'Önceki kampanya artık geçerli değil.' },
      ],
      cartLine: {
        itemId: '66666666-6666-4666-8666-666666666666',
        quantity: 1,
        selectedModifiers: [],
        removedIngredientIds: [],
        productNote: 'Sos ayrı gelsin.',
      },
    },
    {
      originalName: 'Patates',
      currentName: 'Patates',
      quantity: 1,
      originalUnitPrice: 110,
      currentUnitPrice: 105,
      state: 'ready',
      differences: [],
      cartLine: {
        itemId: '99999999-9999-4999-8999-999999999999',
        quantity: 1,
        selectedModifiers: [],
        removedIngredientIds: [],
      },
    },
    {
      originalName: 'Limonata',
      currentName: null,
      quantity: 2,
      originalUnitPrice: 60,
      currentUnitPrice: null,
      state: 'unavailable',
      differences: [{ kind: 'unavailable', label: 'Ürün mevcut menüde bulunmuyor.' }],
      cartLine: null,
    },
  ],
}
