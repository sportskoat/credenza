// Credenza service worker: precached app shell + network-first runtime cache.
// PRECACHE below is stamped with the hashed build assets at build time
// (see swPrecache in vite.config.js), so the shell, fonts, and icons are
// available offline immediately after install. A new build produces a new
// worker (different asset hashes), which waits until the app posts
// SKIP_WAITING — the app surfaces that as an explicit "Update ready · Restart"
// notification instead of swapping code mid-session.
const PRECACHE = self.__PRECACHE_MANIFEST__;
const CACHE = "credenza-" + (Array.isArray(PRECACHE) ? hashOf(PRECACHE.join("|")) : "dev");

function hashOf(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

self.addEventListener("install", (e) => {
  if (!Array.isArray(PRECACHE)) return; // dev: placeholder not stamped
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("credenza-") && k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
);

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // favicons, thumbnails: straight through
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(e.request, { ignoreSearch: e.request.mode === "navigate" });
        if (hit) return hit;
        if (e.request.mode === "navigate") {
          const shell = await cache.match("/index.html");
          if (shell) return shell;
        }
        throw err;
      }
    })
  );
});
