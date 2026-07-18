import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  FOOD_ICON_OPTIONS,
  SECTION_GROUPS,
  SECTION_LIBRARY,
  SECTION_LIBRARY_IDS,
  SECTION_SETTING_SCHEMA,
} from './theme-editor-section-registry'

test('section registry keeps unique ids and valid group references', () => {
  assert.equal(new Set(SECTION_LIBRARY_IDS).size, SECTION_LIBRARY_IDS.length)

  const validGroups = new Set<string>(SECTION_GROUPS.filter((group) => group !== 'Tümü'))
  for (const section of SECTION_LIBRARY) {
    assert.ok(validGroups.has(section.group), `${section.id} uses unknown group ${section.group}`)
    assert.ok(section.label.trim().length > 0, `${section.id} has no label`)
    assert.ok(section.sub.trim().length > 0, `${section.id} has no description`)
  }
})

test('section setting schemas keep unique keys and valid editor tabs', () => {
  const validTabs = new Set(['design', 'layout', 'content'])

  for (const [sectionId, fields] of Object.entries(SECTION_SETTING_SCHEMA)) {
    const keys = fields.map((field) => field.key)
    assert.equal(new Set(keys).size, keys.length, `${sectionId} has duplicate setting keys`)
    for (const field of fields) {
      assert.ok(validTabs.has(field.editorTab), `${sectionId}.${field.key} uses an invalid editor tab`)
      assert.ok(field.label.trim().length > 0, `${sectionId}.${field.key} has no label`)
    }
  }
})

test('food icon options are unique and safe for select rendering', () => {
  const values = FOOD_ICON_OPTIONS.map((option) => option.value)
  assert.equal(new Set(values).size, values.length)
  assert.ok(FOOD_ICON_OPTIONS.every((option) => option.value.length > 0 && option.label.trim().length > 0))
})
