// Service worker: makes the app open without internet and delivers updates.
// To ship an update, change VERSION — phones will offer "Доступна новая версия".
const VERSION = "1.0.10";
const CACHE = "zaryadki-" + VERSION;
const SHELL = ["./", "index.html", "privacy.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png",
  "fonts/onest-cyrillic.woff2", "fonts/onest-latin.woff2", "fonts/onest-latin-ext.woff2"];

self.addEventListener("install", e => {
  // cache: "reload" — straight from the server: the browser may keep an old index.html for 10 minutes
  // (GitHub Pages max-age=600), and the new version would otherwise store the old page
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("zaryadki-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // App files: from the cache first, so the app opens instantly and offline
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).catch(() => caches.match("index.html")))
  );
});
