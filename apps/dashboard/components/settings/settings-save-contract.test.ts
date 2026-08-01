import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeCanonicalSettings, prepareSettingsMutationAttempt } from './settings-save-contract'

const expectedSettings = { contact: { city: 'İstanbul' }, hours: { mon: { active: true } } }

test('same settings intent reuses one request id across double-click and retry', () => {
  let ids = 0
  const createId = () => `request-${++ids}`
  const intent = { patch: { contact: { city: 'Ankara' } }, expectedSettings }
  const first = prepareSettingsMutationAttempt(null, intent, createId)
  const reordered = prepareSettingsMutationAttempt(first, {
    expectedSettings: { hours: expectedSettings.hours, contact: expectedSettings.contact },
    patch: intent.patch,
  }, createId)
  assert.equal(reordered.requestId, first.requestId)
  assert.equal(ids, 1)
})

test('changed patch or base snapshot receives a fresh request id', () => {
  let ids = 0
  const createId = () => `request-${++ids}`
  const first = prepareSettingsMutationAttempt(null, {
    patch: { contact: { city: 'Ankara' } }, expectedSettings,
  }, createId)
  const changedPatch = prepareSettingsMutationAttempt(first, {
    patch: { contact: { city: 'İzmir' } }, expectedSettings,
  }, createId)
  const changedBase = prepareSettingsMutationAttempt(changedPatch, {
    patch: { contact: { city: 'İzmir' } },
    expectedSettings: { ...expectedSettings, contact: { city: 'Bursa' } },
  }, createId)
  assert.notEqual(changedPatch.requestId, first.requestId)
  assert.notEqual(changedBase.requestId, changedPatch.requestId)
  assert.equal(ids, 3)
})

test('canonical reconciliation updates only returned top-level sections', () => {
  assert.deepEqual(
    mergeCanonicalSettings(expectedSettings, { contact: { city: 'Ankara' } }),
    { contact: { city: 'Ankara' }, hours: expectedSettings.hours },
  )
})
