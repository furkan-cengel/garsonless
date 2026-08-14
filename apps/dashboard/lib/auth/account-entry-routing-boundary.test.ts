import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const dashboardIndex = readFileSync(new URL('../../app/dashboard/page.tsx', import.meta.url), 'utf8')
const middleware = readFileSync(new URL('../../middleware.ts', import.meta.url), 'utf8')
const authActions = readFileSync(new URL('../actions/auth.ts', import.meta.url), 'utf8')

test('an authenticated session without restaurant access lands on login, not onboarding', () => {
  assert.match(dashboardIndex, /restaurants\.length === 0\) redirect\('\/auth\/login\?next=\/dashboard'\)/)
  assert.doesNotMatch(dashboardIndex, /restaurants\.length === 0\) redirect\('\/dashboard\/onboarding'\)/)
})

test('login remains reachable for replacing an existing browser session', () => {
  assert.match(middleware, /user && req\.nextUrl\.pathname === '\/auth\/signup'/)
  assert.doesNotMatch(middleware, /req\.nextUrl\.pathname === '\/auth\/login' \|\|/)
})

test('only account creation defaults to onboarding', () => {
  assert.match(authActions, /safeNext\(formData\.get\('next'\), '\/dashboard\/onboarding'\)/)
  assert.match(authActions, /redirect\(safeNext\(formData\.get\('next'\)\)\)/)
})
