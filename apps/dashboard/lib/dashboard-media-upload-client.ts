'use client'

import { uploadLargeMedia } from './media-staging-client'

type UploadResult = { error: string } | {
  url: string
  width?: number
  height?: number
  mime?: string
  durationSeconds?: number
}

async function upload(kind: 'logo' | 'menu-image' | 'theme-image' | 'theme-video', formData: FormData): Promise<UploadResult> {
  let response: Response
  try {
    const file = formData.get('file')
    response = kind !== 'logo' && file instanceof File && file.size > 3 * 1024 * 1024
      ? await uploadLargeMedia(kind, formData, file)
      : await fetch(`/api/uploads/${kind}`, {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
    })
  } catch {
    return { error: 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.' }
  }

  // Authentication can redirect to an HTML page, including with HTTP 200.
  if (response.redirected || response.status === 401) {
    return { error: 'Oturumunuzu doğrulamak için sayfayı yenileyin, ardından tekrar yükleyin.' }
  }
  if (response.status === 413) {
    return { error: 'Dosya yükleme sınırını aşıyor. Dosyayı küçültüp tekrar deneyin.' }
  }
  if (response.status === 429) {
    return { error: 'Çok fazla yükleme denemesi yapıldı. Biraz bekleyip tekrar deneyin.' }
  }
  const payload: unknown = await response.json().catch(() => null)
  if (payload && typeof payload === 'object' && 'error' in payload
    && typeof payload.error === 'string' && payload.error.trim() && payload.error.length <= 500
    && response.status < 500) {
    if (payload.error === 'Not authenticated') {
      return { error: 'Oturumunuzu doğrulamak için sayfayı yenileyin, ardından tekrar yükleyin.' }
    }
    if (payload.error === 'Not authorized') {
      return { error: 'Bu işletmeye dosya yüklemek için yetkiniz yok.' }
    }
    // Validation errors are intentional user-facing messages from our actions.
    return { error: payload.error }
  }
  if (response.status === 403) return { error: 'Bu işletmeye dosya yüklemek için yetkiniz yok.' }
  if (!response.ok || !payload || typeof payload !== 'object' || !('url' in payload)
    || typeof payload.url !== 'string' || !/^https?:\/\//.test(payload.url)) {
    return { error: 'Dosya yüklenemedi. Lütfen tekrar deneyin.' }
  }
  if (kind === 'theme-image' && (!('width' in payload) || !('height' in payload)
    || typeof payload.width !== 'number' || !Number.isFinite(payload.width) || payload.width <= 0
    || typeof payload.height !== 'number' || !Number.isFinite(payload.height) || payload.height <= 0
    || !('mime' in payload) || typeof payload.mime !== 'string')) {
    return { error: 'Görselin yükleme sonucu doğrulanamadı. Lütfen tekrar deneyin.' }
  }
  if (kind === 'theme-video' && (!('durationSeconds' in payload)
    || typeof payload.durationSeconds !== 'number' || !Number.isFinite(payload.durationSeconds) || payload.durationSeconds <= 0
    || !('mime' in payload) || typeof payload.mime !== 'string')) {
    return { error: 'Videonun yükleme sonucu doğrulanamadı. Lütfen tekrar deneyin.' }
  }
  return payload as UploadResult
}

export function uploadLogo(restaurantId: string, formData: FormData) {
  formData.set('restaurantId', restaurantId)
  return upload('logo', formData) as Promise<{ error: string } | { url: string }>
}

export function uploadMenuImage(formData: FormData) {
  return upload('menu-image', formData) as Promise<{ error: string } | { url: string }>
}

export function uploadThemeMedia(formData: FormData) {
  return upload('theme-image', formData) as Promise<{ error: string } | {
    url: string
    width: number
    height: number
    mime: string
  }>
}

export function uploadThemeVideo(formData: FormData) {
  return upload('theme-video', formData) as Promise<{ error: string } | {
    url: string
    durationSeconds: number
    mime: string
  }>
}
