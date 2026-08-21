import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./ThemeLogoUploadCard.tsx', import.meta.url), 'utf8')

test('logo upload preview uses a wide contain frame without cropping the wordmark', () => {
  assert.match(source, /data-logo-upload-preview/)
  assert.match(source, /width: 56, height: 36, aspectRatio: 'auto'/)
  assert.match(source, /objectFit: 'contain'/)
})
