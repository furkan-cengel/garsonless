'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Tables } from '@garsonless/db'
import { I, S, Tag, IconButton, btnGhost, btnPrimary } from '../../lib/ui'
import { InlineSpinner } from '@garsonless/ui'
import { SCard, FormRow, inputStyle } from './primitives'
import { generateApiKey } from '../../lib/actions/restaurant'
import { changePassword } from '../../lib/actions/auth'

/* ── API & WEBHOOKS ───────────────────────────────── */
export function ApiSection({ restaurant }: { restaurant: Tables<'restaurants'> }) {
  const settings = (restaurant.settings as Record<string, unknown> | null) ?? {}
  const storedKey = typeof settings['api_key'] === 'string' ? settings['api_key'] : null

  const [apiKey, setApiKey] = useState<string | null>(storedKey)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleGenerate() {
    setError('')
    startTransition(async () => {
      const result = await generateApiKey(restaurant.id)
      if ('error' in result) { setError(result.error); return }
      setApiKey(result.key)
      setRevealed(true)
    })
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
  }

  function handleCopy() {
    if (!apiKey) return
    void copyToClipboard(apiKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <>
      <div style={{
        padding: 14, marginBottom: 20,
        background: 'var(--warning-bg)', borderRadius: 10,
        border: '1px solid var(--warning)',
        borderLeft: '3px solid var(--warning)',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <span style={{ color: 'var(--warning)', marginTop: 1 }}><I.warn size={16} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)' }}>Geliştirici alanı</div>
          <div style={{ fontSize: 11.5, color: 'var(--warning)', opacity: .85, marginTop: 2, lineHeight: 1.5 }}>
            API anahtarını kimseyle paylaşma.
          </div>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--critical-bg)', color: 'var(--critical)', borderRadius: 7, fontSize: 12 }}>
          {error}
        </div>
      )}

      <SCard title="API anahtarları">
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Üretim</span>
            <Tag tone={apiKey ? 'positive' : 'neutral'}>{apiKey ? 'Aktif' : 'Anahtar yok'}</Tag>
          </div>
          {apiKey ? (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', background: 'var(--surface-2)',
                border: '1px solid var(--divider)', borderRadius: 7, ...S.mono, fontSize: 12,
              }}>
                <span style={{ flex: 1, color: 'var(--text-2)' }}>
                  {revealed ? apiKey : '••••••••••••••••••••••••••••••••••••••••'}
                </span>
                <button onClick={() => setRevealed(v => !v)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--text-2)', fontSize: 11, fontWeight: 600,
                }}>{revealed ? 'Gizle' : 'Göster'}</button>
                <button onClick={handleCopy} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copied ? 'var(--positive)' : 'var(--text-2)' }}>
                  <I.copy size={12} />
                </button>
              </div>
              {copied && <div style={{ fontSize: 11, color: 'var(--positive)', marginTop: 4 }}>Kopyalandı</div>}
            </>
          ) : (
            <div style={{ padding: '12px 0', fontSize: 12.5, color: 'var(--text-3)' }}>
              Henüz API anahtarı oluşturulmamış.
            </div>
          )}
        </div>
        <div style={{ padding: 14, borderTop: '1px solid var(--divider)', display: 'flex', gap: 6 }}>
          <button onClick={handleGenerate} disabled={isPending} style={btnGhost()}>
            {isPending ? <InlineSpinner size={13} /> : <I.history size={13} />}{apiKey ? 'Yeniden oluştur' : 'Anahtar oluştur'}
          </button>
        </div>
      </SCard>

      <SCard title="Webhooks" subtitle="Olaylar sunucuna gerçek zamanlı POST edilir" style={{ marginTop: 16 }}>
        <FormRow label="Hedef URL">
          <input defaultValue="https://api.acimarka.co/webhooks/garsonless" style={inputStyle({ width: 320, fontFamily: "'Geist Mono'" })} />
        </FormRow>
        <FormRow label="İmza anahtarı">
          <div style={{ ...S.mono, fontSize: 11.5, color: 'var(--text-2)' }}>whsec_2K9mLp...</div>
        </FormRow>
        <FormRow label="Olaylar" hint="6 olay seçili">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 280, justifyContent: 'flex-end' }}>
            {['order.created', 'order.updated', 'payment.success', 'menu.changed'].map(e => (
              <span key={e} style={{
                ...S.mono, fontSize: 10.5, padding: '3px 7px',
                background: 'var(--surface-3)', color: 'var(--text-2)',
                borderRadius: 4, fontWeight: 500,
              }}>{e}</span>
            ))}
            <button style={{
              padding: '3px 7px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 4,
              fontSize: 10.5, color: 'var(--text-2)', cursor: 'pointer',
            }}>+2 daha</button>
          </div>
        </FormRow>
      </SCard>

      <SCard title="Son olaylar" style={{ marginTop: 16 }}>
        {[
          { event: 'order.created',  status: 200, t: '2 dk önce',  payload: '{"id":"AC-241","table":"Masa 5"}', failed: false },
          { event: 'payment.success', status: 200, t: '5 dk önce', payload: '{"order":"AC-240","total":95}', failed: false },
          { event: 'order.updated',  status: 500, t: '12 dk önce', payload: '{"id":"AC-238","status":"prep"}', failed: true },
          { event: 'menu.changed',   status: 200, t: '1 sa önce',  payload: '{"action":"price.update"}', failed: false },
        ].map((e, i, arr) => (
          <div key={i} style={{
            padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10,
            borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--divider)',
          }}>
            <span style={{
              ...S.mono, fontSize: 10.5, padding: '3px 6px',
              background: e.failed ? 'var(--critical-bg)' : 'var(--positive-bg)',
              color: e.failed ? 'var(--critical)' : 'var(--positive)',
              borderRadius: 4, fontWeight: 600, flexShrink: 0,
            }}>{e.status}</span>
            <span style={{ ...S.mono, fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>{e.event}</span>
            <span style={{ ...S.mono, fontSize: 11, color: 'var(--text-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{e.payload}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{e.t}</span>
          </div>
        ))}
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
export function BillingSection() {
  return (
    <>
      <div style={{
        padding: 20, marginBottom: 20,
        background: 'linear-gradient(135deg, #18181b 0%, #3f3f46 100%)',
        borderRadius: 14, color: '#fff', overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: -30, right: -30, width: 180, height: 180,
          background: 'radial-gradient(circle, rgba(255,208,137,.15) 0%, transparent 65%)',
        }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: '#ffd089', color: '#5a2a14',
            fontWeight: 800, fontSize: 14, letterSpacing: '.04em',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>PRO</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Pro plan</div>
            <div style={{ fontSize: 11.5, opacity: .65, marginTop: 2 }}>
              Sınırsız menü · 50 masa · Çoklu mağaza · Öncelikli destek
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 14 }}>
              <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-.03em', ...S.mono }}>₺899</span>
              <span style={{ fontSize: 13, opacity: .6 }}>/ay · KDV dahil</span>
            </div>
            <div style={{ fontSize: 11.5, opacity: .7, marginTop: 4 }}>14 Haziran 2026'da yenilenecek</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button style={{
              padding: '8px 14px', background: '#ffd089', color: '#5a2a14',
              border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            }}>Business'a yükselt</button>
            <button style={{
              padding: '8px 14px', background: 'transparent', color: '#fff',
              border: '1px solid rgba(255,255,255,.18)', borderRadius: 7,
              fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
            }}>Planı değiştir</button>
          </div>
        </div>
      </div>

      <SCard title="Bu ayki kullanım" subtitle="13 Mayıs'tan itibaren">
        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <UsageGauge label="Sipariş" value={1842} max={5000} suffix="" />
          <UsageGauge label="Masa" value={10} max={50} suffix="" />
          <UsageGauge label="Depolama" value={2.4} max={10} suffix=" GB" />
        </div>
      </SCard>

      <SCard title="Ödeme yöntemi" style={{ marginTop: 16 }}>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 50, height: 34, borderRadius: 6,
            background: 'linear-gradient(135deg, #1a1f71 0%, #0f56b3 100%)',
            color: '#fff', fontWeight: 800, fontSize: 10, letterSpacing: '.05em',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>VISA</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, ...S.mono }}>•••• •••• •••• 4823</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Garanti BBVA · 12/27 son</div>
          </div>
          <button style={btnGhost()}>Değiştir</button>
        </div>
      </SCard>

      <SCard title="Faturalar" style={{ marginTop: 16 }}>
        {[
          { id: 'INV-2026-05', date: '14 May 2026', amount: 899, status: 'paid' },
          { id: 'INV-2026-04', date: '14 Nis 2026', amount: 899, status: 'paid' },
          { id: 'INV-2026-03', date: '14 Mar 2026', amount: 899, status: 'paid' },
          { id: 'INV-2026-02', date: '14 Şub 2026', amount: 499, status: 'paid' },
        ].map((inv, i, arr) => (
          <div key={inv.id} style={{
            padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--divider)',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, ...S.mono }}>{inv.id}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{inv.date}</div>
            </div>
            <span style={{ ...S.mono, fontSize: 13, fontWeight: 600 }}>₺{inv.amount}</span>
            <Tag tone="positive">Ödendi</Tag>
            <IconButton icon={<I.history size={13} />} ariaLabel="İndir" />
          </div>
        ))}
      </SCard>
    </>
  )
}

function UsageGauge({ label, value, max, suffix = '' }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = Math.round((value / max) * 100)
  const tone = pct > 80 ? 'var(--critical)' : pct > 60 ? 'var(--warning)' : 'var(--positive)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
        <span style={{ ...S.mono, fontSize: 11, color: 'var(--text-3)' }}>%{pct}</span>
      </div>
      <div style={{ ...S.mono, fontSize: 18, fontWeight: 700, letterSpacing: '-.01em' }}>
        {value}{suffix}
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}> / {max}{suffix}</span>
      </div>
      <div style={{ height: 4, marginTop: 8, borderRadius: 2, background: 'var(--surface-3)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: tone, transition: 'width 240ms' }} />
      </div>
    </div>
  )
}
