import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const shell = readFileSync(new URL('./RestaurantShell.tsx', import.meta.url), 'utf8')
const rail = readFileSync(new URL('./IconRail.tsx', import.meta.url), 'utf8')

test('mobile navigation reserves a safe-area-aware 64px shell without horizontal scrolling', () => {
  assert.match(shell, /--mobile-navigation-height: 64px;/)
  assert.match(shell, /height: calc\(100dvh - var\(--mobile-navigation-height\) - var\(--mobile-rail-safe-area\)\);/)
  assert.match(shell, /height: calc\(var\(--mobile-navigation-height\) \+ var\(--mobile-rail-safe-area\)\);/)
  assert.match(shell, /background: var\(--surface\) !important;/)
  assert.match(shell, /isolation: isolate;/)
  assert.match(shell, /contain: paint;/)
  assert.match(shell, /overflow-x: hidden;/)
})

test('mobile navigation exposes four operational destinations plus a labelled more control', () => {
  assert.match(rail, /MOBILE_PRIMARY_IDS = \['home', 'orders', 'tables', 'menu'\]/)
  assert.match(rail, /className="mobile-bottom-navigation"/)
  assert.match(rail, /--mobile-nav-count': primaryItems\.length \+ 1/)
  assert.match(rail, /grid-template-columns:repeat\(var\(--mobile-nav-count\),minmax\(0,1fr\)\)/)
  assert.match(rail, /<span className="mobile-nav-label">\{item\.label\}<\/span>/)
  assert.match(rail, /<span className="mobile-nav-label">Diğer<\/span>/)
  assert.match(rail, /<I\.grid size=\{20\}/)
  assert.doesNotMatch(rail, /--mobile-rail-primary-count/)
})

test('mobile destinations keep readable active, locked and order-count states', () => {
  assert.match(rail, /min-height:56px/)
  assert.match(rail, /mobile-nav-link--active/)
  assert.match(rail, /aria-current=\{active \? 'page' : undefined\}/)
  assert.match(rail, /mobile-nav-lock/)
  assert.match(rail, /mobile-nav-badge/)
  assert.match(rail, /requiredPlanLabel} ile açılır/)
})

test('more navigation uses the installed bottom sheet with grouped, labelled actions', () => {
  assert.match(rail, /from '@\/components\/ui\/sheet'/)
  assert.match(rail, /side="bottom"/)
  assert.match(rail, /<SheetTitle>Diğer bölümler<\/SheetTitle>/)
  assert.match(rail, />Yönetim<\/h3>/)
  assert.match(rail, />Destek ve hesap<\/h3>/)
  assert.match(rail, /<strong>Yardım<\/strong>/)
  assert.match(rail, /<strong>Profil<\/strong>/)
  assert.match(rail, /max-h-\[min\(76dvh,720px\)\]/)
  assert.match(rail, /padding-bottom:env\(safe-area-inset-bottom,0px\)/)
})

test('desktop and mobile presentations share one guarded navigation decision', () => {
  assert.match(rail, /function DesktopNavigation/)
  assert.match(rail, /function MobileBottomNavigation/)
  assert.match(rail, /const handleNavigation =/)
  assert.match(rail, /getNavigationGuard\(\)/)
  assert.match(rail, /setPendingNavigation\(\{ href, message: guardMessage \}\)/)
  assert.equal(rail.match(/<UnsavedChangesDialog/g)?.length, 1)
  assert.match(rail, /\.desktop-rail-primary,\.desktop-rail-secondary \{ display:none!important; \}/)
  assert.match(rail, /\.mobile-bottom-navigation \{ display:none; \}/)
})
