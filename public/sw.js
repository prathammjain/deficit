// Grain service worker — enables "Add to Home Screen" and an offline shell.
//
// Scope is deliberately narrow: only this origin's own build output is ever
// cached. The first version of this file intercepted every GET with a
// cache-first strategy, which meant Supabase REST reads were served from the
// Cache API. Writes are POSTs and always reached the network, so a read could
// return a stale day while the write that followed it succeeded — and because
// the log is stored as one JSON blob per day, that read-modify-write wrote
// back a day missing its newest entries. Logged meals were destroyed in
// storage, not merely hidden. API traffic must never be touched here.
//
// Note the Cache API is not the HTTP cache: it ignores Cache-Control
// entirely, so a `no-store` response still replays from it once stored.

const CACHE_NAME = 'deficit-v2';

/** Content-hashed build output — immutable, so cache-first is safe. */
const isImmutableAsset = (url) =>
  url.pathname.startsWith('/_expo/static/') ||
  url.pathname.startsWith('/assets/') ||
  url.pathname.startsWith('/icons/');

/** Store a copy without blocking the response. */
function cachePut(request, response) {
  if (!response || response.status !== 200) return;
  const clone = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
}

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  // Bumping CACHE_NAME above is what evicts the previous cache — including
  // any Supabase responses the old cache-everything strategy stored.
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const request = e.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Anything off this origin — Supabase auth, REST and Edge Functions — goes
  // straight to the network, untouched and uncached.
  if (url.origin !== self.location.origin) return;

  if (isImmutableAsset(url)) {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          cachePut(request, res);
          return res;
        });
      }),
    );
    return;
  }

  // Everything else — above all the HTML document, which names the current
  // bundle hash — is network-first, so a deploy is picked up on the next load
  // instead of lingering until the cache happens to refresh. The cached copy
  // is the offline fallback, not the default answer.
  e.respondWith(
    fetch(request)
      .then((res) => {
        cachePut(request, res);
        return res;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          throw new Error('offline and not cached');
        }),
      ),
  );
});
