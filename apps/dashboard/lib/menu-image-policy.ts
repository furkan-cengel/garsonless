export const MENU_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const MENU_IMAGE_MAX_EDGE = 2_000
const MENU_IMAGE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const

export type MenuImageMime = (typeof MENU_IMAGE_ALLOWED_TYPES)[number]

export function validateMenuImageMetadata(input: {
  size: number
  type: string
}): { ok: true } | { ok: false; error: string } {
  if (input.size <= 0) return { ok: false, error: 'Boş görsel yüklenemez.' }
  if (input.size > MENU_IMAGE_MAX_BYTES) {
    return { ok: false, error: 'Görsel en fazla 5 MB olabilir.' }
  }
  if (!MENU_IMAGE_ALLOWED_TYPES.includes(input.type as MenuImageMime)) {
    return { ok: false, error: 'Yalnız JPEG, PNG, WebP veya AVIF görsel yükleyin.' }
  }
  return { ok: true }
}

export function sniffMenuImageMime(bytes: Uint8Array): MenuImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) return 'image/png'
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) return 'image/webp'
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') {
    const brand = String.fromCharCode(...bytes.slice(8, 12))
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
  }
  return null
}
