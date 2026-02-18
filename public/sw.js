const CACHE_VERSION = "glass-v4";
const STATIC_CACHE = "glass-static-v4";
const RUNTIME_CACHE = "glass-runtime-v4";
const MAX_RUNTIME_ENTRIES = 80;

/* =========================================================
   Precache — core shell files cached on install
   ========================================================= */
const PRECACHE_URLS = [
  "/",
  "/login",
  "/offline",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/* =========================================================
   Install — precache core shell
   ========================================================= */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

/* =========================================================
   Activate — clean old caches
   ========================================================= */
self.addEventListener("activate", (event) => {
  const currentCaches = [STATIC_CACHE, RUNTIME_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !currentCaches.includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/* =========================================================
   Helpers
   ========================================================= */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxEntries);
  }
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/sounds/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js")
  );
}

function isNavigationRequest(request) {
  return (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html")
  );
}

/* =========================================================
   Fetch — smart caching strategies
   ========================================================= */
self.addEventListener("fetch", (event) => {
  // Skip non-GET
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip cross-origin (API backend, analytics, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip range requests
  if (event.request.headers.get("range")) return;

  // --- Strategy 1: Cache-first for static assets (JS, CSS, images, fonts) ---
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(event.request, clone);
              });
            }
            return response;
          }),
      ),
    );
    return;
  }

  // --- Strategy 2: Network-first for HTML pages ---
  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(event.request, clone);
              trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
            });
          }
          return response;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached || caches.match("/offline")),
        ),
    );
    return;
  }

  // --- Strategy 3: Network-first for everything else (Next.js data, etc.) ---
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.status !== 206) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, clone);
            trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
