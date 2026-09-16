'use client'
import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Options = {
  restaurantId: string
  templateId: string
  persistDraft: () => boolean
  clearNavigationGuard: () => void
  flashToast: (message: string) => void
  setExperienceSurface: (surface: 'home') => void
  setSectionSearch: (search: string) => void
  openSectionPicker: () => void
}

export function useThemeAddOnPurchase(options: Options) {
  const router = useRouter()
  const query = useSearchParams()
  const restored = useRef(false)
  const {
    restaurantId,
    templateId,
    persistDraft,
    clearNavigationGuard,
    flashToast,
    setExperienceSurface,
    setSectionSearch,
    openSectionPicker,
  } = options
  useEffect(() => {
    if (query.get('addon') !== 'storefront_video_hero' || restored.current)
      return
    restored.current = true
    setExperienceSurface('home')
    setSectionSearch('Video Hero')
    openSectionPicker()
  }, [query, setExperienceSurface, setSectionSearch, openSectionPicker])
  return function purchaseSection(sectionId: string) {
    if (!persistDraft()) {
      flashToast('Taslağın korunamadı. Önce taslağı kaydet.')
      return
    }
    clearNavigationGuard()
    const billing = `/dashboard/${restaurantId}/settings?section=billing`
    router.push(
      sectionId === 'storefront-video-hero'
        ? `${billing}&addon=storefront_video_hero&template=${encodeURIComponent(templateId)}#addons`
        : billing,
    )
  }
}
