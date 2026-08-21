import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8')

test('theme editor route and dynamic fallback share one loading frame', () => {
  const routeSkeleton = read('../layout/DashboardRouteSkeleton.tsx')
  const dynamicLoading = read('./ThemeEditorLoading.tsx')

  assert.match(routeSkeleton, /kind === 'theme'[\s\S]*ThemeEditorLoadingFrame/)
  assert.match(dynamicLoading, /return <ThemeEditorLoadingFrame/)
  assert.doesNotMatch(routeSkeleton, /function ThemeSkeleton/)
})

test('theme editor loading frame follows the editor responsive contract', () => {
  const source = read('./ThemeEditorLoadingFrame.tsx')

  assert.match(source, /max-width: 649px/)
  assert.match(source, /max-width: 900px/)
  assert.match(source, /min-width: 901px[^]*max-width: 1319px/)
  assert.match(source, /grid-template-columns: 260px minmax\(0, 1fr\) 320px/)
  assert.match(source, /grid-template-columns: 260px minmax\(0, 1fr\) 300px/)
  assert.match(source, /theme-editor-loading-task-nav/)
  assert.match(source, /theme-editor-loading-phone/)
  assert.match(source, /prefers-reduced-motion: reduce/)
  assert.match(source, /role="status"/)
  assert.match(source, /aria-busy="true"/)
  assert.equal((source.match(/role="status"/g) ?? []).length, 1)
  assert.match(source, /aria-hidden="true"/)
})

test('theme editor picks the client viewport before its first rendered layout', () => {
  const source = read('./use-theme-editor-workspace.ts')
  assert.match(source, /useState\(\(\) => \([\s\S]*typeof window === 'undefined' \? 0 : window\.innerWidth/)
})

test('preview loading and recovery UI stays outside the scaled iframe surface', () => {
  const canvas = read('./ThemeEditorCanvas.tsx')
  const preview = read('./ThemePreviewSurface.tsx')

  assert.match(canvas, /data-theme-preview-unscaled-overlay/)
  assert.match(canvas, /previewStatus === 'ready' \|\| previewStatus === 'stale'/)
  assert.match(canvas, /\? null/)
  assert.match(preview, /data-theme-preview-status-overlay="preparing"/)
  assert.match(preview, /min-h-11/)
  assert.match(preview, /background: 'var\(--surface\)'/)
  assert.match(preview, /color: 'var\(--text\)'/)
  assert.doesNotMatch(preview, /theme\.bg|theme\.accent|theme\.textColor/)
})
