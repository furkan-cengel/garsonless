'use client'

import { useCallback, useState } from 'react'
import type { ChangeEvent } from 'react'
import { removeLogo } from '../../lib/actions/restaurant'
import { uploadLogo } from '../../lib/dashboard-media-upload-client'

interface ThemeEditorLogoOptions {
  restaurantId: string
  initialLogoUrl: string | null
  flashToast: (message: string) => void
  reloadPreview: () => void
}

export function useThemeEditorLogo({
  restaurantId,
  initialLogoUrl,
  flashToast,
  reloadPreview,
}: ThemeEditorLogoOptions) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [uploading, setUploading] = useState(false)

  const upload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    const result = await uploadLogo(restaurantId, formData)
    setUploading(false)

    if ('error' in result) {
      flashToast(`Logo yüklenemedi: ${result.error}`)
      return
    }

    setLogoUrl(result.url)
    flashToast('Logo güncellendi')
    reloadPreview()
  }, [flashToast, reloadPreview, restaurantId])

  const remove = useCallback(async () => {
    setUploading(true)
    const result = await removeLogo(restaurantId)
    setUploading(false)

    if ('error' in result) {
      flashToast(`Logo kaldırılamadı: ${result.error}`)
      return
    }

    setLogoUrl(null)
    flashToast('Logo kaldırıldı')
    reloadPreview()
  }, [flashToast, reloadPreview, restaurantId])

  return { logoUrl, uploading, upload, remove }
}
