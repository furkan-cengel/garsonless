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

test('client-side route errors reach the server log once, only for signed-in users and within a rate limit', () => {
  const report = readFileSync(`${directory}/report-client-error.ts`, 'utf8')
  const action = readFileSync(`${directory}/../../lib/actions/client-errors.ts`, 'utf8')
  assert.match(report, /if \(error\.digest \|\| reported\.has\(error\)\) return/)
  assert.match(report, /\.catch\(\(\) => \{\}\)/)
  assert.match(action, /if \(!user\) return/)
  assert.match(action, /consumeDashboardAuthRateLimit\(\{ action: 'client_error_report', subject: `user:\$\{user\.id\}`/)
  assert.match(action, /sanitizeServerDiagnostic\(/)
  assert.match(action, /\.strict\(\)/)
  for (const file of ['error.tsx', 'global-error.tsx', 'dashboard/[restaurantId]/tables/error.tsx']) {
    assert.match(readFileSync(`${root}/${file}`, 'utf8'), /reportClientError\(error, /)
  }
})
