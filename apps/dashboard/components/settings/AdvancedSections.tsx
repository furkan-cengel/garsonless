'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Tables } from '@garsonless/db/types'
import { I, S, Tag, btnGhost, btnPrimary } from '../../lib/ui'
import { InlineSpinner } from '@garsonless/ui'
import { SCard, FormRow, inputStyle } from './primitives'
import { changePassword } from '../../lib/actions/auth'

/* ── API & WEBHOOKS ───────────────────────────────── */
export function ApiSection() {
  return (
    <>
      <div style={{
        padding: 14, marginBottom: 20,
        background: 'var(--surface)', borderRadius: 10,
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--text-3)',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <span style={{ color: 'var(--text-3)', marginTop: 1 }}><I.code size={16} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Geliştirici erişimi henüz kapalı</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.5 }}>
            Bu restorana ait gerçek API endpoint doğrulaması ve webhook gönderimi bu sürümde yok. Bu yüzden anahtar üretimi ve webhook ayarları pasif tutulur.
          </div>
        </div>
      </div>

      <SCard title="API anahtarları" subtitle="Gerçek API gateway eklendiğinde açılacak">
        <FormRow label="Durum" hint="Şu anda hiçbir endpoint bu anahtarlarla istek kabul etmiyor">
          <Tag tone="neutral">Yakında</Tag>
        </FormRow>
        <FormRow label="Anahtar üretimi">
          <button type="button" disabled style={{ ...btnGhost(), opacity: 0.55, cursor: 'not-allowed' }}>
            <I.lock size={13} />Pasif
          </button>
        </FormRow>
      </SCard>

      <SCard title="Webhooks" subtitle="Gerçek gönderim altyapısı henüz yok" style={{ marginTop: 16 }}>
        <FormRow label="Hedef URL">
          <input disabled value="" placeholder="Webhook URL desteği yakında" style={inputStyle({ width: 320, opacity: 0.65, fontFamily: "'Geist Mono'" })} />
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

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const min = Math.floor((Date.now() - then) / 60_000)
  if (min < 1) return 'az önce'
  if (min < 60) return `${min} dk önce`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} saat önce`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'dün'
  if (day < 30) return `${day} gün önce`
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
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

export function SecuritySection({ events, userEmail }: { events: SecurityEventView[]; userEmail: string }) {
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

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

  return (
    <>
      {/* Real password change */}
      <SCard title="Şifre" subtitle={`${userEmail} hesabının şifresini değiştir`}>
        <form onSubmit={handleChangePassword}>
          <FormRow label="Mevcut şifre">
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" style={inputStyle({ width: 220 })} />
          </FormRow>
          <FormRow label="Yeni şifre" hint="En az 8 karakter">
            <input type="password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" style={inputStyle({ width: 220 })} />
          </FormRow>
          <FormRow label="Yeni şifre (tekrar)">
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" style={inputStyle({ width: 220 })} />
          </FormRow>
          <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: error ? 'var(--critical)' : 'var(--text-3)' }}>
              {error || (saved ? '✓ Şifre güncellendi' : 'Mevcut şifreni doğrulamamız gerekiyor')}
            </span>
            <button type="submit" disabled={isPending || !current || !next || !confirm} style={btnPrimary()}>
              {isPending ? <InlineSpinner size={13} color="var(--on-action)" /> : <I.lock size={13} />}{isPending ? 'Güncelleniyor…' : 'Şifre değiştir'}
            </button>
          </div>
        </form>
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
          <button type="button" disabled style={{ ...btnGhost(), opacity: 0.5, cursor: 'not-allowed' }}>Yönet</button>
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
                {relativeTime(ev.createdAt)} · {deviceSummary(ev.userAgent)}
                {ev.ip && <> · <span style={{ ...S.mono }}>{ev.ip}</span></>}
              </div>
            </div>
          </div>
        ))}
      </SCard>
    </>
  )
}

/* ── BILLING ──────────────────────────────────────── */
export function BillingSection({ restaurant }: { restaurant: Tables<'restaurants'> }) {
  const planLabel = restaurant.plan === 'enterprise'
    ? 'Enterprise'
    : restaurant.plan === 'pro'
      ? 'Pro'
      : restaurant.plan === 'starter'
        ? 'Starter'
        : 'Free'

  return (
    <>
      <div style={{
        padding: 18, marginBottom: 20,
        background: 'var(--surface)', borderRadius: 14, color: 'var(--text)',
        border: '1px solid var(--border)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--surface-3)', color: 'var(--text)',
            fontWeight: 800, fontSize: 14, letterSpacing: '.04em',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{planLabel.slice(0, 3).toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Mevcut plan: {planLabel}</div>
              <Tag tone="neutral">Read-only</Tag>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 5, lineHeight: 1.5 }}>
              Abonelik, kart saklama ve fatura geçmişi bu sürümde panele bağlı değildir. Plan değişikliği için destek ekibiyle ilerlenir.
            </div>
          </div>
        </div>
      </div>

      <SCard title="Fatura geçmişi ve ödeme yöntemi" subtitle="Subscription sistemi ayrı bir fazda açılacak">
        <div style={{ padding: 18, fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Bu panelde şu an gerçek abonelik faturası, kayıtlı kart veya kullanım limiti gösterilmiyor.
          Yanıltıcı demo faturalar kaldırıldı.
        </div>
      </SCard>
    </>
  )
}
