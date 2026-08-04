'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { readOrderLineSnapshots, type PaymentMethod } from '@garsonless/db/browser'
import { getOrderHistory, type HistoryOrder } from '../../lib/actions/orders'
import { I, S, Tag, IconButton, btnGhost } from '../../lib/ui'
import { formatCurrency } from '../../lib/utils'
import { paymentMethodBadge } from '../../lib/payment-method'
import { LoadingStatus } from '@garsonless/ui/spinners'
import { AccessibleDialog } from '../tables/AccessibleDialog'

type Tab = 'all' | 'done' | 'cancelled'

function dayLabel(iso: string): string {
  const d = new Date(iso); d.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return 'Bugün'
  if (diff === 1) return 'Dün'
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' })
}

export default function HistoryModal({ restaurantId, tableLabels, onClose, onReceipt }: {
  restaurantId: string
  tableLabels: Record<string, string>
  onClose: () => void
  onReceipt: (order: HistoryOrder, tableLabel: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<HistoryOrder[]>([])
  const [truncated, setTruncated] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void getOrderHistory(restaurantId).then((res) => {
      if (cancelled) return
      if ('error' in res) setError(res.error)
      else { setOrders(res.orders); setTruncated(res.truncated) }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [restaurantId])

  const counts = useMemo(() => ({
    all: orders.length,
    done: orders.filter(o => o.status === 'served').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }), [orders])

  const ql = q.trim().toLowerCase()
  const rows = orders.filter(o => {
    if (tab === 'done' && o.status !== 'served') return false
    if (tab === 'cancelled' && o.status !== 'cancelled') return false
    if (ql) {
      const label = (tableLabels[o.table_id ?? ''] ?? '').toLowerCase()
      if (!o.id.toLowerCase().startsWith(ql) && !label.includes(ql)) return false
    }
    return true
  })
  const groups = rows.reduce<Record<string, HistoryOrder[]>>((acc, o) => {
    const k = dayLabel(o.created_at);(acc[k] ||= []).push(o); return acc
  }, {})

  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: 'all', label: 'Tümü', n: counts.all },
    { id: 'done', label: 'Tamamlanan', n: counts.done },
    { id: 'cancelled', label: 'İptal', n: counts.cancelled },
  ]

  return (
    <AccessibleDialog labelledBy="order-history-title" onClose={onClose} className="order-history-overlay" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(17,17,19,.42)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{`
        .order-history-dialog button, .order-history-dialog input { min-height: 44px; }
        @media (max-width: 600px) {
          .order-history-overlay { padding: 0 !important; }
          .order-history-dialog { height: 100dvh !important; max-width: none !important; border-radius: 0 !important; }
          .order-history-toolbar { align-items: stretch !important; flex-direction: column; }
          .order-history-tabs { width: 100%; }
          .order-history-tabs > button { flex: 1; padding-inline: 6px !important; }
        }
      `}</style>
      <div className="order-history-dialog" aria-busy={loading} style={{ width: '100%', maxWidth: 620, height: '84vh', background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--shadow-pop)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '15px 20px 13px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div id="order-history-title" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em' }}>Geçmiş siparişler</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>Son 30 günün tamamlanan ve iptal edilen siparişleri</div>
          </div>
          <IconButton icon={<I.close size={15} />} ariaLabel="Geçmiş siparişleri kapat" onClick={onClose} />
        </div>

        {/* Search + tabs */}
        <div className="order-history-toolbar" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--divider)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minHeight: 44, padding: '0 11px', background: 'var(--surface-3)', borderRadius: 8, color: 'var(--text-3)' }}>
            <I.search size={13} />
            <input ref={searchRef} data-modal-initial-focus aria-label="Geçmiş siparişlerde ara" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sipariş #, masa..." style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--text)' }} />
          </div>
          <div className="order-history-tabs" role="group" aria-label="Geçmiş sipariş durumu" style={{ display: 'flex', gap: 4, background: 'var(--surface-3)', borderRadius: 8, padding: 3 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '5px 11px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: tab === t.id ? 'var(--surface)' : 'transparent',
                color: tab === t.id ? 'var(--text)' : 'var(--text-3)',
                boxShadow: tab === t.id ? 'var(--shadow-1)' : 'none',
              }}>{t.label}{t.n > 0 && <span style={{ ...S.mono, opacity: .6, marginLeft: 4 }}>{t.n}</span>}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 20px 20px' }}>
          {truncated && !loading && !error && (
            <div role="status" style={{ margin: '8px 0', padding: '9px 11px', borderRadius: 8, background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 11.5, fontWeight: 600 }}>
              Son 200 kayıt gösteriliyor. Daha eski kayıtlar için rapor dışa aktarımını kullanın.
            </div>
          )}
          {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}><LoadingStatus size={18} label="Geçmiş siparişler yükleniyor…" /></div>}
          {error && <div style={{ padding: 40, textAlign: 'center', color: 'var(--critical)', fontSize: 12.5 }}>{error}</div>}
          {!loading && !error && rows.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)', fontSize: 12.5 }}>Kayıt bulunamadı</div>
          )}
          {!loading && !error && Object.entries(groups).map(([day, list]) => (
            <div key={day}>
              <div style={{ ...S.label, padding: '14px 2px 8px', position: 'sticky', top: 0, background: 'var(--surface)' }}>{day} · {list.length} sipariş</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {list.map(o => <HistoryRow key={o.id} order={o} tableLabel={tableLabels[o.table_id ?? ''] ?? (o.table_id ? 'Masa' : 'Kasa')} onReceipt={onReceipt} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AccessibleDialog>
  )
}

function HistoryRow({ order, tableLabel, onReceipt }: {
  order: HistoryOrder
  tableLabel: string
  onReceipt: (order: HistoryOrder, tableLabel: string) => void
}) {
  const [hov, setHov] = useState(false)
  const cancelled = order.status === 'cancelled'
  const items = readOrderLineSnapshots(order.items)
  const names = items.map(i => `${i.quantity}× ${i.name}`).join(' · ')
  const time = new Date(order.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const isPaid = order.paid_at !== null
  const methodBadge = isPaid ? paymentMethodBadge((order.payment_method as PaymentMethod | null | undefined) ?? null) : null

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px',
      border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface)',
      boxShadow: hov ? 'var(--shadow-2)' : 'var(--shadow-1)', transition: 'box-shadow .12s',
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', background: cancelled ? 'var(--critical-bg)' : 'var(--positive-bg)', color: cancelled ? 'var(--critical)' : 'var(--positive)' }}>
        {cancelled ? <I.close size={16} /> : <I.check size={16} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{tableLabel}</span>
          <span style={{ ...S.mono, fontSize: 10.5, color: 'var(--text-4)' }}>#{order.id.slice(0, 6).toUpperCase()}</span>
          {methodBadge && (
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.04em', color: methodBadge.fg, background: methodBadge.bg, padding: '1px 6px', borderRadius: 999, ...(methodBadge.isComp ? { border: `1px dashed ${methodBadge.fg}` } : null) }}>{methodBadge.label}</span>
          )}
          {cancelled && <Tag tone="critical">İptal</Tag>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {time} · {names || '—'}
        </div>
      </div>
      <span style={{ ...S.mono, fontSize: 13.5, fontWeight: 700, color: cancelled ? 'var(--text-4)' : 'var(--text)', textDecoration: cancelled ? 'line-through' : 'none' }}>{formatCurrency(order.total)}</span>
      {!cancelled && (
        <button onClick={() => onReceipt(order, tableLabel)} style={{ ...btnGhost(), height: 30, padding: '0 11px' }}>
          <I.history size={12} />Fiş
        </button>
      )}
    </div>
  )
}
