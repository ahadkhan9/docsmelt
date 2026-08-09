/* docsmelt service worker — offline-first after one visit.
 *
 * Strategy: cache-on-fetch, no precache manifest, no build hooks.
 *  - install: cache the shell HTML only (instant, no big downloads).
 *  - fetch: same-origin GETs are cache-first with runtime fill — one page
 *    load caches the shell and all hashed chunks; the first conversion
 *    caches the 6.5 MB wasm lazily (never paid up front). A repeat
 *    visitor converts fully offline.
 *  - navigations are network-first so updates land, with the cached shell
 *    as the offline fallback.
 */
const CACHE = "docsmelt-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add("/"))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then((hit) => hit || caches.match(request))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
