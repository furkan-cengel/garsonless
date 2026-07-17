import assert from 'node:assert/strict'
import test from 'node:test'
import { getThemePreviewTargetOrigin } from './use-theme-preview-bridge'

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

test('geçersiz preview URL için geriye uyumlu wildcard kullanır', () => {
  assert.equal(getThemePreviewTargetOrigin('not a url'), '*')
})
