import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const root = `${directory}/../../app`
const actions = readFileSync(`${directory}/../../lib/actions/orders.ts`, 'utf8')
const adapter = readFileSync(`${directory}/../../lib/server-action-error.ts`, 'utf8')

test('dashboard has recoverable route, global and not-found boundaries', () => {
  for (const file of ['error.tsx', 'global-error.tsx', 'not-found.tsx']) {
    const source = readFileSync(`${root}/${file}`, 'utf8')
    assert.match(source, /RecoveryScreen/)
    assert.match(source, /MAS-(UI-500|ROUTE-404)/)
  }
})

test('order actions return labelled, safe failures instead of raw infrastructure messages', () => {
  assert.match(actions, /dashboardActionFailure\('VALIDATION_FAILED'/)
  assert.match(actions, /dashboardAccessFailure/)
  assert.match(actions, /dashboardOrderFailure/)
  assert.match(actions, /dashboardActionFailure\('SERVICE_UNAVAILABLE'/)
  assert.doesNotMatch(actions, /return \{ error: error\.message \}/)
  assert.doesNotMatch(actions, /return \{ error: gate\.error \}/)
})

test('the server adapter correlates private causes without placing them in action responses', () => {
  assert.match(adapter, /import 'server-only'/)
  assert.match(adapter, /referenceId/)
  assert.match(adapter, /console\.(error|warn)/)
  assert.doesNotMatch(adapter, /return \{[^}]*cause/)
})
