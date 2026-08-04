import type { ThemePreviewMode } from './ThemeEditorTopbar'

export type ThemeEditorViewport = 'wide' | 'compact' | 'tablet' | 'mobile'
export type ThemeEditorSurface = 'page' | 'preview' | 'design'

export interface ThemeEditorWorkspaceLayout {
  viewport: ThemeEditorViewport
  leftPanelWidth: number
  rightPanelWidth: number
  showFullTopbarCopy: boolean
  taskBased: boolean
}

export function getThemeEditorWorkspaceLayout(viewportWidth: number): ThemeEditorWorkspaceLayout {
  if (viewportWidth > 0 && viewportWidth <= 649) {
    return {
      viewport: 'mobile',
      leftPanelWidth: 320,
      rightPanelWidth: 390,
      showFullTopbarCopy: false,
      taskBased: true,
    }
  }

  if (viewportWidth > 0 && viewportWidth <= 900) {
    return {
      viewport: 'tablet',
      leftPanelWidth: 320,
      rightPanelWidth: 420,
      showFullTopbarCopy: false,
      taskBased: true,
    }
  }

  if (viewportWidth > 0 && viewportWidth < 1_320) {
    return {
      viewport: 'compact',
      leftPanelWidth: 260,
      rightPanelWidth: 300,
      showFullTopbarCopy: true,
      taskBased: false,
    }
  }

  return {
    viewport: 'wide',
    leftPanelWidth: 260,
    rightPanelWidth: 320,
    showFullTopbarCopy: true,
    taskBased: false,
  }
}

export function changeThemePreviewScale(current: number, delta: number) {
  return Math.min(1.4, Math.max(0.55, Math.round((current + delta) * 100) / 100))
}

export function getFittedThemePreviewScale(mode: ThemePreviewMode, viewport: ThemeEditorViewport) {
  if (mode === 'desktop') {
    if (viewport === 'mobile') return 0.32
    if (viewport === 'tablet') return 0.68
    if (viewport === 'compact') return 0.64
    return 0.72
  }

  if (viewport === 'mobile') return 0.82
  if (viewport === 'tablet') return 0.88
  if (viewport === 'compact') return 0.78
  return 0.86
}

export const THEME_EDITOR_SURFACES: ReadonlyArray<{
  id: ThemeEditorSurface
  label: string
}> = [
  { id: 'page', label: 'Sayfa' },
  { id: 'preview', label: 'Önizleme' },
  { id: 'design', label: 'Tasarım' },
]
