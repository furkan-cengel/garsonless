'use client'

import { useEffect, type RefObject } from 'react'
import {
  createOpenThemeNavDrawerCommand,
  createScrollToThemeComponentCommand,
} from '@garsonless/design-engine'

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
    const message = activeGroup === 'footer'
      ? createScrollToThemeComponentCommand()
      : createOpenThemeNavDrawerCommand(sectionId)
    if (message) iframeRef.current?.contentWindow?.postMessage(message, targetOrigin)
  }, [activeGroup, iframeRef, previewStatus, previewUrl, selectedSectionDefinitionId, selectedSectionPlacement])
}
