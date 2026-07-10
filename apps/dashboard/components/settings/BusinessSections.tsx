'use client'

import { useEffect, useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import type { Tables } from '@garsonless/db'
import { InlineSpinner } from '@garsonless/ui'
import { I, S, Tag, btnGhost, btnPrimary } from '../../lib/ui'
import { Toggle, SCard, FormRow, inputStyle } from './primitives'
import {
  getPaymentCredentialsMeta,
  savePaymentCredentials,
  deletePaymentCredentials,
  testPaymentCredentials,
  type PaymentCredsMeta,
} from '../../lib/actions/payments'
import { saveNotificationSettings, updateSettings } from '../../lib/actions/restaurant'
import { readNotificationPrefs, type NotificationPrefs } from '../../lib/notification-prefs'
import { readLateThresholdMin, clampLateThreshold, LATE_THRESHOLD_MIN_MIN, LATE_THRESHOLD_MIN_MAX } from '../../lib/orders-prefs'

/* ── PAYMENTS ─────────────────────────────────────── */
export function PaymentsSection({ restaurantId }: { restaurantId: string }) {
  return (
    <>
      <IyzicoCredentialsCard restaurantId={restaurantId} />

      <SCard title="Gerçek ödeme yolları" subtitle="Bu bölüm yalnızca bugün çalışan akışları gösterir">
        <PaymentPath
          icon={<I.card size={18} />}
          title="Müşteri kart ödemesi"
          body="Normal Öde ve hesap bölüşme kart akışları İyzico checkout üzerinden çalışır."
          status="İyzico ile"
          tone="positive"
        />
        <PaymentPath
          icon={<I.receipt size={18} />}
          title="Garson tahsilatı"
          body="Nakit, fiziksel POS ve İkram tahsilatları masa kapatma ekranında personel tarafından işlenir."
          status="Panelden"
          tone="neutral"
        />
        <PaymentPath
          icon={<I.gift size={18} />}
          title="Hesap bölüşme"
          body="Müşteri pay oluşturabilir; kart payı İyzico ile tahsil edilir, nakit beyanı garson onayı bekler."
          status="Aktif"
          tone="positive"
        />
        <div style={{ padding: '12px 18px', fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Dijital cüzdanlar, banka transferi, yemek kartları, otomatik servis ücreti ve e-fatura gönderimi bu sürümde
          yapılandırılabilir bir ödeme yöntemi değildir.
        </div>
      </SCard>
    </>
  )
}

function PaymentPath({
  icon,
  title,
  body,
  status,
  tone,
}: {
  icon: ReactNode
  title: string
  body: string
  status: string
  tone: 'positive' | 'neutral'
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '1px solid var(--divider)' }}>
      <div style={{
        width: 40, height: 40, borderRadius: 8,
        background: 'var(--surface-3)', color: 'var(--text-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.45 }}>{body}</div>
      </div>
      <Tag tone={tone}>{status}</Tag>
    </div>
  )
}

/* ── İYZİCO CREDENTIALS ───────────────────────────── */
function IyzicoCredentialsCard({ restaurantId }: { restaurantId: string }) {
  const [meta, setMeta] = useState<PaymentCredsMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [mode, setMode] = useState<'sandbox' | 'live'>('sandbox')
  const [busy, setBusy] = useState<'save' | 'test' | 'delete' | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    getPaymentCredentialsMeta(restaurantId).then((result) => {
      if (cancelled) return
      setLoading(false)
      if ('error' in result) {
        setFeedback({ ok: false, text: result.error })
        return
      }
      setMeta(result)
      setMode(result.mode)
    })
    return () => { cancelled = true }
  }, [restaurantId])

  async function handleSave() {
    setBusy('save')
    setFeedback(null)
    const result = await savePaymentCredentials(restaurantId, { apiKey, secretKey, mode })
    setBusy(null)
    if ('error' in result) {
      setFeedback({ ok: false, text: result.error })
      return
    }
    setMeta({
      configured: true,
      mode,
      apiKeyLast4: apiKey.trim().slice(-4),
      updatedAt: new Date().toISOString(),
    })
    setApiKey('')
    setSecretKey('')
    setEditing(false)
    setFeedback({ ok: true, text: 'Anahtarlar kaydedildi' })
  }

  async function handleTest() {
    setBusy('test')
    setFeedback(null)
    const result = await testPaymentCredentials(restaurantId)
    setBusy(null)
    setFeedback({ ok: result.ok, text: result.message })
  }

  async function handleDelete() {
    if (!window.confirm('İyzico anahtarları silinsin mi? Bu restoran için ödeme alınamaz hale gelir.')) return
    setBusy('delete')
    setFeedback(null)
    const result = await deletePaymentCredentials(restaurantId)
    setBusy(null)
    if ('error' in result) {
      setFeedback({ ok: false, text: result.error })
      return
    }
    setMeta({ configured: false, mode: 'sandbox', apiKeyLast4: null, updatedAt: null })
    setFeedback({ ok: true, text: 'Anahtarlar kaldırıldı' })
  }

  const configured = meta?.configured ?? false

  return (
    <div style={{
      padding: 16, marginBottom: 20,
      background: 'var(--surface)', borderRadius: 10,
      border: `1px solid ${configured ? 'var(--positive)' : 'var(--border)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: 'linear-gradient(135deg, #6b46c1 0%, #d53f8c 100%)',
          color: '#fff', fontWeight: 800, fontSize: 11, letterSpacing: '.04em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>iy</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>iyzico</span>
            {loading ? null : configured ? (
              <>
                <Tag tone="positive">
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--positive)' }} />
                  Bağlandı
                </Tag>
                <Tag tone={meta?.mode === 'live' ? 'critical' : 'neutral'}>
                  {meta?.mode === 'live' ? 'CANLI' : 'SANDBOX'}
                </Tag>
              </>
            ) : (
              <Tag tone="neutral">Yapılandırılmadı</Tag>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, ...S.mono }}>
            {loading
              ? 'Yükleniyor…'
              : configured
                ? `API Key •••• son 4: ${meta?.apiKeyLast4 ?? '????'}`
                : 'Ödeme almak için İyzico API anahtarlarını girin'}
          </div>
        </div>
        {!loading && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {configured && (
              <>
                <button style={btnGhost()} onClick={handleTest} disabled={busy !== null}>
                  {busy === 'test' ? 'Test ediliyor…' : 'Bağlantıyı test et'}
                </button>
                <button style={btnGhost()} onClick={handleDelete} disabled={busy !== null}>
                  Kaldır
                </button>
              </>
            )}
            {!editing && (
              <button style={btnPrimary()} onClick={() => { setEditing(true); setFeedback(null) }}>
                {configured ? 'Değiştir' : 'Bağla'}
              </button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--divider)' }}>
          <FormRow label="API Key">
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sandbox-..."
              autoComplete="off"
              style={inputStyle({ width: 320, fontFamily: 'monospace' })}
            />
          </FormRow>
          <FormRow label="Secret Key">
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="sandbox-..."
              autoComplete="new-password"
              style={inputStyle({ width: 320, fontFamily: 'monospace' })}
            />
          </FormRow>
          <FormRow label="Ortam" hint="Sandbox: test ödemeleri · Canlı: gerçek tahsilat">
            <div style={{ display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 7, padding: 3, gap: 2 }}>
              {(['sandbox', 'live'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={{
                    padding: '5px 14px', borderRadius: 5, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    background: mode === m ? 'var(--surface)' : 'transparent',
                    color: mode === m ? 'var(--text)' : 'var(--text-2)',
                    boxShadow: mode === m ? 'var(--shadow-1)' : 'none',
                  }}
                >
                  {m === 'sandbox' ? 'Sandbox' : 'Canlı'}
                </button>
              ))}
            </div>
          </FormRow>
          <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
            <button
              style={btnGhost()}
              onClick={() => { setEditing(false); setApiKey(''); setSecretKey(''); setFeedback(null) }}
              disabled={busy !== null}
            >Vazgeç</button>
            <button
              style={btnPrimary()}
              onClick={handleSave}
              disabled={busy !== null || apiKey.trim().length < 10 || secretKey.trim().length < 10}
            >
              {busy === 'save' ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 7, fontSize: 12.5,
          background: feedback.ok ? 'var(--positive-bg)' : 'var(--critical-bg)',
          color: feedback.ok ? 'var(--positive)' : 'var(--critical)',
        }}>
          {feedback.text}
        </div>
      )}
    </div>
  )
}

/* ── NOTIFICATIONS ────────────────────────────────── */
// Toggles map only to notification surfaces that are actually implemented:
//   newOrderSound / newOrderPush  → useNotificationSW (beep + Web Notification)
//   newOrderToast                 → OrderToast on the orders board
//   serviceRequestAlert           → "Garson çağrısı" toast in the dashboard shell
// E-posta/SMS and the old "sessiz saatler" stub are omitted — no backing channel.
const NOTIFICATION_ROWS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: 'newOrderSound',       label: 'Yeni sipariş sesi',      hint: 'Sipariş geldiğinde kısa bip sesi çalar' },
  { key: 'newOrderPush',        label: 'Masaüstü bildirimi',     hint: 'Tarayıcı/sistem bildirimi gösterir (izin gerekir)' },
  { key: 'newOrderToast',       label: 'Uygulama içi uyarı',     hint: 'Panelde yeni sipariş baloncuğu gösterir' },
  { key: 'serviceRequestAlert', label: 'Garson çağrısı uyarısı', hint: 'Müşteri garson çağırınca panelde uyarı gösterir' },
]

export function NotificationsSection({ restaurant }: { restaurant: Tables<'restaurants'> }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => readNotificationPrefs(restaurant.settings))
  // Geciken eşiği (dk) — settings.orders.late_threshold_min; Siparişler
  // panosundaki "Geciken" uyarısını sürer (mutfak aşamasında geçen süre).
  const [lateThreshold, setLateThreshold] = useState<string>(() => String(readLateThresholdMin(restaurant.settings)))
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function set(key: keyof NotificationPrefs, value: boolean) {
    setPrefs(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await saveNotificationSettings(restaurant.id, prefs)
      if ('error' in result) { setError(result.error); return }
      const clamped = clampLateThreshold(Number(lateThreshold))
      const thresholdResult = await updateSettings(restaurant.id, { orders: { late_threshold_min: clamped } })
      if ('error' in thresholdResult) { setError(thresholdResult.error); return }
      setLateThreshold(String(clamped))
      setSaved(true)
    })
  }

  return (
    <form onSubmit={handleSave}>
      <SCard title="Bildirimler" subtitle="Sipariş ve garson çağrısı uyarılarını yönet">
        {NOTIFICATION_ROWS.map(row => (
          <FormRow key={row.key} label={row.label} hint={row.hint}>
            <Toggle on={prefs[row.key]} onChange={value => set(row.key, value)} />
          </FormRow>
        ))}
        <FormRow label="Gecikme eşiği (dk)" hint="Mutfak aşamasında bu süreyi aşan sipariş panoda 'Geciken' sayılır (5–120)">
          <input
            type="number"
            min={LATE_THRESHOLD_MIN_MIN}
            max={LATE_THRESHOLD_MIN_MAX}
            value={lateThreshold}
            onChange={e => { setLateThreshold(e.target.value); setSaved(false) }}
            style={{
              width: 84, height: 32, padding: '0 10px', fontSize: 13,
              border: '1px solid var(--border-strong)', borderRadius: 7,
              background: 'var(--surface)', color: 'var(--text)', outline: 'none',
            }}
          />
        </FormRow>
        <div style={{ padding: '12px 18px', fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Bu uyarılar sipariş ve masa panellerinde gerçek zamanlı çalışır. E-posta/SMS bildirimleri
          henüz desteklenmiyor.
        </div>
      </SCard>

      <div style={{
        marginTop: 20, padding: '12px 16px',
        background: 'var(--surface)', borderRadius: 10,
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, color: error ? 'var(--critical)' : 'var(--text-3)' }}>
          {error || (saved ? '✓ Kaydedildi' : 'Değişiklikleri kaydedin')}
        </span>
        <button type="submit" disabled={isPending} style={btnPrimary()}>
          {isPending ? <InlineSpinner size={13} color="var(--on-action)" /> : <I.check size={13} />}{isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}
