import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  changeThemePreviewScale,
  getFittedThemePreviewScale,
  getThemeEditorWorkspaceLayout,
} from './theme-editor-workspace-model'

test('workspace layout uses task surfaces on mobile and tablet and three columns above 900px', () => {
  assert.deepEqual(getThemeEditorWorkspaceLayout(390), {
    viewport: 'mobile',
    leftPanelWidth: 320,
    rightPanelWidth: 390,
    showFullTopbarCopy: false,
    taskBased: true,
  })
  assert.deepEqual(getThemeEditorWorkspaceLayout(820), {
    viewport: 'tablet',
    leftPanelWidth: 320,
    rightPanelWidth: 420,
    showFullTopbarCopy: false,
    taskBased: true,
  })
  assert.deepEqual(getThemeEditorWorkspaceLayout(901), {
    viewport: 'compact',
    leftPanelWidth: 260,
    rightPanelWidth: 300,
    showFullTopbarCopy: true,
    taskBased: false,
  })
  assert.deepEqual(getThemeEditorWorkspaceLayout(1_320), {
    viewport: 'wide',
    leftPanelWidth: 260,
    rightPanelWidth: 320,
    showFullTopbarCopy: true,
    taskBased: false,
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
  assert.equal(getFittedThemePreviewScale('mobile', 'mobile'), 0.82)
  assert.equal(getFittedThemePreviewScale('mobile', 'tablet'), 0.88)
  assert.equal(getFittedThemePreviewScale('desktop', 'wide'), 0.72)
  assert.equal(getFittedThemePreviewScale('desktop', 'compact'), 0.64)
  assert.equal(getFittedThemePreviewScale('desktop', 'mobile'), 0.32)
  assert.equal(getFittedThemePreviewScale('desktop', 'tablet'), 0.68)
})
