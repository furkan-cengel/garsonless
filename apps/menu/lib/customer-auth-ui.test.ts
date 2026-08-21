import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const memberSheet = readFileSync(
  new URL('../app/[slug]/components/MemberSheet.tsx', import.meta.url),
  'utf8',
)
const callbackRoute = readFileSync(
  new URL('../app/auth/callback/route.ts', import.meta.url),
  'utf8',
)

test('customer auth dialog ships the required keyboard and screen-reader contract', () => {
  assert.match(memberSheet, /role="dialog"/)
  assert.match(memberSheet, /aria-modal="true"/)
  assert.match(memberSheet, /event\.key === 'Escape'/)
  assert.match(memberSheet, /event\.key !== 'Tab'/)
  assert.match(memberSheet, /aria-live="polite"/)
  assert.match(memberSheet, /aria-live="assertive"/)
})

test('customer auth is method-first and keeps marketing consent out of the gate', () => {
  assert.match(memberSheet, /Telefon numarası/)
  assert.match(memberSheet, /inputMode="tel"/)
  assert.match(memberSheet, /autoComplete="tel"/)
  assert.doesNotMatch(memberSheet, /Kampanya, indirim ve duyurular/)
  assert.match(memberSheet, /autoComplete=\{i === 0 \? 'one-time-code' : 'off'\}/)
  assert.match(memberSheet, /onPaste=\{pasteCode\}/)
  assert.match(memberSheet, /if \(numeric\.length > 1\)/)
  assert.match(memberSheet, /inputMode="numeric"/)
})

test('customer auth layout includes mobile safety and reduced-motion rules', () => {
  assert.match(memberSheet, /height:100dvh/)
  assert.match(memberSheet, /env\(safe-area-inset-bottom\)/)
  assert.match(memberSheet, /@media \(prefers-reduced-motion:reduce\)/)
  assert.match(memberSheet, /\.ml-auth-back\{[^}]*width:44px;height:44px/)
  assert.match(memberSheet, /\.ml-auth-primary[^}]*min-height:52px/)
})

test('every auth state uses the compact global Masabu brand region', () => {
  assert.match(memberSheet, /function AuthFrame\(\{ screenTitle, state, layout, restaurantName/)
  assert.match(memberSheet, /header: AuthHeaderTheme/)
  assert.match(memberSheet, /<header className="ml-auth-hero" aria-label="Masabu giriş alanı">/)
  assert.match(memberSheet, /src=\{MASABU_LOGO_DATA_URI\} alt="Masabu"/)
  assert.match(memberSheet, /restaurantName\}&apos;da devam ediyorsun/)
  assert.match(memberSheet, /state="otp" layout=\{config\.layout\}/)
  assert.match(memberSheet, /<AuthFrame screenTitle=\{config\.title\} state=\{status\} layout=\{config\.layout\}/)
})

test('OTP and return states use safe editable copy, bounded layout and closed icon dictionaries', () => {
  assert.match(memberSheet, /resolveAuthOtpState\(authTheme\)/)
  assert.match(memberSheet, /resolveAuthSuccessState\(authTheme\)/)
  assert.match(memberSheet, /resolveAuthErrorState\(authTheme\)/)
  assert.match(memberSheet, /className="ml-auth-otp-email">\{destination\}/)
  assert.match(memberSheet, /\{config\.resendLabel\} · \{secs\}s/)
  assert.match(memberSheet, /config\.primaryActionLabel/)
  assert.match(memberSheet, /const Icon = AppIcons\[icon\]/)
  assert.match(memberSheet, /role=\{status === 'error' \? 'alert' : 'status'\}/)
  assert.match(memberSheet, /aria-live=\{status === 'error' \? 'assertive' : 'polite'\}/)
  assert.match(memberSheet, /--ml-auth-state-padding-x/)
  assert.match(memberSheet, /--ml-auth-state-max-width/)
  assert.match(memberSheet, /--ml-auth-status-icon-size/)
  assert.match(memberSheet, /--ml-auth-status-icon-color/)
  assert.match(memberSheet, /--ml-auth-status-icon-background/)
  assert.match(memberSheet, /config\.iconColor/)
  assert.match(memberSheet, /config\.iconBackground/)
  assert.match(memberSheet, /data-auth-state="success"[^}]*\.ml-auth-state-content[^}]*justify-content:center/)
  assert.match(memberSheet, /\.ml-auth-status\{[^}]*flex:0 0 auto[^}]*justify-content:flex-start/)
})

test('auth form colors use semantic layers while provider marks stay legible', () => {
  assert.match(memberSheet, /--ml-auth-field-surface/)
  assert.match(memberSheet, /--ml-auth-field-border/)
  assert.match(memberSheet, /resolveAuthSurfacePalette\(theme\)/)
  assert.match(memberSheet, /\.ml-auth-provider\{[^}]*background:#fff;color:#111113/)
  assert.match(memberSheet, /\.ml-auth-phone:focus-within/)
})

test('OAuth return URL exposes only a closed, non-PII result marker', () => {
  assert.match(callbackRoute, /'complete' \| 'failed'/)
  assert.match(callbackRoute, /searchParams\.set\('customerAuth', result\)/)
  assert.doesNotMatch(callbackRoute, /searchParams\.set\('(email|name|consent|error)'/)
})
