'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import type { Tables } from '@garsonless/db/types'
import { InlineSpinner } from '@garsonless/ui'
import { I, S, Tag, btnGhost, btnPrimary } from '../../lib/ui'
import { Toggle, SCard, FormRow, inputStyle } from './primitives'
import {
  getPaymentCredentialsMeta,
  savePaymentCredentials,
  deletePaymentCredentials,
  rotatePaymentCredentialsEncryption,
  testPaymentCredentials,
  type PaymentCredsMeta,
} from '../../lib/actions/payments'
import { saveNotificationPreferences } from '../../lib/actions/restaurant'
import {
  getMyEmailNotificationPrefs,
  saveMyEmailNotificationPrefs,
  type EmailNotificationPrefs,
} from '../../lib/actions/notifications'
import { readNotificationPrefs, type NotificationPrefs, type OrderSoundPreset } from '../../lib/notification-prefs'
import { readLateThresholdMin, clampLateThreshold, LATE_THRESHOLD_MIN_MIN, LATE_THRESHOLD_MIN_MAX } from '../../lib/orders-prefs'
import { notifySettingsDirty, notifySettingsSaved } from './settings-dirty-state'
import { useDashboardPushSubscription } from '../notifications/useDashboardPushSubscription'
import { playOrderAlertSound } from '../notifications/order-alert-audio'
import { testDashboardPush } from '../../lib/actions/push-subscriptions'
import {
  mergeCanonicalSettings,
  prepareSettingsMutationAttempt,
  type SettingsMutationAttempt,
} from './settings-save-contract'

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
  const [currentPassword, setCurrentPassword] = useState('')
  const [mode, setMode] = useState<'sandbox' | 'live'>('sandbox')
  const [confirming, setConfirming] = useState<'delete' | 'rotate' | null>(null)
  const [busy, setBusy] = useState<'save' | 'test' | 'delete' | 'rotate' | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const confirmationTitleId = useId()

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
    const result = await savePaymentCredentials(restaurantId, {
      apiKey,
      secretKey,
      mode,
      requestId: crypto.randomUUID(),
      currentPassword,
    })
    setBusy(null)
    if ('error' in result) {
      setFeedback({ ok: false, text: result.error })
      return
    }
    setMeta(result.meta)
    setApiKey('')
    setSecretKey('')
    setCurrentPassword('')
    setEditing(false)
    setFeedback({ ok: true, text: 'Anahtarlar kaydedildi' })
    notifySettingsSaved()
  }

  async function handleTest() {
    setBusy('test')
    setFeedback(null)
    const result = await testPaymentCredentials(restaurantId)
    setBusy(null)
    setFeedback({ ok: result.ok, text: result.message })
  }

  async function handleDelete() {
    setBusy('delete')
    setFeedback(null)
    const result = await deletePaymentCredentials(restaurantId, {
      requestId: crypto.randomUUID(),
      currentPassword,
    })
    setBusy(null)
    if ('error' in result) {
      setFeedback({ ok: false, text: result.error })
      return
    }
    setMeta({
      configured: false,
      mode: 'sandbox',
      apiKeyLast4: null,
      updatedAt: null,
      protection: 'none',
      requiresRotation: false,
    })
    setCurrentPassword('')
    setConfirming(null)
    setFeedback({ ok: true, text: 'Anahtarlar kaldırıldı' })
    notifySettingsSaved()
  }

  async function handleRotate() {
    setBusy('rotate')
    setFeedback(null)
    const result = await rotatePaymentCredentialsEncryption(restaurantId, {
      requestId: crypto.randomUUID(),
      currentPassword,
    })
    setBusy(null)
    if ('error' in result) {
      setFeedback({ ok: false, text: result.error })
      return
    }
    setMeta(result.meta)
    setCurrentPassword('')
    setConfirming(null)
    setFeedback({ ok: true, text: 'Credential şifrelemesi güncel anahtara taşındı' })
    notifySettingsSaved()
  }

  const configured = meta?.configured ?? false
  const beginSensitiveAction = (action: 'delete' | 'rotate') => {
    setEditing(false)
    setApiKey('')
    setSecretKey('')
    setCurrentPassword('')
    setConfirming(action)
    setFeedback(null)
  }
  const cancelSensitiveAction = () => {
    setCurrentPassword('')
    setConfirming(null)
    setFeedback(null)
    notifySettingsSaved()
  }

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
                {meta?.requiresRotation && <Tag tone="critical">ŞİFRELEMEYİ YENİLE</Tag>}
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
                {meta?.requiresRotation && (
                  <button type="button" style={btnGhost()} onClick={() => beginSensitiveAction('rotate')} disabled={busy !== null}>
                    {busy === 'rotate' ? 'Yenileniyor…' : 'Şifrelemeyi yenile'}
                  </button>
                )}
                <button type="button" style={btnGhost()} onClick={handleTest} disabled={busy !== null}>
                  {busy === 'test' ? 'Test ediliyor…' : 'Bağlantıyı test et'}
                </button>
                <button type="button" style={btnGhost()} onClick={() => beginSensitiveAction('delete')} disabled={busy !== null}>
                  Kaldır
                </button>
              </>
            )}
            {!editing && (
              <button type="button" style={btnPrimary()} onClick={() => { setConfirming(null); setCurrentPassword(''); setEditing(true); setFeedback(null) }}>
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
          <FormRow label="Hesap şifresi" hint="Bu hassas işlem için owner hesabını yeniden doğrular">
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              style={inputStyle({ width: 320 })}
            />
          </FormRow>
          <FormRow label="Ortam" hint="Sandbox: test ödemeleri · Canlı: gerçek tahsilat">
            <div style={{ display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 7, padding: 3, gap: 2 }}>
              {(['sandbox', 'live'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
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
              onClick={() => { setEditing(false); setApiKey(''); setSecretKey(''); setCurrentPassword(''); setFeedback(null); notifySettingsSaved() }}
              disabled={busy !== null}
            >Vazgeç</button>
            <button
              style={btnPrimary()}
              onClick={handleSave}
              disabled={busy !== null || apiKey.trim().length < 10 || secretKey.trim().length < 10 || currentPassword.length === 0}
            >
              {busy === 'save' ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <div
          role="group"
          aria-labelledby={confirmationTitleId}
          style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--divider)' }}
        >
          <div id={confirmationTitleId} style={{ padding: '0 18px 8px', fontSize: 13.5, fontWeight: 650 }}>
            {confirming === 'delete' ? 'İyzico anahtarlarını kaldır' : 'Credential şifrelemesini yenile'}
          </div>
          <p style={{ margin: '0 18px 10px', color: 'var(--text-3)', fontSize: 12, lineHeight: 1.5 }}>
            {confirming === 'delete'
              ? 'Bu restoran için kart ödemeleri durur. Devam etmek için owner hesap şifreni doğrula.'
              : 'Kayıtlı secret güncel şifreleme anahtarına taşınır. Devam etmek için owner hesap şifreni doğrula.'}
          </p>
          <FormRow label="Hesap şifresi" hint="Şifren yoksa önce Güvenlik bölümünden bir şifre belirle">
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              style={inputStyle({ width: 320 })}
            />
          </FormRow>
          <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
            <button type="button" style={btnGhost()} onClick={cancelSensitiveAction} disabled={busy !== null}>Vazgeç</button>
            <button
              type="button"
              style={confirming === 'delete' ? btnGhost({ color: 'var(--critical)' }) : btnPrimary()}
              onClick={confirming === 'delete' ? handleDelete : handleRotate}
              disabled={busy !== null || currentPassword.length === 0}
            >
              {busy === 'delete'
                ? 'Kaldırılıyor…'
                : busy === 'rotate'
                  ? 'Yenileniyor…'
                  : confirming === 'delete'
                    ? 'Anahtarları kaldır'
                    : 'Şifrelemeyi yenile'}
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div role={feedback.ok ? 'status' : 'alert'} style={{
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
//   newOrderSound / newOrderPush  → global shell alarm + Web Notification
//   newOrderToast                 → global shell OrderToast
//   serviceRequestAlert           → "Garson çağrısı" toast in the dashboard shell
//   serviceRequestPush            → durable operating-system waiter-call alert
// E-posta/SMS and the old "sessiz saatler" stub are omitted — no backing channel.
type NotificationToggleKey = 'newOrderSound' | 'newOrderPush' | 'newOrderToast' | 'serviceRequestAlert' | 'serviceRequestPush'
const NOTIFICATION_ROWS: { key: NotificationToggleKey; label: string; hint: string }[] = [
  { key: 'newOrderSound',       label: 'Yeni sipariş sesi',      hint: 'Sipariş geldiğinde kısa bip sesi çalar' },
  { key: 'newOrderPush',        label: 'Masaüstü bildirimi',     hint: 'Tarayıcı/sistem bildirimi gösterir (izin gerekir)' },
  { key: 'newOrderToast',       label: 'Uygulama içi uyarı',     hint: 'Panelde yeni sipariş baloncuğu gösterir' },
  { key: 'serviceRequestAlert', label: 'Garson çağrısı uyarısı', hint: 'Müşteri garson çağırınca panelde uyarı gösterir' },
  { key: 'serviceRequestPush',  label: 'Garson çağrısı bildirimi', hint: 'Panel kapalıyken de sistem bildirimi gönderir (izin gerekir)' },
]

// Per-user e-mail opt-in — writes notification_preferences for the signed-in
// user (not the restaurant). Saves immediately on toggle; the outbox
// notification-email consumer reads the same rows at delivery time.
const EMAIL_PREF_ROWS: { key: keyof EmailNotificationPrefs; label: string; hint: string }[] = [
  { key: 'order', label: 'Yeni sipariş e-postası', hint: 'Her yeni siparişte size e-posta gönderilir (kişisel tercih)' },
  { key: 'service_request', label: 'Masa isteği e-postası', hint: 'Garson çağrılarında size e-posta gönderilir (kişisel tercih)' },
]

function EmailPrefsBlock({ restaurantId }: { restaurantId: string }) {
  const [prefs, setEmailPrefs] = useState<EmailNotificationPrefs | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void getMyEmailNotificationPrefs(restaurantId).then((result) => {
      if (cancelled) return
      if ('order' in result) setEmailPrefs(result)
      else setError(result.error)
    })
    return () => { cancelled = true }
  }, [restaurantId])

  const toggle = (key: keyof EmailNotificationPrefs, value: boolean) => {
    if (!prefs) return
    const next = { ...prefs, [key]: value }
    const previous = prefs
    setEmailPrefs(next)
    setError('')
    void saveMyEmailNotificationPrefs(restaurantId, next).then((result) => {
      if ('error' in result) {
        setEmailPrefs(previous)
        setError(result.error)
      }
    })
  }

  return (
    <>
      <div style={{
        padding: '10px 18px 4px', fontSize: 11, fontWeight: 700,
        letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-4)',
        borderTop: '1px solid var(--divider)',
      }}>
        E-posta bildirimleri (kişisel)
      </div>
      {EMAIL_PREF_ROWS.map(row => (
        <FormRow key={row.key} label={row.label} hint={row.hint}>
          <Toggle
            on={prefs?.[row.key] ?? false}
            disabled={prefs === null}
            onChange={value => toggle(row.key, value)}
            ariaLabel={row.label}
          />
        </FormRow>
      ))}
      {error && (
        <div role="alert" style={{ padding: '4px 18px 8px', fontSize: 11.5, color: 'var(--critical)' }}>
          {error}
        </div>
      )}
    </>
  )
}

export function NotificationsSection({ restaurant, featureAllowed }: { restaurant: Tables<'restaurants'>; featureAllowed: boolean }) {
  const settingsSnapshotRef = useRef((restaurant.settings as Record<string, unknown> | null) ?? {})
  const mutationAttemptRef = useRef<SettingsMutationAttempt | null>(null)
  const browserNotificationsEnabled = featureAllowed
  const device = useDashboardPushSubscription(restaurant.id, browserNotificationsEnabled)
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => ({
    ...readNotificationPrefs(restaurant.settings),
    ...(!browserNotificationsEnabled ? { newOrderPush: false, serviceRequestPush: false } : {}),
  }))
  // Geciken eşiği (dk) — settings.orders.late_threshold_min; Siparişler
  // panosundaki "Geciken" uyarısını sürer (mutfak aşamasında geçen süre).
  const [lateThreshold, setLateThreshold] = useState<string>(() => String(readLateThresholdMin(restaurant.settings)))
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [soundTest, setSoundTest] = useState<'idle' | 'playing' | 'blocked'>('idle')
  const [pushTest, setPushTest] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [isPending, startTransition] = useTransition()

  function setToggle(key: NotificationToggleKey, value: boolean) {
    setPrefs(prev => ({ ...prev, [key]: value }))
    setSaved(false)
    notifySettingsDirty()
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    const clamped = clampLateThreshold(Number(lateThreshold))
    const settingsPatch = {
      notifications: prefs,
      orders: { late_threshold_min: clamped },
    }
    const attempt = prepareSettingsMutationAttempt(mutationAttemptRef.current, {
      patch: settingsPatch,
      expectedSettings: settingsSnapshotRef.current,
    })
    mutationAttemptRef.current = attempt
    startTransition(async () => {
      let result
      try {
        result = await saveNotificationPreferences(restaurant.id, {
          prefs,
          lateThresholdMin: clamped,
        }, {
          expectedSettings: settingsSnapshotRef.current,
          requestId: attempt.requestId,
        })
      } catch {
        setError('Bağlantı kesildi. Taslağın korundu; tekrar deneyebilirsin.')
        return
      }
      if ('error' in result) {
        if ('code' in result && result.code === 'CONFLICT') mutationAttemptRef.current = null
        setError(result.error)
        return
      }
      settingsSnapshotRef.current = mergeCanonicalSettings(settingsSnapshotRef.current, result.canonicalSettings)
      mutationAttemptRef.current = null
      setLateThreshold(String(clamped))
      setSaved(true)
      notifySettingsSaved()
    })
  }

  return (
    <form onSubmit={handleSave}>
      <SCard title="Bildirimler" subtitle="Sipariş ve garson çağrısı uyarılarını yönet">
        {NOTIFICATION_ROWS.map(row => {
          const locked = (row.key === 'newOrderPush' || row.key === 'serviceRequestPush') && !browserNotificationsEnabled
          return (
          <FormRow key={row.key} label={row.label} hint={row.hint}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {locked && <Tag tone="neutral">Starter</Tag>}
              <Toggle
                on={prefs[row.key]}
                disabled={locked}
                onChange={value => setToggle(row.key, value)}
                ariaLabel={locked ? `${row.label}, Starter paketi gerekir` : row.label}
              />
            </div>
          </FormRow>
          )
        })}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--divider)', display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-4)' }}>
            Yeni sipariş sesi
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <label style={{ display: 'grid', gap: 5, fontSize: 11.5, color: 'var(--text-3)' }}>
              Ses
              <select
                value={prefs.newOrderSoundPreset}
                disabled={!prefs.newOrderSound}
                onChange={(event) => { setPrefs(prev => ({ ...prev, newOrderSoundPreset: event.target.value as OrderSoundPreset })); setSaved(false); notifySettingsDirty() }}
                style={inputStyle()}
              >
                <option value="classic">Klasik</option>
                <option value="kitchen-bell">Mutfak zili</option>
                <option value="double-chime">Üçlü melodi</option>
                <option value="soft-ping">Yumuşak ping</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5, fontSize: 11.5, color: 'var(--text-3)' }}>
              Ses seviyesi · %{prefs.newOrderSoundVolume}
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={prefs.newOrderSoundVolume}
                disabled={!prefs.newOrderSound}
                onChange={(event) => { setPrefs(prev => ({ ...prev, newOrderSoundVolume: Number(event.target.value) })); setSaved(false); notifySettingsDirty() }}
              />
            </label>
            <label style={{ display: 'grid', gap: 5, fontSize: 11.5, color: 'var(--text-3)' }}>
              Tekrar
              <select
                value={prefs.newOrderRepeatSeconds}
                disabled={!prefs.newOrderSound}
                onChange={(event) => { setPrefs(prev => ({ ...prev, newOrderRepeatSeconds: Number(event.target.value) as 0 | 15 | 30 | 60 })); setSaved(false); notifySettingsDirty() }}
                style={inputStyle()}
              >
                <option value={0}>Tekrar etme</option>
                <option value={15}>15 saniyede bir</option>
                <option value={30}>30 saniyede bir</option>
                <option value={60}>60 saniyede bir</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5, fontSize: 11.5, color: 'var(--text-3)' }}>
              En fazla
              <select
                value={prefs.newOrderRepeatMaxMinutes}
                disabled={!prefs.newOrderSound || prefs.newOrderRepeatSeconds === 0}
                onChange={(event) => { setPrefs(prev => ({ ...prev, newOrderRepeatMaxMinutes: Number(event.target.value) })); setSaved(false); notifySettingsDirty() }}
                style={inputStyle()}
              >
                {[1, 3, 5, 10].map((minute) => <option key={minute} value={minute}>{minute} dakika</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              disabled={!prefs.newOrderSound || soundTest === 'playing'}
              onClick={() => {
                setSoundTest('playing')
                void playOrderAlertSound(prefs.newOrderSoundPreset, prefs.newOrderSoundVolume)
                  .then((played) => setSoundTest(played ? 'idle' : 'blocked'))
              }}
              style={btnGhost()}
            >
              <I.bell size={13} />{soundTest === 'playing' ? 'Çalıyor…' : 'Sesi test et'}
            </button>
            {soundTest === 'blocked' && <span role="status" style={{ fontSize: 11.5, color: 'var(--warning)' }}>Tarayıcı sesi engelledi. Sayfaya dokunup tekrar deneyin.</span>}
          </div>
        </div>
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
        <EmailPrefsBlock restaurantId={restaurant.id} />
        <div style={{ padding: '12px 18px', fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Uygulama içi uyarılar tüm paketlerde gerçek zamanlı çalışır. İşletim sistemi bildirimi Starter
          ve üstü paketlerde tarayıcı izniyle kullanılabilir. E-posta bildirimleri kişiseldir ve varsayılan
          olarak kapalıdır; kritik ödeme/servis e-postaları tercihle kapatılamaz. SMS henüz desteklenmiyor.
        </div>
        {browserNotificationsEnabled && (
          <FormRow
            label="Bu cihaz"
            hint={device.status === 'subscribed'
              ? 'Panel kapalıyken de seçtiğiniz sistem bildirimlerini alır'
              : device.status === 'unconfigured'
                ? 'Web Push anahtarı bu ortamda yapılandırılmamış'
                : device.status === 'denied'
                  ? 'Tarayıcı izni engellenmiş; site ayarlarından açın'
                  : device.error ?? 'Bu tarayıcıyı dayanıklı bildirim teslimatına bağlayın'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {device.status === 'subscribed' && (
                <button
                  type="button"
                  disabled={pushTest === 'sending'}
                  onClick={() => {
                    setPushTest('sending')
                    void testDashboardPush(restaurant.id).then((result) => setPushTest('error' in result ? 'failed' : 'sent'))
                  }}
                  style={btnGhost()}
                >
                  <I.bell size={13} />{pushTest === 'sending' ? 'Gönderiliyor…' : pushTest === 'sent' ? 'Gönderildi' : pushTest === 'failed' ? 'Tekrar dene' : 'Test gönder'}
                </button>
              )}
              <button
                type="button"
                disabled={device.status === 'subscribing' || device.status === 'unconfigured' || device.status === 'denied'}
                onClick={() => void (device.status === 'subscribed' ? device.unsubscribe() : device.subscribe())}
                style={device.status === 'subscribed' ? btnGhost() : btnPrimary()}
              >
                {device.status === 'subscribed' ? <I.check size={13} /> : <I.bell size={13} />}
                {device.status === 'subscribed'
                  ? 'Bu cihazı kapat'
                  : device.status === 'subscribing'
                    ? 'Etkinleştiriliyor…'
                    : 'Bu cihazı etkinleştir'}
              </button>
            </div>
          </FormRow>
        )}
      </SCard>

      <div style={{
        marginTop: 20, padding: '12px 16px',
        background: 'var(--surface)', borderRadius: 10,
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span role={error ? 'alert' : 'status'} style={{ fontSize: 12, color: error ? 'var(--critical)' : 'var(--text-3)' }}>
          {error || (saved ? '✓ Kaydedildi' : 'Değişiklikleri kaydedin')}
        </span>
        <button type="submit" disabled={isPending} style={btnPrimary()}>
          {isPending ? <InlineSpinner size={13} color="var(--on-action)" /> : <I.check size={13} />}{isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}
