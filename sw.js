// Service worker for گذر صدرا | منوی بوفه‌ها
// Strategy:
//  - Page navigations: try the network first (so visitors always get the latest
//    menu when online); if the network fails, fall back to whatever copy of the
//    page was last cached, so the site still opens with no internet.
//  - Everything else (fonts, icons, scripts): serve the cached copy instantly if
//    we have one, while quietly re-fetching in the background to keep the cache
//    fresh for next time ("stale-while-revalidate").
//
// Bump CACHE_NAME whenever you deploy a new version of index.html so old caches
// get cleared out automatically.
const CACHE_NAME = 'gozar-sadra-v1';
const APP_SHELL = [
  './',
  './index.html'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Page loads / navigations: network-first, cache fallback (works offline).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Everything else: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
