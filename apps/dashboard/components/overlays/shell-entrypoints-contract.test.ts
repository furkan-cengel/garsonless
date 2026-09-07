import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('help is a lazy, focus-managed dialog containing only real navigation actions', () => {
  const shell = source('../layout/RestaurantShell.tsx')
  const help = source('./HelpModal.tsx')
  assert.match(shell, /dynamic\(\(\) => import\('\.\.\/overlays\/HelpModal'\), \{ ssr: false \}\)/)
  assert.match(help, /role="dialog"/)
  assert.match(help, /aria-modal="true"/)
  assert.match(help, /useModalDialogFocus\(onClose\)/)
  assert.match(help, /prefetch=\{false\}/)
  assert.match(help, /safeSupportUrl/)
  assert.match(help, /rel="noopener noreferrer"/)
  assert.match(help, /referrerPolicy="no-referrer"/)
  assert.doesNotMatch(help, /QUICK_ACTIONS|ARTICLES|Canlı destek/)
})

test('profile exposes menu semantics, roving focus, dynamic account data, and working rows', () => {
  const profile = source('./ProfileMenu.tsx')
  assert.match(profile, /role="menu"/)
  assert.match(profile, /role="menuitem"/)
  assert.match(profile, /ArrowDown.*ArrowUp.*Home.*End/s)
  assert.match(profile, /aria-current=\{active \? 'page'/)
  assert.match(profile, /planLabel/)
  assert.match(profile, /unreadCount/)
  assert.match(profile, /section=profile/)
  assert.match(profile, /section=security/)
  assert.match(profile, /section=languages/)
  assert.match(profile, /onOpenNotifications/)
  assert.doesNotMatch(profile, /badge: '2'|>Pro<|cursor: m\.href/)
})

test('rail buttons publish their expanded popup relationships and mobile rail is consistent', () => {
  const rail = source('../layout/IconRail.tsx')
  const shell = source('../layout/RestaurantShell.tsx')
  assert.match(rail, /aria-expanded=\{overlay === 'profile'\}/)
  assert.match(rail, /aria-haspopup="menu"/)
  assert.match(rail, /popup="dialog"/)
  assert.match(rail, /aria-controls=\{SHELL_OVERLAY_IDS\.profile\}/)
  assert.match(shell, /className="restaurant-shell restaurant-shell--mobile-rail"/)
  assert.match(shell, /useEffect\(\(\) => closeOverlay\(\), \[closeOverlay, pathname\]\)/)
})

test('logout is local, endpoint-scoped, recoverable, and double-submit guarded', () => {
  const auth = source('../../lib/actions/auth.ts')
  const profile = source('./ProfileMenu.tsx')
  const clientLogout = source('../../lib/client-logout.ts')
  assert.match(auth, /signOut\(\{ scope: 'local' \}\)/)
  assert.match(auth, /deleteDashboardPushEndpoint/)
  assert.doesNotMatch(auth, /deleteDashboardPushSubscriptionsForUser/)
  assert.match(profile, /logoutLockRef/)
  assert.match(profile, /disabled=\{logoutPending \|\| storePending\}/)
  assert.match(profile, /role="alert"/)
  assert.match(profile, /getNavigationGuard\(\)/)
  assert.match(profile, /logoutCurrentBrowser\(\)/)
  assert.match(clientLogout, /subscription\?\.unsubscribe\(\)/)
  assert.match(clientLogout, /removeAllChannels\(\)/)
  assert.doesNotMatch(clientLogout, /import.*actions\/auth/)
  assert.match(clientLogout, /fetch\('\/auth\/logout'/)
})
