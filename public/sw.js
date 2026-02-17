const CACHE_NAME = "glass-v2";
const MAX_CACHE_ENTRIES = 100;
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Install — cache shell
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

// Helper: trim cache to max entries
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxEntries);
  }
}

// Fetch — network first, fallback to cache
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip API calls and authenticated backend requests
  if (url.pathname.startsWith("/api")) return;
  if (url.origin !== self.location.origin) return;

  // Skip partial responses (e.g., range requests for audio/video)
  if (event.request.headers.get("range")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful, complete responses
        if (response.ok && response.status !== 206) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
            trimCache(CACHE_NAME, MAX_CACHE_ENTRIES);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
