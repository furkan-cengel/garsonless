import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const lifecycle = readFileSync(new URL('./use-theme-editor-lifecycle.ts', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('./ThemeEditorPropertiesWorkspace.tsx', import.meta.url), 'utf8')
const sectionSettings = readFileSync(new URL('./ThemeSectionSettings.tsx', import.meta.url), 'utf8')
const select = readFileSync(new URL('../ui/select.tsx', import.meta.url), 'utf8')
const nativeSelect = readFileSync(new URL('../ui/native-select.tsx', import.meta.url), 'utf8')
const inputGroup = readFileSync(new URL('../ui/input-group.tsx', import.meta.url), 'utf8')
const item = readFileSync(new URL('../ui/item.tsx', import.meta.url), 'utf8')
const toggle = readFileSync(new URL('../ui/toggle.tsx', import.meta.url), 'utf8')
const shell = readFileSync(new URL('./ThemeEditorShell.tsx', import.meta.url), 'utf8')

test('continuous editor controls share one undo interaction checkpoint', () => {
  assert.match(lifecycle, /document\.addEventListener\('focusin'/)
  assert.match(lifecycle, /focusedHistoryGroupRef/)
  assert.match(lifecycle, /rememberInteractionStart/)
  assert.match(workspace, /onSectionSettingsChange\(\{/)
})

test('selector focus remains visible without the heavy outer ring', () => {
  for (const source of [select, nativeSelect, inputGroup, item, toggle]) {
    assert.match(source, /focus-visible[^"\n]*ring-0|focus-visible\]:ring-0/)
  }
  assert.match(sectionSettings, /garsonless-section-option-tile:focus-visible[\s\S]*?outline: none;/)
  assert.match(sectionSettings, /box-shadow: inset 0 0 0 1px/)
})

test('theme editor focus outline is limited to keyboard modality', () => {
  assert.match(
    shell,
    /html\[data-focus-modality="keyboard"\] \[data-theme-editor-root\] input:focus-visible/,
  )
  assert.doesNotMatch(
    shell,
    /^\s*\[data-theme-editor-root\] input:focus-visible/m,
  )
})
