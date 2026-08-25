import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('preview handshake retries do not restart the pending font application', () => {
  const source = readFileSync(new URL('./ThemePreviewBridge.tsx', import.meta.url), 'utf8')

  assert.match(source, /pendingThemeAckRef\.current === data\.requestId/)
  assert.match(source, /createThemeAppliedEvent\(requestId\)/)
  assert.match(source, /requestAnimationFrame\(\(\) => requestAnimationFrame/)
  assert.match(source, /pendingThemeAckRef\.current === requestId/)
})

test('preview route navigation reports home and menu surfaces to the parent editor', () => {
  const source = readFileSync(new URL('./ThemePreviewBridge.tsx', import.meta.url), 'utf8')

  assert.match(source, /createThemePreviewNavigationEvent\(getCurrentPreviewSurface\(\)\)/)
  assert.match(source, /new URLSearchParams\(window\.location\.search\)\.get\('surface'\)/)
  assert.ok(source.includes("return /\\/menu\\/?$/.test(window.location.pathname) ? 'menu' : null"))
  assert.match(source, /window\.parent\.postMessage\(navigation, parentOrigin\)/)
})

test('iframe iç navigasyonu dashboard parent originini kaybetmez', () => {
  const source = readFileSync(new URL('./ThemePreviewBridge.tsx', import.meta.url), 'utf8')

  assert.match(source, /PREVIEW_PARENT_ORIGIN_KEY/)
  assert.match(source, /referrerOrigin !== window\.location\.origin/)
  assert.match(source, /window\.sessionStorage\.setItem\(PREVIEW_PARENT_ORIGIN_KEY, referrerOrigin\)/)
  assert.match(source, /window\.sessionStorage\.getItem\(PREVIEW_PARENT_ORIGIN_KEY\)/)
  assert.match(source, /url\.protocol === 'http:' \|\| url\.protocol === 'https:'/)
})

test('preview selection scrolls only the child document without moving the editor shell', () => {
  const source = readFileSync(new URL('./ThemePreviewBridge.tsx', import.meta.url), 'utf8')

  assert.match(source, /function scrollPreviewDocumentTo/)
  assert.match(source, /document\.scrollingElement/)
  assert.match(source, /scroller\.scrollTo\(/)
  assert.match(source, /scrollPreviewDocumentTo\(footer, 'start'\)/)
  assert.doesNotMatch(source, /\.scrollIntoView\(\{/)
})
