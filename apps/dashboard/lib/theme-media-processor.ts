import sharp from 'sharp'

import {
  THEME_MEDIA_MAX_PIXELS,
  themeMediaMaximumBytes,
  themeMediaMaximumEdge,
  type ThemeMediaInputMime,
  type ThemeMediaPurpose,
  validateThemeMediaMetadata,
} from './theme-media-policy'

const SHARP_FORMAT_TO_MIME = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const satisfies Record<string, ThemeMediaInputMime>

export interface ProcessedThemeMedia {
  bytes: Uint8Array
  mime: 'image/webp'
  extension: 'webp'
  width: number
  height: number
}

export async function processThemeMedia(input: {
  bytes: Uint8Array
  claimedType: string
  purpose: ThemeMediaPurpose
}): Promise<{ ok: true; media: ProcessedThemeMedia } | { ok: false; error: string }> {
  const metadataValidation = validateThemeMediaMetadata({
    size: input.bytes.byteLength,
    type: input.claimedType,
    purpose: input.purpose,
  })
  if (!metadataValidation.ok) return metadataValidation

  try {
    const image = sharp(input.bytes, {
      animated: false,
      failOn: 'error',
      limitInputPixels: THEME_MEDIA_MAX_PIXELS,
    })
    const metadata = await image.metadata()
    const detectedMime = metadata.format
      ? SHARP_FORMAT_TO_MIME[metadata.format as keyof typeof SHARP_FORMAT_TO_MIME]
      : undefined
    if (!detectedMime || detectedMime !== input.claimedType) {
      return { ok: false, error: 'Dosya içeriği ile bildirilen görsel biçimi eşleşmiyor.' }
    }
    if (!metadata.width || !metadata.height || metadata.width <= 0 || metadata.height <= 0) {
      return { ok: false, error: 'Görsel ölçüleri geçersiz.' }
    }
    if (metadata.width * metadata.height > THEME_MEDIA_MAX_PIXELS) {
      return { ok: false, error: 'Görsel çözünürlüğü en fazla 24 megapiksel olabilir.' }
    }
    if ((metadata.pages ?? 1) > 1) {
      return { ok: false, error: 'Animasyonlu görseller Tema medyasında kullanılamaz.' }
    }

    const output = await image
      .rotate()
      .resize({
        width: themeMediaMaximumEdge(input.purpose),
        height: themeMediaMaximumEdge(input.purpose),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: input.purpose === 'section-icon' || input.purpose === 'auth-header-logo' ? 90 : 86, effort: 4 })
      .toBuffer({ resolveWithObject: true })

    if (output.data.byteLength > themeMediaMaximumBytes(input.purpose)) {
      return { ok: false, error: 'Görsel güvenli biçime dönüştürüldükten sonra boyut sınırını aşıyor.' }
    }
    if (!output.info.width || !output.info.height) {
      return { ok: false, error: 'Görsel güvenli biçime dönüştürülemedi.' }
    }
    return {
      ok: true,
      media: {
        bytes: output.data,
        mime: 'image/webp',
        extension: 'webp',
        width: output.info.width,
        height: output.info.height,
      },
    }
  } catch {
    return {
      ok: false,
      error: 'Görsel okunamadı, bozuk veya izin verilen çözünürlük sınırını aşıyor.',
    }
  }
}
