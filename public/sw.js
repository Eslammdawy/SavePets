/**
 * Street Pets Egypt — Service Worker (sw.js)
 *
 * Caching Strategy:
 * - Never cache `/api/post` or `/api/contact` (or any non-GET request).
 * - Network-first for `/api/list` and `/api/comments` (with cache fallback when offline, except when `?fresh=1`).
 * - Cache-first with background revalidation (stale-while-revalidate) for static app shell assets, fonts, and `/api/img`.
 */

const SHELL_CACHE = 'street-pets-shell-v1';
const DATA_CACHE = 'street-pets-data-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/fonts/cairo-arabic-wght-normal.woff2',
  '/fonts/cairo-latin-wght-normal.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== SHELL_CACHE && key !== DATA_CACHE) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never cache /api/post or /api/contact
  if (
    url.pathname.startsWith('/api/post') ||
    url.pathname.startsWith('/api/contact')
  ) {
    return;
  }

  // Network-first for /api/list and /api/comments
  if (
    url.pathname.startsWith('/api/list') ||
    url.pathname.startsWith('/api/comments')
  ) {
    const isFresh = url.searchParams.get('fresh') === '1';
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok && !isFresh) {
            const copy = res.clone();
            caches
              .open(DATA_CACHE)
              .then((cache) => cache.put(request, copy))
              .catch(() => {});
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          throw new Error('Network unavailable');
        })
    );
    return;
  }

  // App shell & static assets: stale-while-revalidate (with /index.html fallback for navigation)
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches
              .open(SHELL_CACHE)
              .then((cache) => cache.put(request, copy))
              .catch(() => {});
          }
          return res;
        })
        .catch(() => {
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return cached;
        });

      return cached || networkFetch;
    })
  );
});
