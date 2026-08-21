import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const homeClient = readFileSync(new URL('../app/[slug]/HomePageClient.tsx', import.meta.url), 'utf8')

test('home palette variables are scoped to the full homepage tree', () => {
  assert.match(homeClient, /<main data-home-experience-v2 style=\{\{ \.\.\.homeBlockStyle,/)
  assert.match(homeClient, /<div data-home-blocks>/)
  assert.doesNotMatch(homeClient, /<div data-home-blocks style=\{homeBlockStyle\}>/)
})

test('home Header and Footer render with their own inherited theme scopes', () => {
  assert.match(homeClient, /resolveHomeChromeTheme\(theme, 'header'\)/)
  assert.match(homeClient, /resolveHomeChromeTheme\(theme, 'footer'\)/)
  assert.match(homeClient, /<ThemeScope theme=\{homeHeaderTheme\}><Header/)
  assert.match(homeClient, /<ThemeScope theme=\{homeFooterTheme\}><MenuFooter/)
})
