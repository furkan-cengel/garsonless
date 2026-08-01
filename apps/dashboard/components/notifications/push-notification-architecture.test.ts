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
  assert.match(worker, /ORDER_RESOLVED/)
  assert.match(worker, /getNotifications\(\{ tag: `order:\$\{orderId\}` \}\)/)
})

test('global shell alert controller avoids a second local notification after durable subscription', () => {
  const hook = source('./useGlobalOrderAlerts.tsx')
  assert.match(hook, /subscription\.status !== 'subscribed'/)
  assert.match(hook, /useDashboardPushSubscription/)
  assert.match(hook, /BroadcastChannel/)
  assert.match(hook, /enqueueOrderAlert/)
})

test('push capability state hydrates deterministically before reading browser permission', () => {
  const hook = source('./useDashboardPushSubscription.ts')
  assert.match(hook, /useState<NotificationPermission \| 'unsupported'>\('unsupported'\)/)
  assert.match(hook, /useState<DashboardPushStatus>\(publicKey \? 'idle' : 'unconfigured'\)/)
  assert.match(hook, /const browserPermission = Notification\.permission/)
  assert.ok(hook.indexOf('const browserPermission = Notification.permission') > hook.indexOf('useEffect(() =>'))
})

test('subscription server action re-checks membership and paid entitlement', () => {
  const action = source('../../lib/actions/push-subscriptions.ts')
  assert.match(action, /assertMember\(restaurantId\)/)
  assert.match(action, /canRestaurantUseFeature\(\{ restaurantId, plan, feature: 'browser_notifications' \}\)/)
  assert.match(action, /endpointHash/)
})

test('logout retires server endpoints before destroying the auth session', () => {
  const auth = source('../../lib/actions/auth.ts')
  const cleanup = auth.indexOf('deleteDashboardPushSubscriptionsForUser')
  const signOut = auth.indexOf('supabase.auth.signOut()')
  assert.ok(cleanup >= 0)
  assert.ok(signOut > cleanup)
})

test('shell authenticates RLS-scoped Realtime before orders and inbox subscriptions', () => {
  const shell = source('../layout/RestaurantShell.tsx')
  const authCalls = shell.match(/await supabase\.realtime\.setAuth\(data\.session\.access_token\)/g) ?? []
  assert.equal(authCalls.length, 2)
  assert.match(shell, /table: 'orders'/)
  assert.match(shell, /table: 'notification_inbox'/)
})

test('orders board carries unfinished work while the shell owns the only alert subscription', () => {
  const hook = source('../orders/useOrdersRealtime.ts')
  const adapter = source('../../../../packages/db/src/dashboard-read-model-port.ts')
  const shell = source('../layout/RestaurantShell.tsx')

  assert.match(hook, /await supabase\.realtime\.setAuth\(data\.session\.access_token\)/)
  assert.match(hook, /fetchPages\(OPEN_ORDER_STATUSES\)/)
  assert.match(hook, /fetchPages\(\['served', 'cancelled'\], initialSince\)/)
  assert.match(adapter, /appendPages\(OPEN_ORDER_STATUSES\)/)
  assert.match(adapter, /appendPages\(\['served', 'cancelled'\], since\)/)
  assert.match(shell, /\.in\('status', \[\.\.\.OPEN_ORDER_STATUSES\]\)/)
  assert.doesNotMatch(shell, /\.gte\('created_at', todayStart\.toISOString\(\)\)/)
  assert.doesNotMatch(hook, /newOrderEvent/)
  assert.match(shell, /onOrderInsert\(payload\.new as Order\)/)
  assert.match(shell, /onOrderUpdate\(payload\.new as Order\)/)
})

test('order inbox self-heal is member-gated and aggregate-scoped', () => {
  const action = source('../../lib/actions/notifications.ts')
  const port = source('../../../../packages/db/src/dashboard-inbox-port.ts')
  assert.match(action, /assertMember\(restaurantId\)/)
  assert.match(action, /listPendingDashboardInboxEventIds\(\{\s*restaurantId,\s*aggregateId,/)
  assert.match(port, /\.eq\('restaurant_id', input\.restaurantId\)/)
  assert.match(port, /\.eq\('aggregate_id', input\.aggregateId\)/)
  assert.match(port, /\.eq\('consumer', DASHBOARD_INBOX_CONSUMER\)/)
})
