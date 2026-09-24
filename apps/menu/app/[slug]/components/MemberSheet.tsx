'use client'

import Image from 'next/image'
import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import type { MemberBalances } from '@garsonless/db/types'
import { useTheme } from '@garsonless/ui/menu'
import { AppIcons } from '@garsonless/ui/icons'
import { MASABU_LOGO_DATA_URI } from '@garsonless/ui/errors'
import type { MemberOpenTarget } from '@garsonless/ui/themes'
import {
  resolveAuthErrorState,
  resolveAuthOtpState,
  resolveAuthSuccessState,
  resolveAuthSurfacePalette,
  type AccountPreviewState,
  type AuthErrorIcon,
  type AuthHeaderTheme,
  type AuthPreviewState,
  type AuthSuccessIcon,
  type ResolvedAuthErrorStateTheme,
  type ResolvedAuthOtpStateTheme,
  type ResolvedAuthStateLayoutTheme,
  type ResolvedAuthSuccessStateTheme,
} from '@garsonless/design-engine'
import type {
  ApiResult,
  CustomerAuthOAuthProvider,
  CustomerSessionView,
} from '../../../lib/customer-auth-contract'
import type { CustomerAccountLoyaltyView, CustomerAccountView } from '../../../lib/customer-account-contract'
import type { CustomerAuthSurface } from '../../../lib/customer-auth-intent'
import { broadcastCustomerSessionEvent } from '../../../lib/customer-auth-client'
import { storePendingCustomerAuthContext } from '../../../lib/menu-continuity-client'
import AccountCenter, { type AccountActions } from './AccountCenter'

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
  authenticated?: boolean
  /** Restaurant the member is verifying on (welcome bonus + card label). */
  restaurantId?: string
  restaurantSlug?: string
  restaurantName?: string
  tableLabel?: string | null
  tableToken?: string | null
  guestSessionId?: string
  deviceId?: string
  authSurface?: CustomerAuthSurface
  authReturn?: 'success' | 'error' | null
  oauthProviders?: readonly CustomerAuthOAuthProvider[]
  /** Server-owned passwordless fallback capability. */
  emailOtpEnabled?: boolean
  /** Server-verified Supabase + Netgsm rollout capability. */
  phoneOtpEnabled?: boolean
  /** Welcome bonus points — drives the "& X puan kazan" join suffix. */
  welcomeBonus?: number
  /** Resolved reward catalog (name + cost) for the teaser/sheet. Empty hides it. */
  rewardCatalog?: CatalogChoice[]
  /** Claim a catalog reward (15c): parent adds the item to cart + sets the intent. */
  onRedeemCatalog?: (itemId: string) => void
  /** Re-fetch balances (e.g. after a consent toggle changes consentGiven). */
  onRefresh?: () => void | Promise<void>
  onAuthContextComplete?: (surface: CustomerAuthSurface) => void
  /** Every authenticated renderer must implement the same account actions. */
  accountActions: AccountActions
  /** Editor-only fixture state. It renders the production auth UI without issuing auth requests. */
  previewState?: AuthPreviewState
  /** Editor-only authenticated account fixture. It never issues mutations. */
  accountPreviewState?: AccountPreviewState
  /** Enables normal browser-history semantics for server-gated smoke fixtures. */
  accountPreviewHistoryEnabled?: boolean
  /** Destination requested by the surface that opened the account sheet. */
  initialTarget?: MemberOpenTarget
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
  '--ml-auth-accent': 'var(--p-accent, #38a169)',
  '--ml-auth-accent-strong': 'color-mix(in srgb, var(--p-accent, #38a169) 78%, #07140d)',
} as React.CSSProperties

const KEYFRAMES = `
@keyframes ml-pulse-dot {0%,100%{box-shadow:0 0 0 0 color-mix(in srgb, var(--ml-accent) 40%, transparent)}50%{box-shadow:0 0 0 6px color-mix(in srgb, var(--ml-accent) 0%, transparent)}}
@keyframes ml-fade-slide {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes ml-shimmer {from{background-position:-160% 0}to{background-position:260% 0}}
@keyframes ml-sheet-up {from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes ml-ring-expand {0%{transform:scale(.8);opacity:.5}100%{transform:scale(1.6);opacity:0}}
@keyframes ml-confetti-drop {0%{transform:translateY(-10px) rotate(0);opacity:0}15%{opacity:1}100%{transform:translateY(60px) rotate(240deg);opacity:0}}
@keyframes ml-spin {to{transform:rotate(360deg)}}
.ml-auth-dialog{width:100%;height:100dvh;max-width:440px;background:var(--ml-auth-surface);color:var(--ml-auth-text);font-family:var(--ml-auth-body);display:flex;flex-direction:column;overflow:hidden;position:relative}
.ml-auth-hero{height:auto;min-height:92px;position:relative;display:flex;align-items:center;border-bottom:1px solid var(--ml-auth-field-border);background:var(--ml-auth-surface);padding:max(14px,env(safe-area-inset-top)) 64px 14px 68px}
.ml-auth-hero-fallback{position:absolute;inset:0;z-index:0;background:linear-gradient(157deg,var(--ml-auth-accent) 0%,var(--ml-auth-accent-strong) 55%,#12271c 100%)}
.ml-auth-hero-media{position:absolute;inset:0;z-index:1;width:100%;height:100%;display:block;object-fit:var(--ml-auth-image-fit);object-position:var(--ml-auth-image-position);background:var(--ml-auth-header-bg)}
.ml-auth-hero-overlay{position:absolute;inset:0;z-index:2;width:100%;height:100%;display:block;pointer-events:none;object-fit:var(--ml-auth-image-fit);object-position:var(--ml-auth-image-position);filter:var(--ml-auth-photo-overlay-filter);opacity:var(--ml-auth-photo-overlay-opacity)}
.ml-auth-header-content{position:relative;z-index:3;display:flex;min-width:0;flex-direction:column;align-items:flex-start;justify-content:center;gap:5px;text-align:left;color:var(--ml-auth-text)}
.ml-auth-header-content[data-align="left"]{align-items:flex-start;text-align:left}
.ml-auth-header-logo{display:block;width:116px;height:auto;max-height:34px;object-fit:contain}
.ml-auth-header-slogan{margin:0;max-width:270px;color:var(--ml-auth-muted);font-size:12px;line-height:1.35;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ml-auth-back{position:absolute;top:max(16px,env(safe-area-inset-top));left:14px;z-index:4;width:44px;height:44px;border-radius:50%;border:1px solid var(--ml-auth-field-border);background:var(--ml-auth-field-surface);color:var(--ml-auth-text);display:flex;align-items:center;justify-content:center;cursor:pointer}
.ml-auth-panel{position:relative;z-index:3;flex:1;min-height:0;padding:var(--ml-auth-state-padding-y) var(--ml-auth-state-padding-x) calc(var(--ml-auth-state-padding-y) + env(safe-area-inset-bottom));background:var(--ml-auth-surface);color:var(--ml-auth-text);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
.ml-auth-state-content{width:100%;max-width:var(--ml-auth-state-max-width);min-height:100%;margin-inline:auto;display:flex;flex-direction:column;gap:var(--ml-auth-state-gap);text-align:left;box-sizing:border-box}
.ml-auth-state-content[data-align="center"]{text-align:center}
.ml-auth-panel[data-auth-state="success"] .ml-auth-state-content,.ml-auth-panel[data-auth-state="error"] .ml-auth-state-content{justify-content:center}
.ml-auth-screen-title{margin:0;color:var(--ml-auth-text);font-family:var(--p-display);font-size:27px;line-height:1.08;font-weight:700;letter-spacing:-.025em;text-wrap:balance}
.ml-auth-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.ml-auth-stack{display:flex;flex:1;flex-direction:column;gap:var(--ml-auth-state-gap);animation:ml-fade-slide .34s cubic-bezier(.2,.7,.2,1) both}
.ml-auth-label{display:flex;flex-direction:column;gap:7px;color:var(--ml-auth-muted);font-size:12px;font-weight:700}
.ml-auth-field-help{display:block;color:var(--ml-auth-muted);font-size:11.5px;line-height:1.4;font-weight:500}
.ml-auth-field-help[data-error="true"]{color:#7d1d12}
.ml-auth-input{width:100%;height:54px;border-radius:14px;background:var(--ml-auth-field-surface);border:1.5px solid var(--ml-auth-field-border);color:var(--ml-auth-text);font:500 15.5px/1 var(--p-body);padding:0 16px;outline:none;box-sizing:border-box}
.ml-auth-input::placeholder{color:color-mix(in srgb,var(--ml-auth-muted) 72%,transparent)}
.ml-auth-input:focus{border-color:var(--ml-auth-accent);background:var(--ml-auth-field-surface);box-shadow:0 0 0 3px color-mix(in srgb,var(--ml-auth-accent) 24%,transparent)}
.ml-auth-primary,.ml-auth-provider,.ml-auth-guest{width:100%;min-height:52px;border-radius:14px;font:700 15px/1.2 var(--p-body);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:transform 150ms,background 150ms,border-color 150ms,opacity 150ms}
.ml-auth-primary{border:0;background:var(--ml-auth-cta);color:var(--ml-auth-cta-text);box-shadow:0 10px 24px -12px color-mix(in srgb,var(--ml-auth-cta) 80%,transparent)}
.ml-auth-provider{position:relative;border:0;background:#fff;color:#111113}
.ml-auth-provider-icon{position:absolute;left:18px;display:block}
.ml-auth-guest{border:1px solid var(--ml-auth-field-border);background:transparent;color:var(--ml-auth-text)}
.ml-auth-primary:not(:disabled):active,.ml-auth-provider:not(:disabled):active,.ml-auth-guest:not(:disabled):active{transform:scale(.985)}
.ml-auth-primary:disabled,.ml-auth-provider:disabled,.ml-auth-guest:disabled{opacity:.48;cursor:not-allowed}
.ml-auth-divider{display:flex;align-items:center;gap:12px;color:var(--ml-auth-muted);font-size:13px;margin:2px 0}
.ml-auth-divider:before,.ml-auth-divider:after{content:"";height:1px;background:var(--ml-auth-field-border);flex:1}
.ml-auth-check{display:grid;grid-template-columns:24px 1fr;gap:10px;align-items:start;min-height:44px;color:var(--ml-auth-muted);font-size:12.5px;line-height:1.5;cursor:pointer}
.ml-auth-check input{appearance:none;width:24px;height:24px;margin:0;border-radius:7px;border:1.5px solid var(--ml-auth-field-border);background:var(--ml-auth-field-surface);display:grid;place-items:center;cursor:pointer}
.ml-auth-check input:checked{border-color:var(--ml-auth-accent);background:var(--ml-auth-accent)}
.ml-auth-check input:checked:after{content:"";width:10px;height:6px;border-left:2px solid var(--ml-auth-cta-text);border-bottom:2px solid var(--ml-auth-cta-text);transform:translateY(-1px) rotate(-45deg)}
.ml-auth-check input:focus-visible{outline:2px solid var(--ml-auth-accent);outline-offset:3px}
.ml-auth-check a{color:var(--ml-auth-accent);font-weight:700;text-underline-offset:2px}
.ml-auth-error,.ml-auth-offline{display:flex;align-items:flex-start;gap:8px;border-radius:12px;padding:10px 12px;font-size:12.5px;line-height:1.45}
.ml-auth-error{color:#7d1d12;background:#fff1ef;border:1px solid #e9a99f}
.ml-auth-offline{color:#624000;background:#fff7df;border:1px solid #dec47d}
.ml-auth-meta{margin:0;color:var(--ml-auth-muted);font-size:14.5px;line-height:1.55}
.ml-auth-phone{display:grid;grid-template-columns:64px minmax(0,1fr);align-items:center;height:54px;border-radius:var(--ml-auth-radius);background:var(--ml-auth-field-surface);border:1.5px solid var(--ml-auth-field-border);overflow:hidden}
.ml-auth-phone:focus-within{border-color:var(--ml-auth-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--ml-auth-accent) 24%,transparent)}
.ml-auth-phone-prefix{height:100%;display:grid;place-items:center;border-right:1px solid var(--ml-auth-field-border);color:var(--ml-auth-text);font-weight:750;font-size:14px}
.ml-auth-phone input{min-width:0;width:100%;height:100%;border:0;outline:0;background:transparent;color:var(--ml-auth-text);font:650 16px/1 var(--p-body);padding:0 14px}
.ml-auth-method-link{min-height:44px;border:0;background:transparent;color:var(--ml-auth-accent);font:750 14px/1.2 var(--p-body);cursor:pointer;padding:0 10px}
.ml-auth-venue{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--ml-auth-accent) 8%,var(--ml-auth-field-surface));color:var(--ml-auth-muted);font-size:12.5px;line-height:1.4}
.ml-auth-bonus{display:inline-flex;align-items:center;align-self:flex-start;min-height:32px;padding:0 11px;border-radius:999px;background:color-mix(in srgb,var(--ml-auth-accent) 12%,var(--ml-auth-field-surface));color:var(--ml-auth-accent);font-size:12px;font-weight:800}
.ml-auth-legal{margin:0;color:var(--ml-auth-muted);font-size:11.5px;line-height:1.5;text-align:center}
.ml-auth-legal a{color:var(--ml-auth-text);text-underline-offset:2px}
.ml-auth-captcha{display:flex;flex-direction:column;gap:8px;align-items:center;padding:12px;border:1px solid var(--ml-auth-field-border);border-radius:12px;background:var(--ml-auth-field-surface)}
.ml-auth-meta strong{color:var(--ml-auth-text);font-weight:700;word-break:break-word}
.ml-auth-otp-email{margin:0;color:var(--ml-auth-text);font-size:14.5px;line-height:1.45;font-weight:750;word-break:break-word}
.ml-auth-benefit{display:flex;align-items:center;gap:8px;color:var(--ml-auth-muted);font-size:12.5px;line-height:1.45;padding:2px 2px 0}
.ml-auth-otp{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.ml-auth-otp input{min-width:0;width:100%;height:58px;border-radius:12px;background:var(--ml-auth-field-surface);border:1.5px solid var(--ml-auth-field-border);color:var(--ml-auth-text);text-align:center;font:700 23px/1 var(--p-mono,var(--p-body));outline:none;box-sizing:border-box}
.ml-auth-otp input:focus,.ml-auth-otp input[data-filled="true"]{border-color:var(--ml-auth-accent);background:var(--ml-auth-field-surface);box-shadow:0 0 0 3px color-mix(in srgb,var(--ml-auth-accent) 20%,transparent)}
.ml-auth-otp input[aria-invalid="true"]{border-color:#ff8e7c;box-shadow:none}
.ml-auth-resend{min-height:44px;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--ml-auth-muted);font-size:13.5px}
.ml-auth-resend button{min-height:44px;border:0;background:none;color:var(--ml-auth-accent);font:700 13.5px/1 var(--p-body);cursor:pointer;padding:0 10px}
.ml-auth-status{display:flex;flex:0 0 auto;min-height:0;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center;gap:var(--ml-auth-state-gap);padding:0}
.ml-auth-state-content[data-align="left"] .ml-auth-status{align-items:flex-start;text-align:left}
.ml-auth-status-icon{width:var(--ml-auth-status-icon-size);height:var(--ml-auth-status-icon-size);flex:0 0 var(--ml-auth-status-icon-size);border-radius:50%;display:grid;place-items:center;background:var(--ml-auth-status-icon-background);border:1px solid color-mix(in srgb,var(--ml-auth-status-icon-color) 58%,var(--ml-auth-status-icon-background));color:var(--ml-auth-status-icon-color)}
.ml-auth-status h2{margin:0;font-family:var(--p-display);font-size:27px;letter-spacing:-.02em}
.ml-auth-status p{margin:0;max-width:100%;color:var(--ml-auth-muted);font-size:14px;line-height:1.55}
.ml-auth-dialog button:focus-visible{outline:3px solid var(--ml-auth-accent);outline-offset:3px}
.ml-auth-panel{border-radius:0}
.ml-auth-input,.ml-auth-otp input{color:var(--ml-auth-text);border-radius:calc(var(--ml-auth-radius) * 1.05)}
.ml-auth-primary,.ml-auth-provider,.ml-auth-guest{border-radius:var(--ml-auth-radius)}
.ml-auth-dialog[data-auth-preset="immersive"] .ml-auth-panel{margin-top:0}
.ml-spin{animation:ml-spin .7s linear infinite}
.ml-auth-overlay[data-account=true]{padding-top:max(12px,env(safe-area-inset-top))}
.ml-account-dialog{width:100%;height:calc(100dvh - max(12px,env(safe-area-inset-top)));max-height:calc(100dvh - max(12px,env(safe-area-inset-top)));background:var(--ml-bg);color:var(--ml-text);font-family:var(--p-body);display:flex;flex-direction:column;overflow:hidden;border-radius:calc(var(--ml-account-radius) * 1.7) calc(var(--ml-account-radius) * 1.7) 0 0;box-shadow:0 -18px 54px rgba(20,16,12,.24)}
.ml-account-handle{width:38px;height:4px;margin:9px auto 3px;border-radius:99px;background:color-mix(in srgb,var(--ml-text2) 38%,transparent);flex:0 0 auto}.ml-account-dialog>.ac-root{height:auto;flex:1}
html[data-customer-auth-preview="true"] nextjs-portal{display:none!important}
@media (min-width:640px){.ml-auth-overlay{align-items:center!important;padding:20px}.ml-auth-dialog{height:min(844px,calc(100dvh - 40px));border-radius:30px;box-shadow:0 34px 90px rgba(0,0,0,.38)}.ml-account-dialog{max-width:720px;height:min(850px,calc(100dvh - 40px));max-height:calc(100dvh - 40px);border-radius:calc(var(--ml-account-radius) * 1.7);box-shadow:0 34px 90px rgba(0,0,0,.38)}.ml-auth-panel{border-radius:30px 30px 0 0}}
@media (prefers-reduced-motion:reduce){.ml-auth-dialog *,.ml-auth-dialog:before,.ml-auth-dialog:after,.ml-account-dialog *{animation:none!important;scroll-behavior:auto!important;transition:none!important}}
`

const fmt = (n: number) => n.toLocaleString('tr-TR')

// ── small shared bits ──────────────────────────────────────────────────────
function Spinner() {
  return <AppIcons.refresh className="ml-spin" size={18} aria-hidden="true" />
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string
}) {
  return (
    <label className="ml-auth-label">
      <span>{label}</span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type}
        className="ml-auth-input"
      />
    </label>
  )
}

const JOIN_AUTH_LAYOUT: ResolvedAuthStateLayoutTheme = {
  paddingX: 22,
  paddingY: 24,
  contentGap: 12,
  align: 'left',
  contentWidth: 'full',
  iconSize: 76,
}

function authStateLayoutVars(layout: ResolvedAuthStateLayoutTheme): React.CSSProperties {
  const maxWidth = layout.contentWidth === 'compact' ? '320px' : layout.contentWidth === 'standard' ? '380px' : '100%'
  return {
    '--ml-auth-state-padding-x': `${layout.paddingX}px`,
    '--ml-auth-state-padding-y': `${layout.paddingY}px`,
    '--ml-auth-state-gap': `${layout.contentGap}px`,
    '--ml-auth-state-max-width': maxWidth,
    '--ml-auth-status-icon-size': `${layout.iconSize}px`,
  } as React.CSSProperties
}

function AuthFrame({ screenTitle, state, layout, restaurantName, backLabel, onBack, children }: {
  screenTitle: string
  state: AuthPreviewState
  layout: ResolvedAuthStateLayoutTheme
  header: AuthHeaderTheme
  restaurantName: string
  restaurantLogoUrl: string | null
  backLabel: string
  onBack: () => void
  children: React.ReactNode
}) {
  const visibleScreenTitle = screenTitle.trim()
  return (
    <>
      <header className="ml-auth-hero" aria-label="masabu giriş alanı">
        <button type="button" className="ml-auth-back" onClick={onBack} aria-label={backLabel}>
          <AppIcons.chevLeft size={22} />
        </button>
        <div className="ml-auth-header-content">
          {/* Official shared Masabu wordmark; restaurant branding stays contextual. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ml-auth-header-logo" src={MASABU_LOGO_DATA_URI} alt="masabu" />
          <p className="ml-auth-header-slogan">{restaurantName}&apos;da devam ediyorsun</p>
        </div>
      </header>
      <section className="ml-auth-panel" data-auth-state={state} style={authStateLayoutVars(layout)}>
        <div className="ml-auth-state-content" data-align={layout.align}>
          <h1 className={visibleScreenTitle ? 'ml-auth-screen-title' : 'ml-auth-sr-only'} id="customer-auth-title">{visibleScreenTitle || 'Giriş'}</h1>
          {children}
        </div>
      </section>
    </>
  )
}

// ── Screen 1: Supabase Auth ─────────────────────────────────────────────────
const PROVIDER_LABELS: Record<CustomerAuthOAuthProvider, string> = {
  google: 'Google',
  apple: 'Apple',
  facebook: 'Facebook',
}

function ProviderIcon({ provider }: { provider: CustomerAuthOAuthProvider }) {
  const source = provider === 'google'
    ? '/brand/google-g.svg'
    : provider === 'apple' ? '/brand/apple-mark.svg' : '/brand/facebook-f.svg'
  return <Image className="ml-auth-provider-icon" src={source} alt="" width={20} height={20} />
}

type RecaptchaApi = {
  render: (element: HTMLElement, options: { sitekey: string; size: 'compact'; callback: (token: string) => void; 'expired-callback': () => void }) => number
  reset: (widgetId: number) => void
}

declare global {
  interface Window { grecaptcha?: RecaptchaApi }
}

const RECAPTCHA_TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'

function CustomerAuthCaptcha({ onToken }: { onToken: (token: string) => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const widgetRef = useRef<number | null>(null)
  const [ready, setReady] = useState(false)
  const siteKey = process.env.NODE_ENV === 'development'
    ? process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || RECAPTCHA_TEST_SITE_KEY
    : process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''

  useEffect(() => {
    if (!ready || !siteKey || !hostRef.current || widgetRef.current !== null || !window.grecaptcha) return
    widgetRef.current = window.grecaptcha.render(hostRef.current, {
      sitekey: siteKey,
      size: 'compact',
      callback: onToken,
      'expired-callback': () => onToken(''),
    })
  }, [onToken, ready, siteKey])

  return (
    <div className="ml-auth-captcha" role="group" aria-label="Güvenlik doğrulaması">
      <Script
        id="masabu-customer-auth-recaptcha"
        src="https://www.google.com/recaptcha/api.js?render=explicit&hl=tr"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      {siteKey ? <div ref={hostRef} /> : <p className="ml-auth-meta">Güvenlik doğrulaması şu anda kullanılamıyor.</p>}
    </div>
  )
}

function formatTurkishMobile(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('90')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  digits = digits.slice(0, 10)
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)]
    .filter(Boolean)
    .join(' ')
}

function AuthScreen({ restaurantName, restaurantLogoUrl, header, welcomeBonus, busy, error, offline, oauthProviders, emailOtpEnabled, phoneOtpEnabled, challengeRequired, onPhone, onEmail, onOAuth, onSkip }: {
  restaurantName: string; restaurantLogoUrl: string | null; header: AuthHeaderTheme; welcomeBonus: number; busy: boolean; error: string; offline: boolean
  oauthProviders: readonly CustomerAuthOAuthProvider[]
  emailOtpEnabled: boolean
  phoneOtpEnabled: boolean
  challengeRequired: boolean
  onPhone: (phone: string, captchaToken?: string) => void
  onEmail: (email: string, captchaToken?: string) => void
  onOAuth: (provider: CustomerAuthOAuthProvider) => void
  onSkip: () => void
}) {
  const [method, setMethod] = useState<'phone' | 'email'>(phoneOtpEnabled ? 'phone' : 'email')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const phoneValid = /^5\d{2} \d{3} \d{2} \d{2}$/.test(phone)
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const methodValid = (method === 'phone' ? phoneValid : emailValid) && (!challengeRequired || Boolean(captchaToken))
  const otpMethodEnabled = method === 'phone' ? phoneOtpEnabled : emailOtpEnabled

  return (
    <AuthFrame screenTitle="masabu hesabına devam et" state="join" layout={JOIN_AUTH_LAYOUT} header={header} restaurantName={restaurantName} restaurantLogoUrl={restaurantLogoUrl} backLabel="Menüye dön" onBack={onSkip}>
      <div className="ml-auth-stack" aria-busy={busy}>
        <p className="ml-auth-meta">Hesabın varsa giriş yaparsın, yoksa hesabını oluştururuz.</p>
        <div className="ml-auth-venue"><AppIcons.shield size={17} aria-hidden="true" /><span><strong>{restaurantName}</strong> için sipariş, favori ve sadakat bilgilerin korunur.</span></div>
        {welcomeBonus > 0 && <span className="ml-auth-bonus">İlk üyelikte {welcomeBonus.toLocaleString('tr-TR')} puana kadar kazan</span>}
        {offline && <div className="ml-auth-offline" role="status"><AppIcons.warn size={17} />Çevrimdışısın. Giriş için bağlantını kontrol et.</div>}

        {otpMethodEnabled && (method === 'phone' ? (
          <label className="ml-auth-label">
            <span>Telefon numarası</span>
            <span className="ml-auth-phone">
              <span className="ml-auth-phone-prefix" aria-hidden="true">+90</span>
              <input
                autoFocus
                value={phone}
                onChange={(event) => setPhone(formatTurkishMobile(event.target.value))}
                placeholder="5xx xxx xx xx"
                inputMode="tel"
                autoComplete="tel"
                aria-label="Türkiye mobil telefon numarası"
                aria-describedby="customer-auth-phone-help"
                aria-invalid={phone.length > 0 && !phoneValid}
              />
            </span>
            <small id="customer-auth-phone-help" className="ml-auth-field-help" data-error={phone.length > 0 && !phoneValid}>
              {phone.length > 0 && !phoneValid
                ? '5 ile başlayan 10 haneli Türkiye mobil numarası gir.'
                : 'Yalnız Türkiye mobil numaraları desteklenir.'}
            </small>
          </label>
        ) : <Field label="E-posta" value={email} onChange={setEmail} placeholder="ornek@eposta.com" type="email" />)}

        {otpMethodEnabled && challengeRequired && <CustomerAuthCaptcha key={method} onToken={setCaptchaToken} />}
        <div aria-live="polite" aria-atomic="true">
          {error && <div className="ml-auth-error" role="alert"><AppIcons.warn size={17} />{error}</div>}
        </div>

        {otpMethodEnabled && <button
          type="button"
          className="ml-auth-primary"
          onClick={() => methodValid && !busy && !offline && (method === 'phone'
            ? onPhone(phone, captchaToken || undefined)
            : onEmail(email.trim().toLowerCase(), captchaToken || undefined))}
          disabled={!methodValid || busy || offline}
        >
          {busy ? <><Spinner /> Gönderiliyor…</> : 'Doğrulama kodu gönder'}
        </button>}

        {oauthProviders.length > 0 && <>
          <div className="ml-auth-divider">veya</div>
          {oauthProviders.map((provider) => (
            <button key={provider} type="button" className="ml-auth-provider" onClick={() => !busy && !offline && onOAuth(provider)} disabled={busy || offline}>
              <ProviderIcon provider={provider} /> {PROVIDER_LABELS[provider]} ile devam et
            </button>
          ))}
        </>}

        {phoneOtpEnabled && emailOtpEnabled && <button type="button" className="ml-auth-method-link" onClick={() => { setMethod(method === 'phone' ? 'email' : 'phone'); setCaptchaToken('') }}>
          {method === 'phone' ? 'E-posta ile devam et' : 'Telefon numarasıyla devam et'}
        </button>}
        <button type="button" className="ml-auth-guest" onClick={onSkip}>Misafir olarak devam et <AppIcons.arrow size={17} /></button>
        <p className="ml-auth-legal">Devam ederek <a href="https://masabu.co/yasal/abonelik-hizmet-sozlesmesi" target="_blank" rel="noreferrer">Üyelik Koşulları</a>&apos;nı kabul eder ve <a href="https://masabu.co/yasal/kvkk-aydinlatma-metni" target="_blank" rel="noreferrer">Aydınlatma Metni</a>&apos;ni okuduğunu beyan edersin. Pazarlama izni giriş için gerekli değildir.</p>
      </div>
    </AuthFrame>
  )
}

// ── Screen 1.5: OTP ─────────────────────────────────────────────────────────
type AuthAttemptResult = { ok: boolean; error?: string; resendAfterSeconds?: number }

function OTPScreen({ destination, method, restaurantName, restaurantLogoUrl, header, config, resendAfterSeconds, offline, onVerify, onResend, onBack }: {
  destination: string
  method: 'email' | 'phone'
  restaurantName: string
  restaurantLogoUrl: string | null
  header: AuthHeaderTheme
  config: ResolvedAuthOtpStateTheme
  resendAfterSeconds: number
  offline: boolean
  onVerify: (code: string) => Promise<AuthAttemptResult>
  onResend: () => Promise<AuthAttemptResult>
  onBack: () => void
}) {
  const LEN = 6
  const [digits, setDigits] = useState<string[]>(() => Array(LEN).fill(''))
  const [secs, setSecs] = useState(resendAfterSeconds)
  const [error, setError] = useState('')
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
    if (verifying || offline) return
    setVerifying(true)
    setError('')
    const result = await onVerify(val)
    if (!result.ok) {
      setError(result.error ?? 'Kod doğrulanamadı. Lütfen tekrar dene.')
      setDigits(Array(LEN).fill(''))
      refs.current[0]?.focus()
      setVerifying(false)
    }
    // on success the parent unmounts this screen
  }

  function setAt(i: number, raw: string) {
    const numeric = raw.replace(/\D/g, '')
    setError('')
    if (numeric.length > 1) {
      const arr = numeric.slice(0, LEN).split('')
      const next = Array(LEN).fill('').map((_, k) => arr[k] || '')
      setDigits(next)
      refs.current[Math.min(arr.length, LEN) - 1]?.focus()
      return
    }
    const v = numeric.slice(-1)
    const next = [...digits]
    next[i] = v
    setDigits(next)
    if (v && i < LEN - 1) refs.current[i + 1]?.focus()
  }
  function onKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
  }
  async function resend() {
    if (offline) return
    const result = await onResend()
    if (result.ok) {
      setSecs(result.resendAfterSeconds ?? 60)
      setError('')
    } else {
      setError(result.error ?? 'Yeni kod gönderilemedi. Lütfen tekrar dene.')
    }
  }
  function pasteCode(event: React.ClipboardEvent) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LEN)
    if (!pasted) return
    event.preventDefault()
    const next = Array.from({ length: LEN }, (_, index) => pasted[index] ?? '')
    setDigits(next)
    setError('')
    refs.current[Math.min(pasted.length, LEN) - 1]?.focus()
  }

  return (
    <AuthFrame screenTitle={method === 'phone' ? 'Telefonunu doğrula' : config.title} state="otp" layout={config.layout} header={header} restaurantName={restaurantName} restaurantLogoUrl={restaurantLogoUrl} backLabel="Giriş yöntemlerine dön" onBack={onBack}>
    <div className="ml-auth-stack" aria-busy={verifying}>
      {offline && <div className="ml-auth-offline" role="status"><AppIcons.warn size={17} />Çevrimdışısın. Kodu doğrulamak için bağlantını kontrol et.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ml-auth-state-gap)' }}>
        <p className="ml-auth-otp-email">{destination}</p>
        <p className="ml-auth-meta">{method === 'phone' ? '6 haneli kod birkaç dakika içinde gelebilir. Kodu kimseyle paylaşma.' : config.description}</p>
      </div>

      <div>
        <div className="ml-auth-otp" onPaste={pasteCode} aria-label="6 haneli doğrulama kodu">
          {digits.map((d, i) => (
            <input
              key={i} ref={(el) => { refs.current[i] = el }} value={d} inputMode="numeric" maxLength={1}
              onChange={(e) => setAt(i, e.target.value)} onKeyDown={(e) => onKey(i, e)}
              aria-label={`${i + 1}. hane`}
              aria-invalid={Boolean(error)}
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              data-filled={Boolean(d)}
            />
          ))}
        </div>
        <div className="ml-auth-resend">
          {secs > 0
            ? <>{config.resendLabel} · {secs}s</>
            : <button type="button" onClick={() => void resend()} disabled={offline}>{config.resendLabel}</button>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          type="button" className="ml-auth-primary" onClick={() => full && void submit(code)} disabled={!full || verifying || offline}
        >
          {verifying ? <><Spinner /> Doğrulanıyor…</> : config.primaryActionLabel}
        </button>
        <div aria-live="assertive" aria-atomic="true">
          {error && <div className="ml-auth-error" role="alert"><AppIcons.warn size={17} />{error}</div>}
        </div>
      </div>
    </div>
    </AuthFrame>
  )
}

function ProfileCompletionScreen({ restaurantName, restaurantLogoUrl, header, onComplete, onSkip }: {
  restaurantName: string
  restaurantLogoUrl: string | null
  header: AuthHeaderTheme
  onComplete: (name: string) => Promise<AuthAttemptResult>
  onSkip: () => void
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (name.trim().length < 2 || busy) return
    setBusy(true)
    setError('')
    const result = await onComplete(name.trim())
    if (!result.ok) setError(result.error ?? 'İsim kaydedilemedi. Daha sonra tekrar deneyebilirsin.')
    setBusy(false)
  }

  return (
    <AuthFrame screenTitle="Sana nasıl hitap edelim?" state="profile" layout={JOIN_AUTH_LAYOUT} header={header} restaurantName={restaurantName} restaurantLogoUrl={restaurantLogoUrl} backLabel="Şimdilik geç" onBack={onSkip}>
      <div className="ml-auth-stack" aria-busy={busy}>
        <p className="ml-auth-meta">Bu bilgi selamlamalarda kullanılır. İstersen şimdi geçip Profil alanından sonra ekleyebilirsin.</p>
        <Field label="Ad Soyad" value={name} onChange={setName} placeholder="Adın Soyadın" />
        <div aria-live="polite">{error && <div className="ml-auth-error" role="alert"><AppIcons.warn size={17} />{error}</div>}</div>
        <button type="button" className="ml-auth-primary" disabled={name.trim().length < 2 || busy} onClick={() => void submit()}>
          {busy ? <><Spinner /> Kaydediliyor…</> : 'Kaydet ve devam et'}
        </button>
        <button type="button" className="ml-auth-guest" onClick={onSkip}>Şimdilik geç</button>
      </div>
    </AuthFrame>
  )
}

function AuthStatusGlyph({ icon, size }: { icon: AuthSuccessIcon | AuthErrorIcon; size: number }) {
  const Icon = AppIcons[icon]
  return <Icon size={Math.round(size * .45)} />
}

function AuthReturnScreen({ restaurantName, restaurantLogoUrl, header, status, config, onClose }: {
  restaurantName: string
  restaurantLogoUrl: string | null
  header: AuthHeaderTheme
  status: 'success' | 'error'
  config: ResolvedAuthSuccessStateTheme | ResolvedAuthErrorStateTheme
  onClose: () => void
}) {
  return (
    <AuthFrame screenTitle={config.title} state={status} layout={config.layout} header={header} restaurantName={restaurantName} restaurantLogoUrl={restaurantLogoUrl} backLabel="Menüye dön" onBack={onClose}>
      <div
        className="ml-auth-status"
        data-status={status}
        role={status === 'error' ? 'alert' : 'status'}
        aria-live={status === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
        style={{
          '--ml-auth-status-icon-color': config.iconColor,
          '--ml-auth-status-icon-background': config.iconBackground,
        } as React.CSSProperties}
      >
        <div className="ml-auth-status-icon" aria-hidden="true"><AuthStatusGlyph icon={config.icon} size={config.layout.iconSize} /></div>
        {config.description && <p>{config.description}</p>}
        <button type="button" className="ml-auth-primary" onClick={onClose}>{config.primaryActionLabel}</button>
      </div>
    </AuthFrame>
  )
}

// ── Screen 2: Member home ────────────────────────────────────────────────────
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
          <button type="button" onClick={onClose} aria-label="Ödül kataloğunu kapat" style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--ml-line)', background: 'var(--ml-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  minHeight: 44, padding: '0 15px', borderRadius: 99, border: 'none', flexShrink: 0,
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
  authenticated = false, restaurantId, restaurantSlug, restaurantName = 'Sadakat',
  tableToken = null, guestSessionId, deviceId, authSurface = 'menu', authReturn = null,
  oauthProviders = [],
  emailOtpEnabled = true,
  phoneOtpEnabled = false,
  welcomeBonus = 0, rewardCatalog = [], onRedeemCatalog, onRefresh: _onRefresh,
  onAuthContextComplete, accountActions, previewState, accountPreviewState, accountPreviewHistoryEnabled = false, initialTarget = 'overview',
}: Props) {
  const { theme, logoUrl: restaurantLogoUrl } = useTheme()
  const authTheme = theme.surfaces?.auth
  const otpStateTheme = resolveAuthOtpState(authTheme)
  const successStateTheme = resolveAuthSuccessState(authTheme)
  const errorStateTheme = resolveAuthErrorState(authTheme)
  const authHeader: AuthHeaderTheme = authTheme?.header ?? {
    logoMode: 'restaurant',
    align: 'center',
    overlay: 48,
  }
  const authOverride = authTheme?.override ?? {}
  const authHeaderBackground = authHeader.backgroundImageUrl ?? authTheme?.heroImageUrl
  const renderedAuthHeader: AuthHeaderTheme = authHeaderBackground && !authHeader.backgroundImageUrl
    ? { ...authHeader, backgroundImageUrl: authHeaderBackground }
    : authHeader
  const authPalette = resolveAuthSurfacePalette(theme)
  const headerHeight = renderedAuthHeader.height
    ?? (authTheme?.preset === 'minimal' ? 'compact' : authTheme?.preset === 'immersive' ? 'wide' : 'standard')
  const headerHeightPx = headerHeight === 'compact' ? 170 : headerHeight === 'wide' ? 310 : 230
  const headerTone = renderedAuthHeader.contentTone ?? 'light'
  const headerOverlay = Math.min(85, Math.max(0, renderedAuthHeader.overlay)) / 100
  const rootVars = {
    ...ROOT_VARS,
    '--ml-auth-bg': authPalette.background,
    '--ml-auth-surface': authPalette.surface,
    '--ml-auth-text': authPalette.text,
    '--ml-auth-muted': authPalette.mutedText,
    '--ml-auth-field-surface': authPalette.fieldSurface,
    '--ml-auth-field-border': authPalette.fieldBorder,
    '--ml-auth-accent': authPalette.accent,
    '--ml-auth-accent-strong': `color-mix(in srgb, ${authPalette.accent} 78%, #07140d)`,
    '--ml-auth-cta': authPalette.cta,
    '--ml-auth-cta-text': authPalette.ctaText,
    '--ml-auth-radius': `${authOverride.radius ?? 14}px`,
    '--ml-auth-body': authOverride.bodyFont ?? theme.bodyFont,
    '--ml-auth-header-height': `${headerHeightPx}px`,
    '--ml-auth-header-bg': renderedAuthHeader.backgroundColor ?? '#12271c',
    '--ml-auth-image-fit': renderedAuthHeader.imageFit ?? 'cover',
    '--ml-auth-image-position': `${renderedAuthHeader.imagePositionX ?? 50}% ${renderedAuthHeader.imagePositionY ?? 50}%`,
    '--ml-auth-photo-overlay-filter': headerTone === 'dark' ? 'brightness(0) invert(1)' : 'brightness(0)',
    '--ml-auth-photo-overlay-opacity': String(headerOverlay),
    '--ml-auth-header-text': headerTone === 'dark' ? '#151719' : '#ffffff',
    '--ml-auth-header-muted': headerTone === 'dark' ? '#34373a' : '#e7e8ea',
    '--ml-auth-header-control-bg': headerTone === 'dark' ? 'rgba(255,255,255,.68)' : 'rgba(0,0,0,.28)',
    '--ml-auth-header-control-border': headerTone === 'dark' ? 'rgba(20,23,25,.22)' : 'rgba(255,255,255,.28)',
  } as React.CSSProperties
  const checkoutOverride = theme.surfaces?.checkout.override ?? {}
  const accountVars = {
    ...rootVars,
    '--ml-bg': checkoutOverride.background ?? theme.bg,
    '--ml-surface': checkoutOverride.surface ?? theme.cardColor ?? '#ffffff',
    '--ml-text': checkoutOverride.text ?? theme.textColor ?? '#1c1d20',
    '--ml-text2': checkoutOverride.mutedText ?? theme.mutedTextColor ?? '#6c6f76',
    '--ml-line': checkoutOverride.fieldBorder ?? theme.borderColor ?? '#e3e4e7',
    '--ml-accent': checkoutOverride.accent ?? theme.accent,
    '--ml-accent-soft': checkoutOverride.accentSoft ?? theme.accentSoft,
    '--ml-cta': checkoutOverride.cta ?? theme.cta ?? theme.accent,
    '--ml-account-radius': `${checkoutOverride.radius ?? theme.radius}px`,
  } as React.CSSProperties
  const [phase, setPhase] = useState<'join' | 'otp' | 'profile' | 'return' | 'home'>(() => {
    if (previewState === 'otp') return 'otp'
    if (previewState === 'profile') return 'profile'
    if (previewState === 'success' || previewState === 'error') return 'return'
    if (authReturn === 'success' && authenticated && !initialName) return 'profile'
    return authenticated ? 'home' : 'join'
  })
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [maskedDestination, setMaskedDestination] = useState('')
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email')
  const [challengeRequired, setChallengeRequired] = useState(previewState === 'challenge')
  const [pendingIntent, setPendingIntent] = useState('')
  const [localName, setLocalName] = useState<string | null>(initialName)
  const [busy, setBusy] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [resendAfterSeconds, setResendAfterSeconds] = useState(60)
  const [offline, setOffline] = useState(() => previewState ? false : typeof navigator !== 'undefined' && !navigator.onLine)
  const [subSheet, setSubSheet] = useState<null | 'rewards'>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef(onClose)
  const accountHistoryTokenRef = useRef<string | null>(null)
  closeRef.current = onClose

  useEffect(() => {
    const body = document.body
    const root = document.documentElement
    const previousBodyOverflow = body.style.overflow
    const previousBodyPaddingRight = body.style.paddingRight
    const previousRootOverflow = root.style.overflow
    const previousOverscroll = root.style.overscrollBehavior
    const scrollbarGap = Math.max(0, window.innerWidth - root.clientWidth)
    body.style.overflow = 'hidden'
    root.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'none'
    if (scrollbarGap > 0) body.style.paddingRight = `${scrollbarGap}px`
    return () => {
      body.style.overflow = previousBodyOverflow
      body.style.paddingRight = previousBodyPaddingRight
      root.style.overflow = previousRootOverflow
      root.style.overscrollBehavior = previousOverscroll
    }
  }, [])

  useEffect(() => {
    if (
      previewState
      || (accountPreviewState && !accountPreviewHistoryEnabled)
      || (phase !== 'home' && !accountPreviewState)
    ) return
    const token = crypto.randomUUID()
    accountHistoryTokenRef.current = token
    const currentState = window.history.state && typeof window.history.state === 'object' ? window.history.state : {}
    window.history.pushState({ ...currentState, __masabuAccount: { token, view: 'root' } }, '')
    const handlePopState = () => {
      const marker = window.history.state?.__masabuAccount as { token?: string } | undefined
      if (marker?.token === token) return
      closeRef.current()
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      accountHistoryTokenRef.current = null
    }
  }, [accountPreviewHistoryEnabled, accountPreviewState, phase, previewState])

  useEffect(() => {
    if (previewState) {
      setJoinError('')
      if (previewState === 'otp') {
        setPhone('532 123 45 67')
        setMaskedDestination('+90 5** *** 4567')
        setAuthMethod('phone')
        setResendAfterSeconds(42)
        setPhase('otp')
      } else if (previewState === 'profile') {
        setPhase('profile')
      } else if (previewState === 'success' || previewState === 'error') {
        setPhase('return')
      } else {
        setEmail('')
        setChallengeRequired(previewState === 'challenge')
        setPhase('join')
      }
      return
    }
    if (authReturn === 'success' && authenticated && !initialName) setPhase('profile')
    else if (authReturn) setPhase('return')
  }, [authReturn, authenticated, initialName, previewState])

  useEffect(() => {
    if (!previewState) return
    const previous = document.documentElement.getAttribute('data-customer-auth-preview')
    document.documentElement.setAttribute('data-customer-auth-preview', 'true')
    return () => {
      if (previous === null) document.documentElement.removeAttribute('data-customer-auth-preview')
      else document.documentElement.setAttribute('data-customer-auth-preview', previous)
    }
  }, [previewState])

  useEffect(() => {
    if (previewState) return
    if (process.env.NODE_ENV !== 'development') return
    const preview = new URLSearchParams(window.location.search).get('__customerAuthPreview')
    if (preview === 'otp') {
      setEmail('ornek@eposta.com')
      setPhase('otp')
    } else if (preview === 'return') {
      setPhase('return')
    }
    if (new URLSearchParams(window.location.search).has('__customerAccountPreview')) {
      setLocalName('Deniz Yılmaz')
      setPhase('home')
    }
  }, [previewState])

  useEffect(() => {
    if (previewState) {
      setOffline(false)
      return
    }
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [previewState])

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const frame = window.requestAnimationFrame(() => {
      dialog?.querySelector<HTMLElement>('input,button:not([disabled]),a[href]')?.focus()
    })
    return () => {
      window.cancelAnimationFrame(frame)
      previous?.focus()
    }
  }, [])

  useEffect(() => {
    if (phase !== 'home' && !accountPreviewState) return
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>('button[aria-label="Hesabı kapat"]')
        ?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [accountPreviewState, phase])

  function handleDialogKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      requestClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    ) ?? []).filter((element) => element.offsetParent !== null)
    if (focusable.length === 0) return
    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function requestClose() {
    const token = accountHistoryTokenRef.current
    const marker = window.history.state?.__masabuAccount as { token?: string; view?: string } | undefined
    if (token && marker?.token === token) {
      window.history.go(marker.view === 'detail' ? -2 : -1)
      return
    }
    closeRef.current()
  }

  function authContext() {
    if (restaurantId && restaurantSlug) {
      storePendingCustomerAuthContext({
        restaurantId,
        restaurantSlug,
        tableToken,
        surface: authSurface,
        memberTarget: initialTarget,
      })
    }
    return {
      returnPath: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      surface: authSurface,
      ...(restaurantId ? { restaurantId } : {}),
      ...(restaurantSlug ? { restaurantSlug } : {}),
      ...(tableToken ? { qrToken: tableToken } : {}),
      ...(guestSessionId ? { guestSessionId } : {}),
      ...(deviceId ? { deviceId } : {}),
    }
  }

  function authErrorMessage(result: ApiResult<unknown>): string {
    if (result.ok) return ''
    switch (result.error.code) {
      case 'RATE_LIMITED': return 'Çok fazla deneme yapıldı. Lütfen biraz bekleyin.'
      case 'PROVIDER_DISABLED': return 'Bu giriş yöntemi şu anda kullanılamıyor.'
      case 'PLAN_REQUIRED': return 'Bu işletmede müşteri hesabı özelliği açık değil.'
      case 'PHONE_INVALID': return 'Türkiye mobil numaranı 5xx xxx xx xx biçiminde kontrol et.'
      case 'CHALLENGE_REQUIRED': return 'Devam etmek için güvenlik doğrulamasını tamamla.'
      case 'STAFF_ACCOUNT_REJECTED': return 'Personel hesabıyla müşteri girişi yapılamaz.'
      case 'IDENTITY_CONFLICT': return 'Bu kimlik başka bir müşteri hesabına bağlı.'
      case 'CONTEXT_EXPIRED': return 'Giriş isteğinin süresi doldu. Lütfen yeniden başlayın.'
      case 'OTP_INVALID': return 'Kod hatalı. 6 haneyi kontrol edip tekrar dene.'
      case 'OTP_EXPIRED': return 'Kodun süresi doldu. Yeni bir kod iste.'
      case 'SESSION_EXPIRED': return 'Oturumun süresi doldu. Lütfen yeniden giriş yap.'
      default: return 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'
    }
  }

  async function sendEmailOtp(forEmail: string, captchaToken?: string): Promise<AuthAttemptResult> {
    if (previewState) {
      setPendingIntent('customer-auth-preview')
      setResendAfterSeconds(42)
      return { ok: true, resendAfterSeconds: 42 }
    }
    try {
      const response = await fetch('/api/customer-auth/email/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forEmail.trim().toLowerCase(),
          ...(captchaToken ? { captchaToken } : {}),
          ...authContext(),
        }),
      })
      const result = await response.json() as ApiResult<{ intent: string; resendAfterSeconds: number }>
      if (!response.ok || !result.ok) {
        if (!result.ok && result.error.code === 'CHALLENGE_REQUIRED') {
          setChallengeRequired(true)
          setJoinError(authErrorMessage(result))
          setPhase('join')
        }
        return { ok: false, error: authErrorMessage(result) }
      }
      setChallengeRequired(false)
      setPendingIntent(result.data.intent)
      setResendAfterSeconds(result.data.resendAfterSeconds)
      return { ok: true, resendAfterSeconds: result.data.resendAfterSeconds }
    } catch {
      return { ok: false, error: 'Bağlantı hatası. Tekrar deneyin.' }
    }
  }

  async function handleEmail(rawEmail: string, captchaToken?: string) {
    setBusy(true)
    setJoinError('')
    const normalizedEmail = rawEmail.trim().toLowerCase()
    setEmail(normalizedEmail)
    setAuthMethod('email')
    setMaskedDestination(normalizedEmail)
    const r = await sendEmailOtp(normalizedEmail, captchaToken)
    setBusy(false)
    if (!r.ok) { setJoinError(r.error ?? 'Bir hata oluştu.'); return }
    setPhase('otp')
  }

  async function handlePhone(rawPhone: string, captchaToken?: string) {
    setBusy(true)
    setJoinError('')
    setPhone(rawPhone)
    setAuthMethod('phone')
    if (previewState) {
      setPendingIntent('customer-auth-preview')
      setMaskedDestination('+90 5** *** 4567')
      setResendAfterSeconds(42)
      setPhase('otp')
      setBusy(false)
      return
    }
    try {
      const response = await fetch('/api/customer-auth/phone/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: rawPhone, ...(captchaToken ? { captchaToken } : {}), ...authContext() }),
      })
      const result = await response.json() as ApiResult<{ intent: string; resendAfterSeconds: number; maskedDestination: string }>
      if (!response.ok || !result.ok) {
        if (!result.ok && result.error.code === 'CHALLENGE_REQUIRED') setChallengeRequired(true)
        setJoinError(authErrorMessage(result))
        setBusy(false)
        return
      }
      setPendingIntent(result.data.intent)
      setMaskedDestination(result.data.maskedDestination)
      setResendAfterSeconds(result.data.resendAfterSeconds)
      setChallengeRequired(false)
      setPhase('otp')
    } catch {
      setJoinError('Bağlantı hatası. Tekrar deneyin.')
    }
    setBusy(false)
  }

  async function resendPhoneOtp(): Promise<AuthAttemptResult> {
    if (previewState) return { ok: true, resendAfterSeconds: 42 }
    try {
      const response = await fetch('/api/customer-auth/phone/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, ...authContext() }),
      })
      const result = await response.json() as ApiResult<{ intent: string; resendAfterSeconds: number; maskedDestination: string }>
      if (!response.ok || !result.ok) {
        if (!result.ok && result.error.code === 'CHALLENGE_REQUIRED') {
          setChallengeRequired(true)
          setJoinError(authErrorMessage(result))
          setPhase('join')
        }
        return { ok: false, error: authErrorMessage(result) }
      }
      setPendingIntent(result.data.intent)
      setMaskedDestination(result.data.maskedDestination)
      return { ok: true, resendAfterSeconds: result.data.resendAfterSeconds }
    } catch {
      return { ok: false, error: 'Bağlantı hatası. Tekrar deneyin.' }
    }
  }

  async function handleOAuth(provider: CustomerAuthOAuthProvider) {
    setBusy(true)
    setJoinError('')
    if (previewState) {
      setPhase('return')
      setBusy(false)
      return
    }
    try {
      const response = await fetch('/api/customer-auth/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, ...authContext() }),
      })
      const result = await response.json() as ApiResult<{ redirectUrl: string }>
      if (!response.ok || !result.ok) {
        setJoinError(authErrorMessage(result))
        setBusy(false)
        return
      }
      window.location.assign(result.data.redirectUrl)
    } catch {
      setJoinError('Bağlantı hatası. Tekrar deneyin.')
      setBusy(false)
    }
  }

  async function handleVerify(code: string): Promise<AuthAttemptResult> {
    if (previewState) {
      setPhase('return')
      return { ok: true }
    }
    try {
      if (!pendingIntent) return { ok: false, error: 'Doğrulama isteğinin süresi doldu. Lütfen yeniden başla.' }
      const response = await fetch(authMethod === 'phone' ? '/api/customer-auth/phone/verify' : '/api/customer-auth/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: pendingIntent, code }),
      })
      const result = await response.json() as ApiResult<CustomerSessionView & { profileCompletionRequired?: boolean }>
      if (!response.ok || !result.ok) return { ok: false, error: authErrorMessage(result) }
      if (!result.data.authenticated || !result.data.profile) return { ok: false, error: 'Kod doğrulanamadı. Lütfen tekrar dene.' }
      setLocalName(result.data.profile.name)
      onVerified({ name: result.data.profile.name })
      broadcastCustomerSessionEvent('signed-in')
      setPhase(result.data.profileCompletionRequired || !result.data.profile.name ? 'profile' : 'home')
      if (result.data.profile.name) onAuthContextComplete?.(authSurface)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Bağlantı hatası. Tekrar deneyin.' }
    }
  }

  async function handleProfileComplete(nextName: string): Promise<AuthAttemptResult> {
    if (previewState) {
      setLocalName(nextName)
      setPhase('home')
      return { ok: true }
    }
    try {
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName }),
      })
      const result = await response.json() as ApiResult<CustomerAccountView>
      if (!response.ok || !result.ok) return { ok: false, error: authErrorMessage(result) }
      setLocalName(result.data.profile.name)
      onVerified({ name: result.data.profile.name })
      setPhase('home')
      onAuthContextComplete?.(authSurface)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Bağlantı hatası. Tekrar deneyin.' }
    }
  }

  function skipProfileCompletion() {
    setPhase('home')
    onAuthContextComplete?.(authSurface)
  }

  const name = localName ?? initialName
  const visiblePhase = accountPreviewState
    ? 'home'
    : previewState === 'otp'
    ? 'otp'
    : previewState === 'profile'
      ? 'profile'
    : previewState === 'success' || previewState === 'error'
      ? 'return'
      : previewState === 'join' || previewState === 'challenge'
        ? 'join'
      : phase
  const visibleReturnStatus = previewState === 'error' ? 'error' : authReturn ?? 'success'
  const visibleReturnTheme = visibleReturnStatus === 'error' ? errorStateTheme : successStateTheme
  const currentRestaurantLoyalty: CustomerAccountLoyaltyView | null = balances && restaurantId && restaurantSlug
    ? {
        restaurant: {
          id: restaurantId,
          slug: restaurantSlug,
          name: restaurantName,
          logoUrl: restaurantLogoUrl,
        },
        points: balances.points,
        stamps: balances.stamps,
        stampGoal: balances.stampGoal,
        stampRewardText: balances.stampRewardText,
        stampUnlocked: balances.stampUnlocked,
        pointsEnabled: balances.pointsEnabled,
        stampsEnabled: balances.stampEnabled,
        tier: { name: balances.tier.name, color: balances.tier.color },
        nextTier: balances.nextTier
          ? { name: balances.nextTier.name, minimumPoints: balances.nextTier.min }
          : null,
        tierProgress: balances.tierProgress,
        lifetimePoints: balances.lifetimePoints,
      }
    : null

  return (
    <div className="ml-auth-overlay" data-account={visiblePhase === 'home'} data-auth-preview={previewState || accountPreviewState ? 'true' : undefined} onClick={requestClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,16,12,.62)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', ...(visiblePhase === 'home' ? accountVars : rootVars) }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={visiblePhase === 'home' ? undefined : 'customer-auth-title'}
        aria-label={visiblePhase === 'home' ? 'Müşteri hesabı' : undefined}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={visiblePhase === 'home' ? 'ml-account-dialog' : 'ml-auth-dialog'}
        data-auth-preset={visiblePhase === 'home' ? undefined : authTheme?.preset ?? 'brand-panel'}
      >
        {visiblePhase === 'home' && <span className="ml-account-handle" aria-hidden="true" />}
        {visiblePhase === 'join' && (
          <AuthScreen restaurantName={restaurantName} restaurantLogoUrl={restaurantLogoUrl} header={renderedAuthHeader} welcomeBonus={welcomeBonus} busy={busy} error={joinError} offline={offline} oauthProviders={oauthProviders} emailOtpEnabled={emailOtpEnabled || Boolean(previewState)} phoneOtpEnabled={phoneOtpEnabled || Boolean(previewState)} challengeRequired={challengeRequired} onPhone={handlePhone} onEmail={handleEmail} onOAuth={handleOAuth} onSkip={requestClose} />
        )}
        {visiblePhase === 'otp' && (
          <OTPScreen
            destination={authMethod === 'phone' ? maskedDestination : email}
            method={authMethod}
            restaurantName={restaurantName}
            restaurantLogoUrl={restaurantLogoUrl}
            header={renderedAuthHeader}
            config={otpStateTheme}
            resendAfterSeconds={resendAfterSeconds}
            offline={offline}
            onVerify={handleVerify}
            onResend={() => authMethod === 'phone' ? resendPhoneOtp() : sendEmailOtp(email)}
            onBack={() => { setPhase('join'); setJoinError(''); setChallengeRequired(false) }}
          />
        )}
        {visiblePhase === 'profile' && <ProfileCompletionScreen restaurantName={restaurantName} restaurantLogoUrl={restaurantLogoUrl} header={renderedAuthHeader} onComplete={handleProfileComplete} onSkip={skipProfileCompletion} />}
        {visiblePhase === 'return' && <AuthReturnScreen restaurantName={restaurantName} restaurantLogoUrl={restaurantLogoUrl} header={renderedAuthHeader} status={visibleReturnStatus} config={visibleReturnTheme} onClose={requestClose} />}
        {visiblePhase === 'home' && (
          <AccountCenter
            fallbackName={name}
            onClose={requestClose}
            onNameChange={(updatedName) => { setLocalName(updatedName); onVerified({ name: updatedName }) }}
            actions={accountActions}
            rewardCount={rewardCatalog.length}
            onOpenRewards={() => setSubSheet('rewards')}
            currentRestaurantId={restaurantId}
            currentRestaurantSlug={restaurantSlug}
            currentRestaurantName={restaurantName}
            currentRestaurantLoyalty={currentRestaurantLoyalty}
            previewState={accountPreviewState}
            previewHistoryEnabled={accountPreviewHistoryEnabled}
            previewRestaurant={{ id: restaurantId ?? 'preview-restaurant', slug: restaurantSlug ?? 'preview', name: restaurantName, logoUrl: restaurantLogoUrl }}
            initialTab={initialTarget === 'loyalty' ? 'profile' : 'overview'}
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
