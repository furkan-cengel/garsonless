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
