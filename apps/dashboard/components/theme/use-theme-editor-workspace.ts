'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ThemePreviewMode } from './ThemeEditorTopbar'
import {
  changeThemePreviewScale,
  getFittedThemePreviewScale,
  getThemeEditorWorkspaceLayout,
  type ThemeEditorSurface,
} from './theme-editor-workspace-model'

export function useThemeEditorWorkspace(previewUrl: string) {
  const [previewMode, setPreviewMode] = useState<ThemePreviewMode>('mobile')
  const [previewScale, setPreviewScale] = useState(1)
  const [viewportWidth, setViewportWidth] = useState(() => (
    typeof window === 'undefined' ? 0 : window.innerWidth
  ))
  const [activeSurface, setActiveSurface] = useState<ThemeEditorSurface>('preview')

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const layout = useMemo(
    () => getThemeEditorWorkspaceLayout(viewportWidth),
    [viewportWidth],
  )

  const changeZoom = useCallback((delta: number) => {
    setPreviewScale((current) => changeThemePreviewScale(current, delta))
  }, [])

  useEffect(() => {
    setPreviewScale(getFittedThemePreviewScale(previewMode, layout.viewport))
  }, [layout.viewport, previewMode])

  const fitPreview = useCallback(() => {
    setPreviewScale(getFittedThemePreviewScale(previewMode, layout.viewport))
  }, [layout.viewport, previewMode])

  const openPreview = useCallback(() => {
    window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }, [previewUrl])

  return {
    previewMode,
    setPreviewMode,
    previewScale,
    layout,
    activeSurface,
    setActiveSurface,
    changeZoom,
    fitPreview,
    openPreview,
  }
}
