// §100 (6. okt 2026): push notification handler for the service worker.
// Imported by workbox via importScripts in vite.config.ts.

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const title = payload.title || "LAGO CRM";
    const options = {
      body: payload.body || "",
      icon: "/logo-192.png",
      badge: "/logo-192.png",
      tag: payload.tag || undefined,
      data: { url: payload.url || "/" },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("Push handler error:", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if possible
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window
        return self.clients.openWindow(url);
      }),
  );
});
