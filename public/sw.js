/* docsmelt service worker — offline-first after one visit.
 *
 * Strategy:
 *  - install: precache the shell (HTML + hashed chunks + css + fonts)
 *    listed in /sw-manifest.json (generated post-build). The wasm engine
 *    is NOT precached — it's cached lazily on first fetch, so a first-time
 *    install doesn't download 6.5 MB up front.
 *  - fetch: navigations are network-first with an offline fallback to the
 *    cached shell; hashed static assets (incl. the wasm + worker chunk)
 *    are cache-first with runtime caching — a repeat visitor converts
 *    fully offline.
 */
const CACHE = "docsmelt-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    fetch("/sw-manifest.json")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("no manifest"))))
      .then(async (manifest) => {
        const cache = await caches.open(CACHE);
        await cache.addAll(["/", ...(manifest.assets ?? [])]);
        return self.skipWaiting();
      })
      .catch(() => self.skipWaiting()),
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
    // Network-first so updates land, shell fallback for offline.
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

  if (url.pathname.startsWith("/_next/static/")) {
    // Hashed, immutable: cache-first with runtime fill.
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
    return;
  }

  // Everything else same-origin (manifest, icons): stale-while-revalidate.
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
