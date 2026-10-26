// Network-first service worker: always try fresh files (the app updates often),
// fall back to the cache so the game still starts offline.
const CACHE = "colonist-v69";
const SHELL = [
  "./", "./index.html", "./styles.css", "./manifest.webmanifest", "./assets/favicon.svg",
  "./themes/base.css", "./themes/theme-sunny.css", "./themes/theme-classic.css",
  "./src/game.js", "./src/sound.js",
  "./src/themes/manager.js", "./src/themes/art-util.js", "./src/themes/board-renderer.js",
  "./src/themes/fx.js", "./src/themes/settings-ui.js", "./src/themes/onboarding.js",
  "./src/themes/sunny/art.js", "./src/themes/sunny/ui-icons.js", "./src/themes/classic/art.js",
];

self.addEventListener("install", (event) => {
  // The shell is fetched past the HTTP cache too, or a fresh SW could precache stale files
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: "no-cache" })))).then(() => self.skipWaiting()));
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
    // Always revalidate with the server, never answer from the HTTP cache: GitHub Pages serves
    // everything with max-age=600, so a plain fetch() hands out the old index.html (and old
    // unversioned modules such as src/themes/*.js) for up to 10 minutes after a deploy.
    // no-cache still lets the server answer 304, so an unchanged file costs almost nothing.
    fetch(request, { cache: "no-cache" })
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
