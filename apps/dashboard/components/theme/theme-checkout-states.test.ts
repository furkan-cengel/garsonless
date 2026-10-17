import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panel = readFileSync(new URL('./ThemeExperiencePanels.tsx', import.meta.url), 'utf8')
const client = readFileSync(new URL('./ThemeEditorClient.tsx', import.meta.url), 'utf8')
const lifecycle = readFileSync(new URL('./use-theme-editor-lifecycle.ts', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../../lib/actions/theme.ts', import.meta.url), 'utf8')

test('selected checkout preview state owns an isolated content and layout editor', () => {
  assert.match(client, /<ThemeExperienceProperties[^>]*checkoutState=\{checkoutState\}/)
  assert.match(panel, /checkoutState !== 'cart' && <CheckoutStateSettings/)
  assert.match(panel, /updateCheckoutState\(checkoutState, patch\)/)
  assert.match(panel, /delete states\[key\]/)
  assert.match(panel, /Ödeme formu içeriği|\{stateLabel\} içeriği/)
  assert.match(panel, /Checkout renkleri/)
})

test('checkout editor exposes bounded controls and closed status icon sets', () => {
  assert.match(panel, /min=\{12\} max=\{28\}/)
  assert.match(panel, /min=\{12\} max=\{40\}/)
  assert.match(panel, /min=\{12\} max=\{56\}/)
  assert.match(panel, /min=\{8\} max=\{32\}/)
  assert.match(panel, /min=\{56\} max=\{96\}/)
  assert.match(panel, /CHECKOUT_SUCCESS_ICON_OPTIONS/)
  assert.match(panel, /CHECKOUT_TABLE_ICON_OPTIONS/)
  assert.match(panel, /CHECKOUT_ERROR_ICON_OPTIONS/)
  assert.match(panel, /function CheckoutStatusIconPicker[\s\S]*?<ToggleGroup[\s\S]*?aria-label=/)
  assert.match(panel, /<ToggleGroupItem/)
  assert.match(panel, /label="İkon rengi"/)
  assert.match(panel, /label="İkon zemini"/)
})

test('checkout system facts stay outside editable theme fields', () => {
  assert.match(panel, /Gerçek tutar, sağlayıcı, alan adları, sistem hata metni ve buton hedefleri tema tarafından değiştirilemez/)
  assert.doesNotMatch(panel, /label="İyzico"|label="Ad"|label="Soyad"|label="E-posta"|label="Telefon"|label="Hata mesajı"/)
})

test('checkout contrast blocks neither publishing nor private draft saves', () => {
  assert.match(lifecycle, /inspectThemePublishContrast\(previewTheme\)/)
  assert.doesNotMatch(lifecycle, /Object\.values\(publishContrast\)\.flat\(\)\[0\]/)
  assert.doesNotMatch(actions, /inspectThemePublishContrast\(sanitizedDraft\)/)
  const saveBody = actions.slice(actions.indexOf('export async function saveThemeDraft'))
  assert.doesNotMatch(saveBody, /inspectCheckoutSurfaceContrast/)
})
