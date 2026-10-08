/* Losto service worker - makes the whole app usable with no connection. */

const VERSION = "losto-v5";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const PAGE_CACHE = `${VERSION}-pages`;

/**
 * Every route is a fixed path (chat and study take their id from the query
 * string), so the whole app can be precached as a handful of documents.
 */
const SHELL = [
  "/",
  "/library",
  "/import",
  "/receive",
  "/chat",
  "/study",
  "/study/session",
  "/collections",
  "/search",
  "/settings",
  "/legal",
  "/offline",
  "/manifest.webmanifest",
  "/web-app-manifest-192x192.png",
  "/web-app-manifest-512x512.png",
  // Source marks. Cache-first would only hold one after it had been seen, and
  // a library installed on the train should show its icons on the first open.
  "/icons/chatgpt-icon.webp",
  "/icons/claude-ai-icon.webp",
  "/icons/google-gemini-icon.webp",
  "/icons/perplexity-ai-icon.webp",
  "/icons/grok-icon.webp",
  "/icons/deepseek-logo-icon.webp",
  "/icons/wikipedia-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(
        SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))),
      );
      // Only jump the queue on a first install. Taking over a page that is
      // already running would pull the build's hashed chunks out from under it.
      const existing = await self.clients.matchAll({ type: "window" });
      if (!existing.length) await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();

  /*
   * The page asks for large, optional files once it is idle - the diagram
   * renderer is over a megabyte, and holding up install for it would delay the
   * moment the app itself works offline. Same-origin paths only.
   */
  if (event.data?.type === "warm" && Array.isArray(event.data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        for (const path of event.data.urls) {
          if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) continue;
          if (await caches.match(path)) continue;
          try {
            await cache.add(path);
          } catch {
            /* offline or interrupted - the page asks again next time */
          }
        }
      })(),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Extraction always needs the network; never serve a stale conversation.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  // Hashed or versioned output is immutable - cache first, forever.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/vendor/")
  ) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  // React Server Component payloads for client-side navigation.
  if (url.searchParams.has("_rsc")) {
    event.respondWith(staleWhileRevalidate(request, PAGE_CACHE));
    return;
  }

  if (["style", "script", "font", "image"].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
  }
});

async function handleNavigation(request, url) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      // Key by pathname so /chat?id=a and /chat?id=b share one document.
      cache.put(new Request(url.origin + url.pathname), response.clone());
    }
    return response;
  } catch {
    const cached =
      (await caches.match(new Request(url.origin + url.pathname))) ??
      (await caches.match(request, { ignoreSearch: true }));
    if (cached) return cached;

    const offline = await caches.match("/offline");
    if (offline) return offline;

    return new Response("Offline", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const fallback = await caches.match(request, { ignoreSearch: true });
    if (fallback) return fallback;
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(cacheName);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;
  const response = await network;
  if (response) return response;
  return new Response("", { status: 504 });
}
