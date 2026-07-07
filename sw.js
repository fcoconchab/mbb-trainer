/* ============================================================
   MBB Trainer — Service Worker
   Offline-first. Precaches the app shell; runtime-caches fonts.
   Bump CACHE_VERSION whenever index.html changes to force update.
   ============================================================ */
const CACHE_VERSION = 'mbb-trainer-v4';
const CORE_CACHE = CACHE_VERSION + '-core';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

/* Same-origin files that make up the app shell. */
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

/* Install: precache the shell. */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* Activate: drop old caches from previous versions. */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* Fetch strategy:
   - Navigations & same-origin core: cache-first, fall back to network, then to cached index.
   - Google Fonts (cross-origin): cache-first into a runtime cache (so the app keeps its
     typography offline after the first online load).
   - Everything else: network-first, fall back to cache. */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isFont =
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com';

  if (isFont) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(req).then((cached) =>
          cached ||
          fetch(req).then((res) => {
            cache.put(req, res.clone());
            return res;
          }).catch(() => cached)
        )
      )
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).catch(() =>
          /* If an uncached page request fails offline, serve the app shell. */
          req.mode === 'navigate' ? caches.match('./index.html') : undefined
        )
      )
    );
    return;
  }

  /* Other cross-origin: try network, fall back to any cache. */
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
