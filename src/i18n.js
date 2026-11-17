// v1.87 One language for the whole app (English / Dutch).
//  - lang(): the stored choice (Settings > Language), else the browser language (nl* -> Dutch), else English.
//  - t(key, vars): the text for `key`. The key IS the English text, so a missing entry shows English, never a raw key.
//    "{name}" in a key or value is a variable; plural: tn(n, one, other) picks per language; num(n, digits) formats the number.
//  - The screens are built from English templates all over the app, so Dutch is applied where text reaches the page: a small
//    localizer (MutationObserver) turns text, aria-label, title, placeholder and alt into Dutch through the same tables, and back.
//  - Tables: src/i18n-nl.js (exact sentences, NL) and src/i18n-nl-pat.js (sentences with {n} / {x} variables, NL).

export const LANG_KEY = "colonist_lang";
const LEGACY_KEY = "colonist_recap_lang"; // v1.84-v1.86: the AI recap language; an explicit old choice is kept as the app language
const norm = (l) => (l === "nl" ? "nl" : "en");
const store = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) { /* private mode */ } };
const read = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const sysLang = () => { try { return /^nl\b/i.test((navigator.languages && navigator.languages[0]) || navigator.language || "") ? "nl" : "en"; } catch (_) { return "en"; } };
/** The language now: "en" | "nl". Read every time (a few microseconds), so a change made anywhere is seen at once. */
export const lang = () => { const s = read(LANG_KEY) || read(LEGACY_KEY); return s === "nl" || s === "en" ? s : sysLang(); };
/** The stored choice ("en" | "nl" | "" for follow-the-browser) */
export const langChoice = () => { const s = read(LANG_KEY); return s === "nl" || s === "en" ? s : ""; };
export const isNL = () => lang() === "nl";
const listeners = new Set();
export const onLang = (f) => { listeners.add(f); return () => listeners.delete(f); };
/** Set the language ("en" | "nl"); "" / null forgets the choice and follows the browser. The legacy recap key follows, so the AI pages read the same language. */
export function setLang(l) {
  const v = l === "nl" || l === "en" ? l : null;
  store(LANG_KEY, v); store(LEGACY_KEY, v);
  const now = lang();
  try { document.documentElement.lang = now; } catch (_) { /* no DOM */ }
  const apply = () => {
    localize(typeof document !== "undefined" ? document.body : null);
    listeners.forEach((f) => { try { f(now); } catch (_) { /* a listener must not break the switch */ } });
    try { window.dispatchEvent(new CustomEvent("colonist:lang", { detail: now })); } catch (_) { /* no window */ }
  };
  if (now === "nl" && !loaded) load().then(apply); else apply();
  return now;
}

// ── lookup ──
const rx = (s) => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
const mk = ([k, v]) => {
  const names = []; const raw = new Set(); const src = rx(k).replace(/(v?)\{(\w+)\}/g, (_, v, n) => { names.push(n); if (v) raw.add(n); return (v ? "v" : "") + (v ? "(.+?)" : /^n\d*$/.test(n) ? "(-?[\\d.,]+)" : /^d\d*$/.test(n) ? "([+\\-−±]?[\\d.,]+)" : "(.+?)"); });
  return { re: new RegExp(`^${src}$`), names, raw, v };
};
// The Dutch tables (about 200 KB) load only when Dutch is wanted: nothing is fetched or parsed in English.
let NL = Object.create(null), NLT = Object.create(null), PAT = [], PATH = [], loading = null, loaded = false;
const load = () => (loading ||= import("./i18n-nl.js").then((m) => { NL = m.NL; NLT = m.NLT; PAT = m.NLP.filter(([k]) => !k.includes("<")).map(mk); PATH = m.NLP.filter(([k]) => k.includes("<")).map(mk); loaded = true; }));
let queued = false; const queue = () => { if (queued) return; queued = true; load().then(() => { queued = false; localize(); }); };
if (lang() === "nl") await load(); // Dutch from the first paint
export const misses = new Set();
// words inside a captured piece ("1 Lumber, 2 Ore"): lower case, as in the middle of a Dutch sentence
const WORDS = { Lumber: "hout", Brick: "baksteen", Wool: "wol", Grain: "graan", Ore: "erts", Knight: "ridder", Knights: "ridders", Road: "weg", Roads: "wegen", Ship: "schip", Ships: "schepen", Settlement: "dorp", Settlements: "dorpen", City: "stad", Cities: "steden", Desert: "woestijn", Gold: "goud", You: "jij", "Victory Point": "puntenkaart", "Road Building": "Wegenbouw", "Year of Plenty": "Uitvinding", Monopoly: "Monopolie", robber: "rover", pirate: "piraat", bank: "bank", Forest: "Bos", Hills: "Heuvels", Pasture: "Weide", Fields: "Akkers", Mountains: "Bergen", "the sea": "de zee", "the Desert": "de woestijn", nothing: "niets", forest: "bos", hills: "heuvels", pasture: "weide", fields: "akkers", mountains: "bergen", desert: "woestijn", Trader: "Handelaar", Shark: "Haai", Builder: "Bouwer", Grandmaster: "Grootmeester", "Super Expert+": "Superexpert+", "Super Expert": "Superexpert", Master: "Meester", Hard: "Moeilijk", Medium: "Gemiddeld", Easy: "Makkelijk", Simple: "Simpel", Beginner: "Beginner", Intermediate: "Gemiddeld", Expert: "Expert", Custom: "Eigen mix" };
const WRE = new RegExp(`\\b(${Object.keys(WORDS).sort((a, b) => b.length - a.length).join("|")})\\b`, "g");
const RESW = { Lumber: "hout", Brick: "baksteen", Wool: "wol", Grain: "graan", Ore: "erts" }; // a single resource inside a sentence: lower case
const ord = (x) => (/^\d+(st|nd|rd|th)$/.test(x) ? x.replace(/(st|nd|rd|th)$/, "e") : undefined);
const words = (x) => x.replace(WRE, (m) => WORDS[m]);
const fill = (v, vars) => v.replace(/\{(\w+)\}/g, (m, n) => (n in vars ? String(vars[n]) : m));
const ONLY = (x) => { const w = x.replace(WRE, ""); return w !== x && /^[\s\d,.+×·&:/()x–-]*$/.test(w); }; // "2 Lumber, 1 Ore": nothing but numbers and known words
const SRC = { Settlements: "Dorpen", Cities: "Steden", "Longest road": "Langste handelsroute", "Largest army": "Grootste riddermacht", "Point card": "Puntenkaart", "Point cards": "Puntenkaarten", Islands: "Eilanden" };
// shapes that are lists, not sentences
function special(s) {
  if (/^\d+(st|nd|rd|th)$/.test(s)) return s.replace(/(st|nd|rd|th)$/, "e"); // 1st -> 1e
  if (/^T\d+(?:\s*[–·,-]\s*T?\d+)*$/.test(s)) return s.replace(/T(\d+)/g, "B$1"); // chart labels T14 -> B14 (Beurt)
  if (/^[\d.,+\-−±–% ×x/()]+$/.test(s) && /\d\.\d/.test(s)) return s.replace(/(\d)\.(\d)/g, "$1,$2"); // 70.0 -> 70,0 (numbers on their own)
  let m = /^(.+?): ((?:(?:Settlements|Cities|Longest road|Largest army|Point cards?|Islands) \d+(?:, )?)+)$/.exec(s);
  if (m) return `${NL[m[1]] ?? m[1]}: ${m[2].replace(/(Settlements|Cities|Longest road|Largest army|Point cards?|Islands)/g, (x) => SRC[x])}`;
  if (/^[^,%:]+ \d+%(?:, [^,%:]+ \d+%)+$/.test(s)) { const o = s.split(", ").map((p) => { const i = p.lastIndexOf(" "); const n = p.slice(0, i); return `${NL[n] ?? n}${p.slice(i)}`; }).join(", "); return o === s ? undefined : o; }
  return undefined;
}
const seg = (x) => { const r = lookup(x); return r !== undefined ? r : words(x); };
// "· 10 points · random dice · 3 bots (all Medium)": a line of parts, each one a text of its own
function parts(s) {
  const lead = s.startsWith("· ") ? "· " : ""; const body = lead ? s.slice(2) : s;
  if (!body.includes(" · ")) return undefined;
  const ps = body.split(" · "); let hit = 0; const out = ps.map((x) => { const r = lookup(x); if (r !== undefined && r !== x) { hit++; return r; } return x; });
  return hit ? lead + out.join(" · ") : undefined;
}
// Dutch grammar after a sentence is filled in: "1 kaarten" -> "1 kaart", "5 beurt" -> "5 beurten", "gaven jij" -> "gaven jou"
const SING = [["kaart", "kaarten"], ["grondstofkaart", "grondstofkaarten"], ["ontwikkelingskaart", "ontwikkelingskaarten"], ["puntenkaart", "puntenkaarten"], ["beurt", "beurten"], ["worp", "worpen"], ["zet", "zetten"], ["spel", "spellen"], ["bot", "bots"], ["punt", "punten"], ["dorp", "dorpen"], ["stad", "steden"], ["weg", "wegen"], ["ridder", "ridders"], ["schip", "schepen"], ["tegel", "tegels"], ["speler", "spelers"], ["ruil", "ruilen"], ["eiland", "eilanden"], ["plek", "plekken"], ["aanbod", "aanbiedingen"], ["fout", "fouten"], ["blunder", "blunders"], ["seconde", "seconden"], ["minuut", "minuten"], ["uur", "uren"], ["dag", "dagen"], ["foto", "foto's"]];
const PLMAP = new Map(); SING.forEach(([a, b]) => { PLMAP.set(a, [a, b]); PLMAP.set(b, [a, b]); });
const PLRE = new RegExp(`(^|[^\\d.,\\w])(\\d+) (${[...PLMAP.keys()].sort((a, b) => b.length - a.length).join("|")})(?![\\wé])`, "g");
const nlFix = (s) => s.replace(PLRE, (m, pre, n, w) => `${pre}${n} ${PLMAP.get(w)[n === "1" ? 0 : 1]}`).replace(/\b(aan|van|voor|met|bij|naar|tegen|over|gaven|gaf|geeft|geven|stuurt|toont|geef|gunt) [Jj]ij\b/g, "$1 jou");
const plural = (n, a, b) => `${n} ${Number(n) === 1 ? a : b}`;
// "Jij: 9 points, 4 cards, 1 development cards, in the lead"
function chip(s) {
  const m = /^(.+?): (\d+) points?(?: of (\d+))?, (\d+) cards?, (\d+) development cards?((?:, .+)*)$/.exec(s); if (!m) return undefined;
  const tail = m[6] ? m[6].slice(2).split(", ").map(seg).join(", ") : "";
  return `${NL[m[1]] ?? lookup(m[1]) ?? m[1]}: ${plural(m[2], "punt", "punten")}${m[3] ? ` van ${m[3]}` : ""}, ${plural(m[4], "kaart", "kaarten")}, ${plural(m[5], "ontwikkelingskaart", "ontwikkelingskaarten")}${tail ? ", " + tail : ""}`;
}
function lookup(s) {
  if (!s) return s;
  const hit = NL[s]; if (hit !== undefined) return hit;
  const sp = special(s) ?? chip(s); if (sp !== undefined) return sp;
  const ps = s.includes(", ") ? s.split(/, (?![^(]*\))/) : null; if (ps && ps.length > 1) { const o = ps.map((x) => NL[x]); if (o.every((x) => x !== undefined)) return o.join(", "); } // a list of known phrases ("built a city, took Longest road")
  for (const p of PAT) {
    const m = p.re.exec(s); if (!m) continue;
    const vars = {}; p.names.forEach((n, i) => { vars[n] = p.raw.has(n) ? m[i + 1] : cap(n, m[i + 1]); });
    return fill(p.v, vars);
  }
  const pt = parts(s); if (pt !== undefined) return pt;
  if (ONLY(s)) { const o = words(s); return /^[A-Z]/.test(s) ? o[0].toUpperCase() + o.slice(1) : o; }
  return undefined;
}
// a captured piece of a sentence: numbers stay (decimals get a comma), text is translated on its own
const cap = (n, x) => (/^n\d*$/.test(n) ? x : /^d\d*$/.test(n) ? x.replace(".", ",") : (RESW[x] ?? NL[x] ?? lookup(x) ?? ord(x) ?? words(x)));
const lookupPat = (x) => { for (const p of PAT) { const m = p.re.exec(x); if (m) return lookup(x); } return undefined; };
/** The text of `s` in the current language (English: itself). Unknown text comes back unchanged. */
export function tr(s) {
  if (lang() !== "nl" || !s) return s;
  if (!loaded) { queue(); return s; } // a language set by hand while the app runs: the tables come, then the page turns Dutch
  const key = String(s).replace(/\s+/g, " ").trim(); if (!key) return s;
  const r = lookup(key);
  if (r === undefined) { if (/[A-Za-z]{3}/.test(key)) misses.add(key); return s; }
  return nlFix(r);
}
/** t("Roll {n}", { n: 8 }): translated text with its variables filled in. */
export function t(key, vars) {
  if (lang() === "nl" && !loaded) { queue(); return vars ? fill(key, vars) : key; }
  const base = lang() === "nl" ? (NLT[key] ?? lookup(key) ?? key) : key;
  const o = vars ? fill(base, vars) : base;
  return lang() === "nl" ? nlFix(o) : o;
}
/** Plural by language: Dutch and English both split 1 / other. */
export const tn = (n, one, other) => (n === 1 ? one : other);
/** A number in the language's style (Dutch: 2,5). */
export const num = (n, digits) => { try { return Number(n).toLocaleString(lang() === "nl" ? "nl-NL" : "en-US", digits == null ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits }); } catch (_) { return String(n); } };

// ── the localizer ──
const ATTRS = ["aria-label", "title", "placeholder", "alt", "aria-description"];
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"]);
let touched = false; // something was translated: only then does English need the observer to put things back
const textOrig = new WeakMap(); // text node -> { en, nl }
const attrOrig = new WeakMap(); // element -> { attr: { en, nl } }
const skipped = (el) => !el || (el.closest && el.closest("[data-i18n-skip],[data-nm]"));
const keepWs = (src, out) => { const a = /^\s*/.exec(src)[0], b = /\s*$/.exec(src)[0]; return (a ? " " : "") + out + (b ? " " : ""); };
function doText(n) {
  const el = n.parentElement; if (!el || SKIP.has(el.tagName) || skipped(el)) return;
  const o = textOrig.get(n); const cur0 = n.nodeValue;
  const src = o && cur0 === o.nl ? o.en : cur0;
  if (lang() !== "nl") { if (o && cur0 === o.nl) { n.nodeValue = o.en; textOrig.delete(n); } return; }
  const out = el.dataset && el.dataset.nl ? el.dataset.nl : tr(src); if (out === src) { if (o) textOrig.delete(n); return; } // data-nl: a shorter Dutch label for a tight button
  const nv = keepWs(src, out); if (nv === cur0) return;
  textOrig.set(n, { en: src, nl: nv }); n.nodeValue = nv; touched = true;
}
function doAttrs(el) {
  if (!el.getAttribute || skipped(el)) return;
  let rec = attrOrig.get(el);
  for (const a of ATTRS) {
    const v = el.getAttribute(a); if (v == null) continue;
    const o = rec && rec[a]; const src = o && v === o.nl ? o.en : v;
    if (lang() !== "nl") { if (o && v === o.nl) { el.setAttribute(a, o.en); delete rec[a]; } continue; }
    const out = tr(src);
    if (out === src) { if (o) delete rec[a]; continue; }
    if (out === v) continue;
    rec = rec || {}; rec[a] = { en: src, nl: out }; attrOrig.set(el, rec); el.setAttribute(a, out); touched = true;
  }
  if (el.tagName === "INPUT" && /^(button|submit)$/.test(el.type) && el.value) { const o = rec && rec.value; const src = o && el.value === o.nl ? o.en : el.value; const out = lang() === "nl" ? tr(src) : src; if (out !== el.value) { rec = rec || {}; rec.value = { en: src, nl: out }; attrOrig.set(el, rec); el.value = out; } }
}
// A paragraph with inline markup ("<b>Winkans</b>: your chance to win, in %") is one sentence: it is looked up as a whole (its innerHTML is the key).
const INLINE = new Set(["B", "I", "EM", "STRONG", "SMALL", "SPAN", "A", "U", "BR", "SUP", "SUB", "MARK"]);
const htmlOrig = new WeakMap(); // element -> { en, nl } (normalized innerHTML)
const normHtml = (h) => h.replace(/\s+/g, " ").trim();
export function isMixed(el) {
  if (!el.firstElementChild || SKIP.has(el.tagName)) return false;
  for (let c = el.firstElementChild; c; c = c.nextElementSibling) { if (!INLINE.has(c.tagName) || c.querySelector("svg,img,button,input,canvas")) return false; }
  const t = el.textContent; return t.length >= 20 && /[A-Za-z]{3}/.test(t);
}
/** The innerHTML (normalized) of every element that is translated as a whole: for harvesting and tests. */
export function mixedHtml(root) {
  const out = []; (root || document.body).querySelectorAll("*").forEach((el) => { if (isMixed(el) && !skipped(el) && !(el.parentElement && el.parentElement.closest && isMixedChain(el))) out.push(normHtml(el.innerHTML)); });
  return out;
}
const isMixedChain = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (isMixed(p)) return true; return false; };
function lookupHtml(src) {
  const e = NL[src]; if (e !== undefined) return e;
  for (const p of PATH) { const m = p.re.exec(src); if (!m) continue; const vars = {}; p.names.forEach((n, i) => { vars[n] = p.raw.has(n) ? m[i + 1] : cap(n, m[i + 1]); }); return fill(p.v, vars); }
  return undefined;
}
function doHtml(el) { // true: this element was handled as a whole (its children are not looked at one by one)
  const o = htmlOrig.get(el);
  if (lang() !== "nl") { if (o && normHtml(el.innerHTML) === o.nl) { el.innerHTML = o.en; htmlOrig.delete(el); return true; } return false; }
  if (o) return normHtml(el.innerHTML) === o.nl;
  if (!isMixed(el) || skipped(el)) return false;
  const src = normHtml(el.innerHTML), r = lookupHtml(src);
  if (r === undefined || r === src) return false;
  el.innerHTML = r; htmlOrig.set(el, { en: src, nl: normHtml(el.innerHTML) }); touched = true; return true;
}
function visit(n) {
  if (n.nodeType === 3) { doText(n); return; }
  if (n.nodeType !== 1 || SKIP.has(n.tagName)) return;
  doAttrs(n);
  if (doHtml(n)) return;
  for (let c = n.firstChild; c; c = c.nextSibling) visit(c);
}
/** Localize `root` (the whole page when omitted) and everything below it. */
export function localize(root) {
  root = root || (typeof document !== "undefined" ? document.body : null); if (!root) return;
  if (root.nodeType === 11) { root.childNodes.forEach(visit); return; }
  visit(root);
}
let mo = null;
export function startLocalizer() {
  if (mo || typeof MutationObserver === "undefined" || typeof document === "undefined") return;
  document.documentElement.lang = lang();
  const run = (muts) => {
    if (!touched && lang() !== "nl") return; // English, nothing was ever translated: nothing to do
    mo.disconnect();
    try {
      for (const m of muts) {
        if (m.type === "characterData") { if (!(m.target.parentElement && htmlOrig.has(m.target.parentElement))) doText(m.target); }
        else if (m.type === "attributes") doAttrs(m.target);
        else m.addedNodes.forEach((n) => localize(n));
      }
    } finally { mo.observe(document.documentElement, OPTS); }
  };
  const OPTS = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS };
  mo = new MutationObserver(run);
  const go = () => { localize(document.body); mo.observe(document.documentElement, OPTS); };
  if (document.body) go(); else document.addEventListener("DOMContentLoaded", go, { once: true });
}
/** Locale for dates and times: Dutch when the app is Dutch, else the device's own. */
export const dateLocale = () => (lang() === "nl" ? "nl-NL" : []);
export const __lookupHtml = (s) => lookupHtml(s);
