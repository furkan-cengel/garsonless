import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')

test('a real browser reload resets the marketing page to the top before restoring native history behavior', () => {
  assert.match(layout, /navigation\.type !== 'reload'/)
  assert.match(layout, /history\.scrollRestoration = 'manual'/)
  assert.match(layout, /window\.scrollTo\(0, 0\)/)
  assert.match(layout, /window\.addEventListener\('load', resetScroll, \{ once: true \}\)/)
  assert.match(layout, /history\.scrollRestoration = 'auto'/)
})
