'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { I, Tag } from '../../lib/ui'
import { LoadingStatus } from '@garsonless/ui/spinners'
import {
  getInboxFeed,
  getNotifications,
  markInboxRead,
  type InboxNotificationItem,
  type NotificationItem,
} from '../../lib/actions/notifications'
import { resolveServiceRequest } from '../../lib/actions/service-requests'
import { useShell } from '../../lib/shell-context'
import { loadNotificationFeeds } from './notification-feed-loader'
import { useModalDialogFocus } from './use-modal-dialog-focus'

interface Props {
  restaurantId: string
  browserNotificationsEnabled: boolean
  onClose: () => void
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'şimdi'
  if (mins < 60) return `${mins} dk önce`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} saat önce`
  return `${Math.floor(hrs / 24)} gün önce`
}

const ICON_META = {
  waiter: { bg: 'rgba(255,159,64,.16)', fg: '#b8690f', Icon: I.bell },
  order: { bg: 'var(--info-bg)', fg: 'var(--info)', Icon: I.clipboard },
} as const

const NOTIFICATIONS_CSS = `
.dashboard-notifications-overlay {
  position:fixed;inset:0;z-index:95;
  background:rgba(17,17,19,.2);
}
.dashboard-notifications-panel {
  position:absolute;right:16px;top:56px;
  width:min(400px,calc(100vw - 32px));max-height:min(80dvh,760px);min-height:0;
  display:flex;flex-direction:column;overflow:hidden;
  background:var(--surface);border:1px solid var(--border);border-radius:12px;
  box-shadow:var(--shadow-pop);
}
.dashboard-notifications-header {
  flex:0 0 auto;min-width:0;padding:12px 16px;
  display:flex;align-items:center;gap:8px;
  border-bottom:1px solid var(--divider);
}
.dashboard-notifications-title {
  flex:1;min-width:0;font-size:14px;font-weight:600;
}
.dashboard-notifications-mark-all {
  min-height:36px;padding:0 4px;white-space:nowrap;
  border:0;border-radius:7px;background:transparent;
  color:var(--text-3);font-size:11px;font-weight:600;cursor:pointer;
}
.dashboard-notifications-mark-all:hover { background:var(--surface-inset);color:var(--text); }
.dashboard-notifications-close {
  width:36px;height:36px;flex:0 0 auto;margin:-8px -8px -8px 0;padding:0;
  display:inline-flex;align-items:center;justify-content:center;
  border:0;border-radius:8px;background:transparent;color:var(--text-2);cursor:pointer;
}
.dashboard-notifications-close:hover { background:var(--surface-inset);color:var(--text); }
.dashboard-notifications-mark-all:focus-visible,
.dashboard-notifications-close:focus-visible {
  outline:2px solid var(--focus-ring,var(--text));outline-offset:1px;
}
.dashboard-notifications-list {
  flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;
  overscroll-behavior-y:contain;scrollbar-gutter:stable;
}
.dashboard-notification-copy { overflow-wrap:anywhere; }
.dashboard-notifications-footer {
  flex:0 0 auto;padding:10px 16px;
  border-top:1px solid var(--divider);background:var(--surface-2);text-align:center;
}
.dashboard-notification-history-row {
  position:relative;
  transition:background-color 140ms ease,box-shadow 140ms ease;
}
.dashboard-notification-history-row[data-interactive="true"]:hover {
  background:var(--surface-inset)!important;
  box-shadow:inset 3px 0 0 var(--action);
}
.dashboard-notification-history-row[data-interactive="true"]:focus-visible {
  background:var(--surface-inset)!important;
  box-shadow:inset 3px 0 0 var(--action);
  outline:2px solid var(--focus-ring,var(--text));outline-offset:-2px;
}
.dashboard-notification-footer-action {
  min-height:36px;padding:0 14px;border-radius:8px;
  display:inline-flex;align-items:center;justify-content:center;gap:5px;
  transition:background-color 140ms ease,box-shadow 140ms ease,transform 140ms ease;
}
.dashboard-notification-footer-action:hover {
  background:var(--surface-inset)!important;
  box-shadow:inset 0 0 0 1px var(--border-strong),0 2px 8px rgba(17,17,19,.08);
  transform:translateY(-1px);
}
.dashboard-notification-footer-arrow { display:inline-flex;transition:transform 140ms ease; }
.dashboard-notification-footer-action:hover .dashboard-notification-footer-arrow { transform:translateX(3px); }
.dashboard-notification-footer-action:active { transform:translateY(0) scale(.98); }
.dashboard-notification-footer-action:focus-visible {
  background:var(--surface-inset)!important;
  outline:2px solid var(--focus-ring,var(--text));outline-offset:1px;
}
@media (max-width:640px) {
  .dashboard-notifications-overlay {
    display:flex;align-items:flex-end;
    padding-top:max(16px,env(safe-area-inset-top));
    background:rgba(17,17,19,.36);
  }
  .dashboard-notifications-panel {
    position:relative;inset:auto;width:100%;max-height:min(84dvh,720px);
    border-right:0;border-bottom:0;border-left:0;border-radius:18px 18px 0 0;
    padding-bottom:env(safe-area-inset-bottom);
    box-shadow:0 -18px 56px rgba(17,17,19,.2);
  }
  .dashboard-notifications-header { padding:12px 16px; }
  .dashboard-notifications-title { font-size:15px;font-weight:700; }
  .dashboard-notifications-mark-all { min-height:44px;padding:0 6px; }
  .dashboard-notifications-close { width:44px;height:44px;margin:-8px -12px -8px 0; }
  .dashboard-notifications-list { scrollbar-gutter:auto; }
  .dashboard-notification-live-row,
  .dashboard-notification-history-row { padding:12px 16px!important; }
  .dashboard-notification-footer-action { min-height:44px; }
  .dashboard-notifications-footer { padding:8px 16px; }
}
@media (max-width:360px) {
  .dashboard-notifications-header { gap:6px; }
  .dashboard-notifications-mark-all { font-size:10.5px; }
}
@media (prefers-reduced-motion:reduce) {
  .dashboard-notification-history-row,
  .dashboard-notification-footer-action,
  .dashboard-notification-footer-arrow { transition:none!important; }
}
`

export default function NotificationsPanel({ restaurantId, browserNotificationsEnabled, onClose }: Props) {
  const { beginNavigation } = useShell()
  const router = useRouter()
  const dialogRef = useModalDialogFocus(onClose)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [inboxItems, setInboxItems] = useState<InboxNotificationItem[]>([])
  const [inboxUnread, setInboxUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ message: string; publicCode?: string } | null>(null)

  const [inboxError, setInboxError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [markingRead, setMarkingRead] = useState(false)
  const requestGeneration = useRef(0)
  const readPending = useRef(false)
  const resolving = useRef(new Set<string>())

  const load = useCallback(async () => {
    if (readPending.current) return
    const generation = ++requestGeneration.current
    const current = () => generation === requestGeneration.current
    setLoading(true)
    setError(null)
    setInboxError(null)
    try {
      await loadNotificationFeeds({
        live: () => getNotifications(restaurantId),
        history: () => getInboxFeed(restaurantId),
        onLive: (result) => { if (current()) setItems(result) },
        onLiveError: (result) => { if (current()) setError({ message: result.error, publicCode: result.publicCode }) },
        onHistory: (inbox) => {
          if (!current()) return
          setInboxItems(inbox.items)
          setInboxUnread(inbox.unread)
        },
        onHistoryError: (result) => { if (current()) setInboxError(result.error) },
      })
    } finally {
      if (current()) setLoading(false)
    }
  }, [restaurantId])

  const markRead = useCallback(async (ids?: string[]) => {
    if (readPending.current) return false
    readPending.current = true
    setMarkingRead(true)
    setActionError(null)
    // Update the local state only after the server acknowledges the command.
    const unreadIds = ids ?? inboxItems.filter((item) => !item.readAt).map((item) => item.id)
    try {
      const result = await markInboxRead(restaurantId, ids)
      if ('error' in result) throw new Error(result.error)
      setInboxItems((prev) => prev.map((entry) => unreadIds.includes(entry.id)
        ? { ...entry, readAt: entry.readAt ?? new Date().toISOString() } : entry))
      setInboxUnread((prev) => ids ? Math.max(0, prev - unreadIds.length) : 0)
      return true
    } catch {
      setActionError('Okundu bilgisi kaydedilemedi. Tekrar deneyin.')
      return false
    } finally {
      readPending.current = false
      setMarkingRead(false)
    }
  }, [inboxItems, restaurantId])

  const handleInboxClick = useCallback(async (item: InboxNotificationItem) => {
    if (loading || readPending.current) return
    const generation = requestGeneration.current
    if (!item.readAt && !await markRead([item.id])) return
    if (generation !== requestGeneration.current) return
    if (item.linkPath) {
      onClose()
      beginNavigation(item.linkPath)
      router.push(item.linkPath)
    }
  }, [beginNavigation, loading, markRead, onClose, router])

  const handleMarkAllRead = useCallback(() => markRead(), [markRead])

  useEffect(() => {
    void load()
    const generation = requestGeneration
    return () => { generation.current++ }
  }, [load])

  const handleResolve = useCallback(async (item: NotificationItem) => {
    if (!item.requestId || resolving.current.has(item.id)) return
    resolving.current.add(item.id)
    setActionError(null)
    setItems((prev) => prev.filter((n) => n.id !== item.id))
    try {
      const result = await resolveServiceRequest(item.requestId, restaurantId)
      if ('error' in result) throw new Error(result.error)
      void load()
    } catch {
      setItems((prev) => prev.some((entry) => entry.id === item.id) ? prev : [item, ...prev])
      setActionError('Çağrı kapatılamadı. Lütfen tekrar deneyin.')
    } finally {
      resolving.current.delete(item.id)
    }
  }, [restaurantId, load])

  const goToOrders = useCallback(() => {
    const href = `/dashboard/${restaurantId}/orders`
    onClose()
    beginNavigation(href)
    router.push(href)
  }, [beginNavigation, onClose, router, restaurantId])

  return (
    <div
      className="dashboard-notifications-overlay"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <style>{NOTIFICATIONS_CSS}</style>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-notifications-title"
        tabIndex={-1}
        className="dashboard-notifications-panel"
      >
        {/* Header */}
        <div className="dashboard-notifications-header">
          <span id="dashboard-notifications-title" className="dashboard-notifications-title">Bildirimler</span>
          {inboxUnread > 0 && (
            <button
              type="button"
              className="dashboard-notifications-mark-all"
              disabled={markingRead || loading}
              onClick={() => void handleMarkAllRead()}
            >
              Tümünü okundu say
            </button>
          )}
          {items.length > 0 && <Tag tone="critical">{items.length}</Tag>}
          <button
            type="button"
            className="dashboard-notifications-close"
            data-dialog-initial-focus
            aria-label="Bildirimleri kapat"
            onClick={onClose}
          >
            <I.x size={17} />
          </button>
        </div>

        {/* List */}
        <div className="dashboard-notifications-list" aria-busy={loading}>
          {actionError && <div role="alert" style={{ padding: 16, color: 'var(--critical)' }}>{actionError}</div>}
          {error && items.length > 0 && <div role="alert" style={{ padding: 16 }}>
            {error.message} · Son alınan bildirimler gösteriliyor.
            <button type="button" style={btnRetry} onClick={() => void load()}>Tekrar dene</button>
          </div>}
          {loading && items.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-3)' }}>
              <LoadingStatus label="Bildirimler yükleniyor…" />
            </div>
          ) : error && items.length === 0 ? (
            <div role="alert" style={{ padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ color: 'var(--critical)', marginBottom: 8, display: 'inline-flex' }}><I.warn size={25} /></div>
              <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--text)' }}>Bildirimler yüklenemedi</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>{error.message}</div>
              {error.publicCode && <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 5 }}>Hata kodu: {error.publicCode}</div>}
              <button type="button" onClick={() => void load()} style={{ marginTop: 14, ...btnRetry }}>Tekrar dene</button>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-3)', marginBottom: 8, display: 'inline-flex' }}><I.bell size={26} /></div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Yeni bildirim yok</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
                Garson çağrıları ve yeni siparişler burada görünür.
              </div>
            </div>
          ) : (
            items.map((n) => {
              const meta = ICON_META[n.type]
              const IconComp = meta.Icon
              return (
                <div
                  key={n.id}
                  className="dashboard-notification-live-row"
                  role={n.type === 'order' ? 'button' : undefined}
                  tabIndex={n.type === 'order' ? 0 : undefined}
                  onKeyDown={n.type === 'order' ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); goToOrders() }
                  } : undefined}
                  onClick={n.type === 'order' ? goToOrders : undefined}
                  style={{
                    padding: '12px 16px', display: 'flex', gap: 10,
                    borderBottom: '1px solid var(--divider)',
                    cursor: n.type === 'order' ? 'pointer' : 'default',
                    alignItems: 'center',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: meta.bg, color: meta.fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <IconComp size={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{n.title}</div>
                    <div className="dashboard-notification-copy" style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>{n.subtitle}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4 }}>{relativeTime(n.createdAt)}</div>
                  </div>
                  {n.type === 'waiter' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleResolve(n) }}
                      style={{
                        flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '5px 10px',
                        border: '1px solid #d98324', borderRadius: 6,
                        background: 'var(--surface)', color: '#b8690f', cursor: 'pointer',
                      }}
                    >Çağrıyı kapat</button>
                  )}
                </div>
              )
            })
          )}

          {/* Durable inbox history (notification_inbox) */}
          {inboxError && <div role="alert" style={{ padding: 16 }}>
            {inboxError}
            <button type="button" disabled={loading} style={btnRetry} onClick={() => void load()}>Geçmişi tekrar yükle</button>
          </div>}
          {inboxItems.length > 0 && (
            <>
              <div style={{
                padding: '8px 16px 6px', fontSize: 10.5, fontWeight: 700,
                letterSpacing: '.06em', textTransform: 'uppercase',
                color: 'var(--text-3)', background: 'var(--surface-2)',
                borderBottom: '1px solid var(--divider)',
              }}>
                Geçmiş
              </div>
              {inboxItems.map((n) => {
                const unread = !n.readAt
                const critical = n.severity === 'critical'
                const interactive = unread || Boolean(n.linkPath)
                return (
                  <div
                    key={n.id}
                    className="dashboard-notification-history-row"
                    data-interactive={interactive}
                    aria-disabled={interactive && markingRead ? true : undefined}
                    role={interactive ? 'button' : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    onClick={interactive ? () => void handleInboxClick(n) : undefined}
                    onKeyDown={interactive ? (event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      void handleInboxClick(n)
                    } : undefined}
                    style={{
                      padding: '10px 16px', display: 'flex', gap: 10,
                      borderBottom: '1px solid var(--divider)',
                      cursor: interactive ? 'pointer' : 'default',
                      alignItems: 'center',
                      background: unread ? 'var(--surface-2)' : 'transparent',
                    }}
                  >
                    <span
                      aria-label={unread ? 'Okunmadı' : undefined}
                      style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: unread ? (critical ? 'var(--critical)' : 'var(--info)') : 'transparent',
                        border: unread ? 'none' : '1px solid var(--border)',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: unread ? 700 : 500, lineHeight: 1.3 }}>{n.title}</div>
                      <div className="dashboard-notification-copy" style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>{n.body}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4 }}>{relativeTime(n.createdAt)}</div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="dashboard-notifications-footer">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {!browserNotificationsEnabled && (
              <span title="İşletim sistemi bildirimleri Starter paketinde açılır" style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                Masaüstü bildirimi · Starter
              </span>
            )}
            <button
              type="button"
              className="dashboard-notification-footer-action"
              onClick={goToOrders}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: 'var(--text)',
              }}
            >
              Tümünü gör <span className="dashboard-notification-footer-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const btnRetry = {
  height: 30,
  padding: '0 12px',
  borderRadius: 7,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
} as const
