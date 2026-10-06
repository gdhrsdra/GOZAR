// Service worker for گذر صدرا | منوی بوفه‌ها
// Strategy:
//  - Page navigations: network first, but if the network is slow (> NAV_TIMEOUT_MS)
//    or fails, fall back to the last cached copy so the site opens fast even on
//    weak connections and fully offline.
//  - Everything else (fonts, icons, scripts): stale-while-revalidate.
//
// Bump CACHE_NAME whenever you deploy a new version of index.html so old caches
// get cleared out automatically.
const CACHE_NAME = 'gozar-sadra-v15';
const NAV_TIMEOUT_MS = 4000;
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png',
  './apple-touch-icon.png', './favicon-32.png', './favicon-48.png'
];
// Third-party files the page needs to look right offline (fetched in CORS mode).
const EXTERNAL = [
  'https://unpkg.com/lucide@0.525.0/dist/umd/lucide.min.js',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all([
        ...APP_SHELL.map((u) => cache.add(u).catch(() => {})),
        ...EXTERNAL.map((u) => cache.add(new Request(u, { mode: 'cors' })).catch(() => {}))
      ])
    )
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
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  // Analytics / tag-manager traffic must never be served from (or stored in) the cache.
  if (url.pathname.startsWith('/gk7x') || url.hostname.endsWith('cloudflareinsights.com') || url.hostname.endsWith('googletagmanager.com')) return;

  // Page loads / navigations: network-first with a timeout, cache fallback.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const fromCache = () =>
        caches.match(req, { ignoreSearch: true }).then((c) => c || caches.match('./index.html')).then((c) => c || caches.match('./'));
      try {
        const res = await Promise.race([
          fetch(req),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NAV_TIMEOUT_MS))
        ]);
        if (res && res.ok) {
          const copy = res.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {}));
        }
        return res;
      } catch (e) {
        const cached = await fromCache();
        if (cached) return cached;
        return fetch(req); // nothing cached yet: let the browser show its own result
      }
    })());
    return;
  }

  // Everything else: stale-while-revalidate (only successful, readable responses are cached).
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
            const copy = res.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {}));
          }
          return res;
        })
        .catch(() => cached || Response.error());
      if (cached) event.waitUntil(fetchPromise.catch(() => {}));
      return cached || fetchPromise;
    })
  );
});
