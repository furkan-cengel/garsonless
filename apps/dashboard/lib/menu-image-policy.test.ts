import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MENU_IMAGE_MAX_BYTES,
  sniffMenuImageMime,
  validateMenuImageMetadata,
} from './menu-image-policy'

test('menu image metadata enforces size and supported MIME', () => {
  assert.deepEqual(validateMenuImageMetadata({ size: 2_000, type: 'image/webp' }), { ok: true })
  assert.equal(validateMenuImageMetadata({ size: MENU_IMAGE_MAX_BYTES + 1, type: 'image/webp' }).ok, false)
  assert.equal(validateMenuImageMetadata({ size: 2_000, type: 'image/svg+xml' }).ok, false)
})

test('menu image sniffing verifies content independently from extension', () => {
  assert.equal(sniffMenuImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), 'image/jpeg')
  assert.equal(sniffMenuImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png')
  assert.equal(sniffMenuImageMime(new TextEncoder().encode('RIFFxxxxWEBP')), 'image/webp')
  assert.equal(sniffMenuImageMime(new TextEncoder().encode('xxxxftypavif')), 'image/avif')
  assert.equal(sniffMenuImageMime(new TextEncoder().encode('<svg></svg>')), null)
})
