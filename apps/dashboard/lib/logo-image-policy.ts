export const LOGO_IMAGE_MAX_BYTES = 2 * 1024 * 1024

const LOGO_IMAGE_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type LogoImageMime = (typeof LOGO_IMAGE_ALLOWED_TYPES)[number]

export type ValidatedLogoImage = {
  mime: LogoImageMime
  extension: 'jpg' | 'png' | 'webp'
}

export function validateLogoImageMetadata(input: {
  size: number
  type: string
}): { ok: true } | { ok: false; error: string } {
  if (input.size <= 0) return { ok: false, error: 'Boş logo dosyası yüklenemez.' }
  if (input.size > LOGO_IMAGE_MAX_BYTES) return { ok: false, error: 'Logo en fazla 2 MB olabilir.' }
  if (!LOGO_IMAGE_ALLOWED_TYPES.includes(input.type as LogoImageMime)) {
    return { ok: false, error: 'Yalnız PNG, JPEG veya WebP logo yükleyin.' }
  }
  return { ok: true }
}

function isPng(bytes: Uint8Array): boolean {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 33 || !signature.every((value, index) => bytes[index] === value)) return false

  let offset = 8
  let chunkIndex = 0
  while (offset + 12 <= bytes.length) {
    const length = (
      ((bytes[offset] ?? 0) << 24)
      | ((bytes[offset + 1] ?? 0) << 16)
      | ((bytes[offset + 2] ?? 0) << 8)
      | (bytes[offset + 3] ?? 0)
    ) >>> 0
    const type = String.fromCharCode(
      bytes[offset + 4] ?? 0,
      bytes[offset + 5] ?? 0,
      bytes[offset + 6] ?? 0,
      bytes[offset + 7] ?? 0,
    )
    const nextOffset = offset + 12 + length
    if (nextOffset > bytes.length) return false
    if (chunkIndex === 0 && (type !== 'IHDR' || length !== 13)) return false
    if (type === 'IEND') return length === 0 && nextOffset === bytes.length
    offset = nextOffset
    chunkIndex += 1
  }
  return false
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 4
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[bytes.length - 2] === 0xff
    && bytes[bytes.length - 1] === 0xd9
}

function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 20) return false
  const ascii = (offset: number) => String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  )
  const declaredSize = (
    (bytes[4] ?? 0)
    | ((bytes[5] ?? 0) << 8)
    | ((bytes[6] ?? 0) << 16)
    | ((bytes[7] ?? 0) << 24)
  ) >>> 0
  return ascii(0) === 'RIFF'
    && ascii(8) === 'WEBP'
    && declaredSize + 8 === bytes.length
}

export function inspectLogoImage(
  bytes: Uint8Array,
  claimedType: string,
): { ok: true; image: ValidatedLogoImage } | { ok: false; error: string } {
  let image: ValidatedLogoImage | null = null
  if (isPng(bytes)) image = { mime: 'image/png', extension: 'png' }
  else if (isJpeg(bytes)) image = { mime: 'image/jpeg', extension: 'jpg' }
  else if (isWebp(bytes)) image = { mime: 'image/webp', extension: 'webp' }

  if (!image || image.mime !== claimedType) {
    return { ok: false, error: 'Dosya içeriği güvenli bir PNG, JPEG veya WebP logosuyla eşleşmiyor.' }
  }
  return { ok: true, image }
}
