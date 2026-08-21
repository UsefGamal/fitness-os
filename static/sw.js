// Minimal push-only service worker — no fetch interception, no offline
// asset caching, just "show a notification when a push arrives" and
// "focus/open the app when it's tapped". Registered from / (see
// main.py's /sw.js route) so its scope covers the whole app, not just
// /static/*, even though the file itself lives under static/ on disk.

self.addEventListener('push', function (event) {
  let data = { title: 'Fitness OS', body: 'You have a reminder.', url: '/' };
  try {
    if (event.data) data = event.data.json();
  } catch (err) {
    // Not JSON, or no payload — fall back to the defaults above rather
    // than show a broken/empty notification.
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Fitness OS', {
      body: data.body || '',
      icon: '/static/icons/icon-192.png',
      badge: '/static/icons/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
