// node scripts/test-bot-profiles.mjs — Settings › Bots preset highlight + profile data sanity.
// AI_PRESETS is read from src/game.js itself (game.js needs a DOM to import), so the test follows the real table.
import fs from "node:fs";
import assert from "node:assert/strict";
import { presetHighlight, BOT_PROFILES, profileArt, profileMini, levelFrame } from "../src/bot-profiles.js";

const src = fs.readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const block = src.match(/const AI_PRESETS = (\{[\s\S]*?\n\});/)[1].replace(/\/\/.*$/gm, "");
const AI_PRESETS = Function(`return (${block});`)();
const AXES = ["placement", "expansion", "trading", "devCards", "awareness"];
let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log("ok", name); };

t("every preset lights its own chip", () => {
  for (const k of Object.keys(AI_PRESETS)) assert.equal(presetHighlight([{ ...AI_PRESETS[k] }], AI_PRESETS, AXES).active, k);
});
t("the user's screenshot: Medium/Medium/Balanced/Reactive/Basic is Intermediate", () => {
  const s = { placement: "medium", expansion: "medium", trading: "balanced", devCards: "reactive", awareness: "basic" };
  assert.deepEqual(presetHighlight([s, { ...s }, { ...s }], AI_PRESETS, AXES), { active: "intermediate", closest: null, mixed: false });
});
t("Beginner and Simple share the dials; the policy tells them apart", () => {
  assert.equal(presetHighlight([{ ...AI_PRESETS.beginner }], AI_PRESETS, AXES).active, "beginner");
  assert.equal(presetHighlight([{ ...AI_PRESETS.simple }], AI_PRESETS, AXES).active, "simple");
  assert.equal(presetHighlight([{ ...AI_PRESETS.expert, policy: "master" }], AI_PRESETS, AXES).active, "master");
});
t("a hand-tuned mix is Custom with the closest preset", () => {
  const h = presetHighlight([{ ...AI_PRESETS.expert, trading: "aggressive" }], AI_PRESETS, AXES);
  assert.equal(h.active, "custom");
  assert.equal(h.closest, "expert");
});
t("bots that differ light nothing and say so", () => {
  const h = presetHighlight([{ ...AI_PRESETS.trader }, { ...AI_PRESETS.shark }], AI_PRESETS, AXES);
  assert.deepEqual(h, { active: null, closest: null, mixed: true });
});
t("no bots (pass & play table)", () => assert.equal(presetHighlight([], AI_PRESETS, AXES).active, null));
t("a profile, an illustration (< 3 KB), a mini and a frame for every preset", () => {
  for (const k of Object.keys(AI_PRESETS)) {
    const p = BOT_PROFILES[k];
    assert.ok(p && p.style && p.good && p.weak && p.beat && p.trades && p.robber, k);
    const art = profileArt(k, 72);
    assert.ok(art.length < 3072, `${k} art ${art.length} bytes`);
    assert.ok(profileMini(k).length < 1200 && levelFrame(k).includes("<svg"), k);
  }
});
// bot-125: Master, Super Expert and Super Expert+ are measured against 3 Intermediates; the profile's figure is bot-stats.js's
const STATS = (await import("../src/bot-stats.js")).BOT_STATS;
t("Master, Super Expert, Super Expert+: measured vs 3 Intermediates, the profile figure equals bot-stats.js, no estimate or early test left", () => {
  for (const k of ["master", "super", "superplus"]) {
    const w = STATS[k].win;
    assert.equal(w.label, "measured", k); assert.ok(w.n >= 300 && w.ci > 0 && w.code && w.date && w.setup, k);
    assert.deepEqual(BOT_PROFILES[k].win, { p: w.v, ci: w.ci }, k);
  }
  assert.ok(!Object.values(STATS).some((x) => ["estimate", "early test"].includes(x.win.label)));
  assert.match(STATS.super.win.src + STATS.superplus.win.src, /No time limit/);
  assert.match(STATS.superplus.win.src, /Head to head/); assert.ok(STATS.superplus.h2h.n > 0);
  assert.match(BOT_PROFILES.master.good, /percentage points more than the Expert/);
});
t("frames: every tier looks different (silver is a double band, shark has a fin, master a star)", () => {
  const f = (k) => levelFrame(k, 40);
  const set = new Set(Object.keys(AI_PRESETS).map(f));
  assert.ok(set.size >= 7); // beginner and simple share the plain ring on purpose
  assert.ok(f("shark").includes("M56,12") && f("master").includes("L"));
  assert.ok(f("intermediate").length > f("beginner").length * 2);
});
t("preset cards: one lit card per bot (its own preset), a mix outlines the closest, all-bots differing lights none", () => {
  const bots = [{ ...AI_PRESETS.intermediate }, { ...AI_PRESETS.shark }];
  assert.equal(presetHighlight([bots[0]], AI_PRESETS, AXES).active, "intermediate");
  assert.equal(presetHighlight([bots[1]], AI_PRESETS, AXES).active, "shark");
  assert.equal(presetHighlight(bots, AI_PRESETS, AXES).mixed, true);
  const picked = { ...bots[1] }; delete picked.policy; Object.assign(picked, AI_PRESETS.builder); // tapping a card
  assert.equal(presetHighlight([picked], AI_PRESETS, AXES).active, "builder");
});
t("Settings › Bots wires one card per preset, a picked bot and the (i) sheet", () => {
  const ui = fs.readFileSync(new URL("../src/bot-profile-ui.js", import.meta.url), "utf8");
  const game = fs.readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
  assert.ok(ui.includes("export function presetCards") && ui.includes('openProfileSheet(game, { key: i.dataset.info })'));
  assert.ok(game.includes("presetCards(this, byStrength(Object.keys(AI_PRESETS))") && game.includes("this._botSel") && game.includes("DIAL_WORDS")); // lab-131: strongest first
  for (const k of Object.keys(AI_PRESETS)) assert.ok(BOT_PROFILES[k].tagline && BOT_PROFILES[k].level >= 1, k);
});
t("Super Expert: own policy, own chip, a 6th mark, a measured win figure, two-star frame, art < 3 KB", () => {
  assert.equal(AI_PRESETS.super.policy, "super");
  assert.equal(presetHighlight([{ ...AI_PRESETS.super }], AI_PRESETS, AXES).active, "super");
  assert.equal(presetHighlight([{ ...AI_PRESETS.master }], AI_PRESETS, AXES).active, "master"); // same dials, other policy
  const p = BOT_PROFILES.super;
  assert.ok(p.win); assert.equal(p.level, 5); assert.ok(p.beyond);
  assert.match(p.weak, /Rush it has a quarter of a second/); assert.match(p.weak, /In Seafarers it searches too/); assert.match(p.weak, /3 seconds/);
  assert.ok(profileArt("super", 132).length < 3072);
  assert.notEqual(levelFrame("super"), levelFrame("master"));
  assert.ok((levelFrame("super").match(/<path/g) || []).length > (levelFrame("master").match(/<path/g) || []).length);
});
t("the search budgets: Master 100 / 0.5 s, Super 1000 / 3 s / 14 deep / 18 in set-up, early stop", async () => {
  const m = fs.readFileSync(new URL("../src/master.js", import.meta.url), "utf8");
  assert.match(m, /SUPER_BUDGET = \{ n: 1000, timeMs: 3000, timeSlice: true, depth: 14, setupDepth: 18/);
  assert.match(m, /MASTER_BUDGET = \{ n: 100, timeMs: 500 \}/);
});
t("Super Expert+ (bot-125): own policy and chip, the Super Expert's budget with the gbm leaf (Rush too), searched, own frame and mini", () => {
  assert.equal(AI_PRESETS.superplus.policy, "superplus");
  assert.equal(presetHighlight([{ ...AI_PRESETS.superplus }], AI_PRESETS, AXES).active, "superplus");
  assert.equal(presetHighlight([{ ...AI_PRESETS.super }], AI_PRESETS, AXES).active, "super");
  const p = BOT_PROFILES.superplus;
  assert.ok(p.win); assert.equal(p.level, 5); assert.ok(p.beyond);
  assert.match(p.weak, /at most 3 s/); assert.match(p.note, /not measured what that does/); assert.match(p.weak, /In Seafarers it searches too/); assert.match(p.weak, /3 seconds/);
  assert.ok(profileArt("superplus", 132).length < 3072);
  assert.notEqual(levelFrame("superplus"), levelFrame("super"));
  assert.notEqual(profileMini("superplus"), profileMini("super"));
});
t("lab-131 pickers: strongest first by the measured win chance (bot-stats.js); dots follow that order, the Supers carry the star", async () => {
  const { byStrength, winOf } = await import("../src/bot-stats.js");
  const order = byStrength(Object.keys(AI_PRESETS));
  assert.deepEqual(order, ["superplus", "super", "master", "expert", "builder", "trader", "shark", "intermediate", "beginner", "simple"]);
  assert.deepEqual(byStrength(["simple", "newbot", "expert"]), ["newbot", "expert", "simple"]); // no figure yet: first
  for (let i = 1; i < order.length; i += 1) {
    const a = BOT_PROFILES[order[i - 1]], b = BOT_PROFILES[order[i]];
    assert.ok(a.level + (a.beyond ? 0.5 : 0) >= b.level + (b.beyond ? 0.5 : 0), `${order[i - 1]} >= ${order[i]}`);
    assert.ok(winOf(order[i - 1]).v >= winOf(order[i]).v);
  }
  assert.ok(BOT_PROFILES.super.beyond && BOT_PROFILES.superplus.beyond && !BOT_PROFILES.master.beyond);
  const lab = fs.readFileSync(new URL("../src/lab.js", import.meta.url), "utf8");
  assert.ok(lab.includes("byStrength(Object.keys(H.AI_PRESETS))") && lab.includes('<i class="star"></i>'));
});
const M = await import("../src/master.js");
t("budgetFor: Super Expert+ = Super Expert + leaf gbm; Rush = RUSH_BUDGET + leaf gbm; Master and Super Expert unchanged (leaf v1)", () => {
  assert.deepEqual(M.budgetFor("superplus"), { ...M.SUPER_BUDGET, leaf: "gbm" });
  assert.deepEqual(M.budgetFor("superplus", true), { ...M.RUSH_BUDGET, leaf: "gbm" });
  assert.deepEqual(M.budgetFor("super"), M.SUPER_BUDGET); assert.equal(M.budgetFor("super").leaf, undefined);
  assert.deepEqual(M.budgetFor("master"), M.MASTER_BUDGET); assert.deepEqual(M.budgetFor("master", true), M.RUSH_BUDGET);
  assert.ok(M.isSearchPolicy("superplus") && M.isSearchPolicy("super") && M.isSearchPolicy("master") && !M.isSearchPolicy("score"));
});
t("Grandmaster (eng-130): own policy and chip, the Super Expert+ budget with a higher rollout cap, several workers, Seafarers leaf, own frame and mini", () => {
  assert.equal(AI_PRESETS.grandmaster, undefined); // not released: only behind the flag
  assert.match(src, /if \(gmFlag\(\)\) AI_PRESETS\.grandmaster = \{ \.\.\.GM_PRESET \}/);
  const GP = { ...AI_PRESETS, grandmaster: { placement: "complex", expansion: "complex", trading: "balanced", devCards: "strategic", awareness: "advanced", policy: "grandmaster" } };
  assert.equal(presetHighlight([{ ...GP.grandmaster }], GP, AXES).active, "grandmaster");
  const p = BOT_PROFILES.grandmaster;
  assert.equal(p.level, 5); assert.ok(p.beyond); assert.match(p.style, /several cores/);
  assert.ok(profileArt("grandmaster", 132).length < 4096);
  assert.notEqual(levelFrame("grandmaster"), levelFrame("superplus"));
  assert.notEqual(profileMini("grandmaster"), profileMini("superplus"));
  assert.deepEqual(M.budgetFor("grandmaster"), { ...M.SUPER_BUDGET, leaf: "gbm", n: 3000 });
  assert.deepEqual(M.budgetFor("grandmaster", true), { ...M.RUSH_BUDGET, leaf: "gbm" });
  assert.equal(M.budgetFor("master", false, true).leaf, M.SEA_LEAF); assert.equal(M.budgetFor("super", false, true).leaf, M.SEA_LEAF);
  assert.ok(M.isSearchPolicy("grandmaster") && M.isSuperPolicy("grandmaster") && !M.isSuperPolicy("master"));
  assert.ok(M.GM_WORKERS() >= 1 && M.GM_WORKERS() <= 3);
});
for (const file of ["bot-profile-ui.js", "game.js", "six-ui.js"]) {
  const text = fs.readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
  t(`${file} imports only files that exist`, () => {
    for (const m of text.matchAll(/from "\.\/([\w\/.-]+)"/g)) assert.ok(fs.existsSync(new URL(`../src/${m[1]}`, import.meta.url)), m[1]);
  });
}
console.log(`${n} passed`);
