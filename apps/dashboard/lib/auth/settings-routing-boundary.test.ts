import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const middleware = readFileSync(new URL('../../middleware.ts', import.meta.url), 'utf8')
const settingsPage = readFileSync(
  new URL('../../app/dashboard/[restaurantId]/settings/page.tsx', import.meta.url),
  'utf8',
)

test('settings role redirects finish at the HTTP middleware boundary before RSC streaming', () => {
  assert.match(middleware, /const settingsRoute = \^?\/?/)
  assert.match(middleware, /\.eq\('owner_id', user\.id\)/)
  assert.match(middleware, /\.eq\('status', 'active'\)/)
  assert.match(middleware, /!access\.permissions\.includes\('settings'\)/)
  assert.match(middleware, /redirectTo\(firstPermittedPath\(restaurantId, access\), ''\)/)
  assert.match(middleware, /resolveSettingsSection\(requestedSection, access\.isOwner\)/)
  assert.match(middleware, /return redirectTo\(req\.nextUrl\.pathname, `\?\$\{canonical\.toString\(\)\}`\)/)
})

test('settings page keeps its server-side authorization defense behind middleware', () => {
  assert.match(settingsPage, /if \(!actor\.isOwner && !actor\.permissions\.includes\('settings'\)\)/)
  assert.match(settingsPage, /redirect\(firstPermittedPath/)
  assert.match(settingsPage, /const requestedSection = resolveSettingsSection\(query\.section, actor\.isOwner === true\)/)
  assert.match(settingsPage, /const continuitySections = new Set\(\['workspace', 'profile', 'billing', 'security', 'privacy'\]\)/)
})
