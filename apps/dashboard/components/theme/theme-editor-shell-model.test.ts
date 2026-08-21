import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getThemeEditorSaveStatus } from './theme-editor-shell-model'

const clean = {
  savingDraft: false,
  publishing: false,
  hasUnsavedChanges: false,
  hasUnpublishedChanges: false,
  lastSavedAt: null,
  lastPublishedAt: null,
}

test('save status prioritizes active operations over dirty state', () => {
  assert.deepEqual(getThemeEditorSaveStatus({
    ...clean,
    savingDraft: true,
    hasUnsavedChanges: true,
  }), { text: 'Kaydediliyor', color: '#b86408' })

  assert.equal(getThemeEditorSaveStatus({
    ...clean,
    publishing: true,
    hasUnpublishedChanges: true,
  }).text, 'Yayınlanıyor')
})

test('save status distinguishes local, saved draft and published states', () => {
  assert.equal(getThemeEditorSaveStatus({
    ...clean,
    hasUnsavedChanges: true,
  }).text, 'Kaydedilmedi')

  const saved = getThemeEditorSaveStatus({
    ...clean,
    hasUnpublishedChanges: true,
    lastSavedAt: new Date(2026, 6, 17, 9, 5),
  })
  assert.match(saved.text, /^Yayın bekliyor · \d{2}:\d{2}$/)
  assert.equal(saved.color, '#b86408')

  assert.equal(getThemeEditorSaveStatus(clean).text, 'Yayında')
  assert.match(getThemeEditorSaveStatus({
    ...clean,
    lastPublishedAt: new Date(2026, 6, 17, 9, 5),
  }).text, /^Yayında \d{2}:\d{2}$/)
})
