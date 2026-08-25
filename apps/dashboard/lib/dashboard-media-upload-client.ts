'use client'

type UploadResult = { error: string } | {
  url: string
  width?: number
  height?: number
  mime?: string
  durationSeconds?: number
}

async function upload(kind: 'logo' | 'menu-image' | 'theme-image' | 'theme-video', formData: FormData): Promise<UploadResult> {
  const response = await fetch(`/api/uploads/${kind}`, {
    method: 'POST',
    body: formData,
    credentials: 'same-origin',
  })
  const payload = await response.json().catch(() => null) as UploadResult | null
  if (!response.ok || !payload) return { error: 'Dosya yüklenemedi. Lütfen tekrar deneyin.' }
  return payload
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
