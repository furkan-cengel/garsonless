import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME } from '@garsonless/design-engine'
import { prepareThemeDraftSaveAttempt, prepareThemePublishAttempt } from './theme-publish-contract'

test('same theme draft save intent reuses one request id after an ambiguous response', () => {
  let ids = 0
  const createId = () => `request-${++ids}`
  const intent = { expectedRevision: 3, templateId: 'default', theme: DEFAULT_THEME }
  const first = prepareThemeDraftSaveAttempt(null, intent, createId)
  const retry = prepareThemeDraftSaveAttempt(first, {
    theme: { ...DEFAULT_THEME },
    templateId: 'default',
    expectedRevision: 3,
  }, createId)
  assert.equal(retry.requestId, first.requestId)
  assert.equal(ids, 1)
})

test('draft theme or expected revision changes create a fresh request id', () => {
  let ids = 0
  const createId = () => `request-${++ids}`
  const first = prepareThemeDraftSaveAttempt(null, {
    expectedRevision: 3, templateId: 'default', theme: DEFAULT_THEME,
  }, createId)
  const changedTheme = prepareThemeDraftSaveAttempt(first, {
    expectedRevision: 3, templateId: 'default', theme: { ...DEFAULT_THEME, accent: '#123456' },
  }, createId)
  const changedRevision = prepareThemeDraftSaveAttempt(changedTheme, {
    expectedRevision: 4, templateId: 'default', theme: { ...DEFAULT_THEME, accent: '#123456' },
  }, createId)
  assert.notEqual(changedTheme.requestId, first.requestId)
  assert.notEqual(changedRevision.requestId, changedTheme.requestId)
  assert.equal(ids, 3)
})

test('saved theme publish request identity covers draft and live revisions', () => {
  let ids = 0
  const createId = () => `publish-${++ids}`
  const first = prepareThemePublishAttempt(null, {
    expectedDraftRevision: 3,
    expectedPublishedRevision: 5,
  }, createId)
  const retry = prepareThemePublishAttempt(first, {
    expectedDraftRevision: 3,
    expectedPublishedRevision: 5,
  }, createId)
  const changed = prepareThemePublishAttempt(retry, {
    expectedDraftRevision: 4,
    expectedPublishedRevision: 5,
  }, createId)
  assert.equal(retry.requestId, first.requestId)
  assert.notEqual(changed.requestId, first.requestId)
})
