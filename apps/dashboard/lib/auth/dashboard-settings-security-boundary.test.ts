import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const auth = readFileSync(new URL('../actions/auth.ts', import.meta.url), 'utf8')
const ownerStepUp = readFileSync(new URL('fresh-owner-auth.ts', import.meta.url), 'utf8')
const team = readFileSync(new URL('../actions/team.ts', import.meta.url), 'utf8')
const privacy = readFileSync(new URL('../actions/privacy.ts', import.meta.url), 'utf8')
const restaurant = readFileSync(new URL('../actions/restaurant.ts', import.meta.url), 'utf8')
const restaurantShell = readFileSync(new URL('../../components/layout/RestaurantShell.tsx', import.meta.url), 'utf8')

test('dashboard auth and email entrypoints use hashed subject and IP limits', () => {
  assert.match(auth, /consumeDashboardAuthRateLimit/)
  assert.match(auth, /subject:`?\$\{?input\.subject/)
  assert.match(auth, /ip:\$\{ip\}/)
  for (const action of ['sign-in', 'sign-up', 'magic-link', 'password-reset', 'fresh-reauth']) {
    assert.match(auth, new RegExp(`action: '${action}'`))
  }
  assert.match(auth, /new URL\(origin\)\.host === expectedHost/)
  assert.match(team, /team-invite/)
  assert.match(team, /team-invite-resend/)
})

test('sensitive owner operations require AAL2 when TOTP exists and never delete immediately', () => {
  assert.match(ownerStepUp, /hasVerifiedTotp/)
  assert.match(ownerStepUp, /currentLevel !== 'aal2'/)
  assert.match(privacy, /requireFreshOwnerPassword/)
  assert.match(privacy, /requestTenantPrivacyOperation/)
  assert.doesNotMatch(privacy, /delete\(|\.delete\(|removeRestaurant/)
})

test('owner timezone changes use the durable CAS boundary instead of a direct table mutation', () => {
  assert.match(restaurant, /updateRestaurantTimezoneCas\(\{/)
  assert.match(restaurant, /requestId: parsed\.data\.requestId/)
  assert.doesNotMatch(restaurant.match(/export async function updateRestaurantTimezone[\s\S]*?\n\}/)?.[0] ?? '', /\.update\(\{ timezone/)
})

test('open member dashboards refresh or leave safely when membership authority changes', () => {
  assert.match(restaurantShell, /membership-revision:/)
  assert.match(restaurantShell, /table: 'restaurant_members'/)
  assert.match(restaurantShell, /window\.location\.assign\('\/dashboard'\)/)
  assert.match(restaurantShell, /router\.refresh\(\)/)
})
