import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const directory = new URL('.', import.meta.url)
const source = (file: string) => readFileSync(new URL(file, directory), 'utf8')
const actions = source('../../lib/actions/restaurant.ts')
const store = source('StoreSections.tsx')
const business = source('BusinessSections.tsx')
const loyalty = source('LoyaltySection.tsx')

test('every settings persistence command carries expected snapshot and request id', () => {
  assert.match(actions, /settingsWriteGuardSchema/)
  assert.equal((actions.match(/expectedSettings: parsedGuard\.data\.expectedSettings/g) ?? []).length, 3)
  assert.equal((actions.match(/requestId: parsedGuard\.data\.requestId/g) ?? []).length, 3)
  for (const component of [store, business, loyalty]) {
    assert.match(component, /prepareSettingsMutationAttempt/)
    assert.match(component, /expectedSettings: settingsSnapshotRef\.current/)
    assert.match(component, /requestId: attempt\.requestId/)
  }
})

test('conflicts preserve the draft while success reconciles the canonical projection', () => {
  assert.match(actions, /result\.value\.outcome === 'conflict'/)
  assert.match(actions, /Taslağını koruduk/)
  for (const component of [store, business, loyalty]) {
    assert.match(component, /result\.code === 'CONFLICT'/)
    assert.match(component, /mergeCanonicalSettings/)
    assert.match(component, /Bağlantı kesildi\. Taslağın korundu/)
  }
  assert.match(loyalty, /setCfg\(canonicalLoyalty as unknown as LoyaltyConfig\)/)
})
