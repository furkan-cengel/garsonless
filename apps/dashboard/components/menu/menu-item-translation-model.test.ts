import test from 'node:test'
import assert from 'node:assert/strict'
import type { TranslationField } from '@garsonless/domain/menu-translation'
import { currentEnglish, publishableDrafts, typedEnglishChanges } from './menu-item-translation-model'

const field = (overrides: Partial<TranslationField> = {}): TranslationField => ({
  key: 'item/1/name', label: 'Menemen', source: 'Menemen', sourceVersion: 2, version: 5,
  draft: null, draftSourceVersion: null, published: null, publishedSourceVersion: null, ...overrides,
})

test('the panel shows a current draft before the published English', () => {
  assert.equal(currentEnglish(field({ draft: 'Menemen eggs', draftSourceVersion: 2, published: 'Menemen', publishedSourceVersion: 1 })), 'Menemen eggs')
  // A draft for older Turkish is not shown as if it were current.
  assert.equal(currentEnglish(field({ draft: 'Old', draftSourceVersion: 1, published: 'Live', publishedSourceVersion: 1 })), 'Live')
  assert.equal(currentEnglish(undefined), '')
})

test('only real, non-blank typed changes are saved, with the versions the server checks', () => {
  const fields = [field({ published: 'Menemen', publishedSourceVersion: 2 }), field({ key: 'item/1/description', published: 'Eggs', publishedSourceVersion: 2 })]
  assert.deepEqual(typedEnglishChanges(fields, { 'item/1/name': 'Menemen', 'item/1/description': '   ' }), [])
  assert.deepEqual(typedEnglishChanges(fields, { 'item/1/name': ' Turkish scrambled eggs ' }), [
    { key: 'item/1/name', text: 'Turkish scrambled eggs', version: 5, sourceVersion: 2 },
  ])
})

test('Kaydet publishes current drafts only, never stale or already-live text', () => {
  const fields = [
    field({ key: 'a', draft: 'New', draftSourceVersion: 2 }),
    field({ key: 'b', draft: 'Live', draftSourceVersion: 2, published: 'Live', publishedSourceVersion: 2 }),
    field({ key: 'c', draft: 'Old', draftSourceVersion: 1 }),
  ]
  assert.deepEqual(publishableDrafts(fields), [{ key: 'a', version: 5, sourceVersion: 2 }])
})
