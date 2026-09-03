'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import type { Tables } from '@garsonless/db/types'
import type { IntegrationHealth } from '@garsonless/application/settings'
import { I } from '../../lib/ui'
import { SCard, FormRow } from './primitives'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '../ui/field'
import { Input } from '../ui/input'
import { notifySettingsConflict } from './settings-conflict-state'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '../ui/item'
import { Spinner } from '../ui/spinner'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Slider } from '../ui/slider'
import { Switch } from '../ui/switch'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
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
import {
  readNotificationPrefs,
  type NotificationPrefs,
  type OrderSoundPreset,
  type OrderSoundRepeatSeconds,
} from '../../lib/notification-prefs'
import { readLateThresholdMin, clampLateThreshold, LATE_THRESHOLD_MIN_MIN, LATE_THRESHOLD_MIN_MAX } from '../../lib/orders-prefs'
import { notifySettingsSaved, useSettingsDirtyState } from './settings-dirty-state'
import { useDashboardPushSubscription } from '../notifications/useDashboardPushSubscription'
import { playOrderAlertSound } from '../notifications/order-alert-audio'
import { testDashboardPush } from '../../lib/actions/push-subscriptions'
import {
  mergeCanonicalSettings,
  prepareSettingsMutationAttempt,
  type SettingsMutationAttempt,
} from './settings-save-contract'

/* ── PAYMENTS ─────────────────────────────────────── */
export function PaymentsSection({ restaurantId, health }: { restaurantId: string; health: IntegrationHealth | null }) {
  const [provider, setProvider] = useState<{ meta: PaymentCredsMeta | null; loading: boolean }>({ meta: null, loading: true })
  const onlineStatus = provider.loading
    ? { label: 'Kontrol ediliyor', tone: 'neutral' as const, body: 'İyzico çalışma ortamı ve credential durumu doğrulanıyor.' }
    : !provider.meta?.configured
      ? { label: 'Kapalı', tone: 'neutral' as const, body: 'Müşteri kart ödemesi için İyzico credential bağlantısı gerekli.' }
      : provider.meta.mode === 'sandbox'
        ? { label: 'Yalnız test', tone: 'neutral' as const, body: 'Sandbox credential bağlıdır; gerçek müşteriden tahsilat yapılamaz.' }
        : health?.state === 'healthy' && health.lastSuccessAt
          ? { label: 'Aktif', tone: 'positive' as const, body: `Canlı credential son olarak ${new Date(health.lastSuccessAt).toLocaleString('tr-TR')} tarihinde doğrulandı.` }
          : health?.state === 'error'
            ? { label: 'Hata', tone: 'neutral' as const, body: 'Canlı credential son sağlık kontrolünü geçemedi; kart tahsilatı aktif kabul edilmez.' }
            : { label: 'Test gerekli', tone: 'neutral' as const, body: 'Canlı credential bağlıdır; “Bağlantıyı test et” sonucu doğrulanmadan aktif kabul edilmez.' }

  return (
    <div className="flex flex-col gap-5">
      <IyzicoCredentialsCard restaurantId={restaurantId} onStatusChange={setProvider} />

      <SCard title="Gerçek ödeme yolları" subtitle="Bu bölüm yalnızca bugün çalışan akışları gösterir">
        <ItemGroup className="gap-0">
          <PaymentPath
            icon={<I.card />}
            title="Müşteri kart ödemesi"
            body={onlineStatus.body}
            status={onlineStatus.label}
            tone={onlineStatus.tone}
          />
          <ItemSeparator className="my-0" />
          <PaymentPath
            icon={<I.receipt />}
            title="Garson tahsilatı"
            body="Nakit, fiziksel POS ve İkram tahsilatları masa kapatma ekranında personel tarafından işlenir."
            status="Panelden"
            tone="neutral"
          />
          <ItemSeparator className="my-0" />
          <PaymentPath
            icon={<I.gift />}
            title="Hesap bölüşme"
            body={provider.meta?.mode === 'sandbox'
              ? 'Pay oluşturma ve nakit beyanı kullanılabilir; kart payı yalnız İyzico sandbox testidir.'
              : 'Müşteri pay oluşturabilir; kart payının durumu İyzico bağlantı sağlığına bağlıdır, nakit beyanı garson onayı bekler.'}
            status={provider.meta?.mode === 'sandbox' ? 'Kart testi' : onlineStatus.label}
            tone="neutral"
          />
        </ItemGroup>
        <div className="border-t px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          Dijital cüzdanlar, banka transferi, yemek kartları, otomatik servis ücreti ve e-fatura gönderimi bu sürümde
          yapılandırılabilir bir ödeme yöntemi değildir.
        </div>
      </SCard>
    </div>
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
    <Item size="sm" className="rounded-none px-4 py-3">
      <ItemMedia variant="icon" className="size-10 rounded-lg bg-muted text-muted-foreground">
        {icon}
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{body}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant={tone === 'positive' ? 'positive' : 'secondary'}>{status}</Badge>
      </ItemActions>
    </Item>
  )
}

/* ── İYZİCO CREDENTIALS ───────────────────────────── */
function IyzicoCredentialsCard({
  restaurantId,
  onStatusChange,
}: {
  restaurantId: string
  onStatusChange: (value: { meta: PaymentCredsMeta | null; loading: boolean }) => void
}) {
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

  useEffect(() => {
    onStatusChange({ meta, loading })
  }, [loading, meta, onStatusChange])

  useEffect(() => {
    let cancelled = false
    void getPaymentCredentialsMeta(restaurantId)
      .then((result) => {
        if (cancelled) return
        if ('error' in result) setFeedback({ ok: false, text: result.error })
        else { setMeta(result); setMode(result.mode) }
      })
      .catch(() => { if (!cancelled) setFeedback({ ok: false, text: 'İyzico bağlantı durumu yüklenemedi. Tekrar deneyin.' }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [restaurantId])

  async function handleSave() {
    setBusy('save')
    setFeedback(null)
    try {
      const result = await savePaymentCredentials(restaurantId, {
        apiKey, secretKey, mode, requestId: crypto.randomUUID(), currentPassword,
      })
      if ('error' in result) return setFeedback({ ok: false, text: result.error })
      setMeta(result.meta)
      setApiKey(''); setSecretKey(''); setCurrentPassword(''); setEditing(false)
      setFeedback({ ok: true, text: 'Anahtarlar kaydedildi' })
      notifySettingsSaved()
    } catch {
      setFeedback({ ok: false, text: 'Bağlantı kesildi. Anahtarlar kaydedilmedi; tekrar deneyin.' })
    } finally {
      setBusy(null)
    }
  }

  async function handleTest() {
    setBusy('test')
    setFeedback(null)
    try {
      const result = await testPaymentCredentials(restaurantId)
      setFeedback({ ok: result.ok, text: result.message })
    } catch {
      setFeedback({ ok: false, text: 'Bağlantı testi tamamlanamadı. Tekrar deneyin.' })
    } finally { setBusy(null) }
  }

  async function handleDelete() {
    setBusy('delete')
    setFeedback(null)
    try {
      const result = await deletePaymentCredentials(restaurantId, { requestId: crypto.randomUUID(), currentPassword })
      if ('error' in result) return setFeedback({ ok: false, text: result.error })
      setMeta({ configured: false, mode: 'sandbox', apiKeyLast4: null, updatedAt: null, protection: 'none', requiresRotation: false })
      setCurrentPassword(''); setConfirming(null)
      setFeedback({ ok: true, text: 'Anahtarlar kaldırıldı' })
      notifySettingsSaved()
    } catch {
      setFeedback({ ok: false, text: 'Bağlantı kesildi. Anahtarlar kaldırılmadı.' })
    } finally { setBusy(null) }
  }

  async function handleRotate() {
    setBusy('rotate')
    setFeedback(null)
    try {
      const result = await rotatePaymentCredentialsEncryption(restaurantId, { requestId: crypto.randomUUID(), currentPassword })
      if ('error' in result) return setFeedback({ ok: false, text: result.error })
      setMeta(result.meta); setCurrentPassword(''); setConfirming(null)
      setFeedback({ ok: true, text: 'Credential şifrelemesi güncel anahtara taşındı' })
      notifySettingsSaved()
    } catch {
      setFeedback({ ok: false, text: 'Bağlantı kesildi. Şifreleme rotasyonu tamamlanmadı.' })
    } finally { setBusy(null) }
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
    <>
      <Card size="sm" className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span>İyzico</span>
            {!loading && configured && <Badge variant="positive">Bağlandı</Badge>}
            {!loading && configured && (
              <Badge variant={meta?.mode === 'live' ? 'destructive' : 'secondary'}>
                {meta?.mode === 'live' ? 'Canlı' : 'Sandbox'}
              </Badge>
            )}
            {!loading && meta?.requiresRotation && <Badge variant="warning">Şifreleme yenilenmeli</Badge>}
            {!loading && !configured && <Badge variant="secondary">Yapılandırılmadı</Badge>}
          </CardTitle>
          <CardDescription>
            {loading
              ? 'Yükleniyor…'
              : configured
                ? `API Key •••• son 4: ${meta?.apiKeyLast4 ?? '????'}`
                : 'Ödeme almak için İyzico API anahtarlarını girin'}
          </CardDescription>
        </CardHeader>

        {editing && (
          <CardContent className="p-0">
          <FormRow label="API Key">
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sandbox-..."
              autoComplete="off"
              className="w-80 max-w-full font-mono"
            />
          </FormRow>
          <FormRow label="Secret Key">
            <Input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="sandbox-..."
              autoComplete="new-password"
              className="w-80 max-w-full font-mono"
            />
          </FormRow>
          <FormRow label="Hesap şifresi" hint="Bu hassas işlem için owner hesabını yeniden doğrular">
            <Input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              className="w-80 max-w-full"
            />
          </FormRow>
          <FormRow label="Ortam" hint="Sandbox: test ödemeleri · Canlı: gerçek tahsilat">
            <ToggleGroup
              value={[mode]}
              onValueChange={(values) => {
                const nextMode = values[0]
                if (nextMode === 'sandbox' || nextMode === 'live') setMode(nextMode)
              }}
              variant="outline"
              size="sm"
              spacing={1}
              aria-label="İyzico çalışma ortamı"
            >
              <ToggleGroupItem value="sandbox">Sandbox</ToggleGroupItem>
              <ToggleGroupItem value="live">Canlı</ToggleGroupItem>
            </ToggleGroup>
          </FormRow>
          </CardContent>
        )}

        {feedback && (
          <CardContent className="border-t p-3">
            <Alert role={feedback.ok ? 'status' : 'alert'} variant={feedback.ok ? 'default' : 'destructive'}>
              <AlertDescription>{feedback.text}</AlertDescription>
            </Alert>
          </CardContent>
        )}

        {!loading && (
          <CardFooter className="flex flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {!editing && configured && (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={busy !== null}>
                    {busy === 'test' && <Spinner data-icon="inline-start" />}
                    {busy === 'test' ? 'Test ediliyor…' : 'Bağlantıyı test et'}
                  </Button>
                  {meta?.requiresRotation && (
                    <Button type="button" variant="outline" size="sm" onClick={() => beginSensitiveAction('rotate')} disabled={busy !== null}>
                      Şifrelemeyi yenile
                    </Button>
                  )}
                  <Button type="button" variant="destructive" size="sm" onClick={() => beginSensitiveAction('delete')} disabled={busy !== null}>
                    Kaldır
                  </Button>
                </>
              )}
            </div>

            {editing ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditing(false); setApiKey(''); setSecretKey(''); setCurrentPassword(''); setFeedback(null); notifySettingsSaved() }}
                  disabled={busy !== null}
                >
                  Vazgeç
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={busy !== null || apiKey.trim().length < 10 || secretKey.trim().length < 10 || currentPassword.length === 0}
                >
                  {busy === 'save' && <Spinner data-icon="inline-start" />}
                  {busy === 'save' ? 'Kaydediliyor…' : 'Kaydet'}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => { setConfirming(null); setCurrentPassword(''); setEditing(true); setFeedback(null) }}
              >
                {configured ? 'Değiştir' : 'Bağla'}
              </Button>
            )}
          </CardFooter>
        )}
      </Card>

      {confirming && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open && busy === null) cancelSensitiveAction()
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirming === 'delete' ? 'İyzico anahtarlarını kaldır' : 'Şifrelemeyi yenile'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirming === 'delete'
                  ? 'Bu restoran için kart ödemeleri durur. Devam etmek için owner hesap şifreni doğrula.'
                  : 'Kayıtlı secret güncel şifreleme anahtarına taşınır. Devam etmek için owner hesap şifreni doğrula.'}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <FieldGroup>
              <Field data-invalid={feedback && !feedback.ok ? true : undefined}>
                <FieldLabel htmlFor="payment-confirm-password">Hesap şifresi</FieldLabel>
                <Input
                  id="payment-confirm-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  aria-invalid={feedback && !feedback.ok ? true : undefined}
                />
                <FieldDescription>Şifren yoksa önce Güvenlik bölümünden bir şifre belirle.</FieldDescription>
              </Field>
            </FieldGroup>

            {feedback && !feedback.ok && (
              <Alert variant="destructive">
                <AlertDescription>{feedback.text}</AlertDescription>
              </Alert>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy !== null}>Vazgeç</AlertDialogCancel>
              <AlertDialogAction
                type="button"
                variant={confirming === 'delete' ? 'destructive' : 'default'}
                onClick={confirming === 'delete' ? handleDelete : handleRotate}
                disabled={busy !== null || currentPassword.length === 0}
              >
                {(busy === 'delete' || busy === 'rotate') && <Spinner data-icon="inline-start" />}
                {busy === 'delete'
                  ? 'Kaldırılıyor…'
                  : busy === 'rotate'
                    ? 'Yenileniyor…'
                    : confirming === 'delete'
                      ? 'Anahtarları kaldır'
                      : 'Şifrelemeyi yenile'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}

/* ── NOTIFICATIONS ────────────────────────────────── */
// Toggles map only to notification surfaces that are actually implemented:
//   newOrderSound / newOrderPush  → global shell alarm + Web Notification
//   newOrderToast                 → global shell OrderToast
//   serviceRequestAlert           → "Garson çağrısı" toast in the dashboard shell
//   serviceRequestPush            → durable operating-system waiter-call alert
// E-posta tercihleri aşağıda kullanıcı bazında yönetilir. SMS ve eski "sessiz
// saatler" taslağı bu restoran düzeyi anahtarların dışında tutulur.
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
  { key: 'lifecycle', label: 'Kurulum hatırlatmaları', hint: 'Tamamlanmamış işletme kurulumu için 24 ve 72 saatlik e-posta hatırlatmaları (isteğe bağlı)' },
]

function EmailPrefsBlock({ restaurantId }: { restaurantId: string }) {
  const [prefs, setEmailPrefs] = useState<EmailNotificationPrefs | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void getMyEmailNotificationPrefs(restaurantId)
      .then((result) => {
        if (cancelled) return
        if ('order' in result) setEmailPrefs(result)
        else setError(result.error)
      })
      .catch(() => { if (!cancelled) setError('E-posta tercihleri yüklenemedi. Tekrar deneyin.') })
    return () => { cancelled = true }
  }, [restaurantId])

  const toggle = (key: keyof EmailNotificationPrefs, value: boolean) => {
    if (!prefs) return
    const next = { ...prefs, [key]: value }
    const previous = prefs
    setEmailPrefs(next)
    setError('')
    void saveMyEmailNotificationPrefs(restaurantId, next)
      .then((result) => {
        if ('error' in result) { setEmailPrefs(previous); setError(result.error) }
      })
      .catch(() => { setEmailPrefs(previous); setError('Bağlantı kesildi. Tercih kaydedilmedi.') })
  }

  return (
    <section className="border-t">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
        <div>
          <h3 className="text-sm font-medium">E-posta bildirimleri</h3>
          <p className="text-sm text-muted-foreground">Yalnızca bu kullanıcı hesabı için geçerlidir.</p>
        </div>
        {prefs === null && !error ? <span role="status"><Spinner className="text-muted-foreground" /><span className="sr-only">E-posta tercihleri yükleniyor…</span></span> : <Badge variant="secondary">Kişisel</Badge>}
      </div>
      <FieldGroup className="gap-0">
        {EMAIL_PREF_ROWS.map(row => {
          const controlId = `email-notification-${row.key}`
          return (
            <Field key={row.key} orientation="horizontal" className="border-b px-4 py-3 last:border-b-0">
              <FieldContent>
                <FieldLabel htmlFor={controlId}>{row.label}</FieldLabel>
                <FieldDescription>{row.hint}</FieldDescription>
              </FieldContent>
              <Switch
                id={controlId}
                checked={prefs?.[row.key] ?? false}
                disabled={prefs === null}
                onCheckedChange={value => toggle(row.key, value)}
              />
            </Field>
          )
        })}
      </FieldGroup>
      {error && (
        <Alert variant="destructive" className="m-4 mt-0">
          <I.warn />
          <AlertTitle>E-posta tercihleri kaydedilemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </section>
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
  const initialNotificationRef = useRef({ prefs, lateThreshold })
  const notificationsDirty = JSON.stringify({ prefs, lateThreshold }) !== JSON.stringify(initialNotificationRef.current)
  const pushPreferenceDirty = prefs.newOrderPush !== initialNotificationRef.current.prefs.newOrderPush
    || prefs.serviceRequestPush !== initialNotificationRef.current.prefs.serviceRequestPush
  const hasEnabledPushChannel = prefs.newOrderPush || prefs.serviceRequestPush
  useSettingsDirtyState('notifications:operations', notificationsDirty)

  function setToggle(key: NotificationToggleKey, value: boolean) {
    setPrefs(prev => ({ ...prev, [key]: value }))
    setSaved(false)
    if (
      value
      && (key === 'newOrderPush' || key === 'serviceRequestPush')
      && device.status !== 'subscribed'
    ) {
      // Keep the browser permission request inside the user's switch gesture.
      // An enabled restaurant preference alone cannot create a device endpoint.
      void device.subscribe()
    }
  }

  function updateSoundPrefs(patch: Partial<NotificationPrefs>) {
    setPrefs(prev => ({ ...prev, ...patch }))
    setSaved(false)
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
        if ('code' in result && result.code === 'CONFLICT') {
          mutationAttemptRef.current = null
          const canonicalSettings = result.canonicalSettings ?? {}
          notifySettingsConflict({
            source: 'notifications:operations', canonicalSettings, draft: settingsPatch,
            prepareReapply: () => { settingsSnapshotRef.current = mergeCanonicalSettings(settingsSnapshotRef.current, canonicalSettings) },
          })
        }
        setError(result.error)
        return
      }
      settingsSnapshotRef.current = mergeCanonicalSettings(settingsSnapshotRef.current, result.canonicalSettings)
      mutationAttemptRef.current = null
      setLateThreshold(String(clamped))
      initialNotificationRef.current = { prefs, lateThreshold: String(clamped) }
      setSaved(true)
      notifySettingsSaved('notifications:operations')
    })
  }

  return (
    <form onSubmit={handleSave} aria-busy={isPending}>
      <Card size="sm" className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <CardTitle>Bildirimler</CardTitle>
          <CardDescription>Sipariş, masa ve tarayıcı bildirim tercihlerini yönetin.</CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <FieldGroup className="gap-0">
            {NOTIFICATION_ROWS.map(row => {
              const locked = (row.key === 'newOrderPush' || row.key === 'serviceRequestPush') && !browserNotificationsEnabled
              const controlId = `notification-${row.key}`
              return (
                <Field key={row.key} orientation="horizontal" data-disabled={locked || undefined} className="border-b px-4 py-3">
                  <FieldContent>
                    <div className="flex flex-wrap items-center gap-2">
                      <FieldLabel htmlFor={controlId}>{row.label}</FieldLabel>
                      {locked && <Badge variant="secondary">Pro</Badge>}
                    </div>
                    <FieldDescription>{row.hint}</FieldDescription>
                  </FieldContent>
                  <Switch
                    id={controlId}
                    checked={prefs[row.key]}
                    disabled={locked}
                    aria-label={locked ? `${row.label}, Pro paketi gerekir` : row.label}
                    onCheckedChange={value => setToggle(row.key, value)}
                  />
                </Field>
              )
            })}
          </FieldGroup>

          <section className="border-b bg-muted/20 px-4 py-4">
            <FieldSet>
              <FieldLegend className="flex w-full items-center justify-between gap-2">
                <span>Yeni sipariş sesi</span>
                <Badge variant={prefs.newOrderSound ? 'positive' : 'secondary'}>
                  {prefs.newOrderSound ? 'Açık' : 'Kapalı'}
                </Badge>
              </FieldLegend>
              <FieldDescription>Ses biçimini, seviyesini ve tekrar süresini ayarlayın.</FieldDescription>
              <FieldGroup className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Field data-disabled={!prefs.newOrderSound || undefined}>
                  <FieldLabel>Ses</FieldLabel>
                  <Select
                    value={prefs.newOrderSoundPreset}
                    disabled={!prefs.newOrderSound}
                    onValueChange={(value) => updateSoundPrefs({ newOrderSoundPreset: value as OrderSoundPreset })}
                  >
                    <SelectTrigger className="w-full" aria-label="Yeni sipariş sesi">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Güçlü</SelectLabel>
                        <SelectItem value="masabu-alert">Masabu alarmı</SelectItem>
                        <SelectItem value="kitchen-pulse">Güçlü mutfak zili</SelectItem>
                        <SelectItem value="double-strike">Çift darbe</SelectItem>
                        <SelectItem value="urgent-triple">Hızlı üçlü</SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Standart</SelectLabel>
                        <SelectItem value="classic">Klasik</SelectItem>
                        <SelectItem value="kitchen-bell">Mutfak zili</SelectItem>
                        <SelectItem value="double-chime">Üçlü melodi</SelectItem>
                        <SelectItem value="soft-ping">Yumuşak ping</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field data-disabled={!prefs.newOrderSound || undefined}>
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel>Ses seviyesi</FieldLabel>
                    <span className="tabular-nums text-xs font-medium text-muted-foreground">%{prefs.newOrderSoundVolume}</span>
                  </div>
                  <div className="flex h-8 items-center px-1">
                    <Slider
                      aria-label="Yeni sipariş ses seviyesi"
                      min={0}
                      max={100}
                      step={5}
                      value={prefs.newOrderSoundVolume}
                      disabled={!prefs.newOrderSound}
                      onValueChange={(next) => updateSoundPrefs({
                        newOrderSoundVolume: Number(Array.isArray(next) ? next[0] ?? prefs.newOrderSoundVolume : next),
                      })}
                    />
                  </div>
                </Field>

                <Field data-disabled={!prefs.newOrderSound || undefined}>
                  <FieldLabel>Tekrar</FieldLabel>
                  <Select
                    value={String(prefs.newOrderRepeatSeconds)}
                    disabled={!prefs.newOrderSound}
                    onValueChange={(value) => updateSoundPrefs({ newOrderRepeatSeconds: Number(value) as OrderSoundRepeatSeconds })}
                  >
                    <SelectTrigger className="w-full" aria-label="Yeni sipariş sesi tekrar aralığı"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="0">Tekrar etme</SelectItem>
                        <SelectItem value="5">5 saniyede bir</SelectItem>
                        <SelectItem value="10">10 saniyede bir</SelectItem>
                        <SelectItem value="15">15 saniyede bir</SelectItem>
                        <SelectItem value="30">30 saniyede bir</SelectItem>
                        <SelectItem value="60">60 saniyede bir</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field data-disabled={!prefs.newOrderSound || prefs.newOrderRepeatSeconds === 0 || undefined}>
                  <FieldLabel>En fazla</FieldLabel>
                  <Select
                    value={String(prefs.newOrderRepeatMaxMinutes)}
                    disabled={!prefs.newOrderSound || prefs.newOrderRepeatSeconds === 0}
                    onValueChange={(value) => updateSoundPrefs({ newOrderRepeatMaxMinutes: Number(value) })}
                  >
                    <SelectTrigger className="w-full" aria-label="Yeni sipariş sesi azami tekrar süresi"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {[1, 3, 5, 10].map((minute) => <SelectItem key={minute} value={String(minute)}>{minute} dakika</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!prefs.newOrderSound || soundTest === 'playing'}
                  onClick={() => {
                    setSoundTest('playing')
                    void playOrderAlertSound(prefs.newOrderSoundPreset, prefs.newOrderSoundVolume)
                      .then((played) => setSoundTest(played ? 'idle' : 'blocked'))
                  }}
                >
                  {soundTest === 'playing' ? <Spinner data-icon="inline-start" /> : <I.bell data-icon="inline-start" />}
                  {soundTest === 'playing' ? 'Çalıyor…' : 'Sesi test et'}
                </Button>
                {soundTest === 'blocked' && (
                  <span role="status" className="text-sm text-[var(--warning)]">
                    Tarayıcı sesi engelledi. Sayfaya dokunup tekrar deneyin.
                  </span>
                )}
              </div>
            </FieldSet>
          </section>

          <Field orientation="responsive" className="border-b px-4 py-3">
            <FieldContent>
              <FieldLabel htmlFor="late-threshold">Gecikme eşiği</FieldLabel>
              <FieldDescription>Mutfak aşamasında bu süreyi aşan sipariş panoda “Geciken” sayılır.</FieldDescription>
            </FieldContent>
            <div className="flex items-center gap-2">
              <Input
                id="late-threshold"
                type="number"
                min={LATE_THRESHOLD_MIN_MIN}
                max={LATE_THRESHOLD_MIN_MAX}
                value={lateThreshold}
                className="w-24 tabular-nums"
                onChange={event => {
                  setLateThreshold(event.target.value)
                  setSaved(false)
                }}
              />
              <span className="text-sm text-muted-foreground">dakika</span>
            </div>
          </Field>

          <EmailPrefsBlock restaurantId={restaurant.id} />

          {browserNotificationsEnabled && (
            <section className="border-t px-4 py-4">
              <Field orientation="responsive">
                <FieldContent>
                  <div className="flex flex-wrap items-center gap-2">
                    <FieldTitle>Bu cihaz</FieldTitle>
                    <Badge variant={device.status === 'subscribed' && hasEnabledPushChannel && !pushPreferenceDirty ? 'positive' : device.status === 'denied' ? 'destructive' : 'secondary'}>
                      {device.status === 'subscribed'
                        ? pushPreferenceDirty
                          ? 'Kaydedilmedi'
                          : hasEnabledPushChannel
                            ? 'Etkin'
                            : 'Cihaz bağlı'
                        : device.status === 'subscribing'
                          ? 'Bağlanıyor'
                          : device.status === 'denied'
                            ? 'İzin engelli'
                            : device.status === 'unconfigured'
                              ? 'Yapılandırılmamış'
                              : device.status === 'unsupported'
                                ? 'Desteklenmiyor'
                                : device.status === 'error'
                                  ? 'Bağlantı hatası'
                                  : 'Kapalı'}
                    </Badge>
                  </div>
                  <FieldDescription>
                    {device.status === 'subscribed'
                      ? pushPreferenceDirty
                        ? 'Cihaz bağlandı; bildirim tercihinin geçerli olması için Kaydet’e basın.'
                        : hasEnabledPushChannel
                          ? 'Panel kapalıyken de seçtiğiniz sistem bildirimlerini alır.'
                          : 'Cihaz bağlı, ancak hiçbir sistem bildirimi seçili değil. Yukarıdan bir tercih açıp Kaydet’e basın.'
                      : device.status === 'unconfigured'
                        ? 'Web Push anahtarı bu ortamda yapılandırılmamış.'
                        : device.status === 'denied'
                          ? 'Tarayıcı izni engellenmiş; site ayarlarından açın.'
                          : device.status === 'unsupported'
                            ? 'Bu tarayıcı Web Push veya service worker desteği sunmuyor.'
                            : device.error ?? 'Bildirim tercihini açtığınızda bu cihaz da otomatik olarak bağlanır.'}
                  </FieldDescription>
                </FieldContent>
                <div className="flex flex-wrap items-center gap-2">
                  {device.status === 'subscribed' && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pushTest === 'sending'}
                      onClick={() => {
                        setPushTest('sending')
                        void testDashboardPush(restaurant.id).then((result) => setPushTest('error' in result ? 'failed' : 'sent'))
                      }}
                    >
                      {pushTest === 'sending' ? <Spinner data-icon="inline-start" /> : <I.bell data-icon="inline-start" />}
                      {pushTest === 'sending' ? 'Gönderiliyor…' : pushTest === 'sent' ? 'Gönderildi' : pushTest === 'failed' ? 'Tekrar dene' : 'Test gönder'}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant={device.status === 'subscribed' ? 'outline' : 'default'}
                    disabled={device.status === 'subscribing' || device.status === 'unconfigured' || device.status === 'denied' || device.status === 'unsupported'}
                    onClick={() => void (device.status === 'subscribed' ? device.unsubscribe() : device.subscribe())}
                  >
                    {device.status === 'subscribing'
                      ? <Spinner data-icon="inline-start" />
                      : device.status === 'subscribed'
                        ? <I.check data-icon="inline-start" />
                        : <I.bell data-icon="inline-start" />}
                    {device.status === 'subscribed'
                      ? 'Bu cihazı kapat'
                      : device.status === 'subscribing'
                        ? 'Etkinleştiriliyor…'
                        : 'Bu cihazı etkinleştir'}
                  </Button>
                </div>
              </Field>
            </section>
          )}

          <Alert className="m-4">
            <I.bell />
            <AlertTitle>Bildirim teslimatı</AlertTitle>
            <AlertDescription>
              Uygulama içi uyarılar tüm paketlerde çalışır. Sistem bildirimleri Pro paketinde
              tarayıcı izni gerektirir. E-posta tercihleri kişiseldir; SMS henüz desteklenmiyor.
            </AlertDescription>
          </Alert>
        </CardContent>

        <CardFooter className="flex-wrap justify-between gap-3">
          <span role={error ? 'alert' : 'status'} className={error ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
            {error || (saved ? 'Değişiklikler kaydedildi' : 'Değişiklikleri kaydetmeyi unutmayın')}
          </span>
          <Button type="submit" disabled={isPending || !notificationsDirty}>
            {isPending ? <Spinner data-icon="inline-start" /> : <I.check data-icon="inline-start" />}
            {isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
