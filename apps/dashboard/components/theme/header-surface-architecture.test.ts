import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const headerSource = readFileSync('../../packages/ui/src/menu/Header.tsx', 'utf8')
const drawerSource = readFileSync('../../packages/ui/src/menu/NavDrawer.tsx', 'utf8')
const footerSource = readFileSync('../../packages/ui/src/menu/MenuFooter.tsx', 'utf8')
const menuMorphIconSource = readFileSync('../../packages/ui/src/menu/MenuMorphIcon.tsx', 'utf8')
const menuClientSource = readFileSync('../menu/app/[slug]/MenuPageClient.tsx', 'utf8')
const settingsSource = readFileSync('../../packages/ui/src/themes/default/settings.ts', 'utf8')
const navigationSource = readFileSync('components/theme/theme-editor-navigation-catalog.tsx', 'utf8')

test('header has presets and a separate table context bar without an overflow menu', () => {
  assert.match(headerSource, /data-header-context-bar/)
  assert.match(headerSource, /headerPreset/)
  assert.match(headerSource, /minWidth: 44/)
  assert.doesNotMatch(headerSource, /<details|data-header-more-popover/)
})

test('header and drawer use the shared modern Lucide action icons', () => {
  assert.match(headerSource, /<MenuMorphIcon open=\{menuOpen\}/)
  assert.match(headerSource, /<I\.userPlus/)
  assert.match(headerSource, /<I\.userCircle/)
  assert.doesNotMatch(headerSource, /function HamburgerIcon|function MemberIcon/)
  assert.match(drawerSource, /aria-label="Menüyü kapat"[\s\S]*?<MenuMorphIcon open=\{open\}/)
  assert.match(drawerSource, /<I\.userPlus/)
  assert.match(drawerSource, /<I\.userCircle/)
})

test('restaurant branding uses the normal interface font across customer surfaces', () => {
  assert.match(headerSource, /fontFamily: 'var\(--p-body\)'/)
  assert.match(drawerSource, /\[data-drawer-brand\] h2\{[^}]*var\(--p-body\)/)
  assert.match(footerSource, /\[data-menu-footer-brand\] strong\{[^}]*var\(--p-body\)/)
})

test('the drawer toggle morphs in both directions instead of rendering a second close icon', () => {
  assert.match(menuMorphIconSource, /transformOrigin: 'right center'/)
  assert.match(menuMorphIconSource, /open \? 'scaleX\(0\)' : 'scaleX\(1\)'/)
  assert.match(menuMorphIconSource, /translateY\(5px\) rotate\(45deg\)/)
  assert.match(menuMorphIconSource, /translateY\(-5px\) rotate\(-45deg\)/)
  assert.match(headerSource, /onClick=\{\(\) => setMenuOpen\(\(current\) => !current\)\}/)
  assert.match(drawerSource, /drawerPosition === 'full'/)
  assert.doesNotMatch(drawerSource, /aria-label="Menüyü kapat"[^>]*><I\.close/)
})

test('all customer surfaces share the canonical placement projection', () => {
  assert.match(headerSource, /resolveMenuActionPlacements/)
  assert.match(drawerSource, /resolveMenuActionPlacements/)
  assert.match(menuClientSource, /resolveMenuActionPlacements/)
})

test('header and drawer service controls open the shared request sheet', () => {
  assert.match(headerSource, /onOpenServiceRequests/)
  assert.match(drawerSource, /onOpenServiceRequests/)
  assert.match(menuClientSource, /isServiceRequestsOpen/)
  assert.match(menuClientSource, /trigger=\{placements\.service === 'floating'/)
})

test('drawer focus is claimed only when opening, not after editor field updates', () => {
  assert.match(drawerSource, /const onCloseRef = useRef\(onClose\)/)
  assert.match(drawerSource, /if \(event\.key === 'Escape'\) onCloseRef\.current\(\)/)
  assert.match(drawerSource, /\}, \[open\]\)/)
  assert.doesNotMatch(drawerSource, /\}, \[onClose, open\]\)/)
})

test('theme editor exposes the header hierarchy and canonical action placements', () => {
  for (const group of ['header-layout', 'header-context', 'header-actions', 'drawer']) {
    assert.match(settingsSource, new RegExp(`id: '${group}'`))
  }
  for (const field of ['memberPlacement', 'billPlacement', 'cartPlacement', 'servicePlacement']) {
    assert.match(settingsSource, new RegExp(`id: '${field}'`))
  }
  assert.match(navigationSource, /parentLabel: 'Header'/)
})
