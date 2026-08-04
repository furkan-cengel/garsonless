import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panel = readFileSync(new URL('./ThemeExperiencePanels.tsx', import.meta.url), 'utf8')
const client = readFileSync(new URL('./ThemeEditorClient.tsx', import.meta.url), 'utf8')

test('selected auth preview state owns its isolated content and layout editor', () => {
  assert.match(client, /<ThemeExperienceProperties[^>]*authState=\{authState\}/)
  assert.match(panel, /authState !== 'join' && <AuthStateSettings/)
  assert.match(panel, /updateAuthState\(authState, patch\)/)
  assert.match(panel, /delete states\[state\]/)
  assert.match(panel, /Varsayılana dön/)
  assert.match(panel, /Form renkleri/)
})

test('auth state editor exposes only bounded safe controls and closed icon sets', () => {
  assert.match(panel, /maxLength=\{100\}/)
  assert.match(panel, /maxLength=\{240\}/)
  assert.match(panel, /maxLength=\{60\}/)
  assert.match(panel, /min=\{12\} max=\{40\}/)
  assert.match(panel, /min=\{12\} max=\{56\}/)
  assert.match(panel, /min=\{8\} max=\{32\}/)
  assert.match(panel, /min=\{56\} max=\{96\}/)
  assert.match(panel, /SUCCESS_ICON_OPTIONS/)
  assert.match(panel, /ERROR_ICON_OPTIONS/)
  assert.match(panel, /role="radiogroup"/)
  assert.match(panel, /role="radio"/)
  assert.match(panel, /label="İkon rengi"/)
  assert.match(panel, /label="İkon zemini"/)
  assert.match(panel, /AuthStateColorField/)
  assert.match(panel, /if \(value === undefined\) delete nextState\[key\]/)
  assert.doesNotMatch(panel, /auth-state-custom-icon|auth-state-html|auth-state-css/)
})

test('OTP system facts and auth behavior stay outside editable theme fields', () => {
  assert.match(panel, /E-posta, sayaç, sistem hata metinleri ve buton hedefi tema tarafından değiştirilemez/)
  assert.doesNotMatch(panel, /label="OTP uzunluğu"|label="Sayaç süresi"|label="Buton hedefi"/)
})
