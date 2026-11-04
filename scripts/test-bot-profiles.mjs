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
console.log(`${n} passed`);
