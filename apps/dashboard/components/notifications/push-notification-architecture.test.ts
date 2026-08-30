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

test('granted Android PWA permission self-heals into a persisted push endpoint', () => {
  const hook = source('./useDashboardPushSubscription.ts')
  assert.match(hook, /navigator\.serviceWorker\.register\('\/sw\.js', \{ scope: '\/' \}\)/)
  assert.match(hook, /await navigator\.serviceWorker\.ready/)
  assert.match(hook, /subscription \?\? registration\.pushManager\.subscribe/)
  assert.match(hook, /Notification\.permission !== 'granted'/)
  assert.match(hook, /await persist\(subscription\)/)
})

test('turning on a push preference subscribes the current device inside the user gesture', () => {
  const settings = source('../settings/BusinessSections.tsx')
  assert.match(settings, /key === 'newOrderPush' \|\| key === 'serviceRequestPush'/)
  assert.match(settings, /device\.status !== 'subscribed'[\s\S]*?void device\.subscribe\(\)/)
  assert.match(settings, /device\.status === 'unsupported'[\s\S]*?'Desteklenmiyor'/)
  assert.match(settings, /pushPreferenceDirty[\s\S]*?'Kaydedilmedi'/)
  assert.match(settings, /bildirim tercihinin geçerli olması için Kaydet’e basın/)
})

test('installed dashboard PWA has a stable identity and immediately activates push worker updates', () => {
  const manifest = source('../../public/site.webmanifest')
  const worker = source('../../public/sw.js')
  assert.deepEqual(JSON.parse(manifest), {
    ...JSON.parse(manifest),
    id: '/',
    start_url: '/dashboard',
    scope: '/',
  })
  assert.match(worker, /addEventListener\('install'/)
  assert.match(worker, /self\.skipWaiting\(\)/)
  assert.match(worker, /addEventListener\('activate'/)
  assert.match(worker, /self\.clients\.claim\(\)/)
})

test('subscription server action re-checks membership and paid entitlement', () => {
  const action = source('../../lib/actions/push-subscriptions.ts')
  assert.match(action, /assertMember\(restaurantId\)/)
  assert.match(action, /canRestaurantUseFeature\(\{ restaurantId, plan, feature: 'browser_notifications' \}\)/)
  assert.match(action, /endpointHash/)
})

test('logout retires only the current browser endpoint and uses local auth scope', () => {
  const auth = source('../../lib/actions/auth.ts')
  assert.match(auth, /deleteDashboardPushEndpoint/)
  assert.match(auth, /supabase\.auth\.signOut\(\{ scope: 'local' \}\)/)
  assert.doesNotMatch(auth, /deleteDashboardPushSubscriptionsForUser/)
})

test('shell authenticates RLS-scoped Realtime before membership, orders, inbox and service request subscriptions', () => {
  const shell = source('../layout/RestaurantShell.tsx')
  const authCalls = shell.match(/await supabase\.realtime\.setAuth\(data\.session\.access_token\)/g) ?? []
  assert.equal(authCalls.length, 4)
  assert.match(shell, /table: 'restaurant_members'/)
  assert.match(shell, /table: 'orders'/)
  assert.match(shell, /table: 'notification_inbox'/)
  assert.match(shell, /table: 'service_requests'/)
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

test('notification history and footer expose visible pointer and keyboard feedback', () => {
  const panel = source('../overlays/NotificationsPanel.tsx')
  assert.match(panel, /className="dashboard-notification-history-row"/)
  assert.match(panel, /data-interactive=\{interactive\}/)
  assert.match(panel, /role=\{interactive \? 'button' : undefined\}/)
  assert.match(panel, /event\.key !== 'Enter' && event\.key !== ' '/)
  assert.match(panel, /\.dashboard-notification-history-row\[data-interactive="true"\]:hover/)
  assert.match(panel, /className="dashboard-notification-footer-action"/)
  assert.match(panel, /\.dashboard-notification-footer-action:hover/)
  assert.match(panel, /\.dashboard-notification-footer-action:hover \.dashboard-notification-footer-arrow/)
})
