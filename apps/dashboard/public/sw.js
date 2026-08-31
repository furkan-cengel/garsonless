self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

const MASABU_NOTIFICATION_ICON = '/brand/masabu-m-favicon-256x256.png'
const MASABU_NOTIFICATION_BADGE = '/notification-badge.svg'

function notificationAction(kind) {
  if (kind === 'order') return 'Siparişleri aç'
  if (kind === 'service-request') return 'Masaları aç'
  return 'Ayarları aç'
}

function notificationOptions(payload, data) {
  const kind = data.kind === 'order' || data.kind === 'service-request' || data.kind === 'test'
    ? data.kind
    : data.orderId
      ? 'order'
      : 'service-request'

  return {
    body: payload.body ?? '',
    icon: payload.icon ?? MASABU_NOTIFICATION_ICON,
    badge: payload.badge ?? MASABU_NOTIFICATION_BADGE,
    tag: payload.tag ?? `masabu:${data.eventId ?? 'notification'}`,
    lang: 'tr',
    renotify: kind !== 'test',
    requireInteraction: kind !== 'test',
    vibrate: kind === 'test' ? [120] : [200, 100, 200],
    actions: [{ action: 'open', title: notificationAction(kind) }],
    data: {
      eventId: data.eventId ?? null,
      orderId: data.orderId ?? null,
      kind,
      url: data.url ?? '/',
    },
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'ORDER_RESOLVED') {
    const orderId = event.data?.orderId
    if (!orderId) return
    event.waitUntil(
      self.registration.getNotifications({ tag: `order:${orderId}` }).then((notifications) => {
        for (const notification of notifications) notification.close()
      }),
    )
    return
  }
  if (event.data?.type !== 'NEW_ORDER') return

  const { title, body, orderId, url } = event.data

  event.waitUntil(self.registration.showNotification(
    title ?? 'Yeni sipariş',
    notificationOptions({ body, tag: `order:${orderId ?? 'unknown'}` }, {
      orderId,
      kind: 'order',
      url,
    }),
  ))
})

self.addEventListener('push', (event) => {
  let payload
  try {
    payload = event.data?.json() ?? null
  } catch {
    payload = null
  }
  if (!payload || typeof payload !== 'object') return

  const data = payload.data && typeof payload.data === 'object' ? payload.data : {}
  event.waitUntil(self.registration.showNotification(
    payload.title ?? 'Masabu bildirimi',
    notificationOptions(payload, data),
  ))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const absoluteTarget = new URL(targetUrl, self.location.origin).href
      for (const client of clientList) {
        if (client.url === absoluteTarget && 'focus' in client) return client.focus()
      }
      for (const client of clientList) {
        if ('navigate' in client) return client.navigate(targetUrl).then(() => client.focus())
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    }),
  )
})
