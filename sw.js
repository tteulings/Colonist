// Network-first service worker: always try fresh files (the app updates often),
// fall back to the cache so the game still starts offline.
const CACHE = "colonist-v66";
const SHELL = [
  "./", "./index.html", "./styles.css", "./manifest.webmanifest", "./assets/favicon.svg",
  "./themes/base.css", "./themes/theme-sunny.css", "./themes/theme-classic.css",
  "./src/game.js",
  "./src/themes/manager.js", "./src/themes/art-util.js", "./src/themes/board-renderer.js",
  "./src/themes/fx.js", "./src/themes/settings-ui.js",
  "./src/themes/sunny/art.js", "./src/themes/classic/art.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then((hit) => hit || (request.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});
