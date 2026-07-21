'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { I, Tag } from '../../lib/ui'
import { getNotifications, type NotificationItem } from '../../lib/actions/notifications'
import { resolveServiceRequest } from '../../lib/actions/service-requests'

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

export default function NotificationsPanel({ restaurantId, browserNotificationsEnabled, onClose }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ message: string; publicCode?: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await getNotifications(restaurantId)
    if (Array.isArray(result)) {
      setItems(result)
    } else {
      setError({ message: result.error, publicCode: result.publicCode })
    }
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { void load() }, [load])

  const handleResolve = useCallback(async (item: NotificationItem) => {
    if (!item.requestId) return
    setItems((prev) => prev.filter((n) => n.id !== item.id)) // optimistic
    const result = await resolveServiceRequest(item.requestId, restaurantId)
    if ('error' in result) {
      setItems((prev) => prev.some((entry) => entry.id === item.id) ? prev : [item, ...prev])
      setError({ message: 'Çağrı kapatılamadı. Lütfen tekrar deneyin.' })
      return
    }
    void load()
  }, [restaurantId, load])

  const goToOrders = useCallback(() => {
    onClose()
    router.push(`/dashboard/${restaurantId}/orders`)
  }, [onClose, router, restaurantId])

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(17,17,19,.2)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', right: 16, top: 56,
          width: 400, maxHeight: '80vh',
          background: 'var(--surface)', borderRadius: 12,
          boxShadow: 'var(--shadow-pop)', border: '1px solid var(--border)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--divider)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Bildirimler</span>
          {items.length > 0 && <Tag tone="critical">{items.length}</Tag>}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-3)' }}>
              Yükleniyor…
            </div>
          ) : error ? (
            <div role="alert" style={{ padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ color: 'var(--critical)', marginBottom: 8, display: 'inline-flex' }}><I.warn size={25} /></div>
              <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--text)' }}>Bildirimler yüklenemedi</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>{error.message}</div>
              {error.publicCode && <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 5 }}>Hata kodu: {error.publicCode}</div>}
              <button type="button" onClick={() => void load()} style={{ marginTop: 14, ...btnRetry }}>Tekrar dene</button>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-4)', marginBottom: 8, display: 'inline-flex' }}><I.bell size={26} /></div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Yeni bildirim yok</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 3 }}>
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
                    <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>{n.subtitle}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 4 }}>{relativeTime(n.createdAt)}</div>
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
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 16px', borderTop: '1px solid var(--divider)',
          background: 'var(--surface-2)', textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {!browserNotificationsEnabled && (
              <span title="İşletim sistemi bildirimleri Starter paketinde açılır" style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
                Masaüstü bildirimi · Starter
              </span>
            )}
            <button
              type="button"
              onClick={goToOrders}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: 'var(--text)',
              }}
            >
              Tümünü gör →
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
