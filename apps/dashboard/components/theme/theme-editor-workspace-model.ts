import type { ThemePreviewMode } from './ThemeEditorTopbar'

export type ThemeEditorViewport = 'wide' | 'compact' | 'narrow'

export interface ThemeEditorWorkspaceLayout {
  viewport: ThemeEditorViewport
  leftPanelWidth: number
  rightPanelWidth: number
  showFullTopbarCopy: boolean
}

export function getThemeEditorWorkspaceLayout(viewportWidth: number): ThemeEditorWorkspaceLayout {
  if (viewportWidth > 0 && viewportWidth < 1_120) {
    return {
      viewport: 'narrow',
      leftPanelWidth: 224,
      rightPanelWidth: 286,
      showFullTopbarCopy: false,
    }
  }

  if (viewportWidth > 0 && viewportWidth < 1_320) {
    return {
      viewport: 'compact',
      leftPanelWidth: 260,
      rightPanelWidth: 300,
      showFullTopbarCopy: true,
    }
  }

  return {
    viewport: 'wide',
    leftPanelWidth: 260,
    rightPanelWidth: 320,
    showFullTopbarCopy: true,
  }
}

export function changeThemePreviewScale(current: number, delta: number) {
  return Math.min(1.4, Math.max(0.55, Math.round((current + delta) * 100) / 100))
}

export function getFittedThemePreviewScale(mode: ThemePreviewMode, viewport: ThemeEditorViewport) {
  if (mode === 'desktop') {
    if (viewport === 'narrow') return 0.58
    if (viewport === 'compact') return 0.64
    return 0.72
  }

  if (viewport === 'narrow') return 0.68
  if (viewport === 'compact') return 0.78
  return 0.86
}
