import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const menuPageClient = readFileSync(new URL('../app/[slug]/MenuPageClient.tsx', import.meta.url), 'utf8')

test('quick add keeps configurable products in the product-detail flow', () => {
  assert.match(menuPageClient, /if \(isProductConfigurable\(effectiveItem\)\) \{[\s\S]{0,320}setSelectedItem\(effectiveItem\)/)
})

test('quick add sends simple products directly to cart', () => {
  assert.match(menuPageClient, /else \{[\s\S]{0,220}addItem\(effectiveItem,[\s\S]{0,180}setIsCartOpen\(true\)/)
})

test('automatic campaign reconciliation excludes recommendation lines', () => {
  assert.match(menuPageClient, /if \(!participatesInAutomaticProductCampaign\(cartItem\)\) continue/)
})
