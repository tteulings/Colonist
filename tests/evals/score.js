// evalPage(spec, F, opts) -> { id, tags, checks: { name: { pass, why: [...] } }, passed, total }
//   spec: a page spec { headline, widgets, follow } as the recipes / an LLM return it (raw, before validatePage).
//   F: a fixture (tests/evals/fixtures/*.json). opts.lang: expected language "en" | "nl" (default: spec.lang or "en").
// Checks (all pass/fail, with reasons):
//   validator, traceable, no-contradiction, cov-game, cov-decision, cov-near, cov-luck, luck-relevant, no-dup, max-cards, text-limits, language, no-causal, points-not-vp
const { rehydrate } = require("./fx.js"), { tagsOf } = require("./tags.js");
process.removeAllListeners("warning");
let M = null; const mod = async () => (M ||= await import("../../src/review/ai-page.js"));

const NL_CAUSAL = /\b(omdat|doordat|waardoor|daardoor|daarom|vanwege|dankzij|veroorzaakt|veroorzaakte|leidde tot|leidt tot|resulteerde in|aangezien|zodat|dus)\b/i;
const VP = /\bV\.?P\.?s?\b|\bvictory points?\b|\boverwinningspunt(en)?\b/i;
const NL_W = new Set("de het een en van is op te dat die niet met voor zijn aan bij maar ook nog naar uit om dan als wel je jij jouw hij zij ze wij wat werd waren heeft hadden hebt kans winstkans beurt beurten punten gewonnen verloren speler stond daarna steeds kaarten grondstof".split(" "));
const EN_W = new Set("the a an and of is on to that this not with for are was were at but also from then than as you your he she they we what had has have chance win turn turns points won lost player stood after still cards resource until by it its in".split(" "));
const words = (s) => String(s).toLowerCase().match(/[a-zà-ÿ']+/g) || [];
const langOf = (s) => { const w = words(s); let nl = 0, en = 0; w.forEach((x) => { if (NL_W.has(x)) nl++; if (EN_W.has(x)) en++; }); return nl + en < 2 ? null : nl > en ? "nl" : en > nl ? "en" : null; };

const FREE_KEYS = new Set(["short", "label", "unit", "up", "down", "same"]);
/** Every piece of free text of a raw spec: [{ path, s }] (parts strings, labels, units, follow chips). */
function texts(spec) {
  const out = [], add = (path, s) => { if (typeof s === "string") out.push({ path, s }); };
  const parts = (path, ps) => (Array.isArray(ps) ? ps : []).forEach((p, i) => { if (typeof p === "string") add(`${path}[${i}]`, p); else if (p && typeof p === "object") ["up", "down", "same"].forEach((k) => add(`${path}[${i}].${k}`, p[k])); });
  parts("headline", spec.headline);
  (spec.follow || []).forEach((f, i) => add(`follow[${i}]`, f?.q));
  (spec.widgets || []).forEach((w, wi) => {
    const P = `w${wi}(${w?.id})`; add(`${P}.short`, w?.short); parts(`${P}.title`, w?.title); (w?.notes || []).forEach((n, i) => parts(`${P}.notes[${i}]`, n));
    [...(w?.blocks || []), ...(w?.expand || [])].forEach((b, bi) => {
      const B = `${P}.${bi}:${b?.p}`; if (b?.p === "text") parts(B, b.parts); add(`${B}.unit`, b?.unit);
      (b?.items || []).forEach((it, ii) => { add(`${B}.item${ii}.label`, it?.label); parts(`${B}.item${ii}.sub`, it?.sub); });
    });
  });
  return out;
}
/** Every ref a raw spec uses: [{ path, ref }]. */
function refsOf(spec, guard = () => true) {
  const out = [], add = (path, ref) => { if (typeof ref === "string") out.push({ path, ref }); };
  const parts = (path, ps) => (Array.isArray(ps) ? ps : []).forEach((p, i) => { if (p && typeof p === "object") { add(`${path}[${i}]`, p.ref); (p.dir || []).forEach((d) => add(`${path}[${i}].dir`, d)); } });
  parts("headline", spec.headline); (spec.headlineRequires || []).forEach((r) => add("headlineRequires", r));
  (spec.widgets || []).forEach((w, wi) => {
    const P = `w${wi}(${w?.id})`; parts(`${P}.title`, w?.title); (w?.requires || []).forEach((r) => add(`${P}.requires`, r)); (w?.notes || []).forEach((n, i) => parts(`${P}.notes[${i}]`, n));
    if (w?.chip) add(`${P}.chip`, w.chip.ref);
    [...(w?.blocks || []), ...(w?.expand || [])].forEach((b, bi) => {
      const B = `${P}.${bi}:${b?.p}`; if (b?.p === "text") parts(B, b.parts);
      (b?.rows || []).forEach((r) => add(`${B}.row`, r?.ref));
      (b?.items || []).forEach((it) => { add(`${B}.item`, it?.ref); add(`${B}.item.of`, it?.of); if (!it?.subIf || guard(it.subIf)) parts(`${B}.item.sub`, it?.sub); }); // (subIf is a guard: unresolved just hides the sub line)
    });
  });
  return out;
}
const wordCount = (parts) => (Array.isArray(parts) ? parts : []).reduce((a, p) => a + (typeof p === "string" ? (p.trim() ? p.trim().split(/\s+/).length : 0) : 1), 0);
const seatName = (fx, k) => { const q = fx.seatOf(k); return q >= 0 ? q : null; };

async function evalPage(spec, F, opts = {}) {
  const { validatePage, blockOk, sigsOf, CAPS, CAUSAL, LEVELS } = await mod();
  const fx = rehydrate(F), tags = F.tags || tagsOf(fx), has = (t) => tags.includes(t);
  spec = spec && typeof spec === "object" ? spec : {};
  const lang = opts.lang || spec.lang || "en", Y = fx.keys[fx.me], S = fx.strat[fx.me];
  const checks = {}, C = (name, why) => { checks[name] = { pass: why.length === 0, why }; };
  const raw = Array.isArray(spec.widgets) ? spec.widgets : [];
  let v; try { v = validatePage(spec, fx); } catch (e) { v = { widgets: [], dropped: [{ id: "throw", why: String(e.message) }], follow: [], headline: null }; }
  const kept = v.widgets, lv = (l) => kept.filter((w) => w.level === l);

  // 1 validator: the app's validator keeps everything (nothing dropped, no fallback title) and something is left
  C("validator", [...(kept.length ? [] : ["no widget survives"]), ...v.dropped.map((d) => `${d.id}: ${d.why}`), ...kept.filter((w) => w.titleFallback).map((w) => `${w.id}: fallback title`)]);

  // 2 traceable: every ref resolves, no digit in any free text
  { const why = [];
    refsOf(spec, (r) => fx.ref(r)).forEach((r) => { if (!fx.ref(r.ref)) why.push(`unresolved ${r.ref} @${r.path}`); });
    texts(spec).forEach((t) => { if (/\d/.test(t.s)) why.push(`digit in text "${t.s}" @${t.path}`); });
    raw.forEach((w, wi) => [...(w?.blocks || []), ...(w?.expand || [])].forEach((b) => { if (b?.p === "line") [...(b.players || []), b.player].filter(Boolean).forEach((k) => { if (seatName(fx, k) == null) why.push(`unknown player ${k} @w${wi}`); }); if (b?.p === "compare" && !fx.decAt(b.dec)) why.push(`no decision at turn ${b.dec} @w${wi}`); }));
    C("traceable", why); }

  // 3 contradictions between cards (and against the facts)
  { const why = [], all = (w) => [...w.blocks, ...w.expand], W = fx.winner;
    const mentions = (w, k) => JSON.stringify([w.title, w.notes, all(w)]).includes(`strat.${k}.`);
    for (const w of kept) {
      if (W != null) {
        const Wk = fx.keys[W], Ws = fx.strat[W];
        const weak = (b) => b.p === "badge" && b.player === Wk && /weak/i.test(Ws?.verdict?.label || "");
        if (all(w).some(weak)) why.push(`${w.id}: winner ${Wk} badged "${Ws.verdict.label}"`);
        const req = JSON.stringify(raw.find((r) => r?.id === w.id)?.requires || []) + JSON.stringify(w.title);
        if (req.includes(`strat.${Wk}.headless`) && Ws?.headless) why.push(`${w.id}: winner ${Wk} called headless / no steady plan`);
        if (w.who === Wk && /\b(weak|headless|aimless|no plan|zwak|doelloos)\b/i.test(texts({ widgets: [raw.find((r) => r?.id === w.id)] }).map((t) => t.s).join(" "))) why.push(`${w.id}: winner ${Wk} described as weak`);
      }
      if (w.level === "Near miss" && fx.won) why.push(`${w.id}: near-miss card on a won game`);
      if (w.chip) { const r = fx.ref(w.chip.ref); if (r && ((w.chip.tone === "up" && r.v < 0) || (w.chip.tone === "dn" && r.v > 0))) why.push(`${w.id}: chip tone ${w.chip.tone} against value ${r.v}`); }
    }
    // a "Yes" start-feed tile while the page says the same player waited on a resource
    fx.keys.forEach((k, q) => {
      const s = fx.strat[q], feeds = kept.some((w) => all(w).some((b) => b.p === "tiles" && b.items.some((i) => i.kind === "startfeed" && i.player === k)));
      if (!feeds || s?.feeds !== "yes" || !s.waitRes || s.waitN < 3) return;
      const waits = kept.some((w) => mentions(w, k) && JSON.stringify([w.title, w.notes, all(w)]).match(new RegExp(`strat\\.${k}\\.(waitN|waitRes)|rate\\.${s.waitRes}\\.`)));
      if (waits) why.push(`${k}: start feeds "Yes" while waiting on ${s.waitRes} for ${s.waitN} turns`);
    });
    C("no-contradiction", why); }

  // 4 coverage
  { const need = ["costly-decision", "stalled", "pivot", "wobbly", "headless", "wait-on-resource"].filter(has);
    C("cov-game", lv("Game").length || (v.headline && fx.hasWc === false) ? [] : [fx.hasWc ? "no Game card" : "no headline"]);
    C("cov-decision", need.length && !lv("Decision").length && !lv("Strategy").length ? [`tags ${need.join("+")} but no Decision or Strategy card`] : []);
    C("cov-near", has("near-miss") && !lv("Near miss").length ? ["near miss game without a Near miss card"] : []);
    C("cov-luck", has("luck-decided") && !lv("Luck").length ? ["luck decided the game but no Luck card"] : []);
    C("luck-relevant", lv("Luck").length && (has("no-luck-data") || has("luck-minor")) ? ["Luck card although luck is absent or minor"] : []); }

  // 5 duplicate fact bindings over the RAW spec (the validator drops them silently)
  { const why = [], seen = new Map(), ids = new Set();
    raw.forEach((w, wi) => { if (w?.id) { if (ids.has(w.id)) why.push(`duplicate widget id ${w.id}`); ids.add(w.id); }
      [...(w?.blocks || []), ...(w?.expand || [])].forEach((b) => { const nb = blockOk(b, fx); if (!nb) return;
        const sg = nb.p === "tiles" ? nb.items.map((i) => sigsOf({ p: "tiles", items: [i] })[0]) : sigsOf(nb);
        sg.forEach((s) => { if (seen.has(s)) why.push(`${s} on ${seen.get(s)} and w${wi}(${w.id})`); else seen.set(s, `w${wi}(${w.id})`); }); }); });
    C("no-dup", why); }

  // 6 card count, 7 text limits
  C("max-cards", raw.length > CAPS.widgets ? [`${raw.length} cards`] : []);
  { const why = [], L = (path, n, max) => { if (n > max) why.push(`${path}: ${n} > ${max}`); };
    if (spec.headline) L("headline words", wordCount(spec.headline), CAPS.words);
    raw.forEach((w, wi) => { const P = `w${wi}(${w?.id})`; if (!LEVELS.includes(w?.level)) why.push(`${P}: level ${w?.level}`);
      L(`${P} title words`, wordCount(w?.title), CAPS.words); if (typeof w?.short === "string") L(`${P} short`, w.short.length, CAPS.label);
      L(`${P} blocks`, (w?.blocks || []).length, CAPS.blocks); L(`${P} expand`, (w?.expand || []).length, CAPS.expand); L(`${P} notes`, (w?.notes || []).length, CAPS.notes);
      (w?.notes || []).forEach((n, i) => L(`${P} note${i} words`, wordCount(n), CAPS.words));
      [...(w?.blocks || []), ...(w?.expand || [])].forEach((b) => { if (b?.p === "text") L(`${P} text words`, wordCount(b.parts), 18); if (b?.p === "tiles") L(`${P} tiles`, (b.items || []).length, CAPS.tiles); if (b?.p === "bars") L(`${P} rows`, (b.rows || []).length, CAPS.rows); (b?.items || []).forEach((i) => { if (typeof i?.label === "string") L(`${P} tile label`, i.label.length, CAPS.label); }); }); });
    L("follow chips", (spec.follow || []).length, CAPS.follow); (spec.follow || []).forEach((f, i) => { if (typeof f?.q === "string") L(`follow${i} chars`, f.q.length, 40); });
    C("text-limits", why); }

  // 8 language, 9 causal, 10 points
  { const T = texts(spec), why = [], seen = new Set();
    T.forEach((t) => { const l = langOf(t.s); if (l) { seen.add(l); if (l !== lang) why.push(`${l} text in a ${lang} page: "${t.s.slice(0, 40)}" @${t.path}`); } });
    C("language", why.slice(0, 6));
    C("no-causal", T.filter((t) => CAUSAL.test(t.s) || NL_CAUSAL.test(t.s)).map((t) => `"${t.s.slice(0, 50)}" @${t.path}`));
    C("points-not-vp", T.filter((t) => VP.test(t.s)).map((t) => `"${t.s.slice(0, 50)}" @${t.path}`)); }

  const total = Object.keys(checks).length, passed = Object.values(checks).filter((c) => c.pass).length;
  return { id: F.id, tags, checks, passed, total, cards: raw.length };
}
module.exports = { evalPage, langOf, texts, refsOf };
