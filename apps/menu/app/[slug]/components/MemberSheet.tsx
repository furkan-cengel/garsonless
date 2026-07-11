'use client'

import { useEffect, useRef, useState } from 'react'
import type { MemberBalances, LoyaltyActivity } from '@garsonless/db'
import { createMenuAuthBrowserClient } from '../../../lib/supabase-browser'

// ── Rich member home (Sprint 15b). Three screens — Join → OTP → MemberHome —
// rebuilt from ref/Membership_Loyalty.html, but every value is bound to the
// REAL 15a loyalty data (MemberBalances). No demo arrays, display-only: the
// economy (earning/redemption) is untouched. Catalog redemption ships in 15c.
//
// Palette: theme-tokenized var(--p-*) mapped onto local --ml-* vars, with a
// fixed gold (#c8922a) for tier/reward accents so the card adapts per-restaurant.

export type CatalogChoice = { itemId: string; name: string; pointCost: number; tag: string | null }

interface Props {
  onClose: () => void
  onVerified: (member: { name: string | null }) => void
  /** When set, the member is already logged in → open straight to the home. */
  balances?: MemberBalances | null
  memberName?: string | null
  /** Restaurant the member is verifying on (welcome bonus + card label). */
  restaurantId?: string
  restaurantSlug?: string
  restaurantName?: string
  /** Welcome bonus points — drives the "& X puan kazan" join suffix. */
  welcomeBonus?: number
  /** Resolved reward catalog (name + cost) for the teaser/sheet. Empty hides it. */
  rewardCatalog?: CatalogChoice[]
  /** Claim a catalog reward (15c): parent adds the item to cart + sets the intent. */
  onRedeemCatalog?: (itemId: string) => void
  /** Re-fetch balances (e.g. after a consent toggle changes consentGiven). */
  onRefresh?: () => void | Promise<void>
  /** Logs the member out (parent clears cookie + state, then closes). */
  onLogout?: () => void | Promise<void>
}

// reference tokens → live theme tokens + the 15a gold constant.
const ROOT_VARS = {
  '--ml-bg': 'var(--p-bg, #fdf9f4)',
  '--ml-surface': 'var(--p-card, #fff)',
  '--ml-accent': 'var(--p-accent)',
  '--ml-accent2': 'color-mix(in srgb, var(--p-accent) 80%, #000)',
  '--ml-accent-soft': 'var(--p-accent-soft, #e3f0ea)',
  '--ml-cta': 'var(--p-cta, #c0341d)',
  '--ml-gold': '#c8922a',
  '--ml-gold-soft': '#f6ecd6',
  '--ml-text': 'var(--p-text)',
  '--ml-text2': 'var(--p-text-2)',
  '--ml-text3': 'var(--p-text-3, #9ca3af)',
  '--ml-line': 'var(--p-border, #ece5da)',
} as React.CSSProperties

const KEYFRAMES = `
@keyframes ml-pulse-dot {0%,100%{box-shadow:0 0 0 0 color-mix(in srgb, var(--ml-accent) 40%, transparent)}50%{box-shadow:0 0 0 6px color-mix(in srgb, var(--ml-accent) 0%, transparent)}}
@keyframes ml-fade-slide {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes ml-stamp-pop {0%{transform:scale(0) rotate(-25deg);opacity:0}60%{transform:scale(1.2) rotate(6deg)}100%{transform:scale(1) rotate(-8deg);opacity:1}}
@keyframes ml-shimmer {from{background-position:-160% 0}to{background-position:260% 0}}
@keyframes ml-count-up {from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes ml-sheet-up {from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes ml-ring-expand {0%{transform:scale(.8);opacity:.5}100%{transform:scale(1.6);opacity:0}}
@keyframes ml-confetti-drop {0%{transform:translateY(-10px) rotate(0);opacity:0}15%{opacity:1}100%{transform:translateY(60px) rotate(240deg);opacity:0}}
@keyframes ml-spin {to{transform:rotate(360deg)}}
`

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const fmt = (n: number) => n.toLocaleString('tr-TR')

function firstNameOf(name: string | null): string {
  if (!name) return 'Üye'
  return name.trim().split(/\s+/)[0] || 'Üye'
}
function initialsOf(name: string | null): string {
  if (!name) return '★'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '★'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}
function relativeTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (d.toDateString() === now.toDateString()) return `Bugün, ${hhmm}`
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return `Dün, ${hhmm}`
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]}`
}
function activityMeta(a: LoyaltyActivity): { emoji: string; label: string } {
  if (a.reason === 'welcome') return { emoji: '⭐', label: 'Hoş geldin bonusu' }
  if (a.type === 'visit') return { emoji: '🏆', label: 'Ziyaret' }
  if (a.direction === 'refund') return { emoji: '↩', label: a.type === 'stamp' ? 'Damga iadesi' : 'Puan iadesi' }
  if (a.type === 'stamp') return a.direction === 'redeem' ? { emoji: '🎁', label: 'Bedava ürün' } : { emoji: '☕', label: 'Damga kazandın' }
  return a.direction === 'redeem' ? { emoji: '🎁', label: 'Puan kullandın' } : { emoji: '⭐', label: 'Puan kazandın' }
}
function deltaText(a: LoyaltyActivity): { text: string; positive: boolean } {
  const positive = a.delta >= 0
  const unit = a.type === 'stamp' ? ' damga' : ''
  return { text: `${positive ? '+' : '−'}${Math.abs(a.delta)}${unit}`, positive }
}
/** Non-default tier perks → short Turkish chips (Sprint 17, display-only). */
function tierPerks(tier: MemberBalances['tier']): string[] {
  const out: string[] = []
  if (tier.discountPct > 0) out.push(`%${tier.discountPct} indirim`)
  if (tier.pointsMultiplier > 1) out.push(`${tier.pointsMultiplier}× puan`)
  if (tier.bonusStamps > 0) out.push(`+${tier.bonusStamps} damga`)
  if (tier.priorityService) out.push('öncelikli servis')
  return out
}

// ── small shared bits ──────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'ml-spin .7s linear infinite' }}>
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,.35)" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string
}) {
  const [focus, setFocus] = useState(false)
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ml-text2)', marginLeft: 2 }}>{label}</span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          width: '100%', height: 50, marginTop: 6, padding: '0 14px', borderRadius: 14, fontSize: 15,
          fontFamily: 'inherit', color: 'var(--ml-text)', background: 'var(--ml-surface)', outline: 'none',
          border: '1.5px solid ' + (focus ? 'var(--ml-accent)' : 'var(--ml-line)'),
          boxShadow: focus ? '0 0 0 3px var(--ml-accent-soft)' : 'none', transition: 'all 150ms', boxSizing: 'border-box',
        }}
      />
    </label>
  )
}

// ── Screen 1: Supabase Auth ─────────────────────────────────────────────────
function AuthScreen({ restaurantName, welcomeBonus, busy, error, onEmail, onGoogle, onSkip }: {
  restaurantName: string; welcomeBonus: number; busy: boolean; error: string
  onEmail: (name: string, email: string, consent: boolean, marketingConsent: boolean) => void
  onGoogle: (name: string, consent: boolean, marketingConsent: boolean) => void
  onSkip: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  // KVKK açık rıza must be an affirmative opt-in → default UNCHECKED (a
  // pre-ticked consent box is not valid consent).
  const [agree, setAgree] = useState(false)
  const [marketingAgree, setMarketingAgree] = useState(false)
  const valid = name.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && agree
  const socialValid = agree

  return (
    // minHeight 0 + overflowY auto: the sheet is overflow-hidden and capped at
    // 92vh — without its own scroll area the footer (Google / skip) is
    // unreachable on short mobile viewports.
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', animation: 'ml-fade-slide .4s ease both' }}>
      <div style={{ padding: '8px 22px 0', textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 86, height: 86, margin: '8px auto 0' }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--ml-accent)', animation: 'ml-ring-expand 2.4s ease-out infinite' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'linear-gradient(135deg, var(--ml-accent), var(--ml-accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, boxShadow: '0 16px 36px -12px color-mix(in srgb, var(--ml-accent) 55%, transparent)' }}>☕</div>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.025em', margin: '18px 0 0', color: 'var(--ml-text)', fontFamily: 'var(--p-display)' }}>{restaurantName} Club&apos;a katıl</h1>
        <p style={{ fontSize: 14, color: 'var(--ml-text2)', margin: '8px 0 0', lineHeight: 1.5 }}>Her siparişte puan &amp; damga topla,<br />ödüllerin senin olsun.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', padding: '18px 22px 0' }}>
        {[['☕', 'Damga topla'], ['⭐', 'Puan kazan'], ['🎁', 'Ödüller']].map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--ml-accent)', background: 'var(--ml-accent-soft)', padding: '7px 12px', borderRadius: 99 }}>{c[0]} {c[1]}</span>
        ))}
      </div>

      <div style={{ padding: '22px 22px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Ad Soyad" value={name} onChange={setName} placeholder="Adın Soyadın" />
        <Field label="E-posta" value={email} onChange={setEmail} placeholder="ornek@eposta.com" type="email" />
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 2, cursor: 'pointer' }}>
          <span onClick={() => setAgree((a) => !a)} style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1, border: '2px solid ' + (agree ? 'var(--ml-accent)' : 'var(--ml-line)'), background: agree ? 'var(--ml-accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}>
            {agree && <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12.5 L10 17.5 L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </span>
          <span style={{ fontSize: 12, color: 'var(--ml-text2)', lineHeight: 1.55 }}>
            <b style={{ color: 'var(--ml-text)' }}>{restaurantName}</b> sadakat programına katılıyorum; ad ve e-posta adresimin bu işletme tarafından üyelik ve iletişim amacıyla işlenmesine <b style={{ color: 'var(--ml-text)' }}>açık rıza</b> veriyorum.{' '}
            <a href="https://masabu.co/legal#kvkk" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--ml-accent)', textDecoration: 'underline' }}>KVKK aydınlatma metni</a>.
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: -2, cursor: 'pointer' }}>
          <span onClick={() => setMarketingAgree((a) => !a)} style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1, border: '2px solid ' + (marketingAgree ? 'var(--ml-accent)' : 'var(--ml-line)'), background: marketingAgree ? 'var(--ml-accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}>
            {marketingAgree && <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12.5 L10 17.5 L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </span>
          <span style={{ fontSize: 12, color: 'var(--ml-text2)', lineHeight: 1.55 }}>
            Kampanya, indirim ve duyurular için e-posta almak istiyorum.
          </span>
        </label>
        {error && <p style={{ color: 'var(--ml-cta)', fontSize: 13, margin: '2px 0 0', fontWeight: 600 }}>{error}</p>}
      </div>

      <div style={{ padding: '16px 22px calc(16px + env(safe-area-inset-bottom, 8px))', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button" onClick={() => valid && !busy && onEmail(name, email, agree, marketingAgree)} disabled={!valid || busy}
          style={{
            width: '100%', height: 52, borderRadius: 14, border: 'none',
            background: valid && !busy ? 'var(--ml-accent)' : 'var(--ml-line)',
            color: valid && !busy ? '#fff' : 'var(--ml-text3)', fontSize: 15.5, fontWeight: 800,
            cursor: valid && !busy ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 200ms',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          }}
        >
          {busy ? <><Spinner /> Gönderiliyor…</> : `E-posta ile devam et${welcomeBonus > 0 ? ` & ${welcomeBonus} puan kazan` : ''}`}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ml-text3)', fontSize: 12 }}><span style={{ height: 1, background: 'var(--ml-line)', flex: 1 }} />veya<span style={{ height: 1, background: 'var(--ml-line)', flex: 1 }} /></div>
        <button
          type="button" onClick={() => socialValid && !busy && onGoogle(name, agree, marketingAgree)} disabled={!socialValid || busy}
          style={{ width: '100%', height: 50, borderRadius: 14, border: '1px solid var(--ml-line)', background: 'var(--ml-surface)', color: 'var(--ml-text)', fontSize: 15, fontWeight: 700, cursor: socialValid && !busy ? 'pointer' : 'not-allowed', opacity: socialValid ? 1 : .55, fontFamily: 'inherit' }}
        >Google ile devam et</button>
        {/* Apple provider hazır olana dek ürün kararına uygun olarak gizli. */}
        <button type="button" onClick={onSkip} style={{ width: '100%', height: 42, borderRadius: 14, border: 'none', background: 'none', color: 'var(--ml-text2)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Şimdilik geç</button>
      </div>
    </div>
  )
}

// ── Screen 1.5: OTP ─────────────────────────────────────────────────────────
function OTPScreen({ email, onVerify, onResend, onBack }: {
  email: string
  onVerify: (code: string) => Promise<boolean>
  onResend: () => Promise<boolean>
  onBack: () => void
}) {
  const LEN = 6
  const [digits, setDigits] = useState<string[]>(() => Array(LEN).fill(''))
  const [secs, setSecs] = useState(60)
  const [err, setErr] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { refs.current[0]?.focus() }, [])
  useEffect(() => {
    if (secs <= 0) return
    const id = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [secs])

  const code = digits.join('')
  const full = code.length === LEN && digits.every((d) => d !== '')

  async function submit(val: string) {
    if (verifying) return
    setVerifying(true)
    setErr(false)
    const ok = await onVerify(val)
    if (!ok) {
      setErr(true)
      setDigits(Array(LEN).fill(''))
      refs.current[0]?.focus()
      setVerifying(false)
    }
    // on success the parent unmounts this screen
  }

  function setAt(i: number, raw: string) {
    const v = raw.replace(/\D/g, '')
    setErr(false)
    if (v.length > 1) {
      const arr = v.slice(0, LEN).split('')
      const next = Array(LEN).fill('').map((_, k) => arr[k] || '')
      setDigits(next)
      refs.current[Math.min(arr.length, LEN) - 1]?.focus()
      if (arr.length >= LEN) void submit(next.join(''))
      return
    }
    const next = [...digits]
    next[i] = v
    setDigits(next)
    if (v && i < LEN - 1) refs.current[i + 1]?.focus()
    if (next.every((d) => d !== '')) void submit(next.join(''))
  }
  function onKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
  }
  async function resend() {
    const ok = await onResend()
    if (ok) setSecs(60)
    setErr(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', animation: 'ml-fade-slide .4s ease both' }}>
      <div style={{ padding: '4px 22px 0' }}>
        <button type="button" onClick={onBack} style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--ml-line)', background: 'var(--ml-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="var(--ml-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <div style={{ padding: '18px 22px 0' }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--ml-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="6" y="2.5" width="12" height="19" rx="3" stroke="var(--ml-accent)" strokeWidth="1.9" /><path d="M10.5 18.5h3" stroke="var(--ml-accent)" strokeWidth="1.9" strokeLinecap="round" /></svg>
        </div>
        <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.025em', margin: 0, color: 'var(--ml-text)', fontFamily: 'var(--p-display)' }}>E-postanı doğrula</h1>
        <p style={{ fontSize: 14, color: 'var(--ml-text2)', margin: '8px 0 0', lineHeight: 1.5 }}>
          <b style={{ color: 'var(--ml-text)' }}>{email}</b> adresine 6 haneli kodu gönderdik.
        </p>
      </div>

      <div style={{ padding: '22px 22px 0' }}>
        <div style={{ display: 'flex', gap: 9, justifyContent: 'space-between' }}>
          {digits.map((d, i) => (
            <input
              key={i} ref={(el) => { refs.current[i] = el }} value={d} inputMode="numeric" maxLength={LEN}
              onChange={(e) => setAt(i, e.target.value)} onKeyDown={(e) => onKey(i, e)}
              style={{
                width: '100%', height: 56, textAlign: 'center', fontSize: 24, fontWeight: 800, fontFamily: 'inherit',
                color: 'var(--ml-text)', background: 'var(--ml-surface)', outline: 'none', borderRadius: 14, transition: 'all 150ms', boxSizing: 'border-box',
                border: '2px solid ' + (err ? 'var(--ml-cta)' : d ? 'var(--ml-accent)' : 'var(--ml-line)'),
                boxShadow: d && !err ? '0 0 0 3px var(--ml-accent-soft)' : 'none',
              }}
            />
          ))}
        </div>
        {err && <div style={{ fontSize: 13, color: 'var(--ml-cta)', fontWeight: 600, marginTop: 12 }}>⚠ Kod hatalı veya süresi dolmuş, tekrar dene</div>}
        <div style={{ marginTop: 18, fontSize: 13.5, color: 'var(--ml-text2)', textAlign: 'center' }}>
          {secs > 0
            ? <>Kodu almadın mı? <b style={{ color: 'var(--ml-text3)' }}>{secs}s</b> sonra tekrar gönder</>
            : <button type="button" onClick={() => void resend()} style={{ background: 'none', border: 'none', color: 'var(--ml-accent)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>Kodu tekrar gönder</button>}
        </div>
      </div>

      <div style={{ padding: '20px 22px calc(16px + env(safe-area-inset-bottom, 8px))' }}>
        <button
          type="button" onClick={() => full && void submit(code)} disabled={!full || verifying}
          style={{
            width: '100%', height: 52, borderRadius: 14, border: 'none',
            background: full && !verifying ? 'var(--ml-accent)' : 'var(--ml-line)',
            color: full && !verifying ? '#fff' : 'var(--ml-text3)', fontSize: 15.5, fontWeight: 800,
            cursor: full && !verifying ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 200ms',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          }}
        >
          {verifying ? <><Spinner /> Doğrulanıyor…</> : 'Doğrula & devam et'}
        </button>
      </div>
    </div>
  )
}

// ── Screen 2: Member home ────────────────────────────────────────────────────
function Stat({ icon, label, value, accent }: { icon: string; label: string; value: number; accent: string }) {
  return (
    <div style={{ background: 'var(--ml-surface)', borderRadius: 16, border: '1px solid var(--ml-line)', padding: '14px 16px' }}>
      <div style={{ fontSize: 12.5, color: 'var(--ml-text2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>{icon} {label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent, marginTop: 4, animation: 'ml-count-up .4s ease both' }}>{fmt(value)}</div>
    </div>
  )
}

function MemberHome({ balances, name, restaurantName, rewardCatalog, restaurantId, onOpenRewards, onRefresh, onLogout, onClose }: {
  balances: MemberBalances | null
  name: string | null
  restaurantName: string
  rewardCatalog: CatalogChoice[]
  restaurantId?: string
  onOpenRewards: () => void
  onRefresh?: () => void | Promise<void>
  onLogout?: () => void | Promise<void>
  onClose: () => void
}) {
  const [loggingOut, setLoggingOut] = useState(false)
  const [consentBusy, setConsentBusy] = useState(false)

  async function toggleConsent(grant: boolean, consentType: 'contact_data' | 'marketing' = 'contact_data') {
    if (!restaurantId || consentBusy) return
    setConsentBusy(true)
    try {
      await fetch('/api/loyalty/consent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, grant, consentType }),
      })
      await onRefresh?.()
    } catch {
      /* best-effort */
    } finally {
      setConsentBusy(false)
    }
  }

  if (!balances) {
    return (
      <div style={{ height: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ animation: 'ml-spin .8s linear infinite' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="var(--ml-line)" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="var(--ml-accent)" strokeWidth="3" strokeLinecap="round" /></svg>
        </div>
        <span style={{ fontSize: 13.5, color: 'var(--ml-text2)' }}>Üyeliğin yükleniyor…</span>
      </div>
    )
  }

  const { tier, nextTier, tierProgress, stamps, stampGoal, stampEnabled, stampUnlocked, points, pointsEnabled, visits, lifetimePoints, memberCode, recentActivity, consentGiven, marketingConsentGiven } = balances
  const affordable = rewardCatalog.filter((r) => r.pointCost <= points).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, animation: 'ml-fade-slide .35s ease both' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px 12px', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 12.5, color: 'var(--ml-text2)' }}>Sadakat kartın</div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ml-text)', fontFamily: 'var(--p-display)' }}>Merhaba, {firstNameOf(name)} 👋</div>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--ml-accent), var(--ml-accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15, fontWeight: 800, boxShadow: '0 6px 16px -6px color-mix(in srgb, var(--ml-accent) 50%, transparent)' }}>{initialsOf(name)}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px', minHeight: 0 }}>
        {/* membership card */}
        <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', padding: 18, color: '#fff', background: 'linear-gradient(135deg, var(--ml-accent) 0%, var(--ml-accent2) 100%)', boxShadow: '0 18px 40px -16px color-mix(in srgb, var(--ml-accent) 55%, transparent)' }}>
          <div style={{ position: 'absolute', top: -40, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.14), transparent 70%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,.12) 45%, transparent 60%)', backgroundSize: '220% 100%', animation: 'ml-shimmer 5s linear infinite' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
            <div>
              <div style={{ fontSize: 11, opacity: .8, letterSpacing: '.1em', fontWeight: 600, textTransform: 'uppercase' }}>{restaurantName} Club</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{name || 'Üye'}</div>
              <div style={{ fontSize: 11.5, opacity: .7, marginTop: 2, fontFamily: 'monospace', letterSpacing: '.05em' }}>{memberCode}</div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(4px)', padding: '5px 11px', borderRadius: 99 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: tier.color }} />{tier.name}
            </span>
          </div>
          {/* tier progress */}
          <div style={{ marginTop: 18, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, opacity: .85, marginBottom: 6 }}>
              <span>{nextTier ? `${nextTier.name} seviyesine` : 'En üst seviye'}</span>
              <span>{nextTier ? `${fmt(Math.max(0, nextTier.min - lifetimePoints))} puan kaldı` : '★'}</span>
            </div>
            <div style={{ height: 7, background: 'rgba(255,255,255,.2)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${tierProgress}%`, background: 'linear-gradient(90deg, #fff, rgba(255,255,255,.7))', borderRadius: 99, transition: 'width 700ms ease' }} />
            </div>
          </div>
          {/* tier perks (Sprint 17) — non-default only */}
          {tierPerks(tier).length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tierPerks(tier).map((p, k) => (
                <span key={k} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(4px)' }}>{p}</span>
              ))}
            </div>
          )}
        </div>

        {/* stats */}
        <div style={{ display: 'grid', gridTemplateColumns: pointsEnabled ? '1fr 1fr' : '1fr', gap: 10, marginTop: 12 }}>
          {pointsEnabled && <Stat icon="⭐" label="Puan" value={points} accent="var(--ml-gold)" />}
          <Stat icon="🏆" label="Ziyaret" value={visits} accent="var(--ml-accent)" />
        </div>

        {/* stamp card */}
        {stampEnabled && stampGoal > 0 && (
          <div style={{ marginTop: 12, background: 'var(--ml-surface)', borderRadius: 16, border: '1px solid var(--ml-line)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ml-text)' }}>Kahve Damgaların ☕</div>
                <div style={{ fontSize: 12.5, color: stampUnlocked ? 'var(--ml-accent)' : 'var(--ml-text2)', marginTop: 1, fontWeight: stampUnlocked ? 700 : 400 }}>
                  {stampUnlocked ? '🎉 Ödülün hazır!' : `${stampGoal - stamps} damga daha, ödülün hazır olsun`}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ml-accent)' }}>{stamps}</span>
                <span style={{ fontSize: 14, color: 'var(--ml-text3)', fontWeight: 700 }}>/{stampGoal}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 9 }}>
              {Array.from({ length: stampGoal }).map((_, i) => {
                const filled = i < stamps
                const isReward = i === stampGoal - 1
                const isNewest = filled && i === stamps - 1
                return (
                  <div key={i} style={{
                    aspectRatio: '1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                    background: filled ? 'var(--ml-accent-soft)' : 'transparent',
                    border: filled ? '2px solid var(--ml-accent)' : '2px dashed ' + (isReward ? 'var(--ml-gold)' : 'var(--ml-line)'),
                    animation: isNewest ? 'ml-stamp-pop .5s cubic-bezier(.2,.9,.3,1.3) both' : 'none',
                  }}>{filled ? '☕' : isReward ? <span style={{ fontSize: 15 }}>🎁</span> : ''}</div>
                )
              })}
            </div>
          </div>
        )}

        {/* rewards teaser (display-only; redemption ships in 15c) */}
        {rewardCatalog.length > 0 && (
          <button type="button" onClick={onOpenRewards} style={{ width: '100%', marginTop: 12, background: 'var(--ml-surface)', borderRadius: 16, border: '1px solid var(--ml-line)', padding: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--ml-gold-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎁</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ml-text)' }}>Ödül kataloğu</div>
              <div style={{ fontSize: 12.5, color: 'var(--ml-text2)', marginTop: 1 }}>{pointsEnabled ? `${affordable} ödül kullanmaya hazır` : `${rewardCatalog.length} ödül`}</div>
            </div>
            <span style={{ fontSize: 18, color: 'var(--ml-text3)' }}>→</span>
          </button>
        )}

        {/* activity */}
        <div style={{ marginTop: 16, marginBottom: 4, fontSize: 13, fontWeight: 700, color: 'var(--ml-text2)', letterSpacing: '.03em', paddingLeft: 4 }}>SON HAREKETLER</div>
        <div style={{ background: 'var(--ml-surface)', borderRadius: 16, border: '1px solid var(--ml-line)', overflow: 'hidden' }}>
          {recentActivity.length === 0 ? (
            <div style={{ padding: '22px 16px', textAlign: 'center', fontSize: 13, color: 'var(--ml-text3)' }}>Henüz hareket yok — ilk siparişinle başlar.</div>
          ) : recentActivity.map((a, i) => {
            const meta = activityMeta(a)
            const d = deltaText(a)
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < recentActivity.length - 1 ? '1px solid var(--ml-line)' : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--ml-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{meta.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ml-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--ml-text3)', marginTop: 1 }}>{relativeTime(a.createdAt)}</div>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: d.positive ? 'var(--ml-accent)' : 'var(--ml-cta)' }}>{d.text}</span>
              </div>
            )
          })}
        </div>

        {/* KVKK consent — current state + revoke/re-grant (flips owner phone view) */}
        {restaurantId && (
          <div style={{ marginTop: 16, background: 'var(--ml-surface)', borderRadius: 16, border: '1px solid var(--ml-line)', overflow: 'hidden' }}>
            <ConsentRow
              title="İletişim & veri izni"
              copy={consentGiven
                ? `${restaurantName} bilgilerinizi görebilir ve sizinle iletişim kurabilir.`
                : 'İzin kapalı — işletme telefon numaranızı göremez.'}
              active={consentGiven}
              busy={consentBusy}
              onToggle={() => void toggleConsent(!consentGiven)}
            />
            <div style={{ height: 1, background: 'var(--ml-line)', marginLeft: 14 }} />
            <ConsentRow
              title="Kampanya SMS izni"
              copy={marketingConsentGiven
                ? 'İndirim ve kampanya SMS’lerini alabilirsiniz.'
                : 'Kampanya SMS’leri gönderilmez.'}
              active={marketingConsentGiven}
              busy={consentBusy}
              onToggle={() => void toggleConsent(!marketingConsentGiven, 'marketing')}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 18 }}>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ml-text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Kapat</button>
          {onLogout && (
            <button type="button" disabled={loggingOut} onClick={async () => { setLoggingOut(true); try { await onLogout() } finally { setLoggingOut(false) } }} style={{ background: 'none', border: 'none', color: 'var(--ml-text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', opacity: loggingOut ? 0.5 : 1 }}>Üyelikten çık</button>
          )}
        </div>
      </div>
    </div>
  )
}

function ConsentRow({ title, copy, active, busy, onToggle }: {
  title: string
  copy: string
  active: boolean
  busy: boolean
  onToggle: () => void
}) {
  return (
    <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ml-text)' }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ml-text2)', marginTop: 2, lineHeight: 1.45 }}>
          {copy}
        </div>
      </div>
      <button
        type="button" disabled={busy} onClick={onToggle}
        style={{
          flexShrink: 0, height: 32, padding: '0 13px', borderRadius: 99, fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
          cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
          border: active ? '1px solid var(--ml-line)' : 'none',
          background: active ? 'transparent' : 'var(--ml-accent)',
          color: active ? 'var(--ml-text2)' : '#fff',
        }}
      >{active ? 'Geri çek' : 'İzin ver'}</button>
    </div>
  )
}

// ── nested sheet primitive (rewards) ─────────────────────────────────────────
function NestedSheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,16,12,.45)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, margin: '0 auto', background: 'var(--ml-bg)', borderRadius: '24px 24px 0 0', maxHeight: '86vh', display: 'flex', flexDirection: 'column', animation: 'ml-sheet-up .34s cubic-bezier(.3,.8,.3,1) both', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}><div style={{ width: 38, height: 4, borderRadius: 99, background: 'var(--ml-line)' }} /></div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 20px 14px' }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ml-text)', fontFamily: 'var(--p-display)' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: 'var(--ml-text2)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--ml-line)', background: 'var(--ml-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="var(--ml-text2)" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 20px calc(20px + env(safe-area-inset-bottom, 12px))' }}>{children}</div>
      </div>
    </div>
  )
}

function RewardsSheet({ points, catalog, pointsEnabled, onRedeem, onClose }: { points: number; catalog: CatalogChoice[]; pointsEnabled: boolean; onRedeem?: (itemId: string) => void; onClose: () => void }) {
  return (
    <NestedSheet title="Ödül kataloğu" subtitle={pointsEnabled ? `${fmt(points)} puanın var` : 'Yakında kullanıma açılıyor'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
        {catalog.map((r, i) => {
          const can = pointsEnabled && points >= r.pointCost
          const usable = can && Boolean(onRedeem)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 12, background: 'var(--ml-surface)', borderRadius: 14, border: '1px solid var(--ml-line)', opacity: can ? 1 : .7 }}>
              <div style={{ width: 50, height: 50, borderRadius: 13, background: 'var(--ml-gold-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🎁</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ml-text)' }}>{r.name}</span>
                  {r.tag && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ml-gold)', background: 'var(--ml-gold-soft)', padding: '1.5px 7px', borderRadius: 99 }}>{r.tag}</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ml-accent)', marginTop: 3 }}>⭐ {fmt(r.pointCost)} puan</div>
              </div>
              <button
                type="button" disabled={!usable} onClick={() => usable && onRedeem!(r.itemId)}
                style={{
                  height: 34, padding: '0 15px', borderRadius: 99, border: 'none', flexShrink: 0,
                  fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit',
                  cursor: usable ? 'pointer' : 'not-allowed',
                  background: usable ? 'var(--ml-accent)' : 'var(--ml-line)',
                  color: usable ? '#fff' : 'var(--ml-text3)',
                }}
              >{can ? 'Kullan' : 'Yetersiz'}</button>
            </div>
          )
        })}
      </div>
    </NestedSheet>
  )
}

// ── orchestrator ─────────────────────────────────────────────────────────────
export default function MemberSheet({
  onClose, onVerified, balances = null, memberName: initialName = null,
  restaurantId, restaurantSlug, restaurantName = 'Sadakat', welcomeBonus = 0, rewardCatalog = [], onRedeemCatalog, onRefresh, onLogout,
}: Props) {
  const [phase, setPhase] = useState<'join' | 'otp' | 'home'>(balances ? 'home' : 'join')
  const [email, setEmail] = useState('')
  const [pendingName, setPendingName] = useState('')
  const [pendingConsent, setPendingConsent] = useState(false)
  const [pendingMarketingConsent, setPendingMarketingConsent] = useState(false)
  const [localName, setLocalName] = useState<string | null>(initialName)
  const [busy, setBusy] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [subSheet, setSubSheet] = useState<null | 'rewards'>(null)

  async function sendOtp(forEmail: string, name = pendingName): Promise<{ ok: boolean; error?: string }> {
    try {
      const { error } = await createMenuAuthBrowserClient().auth.signInWithOtp({
        email: forEmail.trim().toLowerCase(),
        options: { shouldCreateUser: true, data: { full_name: name.trim() } },
      })
      if (error) return { ok: false, error: 'Kod gönderilemedi. Lütfen tekrar deneyin.' }
      return { ok: true }
    } catch {
      return { ok: false, error: 'Bağlantı hatası. Tekrar deneyin.' }
    }
  }

  async function handleEmail(name: string, rawEmail: string, consent: boolean, marketingConsent: boolean) {
    setBusy(true)
    setJoinError('')
    const normalizedEmail = rawEmail.trim().toLowerCase()
    setEmail(normalizedEmail)
    setPendingName(name)
    setPendingConsent(consent)
    setPendingMarketingConsent(marketingConsent)
    const r = await sendOtp(normalizedEmail, name)
    setBusy(false)
    if (!r.ok) { setJoinError(r.error ?? 'Bir hata oluştu.'); return }
    setPhase('otp')
  }

  async function handleGoogle(name: string, consent: boolean, marketingConsent: boolean) {
    setBusy(true)
    setJoinError('')
    const next = restaurantSlug ? `/${restaurantSlug}` : window.location.pathname
    const callback = new URL('/auth/callback', window.location.origin)
    callback.searchParams.set('next', next)
    if (restaurantId) callback.searchParams.set('restaurantId', restaurantId)
    if (name.trim()) callback.searchParams.set('name', name.trim())
    if (consent) callback.searchParams.set('consent', '1')
    if (marketingConsent) callback.searchParams.set('marketingConsent', '1')
    const { error } = await createMenuAuthBrowserClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback.toString() },
    })
    if (error) {
      setJoinError('Google girişi başlatılamadı. Lütfen tekrar deneyin.')
      setBusy(false)
    }
  }

  async function handleVerify(code: string): Promise<boolean> {
    try {
      const { data, error } = await createMenuAuthBrowserClient().auth.verifyOtp({ email, token: code, type: 'email' })
      if (error || !data.user || !data.session) return false
      const res = await fetch('/api/auth/ensure-customer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pendingName.trim() || undefined, restaurantId, consent: pendingConsent, marketingConsent: pendingMarketingConsent }),
      })
      const json = (await res.json()) as { ok: boolean; customer?: { name: string | null } }
      if (!json.ok || !json.customer) return false
      setLocalName(json.customer.name)
      onVerified({ name: json.customer.name })
      setPhase('home')
      return true
    } catch {
      return false
    }
  }

  const name = localName ?? initialName

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,16,12,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', ...ROOT_VARS }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440, background: 'var(--ml-bg)', color: 'var(--ml-text)',
          borderRadius: '24px 24px 0 0', boxShadow: '0 -10px 40px rgba(0,0,0,.22)', fontFamily: 'var(--p-body)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          height: phase === 'home' ? '92vh' : 'auto', maxHeight: '92vh',
          animation: 'ml-sheet-up .34s cubic-bezier(.3,.8,.3,1) both',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, flexShrink: 0 }}>
          <div style={{ width: 38, height: 4, borderRadius: 99, background: 'var(--ml-line)' }} />
        </div>

        {phase === 'join' && (
          <AuthScreen restaurantName={restaurantName} welcomeBonus={welcomeBonus} busy={busy} error={joinError} onEmail={handleEmail} onGoogle={handleGoogle} onSkip={onClose} />
        )}
        {phase === 'otp' && (
          <OTPScreen
            email={email}
            onVerify={handleVerify}
            onResend={async () => (await sendOtp(email)).ok}
            onBack={() => { setPhase('join'); setJoinError('') }}
          />
        )}
        {phase === 'home' && (
          <MemberHome
            balances={balances} name={name} restaurantName={restaurantName} rewardCatalog={rewardCatalog}
            {...(restaurantId ? { restaurantId } : {})}
            onOpenRewards={() => setSubSheet('rewards')}
            {...(onRefresh ? { onRefresh } : {})}
            {...(onLogout ? { onLogout } : {})} onClose={onClose}
          />
        )}
      </div>

      {subSheet === 'rewards' && (
        <RewardsSheet
          points={balances?.points ?? 0}
          pointsEnabled={Boolean(balances?.pointsEnabled)}
          catalog={rewardCatalog}
          {...(onRedeemCatalog ? { onRedeem: (itemId: string) => { onRedeemCatalog(itemId); setSubSheet(null) } } : {})}
          onClose={() => setSubSheet(null)}
        />
      )}
    </div>
  )
}
