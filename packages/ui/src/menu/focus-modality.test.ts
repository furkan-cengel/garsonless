import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { FOCUS_MODALITY_SCRIPT } from '../focus-modality'

test('focus modality switches before focus and preserves text entry modality', () => {
  assert.match(FOCUS_MODALITY_SCRIPT, /addEventListener\('pointerdown',[\s\S]*true\)/)
  assert.match(FOCUS_MODALITY_SCRIPT, /event\.key === 'Tab'/)
  assert.match(FOCUS_MODALITY_SCRIPT, /input:not\(\[type=/)
  assert.match(FOCUS_MODALITY_SCRIPT, /dataset\.focusModality = 'pointer'/)
  assert.match(FOCUS_MODALITY_SCRIPT, /dataset\.focusModality = 'keyboard'/)
})

test('focus modality installer is idempotent across nested layouts', () => {
  assert.match(FOCUS_MODALITY_SCRIPT, /window\[readyKey\] === true/)
  assert.match(FOCUS_MODALITY_SCRIPT, /window\[readyKey\] = true/)
  assert.doesNotMatch(FOCUS_MODALITY_SCRIPT, /dataset\.focusModalityReady/)
})

test('every application installs the tracker and suppresses pointer-only focus chrome', () => {
  for (const app of ['dashboard', 'menu', 'marketing', 'kitchen', 'platform-admin']) {
    const layout = readFileSync(
      new URL(`../../../../apps/${app}/app/layout.tsx`, import.meta.url),
      'utf8',
    )
    const styles = readFileSync(
      new URL(`../../../../apps/${app}/app/globals.css`, import.meta.url),
      'utf8',
    )

    assert.match(layout, /<FocusModalityScript \/>/, `${app} must install modality tracking`)
    assert.match(
      styles,
      /html\[data-focus-modality="pointer"\] :focus-visible/,
      `${app} must suppress pointer focus indicators`,
    )
  }
})
