self.addEventListener('message', (event) => {
  if (event.data?.type !== 'NEW_ORDER') return

  const { title, body, orderId, url } = event.data

  event.waitUntil(self.registration.showNotification(title ?? 'Yeni sipariş!', {
    body: body ?? '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: `new-order:${orderId ?? 'unknown'}`,
    data: { url: url ?? '/' },
  }))
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
  event.waitUntil(self.registration.showNotification(payload.title ?? 'Masabu bildirimi', {
    body: payload.body ?? '',
    icon: payload.icon ?? '/icon.svg',
    badge: payload.badge ?? '/icon.svg',
    tag: payload.tag ?? `masabu:${data.eventId ?? 'notification'}`,
    renotify: false,
    data: {
      eventId: data.eventId ?? null,
      url: data.url ?? '/',
    },
  }))
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
