import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const shell = readFileSync(new URL('./RestaurantShell.tsx', import.meta.url), 'utf8')

test('mobile rail uses an opaque isolated surface without Android mask compositing', () => {
  assert.match(shell, /background: var\(--surface\) !important;/)
  assert.match(shell, /isolation: isolate;/)
  assert.match(shell, /contain: paint;/)
  assert.doesNotMatch(shell, /mask-image: linear-gradient/)
})

test('mobile rail aligns every navigation, utility and profile control to one row', () => {
  assert.match(shell, /\.restaurant-rail \.rail-item \{[\s\S]*?height: 44px;[\s\S]*?align-items: center;/)
  assert.match(shell, /\.restaurant-rail \.rail-link,[\s\S]*?width: 100% !important;[\s\S]*?max-width: 44px;[\s\S]*?height: 44px !important;/)
  assert.match(shell, /\.rail-secondary \.rail-item \{[\s\S]*?margin-top: 0 !important;/)
  assert.match(shell, /\.rail-item svg \{[\s\S]*?display: block;/)
})

test('mobile rail distributes primary, help and profile cells with one horizontal rhythm', () => {
  const rail = readFileSync(new URL('./IconRail.tsx', import.meta.url), 'utf8')
  assert.match(rail, /--mobile-rail-primary-count': navItems\.length/)
  assert.match(shell, /flex: var\(--mobile-rail-primary-count\) 1 0%;/)
  assert.match(shell, /grid-template-columns: repeat\(var\(--mobile-rail-primary-count\), minmax\(0, 1fr\)\);/)
  assert.match(shell, /\.rail-secondary \{[\s\S]*?flex: 2 1 0%;[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/)
  assert.match(shell, /\.rail-profile \{[\s\S]*?width: 100% !important;[\s\S]*?max-width: 44px;/)
})
