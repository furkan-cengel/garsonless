'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { I, S, Tag } from '../../lib/ui'
import { SCard, FormRow } from './primitives'
import { changePassword, sendPasswordResetEmail } from '../../lib/actions/auth'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Spinner } from '../ui/spinner'

/* ── API & WEBHOOKS ───────────────────────────────── */
export function ApiSection() {
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
  const [isPending, startTransition] = useTransition()
  const [isResetPending, startResetTransition] = useTransition()
  const usesExternalProvider = Boolean(authProvider && authProvider !== 'email')

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

      {/* 2FA — not in v1, clearly disabled (no fake toggle) */}
      <SCard title="İki faktörlü doğrulama" subtitle="Her oturum açışta ek bir doğrulama kodu iste" style={{ marginTop: 16 }}>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, opacity: 0.75 }}>
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
              <Tag tone="neutral">Yakında</Tag>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>İki faktörlü doğrulama bu sürümde henüz mevcut değil.</div>
          </div>
          <Button type="button" variant="outline" disabled>Yönet</Button>
        </div>
      </SCard>

      {/* Real activity log — the signed-in user's own events only (RLS) */}
      <SCard title="Hesap etkinliği" subtitle="Hesabında yapılan giriş ve güvenlik işlemleri" style={{ marginTop: 16 }}>
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
