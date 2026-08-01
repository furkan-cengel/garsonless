import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultQR } from './tables-builder-model'
import {
  QR_STYLE_CONFLICT_MESSAGE,
  resolveQRStyleSave,
} from './qr-style-save-model'

const initial = defaultQR('https://menu.masabu.co/cafe')
const local = { ...initial, fg: '#a13b7a' }
const remote = { ...initial, fg: '#2f6f4e' }

test('successful optimistic write advances the acknowledged snapshot', () => {
  assert.deepEqual(resolveQRStyleSave({
    attemptedStyle: local,
    expectedRevision: 4,
    result: { success: true, revision: 5 },
  }), {
    kind: 'acknowledged',
    snapshot: { revision: 5, style: local },
  })
})

test('different authoritative style rolls the optimistic projection back on conflict', () => {
  assert.deepEqual(resolveQRStyleSave({
    attemptedStyle: local,
    expectedRevision: 4,
    result: { conflict: true, revision: 5, style: remote },
  }), {
    kind: 'rollback',
    snapshot: { revision: 5, style: remote },
    message: QR_STYLE_CONFLICT_MESSAGE,
  })
})

test('same authoritative style acknowledges an ambiguous response replay', () => {
  assert.deepEqual(resolveQRStyleSave({
    attemptedStyle: local,
    expectedRevision: 4,
    result: { conflict: true, revision: 5, style: local },
  }), {
    kind: 'acknowledged',
    snapshot: { revision: 5, style: local },
  })
})

test('transport errors and invalid revisions retain the optimistic value for explicit retry', () => {
  assert.deepEqual(resolveQRStyleSave({
    attemptedStyle: local,
    expectedRevision: 4,
    result: { error: 'Bağlantı kesildi.' },
  }), { kind: 'retry', message: 'Bağlantı kesildi.' })
  assert.equal(resolveQRStyleSave({
    attemptedStyle: local,
    expectedRevision: 4,
    result: { success: true, revision: 4 },
  }).kind, 'retry')
})
