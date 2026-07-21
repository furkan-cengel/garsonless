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

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('navigate' in client) {
          return client.navigate(targetUrl).then(() => client.focus())
        }
        if ('focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    }),
  )
})
