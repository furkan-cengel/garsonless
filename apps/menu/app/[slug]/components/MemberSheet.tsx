'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { MemberBalances, LoyaltyActivity } from '@garsonless/db/types'
import { ML_STAMP_POP_KEYFRAME, useTheme } from '@garsonless/ui/menu'
import { AppIcons } from '@garsonless/ui/icons'
import {
  resolveAuthErrorState,
  resolveAuthOtpState,
  resolveAuthSuccessState,
  resolveAuthSurfacePalette,
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
import type { CustomerFavoriteView, CustomerReorderPreviewView } from '../../../lib/customer-account-contract'
import type { CustomerAuthSurface } from '../../../lib/customer-auth-intent'
import { broadcastCustomerSessionEvent } from '../../../lib/customer-auth-client'
import { storePendingCustomerAuthContext } from '../../../lib/menu-continuity-client'
import AccountCenter from './AccountCenter'

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
  /** Welcome bonus points — drives the "& X puan kazan" join suffix. */
  welcomeBonus?: number
  /** Resolved reward catalog (name + cost) for the teaser/sheet. Empty hides it. */
  rewardCatalog?: CatalogChoice[]
  /** Claim a catalog reward (15c): parent adds the item to cart + sets the intent. */
  onRedeemCatalog?: (itemId: string) => void
  /** Re-fetch balances (e.g. after a consent toggle changes consentGiven). */
  onRefresh?: () => void | Promise<void>
  /** Logs the member out (parent clears cookie + state, then closes). */
  onLogout?: (scope?: 'device' | 'all') => void | Promise<void>
  onAuthContextComplete?: (surface: CustomerAuthSurface) => void
  onOpenFavorite?: (favorite: CustomerFavoriteView) => void
  onApplyReorder?: (preview: CustomerReorderPreviewView) => void
  /** Editor-only fixture state. It renders the production auth UI without issuing auth requests. */
  previewState?: AuthPreviewState
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
${ML_STAMP_POP_KEYFRAME}
@keyframes ml-shimmer {from{background-position:-160% 0}to{background-position:260% 0}}
@keyframes ml-count-up {from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes ml-sheet-up {from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes ml-ring-expand {0%{transform:scale(.8);opacity:.5}100%{transform:scale(1.6);opacity:0}}
@keyframes ml-confetti-drop {0%{transform:translateY(-10px) rotate(0);opacity:0}15%{opacity:1}100%{transform:translateY(60px) rotate(240deg);opacity:0}}
@keyframes ml-spin {to{transform:rotate(360deg)}}
.ml-auth-dialog{width:100%;height:100dvh;max-width:440px;background:var(--ml-auth-bg);color:var(--ml-auth-text);font-family:var(--ml-auth-body);display:flex;flex-direction:column;overflow:hidden;position:relative}
.ml-auth-hero{height:var(--ml-auth-header-height);min-height:var(--ml-auth-header-height);position:relative;isolation:isolate;overflow:hidden;background:var(--ml-auth-header-bg)}
.ml-auth-hero-fallback{position:absolute;inset:0;z-index:0;background:linear-gradient(157deg,var(--ml-auth-accent) 0%,var(--ml-auth-accent-strong) 55%,#12271c 100%)}
.ml-auth-hero-media{position:absolute;inset:0;z-index:1;width:100%;height:100%;display:block;object-fit:var(--ml-auth-image-fit);object-position:var(--ml-auth-image-position);background:var(--ml-auth-header-bg)}
.ml-auth-hero-overlay{position:absolute;inset:0;z-index:2;width:100%;height:100%;display:block;pointer-events:none;object-fit:var(--ml-auth-image-fit);object-position:var(--ml-auth-image-position);filter:var(--ml-auth-photo-overlay-filter);opacity:var(--ml-auth-photo-overlay-opacity)}
.ml-auth-header-content{position:absolute;inset:64px 24px 24px;z-index:3;display:flex;min-width:0;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;color:var(--ml-auth-header-text)}
.ml-auth-header-content[data-align="left"]{align-items:flex-start;text-align:left}
.ml-auth-header-logo{display:block;width:auto;max-width:min(180px,72%);height:auto;max-height:74px;object-fit:contain;filter:drop-shadow(0 5px 18px rgba(0,0,0,.24))}
.ml-auth-header-title{margin:0;max-width:340px;font-family:var(--p-display);font-size:29px;line-height:1.05;font-weight:700;letter-spacing:-.025em;text-wrap:balance;text-shadow:0 4px 22px rgba(0,0,0,.38)}
.ml-auth-header-slogan{margin:0;max-width:330px;color:var(--ml-auth-header-muted);font-size:12.5px;line-height:1.45;font-weight:650;text-wrap:balance;text-shadow:0 3px 14px rgba(0,0,0,.32)}
.ml-auth-back{position:absolute;top:max(16px,env(safe-area-inset-top));left:18px;z-index:4;width:44px;height:44px;border-radius:50%;border:1px solid var(--ml-auth-header-control-border);background:var(--ml-auth-header-control-bg);color:var(--ml-auth-header-text);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(7px);cursor:pointer}
.ml-auth-panel{position:relative;z-index:3;flex:1;min-height:0;margin-top:-1px;padding:var(--ml-auth-state-padding-y) var(--ml-auth-state-padding-x) calc(var(--ml-auth-state-padding-y) + env(safe-area-inset-bottom));background:var(--ml-auth-surface);color:var(--ml-auth-text);border-top:1px solid var(--ml-auth-field-border);border-radius:30px 30px 0 0;box-shadow:0 -22px 50px -24px rgba(0,0,0,.72);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
.ml-auth-state-content{width:100%;max-width:var(--ml-auth-state-max-width);min-height:100%;margin-inline:auto;display:flex;flex-direction:column;gap:var(--ml-auth-state-gap);text-align:left;box-sizing:border-box}
.ml-auth-state-content[data-align="center"]{text-align:center}
.ml-auth-panel[data-auth-state="success"] .ml-auth-state-content,.ml-auth-panel[data-auth-state="error"] .ml-auth-state-content{justify-content:center}
.ml-auth-screen-title{margin:0;color:var(--ml-auth-text);font-family:var(--p-display);font-size:27px;line-height:1.08;font-weight:700;letter-spacing:-.025em;text-wrap:balance}
.ml-auth-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.ml-auth-stack{display:flex;flex:1;flex-direction:column;gap:var(--ml-auth-state-gap);animation:ml-fade-slide .34s cubic-bezier(.2,.7,.2,1) both}
.ml-auth-label{display:flex;flex-direction:column;gap:7px;color:var(--ml-auth-muted);font-size:12px;font-weight:700}
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
.ml-auth-error{color:#ffc0b7;background:rgba(255,104,82,.1);border:1px solid rgba(255,125,106,.18)}
.ml-auth-offline{color:#ffe2a8;background:rgba(213,148,34,.12);border:1px solid rgba(255,203,107,.18)}
.ml-auth-meta{margin:0;color:var(--ml-auth-muted);font-size:14.5px;line-height:1.55}
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
.ml-auth-dialog button:focus-visible{outline:2px solid var(--ml-auth-accent);outline-offset:3px}
.ml-auth-panel{border-radius:calc(var(--ml-auth-radius) * 2.2) calc(var(--ml-auth-radius) * 2.2) 0 0}
.ml-auth-input,.ml-auth-otp input{color:var(--ml-auth-text);border-radius:calc(var(--ml-auth-radius) * 1.05)}
.ml-auth-primary,.ml-auth-provider,.ml-auth-guest{border-radius:var(--ml-auth-radius)}
.ml-auth-dialog[data-auth-preset="immersive"] .ml-auth-panel{margin-top:-28px}
.ml-spin{animation:ml-spin .7s linear infinite}
.ml-account-dialog{width:100%;height:100dvh;max-height:100dvh;background:var(--ml-bg);color:var(--ml-text);font-family:var(--p-body);display:flex;flex-direction:column;overflow:hidden}
html[data-customer-auth-preview="true"] nextjs-portal{display:none!important}
@media (min-width:640px){.ml-auth-overlay{align-items:center!important;padding:20px}.ml-auth-dialog{height:min(844px,calc(100dvh - 40px));border-radius:30px;box-shadow:0 34px 90px rgba(0,0,0,.38)}.ml-account-dialog{max-width:720px;height:min(850px,calc(100dvh - 40px));max-height:calc(100dvh - 40px);border-radius:26px;box-shadow:0 34px 90px rgba(0,0,0,.38)}.ml-auth-panel{border-radius:30px 30px 0 0}}
@media (prefers-reduced-motion:reduce){.ml-auth-dialog *,.ml-auth-dialog:before,.ml-auth-dialog:after,.ml-account-dialog *{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
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

function AuthFrame({ screenTitle, state, layout, header, restaurantName, restaurantLogoUrl, backLabel, onBack, children }: {
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
  const headerLogoUrl = header.logoMode === 'custom'
    ? header.logoUrl ?? null
    : header.logoMode === 'restaurant' ? restaurantLogoUrl : null
  const headerTitle = header.title?.trim() ?? ''
  const headerSlogan = header.slogan?.trim() ?? ''
  const headerBackgroundImageUrl = header.backgroundImageUrl
  const hasHeaderContent = Boolean(headerLogoUrl || headerTitle || headerSlogan)
  const visibleScreenTitle = screenTitle.trim()
  return (
    <>
      <header className="ml-auth-hero" aria-label="Giriş Header" data-has-media={headerBackgroundImageUrl ? 'true' : 'false'}>
        {!headerBackgroundImageUrl && <div className="ml-auth-hero-fallback" aria-hidden="true" />}
        {headerBackgroundImageUrl && <>
          {/* Auth header media is decorative and may use arbitrary tenant-owned aspect ratios. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ml-auth-hero-media" src={headerBackgroundImageUrl} alt="" aria-hidden="true" />
          {/* A filtered image clone keeps the neutral overlay on photo pixels only, including contain mode. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ml-auth-hero-overlay" src={headerBackgroundImageUrl} alt="" aria-hidden="true" />
        </>}
        <button type="button" className="ml-auth-back" onClick={onBack} aria-label={backLabel}>
          <AppIcons.chevLeft size={22} />
        </button>
        {hasHeaderContent && <div className="ml-auth-header-content" data-align={header.align}>
          {/* Auth logo URLs are tenant-owned uploads with arbitrary aspect ratios; the native image keeps that ratio intact. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {headerLogoUrl && <img className="ml-auth-header-logo" src={headerLogoUrl} alt={`${restaurantName} logosu`} />}
          {headerTitle && <p className="ml-auth-header-title">{headerTitle}</p>}
          {headerSlogan && <p className="ml-auth-header-slogan">{headerSlogan}</p>}
        </div>}
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

function AuthScreen({ restaurantName, restaurantLogoUrl, header, title, subtitle, welcomeBonus, busy, error, offline, oauthProviders, onEmail, onOAuth, onSkip }: {
  restaurantName: string; restaurantLogoUrl: string | null; header: AuthHeaderTheme; welcomeBonus: number; busy: boolean; error: string; offline: boolean
  title?: string
  subtitle?: string
  oauthProviders: readonly CustomerAuthOAuthProvider[]
  onEmail: (name: string, email: string, consent: boolean, marketingConsent: boolean) => void
  onOAuth: (provider: CustomerAuthOAuthProvider, name: string, consent: boolean, marketingConsent: boolean) => void
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
    <AuthFrame screenTitle={title?.trim() || ''} state="join" layout={JOIN_AUTH_LAYOUT} header={header} restaurantName={restaurantName} restaurantLogoUrl={restaurantLogoUrl} backLabel="Menüye dön" onBack={onSkip}>
    <div className="ml-auth-stack" aria-busy={busy}>
      {offline && <div className="ml-auth-offline" role="status"><AppIcons.warn size={17} />Çevrimdışısın. Giriş için bağlantını kontrol et.</div>}
      {subtitle?.trim() && <p className="ml-auth-meta">{subtitle}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Ad Soyad" value={name} onChange={setName} placeholder="Adın Soyadın" />
        <Field label="E-posta" value={email} onChange={setEmail} placeholder="ornek@eposta.com" type="email" />
        <label className="ml-auth-check">
          <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
          <span>
            <a href="https://masabu.co/legal#kvkk" target="_blank" rel="noreferrer">KVKK aydınlatma metnini</a> okudum; hesabımın oluşturulması için gerekli verilerin işlenmesini onaylıyorum.
          </span>
        </label>
        <label className="ml-auth-check">
          <input type="checkbox" checked={marketingAgree} onChange={(event) => setMarketingAgree(event.target.checked)} />
          <span>Kampanya, indirim ve duyurular için e-posta almak istiyorum. (İsteğe bağlı)</span>
        </label>
        <div aria-live="polite" aria-atomic="true">
          {error && <div className="ml-auth-error" role="alert"><AppIcons.warn size={17} />{error}</div>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button" className="ml-auth-primary" onClick={() => valid && !busy && !offline && onEmail(name, email, agree, marketingAgree)} disabled={!valid || busy || offline}
        >
          {busy ? <><Spinner /> Gönderiliyor…</> : `E-posta ile devam et${welcomeBonus > 0 ? ` & ${welcomeBonus} puan kazan` : ''}`}
        </button>
        {oauthProviders.length > 0 && <div className="ml-auth-divider">veya</div>}
        {oauthProviders.map((provider) => (
          <button
            key={provider}
            type="button"
            className="ml-auth-provider"
            onClick={() => socialValid && !busy && !offline && onOAuth(provider, name, agree, marketingAgree)}
            disabled={!socialValid || busy || offline}
          >
            <ProviderIcon provider={provider} /> {PROVIDER_LABELS[provider]} ile devam et
          </button>
        ))}
        <button type="button" className="ml-auth-guest" onClick={onSkip}>Misafir olarak devam et <AppIcons.arrow size={17} /></button>
      </div>
    </div>
    </AuthFrame>
  )
}

// ── Screen 1.5: OTP ─────────────────────────────────────────────────────────
type AuthAttemptResult = { ok: boolean; error?: string; resendAfterSeconds?: number }

function OTPScreen({ email, restaurantName, restaurantLogoUrl, header, config, resendAfterSeconds, offline, onVerify, onResend, onBack }: {
  email: string
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
    const v = raw.replace(/\D/g, '').slice(-1)
    setError('')
    if (v.length > 1) {
      const arr = v.slice(0, LEN).split('')
      const next = Array(LEN).fill('').map((_, k) => arr[k] || '')
      setDigits(next)
      refs.current[Math.min(arr.length, LEN) - 1]?.focus()
      return
    }
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
    <AuthFrame screenTitle={config.title} state="otp" layout={config.layout} header={header} restaurantName={restaurantName} restaurantLogoUrl={restaurantLogoUrl} backLabel="E-posta adımına dön" onBack={onBack}>
    <div className="ml-auth-stack" aria-busy={verifying}>
      {offline && <div className="ml-auth-offline" role="status"><AppIcons.warn size={17} />Çevrimdışısın. Kodu doğrulamak için bağlantını kontrol et.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ml-auth-state-gap)' }}>
        <p className="ml-auth-otp-email">{email}</p>
        {config.description && <p className="ml-auth-meta">{config.description}</p>}
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
function Stat({ icon, label, value, accent }: { icon: string; label: string; value: number; accent: string }) {
  return (
    <div style={{ background: 'var(--ml-surface)', borderRadius: 16, border: '1px solid var(--ml-line)', padding: '14px 16px' }}>
      <div style={{ fontSize: 12.5, color: 'var(--ml-text2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>{icon} {label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent, marginTop: 4, animation: 'ml-count-up .4s ease both' }}>{fmt(value)}</div>
    </div>
  )
}

// Retained during the account-center rollout so restaurant reward behavior can
// be re-exposed without changing loyalty economics in this slice.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MemberHomeLegacy({ balances, name, restaurantName, rewardCatalog, restaurantId, onOpenRewards, onRefresh, onLogout, onClose }: {
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
  authenticated = false, restaurantId, restaurantSlug, restaurantName = 'Sadakat',
  tableToken = null, guestSessionId, deviceId, authSurface = 'menu', authReturn = null,
  oauthProviders = [],
  welcomeBonus = 0, rewardCatalog = [], onRedeemCatalog, onRefresh: _onRefresh, onLogout,
  onAuthContextComplete, onOpenFavorite, onApplyReorder, previewState,
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
  const [phase, setPhase] = useState<'join' | 'otp' | 'return' | 'home'>(() => {
    if (previewState === 'otp') return 'otp'
    if (previewState === 'success' || previewState === 'error') return 'return'
    return authenticated ? 'home' : 'join'
  })
  const [email, setEmail] = useState('')
  const [pendingName, setPendingName] = useState('')
  const [pendingConsent, setPendingConsent] = useState(false)
  const [pendingMarketingConsent, setPendingMarketingConsent] = useState(false)
  const [pendingIntent, setPendingIntent] = useState('')
  const [localName, setLocalName] = useState<string | null>(initialName)
  const [busy, setBusy] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [resendAfterSeconds, setResendAfterSeconds] = useState(60)
  const [offline, setOffline] = useState(() => previewState ? false : typeof navigator !== 'undefined' && !navigator.onLine)
  const [subSheet, setSubSheet] = useState<null | 'rewards'>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (previewState) {
      setJoinError('')
      if (previewState === 'otp') {
        setEmail('ornek@eposta.com')
        setResendAfterSeconds(42)
        setPhase('otp')
      } else if (previewState === 'success' || previewState === 'error') {
        setPhase('return')
      } else {
        setEmail('')
        setPhase('join')
      }
      return
    }
    if (authReturn) setPhase('return')
  }, [authReturn, previewState])

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

  function handleDialogKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
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

  function authContext(name: string, consent: boolean, marketingConsent: boolean) {
    if (restaurantId && restaurantSlug) {
      storePendingCustomerAuthContext({
        restaurantId,
        restaurantSlug,
        tableToken,
        surface: authSurface,
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
      name: name.trim(),
      consent,
      marketingConsent,
    }
  }

  function authErrorMessage(result: ApiResult<unknown>): string {
    if (result.ok) return ''
    switch (result.error.code) {
      case 'RATE_LIMITED': return 'Çok fazla deneme yapıldı. Lütfen biraz bekleyin.'
      case 'PROVIDER_DISABLED': return 'Bu giriş yöntemi şu anda kullanılamıyor.'
      case 'STAFF_ACCOUNT_REJECTED': return 'Personel hesabıyla müşteri girişi yapılamaz.'
      case 'IDENTITY_CONFLICT': return 'Bu kimlik başka bir müşteri hesabına bağlı.'
      case 'CONTEXT_EXPIRED': return 'Giriş isteğinin süresi doldu. Lütfen yeniden başlayın.'
      case 'OTP_INVALID': return 'Kod hatalı. 6 haneyi kontrol edip tekrar dene.'
      case 'OTP_EXPIRED': return 'Kodun süresi doldu. Yeni bir kod iste.'
      case 'SESSION_EXPIRED': return 'Oturumun süresi doldu. Lütfen yeniden giriş yap.'
      default: return 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'
    }
  }

  async function sendOtp(
    forEmail: string,
    name = pendingName,
    consent = pendingConsent,
    marketingConsent = pendingMarketingConsent,
  ): Promise<AuthAttemptResult> {
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
          ...authContext(name, consent, marketingConsent),
        }),
      })
      const result = await response.json() as ApiResult<{ intent: string; resendAfterSeconds: number }>
      if (!response.ok || !result.ok) return { ok: false, error: authErrorMessage(result) }
      setPendingIntent(result.data.intent)
      setResendAfterSeconds(result.data.resendAfterSeconds)
      return { ok: true, resendAfterSeconds: result.data.resendAfterSeconds }
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
    const r = await sendOtp(normalizedEmail, name, consent, marketingConsent)
    setBusy(false)
    if (!r.ok) { setJoinError(r.error ?? 'Bir hata oluştu.'); return }
    setPhase('otp')
  }

  async function handleOAuth(provider: CustomerAuthOAuthProvider, name: string, consent: boolean, marketingConsent: boolean) {
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
        body: JSON.stringify({ provider, ...authContext(name, consent, marketingConsent) }),
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
      const response = await fetch('/api/customer-auth/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: pendingIntent, code }),
      })
      const result = await response.json() as ApiResult<CustomerSessionView>
      if (!response.ok || !result.ok) return { ok: false, error: authErrorMessage(result) }
      if (!result.data.authenticated || !result.data.profile) return { ok: false, error: 'Kod doğrulanamadı. Lütfen tekrar dene.' }
      setLocalName(result.data.profile.name)
      onVerified({ name: result.data.profile.name })
      broadcastCustomerSessionEvent('signed-in')
      setPhase('home')
      onAuthContextComplete?.(authSurface)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Bağlantı hatası. Tekrar deneyin.' }
    }
  }

  const name = localName ?? initialName
  const visiblePhase = previewState === 'otp'
    ? 'otp'
    : previewState === 'success' || previewState === 'error'
      ? 'return'
      : previewState === 'join'
        ? 'join'
      : phase
  const visibleReturnStatus = previewState === 'error' ? 'error' : authReturn ?? 'success'
  const visibleReturnTheme = visibleReturnStatus === 'error' ? errorStateTheme : successStateTheme

  return (
    <div className="ml-auth-overlay" data-account={visiblePhase === 'home'} data-auth-preview={previewState ? 'true' : undefined} onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,16,12,.62)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', ...rootVars }}>
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
        {visiblePhase === 'join' && (
          <AuthScreen restaurantName={restaurantName} restaurantLogoUrl={restaurantLogoUrl} header={renderedAuthHeader} title={authTheme?.title ?? 'Masabu hesabınla devam et'} subtitle={authTheme?.subtitle ?? 'Siparişlerini, favorilerini ve sadakat avantajlarını tek yerde tut.'} welcomeBonus={welcomeBonus} busy={busy} error={joinError} offline={offline} oauthProviders={oauthProviders} onEmail={handleEmail} onOAuth={handleOAuth} onSkip={onClose} />
        )}
        {visiblePhase === 'otp' && (
          <OTPScreen
            email={email}
            restaurantName={restaurantName}
            restaurantLogoUrl={restaurantLogoUrl}
            header={renderedAuthHeader}
            config={otpStateTheme}
            resendAfterSeconds={resendAfterSeconds}
            offline={offline}
            onVerify={handleVerify}
            onResend={() => sendOtp(email)}
            onBack={() => { setPhase('join'); setJoinError('') }}
          />
        )}
        {visiblePhase === 'return' && <AuthReturnScreen restaurantName={restaurantName} restaurantLogoUrl={restaurantLogoUrl} header={renderedAuthHeader} status={visibleReturnStatus} config={visibleReturnTheme} onClose={onClose} />}
        {visiblePhase === 'home' && (
          <AccountCenter
            fallbackName={name}
            onClose={onClose}
            onNameChange={(updatedName) => { setLocalName(updatedName); onVerified({ name: updatedName }) }}
            {...(onLogout ? { onLogout } : {})}
            rewardCount={rewardCatalog.length}
            onOpenRewards={() => setSubSheet('rewards')}
            currentRestaurantSlug={restaurantSlug}
            {...(onOpenFavorite ? { onOpenFavorite } : {})}
            {...(onApplyReorder ? { onApplyReorder } : {})}
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
