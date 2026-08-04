import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const lifecycle = readFileSync(new URL('./use-theme-editor-lifecycle.ts', import.meta.url), 'utf8')
const topbar = readFileSync(new URL('./ThemeEditorTopbar.tsx', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../../lib/actions/theme.ts', import.meta.url), 'utf8')

test('auth contrast blocks publish in both client and server layers', () => {
  assert.match(lifecycle, /inspectAuthSurfaceContrast\(previewTheme\)/)
  assert.match(lifecycle, /authContrastIssues\.length > 0/)
  assert.match(topbar, /publishBlockedReason/)
  assert.match(actions, /inspectAuthSurfaceContrast\(sanitizedDraft\)/)
  assert.match(actions, /kritik kontrast sorunlarını düzeltmeden tema yayınlanamaz/)
})

test('contrast errors do not block private draft saves', () => {
  const saveBody = actions.slice(actions.indexOf('export async function saveThemeDraft'))
  assert.doesNotMatch(saveBody, /inspectAuthSurfaceContrast/)
  assert.match(saveBody, /saveRestaurantThemeDraft/)
})
