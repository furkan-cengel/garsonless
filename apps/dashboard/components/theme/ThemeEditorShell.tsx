'use client'

import type { ReactNode } from 'react'
import { ThemeEditorToast } from './ThemeEditorToast'

interface ThemeEditorShellProps {
  topbar: ReactNode
  sidebar: ReactNode
  canvas: ReactNode
  properties: ReactNode
  dialogs?: ReactNode
  toastMessage: string
  allowHorizontalOverflow: boolean
}

const EDITOR_INTERACTION_CSS = `
  [data-theme-editor-root] button:not(:disabled) {
    transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease, background-color 140ms ease, border-color 140ms ease !important;
  }
  [data-theme-editor-root] button:not(:disabled):hover {
    filter: brightness(.96);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 14%, transparent), 0 2px 7px rgba(17,19,24,.07);
    transform: translateY(-1px);
  }
  [data-theme-editor-root] button:not(:disabled):active {
    filter: brightness(.92);
    transform: translateY(0) scale(.985);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 20%, transparent);
  }
  [data-theme-editor-root] button:focus-visible,
  [data-theme-editor-root] [role="button"]:focus-visible,
  [data-theme-editor-root] input:focus-visible,
  [data-theme-editor-root] select:focus-visible {
    outline: 2px solid var(--text) !important;
    outline-offset: 2px;
  }
  [data-theme-editor-root] button:disabled {
    cursor: not-allowed !important;
    opacity: .38;
  }
  [data-theme-editor-root] [data-page-flow-row] {
    transition: background-color 140ms ease, box-shadow 140ms ease;
  }
  [data-theme-editor-root] [data-page-flow-row]:hover {
    background: var(--surface-3) !important;
    box-shadow: inset 3px 0 0 var(--text-3);
  }
  [data-theme-editor-root] [data-page-flow-select]:not(:disabled):hover,
  [data-theme-editor-root] [data-page-flow-select]:not(:disabled):active {
    background: transparent !important;
    box-shadow: none !important;
    filter: none !important;
    transform: none !important;
  }
  @media (prefers-reduced-motion: reduce) {
    [data-theme-editor-root] button,
    [data-theme-editor-root] [data-page-flow-row] { transition: none !important; }
    [data-theme-editor-root] button:hover,
    [data-theme-editor-root] button:active { transform: none !important; }
  }
`

export function ThemeEditorShell({
  topbar,
  sidebar,
  canvas,
  properties,
  dialogs,
  toastMessage,
  allowHorizontalOverflow,
}: ThemeEditorShellProps) {
  return (
    <div
      data-theme-editor-root
      style={{
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-inset)',
      }}
    >
      <style>{EDITOR_INTERACTION_CSS}</style>
      {topbar}
      <div style={{
        flex: 1,
        display: 'flex',
        overflowX: allowHorizontalOverflow ? 'auto' : 'hidden',
        overflowY: 'hidden',
      }}>
        {sidebar}
        {canvas}
        {properties}
      </div>
      {dialogs}
      <ThemeEditorToast message={toastMessage} />
    </div>
  )
}
