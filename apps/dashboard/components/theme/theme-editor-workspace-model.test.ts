import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  changeThemePreviewScale,
  getFittedThemePreviewScale,
  getThemeEditorWorkspaceLayout,
} from './theme-editor-workspace-model'

test('workspace layout keeps explicit narrow, compact and wide breakpoints', () => {
  assert.deepEqual(getThemeEditorWorkspaceLayout(1_119), {
    viewport: 'narrow',
    leftPanelWidth: 224,
    rightPanelWidth: 286,
    showFullTopbarCopy: false,
  })
  assert.deepEqual(getThemeEditorWorkspaceLayout(1_120), {
    viewport: 'compact',
    leftPanelWidth: 260,
    rightPanelWidth: 300,
    showFullTopbarCopy: true,
  })
  assert.deepEqual(getThemeEditorWorkspaceLayout(1_320), {
    viewport: 'wide',
    leftPanelWidth: 260,
    rightPanelWidth: 320,
    showFullTopbarCopy: true,
  })
})

test('preview zoom stays rounded and inside the supported range', () => {
  assert.equal(changeThemePreviewScale(1, 0.1), 1.1)
  assert.equal(changeThemePreviewScale(1.36, 0.1), 1.4)
  assert.equal(changeThemePreviewScale(0.6, -0.1), 0.55)
})

test('fit scale follows preview mode and editor viewport', () => {
  assert.equal(getFittedThemePreviewScale('mobile', 'wide'), 0.86)
  assert.equal(getFittedThemePreviewScale('mobile', 'compact'), 0.78)
  assert.equal(getFittedThemePreviewScale('mobile', 'narrow'), 0.68)
  assert.equal(getFittedThemePreviewScale('desktop', 'wide'), 0.72)
  assert.equal(getFittedThemePreviewScale('desktop', 'compact'), 0.64)
  assert.equal(getFittedThemePreviewScale('desktop', 'narrow'), 0.58)
})
