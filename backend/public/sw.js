const CACHE_VERSION = 'stepquest-v0.1.1-alpha';
const CACHE_BUILD = 'v02-core-6';
const CACHE_NAME = `${CACHE_VERSION}-${CACHE_BUILD}-shell`;
const APP_SHELL = [
  '/',
  '/goals.html',
  '/assets/css/app.css?v=0.1.1-alpha&build=v02-core-6',
  '/assets/js/stepquest-v02-domain.js?v=0.1.1-alpha&build=v02-core-6',
  '/assets/js/stepquest-v02-storage.js?v=0.1.1-alpha&build=v02-core-6',
  '/assets/js/stepquest-v02-backup.js?v=0.1.1-alpha&build=v02-core-6',
  '/assets/js/stepquest-v02-character.js?v=0.1.1-alpha&build=v02-core-6',
  '/assets/js/stepquest-v02-media.js?v=0.1.1-alpha&build=v02-core-6',
  '/assets/js/stepquest-v02-fun.js?v=0.1.1-alpha&build=v02-core-6',
  '/assets/js/stepquest-v02-fx.js?v=0.1.1-alpha&build=v02-core-6',
  '/assets/js/app.js?v=0.1.1-alpha',
  '/assets/js/stepquest-v02-app.js?v=0.1.1-alpha&build=v02-core-6',
  '/assets/js/stepquest-v02-ui.js?v=0.1.1-alpha&build=v02-core-6',
  '/assets/js/stepquest-pwa-update.js?v=0.1.1-alpha&build=v02-core-6',
  '/assets/icons/stepquest.svg',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/goals.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/goals.html?reminder=1#today', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const matchingClient = clientList.find((client) => client.url.startsWith(self.location.origin));
        if (matchingClient) {
          matchingClient.navigate(targetUrl);
          return matchingClient.focus();
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
