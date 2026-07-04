/* App-shell service worker: caches static assets for fast loads on-site over
 * 4G. API requests are always network (data must be fresh); navigations fall
 * back to the cached shell when offline. */
const CACHE = "ob-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) return;

  // Static assets: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.match(/\.(svg|png|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Navigations: network-first with offline fallback to the cached shell.
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
  }
});
