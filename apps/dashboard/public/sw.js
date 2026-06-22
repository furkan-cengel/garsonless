self.addEventListener('message', (event) => {
  if (event.data?.type !== 'NEW_ORDER') return

  const { title, body } = event.data

  self.registration.showNotification(title ?? 'New Order!', {
    body: body ?? '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: 'new-order',
    renotify: true,
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow('/')
    }),
  )
})
