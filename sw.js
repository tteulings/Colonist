// Network-first service worker: always try fresh files (the app updates often),
// fall back to the cache so the game still starts offline.
const CACHE = "colonist-v75";
const SHELL = [
  "./", "./index.html", "./styles.css", "./manifest.webmanifest", "./assets/favicon.svg",
  "./themes/base.css", "./themes/theme-sunny.css", "./themes/theme-wood.css", "./themes/theme-silhouette.css", "./themes/theme-classic.css", "./themes/six.css", "./themes/seafarers.css",
  "./src/game.js", "./src/sound.js", "./src/six.js", "./src/six-ui.js", "./src/themes/seats.js",
  "./src/themes/manager.js", "./src/themes/art-util.js", "./src/themes/board-renderer.js",
  "./src/themes/fx.js", "./src/themes/settings-ui.js", "./src/themes/onboarding.js", "./src/themes/home.js",
  "./src/themes/sunny/art.js", "./src/themes/sunny/ui-icons.js", "./src/themes/classic/art.js",
  "./src/themes/spec-util.js", "./src/themes/wood/art.js", "./src/themes/silhouette/art.js",
  "./src/seafarers/index.js", "./src/seafarers/rules.js", "./src/seafarers/ai.js", "./src/seafarers/ui.js", "./src/seafarers/render.js", "./src/seafarers/art.js", "./src/seafarers/scenario.js",
  "./assets/fonts/PlayfairDisplay.woff2", "./assets/fonts/SourceSans3.woff2", "./assets/fonts/WoodNumerals.woff2",
  "./assets/fonts/Kalam-700.woff2", "./assets/fonts/AlegreyaSans-500.woff2", "./assets/fonts/AlegreyaSans-700.woff2", "./assets/fonts/AlegreyaSans-800.woff2",
  "./assets/icons/resource-wood-v3.svg", "./assets/icons/resource-brick-v2.svg", "./assets/icons/resource-sheep-v2.svg",
  "./assets/icons/resource-wheat-v2.svg", "./assets/icons/resource-ore-v2.svg",
  "./assets/icons/dev-knight.svg", "./assets/icons/dev-monopoly.svg", "./assets/icons/dev-road-building.svg",
  "./assets/icons/dev-year-of-plenty.svg",
  "./assets/icons/ui-bot-turns.svg", "./assets/icons/ui-build.svg", "./assets/icons/ui-dice.svg",
  "./assets/icons/ui-end-turn.svg", "./assets/icons/ui-logo.svg", "./assets/icons/ui-trade.svg",
  "./assets/avatars/avatar-human.svg", "./assets/avatars/avatar-pioneer.svg", "./assets/avatars/avatar-sage.svg",
  "./assets/avatars/avatar-vector.svg", "./assets/pwa/apple-touch-icon.png", "./assets/pwa/icon-192.png",
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
