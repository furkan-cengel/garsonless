import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const context = readFileSync(new URL('./ThemeContext.tsx', import.meta.url), 'utf8')
const card = readFileSync(new URL('./ProductCard.tsx', import.meta.url), 'utf8')
const navigation = readFileSync(new URL('./CategoryNav.tsx', import.meta.url), 'utf8')
const filters = readFileSync(new URL('./DietaryFilterBar.tsx', import.meta.url), 'utf8')
const modal = readFileSync(new URL('./ProductModal.tsx', import.meta.url), 'utf8')
const cart = readFileSync(new URL('./CartDrawer.tsx', import.meta.url), 'utf8')
const footer = readFileSync(new URL('./MenuFooter.tsx', import.meta.url), 'utf8')

test('global font size and line height project reusable menu typography tokens', () => {
  for (const token of ['--p-text-xs', '--p-text-sm', '--p-text-md', '--p-text-lg', '--p-text-xl', '--p-line-body', '--p-line-tight']) {
    assert.match(context, new RegExp(token))
  }
  assert.match(context, /document\.body\.style\.lineHeight/)
})

test('core menu surfaces consume the shared typography scale without changing control sizes', () => {
  assert.match(card, /var\(--p-line-body\)/)
  assert.match(navigation, /var\(--p-line-tight\)/)
  assert.match(filters, /var\(--p-text-sm\)/)
  assert.match(modal, /lineHeight: "var\(--p-line-body\)"/)
  assert.match(cart, /lineHeight: 'var\(--p-line-body\)'/)
  assert.match(footer, /lineHeight: 'var\(--p-line-body\)'/)
})
