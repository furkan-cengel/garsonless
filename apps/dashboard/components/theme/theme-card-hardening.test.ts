import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const client = readFileSync(new URL('./ThemeEditorClient.tsx', import.meta.url), 'utf8')
const previewUrl = readFileSync(new URL('./theme-preview-url.ts', import.meta.url), 'utf8')
const lifecycle = readFileSync(new URL('./use-theme-editor-lifecycle.ts', import.meta.url), 'utf8')
const guidance = readFileSync(new URL('./use-theme-publish-guidance.ts', import.meta.url), 'utf8')
const properties = readFileSync(new URL('./ThemeEditorPropertiesWorkspace.tsx', import.meta.url), 'utf8')
const propertyPanels = readFileSync(new URL('./ThemePropertyPanels.tsx', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../../lib/actions/theme.ts', import.meta.url), 'utf8')
const settings = readFileSync(new URL('../../../../packages/ui/src/themes/default/settings.ts', import.meta.url), 'utf8')
const editPage = readFileSync(new URL('../../app/dashboard/[restaurantId]/theme/[templateId]/edit/page.tsx', import.meta.url), 'utf8')

test('theme preview URL carries a validated template id', () => {
  assert.match(previewUrl, /params\.set\('template', isThemeTemplateId\(input\.templateId\) \? input\.templateId : CANONICAL_THEME_ID\)/)
  assert.match(previewUrl, /params\.set\('previewAccess', input\.previewAccessToken\)/)
  assert.match(editPage, /createThemePreviewAccessToken\(\{/)
  assert.match(client, /buildThemePreviewUrl\(\{ menuBaseUrl, restaurantSlug, templateId, previewAccessToken/)
})

test('card contrast blocks client and server publishing', () => {
  assert.match(lifecycle, /inspectMenuCardSurfaceContrast\(previewTheme\)/)
  assert.match(lifecycle, /menuCardContrastIssues\.length > 0/)
  assert.match(actions, /inspectMenuCardSurfaceContrast\(sanitizedDraft\)/)
  assert.match(guidance, /Ürün kartı kritik kontrast sorunlarını düzelt/)
})

test('card panel exposes an explicit safe contrast repair', () => {
  assert.match(client, /Kart paletini güvenli değerlere getir/)
  assert.match(properties, /onContrastRepair/)
})

test('card controls use scoped surface tokens and remove unsafe manual layout overrides', () => {
  assert.match(settings, /id: 'cardRadius'/)
  assert.match(settings, /id: 'cardShadow'/)
  assert.match(settings, /id: 'cardBorder'/)
  assert.match(settings, /id: 'cardImagePosition', label: 'Kırpma Odağı'/)
  const cardSchema = settings.slice(settings.indexOf("id: 'cards'"), settings.indexOf("id: 'nav'"))
  for (const id of ['cardColumns', 'cardImageAspect', 'cardImageFit']) {
    assert.doesNotMatch(cardSchema, new RegExp(`id: '${id}'`))
  }
  assert.match(cardSchema, /id: 'cardHorizontalImageWidth'[\s\S]{0,180}min: 92, max: 160/)
})

test('every card schema control is routed into the card property panel', () => {
  const cardControlIds = [
    'cardLayout', 'cardRadius', 'cardShadow', 'cardBorder',
    'cardShowDesc', 'cardShowTag', 'tagShimmer', 'cardCtaStyle', 'cardDensity',
    'cardShowImage', 'cardImagePosition', 'cardHorizontalImageWidth', 'cardTitleLines', 'cardDescriptionLines',
    'cardPriceAlign', 'cardHover', 'cardCtaIcon', 'cardPlaceholderStyle',
  ]

  for (const id of cardControlIds) {
    assert.match(settings, new RegExp(`id: '${id}'`), `${id} is missing from the card settings schema`)
    assert.match(propertyPanels, new RegExp(`"${id}"`), `${id} is not routed to the card property panel`)
  }
})
