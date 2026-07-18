'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ThemePreviewMode } from './ThemeEditorTopbar'
import {
  changeThemePreviewScale,
  getFittedThemePreviewScale,
  getThemeEditorWorkspaceLayout,
} from './theme-editor-workspace-model'

export function useThemeEditorWorkspace(previewUrl: string) {
  const [previewMode, setPreviewMode] = useState<ThemePreviewMode>('mobile')
  const [previewScale, setPreviewScale] = useState(1)
  const [viewportWidth, setViewportWidth] = useState(0)

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
    changeZoom,
    fitPreview,
    openPreview,
  }
}
