'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { I, S, Tag } from '../../lib/ui'
import { SCard, FormRow } from './primitives'
import {
  changePassword,
  getDashboardMfaStatus,
  removeTotpFactor,
  requestEmailChange,
  sendPasswordResetEmail,
  signOutOtherSessions,
  startTotpEnrollment,
  verifyTotpEnrollment,
} from '../../lib/actions/auth'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Spinner } from '../ui/spinner'
import type { IntegrationHealth } from '@garsonless/application/settings'
import { createPrivacyOperation } from '../../lib/actions/privacy'
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

/* ── API & WEBHOOKS ───────────────────────────────── */
export function ApiSection({ resendHealth }: { resendHealth: IntegrationHealth | null }) {
  return (
    <>
      <Alert className="mb-5">
        <I.code />
        <AlertTitle>Geliştirici erişimi henüz kapalı</AlertTitle>
        <AlertDescription>
          Bu restorana ait gerçek API endpoint doğrulaması ve webhook gönderimi bu sürümde yok. Bu yüzden anahtar üretimi ve webhook ayarları pasif tutulur.
        </AlertDescription>
      </Alert>

      <SCard title="API anahtarları" subtitle="Gerçek API gateway eklendiğinde açılacak">
        <FormRow label="Durum" hint="Şu anda hiçbir endpoint bu anahtarlarla istek kabul etmiyor">
          <Tag tone="neutral">Yakında</Tag>
        </FormRow>
        <FormRow label="Anahtar üretimi">
          <Button type="button" variant="outline" disabled>
            <I.lock data-icon="inline-start" />Pasif
          </Button>
        </FormRow>
      </SCard>

      <SCard title="Webhooks" subtitle="Gerçek gönderim altyapısı henüz yok" style={{ marginTop: 16 }}>
        <FormRow label="Hedef URL">
          <Input disabled value="" placeholder="Webhook URL desteği yakında" className="w-80 font-mono" />
        </FormRow>
        <FormRow label="Olaylar" hint="Sipariş/ödeme/menu event gönderimi ayrı API epic'inde açılacak">
          <Tag tone="neutral">Kapalı</Tag>
        </FormRow>
      </SCard>

      <SCard title="E-posta teslimatı" subtitle="Resend platform tarafından yönetilir; tenant secret girişi yoktur" style={{ marginTop: 16 }}>
        <FormRow label="Sağlayıcı"><Tag tone="neutral">Platform-managed Resend</Tag></FormRow>
        <FormRow label="Sağlık" hint={resendHealth?.lastSuccessAt ? `Son başarılı kontrol: ${new Date(resendHealth.lastSuccessAt).toLocaleString('tr-TR')}` : 'Henüz başarılı bir sağlık kontrolü kaydedilmedi'}>
          <Tag tone={resendHealth?.state === 'healthy' ? 'positive' : 'neutral'}>
            {resendHealth?.state === 'healthy' ? 'Sağlıklı' : resendHealth?.state === 'error' ? 'Hata' : resendHealth?.state === 'untested' ? 'Test edilmedi' : 'Yapılandırılmadı'}
          </Tag>
        </FormRow>
        <FormRow label="Gönderici alan adı" hint="Doğrulama ve yeniden bağlama platform operasyonları tarafından yönetilir">
          <Tag tone="neutral">Tenant kontrolü kapalı</Tag>
        </FormRow>
      </SCard>
    </>
  )
}

/* ── SECURITY ─────────────────────────────────────── */
export interface SecurityEventView {
  id: string
  eventType: 'login' | 'password_change'
  ip: string | null
  userAgent: string | null
  createdAt: string
}

function securityEventLabel(type: SecurityEventView['eventType']): string {
  return type === 'password_change' ? 'Şifre değiştirildi' : 'Giriş yapıldı'
}

function relativeTime(iso: string, asOf: string): string {
  const then = new Date(iso).getTime()
  const now = new Date(asOf).getTime()
  if (Number.isNaN(then) || Number.isNaN(now)) return ''
  const min = Math.floor((now - then) / 60_000)
  if (min < 1) return 'az önce'
  if (min < 60) return `${min} dk önce`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} saat önce`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'dün'
  if (day < 30) return `${day} gün önce`
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul',
  })
}

function deviceSummary(ua: string | null): string {
  if (!ua) return 'Bilinmeyen cihaz'
  const browser =
    /Edg/.test(ua) ? 'Edge' :
    /OPR|Opera/.test(ua) ? 'Opera' :
    /Chrome|CriOS/.test(ua) ? 'Chrome' :
    /Firefox|FxiOS/.test(ua) ? 'Firefox' :
    /Safari/.test(ua) ? 'Safari' : 'Tarayıcı'
  const os =
    /iPhone|iPad|iPod|iOS/.test(ua) ? 'iOS' :
    /Android/.test(ua) ? 'Android' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Windows/.test(ua) ? 'Windows' :
    /Linux/.test(ua) ? 'Linux' : ''
  return os ? `${browser} · ${os}` : browser
}

function providerLabel(provider: string | null): string {
  if (provider === 'google') return 'Google'
  if (provider === 'apple') return 'Apple'
  return 'giriş sağlayıcın'
}

export function SecuritySection({ events, renderedAt, userEmail, authProvider }: { events: SecurityEventView[]; renderedAt: string; userEmail: string; authProvider: string | null }) {
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [securityMessage, setSecurityMessage] = useState('')
  const [securityError, setSecurityError] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [securityPassword, setSecurityPassword] = useState('')
  const [mfaFactors, setMfaFactors] = useState<Array<{ id: string; friendlyName: string | null; status: string }>>([])
  const [mfaAal, setMfaAal] = useState<string | null>(null)
  const [mfaLoading, setMfaLoading] = useState(true)
  const [mfaEnrollment, setMfaEnrollment] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [isSecurityPending, startSecurityTransition] = useTransition()
  const [isPending, startTransition] = useTransition()
  const [isResetPending, startResetTransition] = useTransition()
  const usesExternalProvider = Boolean(authProvider && authProvider !== 'email')

  const refreshMfa = useCallback(() => getDashboardMfaStatus()
    .then((result) => {
      if ('error' in result) { setSecurityError(true); setSecurityMessage(result.error) }
      else { setMfaFactors(result.factors.filter((factor) => factor.status === 'verified')); setMfaAal(result.aal) }
    })
    .catch(() => { setSecurityError(true); setSecurityMessage('İki faktörlü doğrulama durumu yüklenemedi.') })
    .finally(() => setMfaLoading(false)), [])

  useEffect(() => { void refreshMfa() }, [refreshMfa])

  function runSecurityAction(action: () => Promise<{ error: string } | { success: true }>, success: string) {
    setSecurityMessage(''); setSecurityError(false)
    startSecurityTransition(async () => {
      try {
        const result = await action()
        if ('error' in result) { setSecurityError(true); setSecurityMessage(result.error); return }
        setSecurityPassword(''); setSecurityMessage(success)
      } catch {
        setSecurityError(true); setSecurityMessage('Bağlantı kesildi. İşlem tamamlanmadı.')
      }
    })
  }

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaved(false)
    if (next !== confirm) { setError('Yeni şifreler eşleşmiyor'); return }
    startTransition(async () => {
      const res = await changePassword({ currentPassword: current, newPassword: next })
      if ('error' in res) { setError(res.error); return }
      setSaved(true); setCurrent(''); setNext(''); setConfirm('')
      router.refresh() // re-fetch the SSR activity log incl. the new password_change event
    })
  }

  function handleSendPasswordReset() {
    setResetMessage('')
    startResetTransition(async () => {
      const res = await sendPasswordResetEmail()
      setResetMessage('error' in res ? res.error : 'Şifre belirleme bağlantısını e-posta adresine gönderdik.')
    })
  }

  return (
    <>
      {/* Password users can re-authenticate before changing; OAuth users use a
          recovery link so a non-existent current password is never requested. */}
      <SCard title="Şifre" subtitle={`${userEmail} hesabının şifresini değiştir`}>
        {usesExternalProvider ? (
          <div style={{ padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Bu hesap {providerLabel(authProvider)} ile giriş yapıyor</div>
            <p style={{ margin: '5px 0 14px', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>Mevcut şifre istenmez. İstersen e-posta ile doğrudan giriş için yeni bir şifre belirleyebilirsin.</p>
            <Button type="button" onClick={handleSendPasswordReset} disabled={isResetPending}>
              {isResetPending && <Spinner data-icon="inline-start" />}
              {isResetPending ? 'Gönderiliyor…' : 'Şifre belirleme e-postası gönder'}
            </Button>
            {resetMessage && <div role={resetMessage === 'Şifre belirleme bağlantısını e-posta adresine gönderdik.' ? 'status' : 'alert'} style={{ marginTop: 10, fontSize: 12, color: resetMessage === 'Şifre belirleme bağlantısını e-posta adresine gönderdik.' ? 'var(--positive)' : 'var(--critical)' }}>{resetMessage}</div>}
          </div>
        ) : <form onSubmit={handleChangePassword} aria-busy={isPending}>
          <FormRow label="Mevcut şifre">
            <Input type="password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" className="w-55" />
          </FormRow>
          <FormRow label="Yeni şifre" hint="En az 8 karakter">
            <Input type="password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" className="w-55" />
          </FormRow>
          <FormRow label="Yeni şifre (tekrar)">
            <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" className="w-55" />
          </FormRow>
          <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span role={error ? 'alert' : 'status'} style={{ fontSize: 12, color: error ? 'var(--critical)' : 'var(--text-3)', maxWidth: 280 }}>
              {error || (saved ? '✓ Şifre güncellendi' : 'Mevcut şifreni doğrulamamız gerekiyor. Parolan yoksa e-posta ile belirleyebilirsin.')}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="button" variant="outline" size="sm" onClick={handleSendPasswordReset} disabled={isResetPending}>
                {isResetPending && <Spinner data-icon="inline-start" />}
                {isResetPending ? 'Gönderiliyor…' : 'Şifre belirle'}
              </Button>
              <Button type="submit" disabled={isPending || !current || !next || !confirm}>
                {isPending ? <Spinner data-icon="inline-start" /> : <I.lock data-icon="inline-start" />}
                {isPending ? 'Güncelleniyor…' : 'Şifre değiştir'}
              </Button>
            </div>
          </div>
          {resetMessage && <div role={resetMessage === 'Şifre belirleme bağlantısını e-posta adresine gönderdik.' ? 'status' : 'alert'} style={{ padding: '0 18px 14px', fontSize: 12, color: resetMessage === 'Şifre belirleme bağlantısını e-posta adresine gönderdik.' ? 'var(--positive)' : 'var(--critical)' }}>{resetMessage}</div>}
        </form>}
      </SCard>

      <SCard title="E-posta adresi" subtitle="Giriş adresini doğrulamalı olarak değiştir" style={{ marginTop: 16 }}>
        <FormRow label="Yeni e-posta">
          <Input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} autoComplete="email" className="w-72" />
        </FormRow>
        <FormRow label="Hesap şifresi" hint="Değişiklik için yeniden doğrulama gerekir">
          <Input type="password" value={securityPassword} onChange={(event) => setSecurityPassword(event.target.value)} autoComplete="current-password" className="w-72" />
        </FormRow>
        <div className="flex justify-end p-4">
          <Button type="button" disabled={isSecurityPending || !newEmail || !securityPassword} onClick={() => runSecurityAction(
            () => requestEmailChange({ email: newEmail, currentPassword: securityPassword }),
            'Doğrulama bağlantıları eski ve yeni e-posta adreslerine gönderildi.',
          )}>E-posta değişikliğini başlat</Button>
        </div>
      </SCard>

      <SCard title="Oturum güvenliği" subtitle="Bu tarayıcı dışındaki açık oturumları kapat" style={{ marginTop: 16 }}>
        <FormRow label="Hesap şifresi" hint="Mevcut cihaz açık kalır; diğer cihazlar yeniden giriş yapar">
          <Input type="password" value={securityPassword} onChange={(event) => setSecurityPassword(event.target.value)} autoComplete="current-password" className="w-72" />
        </FormRow>
        <div className="flex justify-end p-4">
          <Button type="button" variant="destructive" disabled={isSecurityPending || !securityPassword} onClick={() => runSecurityAction(
            () => signOutOtherSessions({ currentPassword: securityPassword }),
            'Diğer oturumlar kapatıldı.',
          )}>Diğer oturumları kapat</Button>
        </div>
      </SCard>

      <SCard title="İki faktörlü doğrulama" subtitle="Her oturum açışta ek bir doğrulama kodu iste" style={{ marginTop: 16 }}>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'var(--surface-2)', color: 'var(--text-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <I.shield size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Authenticator uygulaması</span>
              <Tag tone={mfaFactors.length > 0 ? 'positive' : 'neutral'}>{mfaLoading ? 'Kontrol ediliyor' : mfaFactors.length > 0 ? 'Etkin' : 'Kapalı'}</Tag>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>TOTP uyumlu bir authenticator uygulaması kullanır.</div>
          </div>
          {!mfaLoading && mfaFactors.length === 0 && !mfaEnrollment && (
            <Button type="button" variant="outline" disabled={isSecurityPending} onClick={() => {
              setSecurityMessage(''); setSecurityError(false)
              startSecurityTransition(async () => {
                try {
                  const result = await startTotpEnrollment()
                  if ('error' in result) { setSecurityError(true); setSecurityMessage(result.error) }
                  else setMfaEnrollment(result)
                } catch { setSecurityError(true); setSecurityMessage('Authenticator kurulumu başlatılamadı.') }
              })
            }}>Kur</Button>
          )}
        </div>
        {mfaEnrollment && (
          <div className="grid gap-4 border-t p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {/* Provider returns a short-lived data URI; it is intentionally not proxied or persisted. */}
              <img src={mfaEnrollment.qrCode} alt="Authenticator uygulaması için QR kod" className="size-40 rounded-lg border bg-white p-2" />
              <div className="min-w-0 text-sm"><div className="font-medium">QR kodu tara</div><p className="mt-1 text-muted-foreground">Tarayamıyorsan bu tek kullanımlık kurulum anahtarını gir:</p><code className="break-all text-xs">{mfaEnrollment.secret}</code></div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-sm font-medium">Altı haneli kod<Input inputMode="numeric" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="w-36 font-mono" /></label>
              <Button type="button" disabled={isSecurityPending || mfaCode.length !== 6} onClick={() => {
                startSecurityTransition(async () => {
                  const result = await verifyTotpEnrollment({ factorId: mfaEnrollment.factorId, code: mfaCode })
                  if ('error' in result) { setSecurityError(true); setSecurityMessage(result.error); return }
                  setMfaEnrollment(null); setMfaCode(''); setMfaLoading(true); await refreshMfa(); setSecurityMessage('İki faktörlü doğrulama etkinleştirildi.')
                })
              }}>Doğrula ve etkinleştir</Button>
              <Button type="button" variant="outline" onClick={() => { setMfaEnrollment(null); setMfaCode('') }}>Vazgeç</Button>
            </div>
          </div>
        )}
        {mfaFactors.length > 0 && (
          <div className="grid gap-3 border-t p-4">
            {mfaAal !== 'aal2' && <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
              <div className="text-sm font-medium">Hassas işlemler için oturumu doğrula</div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="grid gap-1 text-sm">Authenticator kodu<Input inputMode="numeric" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="w-36 font-mono" /></label>
                <Button type="button" variant="outline" disabled={isSecurityPending || mfaCode.length !== 6} onClick={() => startSecurityTransition(async () => {
                  const result = await verifyTotpEnrollment({ factorId: mfaFactors[0]!.id, code: mfaCode })
                  if ('error' in result) { setSecurityError(true); setSecurityMessage(result.error); return }
                  setMfaCode(''); setMfaLoading(true); await refreshMfa(); setSecurityMessage('Oturum AAL2 seviyesinde doğrulandı.')
                })}>Oturumu doğrula</Button>
              </div>
            </div>}
            <FormRow label="Hesap şifresi" hint="Authenticator kaldırılırsa hesap yalnız birinci faktörle korunur">
              <Input type="password" value={securityPassword} onChange={(event) => setSecurityPassword(event.target.value)} autoComplete="current-password" className="w-72" />
            </FormRow>
            <div className="flex justify-end"><Button type="button" variant="destructive" disabled={isSecurityPending || !securityPassword} onClick={() => runSecurityAction(
              () => removeTotpFactor({ factorId: mfaFactors[0]!.id, currentPassword: securityPassword }),
              'İki faktörlü doğrulama kaldırıldı. Sayfayı yenileyin.',
            )}>Authenticator’ı kaldır</Button></div>
          </div>
        )}
      </SCard>

      {securityMessage && <Alert variant={securityError ? 'destructive' : 'default'} className="mt-4"><AlertDescription>{securityMessage}</AlertDescription></Alert>}

      {/* Real activity log — the signed-in user's own events only (RLS) */}
      <SCard title="Hesap etkinliği" subtitle="Son 20 kayıt · IP ve cihaz verisi 180 gün saklanır" style={{ marginTop: 16 }}>
        {events.length === 0 ? (
          <div style={{ padding: '28px 18px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-3)' }}>
            Henüz kayıtlı etkinlik yok. Bir sonraki girişin burada görünecek.
          </div>
        ) : events.map((ev, i) => (
          <div key={ev.id} style={{
            padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: i === events.length - 1 ? 'none' : '1px solid var(--divider)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 999, flexShrink: 0,
              background: 'var(--surface-2)', color: 'var(--text-2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {ev.eventType === 'password_change' ? <I.lock size={13} /> : <I.user size={13} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{securityEventLabel(ev.eventType)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                {relativeTime(ev.createdAt, renderedAt)} · {deviceSummary(ev.userAgent)}
                {ev.ip && <> · <span style={{ ...S.mono }}>{ev.ip}</span></>}
              </div>
            </div>
          </div>
        ))}
      </SCard>
    </>
  )
}

/* ── PRIVACY ─────────────────────────────────────── */
type PrivacyIntent = 'account_deletion_request' | 'restaurant_deletion_request'

export function PrivacySection({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [pendingIntent, setPendingIntent] = useState<PrivacyIntent | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [isPending, startTransition] = useTransition()
  const attempts = useRef(new Map<string, string>())

  function requestIdFor(operationType: 'export' | PrivacyIntent) {
    const fingerprint = `${operationType}:${reason.trim()}`
    const existing = attempts.current.get(fingerprint)
    if (existing) return existing
    const requestId = crypto.randomUUID()
    attempts.current.set(fingerprint, requestId)
    return requestId
  }

  function run(operationType: 'export' | PrivacyIntent) {
    setMessage(''); setError(false)
    startTransition(async () => {
      try {
        const result = await createPrivacyOperation(restaurantId, {
          operationType,
          reason,
          currentPassword: password,
          requestId: requestIdFor(operationType),
        })
        if ('error' in result) { setError(true); setMessage(result.error); return }
        if (result.content && result.filename) {
          const url = URL.createObjectURL(new Blob([result.content], { type: 'application/json' }))
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = result.filename
          anchor.click()
          URL.revokeObjectURL(url)
          setMessage(`Dışa aktarma indirildi. SHA-256 özeti: ${result.digest}`)
        } else {
          setMessage(`İnceleme talebi oluşturuldu. Talep no: ${result.operationId}`)
        }
        setPassword('')
        setPendingIntent(null)
      } catch {
        setError(true); setMessage('Gizlilik işlemi tamamlanamadı. Taslağınız korundu.')
      }
    })
  }

  const valid = reason.trim().length >= 3 && password.length > 0
  return (
    <>
      <Alert className="mb-5">
        <I.shield />
        <AlertTitle>Gizlilik ve veri sahipliği</AlertTitle>
        <AlertDescription>
          Dışa aktarma dosyası yalnız bu tarayıcıya indirilir; sunucuda dosyanın kendisi değil SHA-256 özeti ve audit kaydı tutulur. Silme işlemleri doğrudan uygulanmaz, inceleme talebi oluşturur.
        </AlertDescription>
      </Alert>
      <SCard title="Veri dışa aktarma ve kapatma talepleri" subtitle="Yalnızca işletme sahibi kullanabilir">
        <div className="grid gap-4 p-4">
          <label className="grid gap-1 text-sm font-medium">
            Talep gerekçesi
            <Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Talebin amacını kısaca açıklayın" />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Hesap şifresi
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={isPending || !valid} onClick={() => run('export')}>
              {isPending ? <Spinner data-icon="inline-start" /> : <I.invoice data-icon="inline-start" />}JSON dışa aktar
            </Button>
            <Button type="button" variant="outline" disabled={isPending || !valid} onClick={() => setPendingIntent('account_deletion_request')}>Hesap kapatma talebi</Button>
            <Button type="button" variant="destructive" disabled={isPending || !valid} onClick={() => setPendingIntent('restaurant_deletion_request')}>İşletme kapatma talebi</Button>
          </div>
          {message && <Alert variant={error ? 'destructive' : 'default'}><AlertDescription className="break-all">{message}</AlertDescription></Alert>}
        </div>
      </SCard>
      <AlertDialog open={pendingIntent !== null} onOpenChange={(open) => { if (!open && !isPending) setPendingIntent(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingIntent === 'restaurant_deletion_request' ? restaurantName : 'Hesabınız'} için kapatma talebi oluşturulsun mu?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem veriyi hemen silmez. Talep güvenlik ve yasal saklama gereksinimleri açısından incelenir; owner hesabında işletme transferi veya kapatma seçimi ayrıca doğrulanır.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction disabled={isPending || !pendingIntent} onClick={(event) => {
              event.preventDefault()
              if (pendingIntent) run(pendingIntent)
            }}>{isPending ? 'Oluşturuluyor…' : 'İnceleme talebi oluştur'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
