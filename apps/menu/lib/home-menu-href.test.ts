import assert from 'node:assert/strict'
import test from 'node:test'

import { buildHomeMenuHref } from './home-menu-href.ts'

test('builds the public menu route without preview state', () => {
  assert.equal(buildHomeMenuHref('maf-lounge'), '/maf-lounge/menu')
})

test('keeps table QR navigation in the table scope while explicitly opening the menu', () => {
  assert.equal(
    buildHomeMenuHref('maf lounge', { tableToken: 'table/token', openCart: true }),
    '/maf%20lounge/table/table%2Ftoken?surface=menu&open=cart',
  )
  assert.equal(
    buildHomeMenuHref('maf-lounge', { tableToken: 'table-token', categoryId: 'kahve & tatlı' }),
    '/maf-lounge/table/table-token?surface=menu#category-kahve%20%26%20tatl%C4%B1',
  )
})

test('keeps preview navigation inside the dashboard-safe menu route', () => {
  assert.equal(buildHomeMenuHref('maf-lounge', { preview: true }), '/maf-lounge/menu?preview=1')
  assert.equal(
    buildHomeMenuHref('maf-lounge', { preview: true, previewTemplateId: 'classic / draft', previewAccessToken: 'signed.token' }),
    '/maf-lounge/menu?preview=1&template=classic+%2F+draft&previewAccess=signed.token',
  )
  assert.equal(buildHomeMenuHref('maf-lounge', { previewTemplateId: 'classic' }), '/maf-lounge/menu')
  assert.equal(buildHomeMenuHref('maf-lounge', { previewAccessToken: 'signed.token' }), '/maf-lounge/menu')
})

test('combines preview with cart and product targets without malformed queries', () => {
  assert.equal(buildHomeMenuHref('maf-lounge', { preview: true, openCart: true }), '/maf-lounge/menu?preview=1&open=cart')
  assert.equal(buildHomeMenuHref('maf-lounge', { preview: true, itemId: 'item / 1' }), '/maf-lounge/menu?preview=1&item=item+%2F+1')
  assert.equal(
    buildHomeMenuHref('maf-lounge', {
      preview: true,
      previewTemplateId: 'classic',
      openCart: true,
      comboSectionId: 'home combo / 1',
      comboIndex: 2,
      comboItemIds: ['coffee / 1', 'corn'],
      comboTotal: 390,
      comboTitle: 'Kahve Molası',
    }),
    '/maf-lounge/menu?preview=1&template=classic&open=cart&comboSection=home+combo+%2F+1&comboIndex=2&comboItem=coffee+%2F+1&comboItem=corn&comboTotal=390&comboTitle=Kahve+Molas%C4%B1',
  )
})

test('writes combo parameters only when the complete target is valid', () => {
  assert.equal(buildHomeMenuHref('maf-lounge', { comboSectionId: 'combo-1' }), '/maf-lounge/menu')
  assert.equal(buildHomeMenuHref('maf-lounge', { comboSectionId: 'combo-1', comboIndex: 0 }), '/maf-lounge/menu')
  assert.equal(buildHomeMenuHref('maf-lounge', { comboSectionId: 'combo-1', comboIndex: 4 }), '/maf-lounge/menu')
})

test('places category anchors after the preview query', () => {
  assert.equal(buildHomeMenuHref('maf-lounge', { preview: true, categoryId: 'kahve & tatlı' }), '/maf-lounge/menu?preview=1#category-kahve%20%26%20tatl%C4%B1')
})

test('carries only promotion identity with a selected Home product', () => {
  assert.equal(
    buildHomeMenuHref('maf-lounge', {
      itemId: 'cake-1',
      promotionSectionId: 'slider-home',
      promotionKind: 'promo-slider',
    }),
    '/maf-lounge/menu?item=cake-1&promotionSection=slider-home&promotionKind=promo-slider',
  )
  assert.equal(
    buildHomeMenuHref('maf-lounge', { promotionSectionId: 'slider-home', promotionKind: 'promo-slider' }),
    '/maf-lounge/menu',
  )
})
