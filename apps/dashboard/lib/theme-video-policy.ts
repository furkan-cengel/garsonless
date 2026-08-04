import { THEME_MEDIA_VIDEO_MAX_BYTES, THEME_MEDIA_VIDEO_MAX_SECONDS } from './theme-media-policy'

type ThemeVideoMime = 'video/mp4' | 'video/webm'

export type ValidatedThemeVideo = {
  bytes: Uint8Array
  mime: ThemeVideoMime
  extension: 'mp4' | 'webm'
  durationSeconds: number
}

function ascii(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes)
}

function mp4Duration(bytes: Uint8Array): number | null {
  const text = ascii(bytes)
  const marker = text.indexOf('mvhd')
  if (marker < 0 || marker + 32 >= bytes.length) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const version = bytes[marker + 4]
  try {
    if (version === 0) {
      const timescale = view.getUint32(marker + 16)
      const duration = view.getUint32(marker + 20)
      return timescale > 0 ? duration / timescale : null
    }
    if (version === 1) {
      const timescale = view.getUint32(marker + 24)
      const duration = view.getBigUint64(marker + 28)
      return timescale > 0 ? Number(duration) / timescale : null
    }
  } catch {
    return null
  }
  return null
}

function readVint(bytes: Uint8Array, offset: number): { length: number; value: number } | null {
  const first = bytes[offset]
  if (!first) return null
  let length = 1
  let mask = 0x80
  while (length <= 8 && (first & mask) === 0) { length += 1; mask >>= 1 }
  if (length > 8 || offset + length > bytes.length) return null
  let value = first & (mask - 1)
  for (let index = 1; index < length; index += 1) value = value * 256 + bytes[offset + index]!
  return { length, value }
}

function findBytes(bytes: Uint8Array, needle: readonly number[]): number {
  outer: for (let index = 0; index <= bytes.length - needle.length; index += 1) {
    for (let cursor = 0; cursor < needle.length; cursor += 1) if (bytes[index + cursor] !== needle[cursor]) continue outer
    return index
  }
  return -1
}

function webmDuration(bytes: Uint8Array): number | null {
  const durationId = findBytes(bytes, [0x44, 0x89])
  if (durationId < 0) return null
  const size = readVint(bytes, durationId + 2)
  if (!size || (size.value !== 4 && size.value !== 8)) return null
  const start = durationId + 2 + size.length
  if (start + size.value > bytes.length) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset + start, size.value)
  const durationUnits = size.value === 4 ? view.getFloat32(0) : view.getFloat64(0)
  if (!Number.isFinite(durationUnits) || durationUnits <= 0) return null
  const scaleId = findBytes(bytes, [0x2a, 0xd7, 0xb1])
  let timecodeScale = 1_000_000
  if (scaleId >= 0) {
    const scaleSize = readVint(bytes, scaleId + 3)
    if (scaleSize && scaleSize.value > 0 && scaleSize.value <= 8) {
      let value = 0
      const startOffset = scaleId + 3 + scaleSize.length
      for (let index = 0; index < scaleSize.value; index += 1) value = value * 256 + bytes[startOffset + index]!
      if (value > 0) timecodeScale = value
    }
  }
  return durationUnits * timecodeScale / 1_000_000_000
}

export function validateThemeVideo(input: { bytes: Uint8Array; claimedType: string }): { ok: true; video: ValidatedThemeVideo } | { ok: false; error: string } {
  if (input.bytes.byteLength <= 0) return { ok: false, error: 'Boş video dosyası yüklenemez.' }
  if (input.bytes.byteLength > THEME_MEDIA_VIDEO_MAX_BYTES) return { ok: false, error: 'Hero video en fazla 8 MB olabilir.' }
  if (input.claimedType !== 'video/mp4' && input.claimedType !== 'video/webm') return { ok: false, error: 'Hero video için yalnız MP4 veya WebM yükleyin.' }
  const text = ascii(input.bytes)
  const isMp4 = input.bytes.length >= 12 && text.slice(4, 8) === 'ftyp'
  const isWebm = input.bytes.length >= 4 && input.bytes[0] === 0x1a && input.bytes[1] === 0x45 && input.bytes[2] === 0xdf && input.bytes[3] === 0xa3
  if ((input.claimedType === 'video/mp4' && !isMp4) || (input.claimedType === 'video/webm' && !isWebm)) return { ok: false, error: 'Dosya içeriği ile bildirilen video biçimi eşleşmiyor.' }
  const codecOk = isMp4 ? text.includes('avc1') || text.includes('avc3') : text.includes('V_VP8') || text.includes('V_VP9')
  if (!codecOk) return { ok: false, error: isMp4 ? 'MP4 video H.264 codec kullanmalıdır.' : 'WebM video VP8 veya VP9 codec kullanmalıdır.' }
  const durationSeconds = isMp4 ? mp4Duration(input.bytes) : webmDuration(input.bytes)
  if (!durationSeconds) return { ok: false, error: 'Video süresi güvenli biçimde doğrulanamadı.' }
  if (durationSeconds > THEME_MEDIA_VIDEO_MAX_SECONDS + .05) {
    return {
      ok: false,
      error: `Hero video 15 saniye sınırını aşıyor (${durationSeconds.toFixed(1)} sn).`,
    }
  }
  return {
    ok: true,
    video: {
      bytes: input.bytes,
      mime: isMp4 ? 'video/mp4' : 'video/webm',
      extension: isMp4 ? 'mp4' : 'webm',
      durationSeconds,
    },
  }
}
