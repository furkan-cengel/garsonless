'use client'

import {
  MENU_IMAGE_MAX_BYTES,
  MENU_IMAGE_MAX_EDGE,
  validateMenuImageMetadata,
} from './menu-image-policy'

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Görsel dönüştürülemedi.'))
    }, type, quality)
  })
}

/**
 * Applies the public-menu media contract before upload. Large dimensions are
 * reduced in the browser, EXIF metadata is discarded and the result is WebP.
 * The server repeats byte-size, declared MIME and magic-byte validation.
 */
export async function prepareMenuImage(file: File): Promise<File> {
  const metadata = validateMenuImageMetadata({ size: file.size, type: file.type })
  if (!metadata.ok) throw new Error(metadata.error)

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('Görsel okunamadı veya dosya bozuk.')
  }

  try {
    if (bitmap.width <= 0 || bitmap.height <= 0) throw new Error('Görsel ölçüleri geçersiz.')
    const scale = Math.min(1, MENU_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Görsel işlenemedi.')
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await canvasToBlob(canvas, 'image/webp', 0.86)
    if (blob.size > MENU_IMAGE_MAX_BYTES) {
      throw new Error('Görsel sıkıştırıldıktan sonra da 5 MB sınırını aşıyor.')
    }
    const baseName = file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'menu-image'
    return new File([blob], `${baseName}.webp`, { type: 'image/webp' })
  } finally {
    bitmap.close()
  }
}
