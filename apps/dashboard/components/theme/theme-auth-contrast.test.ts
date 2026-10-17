import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const lifecycle = readFileSync(new URL('./use-theme-editor-lifecycle.ts', import.meta.url), 'utf8')
const topbar = readFileSync(new URL('./ThemeEditorTopbar.tsx', import.meta.url), 'utf8')
const publishGuidance = readFileSync(new URL('./use-theme-publish-guidance.ts', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../../lib/actions/theme.ts', import.meta.url), 'utf8')

test('auth contrast remains advisory in both client and server layers', () => {
  assert.match(lifecycle, /inspectThemePublishContrast\(previewTheme\)/)
  assert.doesNotMatch(lifecycle, /Object\.values\(publishContrast\)\.flat\(\)\[0\]/)
  assert.doesNotMatch(topbar, /publishBlockedReason/)
  assert.doesNotMatch(actions, /inspectThemePublishContrast\(sanitizedDraft\)/)
  assert.doesNotMatch(actions, /Yayın engeli:.*contrastIssue\.label/)
})

test('a hidden contrast issue opens its editable surface instead of disabling publish feedback', () => {
  assert.doesNotMatch(topbar, /disabled=\{[^}]*publishBlockedReason/)
  assert.match(topbar, /QR menüde yayınla/)
  assert.match(publishGuidance, /setExperienceSurface\('auth'\)/)
  assert.match(publishGuidance, /Kontrast önerisi:/)
  assert.match(publishGuidance, /const handlePublishRequest = useCallback\(\(\) => \{ void handlePublish\(\) \}/)
  assert.match(publishGuidance, /return \{ contrastWarningReason, handleInspectContrast, handlePublishRequest \}/)
})

test('auth CTA contrast offers an explicit safe repair', () => {
  const panel = readFileSync(new URL('./ThemeExperiencePanels.tsx', import.meta.url), 'utf8')
  assert.match(panel, /CTA kontrastını otomatik düzelt/)
  assert.match(panel, /cta: '#2f855a'[\s\S]*ctaText: '#ffffff'/)
})

test('contrast errors do not block private draft saves', () => {
  const saveBody = actions.slice(actions.indexOf('export async function saveThemeDraft'))
  assert.doesNotMatch(saveBody, /inspectThemePublishContrast/)
  assert.match(saveBody, /saveRestaurantThemeDraft/)
})

test('cart contrast remains advisory in both client and server layers and exposes repair', () => {
  const client = readFileSync(new URL('./ThemeEditorClient.tsx', import.meta.url), 'utf8')
  assert.match(lifecycle, /inspectThemePublishContrast\(previewTheme\)/)
  assert.doesNotMatch(lifecycle, /Object\.values\(publishContrast\)\.flat\(\)\[0\]/)
  assert.match(publishGuidance, /Sepet kontrast iyileştirilebilir/)
  assert.doesNotMatch(actions, /inspectThemePublishContrast\(sanitizedDraft\)/)
  assert.match(client, /buildMenuCartContrastRepairPatch\(previewTheme\)/)
})

test('publish validation reads service-role-only theme snapshots through the authorized port', () => {
  const publishBody = actions.slice(actions.indexOf('export async function publishTheme'), actions.indexOf('export async function saveThemeDraft'))
  assert.match(publishBody, /themePort\.readDraft\(\{ restaurantId \}\)/)
  assert.match(publishBody, /themePort\.readConfig\(\{ restaurantId \}\)/)
  assert.doesNotMatch(publishBody, /createDashboardServerClient|from\('theme_drafts'\)|from\('theme_configs'\)/)
})
