import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  getThemePreviewFailureStatus,
  getThemePreviewTargetOrigin,
  THEME_PREVIEW_RETRY_DELAYS_MS,
} from './use-theme-preview-bridge'

test('preview mesajlarını yalnız hedef URL originine sınırlar', () => {
  assert.equal(
    getThemePreviewTargetOrigin('https://menu.masabu.co/test-cafe-b?preview=1'),
    'https://menu.masabu.co',
  )
  assert.equal(
    getThemePreviewTargetOrigin('http://localhost:3011/test-cafe-b?preview=1'),
    'http://localhost:3011',
  )
})

test('geçersiz preview URL için mesajlaşmayı fail-closed kapatır', () => {
  assert.equal(getThemePreviewTargetOrigin('not a url'), null)
})

test('ilk ready sinyali kaçarsa handshake sınırlı ve deterministik tekrar edilir', () => {
  assert.deepEqual(THEME_PREVIEW_RETRY_DELAYS_MS, [250, 1_000, 2_500, 4_000])
  assert.ok(THEME_PREVIEW_RETRY_DELAYS_MS.every((delay) => delay < 6_500))
})

test('preview arızası son başarılı görüntüyü stale olarak korur', () => {
  assert.equal(getThemePreviewFailureStatus(false), 'error')
  assert.equal(getThemePreviewFailureStatus(true), 'stale')
})

test('ilk handshake kaçarsa yalnız bir otomatik iframe recovery uygulanır', () => {
  const source = readFileSync(new URL('./use-theme-preview-bridge.ts', import.meta.url), 'utf8')
  assert.match(source, /automaticRecoveryUsedRef/)
  assert.match(source, /!hasSuccessfulPreviewRef\.current && !automaticRecoveryUsedRef\.current/)
  assert.match(source, /iframe\.src = currentSrc/)
})
