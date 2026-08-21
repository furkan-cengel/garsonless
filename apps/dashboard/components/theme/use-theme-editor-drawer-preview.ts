'use client'

import { useEffect, type RefObject } from 'react'
import {
  createOpenThemeNavDrawerCommand,
  createScrollToThemeComponentCommand,
  type GarsonlessTheme,
} from '@garsonless/design-engine'

interface DrawerPreviewOptions {
  activeGroup: string
  iframeRef: RefObject<HTMLIFrameElement | null>
  previewStatus: string
  previewUrl: string
  selectedSectionDefinitionId: string | null
  selectedSectionPlacement?: 'page' | 'drawer'
  selectedServicePlacement?: GarsonlessTheme['servicePlacement']
}

export function getSelectedDrawerPreviewSectionId({
  selectedSectionDefinitionId,
  selectedSectionPlacement,
  selectedServicePlacement,
}: Pick<DrawerPreviewOptions, 'selectedSectionDefinitionId' | 'selectedSectionPlacement' | 'selectedServicePlacement'>) {
  if (!selectedSectionDefinitionId) return null
  if (selectedSectionPlacement === 'drawer') return selectedSectionDefinitionId
  if (selectedSectionDefinitionId === 'request-buttons' && selectedServicePlacement === 'drawer') {
    return selectedSectionDefinitionId
  }
  return null
}

export function useThemeEditorDrawerPreview({
  activeGroup,
  iframeRef,
  previewStatus,
  previewUrl,
  selectedSectionDefinitionId,
  selectedSectionPlacement,
  selectedServicePlacement,
}: DrawerPreviewOptions) {
  useEffect(() => {
    const sectionId = getSelectedDrawerPreviewSectionId({
      selectedSectionDefinitionId,
      selectedSectionPlacement,
      selectedServicePlacement,
    })
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
  }, [activeGroup, iframeRef, previewStatus, previewUrl, selectedSectionDefinitionId, selectedSectionPlacement, selectedServicePlacement])
}
