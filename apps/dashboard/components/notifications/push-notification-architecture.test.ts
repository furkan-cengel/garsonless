import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('service worker accepts provider push and de-duplicates by event tag', () => {
  const worker = source('../../public/sw.js')
  assert.match(worker, /addEventListener\('push'/)
  assert.match(worker, /payload\.tag/)
  assert.match(worker, /eventId/)
  assert.match(worker, /notificationclick/)
})

test('orders avoid a second local notification after durable subscription', () => {
  const hook = source('../orders/useNotificationSW.ts')
  assert.match(hook, /subscription\.status !== 'subscribed'/)
  assert.match(hook, /useDashboardPushSubscription/)
})

test('subscription server action re-checks membership and paid entitlement', () => {
  const action = source('../../lib/actions/push-subscriptions.ts')
  assert.match(action, /assertMember\(restaurantId\)/)
  assert.match(action, /canUseFeature\(plan, 'browser_notifications'\)/)
  assert.match(action, /endpointHash/)
})

test('logout retires server endpoints before destroying the auth session', () => {
  const auth = source('../../lib/actions/auth.ts')
  const cleanup = auth.indexOf('deleteDashboardPushSubscriptionsForUser')
  const signOut = auth.indexOf('supabase.auth.signOut()')
  assert.ok(cleanup >= 0)
  assert.ok(signOut > cleanup)
})
