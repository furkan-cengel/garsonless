'use client'

import { useEffect, useMemo, useState } from 'react'
import { AppIcons as I } from '@garsonless/ui/icons'
import { formatTRY } from '@garsonless/ui'
import type { ApiResult } from '../../../lib/customer-auth-contract'
import type {
  CustomerAccountView,
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

interface Props {
  fallbackName: string | null
  onClose: () => void
  onNameChange: (name: string) => void
  onLogout?: (scope?: 'device' | 'all') => void | Promise<void>
  rewardCount?: number
  onOpenRewards?: () => void
  currentRestaurantSlug?: string
  onOpenFavorite?: (favorite: CustomerFavoriteView) => void
  onApplyReorder?: (preview: CustomerReorderPreviewView) => void
}

type AccountTab = 'overview' | 'orders' | 'favorites' | 'profile'

interface OrdersState {
  items: CustomerOrderSummaryView[]
  nextCursor: string | null
  loaded: boolean
  loading: boolean
  error: boolean
}

const EMPTY_ORDERS: OrdersState = { items: [], nextCursor: null, loaded: false, loading: false, error: false }

export default function AccountCenter({ fallbackName, onClose, onNameChange, onLogout, rewardCount = 0, onOpenRewards, currentRestaurantSlug, onOpenFavorite, onApplyReorder }: Props) {
  const [tab, setTab] = useState<AccountTab>('overview')
  const [account, setAccount] = useState<CustomerAccountView | null>(null)
  const [accountLoading, setAccountLoading] = useState(true)
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
  const [favoritesLoading, setFavoritesLoading] = useState(true)
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
  const [previewMode, setPreviewMode] = useState<string | null>(null)

  useEffect(() => {
    const preview = process.env.NODE_ENV === 'development'
      ? new URLSearchParams(window.location.search).get('__customerAccountPreview')
      : null
    setPreviewMode(preview)
    if (preview) {
      setAccount(PREVIEW_ACCOUNT)
      setNameDraft(PREVIEW_ACCOUNT.profile.name ?? '')
      setOrders({
        active: { items: PREVIEW_ACTIVE, nextCursor: null, loaded: true, loading: false, error: false },
        past: { items: PREVIEW_PAST, nextCursor: null, loaded: true, loading: false, error: false },
      })
      if (preview === 'orders' || preview === 'detail') setTab('orders')
      if (preview === 'favorites') setTab('favorites')
      if (preview === 'profile' || preview === 'privacy') setTab('profile')
      if (preview === 'detail') setSelectedOrder(PREVIEW_DETAIL)
      if (preview === 'reorder') {
        setTab('orders')
        setSelectedOrder(PREVIEW_DETAIL)
        setReorderPreview(PREVIEW_REORDER)
      }
      setFavorites(PREVIEW_FAVORITES)
      setFavoritesLoading(false)
      setAccountLoading(false)
      return
    }
    const controller = new AbortController()
    void loadAccount(controller.signal)
    void loadOrders('active', null, controller.signal)
    void loadFavorites(controller.signal)
    return () => controller.abort()
  }, [])

  async function loadAccount(signal?: AbortSignal) {
    setAccountLoading(true)
    setAccountError(false)
    try {
      const response = await fetch('/api/account', { signal })
      const result = await response.json() as ApiResult<CustomerAccountView>
      if (!response.ok || !result.ok) throw new Error('account_unavailable')
      setAccount(result.data)
      setNameDraft(result.data.profile.name ?? '')
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setAccountError(true)
    } finally {
      if (!signal?.aborted) setAccountLoading(false)
    }
  }

  async function loadFavorites(signal?: AbortSignal) {
    setFavoritesLoading(true)
    setFavoritesError(false)
    try {
      const response = await fetch('/api/account/favorites', { signal, cache: 'no-store' })
      const result = await response.json() as ApiResult<CustomerFavoritesView>
      if (!response.ok || !result.ok) throw new Error('favorites_unavailable')
      setFavorites(result.data.items)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setFavoritesError(true)
    } finally {
      if (!signal?.aborted) setFavoritesLoading(false)
    }
  }

  async function loadOrders(filter: CustomerOrderFilter, cursor: string | null, signal?: AbortSignal) {
    setOrders((current) => ({ ...current, [filter]: { ...current[filter], loading: true, error: false } }))
    try {
      const params = new URLSearchParams({ status: filter, limit: '8' })
      if (cursor) params.set('cursor', cursor)
      const response = await fetch(`/api/account/orders?${params}`, { signal })
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
    }
  }

  async function openOrder(order: CustomerOrderSummaryView) {
    setReorderPreview(null)
    setReorderError(false)
    if (previewMode) {
      setSelectedOrder({ ...PREVIEW_DETAIL, ...order, items: PREVIEW_DETAIL.items })
      return
    }
    setDetailLoading(true)
    setDetailError(false)
    try {
      const response = await fetch(`/api/account/orders/${encodeURIComponent(order.id)}`)
      const result = await response.json() as ApiResult<CustomerOrderDetailView>
      if (!response.ok || !result.ok) throw new Error('order_unavailable')
      setSelectedOrder(result.data)
    } catch {
      setDetailError(true)
    } finally {
      setDetailLoading(false)
    }
  }

  async function previewReorder(orderId: string) {
    if (previewMode) {
      setReorderPreview(PREVIEW_REORDER)
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
  }

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
    if (previewMode) return
    if (!onLogout || logoutBusy) return
    setLogoutBusy(scope)
    try {
      await onLogout(scope)
    } finally {
      setLogoutBusy(null)
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
  const firstName = (account?.profile.name ?? fallbackName ?? 'Misafir').split(' ')[0]

  return (
    <div className="ac-root">
      <style>{ACCOUNT_CENTER_CSS}</style>
      <header className="ac-header">
        {selectedOrder ? (
          <button type="button" className="ac-icon-button" onClick={() => setSelectedOrder(null)} aria-label="Siparişlere dön"><I.chevLeft size={22} /></button>
        ) : <span className="ac-brand-mark" aria-hidden="true">M</span>}
        <div className="ac-heading">
          <span>{selectedOrder ? selectedOrder.restaurant.name : 'Masabu Hesabım'}</span>
          <strong>{selectedOrder ? 'Sipariş detayı' : `Merhaba, ${firstName}`}</strong>
        </div>
        <button type="button" className="ac-icon-button" onClick={onClose} aria-label="Hesabı kapat"><I.close size={20} /></button>
      </header>

      {!selectedOrder && (
        <div className="ac-tabs" role="tablist" aria-label="Hesap bölümleri">
          <TabButton active={tab === 'overview'} onClick={() => selectTab('overview')} icon={<I.home size={18} />} label="Özet" />
          <TabButton active={tab === 'orders'} onClick={() => selectTab('orders')} icon={<I.receipt size={18} />} label="Siparişler" />
          <TabButton active={tab === 'favorites'} onClick={() => selectTab('favorites')} icon={<I.heart size={18} />} label="Favoriler" />
          <TabButton active={tab === 'profile'} onClick={() => selectTab('profile')} icon={<I.user size={18} />} label="Profil" />
        </div>
      )}

      <main className="ac-content" aria-live="polite">
        {selectedOrder ? <OrderDetail order={selectedOrder} preview={reorderPreview} loading={reorderLoading} error={reorderError} currentRestaurantSlug={currentRestaurantSlug} onPreview={() => void previewReorder(selectedOrder.id)} onApply={() => reorderPreview && onApplyReorder?.(reorderPreview)} /> : detailLoading ? <LoadingState label="Sipariş yükleniyor…" /> : detailError ? <ErrorState label="Sipariş detayı açılamadı." onRetry={() => setDetailError(false)} /> : null}
        {!selectedOrder && !detailLoading && !detailError && tab === 'overview' && (
          <Overview
            account={account}
            loading={accountLoading}
            error={accountError}
            activeOrders={orders.active}
            onRetry={() => void loadAccount()}
            onOrders={() => selectTab('orders')}
            onOrder={(order) => void openOrder(order)}
            rewardCount={rewardCount}
            previewMode={previewMode}
            {...(onOpenRewards ? { onOpenRewards } : {})}
          />
        )}
        {!selectedOrder && !detailLoading && !detailError && tab === 'orders' && (
          <OrdersPanel
            filter={ordersFilter}
            state={currentOrders}
            onFilter={selectOrderFilter}
            onOrder={(order) => void openOrder(order)}
            onRetry={() => void loadOrders(ordersFilter, null)}
            onMore={() => void loadOrders(ordersFilter, currentOrders.nextCursor)}
          />
        )}
        {!selectedOrder && !detailLoading && !detailError && tab === 'favorites' && (
          <FavoritesPanel
            items={favorites}
            loading={favoritesLoading}
            error={favoritesError}
            onRetry={() => void loadFavorites()}
            onOpen={(favorite) => onOpenFavorite?.(favorite)}
          />
        )}
        {!selectedOrder && !detailLoading && !detailError && tab === 'profile' && (
          <ProfilePanel
            account={account}
            loading={accountLoading}
            error={accountError}
            editingName={editingName}
            nameDraft={nameDraft}
            saveState={saveState}
            logoutBusy={logoutBusy}
            consentBusy={consentBusy}
            privacyBusy={privacyBusy}
            privacyMessage={privacyMessage}
            hasLogout={Boolean(onLogout || previewMode)}
            currentRestaurantSlug={currentRestaurantSlug}
            onNameDraft={setNameDraft}
            onEdit={() => { setEditingName(true); setSaveState('idle') }}
            onCancel={() => { setEditingName(false); setNameDraft(account?.profile.name ?? '') }}
            onSave={() => void saveName()}
            onRetry={() => void loadAccount()}
            onLogout={(scope) => void logout(scope)}
            onConsent={(restaurantId, consentType, grant) => void updateConsent(restaurantId, consentType, grant)}
            onExport={() => void exportPrivacyData()}
            onDelete={(confirmation) => void requestDeletion(confirmation)}
          />
        )}
      </main>
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" role="tab" aria-selected={active} className="ac-tab" data-active={active} onClick={onClick}>{icon}<span>{label}</span></button>
}

function Overview({ account, loading, error, activeOrders, onRetry, onOrders, onOrder, rewardCount, onOpenRewards, previewMode }: {
  account: CustomerAccountView | null
  loading: boolean
  error: boolean
  activeOrders: OrdersState
  onRetry: () => void
  onOrders: () => void
  onOrder: (order: CustomerOrderSummaryView) => void
  rewardCount: number
  onOpenRewards?: () => void
  previewMode: string | null
}) {
  if (loading) return <LoadingState label="Hesabın hazırlanıyor…" />
  if (error || !account) return <ErrorState label="Hesap bilgileri şu anda alınamıyor." onRetry={onRetry} />
  return (
    <div className="ac-stack">
      <section className="ac-welcome-card">
        <span className="ac-avatar">{initials(account.profile.name)}</span>
        <div><small>Global Masabu profili</small><h2>{account.profile.name || 'Masabu üyesi'}</h2><p>{account.profile.email?.value || account.profile.phone?.value || 'Doğrulanmış hesabın hazır'}</p></div>
        <span className="ac-verified"><I.shield size={15} /> Doğrulandı</span>
      </section>

      <SectionHeading title="Aktif siparişler" action={activeOrders.items.length ? 'Tümünü gör' : undefined} onAction={onOrders} />
      {activeOrders.loading && !activeOrders.loaded ? <CompactSkeleton /> : activeOrders.items.length > 0 ? (
        <div className="ac-order-strip">
          {activeOrders.items.slice(0, 2).map((order) => <OrderCard key={order.id} order={order} compact onClick={() => onOrder(order)} />)}
        </div>
      ) : <EmptyState icon={<I.receipt size={24} />} title="Aktif siparişin yok" copy="Yeni siparişlerin burada anlık görünür." />}

      <SectionHeading title="Sadakat kartların" />
      {account.loyalty.length > 0 ? (
        <div className="ac-loyalty-grid">
          {account.loyalty.map((loyalty, index) => (
            <LoyaltyCard
              key={loyalty.restaurant.slug}
              loyalty={loyalty}
              preview={previewMode === 'loyalty' && index === 0}
            />
          ))}
        </div>
      ) : <EmptyState icon={<I.gift size={24} />} title="Sadakat kartın henüz yok" copy="Katıldığın restoranların kartları burada gruplanır." />}
      {rewardCount > 0 && onOpenRewards && (
        <button type="button" className="ac-reward-shortcut" onClick={onOpenRewards}>
          <span><I.gift size={21} /></span><div><strong>Ödül kataloğu</strong><small>{rewardCount} ödül seni bekliyor</small></div><I.chevRight size={18} />
        </button>
      )}
    </div>
  )
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

  async function load(cursor: string | null) {
    if (preview || loading) return
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ restaurantId: loyalty.restaurant.id })
      if (cursor) params.set('cursor', cursor)
      const response = await fetch(`/api/account/loyalty-activity?${params}`, { cache: 'no-store' })
      const result = await response.json() as ApiResult<CustomerLoyaltyActivityPageView>
      if (!response.ok || !result.ok) throw new Error('loyalty_activity_failed')
      setItems((current) => cursor ? [...current, ...result.data.items] : result.data.items)
      setNextCursor(result.data.nextCursor)
      setLoaded(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    const next = !expanded
    setExpanded(next)
    if (next && !loaded && !loading) void load(null)
  }

  return (
    <article className="ac-loyalty-card" data-expanded={expanded}>
      <div className="ac-loyalty-top"><VenueMark name={loyalty.restaurant.name} /><div><strong>{loyalty.restaurant.name}</strong><span style={{ color: loyalty.tier.color }}>{loyalty.tier.name} üye</span></div></div>
      <div className="ac-loyalty-values">
        {loyalty.pointsEnabled && <div><small>Puan</small><b>{loyalty.points.toLocaleString('tr-TR')}</b></div>}
        {loyalty.stampsEnabled && <div><small>Damga</small><b>{loyalty.stamps}<em>/{loyalty.stampGoal}</em></b></div>}
        {loyalty.pointsEnabled && <div><small>Yaşam boyu</small><b>{loyalty.lifetimePoints.toLocaleString('tr-TR')}</b></div>}
      </div>
      <div className="ac-progress" aria-label={`Seviye ilerlemesi yüzde ${loyalty.tierProgress}`}><span style={{ width: `${loyalty.tierProgress}%`, background: loyalty.tier.color }} /></div>
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
      {state.loading && !state.loaded ? <LoadingState label="Siparişlerin yükleniyor…" /> : state.error ? <ErrorState label="Siparişler alınamadı." onRetry={onRetry} /> : groups.length === 0 ? (
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

function FavoritesPanel({ items, loading, error, onRetry, onOpen }: {
  items: CustomerFavoriteView[]
  loading: boolean
  error: boolean
  onRetry: () => void
  onOpen: (favorite: CustomerFavoriteView) => void
}) {
  const groups = useMemo(() => groupFavorites(items), [items])
  if (loading) return <LoadingState label="Favorilerin yükleniyor…" />
  if (error) return <ErrorState label="Favoriler alınamadı." onRetry={onRetry} />
  if (groups.length === 0) return <EmptyState icon={<I.heart size={25} />} title="Henüz favorin yok" copy="Menü kartlarındaki kalp ikonuyla sevdiğin ürünleri kaydet." />
  return (
    <div className="ac-stack">
      <section className="ac-favorite-hero">
        <span><I.heart size={22} fill="currentColor" /></span>
        <div><h2>Favori lezzetlerin</h2><p>{items.length} ürün, restoranlarına göre gruplanıyor.</p></div>
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

function OrderDetail({ order, preview, loading, error, currentRestaurantSlug, onPreview, onApply }: {
  order: CustomerOrderDetailView
  preview: CustomerReorderPreviewView | null
  loading: boolean
  error: boolean
  currentRestaurantSlug?: string
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
            <div><strong>{line.name}</strong>{line.modifiers.length > 0 && <small>{line.modifiers.join(', ')}</small>}{line.removedIngredients.length > 0 && <small>Çıkarılan: {line.removedIngredients.join(', ')}</small>}{line.note && <em>“{line.note}”</em>}</div>
            <b>{formatTRY(line.unitPrice * line.quantity)}</b>
          </div>
        ))}
        {order.savings > 0 && <div className="ac-saving"><span>Toplam kazanç</span><strong>−{formatTRY(order.savings)}</strong></div>}
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
      {preview && <ReorderPreview preview={preview} sameRestaurant={preview.restaurant.slug === currentRestaurantSlug} onApply={onApply} />}
    </div>
  )
}

function ReorderPreview({ preview, sameRestaurant, onApply }: { preview: CustomerReorderPreviewView; sameRestaurant: boolean; onApply: () => void }) {
  const available = preview.lines.filter((line) => line.cartLine).length
  const unavailable = preview.lines.length - available
  return (
    <section className="ac-reorder-preview" aria-label="Yeniden sipariş farkları">
      <div className="ac-reorder-title"><span><I.shield size={20} /></span><div><h3>Güvenli önizleme</h3><p>Sipariş verilmedi; güncel menü doğrulandı.</p></div></div>
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

function ProfilePanel({ account, loading, error, editingName, nameDraft, saveState, logoutBusy, consentBusy, privacyBusy, privacyMessage, hasLogout, currentRestaurantSlug, onNameDraft, onEdit, onCancel, onSave, onRetry, onLogout, onConsent, onExport, onDelete }: {
  account: CustomerAccountView | null
  loading: boolean
  error: boolean
  editingName: boolean
  nameDraft: string
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  logoutBusy: 'device' | 'all' | null
  consentBusy: string | null
  privacyBusy: 'export' | 'delete' | null
  privacyMessage: string | null
  hasLogout: boolean
  currentRestaurantSlug: string | undefined
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
  if (loading) return <LoadingState label="Profilin yükleniyor…" />
  if (error || !account) return <ErrorState label="Profil bilgileri alınamadı." onRetry={onRetry} />
  return (
    <div className="ac-stack">
      <section className="ac-profile-hero"><span className="ac-avatar ac-avatar-large">{initials(account.profile.name)}</span><h2>{account.profile.name || 'Masabu üyesi'}</h2><p>{new Date(account.profile.memberSince).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} tarihinden beri üye</p></section>
      <section className="ac-profile-card">
        <div className="ac-profile-title"><h3>Profil bilgileri</h3>{!editingName && <button type="button" onClick={onEdit}>Düzenle</button>}</div>
        {editingName ? <div className="ac-name-editor"><label>Ad soyad<input value={nameDraft} onChange={(event) => onNameDraft(event.target.value)} maxLength={80} autoFocus /></label><div><button type="button" onClick={onCancel}>Vazgeç</button><button type="button" className="ac-primary-small" disabled={nameDraft.trim().length < 2 || saveState === 'saving'} onClick={onSave}>{saveState === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}</button></div>{saveState === 'error' && <p role="alert">Adın kaydedilemedi. Tekrar dene.</p>}</div> : <ProfileRow icon={<I.user size={19} />} label="Ad soyad" value={account.profile.name || 'Belirtilmedi'} />}
        {account.profile.email && <ProfileRow icon={<I.mail size={19} />} label="E-posta" value={account.profile.email.value} verified />}
        {account.profile.phone && <ProfileRow icon={<I.phoneCall size={19} />} label="Telefon" value={account.profile.phone.value} verified />}
        {!account.profile.phone && <ProfileRow icon={<I.phoneCall size={19} />} label="Telefon" value="Doğrulanmış telefon eklenmedi" muted />}
      </section>
      {saveState === 'saved' && <div className="ac-success" role="status"><I.check size={18} /> Profilin güncellendi.</div>}
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
      {hasLogout && <section className="ac-session-card"><h3>Oturumlar</h3><p>Çıkış yaptığında sepetin bu cihazda korunur.</p><button type="button" onClick={() => onLogout('device')} disabled={logoutBusy !== null}><I.logout size={18} />{logoutBusy === 'device' ? 'Çıkılıyor…' : 'Bu cihazdan çık'}</button><button type="button" className="ac-danger-link" onClick={() => onLogout('all')} disabled={logoutBusy !== null}>{logoutBusy === 'all' ? 'Çıkılıyor…' : 'Tüm cihazlardan çık'}</button></section>}
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

function ProfileRow({ icon, label, value, verified = false, muted = false }: { icon: React.ReactNode; label: string; value: string; verified?: boolean; muted?: boolean }) {
  return <div className="ac-profile-row" data-muted={muted}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div>{verified && <em><I.shield size={14} /> Doğrulandı</em>}</div>
}

function SectionHeading({ title, action, onAction }: { title: string; action?: string | undefined; onAction?: () => void }) {
  return <div className="ac-section-heading"><h2>{title}</h2>{action && onAction && <button type="button" onClick={onAction}>{action}<I.chevRight size={15} /></button>}</div>
}

function VenueMark({ name }: { name: string }) {
  return <span className="ac-venue-mark" aria-hidden="true">{name.trim().slice(0, 1).toLocaleUpperCase('tr-TR') || 'M'}</span>
}

function LoadingState({ label }: { label: string }) {
  return <div className="ac-loading" role="status"><I.refresh className="ac-spin" size={24} /><span>{label}</span></div>
}

function CompactSkeleton() {
  return <div className="ac-skeleton" aria-label="Siparişler yükleniyor"><span /><span /></div>
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
.ac-header{min-height:74px;padding:max(12px,env(safe-area-inset-top)) 18px 10px;display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;gap:12px;border-bottom:1px solid var(--ml-line);background:color-mix(in srgb,var(--ml-surface) 92%,transparent);flex:0 0 auto}
.ac-brand-mark,.ac-avatar,.ac-venue-mark{display:grid;place-items:center;flex:0 0 auto;background:linear-gradient(135deg,var(--ml-accent),var(--ml-accent2));color:#fff;font-weight:850}
.ac-brand-mark{width:44px;height:44px;border-radius:14px;font:850 21px var(--p-display)}
.ac-heading{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.ac-heading span{font-size:11.5px;color:var(--ml-text2);font-weight:650}.ac-heading strong{font:800 19px/1.2 var(--p-display);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ac-icon-button{width:44px;height:44px;border-radius:50%;border:1px solid var(--ml-line);background:var(--ml-surface);color:var(--ml-text);display:grid;place-items:center;cursor:pointer;flex:0 0 auto}
.ac-tabs{height:62px;padding:6px 10px;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;border-bottom:1px solid var(--ml-line);background:var(--ml-surface);flex:0 0 auto}.ac-tab{min-height:48px;border:0;border-radius:13px;background:transparent;color:var(--ml-text2);display:flex;align-items:center;justify-content:center;gap:5px;font:700 11.5px var(--p-body);cursor:pointer}.ac-tab[data-active=true]{background:var(--ml-accent-soft);color:var(--ml-accent)}
.ac-content{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:18px 16px calc(24px + env(safe-area-inset-bottom))}.ac-stack{display:flex;flex-direction:column;gap:15px;max-width:680px;margin:0 auto}
.ac-welcome-card{position:relative;display:flex;align-items:center;gap:13px;padding:18px;border-radius:20px;color:#fff;background:linear-gradient(135deg,var(--ml-accent),var(--ml-accent2));box-shadow:0 18px 42px -25px color-mix(in srgb,var(--ml-accent) 90%,#000)}.ac-avatar{width:52px;height:52px;border-radius:17px;background:rgba(255,255,255,.17);border:1px solid rgba(255,255,255,.24);font-size:16px}.ac-welcome-card>div{min-width:0}.ac-welcome-card small{font-size:10.5px;opacity:.7}.ac-welcome-card h2{font:800 20px/1.2 var(--p-display);margin:3px 0}.ac-welcome-card p{font-size:12px;opacity:.78;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ac-verified{position:absolute;right:13px;top:13px;display:flex;align-items:center;gap:4px;font-size:10px;font-weight:750;background:rgba(255,255,255,.14);padding:5px 8px;border-radius:99px}
.ac-section-heading{display:flex;align-items:center;justify-content:space-between;margin-top:3px}.ac-section-heading h2{font:800 17px/1.2 var(--p-display);margin:0}.ac-section-heading button{min-height:44px;border:0;background:transparent;color:var(--ml-accent);display:flex;align-items:center;gap:2px;font:750 12px var(--p-body);cursor:pointer}
.ac-order-strip,.ac-order-list{display:flex;flex-direction:column;gap:9px}.ac-order-card{width:100%;min-height:88px;padding:13px;border:1px solid var(--ml-line);border-radius:17px;background:var(--ml-surface);color:var(--ml-text);display:flex;align-items:center;gap:12px;text-align:left;cursor:pointer;font-family:var(--p-body);box-shadow:0 10px 25px -26px rgba(0,0,0,.5)}.ac-order-main{flex:1;min-width:0}.ac-order-main>strong{display:block;font-size:14px;margin:5px 0 3px}.ac-order-main p{font-size:11.5px;color:var(--ml-text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0}.ac-status{display:inline-flex;padding:4px 8px;border-radius:99px;font-size:9.5px;font-weight:800;background:#eceef1;color:#616772}.ac-status[data-tone=progress]{background:#e7f0ff;color:#2464a7}.ac-status[data-tone=ready]{background:#fff1ce;color:#936413}.ac-status[data-tone=success]{background:#e6f4ec;color:#277348}.ac-status[data-tone=danger]{background:#fee9e7;color:#a7372d}.ac-order-side{display:grid;grid-template-columns:auto 17px;align-items:center;gap:5px;text-align:right}.ac-order-side b{grid-column:1/3;font-size:14px}.ac-order-side time{font-size:10.5px;color:var(--ml-text2)}
.ac-loyalty-grid{display:grid;grid-template-columns:1fr;gap:10px}.ac-loyalty-card{padding:15px;border-radius:18px;background:var(--ml-surface);border:1px solid var(--ml-line)}.ac-loyalty-card[data-expanded=true]{border-color:color-mix(in srgb,var(--ml-accent) 28%,var(--ml-line))}.ac-loyalty-top{display:flex;align-items:center;gap:10px}.ac-venue-mark{width:42px;height:42px;border-radius:13px;font-size:15px}.ac-loyalty-top>div{display:flex;flex-direction:column;gap:2px}.ac-loyalty-top strong{font-size:14px}.ac-loyalty-top span{font-size:10.5px;font-weight:750}.ac-loyalty-values{display:flex;flex-wrap:wrap;gap:16px 24px;margin-top:14px}.ac-loyalty-values div{display:flex;flex-direction:column;gap:2px}.ac-loyalty-values small{font-size:10px;color:var(--ml-text2)}.ac-loyalty-values b{font-size:21px}.ac-loyalty-values em{font-size:12px;color:var(--ml-text2);font-style:normal}.ac-progress{height:6px;background:var(--ml-line);border-radius:99px;overflow:hidden;margin-top:13px}.ac-progress span{display:block;height:100%;border-radius:inherit}.ac-next-tier{display:block;color:var(--ml-text2);font-size:10.5px;margin-top:6px}.ac-loyalty-toggle{width:100%;min-height:44px;margin-top:8px;border:0;border-top:1px solid var(--ml-line);background:transparent;color:var(--ml-accent);display:flex;align-items:center;justify-content:center;gap:7px;font:750 11.5px var(--p-body);cursor:pointer}.ac-loyalty-activity{display:flex;flex-direction:column;border-top:1px solid var(--ml-line)}.ac-activity-row{min-height:58px;display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px;border-bottom:1px solid var(--ml-line)}.ac-activity-row>span{width:32px;height:32px;border-radius:10px;background:#e6f4ec;color:#277348;display:grid;place-items:center}.ac-activity-row[data-direction=redeem]>span,.ac-activity-row[data-direction=reversal]>span{background:#fee9e7;color:#a7372d}.ac-activity-row[data-direction=refund]>span{background:#e7f0ff;color:#2464a7}.ac-activity-row>div{min-width:0;display:flex;flex-direction:column;gap:3px}.ac-activity-row strong{font-size:11.5px}.ac-activity-row small{font-size:9.5px;color:var(--ml-text2)}.ac-activity-row>b{font-size:12.5px}.ac-activity-row[data-direction=redeem]>b,.ac-activity-row[data-direction=reversal]>b{color:#a7372d}.ac-activity-row[data-direction=refund]>b{color:#2464a7}.ac-activity-message{min-height:48px;border:0;background:transparent;color:var(--ml-text2);display:grid;place-items:center;font:650 11px var(--p-body)}button.ac-activity-message{cursor:pointer;color:var(--ml-accent)}.ac-activity-more{min-height:44px;margin-top:7px;border:0;border-radius:12px;background:var(--ml-accent-soft);color:var(--ml-accent);font:750 11.5px var(--p-body);cursor:pointer}
.ac-reward-shortcut{width:100%;min-height:68px;padding:11px 13px;border-radius:17px;border:1px solid color-mix(in srgb,var(--ml-gold) 30%,var(--ml-line));background:var(--ml-gold-soft);color:var(--ml-text);display:flex;align-items:center;gap:11px;text-align:left;font-family:var(--p-body);cursor:pointer}.ac-reward-shortcut>span{width:42px;height:42px;border-radius:13px;background:#fff;color:var(--ml-gold);display:grid;place-items:center}.ac-reward-shortcut>div{flex:1;display:flex;flex-direction:column;gap:3px}.ac-reward-shortcut strong{font-size:13px}.ac-reward-shortcut small{font-size:10.5px;color:var(--ml-text2)}
.ac-favorite-hero{display:flex;align-items:center;gap:12px;padding:16px;border-radius:19px;background:linear-gradient(135deg,color-mix(in srgb,var(--ml-cta) 12%,var(--ml-surface)),var(--ml-surface));border:1px solid color-mix(in srgb,var(--ml-cta) 20%,var(--ml-line))}.ac-favorite-hero>span{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;background:color-mix(in srgb,var(--ml-cta) 14%,var(--ml-surface));color:var(--ml-cta)}.ac-favorite-hero h2{font:800 17px var(--p-display);margin:0 0 3px}.ac-favorite-hero p{font-size:11px;color:var(--ml-text2);margin:0}.ac-favorite-grid{display:grid;gap:9px}.ac-favorite-card{width:100%;min-height:78px;padding:9px 12px 9px 9px;border:1px solid var(--ml-line);border-radius:17px;background:var(--ml-surface);color:var(--ml-text);display:flex;align-items:center;gap:11px;text-align:left;font-family:var(--p-body);cursor:pointer}.ac-favorite-image{width:58px;height:58px;border-radius:14px;overflow:hidden;background:var(--ml-accent-soft);color:var(--ml-accent);display:grid;place-items:center;flex:0 0 auto}.ac-favorite-image-visual{width:100%;height:100%;background-position:center;background-size:cover}.ac-favorite-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.ac-favorite-copy strong{font-size:13px}.ac-favorite-copy small{font-size:10.5px;color:var(--ml-text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ac-favorite-copy b{font-size:12px;color:var(--ml-accent)}
.ac-segmented{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:var(--ml-line);padding:4px;border-radius:14px}.ac-segmented button{height:44px;border:0;border-radius:11px;background:transparent;color:var(--ml-text2);font:750 13px var(--p-body);cursor:pointer}.ac-segmented button[data-active=true]{background:var(--ml-surface);color:var(--ml-accent);box-shadow:0 2px 8px rgba(0,0,0,.07)}.ac-order-group{display:flex;flex-direction:column;gap:10px}.ac-group-title{display:flex;align-items:center;gap:9px;padding:3px 2px}.ac-group-title .ac-venue-mark{width:36px;height:36px;border-radius:11px}.ac-group-title h2{font-size:14px;margin:0}.ac-group-title span{font-size:10.5px;color:var(--ml-text2)}.ac-more{min-height:48px;border-radius:14px;border:1px solid var(--ml-line);background:var(--ml-surface);color:var(--ml-accent);font:750 13px var(--p-body);cursor:pointer}
.ac-detail-hero{display:flex;align-items:center;gap:12px;padding:17px;border-radius:19px;background:var(--ml-surface);border:1px solid var(--ml-line)}.ac-detail-hero>div{flex:1;min-width:0}.ac-detail-hero h2{font:800 18px var(--p-display);margin:5px 0 1px}.ac-detail-hero time{font-size:10.5px;color:var(--ml-text2)}.ac-detail-hero>strong{font-size:17px}.ac-detail-card{padding:17px;border-radius:18px;background:var(--ml-surface);border:1px solid var(--ml-line)}.ac-detail-card h3{font-size:13px;margin:0 0 10px}.ac-line{display:grid;grid-template-columns:28px 1fr auto;gap:10px;padding:12px 0;border-bottom:1px solid var(--ml-line)}.ac-line>span{width:28px;height:28px;border-radius:9px;background:var(--ml-accent-soft);color:var(--ml-accent);display:grid;place-items:center;font-size:11px;font-weight:800}.ac-line>div{display:flex;flex-direction:column;gap:3px;min-width:0}.ac-line strong,.ac-line>b{font-size:12.5px}.ac-line small{font-size:10.5px;color:var(--ml-text2)}.ac-line em{font-size:10.5px;color:var(--ml-accent);font-style:normal}.ac-saving,.ac-total{display:flex;justify-content:space-between;padding-top:13px;font-size:12px}.ac-saving{color:#277348}.ac-total{font-size:15px}.ac-detail-meta{display:flex;flex-direction:column;gap:13px}.ac-detail-meta>div{display:flex;align-items:flex-start;gap:10px;color:var(--ml-accent)}.ac-detail-meta span{display:flex;flex-direction:column;gap:2px;color:var(--ml-text)}.ac-detail-meta small{font-size:9.5px;color:var(--ml-text2)}.ac-detail-meta strong{font-size:11.5px}
.ac-reorder-button{width:100%;min-height:72px;padding:11px 14px;border:1px solid color-mix(in srgb,var(--ml-accent) 28%,var(--ml-line));border-radius:18px;background:var(--ml-accent-soft);color:var(--ml-accent);display:flex;align-items:center;gap:11px;text-align:left;font-family:var(--p-body);cursor:pointer}.ac-reorder-button>span{flex:1;display:flex;flex-direction:column;gap:3px}.ac-reorder-button strong{font-size:13px}.ac-reorder-button small{font-size:10.5px;color:var(--ml-text2)}.ac-inline-error{min-height:48px;padding:9px 12px;border-radius:13px;background:#fee9e7;color:#a7372d;display:flex;align-items:center;gap:8px;font-size:11px}.ac-inline-error button{margin-left:auto;min-height:36px;border:0;background:transparent;color:inherit;font-weight:800}.ac-reorder-preview{padding:16px;border-radius:20px;background:var(--ml-surface);border:1px solid color-mix(in srgb,var(--ml-accent) 28%,var(--ml-line));display:flex;flex-direction:column;gap:13px}.ac-reorder-title{display:flex;align-items:center;gap:10px}.ac-reorder-title>span{width:42px;height:42px;border-radius:13px;background:var(--ml-accent-soft);color:var(--ml-accent);display:grid;place-items:center}.ac-reorder-title h3{font:800 15px var(--p-display);margin:0}.ac-reorder-title p{font-size:10.5px;color:var(--ml-text2);margin:2px 0 0}.ac-reorder-summary{min-height:64px;padding:10px 13px;border-radius:14px;background:var(--ml-bg);display:grid;grid-template-columns:1fr 24px 1fr;align-items:center;gap:7px;color:var(--ml-text2)}.ac-reorder-summary>span{display:flex;flex-direction:column;gap:3px}.ac-reorder-summary>span:last-child{text-align:right}.ac-reorder-summary small{font-size:9.5px}.ac-reorder-summary b{font-size:14px;color:var(--ml-text)}.ac-reorder-lines{display:flex;flex-direction:column}.ac-reorder-lines article{display:grid;grid-template-columns:32px 1fr auto;gap:9px;padding:11px 0;border-bottom:1px solid var(--ml-line);align-items:start}.ac-reorder-state{width:30px;height:30px;border-radius:10px;background:#e6f4ec;color:#277348;display:grid;place-items:center}.ac-reorder-lines article[data-state=changed] .ac-reorder-state{background:#fff1ce;color:#936413}.ac-reorder-lines article[data-state=unavailable] .ac-reorder-state{background:#fee9e7;color:#a7372d}.ac-reorder-lines article>div{display:flex;flex-direction:column;gap:3px}.ac-reorder-lines strong,.ac-reorder-lines article>b{font-size:11.5px}.ac-reorder-lines small{font-size:9.5px;color:var(--ml-text2)}.ac-reorder-note{display:flex;align-items:center;gap:7px;color:#936413;font-size:10.5px;margin:0}.ac-reorder-apply{min-height:50px;border:0;border-radius:14px;background:var(--ml-accent);color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;font:800 12.5px var(--p-body);cursor:pointer}.ac-reorder-apply:disabled{opacity:.5;cursor:not-allowed}
.ac-profile-hero{text-align:center;padding:18px}.ac-avatar-large{width:72px;height:72px;border-radius:23px;margin:0 auto;background:linear-gradient(135deg,var(--ml-accent),var(--ml-accent2));font-size:21px}.ac-profile-hero h2{font:800 21px var(--p-display);margin:10px 0 3px}.ac-profile-hero p{font-size:11.5px;color:var(--ml-text2);margin:0}.ac-profile-card,.ac-session-card,.ac-privacy-card{padding:16px;border-radius:18px;background:var(--ml-surface);border:1px solid var(--ml-line)}.ac-profile-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:3px}.ac-profile-title h3,.ac-session-card h3{font-size:13px;margin:0}.ac-profile-title button{min-height:44px;border:0;background:transparent;color:var(--ml-accent);font:750 12px var(--p-body);cursor:pointer}.ac-profile-row{min-height:64px;display:flex;align-items:center;gap:11px;border-top:1px solid var(--ml-line)}.ac-profile-row>span{width:36px;height:36px;border-radius:11px;background:var(--ml-accent-soft);color:var(--ml-accent);display:grid;place-items:center}.ac-profile-row>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.ac-profile-row small{font-size:9.5px;color:var(--ml-text2)}.ac-profile-row strong{font-size:12.5px;overflow:hidden;text-overflow:ellipsis}.ac-profile-row em{display:flex;align-items:center;gap:3px;color:#277348;font-size:9.5px;font-style:normal;font-weight:750}.ac-profile-row[data-muted=true]{opacity:.65}.ac-name-editor{padding-top:12px;border-top:1px solid var(--ml-line)}.ac-name-editor label{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:750}.ac-name-editor input{height:48px;border-radius:13px;border:1.5px solid var(--ml-line);padding:0 13px;background:var(--ml-bg);color:var(--ml-text);font:500 14px var(--p-body);outline:none}.ac-name-editor input:focus{border-color:var(--ml-accent);box-shadow:0 0 0 3px var(--ml-accent-soft)}.ac-name-editor>div{display:flex;justify-content:flex-end;gap:8px;margin-top:9px}.ac-name-editor button{min-height:44px;padding:0 15px;border-radius:12px;border:1px solid var(--ml-line);background:transparent;color:var(--ml-text);font:700 12px var(--p-body)}.ac-name-editor .ac-primary-small{border:0;background:var(--ml-accent);color:#fff}.ac-name-editor p{font-size:11px;color:#a7372d}.ac-success{min-height:48px;border-radius:14px;background:#e6f4ec;color:#277348;display:flex;align-items:center;gap:8px;padding:0 14px;font-size:12px;font-weight:700}.ac-session-card p{font-size:11.5px;color:var(--ml-text2)}.ac-session-card button{width:100%;min-height:48px;border-radius:13px;border:0;background:var(--ml-accent-soft);color:var(--ml-accent);display:flex;align-items:center;justify-content:center;gap:8px;font:750 12.5px var(--p-body);margin-top:9px;cursor:pointer}.ac-session-card .ac-danger-link{background:transparent;color:#a7372d;border:1px solid color-mix(in srgb,#a7372d 25%,var(--ml-line))}.ac-privacy-card{display:flex;flex-direction:column;gap:14px}.ac-privacy-heading{display:flex;align-items:flex-start;gap:10px}.ac-privacy-heading>span{width:40px;height:40px;border-radius:12px;background:var(--ml-accent-soft);color:var(--ml-accent);display:grid;place-items:center;flex:0 0 auto}.ac-privacy-heading h3{font-size:13.5px;margin:1px 0 3px}.ac-privacy-heading p,.ac-privacy-copy{font-size:10.5px;line-height:1.45;color:var(--ml-text2);margin:0}.ac-consent-group{display:flex;flex-direction:column;border-top:1px solid var(--ml-line)}.ac-consent-group>strong{font-size:11px;padding:12px 0 6px}.ac-consent-row{min-height:66px;display:grid;grid-template-columns:44px minmax(0,1fr);align-items:center;gap:8px;border-bottom:1px solid var(--ml-line);cursor:pointer}.ac-consent-row input{appearance:none;width:24px;height:24px;margin:0 10px;border:1.5px solid var(--ml-line);border-radius:8px;background:var(--ml-bg);display:grid;place-items:center;cursor:pointer}.ac-consent-row input:checked{background:var(--ml-accent);border-color:var(--ml-accent)}.ac-consent-row input:checked:after{content:'✓';color:#fff;font-size:15px;font-weight:900}.ac-consent-row input:focus-visible{outline:3px solid var(--ml-accent-soft);outline-offset:2px}.ac-consent-row input:disabled{opacity:.55;cursor:wait}.ac-consent-row>span{display:flex;flex-direction:column;gap:3px}.ac-consent-row b{font-size:11.5px}.ac-consent-row small{font-size:9.5px;line-height:1.45;color:var(--ml-text2)}.ac-data-actions{display:flex;flex-direction:column;gap:8px}.ac-data-actions>button{width:100%;min-height:48px;border:0;border-radius:13px;background:var(--ml-accent-soft);color:var(--ml-accent);display:flex;align-items:center;justify-content:center;gap:8px;font:750 12px var(--p-body);cursor:pointer}.ac-data-actions>button:disabled{opacity:.55;cursor:wait}.ac-data-actions>.ac-delete-button{background:transparent;color:#a7372d;border:1px solid color-mix(in srgb,#a7372d 25%,var(--ml-line))}.ac-delete-confirm{padding:13px;border-radius:14px;background:#fff8f7;border:1px solid color-mix(in srgb,#a7372d 22%,var(--ml-line));display:flex;flex-direction:column;gap:10px}.ac-delete-confirm p{font-size:10.5px;line-height:1.5;color:#74443f;margin:0}.ac-delete-confirm label{display:flex;flex-direction:column;gap:6px;font-size:10.5px;color:#74443f}.ac-delete-confirm input{height:46px;border:1px solid #dbc4c1;border-radius:11px;background:#fff;padding:0 12px;font:650 12px var(--p-body);outline:none}.ac-delete-confirm input:focus{border-color:#a7372d;box-shadow:0 0 0 3px rgba(167,55,45,.1)}.ac-delete-confirm>div{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ac-delete-confirm button{min-height:44px;border-radius:11px;border:1px solid #dbc4c1;background:#fff;color:#74443f;font:750 11.5px var(--p-body)}.ac-delete-confirm .ac-delete-submit{border:0;background:#a7372d;color:#fff}.ac-delete-confirm .ac-delete-submit:disabled{opacity:.45}.ac-delete-status{min-height:58px;padding:10px 12px;border-radius:13px;background:#fff1ce;color:#936413;display:flex;align-items:center;gap:10px}.ac-delete-status span{display:flex;flex-direction:column;gap:3px}.ac-delete-status b{font-size:11.5px}.ac-delete-status small{font-size:9.5px;line-height:1.4}.ac-privacy-message{min-height:44px;border-radius:12px;background:#e6f4ec;color:#277348;display:flex;align-items:center;padding:9px 12px;font-size:11px;font-weight:700}
.ac-loading,.ac-empty{min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:9px;color:var(--ml-text2)}.ac-loading span{font-size:12.5px}.ac-spin{animation:ac-spin .8s linear infinite}.ac-empty>span{width:52px;height:52px;border-radius:16px;background:var(--ml-accent-soft);color:var(--ml-accent);display:grid;place-items:center}.ac-empty h2{font-size:14px;color:var(--ml-text);margin:3px 0 0}.ac-empty p{font-size:11.5px;line-height:1.5;max-width:260px;margin:0}.ac-empty button{min-height:44px;border:0;border-radius:12px;padding:0 15px;background:var(--ml-accent);color:#fff;font:750 12px var(--p-body)}.ac-skeleton{display:grid;gap:9px}.ac-skeleton span{height:88px;border-radius:17px;background:linear-gradient(100deg,var(--ml-line),var(--ml-surface),var(--ml-line));background-size:200% 100%;animation:ac-shimmer 1.4s linear infinite}
@keyframes ac-spin{to{transform:rotate(360deg)}}@keyframes ac-shimmer{to{background-position:-200% 0}}
@media(min-width:700px){.ac-content{padding:22px 24px 28px}.ac-loyalty-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ac-loyalty-card[data-expanded=true]{grid-column:1/-1}.ac-order-strip,.ac-favorite-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.ac-tab{font-size:12.5px;gap:7px}}
@media(prefers-reduced-motion:reduce){.ac-spin,.ac-skeleton span{animation:none!important}.ac-root *{scroll-behavior:auto!important;transition-duration:.01ms!important}}
`

const PREVIEW_ACCOUNT: CustomerAccountView = {
  profile: {
    name: 'Deniz Yılmaz',
    email: { value: 'deniz@ornek.com', verified: true },
    phone: { value: '+90 532 555 24 18', verified: true },
    memberSince: '2025-11-14T10:20:00.000Z',
  },
  loyalty: [
    { restaurant: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', slug: 'test-cafe-b', name: 'Test Cafe B', logoUrl: null }, points: 1280, stamps: 7, stampGoal: 10, pointsEnabled: true, stampsEnabled: true, tier: { name: 'Altın', color: '#c8922a' }, nextTier: { name: 'Platin', minimumPoints: 2500 }, tierProgress: 34, lifetimePoints: 1780 },
    { restaurant: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', slug: 'mahalle-firin', name: 'Mahalle Fırın', logoUrl: null }, points: 340, stamps: 4, stampGoal: 8, pointsEnabled: true, stampsEnabled: true, tier: { name: 'Gümüş', color: '#7f8995' }, nextTier: { name: 'Altın', minimumPoints: 1000 }, tierProgress: 48, lifetimePoints: 560 },
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
