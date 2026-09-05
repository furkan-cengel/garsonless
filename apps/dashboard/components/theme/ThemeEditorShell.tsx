'use client'

import type { ReactNode } from 'react'
import { ThemeEditorToast } from './ThemeEditorToast'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  THEME_EDITOR_SURFACES,
  type ThemeEditorSurface,
} from './theme-editor-workspace-model'

interface ThemeEditorShellProps {
  topbar: ReactNode
  notices?: ReactNode
  editingBlocked?: boolean
  sidebar: ReactNode
  canvas: ReactNode
  properties: ReactNode
  dialogs?: ReactNode
  toastMessage: string
  taskBased: boolean
  activeSurface: ThemeEditorSurface
  onSurfaceChange: (surface: ThemeEditorSurface) => void
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
  html[data-focus-modality="keyboard"] [data-theme-editor-root] button:focus-visible,
  html[data-focus-modality="keyboard"] [data-theme-editor-root] summary:focus-visible,
  html[data-focus-modality="keyboard"] [data-theme-editor-root] [role="button"]:focus-visible,
  html[data-focus-modality="keyboard"] [data-theme-editor-root] input:focus-visible,
  html[data-focus-modality="keyboard"] [data-theme-editor-root] select:focus-visible {
    outline: 2px solid var(--text) !important;
    outline-offset: 2px;
  }
  [data-theme-editor-root] summary::-webkit-details-marker {
    display: none;
  }
  [data-theme-editor-root] button:disabled {
    cursor: not-allowed !important;
    opacity: .38;
  }
  [data-theme-editor-root] [data-page-flow-row] {
    transition: background-color 140ms ease, box-shadow 140ms ease;
  }
  [data-theme-editor-root] [data-page-flow-select]:not(:disabled):hover,
  [data-theme-editor-root] [data-page-flow-select]:not(:disabled):active,
  [data-theme-editor-root] [data-section-select]:not(:disabled):hover,
  [data-theme-editor-root] [data-section-select]:not(:disabled):active {
    background: transparent !important;
    box-shadow: none !important;
    filter: none !important;
    transform: none !important;
  }
  [data-theme-editor-root] [data-section-select]:focus-visible {
    outline: none !important;
  }
  @media (hover: hover) and (pointer: fine) {
    [data-theme-editor-root] [data-page-flow-row]:hover {
      background: var(--surface-3) !important;
      box-shadow: inset 3px 0 0 var(--text-3);
    }
  }
  [data-theme-editor-task-nav] {
    display: none;
  }
  [data-theme-editor-pane] {
    min-width: 0;
    min-height: 0;
  }
  [data-theme-editor-root] [data-slot="scroll-area-viewport"] {
    overscroll-behavior: contain;
  }
  [data-theme-editor-root] [data-slot="scroll-area"] > [data-slot="scroll-area-scrollbar"] {
    opacity: 0;
    pointer-events: none;
  }
  [data-theme-editor-root] [data-slot="scroll-area"][data-scrolling] > [data-slot="scroll-area-scrollbar"],
  [data-theme-editor-root] [data-slot="scroll-area"]:focus-within > [data-slot="scroll-area-scrollbar"] {
    opacity: 1;
    pointer-events: auto;
  }
  @media (hover: hover) and (pointer: fine) {
    [data-theme-editor-root] [data-slot="scroll-area"]:hover > [data-slot="scroll-area-scrollbar"] {
      opacity: 1;
      pointer-events: auto;
    }
  }
  @media (max-width: 900px) {
    [data-theme-editor-topbar] {
      height: 52px !important;
      min-height: 52px !important;
      grid-template-columns: 36px minmax(0, 1fr) !important;
      gap: 8px !important;
      padding: 6px 12px !important;
    }
    [data-theme-editor-context] {
      flex: 0 0 36px !important;
    }
    [data-theme-editor-context] > span {
      display: none !important;
    }
    [data-theme-editor-device-switch] {
      display: none !important;
    }
    [data-theme-editor-actions] {
      grid-column: 2 !important;
      flex-wrap: nowrap !important;
      gap: 4px !important;
      min-width: 0 !important;
    }
    [data-theme-surface-trigger] {
      min-width: 176px !important;
    }
    [data-theme-editor-actions] > div {
      height: 34px !important;
      padding-right: 4px !important;
    }
    [data-theme-editor-actions] button {
      min-width: 34px;
      min-height: 34px !important;
      padding: 0 8px !important;
    }
    [data-theme-editor-publish] {
      min-width: 84px !important;
    }
    [data-theme-editor-save-draft] {
      min-width: 76px !important;
    }
    [data-theme-editor-task-nav] {
      min-height: 44px;
      flex-shrink: 0;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 4px;
      padding: 4px 8px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }
    [data-theme-editor-task-nav] button {
      min-width: 0;
      min-height: 36px;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: var(--text-2);
      font-size: 13px;
      font-weight: 700;
    }
    [data-theme-editor-task-nav] button[aria-selected="true"] {
      background: var(--surface-inset);
      color: var(--text);
      box-shadow: inset 0 0 0 1px var(--border);
    }
    [data-theme-editor-pane] {
      width: 100%;
      flex: 1 1 100%;
      overflow: hidden;
    }
    [data-theme-editor-pane] > aside {
      width: 100% !important;
      border-left: 0 !important;
      border-right: 0 !important;
    }
  }
  @media (min-width: 901px) and (max-width: 1450px) {
    [data-theme-editor-actions] {
      gap: 4px !important;
    }
    [data-theme-editor-save-status] {
      display: none !important;
    }
    [data-theme-editor-change-count] {
      width: 88px !important;
      padding-inline: 6px !important;
    }
    [data-theme-editor-open-preview] {
      width: 36px !important;
      padding: 0 !important;
      justify-content: center !important;
      gap: 0 !important;
      font-size: 0 !important;
    }
  }
  @media (max-width: 649px) {
    [data-theme-editor-topbar] {
      padding: 6px 8px !important;
    }
    [data-theme-editor-context] span {
      display: none !important;
    }
    [data-theme-surface-trigger] {
      width: 36px !important;
      min-width: 36px !important;
      padding: 0 !important;
      justify-content: center !important;
    }
    [data-theme-surface-trigger] > span,
    [data-theme-surface-trigger] > svg:last-child {
      display: none !important;
    }
    [data-theme-editor-save-status] {
      max-width: 82px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    [data-theme-editor-actions] > span[title] {
      display: none !important;
    }
    [data-theme-editor-open-preview] {
      display: none !important;
    }
    [data-theme-editor-publish] {
      min-width: 70px !important;
      font-size: 12px !important;
    }
    [data-theme-editor-save-draft] {
      min-width: 64px !important;
      font-size: 12px !important;
    }
    [data-theme-editor-save-status] {
      display: none !important;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-theme-editor-root] button,
    [data-theme-editor-root] [data-page-flow-row],
    [data-theme-editor-root] [data-slot="scroll-area-scrollbar"] { transition: none !important; }
    [data-theme-editor-root] button:hover,
    [data-theme-editor-root] button:active { transform: none !important; }
  }
`

export function ThemeEditorShell({
  topbar,
  notices,
  editingBlocked = false,
  sidebar,
  canvas,
  properties,
  dialogs,
  toastMessage,
  taskBased,
  activeSurface,
  onSurfaceChange,
}: ThemeEditorShellProps) {
  return (
    <div
      data-theme-editor-root
      style={{
        width: '100%',
        flex: '1 1 0%',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-inset)',
      }}
    >
      <style>{EDITOR_INTERACTION_CSS}</style>
      <div inert={editingBlocked} className="shrink-0">{topbar}</div>
      {notices}
      <div inert={editingBlocked} className="flex min-h-0 flex-1 flex-col">
      <Tabs
        value={activeSurface}
        onValueChange={(value) => onSurfaceChange(value as ThemeEditorSurface)}
        className="min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        {taskBased && <ThemeEditorTaskNavigation />}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            id="theme-editor-page-panel"
            role={taskBased ? 'tabpanel' : undefined}
            aria-labelledby={taskBased ? 'theme-editor-page-tab' : undefined}
            data-theme-editor-pane="page"
            style={{ display: !taskBased || activeSurface === 'page' ? 'flex' : 'none' }}
          >{sidebar}</div>
          <div
            id="theme-editor-preview-panel"
            role={taskBased ? 'tabpanel' : undefined}
            aria-labelledby={taskBased ? 'theme-editor-preview-tab' : undefined}
            data-theme-editor-pane="preview"
            style={{ display: !taskBased || activeSurface === 'preview' ? 'flex' : 'none', flex: 1 }}
          >{canvas}</div>
          <div
            id="theme-editor-design-panel"
            role={taskBased ? 'tabpanel' : undefined}
            aria-labelledby={taskBased ? 'theme-editor-design-tab' : undefined}
            data-theme-editor-pane="design"
            style={{ display: !taskBased || activeSurface === 'design' ? 'flex' : 'none' }}
          >{properties}</div>
        </div>
      </Tabs>
      </div>
      {dialogs}
      <ThemeEditorToast message={toastMessage} />
    </div>
  )
}

function ThemeEditorTaskNavigation() {
  return (
    <TabsList data-theme-editor-task-nav aria-label="Tema düzenleme çalışma alanı">
      {THEME_EDITOR_SURFACES.map((surface) => (
        <TabsTrigger
          key={surface.id}
          id={`theme-editor-${surface.id}-tab`}
          value={surface.id}
          aria-controls={`theme-editor-${surface.id}-panel`}
        >
          {surface.label}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
