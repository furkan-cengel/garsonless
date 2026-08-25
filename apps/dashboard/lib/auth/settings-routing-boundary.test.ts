import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const middleware = readFileSync(new URL('../../middleware.ts', import.meta.url), 'utf8')
const settingsPage = readFileSync(
  new URL('../../app/dashboard/[restaurantId]/settings/page.tsx', import.meta.url),
  'utf8',
)

test('settings authorization stays out of Middleware and runs at the server page boundary', () => {
  assert.doesNotMatch(middleware, /restaurant_members|owner_id|settingsRoute|resolveSettingsSection/)
  assert.match(middleware, /supabase\.auth\.getUser\(\)/)
})

test('settings page owns authorization and canonical section resolution', () => {
  assert.match(settingsPage, /if \(!actor\.isOwner && !actor\.permissions\.includes\('settings'\)\)/)
  assert.match(settingsPage, /redirect\(firstPermittedPath/)
  assert.match(settingsPage, /const requestedSection = resolveSettingsSection\(query\.section, actor\.isOwner === true\)/)
  assert.match(settingsPage, /const continuitySections = new Set\(\['workspace', 'profile', 'billing', 'security', 'privacy'\]\)/)
})
