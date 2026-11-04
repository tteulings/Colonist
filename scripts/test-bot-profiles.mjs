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
t("Master shows no win figure against Intermediate (only +8.4 pp vs Expert, n=500)", () => {
  assert.equal(BOT_PROFILES.master.win, null);
  assert.match(BOT_PROFILES.master.good, /8\.4 percentage points/);
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
  assert.ok(game.includes("presetCards(this, Object.keys(AI_PRESETS)") && game.includes("this._botSel") && game.includes("DIAL_WORDS"));
  for (const k of Object.keys(AI_PRESETS)) assert.ok(BOT_PROFILES[k].tagline && BOT_PROFILES[k].level >= 1, k);
});
t("Super Expert: own policy, own chip, a 6th mark, no win figure, two-star frame, art < 3 KB", () => {
  assert.equal(AI_PRESETS.super.policy, "super");
  assert.equal(presetHighlight([{ ...AI_PRESETS.super }], AI_PRESETS, AXES).active, "super");
  assert.equal(presetHighlight([{ ...AI_PRESETS.master }], AI_PRESETS, AXES).active, "master"); // same dials, other policy
  const p = BOT_PROFILES.super;
  assert.equal(p.win, null); assert.equal(p.level, 5); assert.ok(p.beyond);
  assert.match(p.weak, /Rush it has a quarter of a second/); assert.match(p.weak, /Seafarers it plays exactly like the Expert|in Seafarers it plays exactly like the Expert/); assert.match(p.weak, /3 seconds/);
  assert.ok(profileArt("super", 132).length < 3072);
  assert.notEqual(levelFrame("super"), levelFrame("master"));
  assert.ok((levelFrame("super").match(/<path/g) || []).length > (levelFrame("master").match(/<path/g) || []).length);
});
t("the search budgets: Master 100 / 0.5 s, Super 1000 / 3 s / 14 deep / 18 in set-up, early stop", async () => {
  const m = fs.readFileSync(new URL("../src/master.js", import.meta.url), "utf8");
  assert.match(m, /SUPER_BUDGET = \{ n: 1000, timeMs: 3000, timeSlice: true, depth: 14, setupDepth: 18/);
  assert.match(m, /MASTER_BUDGET = \{ n: 100, timeMs: 500 \}/);
});
for (const file of ["bot-profile-ui.js", "game.js", "six-ui.js"]) {
  const text = fs.readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
  t(`${file} imports only files that exist`, () => {
    for (const m of text.matchAll(/from "\.\/([\w\/.-]+)"/g)) assert.ok(fs.existsSync(new URL(`../src/${m[1]}`, import.meta.url)), m[1]);
  });
}
console.log(`${n} passed`);
