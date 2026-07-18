import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getThemeEditorSaveStatus } from './theme-editor-shell-model'

test('save status prioritizes active save over dirty state', () => {
  assert.deepEqual(getThemeEditorSaveStatus({
    saving: true,
    hasUnsavedChanges: true,
    lastSavedAt: null,
  }), {
    text: 'Kaydediliyor',
    color: '#b86408',
  })
})

test('save status distinguishes dirty, saved-at and initial states', () => {
  assert.equal(getThemeEditorSaveStatus({
    saving: false,
    hasUnsavedChanges: true,
    lastSavedAt: null,
  }).text, 'Kaydedilmedi')

  const saved = getThemeEditorSaveStatus({
    saving: false,
    hasUnsavedChanges: false,
    lastSavedAt: new Date(2026, 6, 17, 9, 5),
  })
  assert.match(saved.text, /^Kaydedildi \d{2}:\d{2}$/)
  assert.equal(saved.color, 'var(--positive)')

  assert.equal(getThemeEditorSaveStatus({
    saving: false,
    hasUnsavedChanges: false,
    lastSavedAt: null,
  }).text, 'Kaydedildi')
})
