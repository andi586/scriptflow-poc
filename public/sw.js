self.addEventListener('push', (event) => {
  const data = event.data.json()
  const title = data.title || '🎬 Your Movie is Ready!'
  const body = data.body || 'Tap to watch your movie now'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon.png',
      badge: '/icon.png',
      data: { url: data.url }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data.url
  event.waitUntil(clients.openWindow(url))
})
