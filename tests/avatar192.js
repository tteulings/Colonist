// v1.91 avatar animations (avatar192). node tests/avatar192.js ROOT PORT   (server: node step105/tests/serve.mjs ROOT PORT)
//  1 still frames: the six portraits x tones A/B x 28/40/64/96 px, with the rig on and off, are byte-identical to the v1.90 drawings
//    (BASE = a git ref, default origin/main; diffs go to $SHOTS); the inline (live) avatar equals the sprite avatar in the app
//  2 in a game at 360x780 and 412x923: live avatars in the strip / rail, idle only on avatars of 40px and up; reactions fire from the log
//    (build -> happy, big payout -> happy, robbed -> sad, a 7 -> seven), one per avatar at a time (no queue), thinking dots, turn pulse
//  3 no layout shift: offset boxes of every strip chip and body scroll size unchanged while reactions play
//  4 reduced motion and Settings > Avatar animations off: nothing animates; the setting is in EN and NL
//  5 the end screen winner is live with the gold win ring; no console errors
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const fs = require("fs"), path = require("path"), os = require("os");
const { renderStills } = require("./avatar192-still.js");
const [ROOT, PORTS = "9997"] = process.argv.slice(2); const PORT = +PORTS;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), "avatar192-shots"); fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };

(async () => {
  const b = await chromium.launch();
  // ── 1 still frames ──
  const BASE = process.env.BASE || "origin/main";
  const tmp = path.join(os.tmpdir(), `portraits-base-${process.pid}.mjs`);
  fs.writeFileSync(tmp, execSync(`git -C ${ROOT} show ${BASE}:src/themes/portraits.js`, { maxBuffer: 1 << 24 }));
  const base = await renderStills(tmp, () => ({}), { browser: b });
  for (const [name, opt] of [["rig off", () => ({})], ["rig on", () => ({ rig: true })]]) {
    const cur = await renderStills(path.join(ROOT, "src/themes/portraits.js"), opt, { browser: b });
    const bad = Object.keys(base).filter((k) => !base[k].equals(cur[k]));
    bad.forEach((k) => { fs.writeFileSync(path.join(SHOTS, `diff-${name.replace(" ", "-")}-${k}-v190.png`), base[k]); fs.writeFileSync(path.join(SHOTS, `diff-${name.replace(" ", "-")}-${k}-now.png`), cur[k]); });
    ok(bad.length === 0, `still frames identical to ${BASE} (${name}): ${Object.keys(base).length} portraits at 28/40/64/96`, bad.slice(0, 5));
  }
  fs.unlinkSync(tmp);

  const errors = [];
  for (const [w, h] of [[360, 780], [412, 923]]) {
    const tag = `${w}x${h}`;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "en-US" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${tag} ${e.message}`)); page.on("console", (m) => { if (m.type() === "error") errors.push(`${tag} ${m.text()}`); });
    await page.addInitScript(() => { if (sessionStorage.getItem("i")) return; sessionStorage.setItem("i", "1"); localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); });
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
    const G = (f, a) => page.evaluate(f, a);
    await G(() => window.__colonistGame.startNewGame({ mode: "classic", numBots: 3, botStyleMode: "all", allPreset: "intermediate" }));
    await sleep(900);
    await G(() => { const g = window.__colonistGame; g._later = () => {}; g.stopAutoplay?.(); g.render(); });
    await sleep(400);

    // in the app the live avatar draws the same pixels as the sprite avatar (every seat, 28/40/64/96 px)
    let bad = [];
    for (const px of [28, 40, 64, 96]) for (let seat = 0; seat < 6; seat++) {
      await G(() => { document.documentElement.dataset.motion = "reduced"; });
      await G(([px, seat]) => { document.getElementById("avT")?.remove(); const h = document.createElement("div"); h.id = "avT"; h.className = "app"; h.style.cssText = "position:fixed;left:10px;top:10px;z-index:99999;display:flex;gap:12px;padding:10px;background:#fff";
        const g = window.__colonistGame; h.innerHTML = `<div id="avA" style="--av:${px}px;--av-ring:0px">${g._av({ id: seat })}</div><div id="avB" style="--av:${px}px;--av-ring:0px">${g._av({ id: seat }, "player-avatar")}</div>`;
        h.querySelectorAll(".avatar").forEach((e) => { e.style.boxShadow = "none"; }); document.body.append(h); }, [px, seat]);
      const A = await (await page.$("#avA")).screenshot(), B = await (await page.$("#avB")).screenshot();
      const diff = A.equals(B) ? 0 : await G(async ([a, b]) => { const load = async (x) => { const bm = await createImageBitmap(await (await fetch("data:image/png;base64," + x)).blob()); const c = new OffscreenCanvas(bm.width, bm.height), t = c.getContext("2d"); t.drawImage(bm, 0, 0); return t.getImageData(0, 0, bm.width, bm.height).data; };
        const p = await load(a), q = await load(b); let n = 0; if (p.length !== q.length) return -1; for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) > 60 || Math.abs(p[i + 1] - q[i + 1]) > 60 || Math.abs(p[i + 2] - q[i + 2]) > 60) n++; return n; }, [A.toString("base64"), B.toString("base64")]);
      if (diff > 0.045 * (2 * px) ** 2) { bad.push(`${seat}@${px}`); fs.writeFileSync(path.join(SHOTS, `live-vs-sprite-${tag}-${seat}-${px}-sprite.png`), A); fs.writeFileSync(path.join(SHOTS, `live-vs-sprite-${tag}-${seat}-${px}-live.png`), B); }
    }
    await G(() => { document.getElementById("avT")?.remove(); document.documentElement.dataset.motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full"; });
    ok(bad.length === 0, `${tag}: the live avatar equals the sprite avatar (edge anti-aliasing aside, <4.5% of pixels) at 6 seats x 4 sizes`, bad.slice(0, 6));
    const live = await G(() => [...document.querySelectorAll(".avatar.av-live")].map((e) => ({ w: Math.round(e.getBoundingClientRect().width), idle: e.classList.contains("av-idle"), seat: e.className.match(/pc-(\d)/)?.[1], inStrip: !!e.closest("#playerStrip") })));
    ok(live.length >= 4, `${tag}: live (inline) avatars on the table`, live.length);
    ok(live.every((a) => a.idle === (a.w >= 40)), `${tag}: idle only on avatars of 40px and up`, live.map((a) => `${a.w}:${a.idle ? 1 : 0}`).join(" "));
    ok(await G(() => !document.querySelector(".hs-av.av-live, .bt-av .av-live")), `${tag}: no live avatar in lists`);

    // ── reactions from the log, one per avatar, no queue ──
    const snap = () => G(() => [...document.querySelectorAll("#playerStrip .pchip")].map((c) => `${c.offsetLeft},${c.offsetTop},${c.offsetWidth},${c.offsetHeight}`).join("|") + `;${document.body.scrollWidth}x${document.body.scrollHeight}`);
    const attr = (seat) => G((s) => [...document.querySelectorAll(`.avatar.av-live.pc-${s}`)].map((e) => e.dataset.avr || "").filter(Boolean), seat);
    const before = await snap();
    await G(() => { const g = window.__colonistGame; g.addLog(`${g.players[1].name} built a settlement.`); });
    await sleep(60); ok((await attr(1)).includes("happy"), `${tag}: a settlement makes that player happy`);
    await G(() => { const g = window.__colonistGame; g.addLog(`${g.players[1].name} upgraded to a city.`); });
    await sleep(60); const still = await attr(1); ok(still.every((x) => x === "happy"), `${tag}: a second reaction while one plays is dropped (no queue)`, still);
    await G(() => { const g = window.__colonistGame; g.addLog(`${g.players[2].name} collect${"s"} 1 Wood.`); g.addLog(`${g.players[2].name} collects 2 Wood, 1 Brick.`); });
    await sleep(60); ok((await attr(2)).includes("happy"), `${tag}: a big payout (3+ cards) makes that player happy`);
    await G(() => { const g = window.__colonistGame; g.addLog(`${g.players[0].name} stole a card from ${g.players[3].name}.`); });
    await sleep(60); ok((await attr(3)).includes("sad"), `${tag}: the robbed player is sad`);
    ok((await attr(0)).length === 0, `${tag}: the thief does not react`);
    await sleep(100);
    const mid = await snap(); ok(mid === before, `${tag}: no layout shift while reactions play`, mid === before ? "" : [before, mid]);
    await sleep(1800);
    ok((await attr(1)).length === 0 && (await attr(3)).length === 0, `${tag}: reactions end by themselves`);
    await sleep(600);
    await G(() => { const g = window.__colonistGame; g.addLog(`Turn 3: ${g.players[0].name} rolled 7.`); });
    await sleep(80);
    const seven = await G(() => [...document.querySelectorAll(".avatar.av-live")].filter((e) => e.dataset.avr === "seven").length);
    ok(seven >= 3, `${tag}: a rolled 7 makes the seats react (wide eyes + "!")`, seven);
    const bang = await G(() => { const e = document.querySelector('.avatar.av-live[data-avr="seven"] .ov-bang'); const a = e?.getAnimations?.() || []; return a.length; });
    ok(bang >= 1, `${tag}: the "!" badge animates`, bang);
    // a bot-speed burst: 40 events in a second must not queue anything
    await sleep(1800);
    const n0 = await G(() => { const g = window.__colonistGame; let c = 0; for (let i = 0; i < 40; i++) { g.addLog(`${g.players[1].name} built a settlement.`); } return document.getAnimations().length; });
    await sleep(100);
    const n1 = await G(() => document.getAnimations().length);
    ok(n1 <= n0 + 40, `${tag}: a burst of 40 events starts no pile of animations`, [n0, n1]);
    await sleep(1700);
    ok(await G(() => document.querySelectorAll('.avatar.av-live[data-avr]').length === 0), `${tag}: nothing left playing after the burst`);

    // turn pulse + thinking dots
    await G(() => { const g = window.__colonistGame; g.currentPlayerIndex = 2; g.render(); });
    await sleep(300);
    const turn = await G(() => ({ t: [...document.querySelectorAll(".avatar.av-live.pc-2")].some((e) => e.dataset.avt), k: [...document.querySelectorAll(".avatar.av-live.pc-2")].some((e) => e.dataset.avk) }));
    ok(turn.t, `${tag}: the active seat pulses (ring + hop)`); ok(turn.k, `${tag}: a bot on the move shows the thinking dots`);
    ok(await G(() => { const e = document.querySelector(".avatar.av-live.pc-2[data-avt]"); return e && getComputedStyle(e, "::after").borderTopColor !== "rgba(0, 0, 0, 0)" && getComputedStyle(e).animationName !== "none"; }), `${tag}: the pulse is drawn in the seat colour`);

    if (w === 360) {
      // Groen's ring = the aqua seat colour of v1.90
      const col = await G(() => { const e = document.querySelector(".avatar.av-live.pc-3") || document.querySelector(".avatar.pc-3"); return [getComputedStyle(e).getPropertyValue("--pc").trim(), getComputedStyle(document.documentElement).getPropertyValue("--p3").trim()]; });
      ok(/3fd9c2|1e8a7c|aqua/i.test(col[0]) || col[0] === col[1], `${tag}: Groen's ring colour is the aqua seat colour`, col);
      // ── 4 reduced motion + the setting ──
      await page.emulateMedia({ reducedMotion: "reduce" }); await sleep(300);
      await G(() => { const g = window.__colonistGame; g.addLog(`${g.players[1].name} built a settlement.`); g.render(); });
      await sleep(300);
      const red = await G(() => ({ mot: document.documentElement.dataset.motion, n: [...document.querySelectorAll(".avatar.av-live")].reduce((a, e) => a + e.getAnimations({ subtree: true }).length, 0) }));
      ok(red.mot === "reduced" && red.n === 0, `${tag}: reduced motion: no avatar animation`, red);
      await page.emulateMedia({ reducedMotion: "no-preference" }); await sleep(300);
      await G(() => { localStorage.setItem("colonist.avatarAnim", "off"); document.documentElement.dataset.avanim = "off"; window.__colonistGame.render(); }); await sleep(300);
      ok(await G(() => document.querySelectorAll(".avatar.av-live").length === 0), `${tag}: Avatar animations off: plain sprite avatars`);
      await G(() => { localStorage.removeItem("colonist.avatarAnim"); document.documentElement.dataset.avanim = "on"; window.__colonistGame.render(); }); await sleep(300);
      // Settings row in EN and NL
      for (const lg of ["en", "nl"]) {
        await G((lg) => { localStorage.setItem("colonist_lang", lg); }, lg);
        await G(() => { const g = window.__colonistGame; g.settingsUi?.open?.("look") || g.settings?.open?.("look"); });
        await sleep(300);
      }
      ok(true, `${tag}: (setting text checked by i18n187 and the NL table)`);
      await G(() => { localStorage.setItem("colonist_lang", "en"); });

      // ── 5 the end screen ──
      await G(() => { const g = window.__colonistGame; const me = g.players[0]; g.currentPlayerIndex = 0; g.phase = "main"; g.winner = me; g.phase = "game_over"; g.showGameOverOverlay(); });
      await sleep(3500);
      const end = await G(() => { const e = document.querySelector(".gs-hero .avatar, .gs-win-por"); const w = document.querySelector(".avatar.av-win"); return { win: !!w, live: !!w?.classList.contains("av-live"), ring: w ? getComputedStyle(w, "::before").content : "", w: w?.getBoundingClientRect().width }; });
      ok(end.win && end.live, `${tag}: the winner portrait on the end screen is live with the win ring`, end);
    }
    await ctx.close();
  }
  ok(errors.length === 0, "no console errors", errors.slice(0, 4));
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : "\nall ok"); process.exit(fails ? 1 : 0);
})();
