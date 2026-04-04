const CACHE_NAME = "mnm-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Purge ALL old caches on activation (covers redeployments)
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, API calls, and WebSocket upgrades
  if (request.method !== "GET" || url.pathname.startsWith("/api") || url.pathname.startsWith("/events")) {
    return;
  }

  // Never cache hashed assets — they have immutable HTTP cache headers already.
  // Caching them in the SW causes stale chunk errors after redeployment.
  if (url.pathname.startsWith("/assets/")) {
    return;
  }

  // Only handle navigation requests (HTML pages) — cache index.html as offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match("/") || new Response("Offline", { status: 503 }),
        ),
    );
  }
});
