import assert from 'node:assert/strict'
import test from 'node:test'

import { buildHomeMenuHref } from './home-menu-href.ts'

test('builds the public menu route without preview state', () => {
  assert.equal(buildHomeMenuHref('maf-lounge'), '/maf-lounge/menu')
})

test('keeps preview navigation inside the dashboard-safe menu route', () => {
  assert.equal(buildHomeMenuHref('maf-lounge', { preview: true }), '/maf-lounge/menu?preview=1')
})

test('combines preview with cart and product targets without malformed queries', () => {
  assert.equal(buildHomeMenuHref('maf-lounge', { preview: true, openCart: true }), '/maf-lounge/menu?preview=1&open=cart')
  assert.equal(buildHomeMenuHref('maf-lounge', { preview: true, itemId: 'item / 1' }), '/maf-lounge/menu?preview=1&item=item+%2F+1')
})

test('places category anchors after the preview query', () => {
  assert.equal(buildHomeMenuHref('maf-lounge', { preview: true, categoryId: 'kahve & tatlı' }), '/maf-lounge/menu?preview=1#category-kahve%20%26%20tatl%C4%B1')
})
