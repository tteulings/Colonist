// v1.73 AI tab (beta): the AI reads the facts of a finished game (src/review/ai-facts.js) and answers with CARDS, each with its own
// visual (win chance line, luck / points bars, plan timeline, zoomed board, moves). The app, not the AI, decides directions and numbers:
// the real win-chance change of the card's turn is shown as a chip, and a sentence that contradicts it (or quotes a number >2 points off
// the review) is replaced by a neutral line. Insights and answers are kept in the saved review (R.ai). Online only.
import { aiFacts, aiSeries, aiTimeline, wcAt, wcChange } from "./review/ai-facts.js";
import { decide } from "./review/evaluate.js";
import { RECAP_URL, recapLang } from "./review-recap.js";
import { rvPos, rvMarks } from "./review-game.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
const sgn = (v) => { const r = Math.round(v); return r > 0 ? `+${r}` : r < 0 ? `\u2212${-r}` : "0"; };
const VIEWS = ["winchance", "luck", "points", "plan", "board", "moves", "none"];
const LEVELS = ["game", "decision", "strategy"];
const T = {
  en: { lv: { game: "Game", decision: "Decision", strategy: "Strategy" }, why: "Why?", show: "Show in review", turn: "Turn", setup: "Set-up", ask: "Ask", ph: "Ask about this game…", regen: "Regenerate", foot: "Written by AI from this review · numbers by the app · may contain mistakes",
    wait: "Reading the game…", again: "Try again", pin: "Keep this answer", unpin: "Unpin", win: "win chance", you: "You", better: "A better", played: "B played", mine: "your move", your: "your", move: "move", cost: "cost", rose: "rose", fell: "fell", more: "more", less: "less", tab: "AI · beta",
    rate: "The AI is busy right now (too many requests). Try again in a minute.", time: "That took too long. Try again.", net: "No connection. Check your internet and try again.", fail: "No answer this time. Try again later.", none: "Not enough in this review to ask the AI.",
    luck: "Luck", pts: "Points", legend: { s: "Settlement", c: "City", L: "Longest road", A: "Largest army", v: "Point card" } },
  nl: { lv: { game: "Spel", decision: "Beslissing", strategy: "Strategie" }, why: "Waarom?", show: "Toon in review", turn: "Beurt", setup: "Opzet", ask: "Vraag", ph: "Vraag iets over dit spel…", regen: "Opnieuw", foot: "Geschreven door AI op basis van deze review · cijfers van de app · kan fouten bevatten",
    wait: "Het spel lezen…", again: "Probeer opnieuw", pin: "Bewaar dit antwoord", unpin: "Los", win: "winkans", you: "Jij", better: "A beter", played: "B gespeeld", mine: "jouw zet", your: "jouw", move: "zet", cost: "kostte", rose: "steeg", fell: "daalde", more: "meer", less: "minder", tab: "AI · beta",
    rate: "De AI is nu druk (te veel verzoeken). Probeer het over een minuut opnieuw.", time: "Dat duurde te lang. Probeer opnieuw.", net: "Geen verbinding. Controleer je internet en probeer opnieuw.", fail: "Nu geen antwoord. Probeer het later opnieuw.", none: "Er staat te weinig in deze review om de AI te vragen.",
    luck: "Geluk", pts: "Punten", legend: { s: "Dorp", c: "Stad", L: "Langste weg", A: "Grootste leger", v: "Puntenkaart" } },
};
const GOODT = /\b(best|great|strong|brilliant|perfect|smart|excellent|beste|geweldig|sterk|perfecte|slim|uitstekend)\b/i;
const AGAINST = /\b(against|unlucky|unluck\w*|tegen|pech|ongelukkig)\b/i, FAVOUR = /\b(in (?:your|his|her|their) favou?r|favou?red|fortunate|lucky for|gelukkig|ten gunste|mee)\b/i;
const POS = /\b(helped|gained|gains?|stayed ahead|stays ahead|improved|improves|rose|rises|boosted|climbed|jumped|grew|surged|took the lead|pulled ahead|strengthened|increased|hielp|won|bleef voor|verbeterde|steeg|groeide|versterkte|nam de leiding|nam een voorsprong)\b/i;
const NEG = /\b(lost|loses|dropped|drops|fell|falls|hurt|cost|costs|slipped|wasted|damaged|collapsed|weakened|decreased|sank|plunged|verloor|daalde|viel|schaadde|kostte|zakte|verzwakte|verspeelde)\b/i;
const RESN = { ore: "ore", erts: "ore", grain: "wheat", wheat: "wheat", graan: "wheat", tarwe: "wheat", wool: "sheep", sheep: "sheep", wol: "sheep", schaap: "sheep", lumber: "wood", wood: "wood", hout: "wood", brick: "brick", baksteen: "brick" };
const online = () => typeof navigator === "undefined" || navigator.onLine !== false;
const qkey = (q) => String(q).trim().toLowerCase().replace(/\s+/g, " ");
const SRC = [["settlements", "s"], ["cities", "c"], ["road", "L"], ["army", "A"], ["cards", "v"], ["islands", "i"]];

/** A follow-up chip: at most 24 characters, never cut with "…": the question without filler, or its first clause; one that does not fit is left out. */
export function aiChip(q) {
  q = String(q ?? "").trim().replace(/\s+/g, " ").replace(/[?.!]+$/, "");
  if (!q) return null;
  if (q.length <= 24) return q;
  const filler = /\b(?:really|actually|exactly|overall|already|just|very|so much|in this game|of the game|of this game|in total|at all|again|eigenlijk|echt|precies|helemaal|in dit spel)\b\s*/gi;
  const base = q.replace(/^(?:can|could) you (?:please )?(?:tell me )?|^please |^tell me /i, "").replace(filler, "").replace(/\s+/g, " ").trim();
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1), noArt = (x) => x.replace(/\b(?:the|a|an|de|het|een)\s+/gi, "").replace(/\s+/g, " ").trim();
  const first = base.split(/\s*(?:,|;|:|\u2013|\u2014| - |\bbut\b|\band\b|\bbecause\b|\bwhile\b|\bwant\b|\bmaar\b|\ben\b|\bomdat\b)\s*/i)[0];
  for (const c of [base, first, noArt(base), noArt(first)]) if (c.length >= 6 && c.length <= 24) return cap(c);
  return null;
}
const FALLBACK = { en: ["Best move?", "Biggest mistake?", "Who was luckiest?"], nl: ["Beste zet?", "Grootste fout?", "Wie had geluk?"] };
const FALLQ = { en: ["What was my best move of the game?", "What was my biggest mistake?", "Who was the luckiest player?"], nl: ["Wat was mijn beste zet van het spel?", "Wat was mijn grootste fout?", "Wie had het meeste geluk?"] };

export const ReviewAiMixin = {
  _aiL() { return T[recapLang()] || T.en; },
  _aiAvail() { return online() && !!this.winner && !this._rvMid && !!this._rv && this._rcOk?.() === true; },
  _aiSaved() { const a = this._rv?.ai; return a && a.pid === this._rvPid && a.lang === recapLang() && a.insights?.cards?.length ? a : null; },
  /** The Overview's "AI coach" row: the AI tab, asking for the insights when there are none yet. */
  _rvOpenAiTab() {
    if (!this._aiAvail()) return;
    this._rvTab = "ai"; this._rvStep = null; this._rvDrawReview();
  },

  // ── the data the cards are checked against ──
  _aiCtx() {
    const pid = this._rvPid, me = pid, ser = aiSeries(this), tl = aiTimeline(this), st = this._st, n = this.players.length;
    const nmRaw = (q) => (this._rvIsYou(q) ? this._aiL().you : this.players[q]?.name || `Player ${q + 1}`);
    const rv = this._rvOf(pid), res = (rv?.results || []).filter((x) => !x.skip || x.skip === "trivial").sort((a, b) => a.i - b.i);
    const ds = tryv(() => this._rvDecisions(res), []);
    const turnOf = (d) => (d.k === "setup" ? 0 : (this._rcTurnOf?.(d) ?? d.t));
    const L = tryv(() => this._lkState()), luck = L && !L.na && L.done && L.cover >= 0.9 ? L.tot : null;
    const decs = [];
    this.players.forEach((p) => {
      const r = tryv(() => this._rvOf(p.id)); if (!r?.results?.length) return;
      const rs = r.results.filter((x) => !x.skip || x.skip === "trivial").sort((a, b) => a.i - b.i);
      const list = p.id === pid ? ds : tryv(() => decide(rs, n, p.id), []);
      list.forEach((d) => { if (d.x?.best && !d.same && d.gap > 0.005) decs.push({ seat: p.id, turn: turnOf(d), d, gap: d.gap, own: p.id === pid }); });
    });
    return { pid, me, ser, tl, st, n, nmRaw, ds, turnOf, luck, decs, maxT: Math.max(ser.maxT, this.turn || 0), lang: recapLang(), t: this._aiL() };
  },

  // ── trust: the app decides direction words and numbers ──
  _aiSeats(raw, C) {
    const out = [];
    (raw || []).forEach((p) => { const s = typeof p === "number" ? p : this._rcSeat?.(p); if (s != null && s >= 0 && s < C.n && !out.includes(s)) out.push(s); });
    return out;
  },
  _aiNameRe(C) {
    const names = this.players.map((p) => esc(C.nmRaw(p.id))).filter((s) => s.length >= 2);
    const raw = this.players.map((p) => esc(p.name || "")).filter((s) => s.length >= 2);
    return [...new Set([...names, ...raw])].sort((a, b) => b.length - a.length).map(reEsc);
  },
  _aiCard(raw, C, { answer = false } = {}) {
    const L = C.t, view = VIEWS.includes(raw?.view) ? raw.view : "none", level = LEVELS.includes(raw?.level) ? raw.level : "game";
    const turns = [...new Set((Array.isArray(raw?.turns) ? raw.turns : []).filter((x) => x != null && x !== "").map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= C.maxT))].slice(0, 6);
    let focus = raw?.focusTurn != null && raw.focusTurn !== "" && Number.isInteger(+raw.focusTurn) && +raw.focusTurn >= 0 && +raw.focusTurn <= C.maxT ? +raw.focusTurn : null;
    if (focus == null && turns.length) focus = turns[0];
    if (focus != null && !turns.includes(focus)) turns.unshift(focus);
    const seats = this._aiSeats(raw?.players, C);
    const chgSeats = seats.length ? seats.slice(0, 2) : focus != null ? [C.me] : [];
    let chg = chgSeats.map((s) => { const c = focus != null ? wcChange(C.ser, s, focus, focus) : null; return c ? { seat: s, ...c } : null; }).filter((c) => c && c.d !== 0);
    // a decision: the chip is the cost of that move with the mover's sign (a better move worth +6% is "-6% your move", never a green +6%)
    const decs = level === "decision" && focus != null ? C.decs.filter((x) => x.turn === focus) : [];
    const dm = decs.filter((x) => !seats.length || seats.includes(x.seat)).sort((a, b) => (b.own - a.own) || (b.gap - a.gap))[0] || null;
    if (level === "decision" && focus != null) chg = dm && Math.round(dm.gap * 100) >= 1 ? [{ seat: dm.seat, from: null, to: null, d: -Math.round(dm.gap * 100), move: true }] : [];
    // luck: the chip is the luck of the named player (or yours) in win chance, with its own sign
    if (view === "luck" && C.luck) { const s = seats[0] ?? C.me, d = Math.round((C.luck[s] ?? 0) * 100); chg = d ? [{ seat: s, from: null, to: null, d, luck: true }] : []; }
    const card = { level, view, turns: turns.slice(0, 6), focus, seats, chg, title: String(raw?.title ?? "").slice(0, 120), src: String(answer ? raw?.answer : raw?.text ?? "").slice(0, 900), points: (raw?.points || []).map(String).slice(0, 4), fix: [] };
    card.dec = card.focus != null && !!this._aiDecAt(card.focus, C);
    card.text = this._aiTrust(card, C);
    card.title = this._aiTitle(card, C);
    return card;
  },
  /** The AI's title unless it contradicts the chip (a "best move" with a negative chip, luck "against you" with a positive one): then a neutral app title. */
  _aiTitle(card, C) {
    const t = card.title, c = card.chg[0], L = C.t, TW = C.lang === "nl" ? "Beurt" : this._rvTW?.() || "Turn";
    if (!t || !c || !c.d) return t;
    const bad = c.luck ? (AGAINST.test(t) && c.d > 0) || (FAVOUR.test(t) && c.d < 0) : (GOODT.test(t) || POS.test(t)) && !NEG.test(t) && c.d < 0 || NEG.test(t) && !POS.test(t) && c.d > 0;
    if (!bad) return t;
    card.fix.push("title");
    const you = this._rvIsYou(c.seat), nm = C.nmRaw(c.seat), poss = you ? L.your : C.lang === "nl" ? `${nm}s` : `${nm}'s`;
    if (c.luck) return `${poss.charAt(0).toUpperCase() + poss.slice(1)} ${L.luck.toLowerCase()}: ${sgn(c.d)}% ${L.win}`;
    const tt = card.focus === 0 ? L.setup : `${TW} ${card.focus}`;
    return c.move ? `${tt}: ${poss} ${L.move}` : `${tt}: ${poss} ${L.win}`;
  },
  /** A neutral sentence for a seat from the app's own number: "Turn 22: your win chance fell 57%". */
  _aiNeutral(card, C, s, T0, TW) {
    const L = C.t, you = this._rvIsYou(s), nm = C.nmRaw(s), poss = you ? L.your : C.lang === "nl" ? `${nm}s` : `${nm}'s`;
    const mv = card.chg.find((c) => c.move && c.seat === s), lk = card.view === "luck" ? card.chg.find((c) => c.luck && c.seat === s) : null;
    const tt = T0 == null ? "" : T0 === 0 ? `${L.setup}: ` : `${TW} ${T0}: `;
    if (mv) return `${tt}${poss} ${L.move} ${L.cost} ${Math.abs(mv.d)}% ${L.win}.`.replace(/^./, (c) => c.toUpperCase());
    if (lk) return `${L.luck}: ${poss} ${L.win} ${lk.d > 0 ? L.rose : L.fell} ${Math.abs(lk.d)}%.`;
    const c = T0 != null ? wcChange(C.ser, s, T0, T0) : null; if (!c || !c.d) return "";
    return `${tt}${poss} ${L.win} ${c.d > 0 ? L.rose : L.fell} ${Math.abs(c.d)}%.`.replace(/^./, (x) => x.toUpperCase());
  },
  /** The numbers (whole %) a sentence may quote: the win chances of the seats it is about at the card's turns (+-1) and their steps, the cost of the
   *  decisions there, and the game-wide numbers of the review (luck, accuracy, moves cost). Anything else is not in the review. */
  _aiAllowed(card, C, seats, sent = "") {
    const wcSent = /win ?chance|winkans/i.test(sent) && card.view !== "luck"; // a sentence about win chance may not borrow luck / accuracy numbers
    const A = new Set([0, 100]), add = (v) => { if (v != null && isFinite(v)) A.add(Math.round(Math.abs(v))); };
    const ts = new Set(); card.turns.forEach((t) => [t - 1, t, t + 1].forEach((x) => x >= 0 && ts.add(x)));
    seats.forEach((s) => { let prev = null; [...ts].sort((a, b) => a - b).forEach((t) => { const v = wcAt(C.ser, s, t); add(v); if (prev != null && v != null) add(v - prev); prev = v; }); if (!card.turns.length) { add(wcAt(C.ser, s, 0)); add(wcAt(C.ser, s, C.maxT)); } if (C.luck && !wcSent) add(C.luck[s] * 100); });
    card.chg.forEach((c) => { add(c.d); add(c.from); add(c.to); });
    if (!wcSent) C.decs.forEach((x) => { if (card.turns.includes(x.turn) || !card.turns.length) add(x.gap * 100); });
    if (wcSent) return A;
    const fc = this._aiFC; const f = fc && fc.R === this._rv ? fc.f : (this._aiFC = { R: this._rv, f: tryv(() => aiFacts(this)?.obj) }).f;
    f?.players?.forEach((p) => { add(p.accuracyPct); add(p.winChanceLostByMovesPct); Object.values(p.luckInWinChancePct || {}).forEach(add); });
    Object.values(f?.reviewedPlayerSummary || {}).forEach((v) => typeof v === "number" && add(v));
    return A;
  },
  /** The text to show: the AI's sentences, minus those that contradict the review's win-chance change or quote a number it does not have. */
  _aiTrust(card, C) {
    const src = card.src.trim(); if (!src) return "";
    const L = C.t, TW = C.lang === "nl" ? "Beurt" : this._rvTW?.() || "Turn", T0 = card.focus;
    const sents = src.match(/(?:[^.!?]|[.!?](?!\s|$))+[.!?]*(?:\s+|$)/g)?.map((s) => s.trim()).filter(Boolean) || [src];
    const nameRes = this.players.map((p) => ({ s: p.id, re: new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${[C.nmRaw(p.id), p.name || ""].filter((x) => x.length >= 2).map(reEsc).join("|") || "\u0000"})(?![\\p{L}\\p{N}])`, "iu") }));
    nameRes.forEach((x) => { if (this._rvIsYou(x.s)) x.re = new RegExp(`${x.re.source}|\\b(?:you|your|jij|je|jouw)\\b`, "iu"); });
    const neutral = (s) => this._aiNeutral(card, C, s, T0, TW);
    const out = []; let used = false;
    const put = (s) => { if (s && !used) { out.push(s); used = true; } else if (!s) used = used; };
    for (const sent of sents) {
      const seen = nameRes.filter((x) => x.re.test(sent)).map((x) => x.s);
      const seat = seen.length === 1 ? seen[0] : seen.length === 0 ? card.chg[0]?.seat ?? null : null;
      const c = seat != null && T0 != null ? wcChange(C.ser, seat, T0, T0) : null;
      const pos = POS.test(sent), neg = NEG.test(sent);
      let bad = false, why = "";
      if (c && pos && !neg && c.d <= -1) { bad = true; why = "verb"; }
      else if (c && neg && !pos && c.d >= 1) { bad = true; why = "verb"; }
      if (!bad && card.view === "luck" && C.luck && seat != null) { const lv = Math.round(C.luck[seat] * 100); if ((AGAINST.test(sent) && lv >= 1) || (FAVOUR.test(sent) && lv <= -1)) { bad = true; why = "luck"; } }
      if (!bad) {
        const nums = [...sent.matchAll(/(\d+(?:[.,]\d+)?)\s?%/g)].map((m) => parseFloat(m[1].replace(",", ".")));
        const allowed = this._aiAllowed(card, C, seen.length ? seen : card.chg.length ? card.chg.map((c) => c.seat) : [C.me], sent);
        const off = nums.some((v) => ![...allowed].some((a) => Math.abs(a - v) <= 2));
        if (off) { bad = true; why = "number"; }
      }
      if (bad) { card.fix.push(why); const n2 = neutral(seat ?? card.chg[0]?.seat ?? C.me); if (n2 && !out.includes(n2)) out.push(n2); }
      else out.push(sent);
    }
    return out.join(" ").trim();
  },

  // ── the inline formatter: turns, changes, points, players, resource spots ──
  _aiFmt(text, C, card = null, { links = true } = {}) {
    text = String(text ?? ""); if (!text) return "";
    text = text.replace(/\s+(['\u2019]s\b)/g, "$1").replace(/(\p{L})(\d+(?:[.,]\d+)?\s?%)/gu, "$1 $2").replace(/%(?=\p{L})/gu, "% ").replace(/\b(turns?|beurten|beurt)(\d)/gi, "$1 $2").replace(/\s+([,.;:!?])/g, "$1").replace(/\s{2,}/g, " ");
    const L = C.t, names = this._aiNameRe(C), luckCard = card?.view === "luck";
    const parts = [
      "(?<turn>\\b(?:turns?|beurten|beurt|rolls?|round)\\s+\\d+\\b)", "(?<setup>\\bset-?up\\b|\\bopzet\\b)",
      "(?<pct>(?:[+\\u2212\\-\\u2013]\\s?)?\\d+(?:[.,]\\d+)?\\s?%)", "(?<res>\\b(?:ore|grain|wheat|wool|sheep|lumber|wood|brick|erts|graan|tarwe|wol|schaap|hout|baksteen)\\s+\\d{1,2}\\b)",
      "(?<pts>\\b\\d+(?:[\\u2013\\-]\\d+)?\\s+(?:points?|punten|pt)\\b|\\bpoint cards?\\b|\\bpuntenkaarten?\\b)",
      "(?<dec>\\b(?:decisions?|moves?|mistakes?|blunders?|beslissing(?:en)?|zetten|zet|fouten|fout)\\b)", "(?<lk>\\b(?:luck|geluk)\\b)",
    ];
    if (names.length) parts.push(`(?<nm>(?<![\\p{L}\\p{N}])(?:${names.join("|")})(?![\\p{L}\\p{N}]))`);
    const re = new RegExp(parts.join("|"), "giu"), E = esc(text);
    const seatOf = (word) => { const w = word.toLowerCase(); return this.players.find((p) => esc(C.nmRaw(p.id)).toLowerCase() === w || esc(p.name || "").toLowerCase() === w)?.id; };
    // a reference is a link (a span with a role, styled as a chip or underlined) when links are on; plain styled text otherwise (inside a button)
    const lk = (attr, cls, inner) => (links ? `<span role="button" tabindex="0" class="ai-l ${cls}" ${attr}>${inner}</span>` : `<span class="${cls}">${inner}</span>`);
    let seenDec = false;
    const html = E.replace(re, (m, ...a) => {
      const g = a[a.length - 1];
      if (g.turn) { const k = parseInt(m.match(/\d+/)[0], 10); return lk(`data-ait="${k}"`, "ai-t", m.replace(/^./, (c) => c.toUpperCase())); }
      if (g.setup) return lk('data-ait="0"', "ai-t", L.setup);
      if (g.res) { const [w, v] = m.split(/\s+/); const rs = RESN[w.toLowerCase()] || "ore"; return lk(`data-aispot="${rs}:${v}"`, `ai-r r-${rs}`, m); }
      if (g.pts) return lk("data-aipts", "ai-p", m);
      if (g.dec) { if (seenDec || !card?.dec || !links) return m; seenDec = true; return lk(`data-aidec="${card.focus}"`, "ai-d", m); }
      if (g.lk) return luckCard ? lk("data-ailuck", "ai-d", m) : m;
      if (g.nm) { const s = seatOf(m); return s == null ? m : lk(`data-aipl="${s}"`, `ai-n pc-${s}`, m); }
      if (g.pct) {
        const signed = /^[+\u2212\-\u2013]/.test(m.trim()), val = parseFloat(m.replace(/[^\d.,]/g, "").replace(",", ".")), hit = card?.chg?.find((c) => Math.abs(Math.abs(c.d) - val) <= 2);
        if (signed && hit && hit.d !== 0) { // a signed number is a change: the review's sign and size
          const cls = hit.d > 0 ? "up" : "dn";
          return `<b class="ai-c ${cls}">${sgn(hit.d)}%</b>`;
        }
        return luckCard ? lk("data-ailuck", "ai-v", m.trim()) : `<b class="ai-v">${m.trim()}</b>`;
      }
      return m;
    });
    return html.replace(/(<\/span>|<\/b>)([,.;:!?)])/g, "$1\u2060$2"); // punctuation never wraps alone onto the next line
  },
  /** The same formatting for a line elsewhere (the Overview's AI subtitles): no links, as it sits inside a button. */
  _aiFmtLite(text) {
    try { return this._aiFmt(text, { t: this._aiL(), lang: recapLang(), nmRaw: (q) => (this._rvIsYou(q) ? this._aiL().you : this.players[q]?.name || `Player ${q + 1}`) }, null, { links: false }); } catch (_) { return esc(text); }
  },

  // ── cards ──
  _aiChgChips(card, C) {
    return card.chg.filter((c) => c.d).map((c) => { const you = this._rvIsYou(c.seat), cls = c.d > 0 ? "up" : "dn"; const nm = C.nmRaw(c.seat); const short = nm.length > 9 ? `${nm.slice(0, 8)}\u2026` : nm;
      const small = c.move ? (you ? C.t.mine : C.t.move) : c.luck ? C.t.luck.toLowerCase() : "";
      return `<button type="button" class="ai-chg ${cls}${you ? "" : " opp"} pc-${c.seat}" ${card.focus != null && !c.luck ? `data-ait="${card.focus}"` : c.luck ? "data-ailuck" : ""} title="${esc(nm)} \u00b7 ${esc(c.luck ? C.t.luck : c.move ? C.t.move : C.t.win)}${c.from != null ? ` ${c.from}% \u2192 ${c.to}%` : ""}"><i class="ai-dot" aria-hidden="true"></i>${you ? "" : `<span>${esc(short)}</span>`}<b>${sgn(c.d)}%</b>${small ? `<small>${esc(small)}</small>` : ""}</button>`; }).join("");
  },
  _aiDecAt(T, C) { const l = C.decs.filter((x) => x.turn === T).sort((a, b) => (b.own - a.own) || (b.gap - a.gap)); return l[0] || null; },
  _aiCardHtml(card, C, o = {}) {
    const L = C.t, vis = this._aiVisual(card, C, o.seen), key = o.key ?? "";
    (this._aiSrc ||= new Map()).set(key, { text: card.text, card, max: o.q ? 3 : 2 });
    const dec = card.focus != null ? this._aiDecAt(card.focus, C) : null;
    const canWhy = card.level === "decision" && dec?.own && this._rvIsYou(C.pid) && this._exCan?.(dec.d);
    const acts = `${canWhy ? `<button type="button" class="ai-a" data-aiwhy="${card.focus}">${L.why}</button>` : ""}${card.focus != null ? `<button type="button" class="ai-a" data-aigo="${card.focus}">${L.show}</button>` : ""}`;
    const tag = o.q ? `<span class="ai-lv q">${esc(o.q)}</span>` : `<span class="ai-lv lv-${card.level}">${L.lv[card.level]}</span>`;
    const pin = o.pin != null ? `<button type="button" class="ai-pin${o.pin ? " on" : ""}" data-aipin="${o.idx}" aria-pressed="${!!o.pin}" aria-label="${o.pin ? L.unpin : L.pin}" title="${o.pin ? L.unpin : L.pin}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 14v7" fill="${o.pin ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : "";
    const pts = card.points?.length ? `<div class="ai-pts">${card.points.map((p) => `<span>${this._aiFmt(p, C, card)}</span>`).join("")}</div>` : "";
    return `<section class="ai-c lvl-${card.level}${o.q ? " ans" : ""}" data-aic="${key}" data-aifocus="${card.focus ?? ""}">
      <div class="ai-hd">${tag}${this._aiChgChips(card, C)}${pin}</div>
      ${card.title ? `<b class="ai-ti">${this._aiFmt(card.title, C, card)}</b>` : ""}
      ${card.text ? `<div class="ai-tx" data-aitx="${key}" lang="${C.lang}">${this._aiFmt(card.text, C, card)}</div>` : ""}${pts}
      ${vis}${acts ? `<div class="ai-ac">${acts}</div>` : ""}</section>`;
  },
  _aiSeatRows(card, C) { return card.seats.length >= 2 ? card.seats : this.players.map((p) => p.id); },
  /** One visual per card, never the same visual with the same data twice in the tab. A decision always shows its board (A better, B played). */
  _aiVisual(card, C, seen = new Set()) {
    try {
      const T0 = card.focus ?? card.turns[0];
      const view = card.level === "decision" && T0 != null && C.st ? "board" : card.view;
      if (view === "points") return ""; // the Overview already shows the points
      if (view === "plan" && card.level !== "strategy") return "";
      const key = view === "board" ? `board${T0}` : view === "winchance" ? `win${card.seats.join()}|${card.turns.join()}` : view === "moves" ? `mv${card.turns.join()}` : view;
      if (view !== "none" && seen.has(key)) return "";
      const out = this._aiVisualOf({ ...card, view }, C);
      if (out && view !== "none") seen.add(key);
      return out;
    } catch (e) { console.warn("ai visual", e); return ""; }
  },
  _aiVisualOf(card, C) {
    try {
      switch (card.view) {
        case "winchance": return this._aiVWin(card, C);
        case "luck": return this._aiVLuck(card, C);
        case "points": return this._aiVPoints(card, C);
        case "plan": return this._aiVPlan(card, C);
        case "board": return this._aiVBoard(card, C);
        case "moves": return this._aiVMoves(card, C);
        default: return "";
      }
    } catch (e) { console.warn("ai visual", e); return ""; }
  },
  _aiVWin(card, C) {
    const ser = C.ser; if (ser.by.size < 2) return "";
    let seats = card.seats.length ? card.seats.slice(0, 3) : [C.me]; if (!seats.includes(C.me) && seats.length < 3 && !card.seats.length) seats = [C.me];
    let t0 = 0, t1 = C.maxT;
    if (card.turns.length) { t0 = Math.max(0, Math.min(...card.turns) - 4); t1 = Math.min(C.maxT, Math.max(...card.turns) + 4); if (t1 - t0 < 8) { t1 = Math.min(C.maxT, t0 + 8); t0 = Math.max(0, t1 - 8); } }
    const ts = [...ser.by.keys()].filter((t) => t >= t0 && t <= t1).sort((a, b) => a - b);
    if (ts.length < 2) return "";
    const lines = seats.map((s) => ({ s, p: ts.map((t) => [t, Math.round((ser.by.get(t)[s] ?? 0) * 100)]) }));
    const all = lines.flatMap((l) => l.p.map((q) => q[1]));
    let lo = Math.max(0, Math.floor((Math.min(...all) - 5) / 10) * 10), hi = Math.min(100, Math.ceil((Math.max(...all) + 5) / 10) * 10); if (hi - lo < 20) { hi = Math.min(100, lo + 20); lo = Math.max(0, hi - 20); }
    const W = 320, H = 136, l = 30, r = 14, tp = 22, b = 22, x = (t) => l + ((t - t0) / Math.max(1, t1 - t0)) * (W - l - r), y = (v) => H - b - ((v - lo) / (hi - lo)) * (H - tp - b);
    const grid = [lo, (lo + hi) / 2, hi].map((v) => `<line x1="${l}" x2="${W - r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="g"/><text x="${l - 4}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${Math.round(v)}%</text>`).join("");
    const paths = lines.map((ln) => `<path class="pc-${ln.s}" d="${ln.p.map((q, i) => `${i ? "L" : "M"}${x(q[0]).toFixed(1)} ${y(q[1]).toFixed(1)}`).join("")}" fill="none"/>`).join("");
    const mt = [...new Set([card.focus, ...card.turns].filter((t) => t != null && t >= t0 && t <= t1))].slice(0, 3);
    // adjacent turns (T10, T11) are one marker: "T10\u201311", so the labels never crowd
    const groups = []; mt.sort((a, c) => a - c).forEach((t) => { const g = groups[groups.length - 1]; if (g && t - g[g.length - 1] <= 2) g.push(t); else groups.push([t]); });
    let lastX = -99, flip = false;
    const marks = groups.map((gr) => {
      const t = gr[0], v = wcAt(ser, seats[0], t); if (v == null) return "";
      const lab = (a) => (a === 0 ? C.t.setup : `T${a}`), tx = gr.length > 1 ? `${lab(gr[0])}\u2013${gr[gr.length - 1]}` : lab(t);
      const cxs = gr.map((q) => x(q)), cx = cxs.reduce((a, c) => a + c, 0) / cxs.length, cy = y(wcAt(ser, seats[0], t)), w = tx.length * 6.4 + 12;
      flip = Math.abs(cx - lastX) < w + 4 ? !flip : false; lastX = cx;
      let ly = flip || cy < tp + 6 ? cy + 10 : cy - 24; if (cy < tp + 6 && flip) ly = cy + 22;
      ly = Math.max(2, Math.min(H - b - 14, ly));
      const lx = Math.max(2, Math.min(W - w - 2, cx - w / 2));
      const dots = gr.map((q) => { const vq = wcAt(ser, seats[0], q); return vq == null ? "" : `<circle cx="${x(q).toFixed(1)}" cy="${y(vq).toFixed(1)}" r="4.2" class="d"/>`; }).join("");
      return `<g class="mk pc-${seats[0]}" data-ait="${t}" role="button" tabindex="0" aria-label="${esc(tx)} ${v}%"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${gr.length > 1 ? 24 : 15}" class="hit"/>${dots}<rect x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" width="${w.toFixed(1)}" height="14" rx="7"/><text x="${(lx + w / 2).toFixed(1)}" y="${(ly + 10).toFixed(1)}" text-anchor="middle">${tx}</text></g>`;
    }).join("");
    const xl = `<text x="${l}" y="${H - 6}" text-anchor="start">${t0 ? "T" + t0 : C.t.setup}</text><text x="${W - r}" y="${H - 6}" text-anchor="end">T${t1}</text>`;
    const leg = seats.length > 1 ? `<div class="ai-leg">${seats.map((s) => `<span class="pc-${s}"><i class="ai-dot"></i>${esc(C.nmRaw(s))}</span>`).join("")}</div>` : "";
    return `<div class="ai-vz"><svg class="ai-wc" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(C.t.win)}">${grid}${paths}${marks}${xl}</svg>${leg}</div>`;
  },
  _aiVLuck(card, C) {
    if (!C.luck) return "";
    const seats = this._aiSeatRows(card, C), vals = seats.map((s) => (C.luck[s] ?? 0) * 100), max = Math.max(4, ...vals.map(Math.abs));
    return `<div class="ai-vz ai-bars">${seats.map((s, i) => { const v = vals[i], w = Math.min(50, (Math.abs(v) / max) * 50);
      return `<div class="ai-br pc-${s}"><span class="n">${esc(C.nmRaw(s))}</span><span class="tr"><i class="z"></i><i class="b ${v < 0 ? "neg" : "pos"}" style="${v < 0 ? `right:50%;` : `left:50%;`}width:${w.toFixed(1)}%"></i></span><b class="${v > 0.4 ? "up" : v < -0.4 ? "dn" : ""}">${sgn(v)}%</b></div>`; }).join("")}</div>`;
  },
  _aiVPoints(card, C) {
    const src = C.st?.sources; if (!src) return "";
    const seats = this._aiSeatRows(card, C), mx = Math.max(this.winPoints || 10, ...src.map((s) => s.total)), used = SRC.filter(([k]) => src.some((s) => s[k] > 0));
    const rows = seats.map((s) => `<div class="ai-br pc-${s}"><span class="n">${esc(C.nmRaw(s))}</span><span class="tr st">${used.map(([k, c]) => (src[s][k] > 0 ? `<i class="s-${c}" style="width:${((src[s][k] / mx) * 100).toFixed(1)}%" title="${esc(C.t.legend[c] || k)} ${src[s][k]}"></i>` : "")).join("")}</span><b>${src[s].total}</b></div>`).join("");
    return `<div class="ai-vz ai-bars">${rows}<div class="ai-leg">${used.map(([k, c]) => `<span><i class="sw s-${c}"></i>${esc(C.t.legend[c] || k)}</span>`).join("")}</div></div>`;
  },
  _aiVPlan(card, C) {
    const seats = this._aiSeatRows(card, C), W = 250, H = 22, mx = Math.max(1, C.maxT), x = (t) => 7 + (t / mx) * (W - 14);
    const icon = (k, cx, cy) => ({
      s: `<path d="M${cx - 4} ${cy + 4}V${cy - 1}L${cx} ${cy - 5}L${cx + 4} ${cy - 1}V${cy + 4}Z" class="f"/>`,
      c: `<path d="M${cx - 5} ${cy + 5}V${cy - 2}H${cx - 1}V${cy - 6}H${cx + 5}V${cy + 5}Z" class="f"/>`,
      L: `<path d="M${cx - 5} ${cy + 3}L${cx - 1} ${cy - 2}L${cx + 1} ${cy + 2}L${cx + 5} ${cy - 3}" class="l"/>`,
      A: `<path d="M${cx} ${cy - 5}L${cx + 4.5} ${cy - 3}V${cy + 1}Q${cx + 4} ${cy + 4} ${cx} ${cy + 6}Q${cx - 4} ${cy + 4} ${cx - 4.5} ${cy + 1}V${cy - 3}Z" class="a"/>`,
      v: `<path d="M${cx} ${cy - 5.5}L${cx + 1.6} ${cy - 1.7}L${cx + 5.5} ${cy - 1.4}L${cx + 2.5} ${cy + 1.2}L${cx + 3.4} ${cy + 5}L${cx} ${cy + 3}L${cx - 3.4} ${cy + 5}L${cx - 2.5} ${cy + 1.2}L${cx - 5.5} ${cy - 1.4}L${cx - 1.6} ${cy - 1.7}Z" class="v"/>`,
    }[k]);
    const band = card.turns.length ? `<rect class="bd" x="${(x(Math.min(...card.turns)) - 4).toFixed(1)}" y="0" width="${(x(Math.max(...card.turns)) - x(Math.min(...card.turns)) + 8).toFixed(1)}" height="${H}" rx="4"/>` : "";
    const rows = seats.map((s) => { let last = -99; const ic = C.tl[s].map(([t, k]) => { let cx = x(t); if (cx - last < 9) cx = last + 9; last = cx; return icon(k, Math.min(W - 6, cx).toFixed(1) * 1, 11); }).join("");
      return `<div class="ai-pr pc-${s}"><span class="n">${esc(C.nmRaw(s))}</span><svg viewBox="0 0 ${W} ${H}" aria-label="${esc(C.nmRaw(s))}">${band}<line x1="4" x2="${W - 4}" y1="11" y2="11" class="ln"/>${ic}</svg></div>`; }).join("");
    const used = new Set(C.tl.flat().map((q) => q[1]));
    return `<div class="ai-vz ai-plan">${rows}<div class="ai-leg">${["s", "c", "L", "A", "v"].filter((k) => used.has(k)).map((k) => `<span><svg viewBox="0 0 14 14" width="12" height="12">${icon(k, 7, 7)}</svg>${esc(C.t.legend[k])}</span>`).join("")}</div></div>`;
  },
  _aiVMoves(card, C) {
    const set = new Set([card.focus, ...card.turns].filter((t) => t != null));
    let rows = C.decs.filter((x) => set.has(x.turn)).sort((a, b) => (b.own - a.own) || (b.gap - a.gap)).slice(0, 3);
    if (!rows.length) rows = C.decs.filter((x) => x.own).sort((a, b) => b.gap - a.gap).slice(0, 3);
    if (!rows.length) return "";
    const cl = (s) => esc(String(s ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/<[^>]+>/g, "").slice(0, 60));
    return `<div class="ai-vz ai-mv">${rows.map((x) => `<div class="ai-mr pc-${x.seat}"><button type="button" class="ai-t" data-ait="${x.turn}">${x.turn === 0 ? C.t.setup : `T${x.turn}`}</button>${x.own ? "" : `<i class="ai-dot"></i>`}<span class="mt"><s>${cl(x.d.x.label)}</s> → <b>${cl(x.d.x.best.label)}</b></span><em class="dn">${sgn(-x.gap * 100)}%</em></div>`).join("")}</div>`;
  },
  _aiVBoard(card, C) {
    const T0 = card.focus ?? card.turns[0]; if (T0 == null || !C.st) return "";
    const d = this._aiDecAt(T0, C);
    return `<div class="ai-vz"><div class="ai-bd" data-aibd="${T0}"><span class="ai-bdw">…</span></div>${d ? `<div class="ai-leg" data-aileg hidden><span><s class="rg a">A</s>${esc(C.t.better)}</span><span><s class="rg b">B</s>${esc(C.t.played)}</span></div>` : ""}</div>`;
  },
  /** The board at the turn as a picture (the Replay's renderer into an off-screen canvas), zoomed to the decision's A and B, or what was built. */
  _aiShot(T0, C, w, h) {
    const key = `${this._rvPid}|${T0}|${w}`; this._aiImgs ||= new Map();
    if (this._aiImgs.has(key)) return this._aiImgs.get(key);
    const g = this.geometry, st = this._st; if (!g || !st) return null;
    const d = this._aiDecAt(T0, C)?.d, cv = document.createElement("canvas"); let out = null;
    this._rpOpen(cv, w, h);
    try {
      let A = null, B = null, pts = [];
      if (d) {
        const rec = this._rv.recs[d.i]; this._rpSeek(rec.s, rec.e);
        A = d.x.best?.focus; B = d.x.focus;
        const W = d.x.why?.mark; pts = [A, B, ...(W ? [...(W.nodes || []).map((node) => ({ node })), ...(W.edges || []).map((edge) => ({ edge }))] : [])].filter(Boolean).map((f) => rvPos(g, f));
      } else {
        let k = 0; for (let q = 1; q <= st.N; q++) if ((st.turnOf[q] ?? 0) === T0) k = q;
        this._rpSeek(k);
        for (let q = 1; q <= st.N; q++) if ((st.turnOf[q] ?? 0) === T0) (st.stepEvents[q] || []).forEach((e) => { if (e[1] === "b") { const f = e[3] === "r" || e[3] === "h" ? { edge: e[4] } : { node: e[4] }; try { pts.push(rvPos(g, f)); } catch (_) { /* skip */ } } });
      }
      const fit = this._rpFitView(w, h, 8);
      if (pts.length) {
        const m = g.hexSize * 1.7, xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), minX = Math.min(...xs) - m, maxX = Math.max(...xs) + m, minY = Math.min(...ys) - m, maxY = Math.max(...ys) + m;
        const sc = Math.min(Math.max(Math.min(w / (maxX - minX), h / (maxY - minY)), fit.scale * 1.15), fit.scale * 2.8);
        this.view = { scale: sc, offsetX: w / 2 - ((minX + maxX) / 2) * sc, offsetY: h / 2 - ((minY + maxY) / 2) * sc };
      }
      this.boardRenderer?.resync?.(); this.boardRenderer?.invalidateStatic?.();
      if (this.boardRenderer) { this.boardRenderer.anims = []; this.boardRenderer.draw(performance.now()); } else this.drawCanvasScene(); // synchronous: requestDraw would paint after the canvas is read
      out = { url: cv.toDataURL("image/png"), marks: d ? rvMarks(this, d, A, B) : "", w, h };
    } catch (e) { console.warn("ai board", e); } finally { try { this._rpClose(); } catch (_) { /* none open */ } }
    if (out) this._aiImgs.set(key, out);
    return out;
  },
  _aiBoards(root) {
    const els = [...root.querySelectorAll("[data-aibd]:not([data-done])")]; if (!els.length) return;
    const C = this._aiCtx(), R = this._rv;
    const next = () => {
      const el = els.shift(); if (!el || !el.isConnected || this._rv !== R) return;
      const w = Math.max(200, Math.round(el.getBoundingClientRect().width)), h = Math.round(w * 0.62);
      const s = this._aiShot(+el.dataset.aibd, C, w, h);
      el.dataset.done = "1";
      if (s?.marks) el.closest(".ai-vz")?.querySelector("[data-aileg]")?.removeAttribute("hidden"); // A / B only where the move has a place on the board
      if (s) { el.style.aspectRatio = `${w} / ${h}`; el.innerHTML = `<img src="${s.url}" alt="" width="${w}" height="${h}"><svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${s.marks}</svg>`; } else el.closest(".ai-vz")?.remove();
      setTimeout(next, 20);
      if (!els.length) { const r = this._aiRestore, sc = this._rvEl?.querySelector(".rv-scroll"); if (r && sc && Date.now() < r.until) sc.scrollTop = r.y; this._aiRestore = null; } // the boards changed the heights: the same place again
    };
    setTimeout(next, 30);
  },

  // ── the tab ──
  _rvTabAi() {
    const U = this._aiUi?.pid === this._rvPid ? this._aiUi : null; // (the insights are asked for on opening the tab, once; an error waits for "Try again")
    if (!this._aiSaved() && !U?.loading && !U?.err) setTimeout(() => { if (this._rvTab === "ai" && !this._aiSaved()) this._aiRun(false); }, 0);
    return { html: `<div class="ai" data-aibody>${this._aiBodyHtml()}</div>`, foot: `<div data-aiask>${this._aiAskHtml()}</div>`, bind: (el) => this._aiBind(el) };
  },
  _aiErrHtml(C) { const e = this._aiUi?.err; return e ? `<section class="ai-c err" role="alert"><b class="ai-ti">${esc(C.t[e] || C.t.fail)}</b><div class="ai-ac"><button type="button" class="ai-a" data-airun>${C.t.again}</button></div></section>` : ""; },
  _aiBodyHtml() {
    const C = this._aiCtx(), L = C.t, S = this._aiSaved(), U = this._aiUi || {}, R = this._rv;
    const ans = (R.ai?.pid === C.pid && R.ai?.lang === C.lang ? R.ai.answers : (R.ai?.answers || []).filter((a) => a.pinned)) || [];
    const out = [], seen = new Set(); this._aiSrc = new Map();
    if (U.loading === "ask") out.push(`<section class="ai-c ans pend" aria-busy="true"><div class="ai-hd"><span class="ai-lv q">${esc(U.q || "")}</span></div><div class="ai-sk"><i></i><i></i></div></section>`);
    if (U.askErr) out.push(`<section class="ai-c err" role="alert"><b class="ai-ti">${esc(L[U.askErr] || L.fail)}</b></section>`);
    ans.forEach((a, i) => { const card = this._aiCard(a.a, C, { answer: true }); out.push(this._aiCardHtml(card, C, { q: a.q, pin: !!a.pinned, idx: i, key: `a${i}`, seen })); });
    if (S) {
      if (S.insights.headline) out.push(`<p class="ai-hl" data-aitx="hl" lang="${C.lang}">${this._aiFmt(S.insights.headline, C)}</p>`); this._aiSrc.set("hl", { text: S.insights.headline, card: null, max: 2 });
      S.insights.cards.forEach((c, i) => out.push(this._aiCardHtml(this._aiCard(c, C), C, { key: `c${i}`, seen })));
      out.push(`<p class="ai-ft"><span>${L.foot}</span>${online() ? `<button type="button" class="ai-rg" data-airun="1">${L.regen}</button>` : ""}</p>`);
    } else if (U.loading === "insights") out.push(`<p class="ai-hl sk">${L.wait}</p>${'<section class="ai-c" aria-busy="true"><div class="ai-sk"><i></i><i></i></div><div class="ai-skv"></div></section>'.repeat(3)}`);
    else if (U.err) out.push(this._aiErrHtml(C));
    return out.join("");
  },
  _aiAskHtml() {
    const C = { t: this._aiL() }, S = this._aiSaved(), L = C.t, R = this._rv;
    const asked = new Set((R.ai?.answers || []).map((a) => qkey(a.q)));
    const lastA = (R.ai?.answers || [])[0], src = [...(lastA?.followUps || []), ...(S?.insights?.followUps || [])];
    const chips = []; src.forEach((q) => { const c = aiChip(q); if (c && !asked.has(qkey(q)) && !chips.some((x) => x.c === c)) chips.push({ c, q: String(q).slice(0, 300) }); });
    if (S && !chips.length) { const lg = recapLang(), fb = FALLBACK[lg] || FALLBACK.en, fq = FALLQ[lg] || FALLQ.en; fb.forEach((c, i) => { if (!asked.has(qkey(fq[i]))) chips.push({ c, q: fq[i] }); }); }
    const busy = this._aiUi?.loading === "ask";
    return `<form class="ai-ask" data-aiform>${chips.length && S ? `<div class="ai-chips">${chips.slice(0, 3).map((x) => `<button type="button" class="ai-q" data-aiq="${esc(x.q)}"${busy ? " disabled" : ""}>${esc(x.c)}</button>`).join("")}</div>` : ""}
      <div class="ai-in"><input type="text" maxlength="300" enterkeyhint="send" autocomplete="off" placeholder="${esc(L.ph)}" aria-label="${esc(L.ph)}" data-aiin${busy || !S ? " disabled" : ""}><button type="submit" class="rv-btn pri"${busy || !S ? " disabled" : ""}>${L.ask}</button></div></form>`;
  },
  _aiRefresh() {
    const el = this._rvEl; if (!el || this._rvTab !== "ai" || this._rvStep != null) return;
    const body = el.querySelector("[data-aibody]"), ask = el.querySelector("[data-aiask]"); if (!body || !ask) return;
    const kept = ask.querySelector("[data-aiin]")?.value;
    body.innerHTML = this._aiBodyHtml(); ask.innerHTML = this._aiAskHtml();
    if (kept) { const i = ask.querySelector("[data-aiin]"); if (i && !i.disabled) i.value = kept; }
    this._aiBind(el);
  },
  _aiBind(el) {
    const body = el.querySelector("[data-aibody]"), ask = el.querySelector("[data-aiask]"); if (!body) return;
    const on = (sel, fn, sc = body) => sc.querySelectorAll(sel).forEach((b) => { const f = (e) => { e.stopPropagation(); fn(b, e); }; b.addEventListener("click", f); if (b.getAttribute("role") === "button" && b.tagName !== "BUTTON") b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f(e); } }); });
    const T0 = (b) => parseInt(b.dataset.ait ?? b.dataset.aigo ?? b.dataset.aidec ?? b.dataset.aiwhy, 10);
    const wire = (sc) => {
    on("[data-ait]", (b) => this._aiNav(() => this._rcGoTurn(T0(b), null, false)), sc);
    on("[data-aigo]", (b) => this._aiNav(() => this._rcGoTurn(T0(b), null, false)), sc);
    on("[data-aiwhy], [data-aidec]", (b) => this._aiNav(() => this._rcGoTurn(T0(b), null, true)), sc);
    on("[data-aipl]", (b) => this._aiNav(() => this._aiPlayer(+b.dataset.aipl)), sc);
    on("[data-ailuck]", () => { this._rvTab = "luck"; this._rvDrawReview(); }, sc);
    on("[data-aipts]", (b) => { const v = b.closest(".ai-c")?.querySelector(".ai-plan, .ai-bars"); if (v) { v.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); v.classList.remove("flash"); void v.offsetWidth; v.classList.add("flash"); } else { this._rvTab = "overview"; this._rvDrawReview(); } }, sc);
    on("[data-aispot]", (b) => { const [rs, nm] = b.dataset.aispot.split(":"), c = b.closest("[data-aic]"), t = c?.dataset.aifocus; this._aiNav(() => this._aiSpot(rs, +nm, t != null && t !== "" ? +t : null)); }, sc);
    };
    this._aiClamp(body, wire); wire(body);
    body.querySelectorAll("[data-airun]").forEach((b) => b.addEventListener("click", () => this._aiRun(true)));
    body.querySelectorAll("[data-aipin]").forEach((b) => b.addEventListener("click", () => { const a = this._rv.ai?.answers?.[+b.dataset.aipin]; if (!a) return; a.pinned = !a.pinned; this._aiSave(); this._aiRefresh(); }));
    ask?.querySelector("[data-aiform]")?.addEventListener("submit", (e) => { e.preventDefault(); const v = ask.querySelector("[data-aiin]").value.trim(); if (v) this._aiAsk(v.slice(0, 300)); });
    ask?.querySelectorAll("[data-aiq]").forEach((b) => b.addEventListener("click", () => this._aiAsk(b.dataset.aiq)));
    this._aiBoards(body);
    if (this._aiScrollY != null) { const sc = el.querySelector(".rv-scroll"), y = this._aiScrollY; if (sc) { sc.scrollTop = y; this._aiRestore = { y, until: Date.now() + 2500 }; } this._aiScrollY = null; } // Back from a link: the same place
  },
  /** Body copy: at most 2 lines (an answer 3), cut at a word with no ellipsis and a "more" link that shows it all. */
  _aiClamp(body, wire) {
    const els = [...body.querySelectorAll("[data-aitx]")]; if (!els.length || !this._aiSrc) return;
    const C = this._aiCtx(), L = C.t;
    els.forEach((el) => {
      const src = this._aiSrc.get(el.dataset.aitx); if (!src?.text || el.getBoundingClientRect().width < 40) return;
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 17, lim = lh * src.max + 3, fmt = (t) => this._aiFmt(t, C, src.card);
      const full = fmt(src.text), more = (t, k, lab) => ` <button type="button" class="ai-more" data-aimore="${k}">${lab}</button>`;
      el.innerHTML = full; if (el.getBoundingClientRect().height <= lim) return;
      const words = src.text.trim().split(/\s+/), draw = (m) => { el.innerHTML = fmt(words.slice(0, m).join(" ").replace(/[\s,;:\u2013\u2014-]+$/, "").replace(/\u2026$/, "")) + more(0, "1", L.more); return el.getBoundingClientRect().height <= lim; };
      let lo = 1, hi = words.length - 1, best = 1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (draw(mid)) { best = mid; lo = mid + 1; } else hi = mid - 1; }
      for (let m = best; m >= Math.ceil(best * 0.6) && m > 1; m--) if (/[.,;:!?]$/.test(words[m - 1])) { best = m; break; } // prefer a clause end
      draw(best);
      const toggle = (open) => { el.innerHTML = open ? full + more(0, "0", L.less) : (draw(best), el.innerHTML); wire(el); el.querySelector("[data-aimore]")?.addEventListener("click", (e) => { e.stopPropagation(); toggle(!open); }); };
      el.querySelector("[data-aimore]").addEventListener("click", (e) => { e.stopPropagation(); toggle(true); });
    });
  },
  /** Leave for a link target: Back returns to the AI tab, at this scroll position. */
  _aiNav(fn) { this._aiScrollY = this._rvEl?.querySelector(".rv-scroll")?.scrollTop ?? 0; try { fn(); } catch (e) { console.warn("ai link", e); } },
  /** A player's page in the review; its Back returns here. */
  _aiPlayer(seat) { const me = this._rvPid; this._aiBack = { pid: me, R: this._rv }; this._aiKeep = true; try { this._rvOpenReview(seat, { tab: "player" }); } finally { this._aiKeep = false; } },
  /** The board at the turn (the step view), with the hexes of that resource and number ringed. */
  _aiSpot(rs, num, T) {
    this._rcGoTurn(T ?? this.turn ?? 0, null, false);
    setTimeout(() => {
      const svg = this._rvEl?.querySelector(".rs-marks"), V = this.view; if (!svg || !V) return;
      const w = svg.viewBox.baseVal.width, h = svg.viewBox.baseVal.height;
      this.geometry.hexes.filter((x) => x.resource === rs && x.number === num).forEach((x) => { const cx = x.center.x * V.scale + V.offsetX, cy = x.center.y * V.scale + V.offsetY; if (cx < -10 || cy < -10 || cx > w + 10 || cy > h + 10) return;
        svg.insertAdjacentHTML("beforeend", `<g class="ai-spot"><circle cx="${cx}" cy="${cy}" r="${this.geometry.hexSize * V.scale * 0.55}" fill="none" stroke="#fff" stroke-width="7"/><circle cx="${cx}" cy="${cy}" r="${this.geometry.hexSize * V.scale * 0.55}" fill="none" stroke="#E0A82E" stroke-width="3.5" stroke-dasharray="2 5" stroke-linecap="round"/></g>`); });
    }, 400);
  },
  _aiSave() { try { this._rvSave?.(); } catch (_) { /* best effort */ } try { this._histSoon?.(); } catch (_) { /* best effort */ } },
  async _aiCall(body, ms) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(RECAP_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
      let j = null; try { j = await r.json(); } catch (_) { j = null; }
      if (r.status === 429) return { err: "rate" };
      if (!r.ok || !j?.explain) return { err: "fail" };
      return { x: j.explain };
    } catch (e) { return { err: e?.name === "AbortError" ? "time" : "net" }; } finally { clearTimeout(to); }
  },
  async _aiRun(force) {
    const R = this._rv, pid = this._rvPid, lang = recapLang();
    if (!R || !this.winner || this._aiUi?.loading === "insights") return;
    if (!online()) { this._aiUi = { pid, err: "net" }; this._aiRefresh(); return; }
    let f = null; try { f = aiFacts(this); } catch (_) { f = null; }
    if (!f) { this._aiUi = { pid, err: "none" }; this._aiRefresh(); return; }
    this._aiUi = { pid, loading: "insights", err: null }; this._aiRefresh();
    const r = await this._aiCall({ mode: "insights", lang, facts: f.json }, 70000);
    if (this._rv !== R) return;
    const cards = Array.isArray(r.x?.cards) ? r.x.cards.filter((c) => c && typeof c === "object" && (c.title || c.text)).slice(0, 10) : [];
    if (r.x && !cards.length && !r.err) r.err = "fail";
    if (r.err) { this._aiUi = { pid, err: r.err }; this._aiRefresh(); return; }
    const keep = (R.ai?.answers || []).filter((a) => a.pinned || (!force && R.ai?.pid === pid && R.ai?.lang === lang));
    R.ai = { pid, lang, at: Date.now(), n: f.json.length, insights: { headline: String(r.x.headline || "").slice(0, 200), cards: cards.map((c) => ({ level: c.level, title: c.title, text: c.text, view: c.view, turns: c.turns, focusTurn: c.focusTurn, players: c.players })), followUps: (r.x.followUps || []).map(String).slice(0, 8) }, answers: keep };
    this._aiUi = { pid, loading: null, err: null };
    this._aiSave(); this._aiRefresh();
  },
  async _aiAsk(q) {
    const R = this._rv, pid = this._rvPid, lang = recapLang();
    if (!R || !q || this._aiUi?.loading === "ask") return;
    const ai = R.ai; if (!ai) return;
    const hit = ai.answers.findIndex((a) => qkey(a.q) === qkey(q));
    if (hit >= 0) { const [a] = ai.answers.splice(hit, 1); ai.answers.unshift(a); this._aiUi = { pid }; this._aiSave(); this._aiRefresh(); return; }
    if (!online()) { this._aiUi = { pid, askErr: "net" }; this._aiRefresh(); return; }
    let f = null; try { f = aiFacts(this); } catch (_) { f = null; }
    if (!f) { this._aiUi = { pid, askErr: "none" }; this._aiRefresh(); return; }
    this._aiUi = { pid, loading: "ask", q }; this._aiRefresh();
    const r = await this._aiCall({ mode: "game", lang, question: q, facts: f.json }, 60000);
    if (this._rv !== R) return;
    if (r.err || !r.x?.answer) { this._aiUi = { pid, askErr: r.err || "fail" }; this._aiRefresh(); return; }
    const x = r.x;
    ai.answers.unshift({ q, at: Date.now(), pinned: false, followUps: (x.followUps || []).map(String).slice(0, 6), a: { answer: String(x.answer), points: (x.points || []).map(String).slice(0, 4), view: x.view, turns: x.turns, focusTurn: x.focusTurn, players: x.players } });
    while (ai.answers.length > 12) { const i = ai.answers.map((a) => !a.pinned).lastIndexOf(true); if (i < 0) break; ai.answers.splice(i, 1); }
    this._aiUi = { pid };
    this._aiSave(); this._aiRefresh();
    this._rvEl?.querySelector(".rv-scroll")?.scrollTo?.({ top: 0 });
  },
};
// leaving or entering the network: the tab (and the Overview row) show only online
if (typeof window !== "undefined") ["online", "offline"].forEach((ev) => window.addEventListener(ev, () => { const g = window.__colonistGame; if (g?._rvEl && g._rvStep == null) tryv(() => g._rvDrawReview()); }));
