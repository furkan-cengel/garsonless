'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { I, S, Tag } from '../../lib/ui'
import { SHELL_OVERLAY_IDS, useShell } from '../../lib/shell-context'
import { logoutCurrentBrowser } from '../../lib/client-logout'
import UnsavedChangesDialog from './UnsavedChangesDialog'
import ProfileAvatar from './ProfileAvatar'
import type { RestaurantSwitcherItem } from '../layout/restaurant-shell-model'

const GRADIENTS = [
  'linear-gradient(135deg, #ffd089 0%, #ff8b6b 100%)',
  'linear-gradient(135deg, #a4f7c8 0%, #4caf7f 100%)',
  'linear-gradient(135deg, #c4d0ff 0%, #6e87e5 100%)',
  'linear-gradient(135deg, #f5dcea 0%, #d97757 100%)',
]

const PROFILE_MENU_CSS = `
.dashboard-profile-backdrop { position:fixed;inset:0;z-index:100; }
.dashboard-profile-menu {
  position:absolute;left:56px;bottom:16px;width:300px;max-height:calc(100dvh - 32px);
  overflow-y:auto;overscroll-behavior:contain;background:var(--surface);
  border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-pop);outline:0;
}
.dashboard-profile-item {
  min-height:44px;display:flex;align-items:center;gap:10px;width:100%;padding:6px 10px;
  border:0;border-radius:7px;background:transparent;color:var(--text);text-align:left;cursor:pointer;
}
.dashboard-profile-item:hover:not(:disabled) { background:var(--surface-3); }
.dashboard-profile-item:focus-visible { outline:2px solid var(--action);outline-offset:-2px; }
.dashboard-profile-item:disabled { cursor:wait;opacity:.62; }
@media (max-width:760px) {
  .dashboard-profile-backdrop { display:flex;align-items:flex-end;background:rgba(17,17,19,.32);backdrop-filter:blur(2px); }
  .dashboard-profile-menu {
    position:relative;left:auto;bottom:auto;width:100%;max-height:min(86dvh,720px);
    padding-bottom:env(safe-area-inset-bottom);border-radius:16px 16px 0 0;
  }
}
@media (prefers-reduced-motion:reduce) { .dashboard-profile-item { transition:none!important; } }
`

interface Props {
  userEmail: string
  displayName: string
  userInitials: string
  avatarUrl: string | null
  planLabel: string
  unreadCount: number
  restaurants: RestaurantSwitcherItem[]
  currentRestaurantId: string
  onOpenNotifications: () => void
  onOpenStoreSwitcher: () => void
  onClose: () => void
}

function menuItems(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'))
    .filter((item) => item.getClientRects().length > 0)
}

export default function ProfileMenu({
  userEmail,
  displayName,
  userInitials,
  avatarUrl,
  planLabel,
  unreadCount,
  restaurants,
  currentRestaurantId,
  onOpenNotifications,
  onOpenStoreSwitcher,
  onClose,
}: Props) {
  const router = useRouter()
  const { beginNavigation, getNavigationGuard } = useShell()
  const menuRef = useRef<HTMLDivElement>(null)
  const logoutLockRef = useRef(false)
  const storeAttemptedRef = useRef(false)
  const [storePending, startStoreTransition] = useTransition()
  const [pendingRestaurantId, setPendingRestaurantId] = useState<string | null>(null)
  const [storeError, setStoreError] = useState('')
  const [logoutPending, setLogoutPending] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [logoutGuardMessage, setLogoutGuardMessage] = useState<string | null>(null)

  useEffect(() => {
    if (logoutGuardMessage) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const menu = menuRef.current
    if (!menu) return
    const frame = window.requestAnimationFrame(() => {
      const initial = menu.querySelector<HTMLElement>('[data-menu-initial-focus]') ?? menuItems(menu)[0] ?? menu
      initial.focus()
    })
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'Tab') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [logoutGuardMessage, onClose])

  useEffect(() => {
    if (!pendingRestaurantId) return
    if (currentRestaurantId === pendingRestaurantId) {
      setPendingRestaurantId(null)
      setStoreError('')
      onClose()
      return
    }
    if (storeAttemptedRef.current && !storePending) {
      storeAttemptedRef.current = false
      setStoreError('Mağaza açılamadı. Bağlantını kontrol edip tekrar dene.')
    }
  }, [currentRestaurantId, onClose, pendingRestaurantId, storePending])

  function navigate(href: string) {
    beginNavigation(href)
    router.push(href)
    onClose()
  }

  function handleStoreSelect(id: string) {
    if (id === currentRestaurantId) {
      onClose()
      return
    }
    setStoreError('')
    setPendingRestaurantId(id)
    storeAttemptedRef.current = true
    startStoreTransition(() => {
      const href = `/dashboard/${id}`
      beginNavigation(href)
      router.push(href)
    })
  }

  async function performLogout() {
    if (logoutLockRef.current) return
    logoutLockRef.current = true
    setLogoutPending(true)
    setLogoutError('')
    const result = await logoutCurrentBrowser()
    if ('error' in result) {
      logoutLockRef.current = false
      setLogoutPending(false)
      setLogoutError(result.error)
      return
    }
    window.location.replace('/auth/login')
  }

  function requestLogout() {
    const guardMessage = getNavigationGuard()
    if (guardMessage) {
      setLogoutGuardMessage(guardMessage)
      return
    }
    void performLogout()
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const items = menuItems(event.currentTarget)
    if (items.length === 0) return
    event.preventDefault()
    const currentIndex = items.indexOf(document.activeElement as HTMLElement)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
          ? (currentIndex + 1 + items.length) % items.length
          : (currentIndex - 1 + items.length) % items.length
    items[nextIndex]?.focus()
  }

  if (logoutGuardMessage) {
    return (
      <UnsavedChangesDialog
        description={logoutGuardMessage}
        discardLabel="Değişiklikleri sil ve çıkış yap"
        onKeepEditing={() => setLogoutGuardMessage(null)}
        onDiscard={() => {
          setLogoutGuardMessage(null)
          void performLogout()
        }}
      />
    )
  }

  return (
    <div
      className="dashboard-profile-backdrop"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !logoutPending) onClose() }}
    >
      <style>{PROFILE_MENU_CSS}</style>
      <div
        ref={menuRef}
        id={SHELL_OVERLAY_IDS.profile}
        role="menu"
        aria-labelledby="dashboard-profile-name"
        aria-busy={logoutPending || storePending}
        className="dashboard-profile-menu"
        tabIndex={-1}
        onKeyDown={handleMenuKeyDown}
      >
        <div role="presentation" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--divider)' }}>
          <ProfileAvatar displayName={displayName} initials={userInitials} avatarUrl={avatarUrl} size={40} fontSize={14} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="dashboard-profile-name" style={{ fontSize: 13.5, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div style={{ marginTop: 1, fontSize: 11.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
          </div>
          <Tag tone="positive">{planLabel}</Tag>
        </div>

        {restaurants.length > 0 && (
          <div role="presentation" style={{ padding: '8px 6px 4px' }}>
            <div style={{ ...S.label, padding: '4px 10px' }}>Mağaza</div>
            {restaurants.slice(0, 3).map((restaurant, index) => {
              const active = restaurant.id === currentRestaurantId
              const pending = restaurant.id === pendingRestaurantId && storePending
              return (
                <button
                  key={restaurant.id}
                  type="button"
                  role="menuitem"
                  data-menu-initial-focus={active ? '' : undefined}
                  aria-current={active ? 'page' : undefined}
                  disabled={storePending || logoutPending}
                  className="dashboard-profile-item"
                  onClick={() => handleStoreSelect(restaurant.id)}
                  style={{ background: active ? 'var(--surface-inset)' : undefined }}
                >
                  <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: GRADIENTS[index % GRADIENTS.length], color: '#fff', fontWeight: 700, fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {restaurant.name.slice(0, 1).toLocaleUpperCase('tr-TR')}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: active ? 650 : 500 }}>{restaurant.name}</span>
                  {pending ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Açılıyor…</span> : active ? <span aria-hidden="true" style={{ color: 'var(--positive)', display: 'inline-flex' }}><I.check size={14} /></span> : null}
                </button>
              )
            })}
            {restaurants.length > 3 && (
              <button type="button" role="menuitem" className="dashboard-profile-item" disabled={storePending || logoutPending} onClick={onOpenStoreSwitcher}>
                <span aria-hidden="true" style={{ width: 28, display: 'inline-flex', justifyContent: 'center', color: 'var(--text-2)' }}><I.cutlery size={15} /></span>
                <span style={{ flex: 1, fontSize: 12.5 }}>Tüm mağazalar</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{restaurants.length}</span>
              </button>
            )}
            {storeError && (
              <div role="alert" style={{ margin: '5px 6px', padding: '8px 10px', borderRadius: 7, background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 11.5 }}>
                {storeError}
                {pendingRestaurantId && <button type="button" onClick={() => handleStoreSelect(pendingRestaurantId)} style={{ display: 'block', minHeight: 36, marginTop: 4, padding: 0, border: 0, background: 'transparent', color: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Tekrar dene</button>}
              </div>
            )}
          </div>
        )}

        <div role="separator" style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />

        <div role="presentation" style={{ padding: '4px 6px' }}>
          <button type="button" role="menuitem" className="dashboard-profile-item" disabled={storePending || logoutPending} onClick={() => navigate(`/dashboard/${currentRestaurantId}/settings?section=profile`)}>
            <span aria-hidden="true" style={{ color: 'var(--text-2)', display: 'inline-flex' }}><I.gear size={15} /></span><span style={{ flex: 1, fontSize: 12.5 }}>Hesap ayarları</span>
          </button>
          <button type="button" role="menuitem" className="dashboard-profile-item" disabled={storePending || logoutPending} onClick={() => navigate(`/dashboard/${currentRestaurantId}/settings?section=security`)}>
            <span aria-hidden="true" style={{ color: 'var(--text-2)', display: 'inline-flex' }}><I.history size={15} /></span><span style={{ flex: 1, fontSize: 12.5 }}>Etkinlik geçmişi</span>
          </button>
          <button type="button" role="menuitem" className="dashboard-profile-item" disabled={storePending || logoutPending} aria-label={unreadCount > 0 ? `Bildirimler, ${unreadCount} okunmamış` : 'Bildirimler'} onClick={onOpenNotifications}>
            <span aria-hidden="true" style={{ color: 'var(--text-2)', display: 'inline-flex' }}><I.bell size={15} /></span><span style={{ flex: 1, fontSize: 12.5 }}>Bildirimler</span>{unreadCount > 0 && <Tag tone="critical">{unreadCount > 99 ? '99+' : unreadCount}</Tag>}
          </button>
          <button type="button" role="menuitem" className="dashboard-profile-item" disabled={storePending || logoutPending} onClick={() => navigate(`/dashboard/${currentRestaurantId}/settings?section=languages`)}>
            <span aria-hidden="true" style={{ color: 'var(--text-2)', display: 'inline-flex' }}><I.globe size={15} /></span><span style={{ flex: 1, fontSize: 12.5 }}>Dil &amp; Bölge</span>
          </button>
        </div>

        <div role="separator" style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />

        <div role="presentation" style={{ padding: '6px 6px 10px' }}>
          {logoutError && <div role="alert" style={{ margin: '0 4px 6px', padding: '8px 10px', borderRadius: 7, background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 11.5 }}>{logoutError}</div>}
          <button
            type="button"
            role="menuitem"
            disabled={logoutPending || storePending}
            className="dashboard-profile-item"
            onClick={requestLogout}
            style={{ color: 'var(--critical)', fontWeight: 600 }}
          >
            <I.logout size={15} />
            {logoutPending ? 'Çıkış yapılıyor…' : 'Çıkış yap'}
          </button>
        </div>
      </div>
    </div>
  )
}
