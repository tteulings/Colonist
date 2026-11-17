// Network-first service worker: always try fresh files (the app updates often),
// fall back to the cache so the game still starts offline.
const CACHE = "colonist-v1911";
const SHELL = [
  "./", "./index.html", "./styles.css", "./manifest.webmanifest", "./assets/favicon.svg",
  "./themes/base.css", "./themes/theme-sunny.css", "./themes/theme-wood.css", "./themes/theme-silhouette.css", "./themes/theme-classic.css", "./themes/six.css", "./themes/seafarers.css", "./themes/hotseat.css", "./themes/stats.css", "./themes/review.css", "./themes/review-ai.css", "./themes/sunny-night.css", "./themes/sunny-dusk.css", "./themes/profiles.css", "./themes/history.css", "./src/history.js", "./themes/lessons.css", "./src/lessons.js", "./src/lessons-data.js", "./themes/bots.css", "./themes/coherence.css", "./themes/i18n.css", "./src/ui-icons.js", "./src/resources.js", "./src/bots-page.js", "./src/nav.js", "./src/bot-stats.js",
  "./lab.html", "./themes/lab.css", "./src/lab.js", "./src/lab-stats.js", "./src/lab-games.js", "./src/ai-analysis.js", "./src/ai-tree.js", "./src/ai-rules.js", "./src/bot-profiles.js", "./src/bot-profile-ui.js", "./src/master.js", "./src/master/sim.js", "./src/master/leaf-fit.js", "./src/master/leaf-gbm.js", "./src/master/leaf-gbm-model.js", "./src/master/leaf-gbm-sea-model.js", "./src/master/parallel.js", "./src/master/search.js", "./src/master/worker.js", "./src/master/dom.js",
  "./src/game.js", "./src/sound.js", "./src/six.js", "./src/six-ui.js", "./src/hotseat.js", "./src/names.js", "./src/stats.js", "./src/stats-ui.js", "./src/live-stats.js", "./src/live-bar.js", "./src/review.js", "./src/review-ui.js", "./src/review/detect.js", "./src/review/engine.js", "./src/review/evaluate.js", "./src/review/aims.js", "./src/review/score.js", "./src/review/bands.js", "./src/review/luck.js", "./src/review/luck-mc.js", "./src/review-luck.js", "./src/review-turn.js", "./src/review-again.js", "./src/review-refine.js", "./src/review-reasons.js", "./src/review/why-mc.js", "./src/review/pack.js", "./src/review-recap.js", "./src/review-ai.js", "./src/review/ai-facts.js", "./src/review/ai-tools.js", "./src/review/ai-blocks.js", "./src/review/ai-spots.js", "./src/review/ai-cause.js", "./src/review/ai-strat.js", "./src/review/ai-lang.js", "./src/review/ai-surprise.js", "./src/review/ai-shape.js", "./src/review/ai-mech.js", "./src/review/ledger.js", "./src/review/step-mc.js", "./src/review/ai-ledger.js", "./src/review/spot-names.js", "./src/review-ledger.js", "./src/review/ai-index.js", "./src/review/ai-page.js", "./src/review/ai-compose.js", "./src/review/ai-board.js", "./src/review-ai-page.js", "./src/review/recap-facts.js", "./src/review-explain.js", "./src/review/moment-facts.js", "./src/review/why.js", "./src/review-game.js", "./src/replay-odds.js", "./src/replay-odds-worker.js", "./src/i18n.js", "./src/i18n-nl.js", "./src/i18n-nl-ui.js", "./src/i18n-nl-set.js", "./src/i18n-nl-game.js", "./src/i18n-nl-review.js", "./src/i18n-nl-misc.js", "./src/i18n-nl-botslong.js", "./src/i18n-nl-more.js", "./src/i18n-nl-reason.js", "./src/i18n-nl-modes.js", "./src/i18n-nl-fix.js", "./src/i18n-nl-html.js", "./src/i18n-nl-step.js", "./src/i18n-nl-r2.js", "./src/themes/seats.js", "./src/themes/portraits.js",
  "./src/themes/manager.js", "./src/themes/art-util.js", "./src/themes/board-renderer.js",
  "./src/themes/fx.js", "./src/themes/daylight.js", "./src/themes/settings-ui.js", "./src/themes/onboarding.js", "./src/themes/home.js",
  "./src/themes/sunny/art.js", "./src/themes/sunny/ui-icons.js", "./src/themes/classic/art.js",
  "./src/themes/spec-util.js", "./src/themes/wood/art.js", "./src/themes/silhouette/art.js",
  "./src/seafarers/index.js", "./src/seafarers/rules.js", "./src/seafarers/ai.js", "./src/seafarers/ui.js", "./src/seafarers/render.js", "./src/seafarers/art.js", "./src/seafarers/scenario.js",
  "./assets/fonts/Outfit.woff2", "./assets/fonts/Figtree.woff2", "./assets/fonts/PlayfairDisplay.woff2", "./assets/fonts/SourceSans3.woff2", "./assets/fonts/WoodNumerals.woff2",
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

// v1.34: the page asks a new worker which version it brings (index.html), so a cold launch that already runs
// the new files offers no update; colonist-v184 → "1.34" (CACHE is bumped with APP_VERSION every release)
const VERSION = CACHE.replace(/^colonist-v(\d)(\d\d)(\d?)$/, (_, a, b, c) => `${a}.${b}${c ? "." + c : ""}`);
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "version" && event.ports[0]) event.ports[0].postMessage({ version: VERSION });
});

self.addEventListener("install", (event) => {
  // The shell is fetched past the HTTP cache too, or a fresh SW could precache stale files.
  // v1.91.1: cache.addAll() fails the whole install on one transient 5xx; fetch each file, retry the failures once
  // and only then give up (the old worker then stays and the next update check tries again). Only 200s are stored.
  const get = (cache, url) => fetch(new Request(url, { cache: "no-cache" })).then((r) => { if (!r.ok) throw new Error(r.status + " " + url); return cache.put(url, r); });
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    let bad = (await Promise.allSettled(SHELL.map((u) => get(cache, u)))).map((r, i) => (r.status === "rejected" ? SHELL[i] : null)).filter(Boolean);
    if (bad.length) bad = (await Promise.allSettled(bad.map((u) => get(cache, u)))).map((r, i) => (r.status === "rejected" ? bad[i] : null)).filter(Boolean);
    if (bad.length) throw new Error("shell incomplete: " + bad.join(" "));
  }).then(() => self.skipWaiting()));
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
  // v1.91.1: only a 200 is answered from the network. A 5xx/404 (a transient GitHub Pages hiccup, a deploy that has not
  // reached every edge yet) or a network error falls back to the cached copy, so one failed module fetch no longer
  // stops the app from starting; nothing but 200s is ever stored (never a 503 under a good file's name).
  const cached = () => caches.match(request, { ignoreSearch: true })
    .then((hit) => hit || (request.mode === "navigate" ? caches.match("./index.html") : undefined));
  event.respondWith(
    // Always revalidate with the server, never answer from the HTTP cache: GitHub Pages serves
    // everything with max-age=600, so a plain fetch() hands out the old index.html (and old
    // unversioned modules such as src/themes/*.js) for up to 10 minutes after a deploy.
    // no-cache still lets the server answer 304, so an unchanged file costs almost nothing.
    fetch(request, { cache: "no-cache" })
      .then((response) => {
        if (response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        }
        if (response.ok || response.status === 304) return response;
        return cached().then((hit) => hit || response); // not OK: the cached copy if there is one, else the error as it is
      })
      .catch(() => cached())
  );
});
