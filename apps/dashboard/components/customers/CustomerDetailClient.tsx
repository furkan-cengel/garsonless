'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { CustomerTimelineEvent, RestaurantCustomerDetail } from '@garsonless/db'
import { grantStoreCreditAction } from '../../lib/actions/customers'
import { formatCurrency } from '../../lib/utils'
import { I, S, btnGhost } from '../../lib/ui'
import PageTopBar from '../layout/PageTopBar'

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${hh}:${mm}`
}

function initials(name: string | null): string {
  const parts = (name || 'İsimsiz').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  return (parts[0] ?? 'M').slice(0, 2).toUpperCase()
}

function softForTier(color: string | undefined): string {
  const c = (color ?? '').toLowerCase()
  const map: Record<string, string> = {
    '#b87333': '#f3e7dc',
    '#8a9099': '#eceef0',
    '#c8922a': '#f6ecd6',
    '#5b7a86': '#e3edf0',
  }
  return map[c] ?? 'var(--surface-3)'
}

function timelineLabel(e: CustomerTimelineEvent): { icon: ReactNode; label: string; amount: string; positive: boolean } {
  if (e.kind === 'order') {
    return { icon: <I.receipt size={18} />, label: e.paid ? 'Sipariş (ödendi)' : `Sipariş (${e.status ?? '—'})`, amount: formatCurrency(e.amount ?? 0), positive: false }
  }
  const delta = e.delta ?? 0
  const sign = delta >= 0 ? '+' : '−'
  const unit = e.type === 'stamp' ? ' damga' : ''
  const amount = `${sign}${Math.abs(delta)}${unit}`
  if (e.reason?.startsWith('store_credit')) return { icon: <I.gift size={18} />, label: 'Manuel puan kredisi', amount, positive: true }
  if (e.reason === 'welcome') return { icon: <I.star size={18} />, label: 'Hoş geldin bonusu', amount, positive: true }
  if (e.type === 'visit') return { icon: <I.users size={18} />, label: 'Ziyaret', amount, positive: true }
  if (e.direction === 'refund') return { icon: <I.undo size={18} />, label: e.type === 'stamp' ? 'Damga iadesi' : 'Puan iadesi', amount, positive: true }
  if (e.type === 'stamp') return { icon: <I.stamp size={18} />, label: e.direction === 'redeem' ? 'Bedava ürün' : 'Damga kazandı', amount, positive: delta >= 0 }
  return { icon: <I.star size={18} />, label: e.direction === 'redeem' ? 'Puan kullandı' : 'Puan kazandı', amount, positive: delta >= 0 }
}

export default function CustomerDetailClient({
  restaurantId,
  restaurantName,
  detail,
}: {
  restaurantId: string
  restaurantName: string
  detail: RestaurantCustomerDetail
}) {
  const router = useRouter()
  const [points, setPoints] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [grantConfirmed, setGrantConfirmed] = useState(false)
  const [pending, startTransition] = useTransition()

  const b = detail.balances
  const tier = b?.tier
  const nextTier = b?.nextTier ?? null
  const spendable = b?.points ?? 0
  const lifetime = b?.lifetimePoints ?? 0
  const progress = b?.tierProgress ?? (nextTier ? Math.min(100, Math.floor((lifetime / Math.max(1, nextTier.min)) * 100)) : 100)
  const tierColor = tier?.color ?? 'var(--text-3)'
  const tierSoft = softForTier(tier?.color)
  const tags = [
    detail.authLinked ? 'Bağlı hesap' : 'Bağlantısız kayıt',
    detail.hasConsent ? 'İzinli' : 'İzin yok',
    detail.visits >= 3 ? 'Sık gelen' : null,
    (b?.tierIndex ?? 0) >= 2 ? 'VIP' : null,
  ].filter(Boolean) as string[]

  function submitGrant() {
    const n = Math.floor(Number(points))
    if (!Number.isFinite(n) || n <= 0) { setMsg({ kind: 'err', text: 'Geçerli bir puan girin' }); return }
    if (n >= 1000 && !grantConfirmed) {
      setGrantConfirmed(true)
      setMsg({ kind: 'err', text: `${n.toLocaleString('tr-TR')} puan yüksek bir tutar. İşlemi doğrulamak için tekrar onaylayın.` })
      return
    }
    setMsg(null)
    startTransition(async () => {
      const res = await grantStoreCreditAction(restaurantId, detail.customerId, n, note.trim() || undefined)
      if ('error' in res) { setMsg({ kind: 'err', text: res.error }); return }
      setMsg({ kind: 'ok', text: `${res.granted} puan tanımlandı` })
      setPoints('')
      setNote('')
      setGrantConfirmed(false)
      router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <PageTopBar restaurantName={restaurantName} title={detail.name || 'Müşteri'} backHref={`/dashboard/${restaurantId}/customers`} />

      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)', minWidth: 0 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 32px 60px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-1)', padding: 22, marginBottom: 16 }}>
            <div className="customer-profile" style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
              <div style={{ width: 64, height: 64, borderRadius: 999, background: tierSoft, color: tierColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 750, fontSize: 22, flexShrink: 0 }}>
                {initials(detail.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 24, fontWeight: 750, letterSpacing: '-0.02em', margin: 0 }}>{detail.name || 'İsimsiz müşteri'}</h1>
                  {tier && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: tier.color, background: tierSoft, padding: '3px 11px', borderRadius: 99 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: tier.color }} />{tier.name}
                    </span>
                  )}
                  {tags.map((tag) => (
                    <span key={tag} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-2)', background: 'var(--surface-3)', padding: '3px 9px', borderRadius: 99 }}>{tag}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: detail.phoneMasked ? 'var(--text-3)' : 'var(--text-2)', marginTop: 8, ...S.mono }}>
                  <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><I.phone size={14} /></span>{detail.phone}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: detail.emailMasked ? 'var(--text-3)' : 'var(--text-2)', marginTop: 5, ...S.mono }}>
                  <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><I.mail size={14} /></span>{detail.email}
                </div>
                <div style={{ display: 'flex', gap: 22, marginTop: 12, fontSize: 12.5, color: 'var(--text-3)', flexWrap: 'wrap' }}>
                  <span>Müşteri kaydı: <b style={{ color: 'var(--text-2)', fontWeight: 650 }}>{fmtDate(detail.joinedAt)}</b></span>
                  <span>İlk ziyaret: <b style={{ color: 'var(--text-2)', fontWeight: 650 }}>{fmtDate(detail.firstSeenAt)}</b></span>
                  <span>Son görülme: <b style={{ color: 'var(--text-2)', fontWeight: 650 }}>{fmtDate(detail.lastSeenAt)}</b></span>
                </div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 650, color: detail.hasConsent ? 'var(--positive)' : 'var(--text-3)', background: detail.hasConsent ? 'var(--positive-bg)' : 'var(--surface-3)', padding: '8px 14px', borderRadius: 99, flexShrink: 0 }}>
                {detail.hasConsent ? <><I.check size={14} /> İletişim izni açık</> : 'İletişim izni kapalı'}
              </span>
            </div>
          </div>

          <div className="customer-detail-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard icon={<I.receipt size={17} />} label="HARCAMA" value={formatCurrency(detail.spend)} tone="var(--text)" mono />
            <StatCard icon={<I.users size={17} />} label="ZİYARET" value={String(detail.visits)} tone="var(--text)" />
            <StatCard icon={<I.star size={17} />} label="PUAN" value={String(spendable)} tone="#c8922a" />
            <StatCard icon={<I.star size={17} />} label="SEVİYE" value={tier?.name ?? '—'} tone={tierColor} sub={`${lifetime} ömür puanı`} dot={tierColor} />
          </div>

          {nextTier && tier && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-1)', padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 650 }}>{nextTier.name} seviyesine ilerleme</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}><b style={{ color: 'var(--text)' }}>{Math.max(0, nextTier.min - lifetime)}</b> puan kaldı</span>
              </div>
              <div style={{ position: 'relative', height: 8, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${tier.color}, ${nextTier.color})`, borderRadius: 99 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 11.5, color: 'var(--text-3)' }}>
                <span>{tier.name} · {lifetime}p</span><span>{nextTier.name} · {nextTier.min}p</span>
              </div>
            </div>
          )}

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-1)', padding: 20, marginBottom: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 650, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#c8922a', display: 'inline-flex' }}><I.gift size={14} /></span>Puan / Kredi tanımla</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3, marginBottom: 14 }}>Manuel puan kredisi; müşterinin bakiyesine anında eklenir, hareketlerde görünür.</div>
            <div className="customer-grant-form" style={{ display: 'flex', gap: 10 }}>
              <input
                aria-label="Tanımlanacak puan"
                value={points}
                onChange={(e) => { setPoints(e.target.value.replace(/[^\d]/g, '')); setGrantConfirmed(false); setMsg(null) }}
                placeholder="Puan"
                inputMode="numeric"
                style={{ width: 130, height: 40, padding: '0 14px', border: '1px solid var(--border-strong)', borderRadius: 9, fontSize: 14, fontWeight: 650, outline: 'none', textAlign: 'center', background: 'var(--surface)', color: 'var(--text)' }}
              />
              <input
                aria-label="Puan tanımlama notu"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Not (opsiyonel)"
                maxLength={80}
                style={{ flex: 1, minWidth: 160, height: 40, padding: '0 14px', border: '1px solid var(--border-strong)', borderRadius: 9, fontSize: 14, outline: 'none', background: 'var(--surface)', color: 'var(--text)' }}
              />
              <button type="button" onClick={submitGrant} disabled={pending || !points}
                style={{ height: 40, padding: '0 22px', borderRadius: 9, border: 'none', background: points && !pending ? 'var(--action)' : 'var(--border-strong)', color: '#fff', fontSize: 14, fontWeight: 650, cursor: points && !pending ? 'pointer' : 'not-allowed' }}>
                {pending ? 'Tanımlanıyor...' : grantConfirmed ? 'Puanı onayla' : 'Tanımla'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
              {[50, 100, 250, 500].map((v) => (
                <button key={v} type="button" onClick={() => { setPoints(String(v)); setGrantConfirmed(false); setMsg(null) }} style={{ height: 28, padding: '0 12px', borderRadius: 99, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>+{v}</button>
              ))}
              <button type="button" onClick={() => { setPoints(''); setNote('') }} style={{ ...btnGhost({ height: 28, padding: '0 12px', borderRadius: 99, fontSize: 12.5 }) }}>Temizle</button>
            </div>
            {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: msg.kind === 'ok' ? 'var(--positive)' : 'var(--critical)' }}>{msg.text}</div>}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.05em', marginBottom: 10 }}>HAREKETLER</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {detail.timeline.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-1)' }}>Henüz hareket yok.</div>
            ) : detail.timeline.map((e) => {
              const t = timelineLabel(e)
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-1)', padding: '14px 16px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-3)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 650 }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{fmtDateTime(e.at)}</div>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 750, color: t.positive ? 'var(--positive)' : 'var(--text-2)', ...S.mono }}>{t.amount}</span>
                </div>
              )
            })}
          </div>
          <style>{`@media (max-width:760px){.customer-detail-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}.customer-grant-form{flex-direction:column!important}.customer-grant-form input{width:100%!important}.customer-profile{flex-wrap:wrap!important}} @media (max-width:460px){.customer-detail-stats{grid-template-columns:1fr!important}}`}</style>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone,
  sub,
  mono,
  dot,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: string
  sub?: string
  mono?: boolean
  dot?: string
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-1)', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.05em' }}>
        <span style={{ color: 'var(--text-4)', display: 'inline-flex' }}>{icon}</span>{label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 750, marginTop: 8, letterSpacing: '-0.02em', color: tone, display: 'flex', alignItems: 'center', gap: 8, ...(mono ? S.mono : {}) }}>
        {dot && <span style={{ width: 9, height: 9, borderRadius: 999, background: dot }} />}{value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}
