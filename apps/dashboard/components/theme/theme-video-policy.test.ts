import assert from 'node:assert/strict'
import test from 'node:test'
import { validateThemeVideo } from '../../lib/theme-video-policy'

test('hero video boş, yanlış MIME ve doğrulanamayan container dosyalarını reddeder', () => {
  assert.equal(validateThemeVideo({ bytes: new Uint8Array(), claimedType: 'video/mp4' }).ok, false)
  assert.equal(validateThemeVideo({ bytes: new Uint8Array([1, 2, 3]), claimedType: 'video/quicktime' }).ok, false)

  const fakeMp4 = new Uint8Array(64)
  fakeMp4.set(new TextEncoder().encode('ftyp'), 4)
  fakeMp4.set(new TextEncoder().encode('avc1'), 20)
  const result = validateThemeVideo({ bytes: fakeMp4, claimedType: 'video/mp4' })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /süresi/i)
})

function mp4WithDuration(durationSeconds: number): Uint8Array {
  const bytes = new Uint8Array(80)
  bytes.set(new TextEncoder().encode('ftyp'), 4)
  bytes.set(new TextEncoder().encode('avc1'), 12)
  bytes.set(new TextEncoder().encode('mvhd'), 24)
  const view = new DataView(bytes.buffer)
  view.setUint32(40, 1_000)
  view.setUint32(44, Math.round(durationSeconds * 1_000))
  return bytes
}

test('hero video süre sınırını ölçülen değerle açıklar', () => {
  const accepted = validateThemeVideo({ bytes: mp4WithDuration(15), claimedType: 'video/mp4' })
  assert.equal(accepted.ok, true)

  const rejected = validateThemeVideo({ bytes: mp4WithDuration(16.2), claimedType: 'video/mp4' })
  assert.equal(rejected.ok, false)
  if (!rejected.ok) assert.match(rejected.error, /16\.2 sn/)
})
