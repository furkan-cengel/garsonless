import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const lifecycleSource = readFileSync(`${directory}/use-theme-editor-lifecycle.ts`, 'utf8')
const clientSource = readFileSync(`${directory}/ThemeEditorClient.tsx`, 'utf8')
const editorPageSource = readFileSync(
  `${directory}/../../app/dashboard/[restaurantId]/theme/[templateId]/edit/page.tsx`,
  'utf8',
)

/**
 * The preview iframe is a public rendering surface. Before this boundary the
 * editor pushed its raw working theme over `FULL_THEME_UPDATE`, which replaced
 * the server-side plan projection in the iframe and brought unentitled Pro
 * sections back on screen for a Starter tenant.
 */
test('every theme crossing the preview bridge is projected through the plan boundary', () => {
  assert.match(lifecycleSource, /projectThemeForSectionAccess/)
  assert.match(lifecycleSource, /const sectionAccess = useMemo<ThemeSectionAccess>\(/)
  assert.match(
    lifecycleSource,
    /const deriveBridgeTheme = useCallback\(\s*\(nextOverrides: Partial<GarsonlessTheme>\) =>\s*projectThemeForSectionAccess\(derivePreviewTheme\(nextOverrides\), sectionAccess\)/,
  )
  assert.match(lifecycleSource, /useThemePreviewBridge\(\{ previewUrl, theme: bridgeTheme,/)

  // No unprojected theme may reach the iframe through any other sender.
  const fullThemeSends = lifecycleSource.match(/createFullThemePreviewCommand\([^)]*/g) ?? []
  assert.ok(fullThemeSends.length > 0)
  for (const send of fullThemeSends) {
    assert.doesNotMatch(send, /derivePreviewTheme\(/)
  }
})

test('the editor keeps the unprojected theme so locked sections stay listed and configurable', () => {
  // previewTheme drives the editor tree, property panels and the draft that is
  // persisted; projecting it would silently discard the owner's saved work.
  assert.match(lifecycleSource, /const previewTheme = useMemo\(\s*\(\) => derivePreviewTheme\(overrides\),/)
  assert.match(lifecycleSource, /const savingTheme = previewTheme/)
  assert.match(clientSource, /theme=\{previewTheme\}/)
})

test('Video Hero resolves its own entitlement instead of the bundled advanced catalogue', () => {
  assert.match(editorPageSource, /feature: 'theme_advanced_sections'/)
  assert.match(editorPageSource, /feature: 'theme_video_hero'/)
  assert.match(editorPageSource, /canUseVideoHero=\{canUseVideoHero\}/)
  assert.match(clientSource, /canAddAdvancedSections, canUseVideoHero,/)
  assert.match(
    lifecycleSource,
    /\(\{ advancedSections: canAddAdvancedSections, videoHero: canUseVideoHero \}\)/,
  )
})
