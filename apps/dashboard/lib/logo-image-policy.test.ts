import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inspectLogoImage,
  LOGO_IMAGE_MAX_BYTES,
  validateLogoImageMetadata,
} from './logo-image-policy'

function pngBytes(trailing = ''): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ...new Array(13).fill(0), 0, 0, 0, 0,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
    0, 0, 0, 0,
    ...new TextEncoder().encode(trailing),
  ])
}

test('logo metadata rejects SVG, empty files and oversized payloads', () => {
  assert.deepEqual(validateLogoImageMetadata({ size: 1_024, type: 'image/png' }), { ok: true })
  assert.equal(validateLogoImageMetadata({ size: 1_024, type: 'image/svg+xml' }).ok, false)
  assert.equal(validateLogoImageMetadata({ size: 0, type: 'image/png' }).ok, false)
  assert.equal(validateLogoImageMetadata({ size: LOGO_IMAGE_MAX_BYTES + 1, type: 'image/png' }).ok, false)
})

test('logo inspection accepts canonical container endings and MIME agreement', () => {
  assert.deepEqual(inspectLogoImage(pngBytes(), 'image/png'), {
    ok: true,
    image: { mime: 'image/png', extension: 'png' },
  })
  assert.deepEqual(
    inspectLogoImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), 'image/jpeg'),
    { ok: true, image: { mime: 'image/jpeg', extension: 'jpg' } },
  )
})

test('logo inspection rejects SVG, claimed-type mismatch and trailing polyglot payloads', () => {
  const svg = new TextEncoder().encode('<svg><script>alert(1)</script></svg>')
  assert.equal(inspectLogoImage(svg, 'image/svg+xml').ok, false)
  assert.equal(inspectLogoImage(pngBytes(), 'image/jpeg').ok, false)
  assert.equal(inspectLogoImage(pngBytes('<svg></svg>'), 'image/png').ok, false)
  assert.equal(inspectLogoImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 0x3c, 0x73, 0x76, 0x67]), 'image/jpeg').ok, false)
})

test('WebP RIFF length must consume the complete upload', () => {
  const webp = new Uint8Array(20)
  webp.set(new TextEncoder().encode('RIFF'), 0)
  webp[4] = 12
  webp.set(new TextEncoder().encode('WEBP'), 8)
  assert.equal(inspectLogoImage(webp, 'image/webp').ok, true)

  const polyglot = Uint8Array.from([...webp, ...new TextEncoder().encode('<svg/>')])
  assert.equal(inspectLogoImage(polyglot, 'image/webp').ok, false)
})
