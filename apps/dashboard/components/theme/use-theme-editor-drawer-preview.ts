'use client'

import { useEffect, type RefObject } from 'react'

interface DrawerPreviewOptions {
  activeGroup: string
  iframeRef: RefObject<HTMLIFrameElement | null>
  previewStatus: string
  previewUrl: string
  selectedSectionDefinitionId: string | null
  selectedSectionPlacement?: 'page' | 'drawer'
}

export function useThemeEditorDrawerPreview({
  activeGroup,
  iframeRef,
  previewStatus,
  previewUrl,
  selectedSectionDefinitionId,
  selectedSectionPlacement,
}: DrawerPreviewOptions) {
  useEffect(() => {
    const sectionId = selectedSectionPlacement === 'drawer' ? selectedSectionDefinitionId : null
    if (activeGroup !== 'drawer' && activeGroup !== 'footer' && !sectionId) return
    let targetOrigin: string
    try {
      targetOrigin = new URL(previewUrl, window.location.href).origin
    } catch {
      return
    }
    iframeRef.current?.contentWindow?.postMessage(
      activeGroup === 'footer'
        ? { type: 'SCROLL_TO_COMPONENT', component: 'footer' }
        : { type: 'OPEN_NAV_DRAWER', sectionId },
      targetOrigin,
    )
  }, [activeGroup, iframeRef, previewStatus, previewUrl, selectedSectionDefinitionId, selectedSectionPlacement])
}
