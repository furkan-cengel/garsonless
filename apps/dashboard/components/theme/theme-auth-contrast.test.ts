import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const lifecycle = readFileSync(new URL('./use-theme-editor-lifecycle.ts', import.meta.url), 'utf8')
const topbar = readFileSync(new URL('./ThemeEditorTopbar.tsx', import.meta.url), 'utf8')
const publishGuidance = readFileSync(new URL('./use-theme-publish-guidance.ts', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../../lib/actions/theme.ts', import.meta.url), 'utf8')

test('auth contrast is detected in the editor but no longer blocks publishing', () => {
  assert.match(lifecycle, /inspectThemePublishContrast\(previewTheme\)/)
  assert.doesNotMatch(lifecycle, /Object\.values\(publishContrast\)\.flat\(\)\[0\]/)
  assert.doesNotMatch(topbar, /publishBlockedReason|Yayın engelini düzelt/)
  assert.doesNotMatch(actions, /inspectThemePublishContrast\(sanitizedDraft\)/)
  assert.doesNotMatch(actions, /Yayın engeli:.*contrastIssue\.label/)
})

test('a contrast warning opens its editable surface while Yayınla stays a plain publish', () => {
  assert.match(publishGuidance, /const handlePublishRequest = useCallback\(\(\) => \{ void handlePublish\(\) \}/)
  assert.match(publishGuidance, /setExperienceSurface\('auth'\)/)
  assert.match(publishGuidance, /Kontrast: \$\{issue\.label\}/)
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

test('cart contrast warns without blocking publish and exposes repair', () => {
  const client = readFileSync(new URL('./ThemeEditorClient.tsx', import.meta.url), 'utf8')
  assert.match(lifecycle, /inspectThemePublishContrast\(previewTheme\)/)
  assert.doesNotMatch(lifecycle, /Object\.values\(publishContrast\)\.flat\(\)\[0\]/)
  assert.match(publishGuidance, /Sepet renklerinde düşük kontrast var/)
  assert.doesNotMatch(actions, /inspectThemePublishContrast\(sanitizedDraft\)/)
  assert.match(client, /buildMenuCartContrastRepairPatch\(previewTheme\)/)
})

test('publish validation reads service-role-only theme snapshots through the authorized port', () => {
  const publishBody = actions.slice(actions.indexOf('export async function publishTheme'), actions.indexOf('export async function saveThemeDraft'))
  assert.match(publishBody, /themePort\.readDraft\(\{ restaurantId \}\)/)
  assert.match(publishBody, /themePort\.readConfig\(\{ restaurantId \}\)/)
  assert.doesNotMatch(publishBody, /createDashboardServerClient|from\('theme_drafts'\)|from\('theme_configs'\)/)
})
