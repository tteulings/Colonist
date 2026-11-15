// v1.73 AI tab (beta): the AI reads the facts of a finished game (src/review/ai-facts.js) and answers with CARDS, each with its own
// visual (win chance line, luck / points bars, plan timeline, zoomed board, moves). The app, not the AI, decides directions and numbers:
// the real win-chance change of the card's turn is shown as a chip, and a sentence that contradicts it (or quotes a number >2 points off
// the review) is replaced by a neutral line. Insights and answers are kept in the saved review (R.ai). Online only.
import { aiFacts, aiSeries, aiTimeline, aiPlan, aiNearMiss, aiStart, aiRoute, wcAt, wcChange } from "./review/ai-facts.js";
import { decide } from "./review/evaluate.js";
import { aiIndex, aiToolRun, aiSimPlan, aiSimResult, aiIntent, aiIntentArgs, aiCantMsg, aiSlimDecision, aiKindOf, aiDecList, TIER2, CAPS } from "./review/ai-tools.js";
import { reviewRequest, reviewLaneCount, reviewAvailable } from "./master.js";
import { RECAP_URL, recapLang } from "./review-recap.js";
import { swingCause } from "./review/ai-cause.js";
import { rvPos, rvMarks } from "./review-game.js";
import { aiBlocks, legacyBlocks, textOf, decMoves, spotFocus } from "./review/ai-blocks.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
const sgn = (v) => { const r = Math.round(v); return r > 0 ? `+${r}` : r < 0 ? `\u2212${-r}` : "0"; };
const VIEWS = ["winchance", "luck", "points", "plan", "board", "moves", "nearmiss", "none"];
const LEVELS = ["game", "decision", "strategy"];
const T = {
  en: { lv: { game: "Game", decision: "Decision", strategy: "Strategy" }, why: "Why?", show: "Show in review", turn: "Turn", setup: "Set-up", ask: "Ask", ph: "Ask about this game…", regen: "Regenerate", foot: "Written by AI from this review · numbers by the app · may contain mistakes",
    wait: "Reading the game…", again: "Try again", pin: "Keep this answer", unpin: "Unpin", win: "win chance", you: "You", better: "A better", played: "B played", mine: "your move", your: "your", move: "move", cost: "cost", onT: "On turn", atSetup: "At set-up", rose: "rose", fell: "fell", more: "more", less: "less", tab: "AI · beta",
    rate: "The AI is busy right now (too many requests). Try again in a minute.", time: "That took too long. Try again.", net: "No connection. Check your internet and try again.", fail: "No answer this time. Try again later.", none: "Not enough in this review to ask the AI.",
    luck: "Luck", pts: "Points", legend: { s: "Settlement", c: "City", L: "Longest road", A: "Largest army", v: "Point card" }, x: { goal: "Goal", ok: "worked", okLuck: "worked, with luck", dice: "dice", plan: "plan", lucky: "drawn: luck", close: "close, short", inc: "per turn", incT: "Income per turn", bnT: "outlined: bottleneck", stall: "stalled at turn", bad: "didn\u2019t work", fitTx: "of the points matched the start", need: "Needed", miss: "Missing", have: "Cards in hand", est: "turns away (estimate)", one: "turn away (estimate)", best: "Best chance", of: "points", ready: "Cards in hand", chance: "chance of a point", route: { city: "City", settlement: "Settlement", road: "Longest road", army: "Largest army", dev: "Development card" }, parts: { cities: "cities", settlements: "settlements", road: "longest road", army: "army", cards: "point cards", islands: "islands" }, res: { wood: "wood", brick: "brick", sheep: "sheep", wheat: "wheat", ore: "ore" } } },
  nl: { lv: { game: "Spel", decision: "Beslissing", strategy: "Strategie" }, why: "Waarom?", show: "Toon in review", turn: "Beurt", setup: "Opzet", ask: "Vraag", ph: "Vraag iets over dit spel…", regen: "Opnieuw", foot: "Geschreven door AI op basis van deze review · cijfers van de app · kan fouten bevatten",
    wait: "Het spel lezen…", again: "Probeer opnieuw", pin: "Bewaar dit antwoord", unpin: "Los", win: "winkans", you: "Jij", better: "A beter", played: "B gespeeld", mine: "jouw zet", your: "jouw", move: "zet", cost: "kostte", onT: "In beurt", atSetup: "Bij de opzet", rose: "steeg", fell: "daalde", more: "meer", less: "minder", tab: "AI · beta",
    rate: "De AI is nu druk (te veel verzoeken). Probeer het over een minuut opnieuw.", time: "Dat duurde te lang. Probeer opnieuw.", net: "Geen verbinding. Controleer je internet en probeer opnieuw.", fail: "Nu geen antwoord. Probeer het later opnieuw.", none: "Er staat te weinig in deze review om de AI te vragen.",
    luck: "Geluk", pts: "Punten", legend: { s: "Dorp", c: "Stad", L: "Langste weg", A: "Grootste leger", v: "Puntenkaart" }, x: { goal: "Doel", ok: "gelukt", okLuck: "gelukt, met geluk", dice: "dobbelstenen", plan: "plan", lucky: "getrokken: geluk", close: "bijna, tekort", inc: "per beurt", incT: "Inkomen per beurt", bnT: "omlijnd: knelpunt", stall: "stokte na beurt", bad: "werkte niet", fitTx: "van de punten paste bij de start", need: "Nodig", miss: "Ontbrak", have: "Kaarten in hand", est: "beurten ervandaan (schatting)", one: "beurt ervandaan (schatting)", best: "Beste kans", of: "punten", ready: "Kaarten in hand", chance: "kans op een punt", route: { city: "Stad", settlement: "Dorp", road: "Langste weg", army: "Grootste leger", dev: "Ontwikkelingskaart" }, parts: { cities: "steden", settlements: "dorpen", road: "langste weg", army: "leger", cards: "puntenkaarten", islands: "eilanden" }, res: { wood: "hout", brick: "baksteen", sheep: "wol", wheat: "graan", ore: "erts" } } },
};
const GOODT = /\b(paid off|worked|rewarded|best|great|strong|brilliant|perfect|smart|excellent|beste|geweldig|sterk|perfecte|slim|uitstekend)\b/i;
const TPOS = /\b(stayed close|stays close|kept (?:you|him|her|them|\w+) alive|good|helped|helps|comeback|rescued|saved)\b/i;
const TNEG = /\b(missed|misses|miss|wrong|mistakes?|blunders?|worst|bad|costly|errors?|poor|behind|fout|fouten|gemist|slecht|verkeerd)\b/i;
const CHAT = { en: { same: "Same view as the card above", clear: "Clear chat", pend: "Thinking…", cancel: "Cancel", review: "from your review · instant", checked: "checked by engine", eng: (n) => `engine · ${n} games`, simN: (n) => `Engine is simulating ${n} move${n === 1 ? "" : "s"} · 100 games each`, asPlayed: "As played", noise: "within noise", vs: "vs played", ratedBest: "Rated best (\u00b10): no better move found.", wouldHave: "would have given", inst: "Instead of", within: "Within noise: no clear difference.", played: "played", better: "was better", cost: "cost", wc: "win chance", asp: "as played" },
  nl: { same: "Zelfde beeld als de kaart hierboven", clear: "Chat wissen", pend: "Aan het denken…", cancel: "Annuleer", review: "uit je review · direct", checked: "gecontroleerd door engine", eng: (n) => `engine · ${n} spellen`, simN: (n) => `Engine simuleert ${n} ${n === 1 ? "zet" : "zetten"} · elk 100 spellen`, asPlayed: "Zoals gespeeld", noise: "binnen de ruis", vs: "t.o.v. gespeeld", ratedBest: "Beoordeeld als beste (\u00b10): geen betere zet gevonden.", wouldHave: "had gegeven", inst: "In plaats van", within: "Binnen de ruis: geen duidelijk verschil.", played: "speelde", better: "was beter", cost: "kostte", wc: "winkans", asp: "zoals gespeeld" } };
const CF = /\b(?:would have|would\u2019ve|would've|could have|had you|if you had|if (?:he|she|they) had|zou(?:den)? [^.]*hebben|als je [^.]*had)\b/i;
const evNums = (res) => { const A = new Set(), w = []; const walk = (v, k) => { if (typeof v === "number" && isFinite(v) && Math.abs(v) <= 100) { A.add(Math.round(Math.abs(v))); if (/win/i.test(k || "") && !/vs|plusMinus/i.test(k || "")) w.push(v); } else if (Array.isArray(v)) v.forEach((x) => walk(x, k)); else if (v && typeof v === "object") Object.entries(v).forEach(([kk, x]) => walk(x, kk)); }; walk(res, ""); w.forEach((a) => w.forEach((b) => A.add(Math.round(Math.abs(a - b))))); return [...A]; };
const posW = (t) => GOODT.test(t) || POS.test(t) || TPOS.test(t), negW = (t) => NEG.test(t) || TNEG.test(t);
const SENT_END = /[.!?]["')\u201d\u2019]*$/;
const EVEN = /\b(?:evened out|evens out|even(?:ed)?|balanced|cancel(?:led|s)? out|levell?ed|egaal|gelijk|uitgemiddeld|compens\w*)\b/i, DECIDED = /\b(?:decided|decisive|decides|settled|beslist|beslissend|besliste)\b/i;
const AGAINST = /\b(against|unlucky|unluck\w*|tegen|pech|ongelukkig)\b/i, FAVOUR = /\b(in (?:your|his|her|their) favou?r|favou?red|fortunate|lucky for|gelukkig|ten gunste|mee)\b/i;
const POS = /\b(helped|gained|gains?|stayed ahead|stays ahead|improved|improves|rose|rises|boosted|climbed|jumped|grew|surged|took the lead|pulled ahead|strengthened|increased|hielp|won|bleef voor|verbeterde|steeg|groeide|versterkte|nam de leiding|nam een voorsprong)\b/i;
const NEG = /\b(lost|loses|dropped|drops|fell|falls|hurt|cost|costs|slipped|wasted|damaged|collapsed|weakened|decreased|sank|plunged|verloor|daalde|viel|schaadde|kostte|zakte|verzwakte|verspeelde)\b/i;
const RESN = { ore: "ore", erts: "ore", grain: "wheat", wheat: "wheat", graan: "wheat", tarwe: "wheat", wool: "sheep", sheep: "sheep", wol: "sheep", schaap: "sheep", lumber: "wood", wood: "wood", hout: "wood", brick: "brick", baksteen: "brick" };
const online = () => typeof navigator === "undefined" || navigator.onLine !== false;
const qkey = (q) => String(q).trim().toLowerCase().replace(/\s+/g, " ");
const SRC = [["settlements", "s"], ["cities", "c"], ["road", "L"], ["army", "A"], ["cards", "v"], ["islands", "i"]];

/** A follow-up chip: at most 24 characters, a whole question (never cut, never a fragment); a longer or cut one gets a short app label by topic. */
const FRAG = /\b(?:i|me|my|the|a|an|of|to|in|on|at|for|and|or|but|was|were|is|are|did|do|does|how|why|what|who|ik|mijn|de|het|een|van|naar|en|of|was|waren|is|zijn)$/i;
const CHIPFB = { en: [[/\b(?:lose|lost|loss|decid|why)\b/i, "Why did I lose?"], [/luck/i, "Luck vs play?"], [/best|move|miss|mistake|setup|set-up|trade|road|city/i, "Best move?"]], nl: [[/verlo|waarom|besliss/i, "Waarom verloren?"], [/geluk|pech/i, "Geluk of spel?"], [/beste|zet|fout|gemist|opzet|stad|weg/i, "Beste zet?"]] };
export function aiChip(q, lang = "en") {
  q = String(q ?? "").trim().replace(/\s+/g, " ").replace(/[?.!]+$/, "");
  if (!q) return null;
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  if (q.length <= 24 && !FRAG.test(q)) return cap(q);
  for (const [re, lab] of CHIPFB[lang] || CHIPFB.en) if (re.test(q)) return lab;
  return null;
}
const FALLBACK = { en: ["Best move?", "Biggest mistake?", "Who was luckiest?"], nl: ["Beste zet?", "Grootste fout?", "Wie had geluk?"] };
const FALLQ = { en: ["What was my best move of the game?", "What was my biggest mistake?", "Who was the luckiest player?"], nl: ["Wat was mijn beste zet van het spel?", "Wat was mijn grootste fout?", "Wie had het meeste geluk?"] };

const planIcon = (k, cx, cy) => ({
  s: `<path d="M${cx - 4} ${cy + 4}V${cy - 1}L${cx} ${cy - 5}L${cx + 4} ${cy - 1}V${cy + 4}Z" class="f"/>`,
  c: `<path d="M${cx - 5} ${cy + 5}V${cy - 2}H${cx - 1}V${cy - 6}H${cx + 5}V${cy + 5}Z" class="f"/>`,
  L: `<path d="M${cx - 5} ${cy + 3}L${cx - 1} ${cy - 2}L${cx + 1} ${cy + 2}L${cx + 5} ${cy - 3}" class="l"/>`,
  A: `<path d="M${cx} ${cy - 5}L${cx + 4.5} ${cy - 3}V${cy + 1}Q${cx + 4} ${cy + 4} ${cx} ${cy + 6}Q${cx - 4} ${cy + 4} ${cx - 4.5} ${cy + 1}V${cy - 3}Z" class="a"/>`,
  v: `<path d="M${cx} ${cy - 5.5}L${cx + 1.6} ${cy - 1.7}L${cx + 5.5} ${cy - 1.4}L${cx + 2.5} ${cy + 1.2}L${cx + 3.4} ${cy + 5}L${cx} ${cy + 3}L${cx - 3.4} ${cy + 5}L${cx - 2.5} ${cy + 1.2}L${cx - 5.5} ${cy - 1.4}L${cx - 1.6} ${cy - 1.7}Z" class="v"/>`,
}[k]);
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
    return { pid, me, all: this.players.map((p) => p.id), ser, tl, st, n, nmRaw, ds, turnOf, luck, decs, nm: tryv(() => aiNearMiss(this, ser)), plan: (q) => tryv(() => aiPlan(this, q, tl)), start: (q) => tryv(() => aiStart(this, q)), route: (q) => tryv(() => aiRoute(this, q, ser, tl)), big: tryv(() => this._aiBig(ser)), maxT: Math.max(ser.maxT, this.turn || 0), lang: recapLang(), t: this._aiL() };
  },

  /** The turn with the largest win-chance swing of any player: { turn, d } (the only turn a card may say "decided"). */
  _aiBig(ser) { let b = null; for (const t of ser.by.keys()) { if (t < 1) continue; this.players.forEach((p) => { const c = wcChange(ser, p.id, t, t); if (c && (!b || Math.abs(c.d) > b.d)) b = { turn: t, d: Math.abs(c.d) }; }); } return b; },
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
    const L = C.t; let view = VIEWS.includes(raw?.view) ? raw.view : "none", level = LEVELS.includes(raw?.level) ? raw.level : "game";
    const turns = [...new Set((Array.isArray(raw?.turns) ? raw.turns : []).filter((x) => x != null && x !== "").map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= C.maxT))].slice(0, 6);
    let focus = raw?.focusTurn != null && raw.focusTurn !== "" && Number.isInteger(+raw.focusTurn) && +raw.focusTurn >= 0 && +raw.focusTurn <= C.maxT ? +raw.focusTurn : null;
    if (focus == null && turns.length) focus = turns[0];
    if (focus != null && !turns.includes(focus)) turns.unshift(focus);
    const seats = this._aiSeats(raw?.players, C);
    // v1.77: a luck view only for a card about luck; a decision card only when the player it is about HAS a costly decision on that turn (else it is a plain game card, never another player's move)
    const txt0 = `${raw?.title ?? ""} ${answer ? raw?.answer : raw?.text ?? ""}`; let dseats = seats;
    if (view === "luck" && !/\b(?:luck\w*|dice|unlucky|geluk\w*|pech|dobbel\w*)\b/i.test(txt0)) view = "winchance";
    if (level === "decision" && focus != null) {
      dseats = seats.length ? seats : this._aiMentioned(txt0, C); if (!dseats.length) dseats = [C.me];
      if (!C.decs.some((x) => x.turn === focus && dseats.includes(x.seat))) { level = "game"; if (view === "board" || view === "moves") view = "winchance"; }
    }
    const chgSeats = seats.length ? seats.slice(0, 2) : focus != null ? [C.me] : [];
    let chg = chgSeats.map((s) => { const c = focus != null ? wcChange(C.ser, s, focus, focus) : null; return c ? { seat: s, ...c } : null; }).filter((c) => c && c.d !== 0);
    // a decision: the chip is the cost of that move with the mover's sign (a better move worth +6% is "-6% your move", never a green +6%)
    const decs = level === "decision" && focus != null ? C.decs.filter((x) => x.turn === focus) : [];
    const dm = decs.filter((x) => dseats.includes(x.seat) || !dseats.length).sort((a, b) => (b.own - a.own) || (b.gap - a.gap))[0] || null;
    if (level === "decision" && focus != null) chg = dm && Math.round(dm.gap * 100) >= 1 ? [{ seat: dm.seat, from: null, to: null, d: -Math.round(dm.gap * 100), move: true }] : [];
    // luck: the chip is the luck of the named player (or yours) in win chance, with its own sign
    if (view === "luck" && C.luck) { const s = seats[0] ?? C.me, d = Math.round((C.luck[s] ?? 0) * 100); chg = d ? [{ seat: s, from: null, to: null, d, luck: true }] : []; }
    if (view === "plan" || view === "points" || view === "nearmiss") chg = []; // a plan / points card has no win-chance fact of its own
    chg = chg.slice(0, 1); // one primary chip: the main fact (the rest is in the visual)
    const clauses = (Array.isArray(raw?.clauses) ? raw.clauses : []).map((c) => ({ seat: this._aiSeats([c?.player], C)[0], text: String(c?.text ?? "").replace(/[<>]/g, "").replace(/,?\s*\bclauses?\s*\d*\b/gi, "").trim().slice(0, 120) })).filter((c) => c.seat != null && c.text).filter((c, i, a) => a.findIndex((x) => x.seat === c.seat) === i);
    const card = { level, view, dseats, clauses: view === "plan" && level === "strategy" ? clauses : [], turns: turns.slice(0, 6), focus, seats, chg, title: String(raw?.title ?? "").slice(0, 120), src: String(answer ? raw?.answer : raw?.text ?? "").replace(/,?\s*\bclauses?\s*\d*\b/gi, "").slice(0, 900), points: (raw?.points || []).map(String).slice(0, 4), fix: [] };
    { const ev = (Array.isArray(raw?.ev) ? raw.ev : []).slice(0, 4), sim = ev.filter((e) => e.t === 2 && e.r?.results), nums = new Set(ev.flatMap((e) => e.nums || []));
      card.ev = ev.length ? { nums, sim: sim.map((e) => e.r), games: sim.reduce((a, e) => a + (e.r.games || 0), 0), dec: ev.some((e) => !e.inf && (e.n === "get_decision" || e.t === 2)) } : null; }
    card.dec = card.focus != null && !!this._aiDecAt(card.focus, C, card.dseats);
    card.seat = chg[0]?.seat ?? seats[0] ?? null;
    if (answer && raw?.cant) { card.view = "none"; card.chg = []; card.rec = null; }
    else if (answer) { // v1.77 one source: the tool record (an engine run or a decision lookup) gives the bars, the badge and the text of an answer
      card.rec = tryv(() => this._aiRecord(raw, C));
      if (card.rec) { const r = card.rec; card.view = "none"; card.focus = r.turn; if (!card.turns.includes(r.turn)) card.turns.unshift(r.turn); card.seat = r.seat; card.dec = false;
        card.chg = r.d ? [{ seat: r.seat, from: null, to: null, d: r.d, move: true, small: r.kind === "sim" ? (CHAT[C.lang] || CHAT.en).vs : null }] : []; }
    }
    if (card.rec || raw?.cant) card.points = []; // the model's chips would carry numbers of their own
    card.text = raw?.cant ? String(raw.answer || "").slice(0, 300) : card.rec ? this._aiRecordText(card, C) : this._aiTrust(card, C);
    if (!answer && !card.rec && card.level === "decision") this._aiDecFit(card, C);
    if (!card.rec && !raw?.cant) this._aiCauseFit(card, C);
    card.title = this._aiTitle(card, C);
    this._aiCardBlocks(card, raw, C);
    card.generic = card.fix.includes("title");
    return card;
  },
  /** The record an answer rests on, as one object: the engine's run of the asked move, or the lookup of the decision (rows = the bars, d = the badge = played minus the alternative). */
  _aiRecord(raw, C) {
    const ev = Array.isArray(raw?.ev) ? raw.ev : [], it = raw?.intent || null, T = C.t;
    const seatOf = (nm) => (nm === "You" ? C.me : this._aiSeats([nm], C)[0] ?? C.me);
    const sim = ev.find((e) => e.t === 2 && e.r?.tool === "simulate_moves" && e.r.storedPlayedWinPct != null && (e.r.results || []).some((x) => x.winPct != null));
    if (sim) {
      const r = sim.r; let rows = r.results.filter((x) => x.winPct != null);
      if (it) { const f = rows.filter((x) => aiKindOf(x.label) === it.x); if (f.length) rows = f; }
      rows = rows.slice(0, it ? 1 : 3);
      const alt = rows.reduce((a, x) => (x.winPct > a.winPct ? x : a), rows[0]), d = r.storedPlayedWinPct - alt.winPct;
      return { kind: "sim", seat: seatOf(r.player), turn: r.turn, who: r.player, played: { label: r.playedLabel || T.asPlayed, v: r.storedPlayedWinPct }, alts: rows.map((x) => ({ label: x.label, v: x.winPct, pm: x.plusMinusPct })), d, pm: alt.plusMinusPct || 0 };
    }
    const dc = ev.find((e) => e.n === "get_decision" && e.r?.playedWinPct != null); if (!dc) return null;
    const r = dc.r, ev2 = r.evaluated || [], bt = ev2.find((c) => !c.played && c.label === r.better) || ev2.filter((c) => !c.played).sort((a, b) => (b.winPct ?? -1) - (a.winPct ?? -1))[0];
    const best = !(r.costPct >= 0.5), cost = Math.round(r.costPct), ok = !best && bt && Math.abs(bt.winPct - r.playedWinPct - cost) <= 1; // the bars and the badge show the review's own cost (the two rounded win chances may differ by 1)
    return { kind: "dec", seat: seatOf(r.player), turn: r.turn, who: r.player, k: r.kind, played: { label: r.played, v: r.playedWinPct }, alts: ok ? [{ label: bt.label, v: r.playedWinPct + cost }] : [], best, better: !best && r.better ? r.better : null, d: best ? 0 : -cost, cost: r.costPct };
  },
  /** The sentence of a record card, only from the record (the model's own sentences stay only when they say nothing about direction or numbers). */
  _aiRecordText(card, C) {
    const r = card.rec, T = CHAT[C.lang] || CHAT.en, nl = C.lang === "nl", you = this._rvIsYou(r.seat), nm = you ? (nl ? "Jij" : "You") : C.nmRaw(r.seat), alt = r.alts[0], TW = nl ? "beurt" : "turn";
    const mv = you ? (nl ? "jouw zet" : "your move") : (nl ? `de zet van ${nm}` : `${nm}\u2019s move`), TT = `${nl ? "Beurt" : "Turn"} ${r.turn}`;
    let a;
    if (r.kind === "sim") a = `${alt.label} ${T.wouldHave} ${alt.v}% ${T.wc}, ${r.played.v}% ${T.asp}${Math.abs(r.d) < 8 || Math.abs(r.d) <= (r.pm || 0) ? ` (${T.noise})` : ""}.`;
    else if (r.best) a = nl ? `${TT}: ${mv} was de beste (\u00b10): geen betere zet gevonden.` : `${TT}: ${mv} was rated best (\u00b10): no better move found.`;
    else a = alt ? (nl ? `${TT}: ${mv} kostte ${Math.abs(r.d)}% winkans (${r.played.v}% zoals gespeeld, ${alt.v}% met de betere zet).` : `${TT}: ${mv} cost ${Math.abs(r.d)}% win chance (${r.played.v}% as played, ${alt.v}% with the better move).`) : (nl ? `${TT}: ${mv} kostte ${Math.abs(r.d)}% winkans${r.better ? `: ${r.better} was beter` : ""} (${r.played.v}% zoals gespeeld).` : `${TT}: ${mv} cost ${Math.abs(r.d)}% win chance${r.better ? `: ${r.better} was the better move` : ""} (${r.played.v}% as played).`);
    // v1.80 a set-up / settlement / city decision: the short app sentence (the bars carry the percentages), then the model's WHY (up to 2 sentences: direction words like "better" are fine there)
    const spot = r.kind === "dec" && !r.best && (r.k === "setup" || /^(?:settlement|city)\b/i.test(r.played.label || "")); if (spot) a = nl ? `${TT}: ${mv} kostte ${Math.abs(r.d)}% winkans.` : `${TT}: ${mv} cost ${Math.abs(r.d)}% win chance.`;
    const ok1 = (x) => x && !/\d\s?%/.test(x) && !CF.test(x) && (spot || !/\b(?:instead|in plaats|engine)\b/i.test(x)) && !new RegExp(`\\b${TW}\\s+\\d`, "i").test(x), sents = (card.src.match(/(?:[^.!?]|[.!?](?!\s|$))+[.!?]+(?:\s+|$)/g) || []).map((x) => x.trim());
    const neg = r.d < 0, extra = spot ? sents.filter(ok1).slice(0, 2).join(" ") : sents.filter((x) => ok1(x) && !posW(x) && !negW(x))[0];
    if (!extra) card.fix.push("rec");
    return spot && extra ? extra : `${a}${extra ? ` ${extra}` : ""}`;
  },
  /** v1.78 A card about a win-chance swing names its cause from the app (who did what in that turn moved it most): a sentence that names another player or event is replaced. */
  _aiCauseFit(card, C) {
    const ch = card.chg[0]; if (card.focus == null || !ch || ch.from == null || ch.move || ch.luck || Math.abs(ch.d) < 10) return;
    const cs = tryv(() => swingCause(this, card.focus, ch.seat)); if (!cs) return;
    const nl = C.lang === "nl", youA = this._rvIsYou(cs.actor), youS = this._rvIsYou(ch.seat), an = C.nmRaw(cs.actor), sn = C.nmRaw(cs.victimSeat ?? ch.seat);
    const KW = { dice: /\b(?:roll\w*|dice|worp|gooi\w*|dobbel\w*)\b/i, steal: /\b(?:stole|steal\w*|stal|steel\w*|rob\w*)\b/i, build: /\b(?:built|build\w*|bouw\w*|city|cities|settlement|road|stad|dorp|weg)\b/i, play: /\b(?:play\w*|knight|monopoly|speel\w*|ridder)\b/i };
    const dk = cs.kind === "dev" ? (cs.data.card === "victoryPoint" ? /\b(?:point card|victory|puntenkaart|overwinning\w*)\b/i : /\b(?:development|dev card|drew|bought|knight|kaart|kocht|trok)\b/i) : KW[cs.kind];
    const nm = [C.nmRaw(cs.actor), this.players[cs.actor]?.name || ""].filter((x) => x.length >= 2).map(reEsc).join("|"), actorRe = new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${nm || "\u0000"}${youA ? "|you|your|jij|je|jouw" : ""})(?![\\p{L}\\p{N}])`, "iu");
    const t = card.text || "", claims = Object.values(KW).some((r) => r.test(t)) || /\b(?:drew|bought|point card|development|trok|kocht|puntenkaart)\b/i.test(t), ok = !claims || (actorRe.test(t) && (!dk || dk.test(t)));
    if (ok) return;
    const D = { en: { dice: (d) => `rolled ${d.roll}`, steal: (d) => `stole a card from ${C.nmRaw(d.victim)}`, dev: (d) => (d.card === "victoryPoint" ? "drew a point card" : `drew ${{ knight: "a Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly" }[d.card] || "a development card"}`), build: (d) => `built a ${d.what}`, play: (d) => `played ${{ knight: "a Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly" }[d.what] || "a card"}` },
      nl: { dice: (d) => `gooide ${d.roll}`, steal: (d) => `stal een kaart van ${C.nmRaw(d.victim)}`, dev: (d) => (d.card === "victoryPoint" ? "trok een puntenkaart" : "trok een ontwikkelingskaart"), build: (d) => `bouwde ${{ city: "een stad", settlement: "een dorp", road: "een weg" }[d.what] || "iets"}`, play: () => "speelde een kaart" } }[nl ? "nl" : "en"];
    const who = youA ? (nl ? "jij" : "you") : an, TW = nl ? "beurt" : (this._rvTW?.() || "Turn").toLowerCase(), chance = youS ? (nl ? "jouw winkans" : "your win chance") : (nl ? `de winkans van ${sn}` : `${sn}\u2019s win chance`);
    card.fix.push("cause");
    card.text = nl ? `Op ${TW} ${card.focus} ${D[cs.kind](cs.data)} ${who}: ${chance} ${ch.from}% \u2192 ${ch.to}%.` : `On ${TW} ${card.focus} ${who} ${D[cs.kind](cs.data)}: ${chance} ${ch.from}% \u2192 ${ch.to}%.`;
    card.cause = { player: cs.actor, kind: cs.kind, delta: cs.delta };
  },
  /** A decision card's sentence must be about the decision its board shows: else the app's own line (played, better, cost) replaces it. */
  _aiDecFit(card, C) {
    const dm = card.focus != null ? this._aiDecAt(card.focus, C, card.dseats) : null; if (!dm || !card.text) return;
    const x = dm.d.x, lab = String(x.label || ""), low = card.text.toLowerCase(), toks = (lab.match(/\b(?:ore|grain|wheat|wool|sheep|lumber|wood|brick)\s+\d+/gi) || []).map((t) => t.toLowerCase());
    const KW = { city: /cit|stad|steden/, settlement: /settle|dorp|village/, road: /road|weg/, end: /end|pass|be\u00ebindig/, buy: /card|kaart|dev/ }, k = aiKindOf(lab);
    const fits = toks.length ? toks.some((t) => low.includes(t)) && (!k || !KW[k] || KW[k].test(low)) : !k || !KW[k] || KW[k].test(low);
    if (fits) return;
    const nl = C.lang === "nl", nm = this._rvIsYou(dm.seat) ? (nl ? "Jij" : "You") : C.nmRaw(dm.seat), TW = nl ? "Beurt" : "Turn", clipL = (v) => String(v).replace(/<[^>]+>/g, "").slice(0, 70);
    card.fix.push("dec");
    card.text = nl ? `${TW} ${card.focus}: ${nm} speelde ${clipL(lab)}; ${clipL(x.best.label)} was beter (kostte ${Math.round(dm.gap * 100)}% winkans).` : `${TW} ${card.focus}: ${nm} played ${clipL(lab)}; ${clipL(x.best.label)} was better (cost ${Math.round(dm.gap * 100)}% win chance).`;
  },
  _aiPoss(C, s) { const nm = C.nmRaw(s); return this._rvIsYou(s) ? C.t.your : C.lang === "nl" ? `${nm}s` : `${nm}'s`; },
  /** A readable app title (never "X \u00b7 Y"): "Turn 21: your move", "Blaauw's plan", "Luck for you". */
  _aiNeutralTitle(card, C) {
    const L = C.t, c = card.chg[0], TW = C.lang === "nl" ? "Beurt" : this._rvTW?.() || "Turn", cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
    const s = c?.seat ?? card.seats[0] ?? C.me, you = this._rvIsYou(s), poss = this._aiPoss(C, s), nl = C.lang === "nl";
    if (c?.luck) return nl ? `${L.luck} voor ${you ? "jou" : C.nmRaw(s)}` : `${L.luck} for ${you ? "you" : C.nmRaw(s)}`;
    if (card.focus != null && c) return `${card.focus === 0 ? L.setup : `${TW} ${card.focus}`}: ${you && c.move ? L.mine : `${poss} ${c.move ? L.move : L.win}`}`;
    if (card.view === "plan" || card.level === "strategy") return cap(`${poss} plan`);
    return cap(`${poss} ${(nl ? { game: "spel", decision: "beslissing", strategy: "strategie" } : { game: "game", decision: "decision", strategy: "strategy" })[card.level]}`);
  },
  /** The AI's title unless it contradicts the chip (a "best move" with a negative chip, luck "against you" with a positive one): then a neutral app title. */
  _aiTitle(card, C) {
    const t = card.title, c = card.chg[0];
    // v1.77: a title's claim must match the data: "evened out" only for luck under 5 points, "decided" only on the game's largest swing (15 points or more)
    if (t) {
      const lkv = C.luck && (card.view === "luck" || c?.luck) ? Math.round((C.luck[card.seats[0] ?? C.me] ?? 0) * 100) : null;
      const tn = t.match(/\b(?:turn|beurt)\s+(\d+)/i), dt = DECIDED.test(t) ? (tn ? +tn[1] : card.focus) : null;
      if ((lkv != null && EVEN.test(t) && Math.abs(lkv) >= 5) || (dt !== null && !(C.big && C.big.d >= 15 && C.big.turn === dt))) { card.fix.push("title"); return this._aiNeutralTitle(card, C); }
    }
    if (!t || !c || !c.d) return t;
    const bad = c.luck ? (AGAINST.test(t) && c.d > 0) || (FAVOUR.test(t) && c.d < 0) : (posW(t) && !negW(t) && c.d < 0) || (negW(t) && !posW(t) && c.d > 0);
    if (!bad) return t;
    card.fix.push("title");
    return this._aiNeutralTitle(card, C);
  },
  /** "Blaauw's plan: cities and the army." from the build timeline (the plan card when the AI's sentence could not be kept). */
  _aiPlanLine(C, s) {
    const cnt = {}; (C.tl[s] || []).forEach(([, k]) => { cnt[k] = (cnt[k] || 0) + 1; });
    const nl = C.lang === "nl", W = nl ? { c: "steden", s: "dorpen", L: "de langste weg", A: "het leger", v: "puntenkaarten" } : { c: "cities", s: "settlements", L: "the longest road", A: "the army", v: "point cards" };
    const top = ["c", "A", "L", "v", "s"].filter((k) => cnt[k]).slice(0, 2); if (!top.length) return "";
    const poss = this._aiPoss(C, s), who = poss.charAt(0).toUpperCase() + poss.slice(1);
    return `${who} plan: ${top.map((k) => W[k]).join(nl ? " en " : " and ")}.`;
  },
  /** A neutral full sentence for a seat from the app's own number: "On turn 5 your win chance fell 11%." / "Your move on turn 21 cost 2% win chance." */
  _aiNeutral(card, C, s, T0, TW) {
    const L = C.t, you = this._rvIsYou(s), nm = C.nmRaw(s), poss = this._aiPoss(C, s), nl = C.lang === "nl", cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
    if (card.view === "plan" && !card.chg.length) return this._aiPlanLine(C, s);
    const mv = card.chg.find((c) => c.move && c.seat === s), lk = card.view === "luck" ? card.chg.find((c) => c.luck && c.seat === s) : null;
    if (mv) { const n = Math.abs(mv.d); return nl ? cap(`${poss} zet ${T0 == null ? "" : T0 === 0 ? "bij de opzet" : `in beurt ${T0}`} kostte ${n}% winkans.`.replace(/\s{2,}/g, " ")) : cap(`${poss} ${T0 === 0 ? "set-up move" : `move${T0 == null ? "" : ` on turn ${T0}`}`} cost ${n}% win chance.`); }
    if (lk) { const n = Math.abs(lk.d); return nl ? (lk.d > 0 ? `Geluk gaf ${you ? "jou" : nm} ${n}% winkans erbij.` : `Pech kostte ${you ? "jou" : nm} ${n}% winkans.`) : (lk.d > 0 ? `Luck added ${n}% to ${poss} win chance.` : `Luck cost ${you ? "you" : nm} ${n}% win chance.`); }
    const c = T0 != null ? wcChange(C.ser, s, T0, T0) : null; if (!c || !c.d) return "";
    const tt = T0 === 0 ? (nl ? "Bij de opzet" : "At set-up") : nl ? `In beurt ${T0}` : `On turn ${T0}`, n = Math.abs(c.d);
    return nl ? `${tt} ${c.d > 0 ? "steeg" : "daalde"} ${poss} winkans met ${n}%.` : `${tt} ${poss} win chance ${c.d > 0 ? "rose" : "fell"} ${n}%.`;
  },
  /** A sentence's win-chance numbers replaced by the app's value for that turn and player (a pair "a% to b%" = the turn's step); null when it cannot be matched.
   *  Any other number within 2 points of the card's chip shows the chip's value. */
  _aiNums(sent, card, C, seat) {
    const tm = sent.match(/\b(?:turn|beurt)\s+(\d+)/i), T = tm ? +tm[1] : card.focus ?? card.turns[0] ?? null, s = seat ?? card.chg[0]?.seat ?? C.me, N = "(\\d+(?:[.,]\\d+)?)";
    const wc = (t) => { const v = t == null ? null : wcAt(C.ser, s, t); return v == null ? null : Math.round(v); };
    let bad = false;
    sent = sent.replace(new RegExp(`${N}(\\s?%\\s*(?:\u2192|->|to|and|naar|en)\\s*)${N}(\\s?%)`, "i"), (m, a, mid, b, pc) => { const c = T != null ? wcChange(C.ser, s, T, T) : null; if (!c || c.from == null) { bad = true; return m; } return `${c.from}${mid}${c.to}${pc}`; });
    const one = (m, n) => { const v = wc(T); if (v == null) { bad = true; return m; } return m.replace(n, String(v)); };
    sent = sent.replace(new RegExp(`${N}\\s?%\\s+(?:win ?chance|winkans)`, "gi"), (m, n) => one(m, n));
    sent = sent.replace(new RegExp(`(?:win ?chance|winkans)(?:\\s+(?!from\\b|to\\b|and\\b|naar\\b|en\\b|van\\b)[\\p{L}]+){0,2}\\s+${N}\\s?%`, "giu"), (m, n) => one(m, n));
    if (bad) return null;
    const chips = card.chg.filter((c) => c.d);
    return sent.replace(new RegExp(`${N}(\\s?%)`, "g"), (m, n, pc) => { const v = parseFloat(n.replace(",", ".")), hit = chips.find((c) => Math.abs(Math.abs(c.d) - v) <= 2); return hit && Math.abs(hit.d) !== v ? `${Math.abs(hit.d)}${pc}` : m; });
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
    for (let sent of sents) {
      const seen = nameRes.filter((x) => x.re.test(sent)).map((x) => x.s);
      let seat = seen.length === 1 ? seen[0] : seen.length === 0 ? card.chg[0]?.seat ?? null : null, ambig = false;
      if (seen.length > 1) { // several players named: the numbers belong to the subject just before the first number, else the sentence loses its numbers
        const np = sent.search(/\d\s?%/); let best = -1, bs = null;
        if (np >= 0) nameRes.forEach((x) => { if (!seen.includes(x.s)) return; for (const mm of sent.matchAll(new RegExp(x.re.source, "giu"))) { if (mm.index < np && mm.index > best) { best = mm.index; bs = x.s; } } });
        if (np >= 0 && bs != null) seat = bs; else if (np >= 0) ambig = true;
      }
      const mvc = seat != null ? card.chg.find((x) => x.move && x.seat === seat) : null, wc = seat != null && T0 != null ? wcChange(C.ser, seat, T0, T0) : null;
      const c = mvc || wc;
      if (!SENT_END.test(sent)) { card.fix.push("cut"); continue; } // a sentence the AI did not finish is dropped
      let bad = false, why = "";
      const ev = card.ev, n0 = [...sent.matchAll(/(\d+(?:[.,]\d+)?)\s?%/g)].map((m) => parseFloat(m[1].replace(",", "."))), evOk = !!ev && n0.length > 0 && n0.every((v) => [...ev.nums].some((a) => Math.abs(a - v) <= 1)); // v1.77 numbers a tool result gives are the app's own
      if (CF.test(sent) && !ev?.dec) { bad = true; why = "cf"; } else // a what-if the engine did not check is not allowed
      if (ambig) { bad = true; why = "number"; } else if (evOk) { /* numbers from a tool result */ } else
      { const rw = this._aiNums(sent, card, C, seat); if (rw === null) { bad = true; why = "number"; } else if (rw !== sent) { card.fix.push("num"); sent = rw; } } // win-chance numbers: the app's value for that turn and player
      const pos = posW(sent), neg = negW(sent);
      const pr = !bad && sent.match(/(\d+(?:[.,]\d+)?)\s?%\s*(?:\u2192|->|to|and|naar|en)\s*(\d+(?:[.,]\d+)?)\s?%/i);
      if (pr && ((neg && !pos && parseFloat(pr[2]) > parseFloat(pr[1])) || (pos && !neg && parseFloat(pr[2]) < parseFloat(pr[1])))) { bad = true; why = "verb"; }
      else if (!bad && !evOk && c && pos && !neg && c.d <= -1) { bad = true; why = "verb"; }
      else if (!bad && !evOk && c && neg && !pos && c.d >= 1) { bad = true; why = "verb"; }
      if (!bad && card.view === "luck" && C.luck && seat != null) { const lv = Math.round(C.luck[seat] * 100); if ((AGAINST.test(sent) && lv >= 1) || (FAVOUR.test(sent) && lv <= -1)) { bad = true; why = "luck"; } }
      if (!bad && !evOk) {
        const nums = [...sent.matchAll(/(\d+(?:[.,]\d+)?)\s?%/g)].map((m) => parseFloat(m[1].replace(",", ".")));
        const allowed = this._aiAllowed(card, C, seen.length ? seen : card.chg.length ? card.chg.map((c) => c.seat) : [C.me], sent);
        const off = nums.some((v) => ![...allowed].some((a) => Math.abs(a - v) <= 2));
        if (off) { bad = true; why = "number"; }
      }
      if (bad) { card.fix.push(why); const n2 = neutral(seat ?? card.chg[0]?.seat ?? C.me); if (n2 && !out.includes(n2)) out.push(n2); }
      else out.push(sent);
    }
    if (!out.length && card.fix.includes("cut")) { const n2 = neutral(card.chg[0]?.seat ?? card.seat ?? C.me); if (n2) out.push(n2); }
    return out.join(" ").trim();
  },

  // ── the inline formatter: turns, changes, points, players, resource spots ──
  _aiFmt(text, C, card = null, { links = true, plain = false } = {}) {
    text = String(text ?? ""); if (!text) return "";
    // the facts say "point card t12" / "settlement t7": never "points card 1 points" or "Brown Turn 11"
    const TWd = C.lang === "nl" ? "beurt" : (this._rvTW?.() || "Turn").toLowerCase();
    text = text.replace(/\bpoints? cards?\s+(?:\d+\s+points?)\b/gi, "point card").replace(/\bt(\d{1,2})\b/g, `${TWd} $1`);
    { const nms = this._aiNameRe(C).filter((x) => x.length >= 2); if (nms.length) text = text.replace(new RegExp(`(?<![\\p{L}\\p{N}])(${nms.join("|")})\\s+(turns?|beurten|beurt)\\s+(\\d)`, "giu"), (m, n, t, d) => `${n} ${C.lang === "nl" ? "in" : "on"} ${t} ${d}`); }
    if (plain) { text = text.replace(/\s+(['\u2019]s\b)/g, "$1").replace(/\s+([,.;:!?])/g, "$1").replace(/\s{2,}/g, " "); return esc(text); }
    text = text.replace(/\b((?:turns?|beurt|beurten)\s+\d+|set-?up|opzet)\s*:\s+/gi, "$1 \u2013 ");
    text = text.replace(/\s+(['\u2019]s\b)/g, "$1").replace(/(\p{L})(\d+(?:[.,]\d+)?\s?%)/gu, "$1 $2").replace(/%(?=\p{L})/gu, "% ").replace(/\b(turns?|beurten|beurt)(\d)/gi, "$1 $2").replace(/\s+([,.;:!?])/g, "$1").replace(/\s{2,}/g, " ");
    const L = C.t, names = this._aiNameRe(C), luckCard = card?.view === "luck";
    const parts = [
      "(?<turn>\\b(?:turns?|beurten|beurt|rolls?|round)\\s+\\d+\\b)", "(?<setup>\\bset-?up\\b|\\bopzet\\b)",
      "(?<pct>(?:[+\\u2212\\-\\u2013]\\s?)?\\d+(?:[.,]\\d+)?\\s?%)", "(?<res>\\b(?:ore|grain|wheat|wool|sheep|lumber|wood|brick|erts|graan|tarwe|wol|schaap|hout|baksteen)\\s+\\d{1,2}\\b)",
      "(?<pts>\\b\\d+(?:[\\u2013\\-]\\d+)?\\s+(?:points?|punten|pt)\\b|\\bpoint cards?\\b|\\bpuntenkaarten?\\b)",
      "(?<dec>\\b(?:decisions?|moves?|mistakes?|blunders?|beslissing(?:en)?|zetten|zet|fouten|fout)\\b)", "(?<lk>\\b(?:luck|geluk)\\b)",
    ];
    if (names.length) parts.push(`(?<nm>(?<![\\p{L}\\p{N}])(?:${names.join("|")})(?:['\u2019]s)?(?![\\p{L}\\p{N}]))`);
    const re = new RegExp(parts.join("|"), "giu"), E = esc(text);
    const seatOf = (word) => { const w = word.toLowerCase().replace(/['\u2019]s$/, (x, i) => (this.players.some((p) => esc(C.nmRaw(p.id)).toLowerCase() === word.toLowerCase()) ? x : "")); return this.players.find((p) => esc(C.nmRaw(p.id)).toLowerCase() === w || esc(p.name || "").toLowerCase() === w)?.id; };
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
          const you = this._rvIsYou(hit.seat), cls = you ? (hit.d > 0 ? "up" : "dn") : `opp pc-${hit.seat}`;
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
    // green / red only for YOUR win chance; an opponent's change is in that player's colour with their name ("Blaauw +14%")
    return card.chg.filter((c) => c.d).slice(0, 1).map((c) => { const you = this._rvIsYou(c.seat), cls = you ? (c.d > 0 ? "up" : "dn") : "opp"; const nm = C.nmRaw(c.seat);
      const small = c.small ? c.small : c.move ? (you ? C.t.mine : C.t.move) : c.luck ? C.t.luck.toLowerCase() : "";
      return `<button type="button" class="ai-chg ${cls} pc-${c.seat}" ${card.focus != null && !c.luck ? `data-ait="${card.focus}"` : c.luck ? "data-ailuck" : ""} title="${esc(nm)} \u00b7 ${esc(c.luck ? C.t.luck : c.move ? C.t.move : C.t.win)}${c.from != null ? ` ${c.from}% \u2192 ${c.to}%` : ""}"><i class="ai-dot" aria-hidden="true"></i>${you ? "" : `<span>${esc(nm)}</span>`}<b>${sgn(c.d)}%</b>${small ? `<small>${esc(small)}</small>` : ""}</button>`; }).join("");
  },
  /** A decision has a place on the board only when its A or B is a spot (node / edge): a trade or a development card has none. */
  _aiHasPos(d) { const g = this.geometry; if (!d?.x || !g) return false; return [d.x.best?.focus, d.x.focus].some((f) => f && tryv(() => rvPos(g, f))); },
  _aiMentioned(txt, C) { const out = []; this.players.forEach((p) => { const nm = [C.nmRaw(p.id), p.name || ""].filter((x) => x.length >= 2).map(reEsc); if (this._rvIsYou(p.id)) nm.push("you", "your", "jij", "je", "jouw"); if (nm.length && new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${nm.join("|")})(?![\\p{L}\\p{N}])`, "iu").test(txt)) out.push(p.id); }); return out; },
  _aiDecAt(T, C, seats = null) { const l = C.decs.filter((x) => x.turn === T && (!seats?.length || seats.includes(x.seat))).sort((a, b) => (b.own - a.own) || (b.gap - a.gap)); return l[0] || null; },
  _aiCardHtml(card, C, o = {}) {
    const L = C.t, key = o.key ?? "", vis = o.ref ? `<div class="ai-ac"><button type="button" class="ai-a" data-airef="${o.ref}">${esc((CHAT[C.lang] || CHAT.en).same)}</button></div>` : card.bk ? this._aiBlocksHtml(card, C, key) : this._aiVisual(card, C, o.seen);
    (this._aiSrc ||= new Map()).set(key, { text: card.text, card, max: o.q ? (card.bk?.some((b) => b.type === "spots") ? 5 : 3) : 2 });
    const dec = card.focus != null ? this._aiDecAt(card.focus, C, card.dseats) : null;
    const canWhy = card.level === "decision" && dec?.own && this._rvIsYou(C.pid) && this._exCan?.(dec.d);
    const acts = `${canWhy ? `<button type="button" class="ai-a" data-aiwhy="${card.focus}">${L.why}</button>` : ""}${card.focus != null ? `<button type="button" class="ai-a" data-aigo="${card.focus}">${L.show}</button>` : ""}`;
    const T2 = CHAT[C.lang] || CHAT.en, evTag = card.ev?.sim?.length ? `<span class="ai-ev eng" data-aiev="engine">${esc(o.q ? T2.eng(card.ev.games) : T2.checked)}</span>` : o.q && card.ev ? `<span class="ai-ev rev" data-aiev="review">${esc(T2.review)}</span>` : "";
    const tag0 = o.q ? `<span class="ai-lv q">${esc(o.q)}</span>` : `<span class="ai-lv lv-${card.level}">${L.lv[card.level]}</span>`;
    const tag = tag0 + evTag;
    const pin = o.pin != null ? `<button type="button" class="ai-pin${o.pin ? " on" : ""}" data-aipin="${o.idx}" aria-pressed="${!!o.pin}" aria-label="${o.pin ? L.unpin : L.pin}" title="${o.pin ? L.unpin : L.pin}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 14v7" fill="${o.pin ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : "";
    const pts = card.points?.length ? `<div class="ai-pts">${card.points.map((p) => `<span>${this._aiFmt(p, C, card, { plain: true })}</span>`).join("")}</div>` : "";
    return `<section class="ai-c lvl-${card.level}${o.q ? " ans" : ""}" data-aic="${key}" data-aifocus="${card.focus ?? ""}">
      <div class="ai-hd">${tag}${this._aiChgChips(card, C)}${pin}</div>
      ${card.title ? `<b class="ai-ti">${this._aiFmt(card.title, C, card)}</b>` : ""}
      ${card.text ? `<div class="ai-tx" data-aitx="${key}" lang="${C.lang}">${this._aiFmt(card.text, C, card)}</div>` : ""}${pts}
      ${vis}${card.bk?.some((b) => b.type === "compare") ? "" : this._aiVSim(card, C)}${acts ? `<div class="ai-ac">${acts}</div>` : ""}</section>`;
  },
  _aiSeatRows(card, C) { return card.rows?.length ? card.rows : card.seats.length >= 2 ? card.seats : this.players.map((p) => p.id); },
  /** One visual per card, never the same visual with the same data twice in the tab. A decision always shows its board (A better, B played). */
  _aiVisual(card, C, seen = new Set()) {
    try {
      const T0 = card.focus ?? card.turns[0];
      const view = card.level === "decision" && T0 != null && C.st ? (this._aiHasPos(this._aiDecAt(T0, C, card.dseats)?.d) ? "board" : this._aiDecAt(T0, C, card.dseats) ? "moves" : "winchance") : card.view;
      if (view === "points") return "";
      if (view === "board" && card.level !== "decision" && T0 != null && this._aiDecAt(T0, C, card.dseats)) return ""; // a decision's board belongs to its decision card // the Overview already shows the points
      if (view === "plan" && card.level !== "strategy") return "";
      const key = view === "plan" && card.clauses?.length ? "planall" : view === "board" ? `board${T0}` : view === "winchance" ? `win${card.seats.join()}|${card.turns.join()}` : view === "moves" ? `mv${card.turns.join()}` : view;
      if (view !== "none" && seen.has(key)) return "";
      const out = this._aiVisualOf({ ...card, view }, C, card.level === "decision");
      if (out && view !== "none") seen.add(key);
      return out;
    } catch (e) { console.warn("ai visual", e); return ""; }
  },
  _aiVisualOf(card, C, strict = false) {
    try {
      switch (card.view) {
        case "winchance": return this._aiVWin(card, C);
        case "luck": return this._aiVLuck(card, C);
        case "points": return this._aiVPoints(card, C);
        case "plan": return this._aiVPlan(card, C);
        case "nearmiss": return this._aiVNear(card, C);
        case "board": return this._aiVBoard(card, C);
        case "moves": return this._aiVMoves(card, C, strict);
        default: return "";
      }
    } catch (e) { console.warn("ai visual", e); return ""; }
  },
  _aiVWin(card, C, o = null) {
    const ser = C.ser; if (ser.by.size < 2) return "";
    let seats = card.seats.length ? card.seats.slice(0, 3) : [C.me]; if (!seats.includes(C.me) && seats.length < 3 && !card.seats.length) seats = [C.me];
    let t0 = 0, t1 = C.maxT;
    if (o) { t0 = o.t0; t1 = o.t1; if (t1 - t0 < 4) { t1 = Math.min(C.maxT, t0 + 4); t0 = Math.max(0, t1 - 4); } }
    else if (card.turns.length) { t0 = Math.max(0, Math.min(...card.turns) - 4); t1 = Math.min(C.maxT, Math.max(...card.turns) + 4); if (t1 - t0 < 8) { t1 = Math.min(C.maxT, t0 + 8); t0 = Math.max(0, t1 - 8); } }
    const ts = [...ser.by.keys()].filter((t) => t >= t0 && t <= t1).sort((a, b) => a - b);
    if (ts.length < 2) return "";
    const lines = seats.map((s) => ({ s, p: ts.map((t) => [t, Math.round((ser.by.get(t)[s] ?? 0) * 100)]) }));
    const all = lines.flatMap((l) => l.p.map((q) => q[1]));
    let lo = Math.max(0, Math.floor((Math.min(...all) - 5) / 10) * 10), hi = Math.min(100, Math.ceil((Math.max(...all) + 5) / 10) * 10); if (hi - lo < 20) { hi = Math.min(100, lo + 20); lo = Math.max(0, hi - 20); }
    const W = 320, H = 136, l = 30, r = 14, tp = 22, b = 22, x = (t) => l + ((t - t0) / Math.max(1, t1 - t0)) * (W - l - r), y = (v) => H - b - ((v - lo) / (hi - lo)) * (H - tp - b);
    const grid = [lo, (lo + hi) / 2, hi].map((v) => `<line x1="${l}" x2="${W - r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="g"/><text x="${l - 4}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${Math.round(v)}%</text>`).join("");
    const paths = lines.map((ln) => `<path class="pc-${ln.s}" d="${ln.p.map((q, i) => `${i ? "L" : "M"}${x(q[0]).toFixed(1)} ${y(q[1]).toFixed(1)}`).join("")}" fill="none"/>`).join("");
    const mt = [...new Set((o ? o.marks : [card.focus, ...(card.focus != null && card.chg?.some((c) => c.from != null) ? [card.focus - 1] : []), ...card.turns]).filter((t) => t != null && t >= t0 && t <= t1))].slice(0, 3);
    // adjacent turns (T10, T11) are one marker: "T10\u201311", so the labels never crowd
    const groups = []; mt.sort((a, c) => a - c).forEach((t) => { const g = groups[groups.length - 1]; if (g && t - g[g.length - 1] <= 2) g.push(t); else groups.push([t]); });
    let lastX = -99, flip = false;
    const marks = groups.map((gr) => {
      const t = gr[0], v = wcAt(ser, seats[0], t); if (v == null) return "";
      const lab = (a) => (a === 0 ? C.t.setup : `T${a}`), tx = gr.length > 1 ? `${lab(gr[0])}\u2013${gr[0] === 0 ? lab(gr[gr.length - 1]) : gr[gr.length - 1]}` : lab(t);
      const cxs = gr.map((q) => x(q)), cx = cxs.reduce((a, c) => a + c, 0) / cxs.length, cy = y(wcAt(ser, seats[0], t)), w = tx.length * 6.4 + 12;
      flip = Math.abs(cx - lastX) < w + 4 ? !flip : false; lastX = cx;
      let ly = flip || cy < tp + 6 ? cy + 10 : cy - 24; if (cy < tp + 6 && flip) ly = cy + 22;
      ly = Math.max(2, Math.min(H - b - 14, ly));
      const lx = Math.max(l + 2, Math.min(W - w - 2, cx - w / 2));
      const dots = gr.map((q) => { const vq = wcAt(ser, seats[0], q); return vq == null ? "" : `<circle cx="${x(q).toFixed(1)}" cy="${y(vq).toFixed(1)}" r="4.2" class="d"/>`; }).join("");
      return `<g class="mk pc-${seats[0]}" data-ait="${t}" role="button" tabindex="0" aria-label="${esc(tx)} ${v}%"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${gr.length > 1 ? 24 : 15}" class="hit"/>${dots}<rect x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" width="${w.toFixed(1)}" height="14" rx="7"/><text x="${(lx + w / 2).toFixed(1)}" y="${(ly + 10).toFixed(1)}" text-anchor="middle">${tx}</text></g>`;
    }).join("");
    const xl = `<text x="${l}" y="${H - 6}" text-anchor="start">${t0 ? "T" + t0 : C.t.setup}</text><text x="${W - r}" y="${H - 6}" text-anchor="end">T${t1}</text>`;
    const leg = seats.length > 1 ? `<div class="ai-leg">${seats.map((s) => `<span class="pc-${s}"><i class="ai-dot"></i>${esc(C.nmRaw(s))}</span>`).join("")}</div>` : "";
    const ch = (card.chg || []).find((c) => c.from != null && !c.move && !c.luck), cap = ch ? `<div class="ai-cap pc-${ch.seat}">${esc(C.nmRaw(ch.seat))} ${ch.from}% \u2192 ${ch.to}%</div>` : "";
    return `<div class="ai-vz"><svg class="ai-wc" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(C.t.win)}">${grid}${paths}${marks}${xl}</svg>${leg}${cap}</div>`;
  },
  _aiVLuck(card, C) {
    if (!C.luck) return "";
    const seats = this._aiSeatRows(card, C), vals = seats.map((s) => (C.luck[s] ?? 0) * 100), max = Math.max(4, ...vals.map(Math.abs));
    return `<div class="ai-vz ai-bars">${seats.map((s, i) => { const v = vals[i], w = Math.min(50, (Math.abs(v) / max) * 50);
      return `<div class="ai-br pc-${s}"><span class="n">${esc(C.nmRaw(s))}</span><span class="tr"><i class="z"></i><i class="b ${v < 0 ? "neg" : "pos"}" style="${v < 0 ? `right:50%;` : `left:50%;`}width:${w.toFixed(1)}%"></i></span><b class="${this._rvIsYou(s) ? (v > 0.4 ? "up" : v < -0.4 ? "dn" : "") : ""}">${sgn(v)}%</b></div>`; }).join("")}</div>`;
  },
  _aiVPoints(card, C) {
    const src = C.st?.sources; if (!src) return "";
    const seats = this._aiSeatRows(card, C), mx = Math.max(this.winPoints || 10, ...src.map((s) => s.total)), used = SRC.filter(([k]) => src.some((s) => s[k] > 0));
    const rows = seats.map((s) => `<div class="ai-br pc-${s}"><span class="n">${esc(C.nmRaw(s))}</span><span class="tr st">${used.map(([k, c]) => (src[s][k] > 0 ? `<i class="s-${c}" style="width:${((src[s][k] / mx) * 100).toFixed(1)}%" title="${esc(C.t.legend[c] || k)} ${src[s][k]}"></i>` : "")).join("")}</span><b>${src[s].total}</b></div>`).join("");
    return `<div class="ai-vz ai-bars">${rows}<div class="ai-leg">${used.map(([k, c]) => `<span><i class="sw s-${c}"></i>${esc(C.t.legend[c] || k)}</span>`).join("")}</div></div>`;
  },
  _aiVPlan(card, C) {
    const all = card.route || card.clauses?.length >= 2 || (card.level === "strategy" && (!card.seats.length || card.seats.length >= C.n)), seats = all ? (card.rows?.length ? card.rows : this.players.map((p) => p.id)) : this._aiSeatRows(card, C), W = 250, H = 22, mx = Math.max(1, C.maxT), x = (t) => 7 + (t / mx) * (W - 14);
    const icon = planIcon;
    const band = card.turns.length ? `<rect class="bd" x="${(x(Math.min(...card.turns)) - 4).toFixed(1)}" y="0" width="${(x(Math.max(...card.turns)) - x(Math.min(...card.turns)) + 8).toFixed(1)}" height="${H}" rx="4"/>` : "";
    const rowsAll = (s) => { let last = -99; const ic = C.tl[s].map(([t, k]) => { let cx = x(t); if (cx - last < 9) cx = last + 9; last = cx; return icon(k, Math.min(W - 6, cx).toFixed(1) * 1, 11); }).join("");
      const pl = C.plan(s), cl = card.clauses.find((c) => c.seat === s), X = C.t.x, rt = C.route(s);
      const cnt = (k, n) => (n === 1 && (k === "cities" || k === "settlements") ? C.t.legend[k === "cities" ? "c" : "s"].toLowerCase() : X.parts[k]), goalTx = rt ? rt.goal.map(({ k, n }) => (k === "cities" || k === "settlements" || k === "cards" ? `${n} ${cnt(k, n)}` : X.parts[k])).join(" + ") : "";
      const sc = rt ? Math.max(rt.target, rt.total) : 1, vd = rt?.verdict?.v, vTx = vd === "worked" && rt.total < rt.target ? `\u2248 ${X.close} ${rt.target - rt.total}` : vd === "worked" ? (rt.verdict.luck ? `\u2713 ${X.okLuck} \u00b7 T${rt.verdict.at}` : `\u2713 ${X.ok}`) : vd === "stalled" ? `\u23F8 ${X.stall} ${rt.verdict.at}${rt.verdict.cause ? ` \u00b7 ${X[rt.verdict.cause]}` : ""}` : vd === "wrong" ? `\u2717 ${X.bad}` : "";
      const missTx = rt?.missing ? `${X.route[rt.missing.kind] || rt.missing.kind}${Object.keys(rt.missing.cards).length ? ` \u00b7 ${Object.entries(rt.missing.cards).map(([r, n]) => `${n} ${X.res[r] || r}`).join(" ")}` : ""}`.toLowerCase() : "", bar = rt ? `<div class="rt-bar" data-aibar="${s}">${rt.segments.map((g) => `<span class="rt-sg k-${g.kind}${g.luck ? " lk" : ""}" data-pts="${g.pts}" data-turn="${g.turn}"${g.luck ? ` data-luck="1" title="${esc(X.lucky)}"` : ""} style="flex:${g.pts} 0 0"><svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true">${planIcon(g.kind, 7, 7)}</svg><small>${g.luck ? "\u2684 " : ""}${g.turn}</small></span>`).join("")}${rt.total < rt.target ? `<span class="rt-ms" data-pts="${rt.target - rt.total}" style="flex:${rt.target - rt.total} 0 0"><b>${rt.target - rt.total < 3 ? `+${rt.target - rt.total}` : esc(missTx)}</b></span>` : `<span class="rt-fl" aria-label="${rt.target}">\u2691</span>`}</div>${rt.total < rt.target && rt.target - rt.total < 3 && missTx ? `<div class="rt-need">${esc(X.miss)}: ${esc(missTx)}</div>` : ""}${this._aiIncomeStrip(rt, C)}` : "";
      return `<div class="ai-pr2 pc-${s}" data-aipr="${s}"><div class="hd"><span class="n">${esc(C.nmRaw(s))}</span>${goalTx ? `<em>${esc(X.goal)}: ${esc(goalTx)}</em>` : lab ? `<em>${esc(lab)}</em>` : ""}${vTx ? `<i class="rt-v v-${vd === "worked" && rt.total < rt.target ? "close" : vd}">${esc(vTx)}</i>` : ""}<b>${pl ? pl.total : ""}${rt ? `/${rt.target}` : ""}</b></div>${bar || `<svg viewBox="0 0 ${W} ${H}" aria-label="${esc(C.nmRaw(s))}">${band}<line x1="4" x2="${W - 4}" y1="11" y2="11" class="ln"/>${ic}</svg>`}${cl ? `<div class="cl">${this._aiFmt(cl.text, C, card, { plain: true })}</div>` : (sp => (sp ? `<div class="cl soft">${esc(`${sp.coherencePct}% ${C.t.x.fitTx}`)}</div>` : ""))(C.start(s))}</div>`; };
    const rows = all ? seats.map(rowsAll).join("") : seats.map((s) => { let last = -99; const ic = C.tl[s].map(([t, k]) => { let cx = x(t); if (cx - last < 9) cx = last + 9; last = cx; return icon(k, Math.min(W - 6, cx).toFixed(1) * 1, 11); }).join("");
      return `<div class="ai-pr pc-${s}"><span class="n">${esc(C.nmRaw(s))}</span><svg viewBox="0 0 ${W} ${H}" aria-label="${esc(C.nmRaw(s))}">${band}<line x1="4" x2="${W - 4}" y1="11" y2="11" class="ln"/>${ic}</svg></div>`; }).join("");
    const used = new Set(C.tl.flat().map((q) => q[1]));
    return `<div class="ai-vz ai-plan${all ? " all" : ""}">${rows}<div class="ai-leg">${["s", "c", "L", "A", "v"].filter((k) => used.has(k)).map((k) => `<span><svg viewBox="0 0 14 14" width="12" height="12">${icon(k, 7, 7)}</svg>${esc(C.t.legend[k])}</span>`).join("")}</div></div>`;
  },
  /** "needed -> missing": the cheapest next point with the final hand (icon + what was missing as resource tags) and the estimate of turns. */
  _aiVNear(card, C) {
    const m = C.nm, X = C.t.x; if (!m) return "";
    const head = `<div class="nm-hd"><b>${m.youPoints}</b> <i>/</i> <b>${m.result === "won" ? m.youPoints - m.margin : m.winnerPoints}</b> <span>${esc(X.of)}</span>${m.bestWinChance ? `<span class="nm-b">${esc(X.best)} <b>${m.bestWinChance.pct}%</b> <button type="button" class="ai-t" data-ait="${m.bestWinChance.turn}">T${m.bestWinChance.turn}</button></span>` : ""}</div>`;
    if (!m.needed) return `<div class="ai-vz ai-nm">${head}</div>`;
    const kinds = { city: "c", settlement: "s", road: "L", army: "A", dev: "v" }, miss = Object.entries(m.needed.missing);
    const tags = miss.length ? miss.map(([r, a]) => `<span class="ai-r r-${r}">${a} ${esc(X.res[r] || r)}</span>`).join("") : `<span class="ai-r ok">${esc(X.ready)}</span>`;
    const away = m.turnsAway != null ? `<div class="nm-away">\u2248 <b>${m.turnsAway}</b> ${esc(m.turnsAway === 1 ? X.one : X.est)}</div>` : "";
    return `<div class="ai-vz ai-nm">${head}<div class="nm-need"><span class="nm-ic"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">${planIcon(kinds[m.needed.kind] || "v", 12, 12)}</svg><span>${esc(X.route[m.needed.kind] || m.needed.label)}${m.needed.note ? ` <small>(${esc(X.chance)})</small>` : ""}</span></span><span class="nm-ar" aria-hidden="true">\u2192</span><span class="nm-ms"><small>${esc(X.miss)}</small>${tags}</span></div>${away}</div>`;
  },
  /** v1.77 a tiny income strip: cards per turn by resource (5 mini bars, one scale for all players), the bottleneck bar outlined. */
  _aiIncomeStrip(rt, C) {
    const inc = rt?.income; if (!inc) return "";
    const X = C.t.x, R5 = ["wood", "brick", "sheep", "wheat", "ore"], mx = (this._aiIncC?.R === this._rv ? this._aiIncC : (this._aiIncC = { R: this._rv, v: Math.max(0.5, ...this.players.map((p) => Math.max(...Object.values(tryv(() => C.route(p.id))?.income?.perTurn || { a: 0 })))) })).v;
    const b = inc.bottleneck?.short ? inc.bottleneck.res : null;
    return `<div class="rt-inc" data-aiinc="${b || ""}" aria-label="${esc(X.inc)}">${R5.map((r) => `<span class="rt-ib r-${r}${r === b ? " bn" : ""}${inc.need[r] ? "" : " nn"}" data-res="${r}" title="${esc(`${r} ${inc.perTurn[r]} ${X.inc}${inc.ports.includes(r) ? " \u00b7 2:1" : ""}`)}"><i style="height:${Math.max(1, Math.round((inc.perTurn[r] / mx) * 14))}px"></i><small>${inc.perTurn[r]}</small></span>`).join("")}</div><div class="rt-incl">${esc(X.incT)}: ${R5.map((r) => esc(X.res[r])).join(" \u00b7 ")}${b ? ` \u00b7 ${esc(X.bnT)}` : ""}</div>`;
  },
  _aiVMoves(card, C, strict = false) {
    const set = new Set([card.focus, ...card.turns].filter((t) => t != null));
    let rows = C.decs.filter((x) => set.has(x.turn)).sort((a, b) => (b.own - a.own) || (b.gap - a.gap)).slice(0, 3);
    if (strict && rows.some((x) => x.own)) rows = rows.filter((x) => x.own);
    if (!rows.length && !strict) rows = C.decs.filter((x) => x.own).sort((a, b) => b.gap - a.gap).slice(0, 3);
    if (!rows.length) return "";
    const cl = (s) => esc(String(s ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/<[^>]+>/g, "").slice(0, 60));
    return `<div class="ai-vz ai-mv">${rows.map((x) => `<div class="ai-mr pc-${x.seat}"><button type="button" class="ai-t" data-ait="${x.turn}">${x.turn === 0 ? C.t.setup : `T${x.turn}`}</button>${x.own ? "" : `<i class="ai-dot"></i>`}<span class="mt"><s>${cl(x.d.x.label)}</s> → <b>${cl(x.d.x.best.label)}</b></span><em class="${x.own ? "dn" : "opp"}">${sgn(-x.gap * 100)}%</em></div>`).join("")}</div>`;
  },
  _aiVBoard(card, C) {
    const T0 = card.focus ?? card.turns[0]; if (T0 == null || !C.st) return "";
    const d = this._aiDecAt(T0, C);
    return `<div class="ai-vz"><div class="ai-bd" data-aibd="${T0}"><span class="ai-bdw" aria-hidden="true"></span></div>${d ? `<div class="ai-leg" data-aileg hidden><span><s class="rg a">A</s>${esc(C.t.better)}</span><span><s class="rg b">B</s>${esc(C.t.played)}</span></div>` : ""}</div>`;
  },
  // ── v1.79 visual blocks: the model names what to show, the app fetches every number (src/review/ai-blocks.js) ──
  _aiRawBlocks(bl) {
    return (Array.isArray(bl) ? bl : []).filter((b) => b && typeof b === "object").slice(0, 8).map((b) => JSON.parse(JSON.stringify(b, (k, v) => (typeof v === "string" ? v.slice(0, 300) : v)))).slice(0, 8);
  },
  _aiBkEnv(card, C) {
    return { C, game: this, g: this.geometry, ev: card.evRaw || [], maxT: C.maxT, seats: (names) => this._aiSeats(names, C), decAt: (T, seats) => this._aiDecAt(T, C, seats), pos: (f) => tryv(() => rvPos(this.geometry, f)) };
  },
  /** card.bk = the validated blocks of the model (when it gave any visual), card.blocks = the blocks of the card (the old view mapped on them when it gave none). */
  _aiCardBlocks(card, raw, C) {
    card.bk = null; card.blocks = [];
    const env = this._aiBkEnv({ evRaw: raw?.ev }, C);
    if (raw?.cant) return;
    const bl = tryv(() => aiBlocks(raw?.blocks, env), []);
    if (bl.some((b) => b.type !== "text")) { card.bk = bl; card.blocks = bl; }
    else card.blocks = tryv(() => legacyBlocks(card, env), []);
  },
  /** The numbers a text block may quote: the tool evidence, the card's chip and the values of its own blocks. */
  _aiBkNums(card) {
    const s = new Set([...(card.ev?.nums || [])]);
    (card.chg || []).forEach((c) => { if (c.d != null) s.add(Math.abs(c.d)); if (c.from != null) { s.add(c.from); s.add(c.to); } });
    (card.bk || []).forEach((b) => { (b.options || []).forEach((o) => s.add(o.v)); if (b.cost) s.add(b.cost); (b.marks || []).forEach((m) => m.win != null && s.add(m.win)); });
    return s;
  },
  _aiBlocksHtml(card, C, key) {
    const nums = this._aiBkNums(card); this._aiBk ||= new Map();
    return (card.bk || []).map((b, i) => {
      try {
        if (b.type === "text") {
          const ok = textOf(b.md).split(/(?<=[.!?])\s+/).filter((sn) => [...sn.matchAll(/(\d+(?:[.,]\d+)?)\s?%/g)].every((m) => [...nums].some((a) => Math.abs(a - parseFloat(m[1].replace(",", "."))) <= 1))).join(" ");
          return ok ? `<div class="ai-tx bk-tx" lang="${C.lang}">${this._aiFmt(ok, C, card)}</div>` : "";
        }
        return this._aiBlockHtml(b, card, C, `${key}:${i}`);
      } catch (e) { console.warn("ai visual", e); return ""; }
    }).join("");
  },
  _aiBlockHtml(b, card, C, bkey) {
    const wrap = (inner, cls = "") => (inner ? `<div class="ai-vz ai-bk bk-${b.type}${cls ? " " + cls : ""}" data-bk="${b.type}">${inner}</div>` : "");
    const strip = (h) => h.replace(/^<div class="ai-vz[^"]*">/, "").replace(/<\/div>$/, "");
    switch (b.type) {
      case "line": return wrap(strip(this._aiVWin({ seats: b.series.map((s) => s.seat), turns: [], focus: null, chg: [] }, C, { t0: b.t0, t1: b.t1, marks: b.marks })));
      case "bars": {
        const k = { seats: [], rows: b.seats, turns: [], chg: [] };
        return wrap(strip(b.metric === "luck" ? this._aiVLuck(k, C) : b.metric === "points" ? this._aiVPoints(k, C) : this._aiVIncome(k, C)));
      }
      case "route": return wrap(strip(this._aiVPlan({ seats: [], rows: b.seats, route: true, clauses: [], turns: [], level: "game" }, C)), "ai-plan all");
      case "timeline": return wrap(this._aiVTimeline(b, C));
      case "spots": return wrap(this._aiVSpots(b, C));
      case "compare": return wrap(this._aiVCompare(b, C, !!card.chg?.some((c) => c.move)));
      case "board": {
        this._aiBkSpec ||= new Map(); this._aiBkSpec.set(bkey, b);
        return wrap(`<div class="ai-bd" data-aibd="${b.turn}" data-aibk="${bkey}"><span class="ai-bdw" aria-hidden="true"></span></div>${this._aiBkLegend(b, C)}`);
      }
      default: return "";
    }
  },
  _aiVIncome(card, C) {
    const rows = card.rows.map((s) => ({ s, v: Object.values(tryv(() => C.route(s))?.income?.perTurn || {}).reduce((a, x) => a + x, 0) })), mx = Math.max(1, ...rows.map((r) => r.v));
    return `<div class="ai-vz ai-bars">${rows.map((r) => `<div class="ai-br pc-${r.s}"><span class="n">${esc(C.nmRaw(r.s))}</span><span class="tr"><i class="b pos" style="left:0;width:${((r.v / mx) * 100).toFixed(1)}%"></i></span><b>${(Math.round(r.v * 10) / 10).toString()}</b></div>`).join("")}<div class="ai-cap">${esc(C.t.x.inc)}</div></div>`;
  },
  _aiVTimeline(b, C) {
    const ev = b.items, W = 300, x = (t) => 10 + ((t - b.from) / Math.max(1, b.to - b.from)) * (W - 20); let last = -99;
    const ic = ev.map(([t, k]) => { let cx = x(t); if (cx - last < 12) cx = last + 12; last = cx; return `<g data-ait="${t}">${planIcon(k, Math.min(W - 8, cx).toFixed(1) * 1, 13)}<text x="${Math.min(W - 8, cx).toFixed(1)}" y="31" text-anchor="middle">${t}</text></g>`; }).join("");
    const used = new Set(ev.map((e) => e[1]));
    return `<div class="ai-pr tl pc-${b.seat}"><span class="n">${esc(C.nmRaw(b.seat))}</span><svg viewBox="0 0 ${W} 36" aria-label="${esc(C.nmRaw(b.seat))}"><line x1="4" x2="${W - 4}" y1="13" y2="13" class="ln"/>${ic}</svg></div><div class="ai-leg">${["s", "c", "L", "A", "v"].filter((k) => used.has(k)).map((k) => `<span><svg viewBox="0 0 14 14" width="12" height="12">${planIcon(k, 7, 7)}</svg>${esc(C.t.legend[k])}</span>`).join("")}</div>`;
  },
  _aiVCompare(b, C, hasChip = false) {
    const T = CHAT[C.lang] || CHAT.en, mx = Math.max(...b.options.map((o) => o.v)), hi = Math.min(100, Math.max(20, (Math.floor(mx / 10) + 1) * 10)), you = this._rvIsYou(b.seat), nl = C.lang === "nl";
    const rows = b.options.map((o, i) => `<div class="ai-sr rec bkc${i === b.bestIdx ? " best" : ""} k-${o.kind}"><span class="l"><em class="tg ${o.kind}">${esc(o.kind === "played" ? T.played : o.kind === "best" || (i === b.bestIdx && o.kind !== "alt") ? String(C.t.better).replace(/^[AB]\s+/, "") : "alt")}</em>${esc(o.label)}</span><span class="tr"><i style="width:${Math.max(1, (o.v / hi) * 100).toFixed(1)}%"></i></span><b>${i === b.bestIdx ? "★ " : ""}${o.v}%${o.pm ? `<small>±${o.pm}</small>` : ""}</b></div>`).join("");
    const cost = b.cost && !hasChip ? `<div class="bk-ft"><span class="ai-chg dn pc-${b.seat}"><b>−${b.cost}%</b><small>${esc(you ? C.t.mine : C.t.move)}</small></span><span class="ai-cap">${esc(T.wc)}</span></div>` : "";
    return `<div class="ai-sm rec" data-aisimv>${rows}<div class="ai-ax" aria-hidden="true"><span class="tk"><i>0%</i><i>${hi / 2}%</i><i>${hi}%</i></span><span></span></div>${cost}</div>`;
  },
  // v1.80 the factor table of a set-up / settlement / city decision (src/review/ai-spots.js): one row per factor, the winning cell lit
  _aiVSpots(b, C) {
    const n = b.opts.length, hd = b.opts.map((o) => `<div class="sp-h"><s class="rg ${o.letter === "A" ? "a" : o.letter === "B" ? "b" : "n"}">${o.letter}</s>${o.win != null ? `<b>${o.win}%</b>` : ""}</div>`).join("");
    const rows = b.rows.map((r) => `<div class="sp-l">${esc(r.label)}</div>${r.cells.map((c, i) => `<div class="sp-c${r.win === i ? " win" : ""}">${esc(c ?? "\u2014")}</div>`).join("")}`).join("");
    return `<div class="ai-sp" style="--n:${n}"><div class="sp-h0"></div>${hd}${rows}</div>${b.summary ? `<div class="sp-sum">${esc(b.summary)}</div>` : ""}${b.rule ? `<div class="sp-rule">${esc(b.rule)}</div>` : ""}`;
  },
  _aiBkLegend(b, C) {
    const T = CHAT[C.lang] || CHAT.en, cut = (s) => esc(String(s || "").length > 26 ? `${String(s).slice(0, 25)}…` : s || "");
    const items = b.marks.map((m) => {
      const chip = m.win != null ? `<b>${m.win}%</b>` : "";
      if (m.kind === "better") return `<span class="lg"><s class="rg a">A</s>${esc(String(C.t.better).replace(/^[AB]\s+/, ""))}${chip}</span>`;
      if (m.kind === "played") return `<span class="lg"><s class="rg b">B</s>${esc(String(C.t.played).replace(/^[AB]\s+/, ""))}${chip}</span>`;
      if (m.kind === "alt") return `<span class="lg"><s class="rg n">${m.n}</s>${cut(m.label)}${chip}</span>`;
      if (m.kind === "robber") return `<span class="lg"><s class="rg r">⚉</s>${esc(C.lang === "nl" ? "Struikrover" : "Robber")}</span>`;
      return `<span class="lg"><s class="rg f"></s>${cut(m.label) || esc(C.t.show || "")}</span>`;
    }).join("");
    return `<div class="ai-leg bk-lg">${items}</div>`;
  },
  /** The marks and arrows of a board block in the picture's own pixels (the shot's view). */
  _aiBkSvg(s, b, only = null) {
    const g = this.geometry, V = s.view, hs = g.hexSize * V.scale, xy = (p) => [p.x * V.scale + V.offsetX, p.y * V.scale + V.offsetY];
    const at = (f) => { const p = rvPos(g, f), c = xy(p); return { c, p, r: p.hex ? hs * 0.6 : Math.max(8, Math.min(p.edge ? 11 : 13, hs * 0.34)) }; };
    const inP = (a) => !only || only.some((q) => Math.hypot(q.x - a.p.x, q.y - a.p.y) < 1);
    let out = "";
    b.arrows.forEach((a) => {
      const A = at(a.from), B = at(a.to); if (only ? !(inP(A) && inP(B)) : false) return;
      const [x1, y1] = A.c, [x2, y2] = B.c, L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, e1 = [x1 + ux * (A.r + 3), y1 + uy * (A.r + 3)], e2 = [x2 - ux * (B.r + 5), y2 - uy * (B.r + 5)], col = a.kind === "alt" ? "#E0A526" : "var(--primary)";
      if (L > A.r + B.r + 10) out += `<g class="mk-arrow"><line x1="${e1[0].toFixed(1)}" y1="${e1[1].toFixed(1)}" x2="${e2[0].toFixed(1)}" y2="${e2[1].toFixed(1)}" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/><line x1="${e1[0].toFixed(1)}" y1="${e1[1].toFixed(1)}" x2="${e2[0].toFixed(1)}" y2="${e2[1].toFixed(1)}" stroke="${col}" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round"/><path d="M${e2[0].toFixed(1)},${e2[1].toFixed(1)} l${(-ux * 11 - uy * 7).toFixed(1)},${(-uy * 11 + ux * 7).toFixed(1)} l0,0 M${e2[0].toFixed(1)},${e2[1].toFixed(1)} l${(-ux * 11 + uy * 7).toFixed(1)},${(-uy * 11 - ux * 7).toFixed(1)}" stroke="${col}" stroke-width="3" stroke-linecap="round" fill="none"/></g>`;
    });
    b.marks.forEach((m) => {
      const M = at(m.focus); if (!inP(M)) return; const [x, y] = M.c, r = M.r, bx = x + r * 0.8, by = y - r * 0.8;
      const badge = (txt, fill, stroke, col) => `<g transform="translate(${bx.toFixed(1)} ${by.toFixed(1)})"><circle r="8" fill="${fill}" stroke="${stroke}" stroke-width="2"/><text y="4.4" text-anchor="middle" font-size="11.5" font-weight="800" fill="${col}">${txt}</text></g>`;
      if (m.kind === "better") out += `${M.p.hex ? `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--primary)" opacity=".22"/>` : ""}<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="7"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="var(--primary)" stroke-width="3.6"/>${badge("A", "var(--primary)", "#fff", "#fff")}`;
      else if (m.kind === "played") out += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="3.5" stroke-dasharray="6 4"/>${badge("B", "#fff", "var(--primary)", "var(--primary)")}`;
      else if (m.kind === "alt") out += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="6"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#E0A526" stroke-width="3" stroke-dasharray="5 3"/>${badge(m.n, "#E0A526", "#fff", "#2b2210")}`;
      else if (m.kind === "robber") out += `<circle cx="${x}" cy="${y}" r="${r}" fill="#23201c" opacity=".38"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="5"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#23201c" stroke-width="2.6"/>${badge("⚉", "#23201c", "#fff", "#fff")}`;
      else out += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="5"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round"/>`;
    });
    return out;
  },
  /** The board of a block into its element: zoomed to the marks (two pictures when they are far apart), rings and arrows drawn over the real renderer. */
  _aiBkBoard(el, C, w) {
    const b = this._aiBkSpec?.get(el.dataset.aibk); if (!b) return false;
    const g = this.geometry, pts = [...b.marks.map((m) => m.focus), ...b.arrows.flatMap((a) => [a.from, a.to])].map((f) => tryv(() => rvPos(g, f))).filter(Boolean);
    const d = b.dec?.d || null, h = Math.round(w * 0.62), tag = (u) => u.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(";");
    const ov = (u) => ({ d, use: u, tag: `${b.turn}:${tag(u)}${b.zoom}` });
    const s = this._aiShot(b.turn, C, w, h, null, b.zoom === "full" ? { d, use: [], tag: `full${b.turn}` } : ov(pts)); if (!s) return false;
    let panels = null;
    if (s.far && pts.length >= 2) { // far apart: two zoomed pictures, each with its own cluster
      let ia = 0, ib = 1, best = -1; pts.forEach((p, i) => pts.forEach((q, j) => { const dd = Math.hypot(p.x - q.x, p.y - q.y); if (dd > best) { best = dd; ia = i; ib = j; } }));
      const ga = [], gb = []; pts.forEach((p) => (Math.hypot(p.x - pts[ia].x, p.y - pts[ia].y) <= Math.hypot(p.x - pts[ib].x, p.y - pts[ib].y) ? ga : gb).push(p));
      const w2 = Math.floor((w - 6) / 2), h2 = Math.round(w2 * 0.95), sa = this._aiShot(b.turn, C, w2, h2, null, ov(ga)), sb = this._aiShot(b.turn, C, w2, h2, null, ov(gb));
      if (sa && sb) panels = [[sa, ga], [sb, gb]];
    }
    el.style.aspectRatio = "auto";
    if (panels) { el.dataset.zoom = "two"; el.innerHTML = `<div class="bd2">${panels.map(([q, u]) => `<div class="bdp"><img src="${q.url}" alt="" width="${q.w}" height="${q.h}"><svg viewBox="0 0 ${q.w} ${q.h}" aria-hidden="true">${this._aiBkSvg(q, b, u)}</svg></div>`).join("")}</div>`; }
    else { el.dataset.zoom = s.box ? Math.round(((s.box.maxX - s.box.minX) * (s.box.maxY - s.box.minY)) / (s.full.w * s.full.h) * 100) : ""; el.innerHTML = `<img src="${s.url}" alt="" width="${s.w}" height="${s.h}"><svg viewBox="0 0 ${s.w} ${s.h}" aria-hidden="true">${this._aiBkSvg(s, b)}</svg>`; }
    return true;
  },
  /** The view that fits the box of the spots plus a ring of hexes, whole, in a w x h picture: no hex of it is ever clipped. */
  _aiCropView(use, w, h, fitScale) {
    const g = this.geometry; if (!use?.length || !g) return null;
    const m = g.hexSize * 1.8, xs = use.map((p) => p.x), ys = use.map((p) => p.y), minX = Math.min(...xs) - m, maxX = Math.max(...xs) + m, minY = Math.min(...ys) - m, maxY = Math.max(...ys) + m;
    const pad = 16, sc = Math.min((w - 2 * pad) / (maxX - minX), (h - 2 * pad) / (maxY - minY), fitScale * 3.4);
    return { scale: sc, offsetX: w / 2 - ((minX + maxX) / 2) * sc, offsetY: h / 2 - ((minY + maxY) / 2) * sc, box: { minX, maxX, minY, maxY } };
  },
  /** The board at the turn as a picture (the Replay's renderer into an off-screen canvas), zoomed to the decision's A and B, or what was built. */
  /** The spots a board picture is about: a decision's A and B (plus the spots of its reason), or what was built that turn. */
  _aiSpots(T0, C, only = null) {
    const g = this.geometry, st = this._st, d = this._aiDecAt(T0, C)?.d; let A = null, B = null, pts = [];
    if (d) {
      A = d.x.best?.focus; B = d.x.focus;
      const W = d.x.why?.mark; pts = [A, B, ...(W ? [...(W.nodes || []).map((node) => ({ node })), ...(W.edges || []).map((edge) => ({ edge }))] : [])].filter(Boolean).map((f) => tryv(() => rvPos(g, f))).filter(Boolean);
    } else {
      for (let q = 1; q <= st.N; q++) if ((st.turnOf[q] ?? 0) === T0) (st.stepEvents[q] || []).forEach((e) => { if (e[1] === "b") { const f = e[3] === "r" || e[3] === "h" ? { edge: e[4] } : { node: e[4] }; try { pts.push(rvPos(g, f)); } catch (_) { /* skip */ } } });
    }
    const ab = d ? [A, B].filter(Boolean).map((f) => tryv(() => rvPos(g, f))).filter(Boolean) : [];
    if (only && d) { const f = only === "A" ? A : B, p = f ? tryv(() => rvPos(g, f)) : null; return { d, A: only === "A" ? A : null, B: only === "B" ? B : null, use: p ? [p] : ab, both: ab.length === 2 }; }
    return { d, A, B, use: ab.length ? ab : pts, both: ab.length === 2 };
  },
  /** The board at the turn as a picture (the Replay's renderer into an off-screen canvas), zoomed to the decision's A and B plus a ring of hexes, or what was built.
   *  The picture is as tall as that box needs (a tall box gets a taller picture instead of a smaller board). */
  _aiShot(T0, C, w, h0, only = null, ov = null) {
    const key = `${this._rvPid}|${T0}|${w}|${only || ""}|${ov?.tag || ""}`; this._aiImgs ||= new Map();
    if (this._aiImgs.has(key)) return this._aiImgs.get(key);
    const g = this.geometry, st = this._st; if (!g || !st) return null;
    const sp = ov ? { d: ov.d, use: ov.use, both: ov.use.length >= 2 } : this._aiSpots(T0, C, only), d = sp.d, box = this._aiCropView(sp.use, w, h0, 1)?.box;
    const h = box ? Math.max(h0, Math.min(Math.round(w * 0.95), Math.round((w * (box.maxY - box.minY)) / (box.maxX - box.minX)))) : h0;
    const cv = document.createElement("canvas"); let out = null;
    this._rpOpen(cv, w, h);
    try {
      if (d) { const rec = this._rv.recs[d.i]; this._rpSeek(rec.s, rec.e); }
      else { let k = 0; for (let q = 1; q <= st.N; q++) if ((st.turnOf[q] ?? 0) === T0) k = q; this._rpSeek(k); }
      const fit = this._rpFitView(w, h, 8), v = this._aiCropView(sp.use, w, h, fit.scale);
      if (v) this.view = v;
      this.boardRenderer?.resync?.(); this.boardRenderer?.invalidateStatic?.();
      if (this.boardRenderer) { this.boardRenderer.anims = []; this.boardRenderer.draw(performance.now()); } else this.drawCanvasScene(); // synchronous: requestDraw would paint after the canvas is read
      out = { url: cv.toDataURL("image/png"), marks: d && !ov ? rvMarks(this, d, sp.A, sp.B, { tight: true }) : "", w, h, view: { scale: this.view.scale, offsetX: this.view.offsetX, offsetY: this.view.offsetY }, box: v?.box, full: { w: w / fit.scale, h: h / fit.scale }, far: !only && sp.both && !ov?.tag?.startsWith("full") && v?.box && ((v.box.maxX - v.box.minX) * (v.box.maxY - v.box.minY)) / ((w / fit.scale) * (h / fit.scale)) > 0.5 };
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
      if (el.dataset.aibk) { // v1.79 a board block: its own rings and arrows
        el.dataset.done = "1"; if (!tryv(() => this._aiBkBoard(el, C, w))) el.closest(".ai-vz")?.remove();
        setTimeout(next, 20);
        if (!els.length) { const r = this._aiRestore, sc = this._rvEl?.querySelector(".rv-scroll"); if (r && sc && Date.now() < r.until) sc.scrollTop = r.y; this._aiRestore = null; }
        return;
      }
      let s = this._aiShot(+el.dataset.aibd, C, w, h), two = null;
      if (s?.far) { const w2 = Math.floor((w - 6) / 2), h2 = Math.round(w2 * 0.95), sa = this._aiShot(+el.dataset.aibd, C, w2, h2, "A"), sb = this._aiShot(+el.dataset.aibd, C, w2, h2, "B"); if (sa && sb) two = [sa, sb]; } // A and B far apart: one zoomed picture of each, not the whole board
      el.dataset.done = "1";
      const vz = el.closest(".ai-vz");
      if (vz && this._aiDecAt(+el.dataset.aibd, C) && (!s || !s.marks)) { // a decision with no place on the board: its moves instead of a bare picture
        const mv = this._aiVMoves({ focus: +el.dataset.aibd, turns: [+el.dataset.aibd] }, C, true);
        if (mv) { vz.outerHTML = mv; }
        else vz.remove();
        root.querySelectorAll(".ai-mv [data-ait]:not([data-w])").forEach((b) => { b.dataset.w = "1"; b.addEventListener("click", (e) => { e.stopPropagation(); this._aiNav(() => this._rcGoTurn(parseInt(b.dataset.ait, 10), null, false)); }); });
        setTimeout(next, 20); return;
      }
      if (s?.marks) el.closest(".ai-vz")?.querySelector("[data-aileg]")?.removeAttribute("hidden"); // A / B only where the move has a place on the board
      if (s && two) { el.style.aspectRatio = "auto"; el.dataset.zoom = "two"; el.innerHTML = `<div class="bd2">${two.map((q) => `<div class="bdp"><img src="${q.url}" alt="" width="${q.w}" height="${q.h}"><svg viewBox="0 0 ${q.w} ${q.h}" aria-hidden="true">${q.marks}</svg></div>`).join("")}</div>`; }
      else if (s) { el.style.aspectRatio = "auto"; el.dataset.zoom = s.box ? Math.round(((s.box.maxX - s.box.minX) * (s.box.maxY - s.box.minY)) / (s.full.w * s.full.h) * 100) : ""; el.innerHTML = `<img src="${s.url}" alt="" width="${s.w}" height="${s.h}"><svg viewBox="0 0 ${s.w} ${s.h}" aria-hidden="true">${s.marks}</svg>`; } else el.closest(".ai-vz")?.remove();
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
  /** The chat under the insight cards, oldest first: the open answer in full (the newest by default), the others one line (tap to open). A visual
   *  already shown by an insight card or an earlier answer is not drawn again: a link to that card instead. */
  _aiThread(ans, S, C, seen) {
    if (!ans.length) return [];
    const T = CHAT[C.lang] || CHAT.en, sig = (k) => (k.view && k.view !== "none" && (k.turns.length || k.seats.length) ? `${k.view}|${[...k.turns].sort((a, b) => a - b).join()}|${[...k.seats].sort().join()}` : "");
    const shown = new Map(); (S?.insights?.cards || []).forEach((c, i) => { const g = sig(this._aiCard(c, C)); if (g && !shown.has(g)) shown.set(g, `c${i}`); });
    const openAt = this._aiOpen != null && ans.some((a) => a.at === this._aiOpen) ? this._aiOpen : ans[0].at, out = [];
    for (let i = ans.length - 1; i >= 0; i--) {
      const a = ans[i], card = this._aiCard(a.a, C, { answer: true }), g = sig(card), key = `a${i}`;
      if (a.at !== openAt) {
        out.push(`<section class="ai-c ans col" data-aic="${key}"><button type="button" class="ai-colb" data-aiopen="${a.at}" aria-expanded="false"><b>${esc(a.q)}</b><span>${esc(card.text || "")}</span></button></section>`);
      } else {
        out.push(this._aiCardHtml(card, C, { q: a.q, pin: !!a.pinned, idx: i, key, seen, ref: g && shown.has(g) ? shown.get(g) : "" }));
      }
      if (g && !shown.has(g)) shown.set(g, key);
    }
    if (ans.some((a) => !a.pinned)) out.push(`<p class="ai-ft"><span></span><button type="button" class="ai-rg" data-aiclear>${T.clear}</button></p>`);
    return out;
  },
  _aiErrHtml(C) { const e = this._aiUi?.err; return e ? `<section class="ai-c err" role="alert"><b class="ai-ti">${esc(C.t[e] || C.t.fail)}</b><div class="ai-ac"><button type="button" class="ai-a" data-airun>${C.t.again}</button></div></section>` : ""; },
  _aiBodyHtml() {
    const C = this._aiCtx(), L = C.t, S = this._aiSaved(), U = this._aiUi || {}, R = this._rv;
    const ans = (R.ai?.pid === C.pid && R.ai?.lang === C.lang ? R.ai.answers : (R.ai?.answers || []).filter((a) => a.pinned)) || [];
    const out = [], seen = new Set(); this._aiSrc = new Map();
    if (S) {
      const hl = this._aiHeadline(S.insights.headline, C);
      if (hl) out.push(`<p class="ai-hl" data-aitx="hl" lang="${C.lang}">${this._aiFmt(hl, C)}</p>`); this._aiSrc.set("hl", { text: hl, card: null, max: 2 });
      out.push(...this._aiCardList(S.insights.cards, C, seen, hl));
      out.push(`<p class="ai-ft"><span>${L.foot}</span>${online() ? `<button type="button" class="ai-rg" data-airun="1">${L.regen}</button>` : ""}</p>`);
    } else if (U.loading === "insights") out.push(`<p class="ai-hl sk">${L.wait}</p>${'<section class="ai-c" aria-busy="true"><div class="ai-sk"><i></i><i></i></div><div class="ai-skv"></div></section>'.repeat(3)}`);
    else if (U.err) out.push(this._aiErrHtml(C));
    out.push(...this._aiThread(ans, S, C, seen));
    if (U.sim) out.push(this._aiSimCardHtml(C));
    if (U.askErr) out.push(`<section class="ai-c err" role="alert"><b class="ai-ti">${esc(L[U.askErr] || L.fail)}</b></section>`);
    return out.join("");
  },
  /** The insight cards as html: a card is dropped when its main fact (same turn + same player, or the final points) or its title was already shown,
   *  and an app fallback ("Turn 21 \u00b7 your move") when another card already covers that turn. */
  /** The headline, unless it quotes a number the review does not have. */
  _aiHeadline(h, C) {
    h = String(h || "").trim(); if (!h) return "";
    if (DECIDED.test(h)) { const tn = h.match(/\b(?:turn|beurt)\s+(\d+)/i); if (!tn || !(C.big && C.big.d >= 15 && C.big.turn === +tn[1])) { const w = this.winner; return w ? (C.lang === "nl" ? `${C.nmRaw(w.id)} won het spel.` : `${C.nmRaw(w.id)} won the game.`) : ""; } }
    const nums = [...h.matchAll(/(\d+(?:[.,]\d+)?)\s?%/g)].map((m) => parseFloat(m[1].replace(",", "."))); if (!nums.length) return h;
    const A = this._aiAllowed({ turns: [], chg: [], view: "game" }, C, this.players.map((p) => p.id), "");
    return nums.every((v) => [...A].some((a) => Math.abs(a - v) <= 2)) ? h : "";
  },
  _aiCardList(cards, C, seen, headline = "") {
    const ks = cards.map((c, i) => ({ k: this._aiCard(c, C), i }));
    const covered = (x) => ks.some((y) => y !== x && !y.k.generic && y.k.focus != null && y.k.focus === x.k.focus);
    const dup = new Set(), facts = new Set(), out = [], norm = (t) => String(t || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(), titles = new Set(headline ? [norm(headline)] : []);
    const same = (t) => !!t && (titles.has(t) || (t.length >= 12 && [...titles].some((q) => q.includes(t) || t.includes(q))));
    ks.forEach((x) => {
      const k = x.k;
      if (same(norm(k.title))) { k.title = this._aiNeutralTitle(k, C); if (same(norm(k.title))) return; } // a title repeating the headline or another card: retitled, else dropped
      const id = `${k.level}|${k.view}|${[...k.seats].sort().join()}|${k.level === "decision" ? k.focus : ""}`;
      const fin = k.view === "points" || /\b(?:finished|ended|final|reached)\b[^.]*\b\d+ points?\b/i.test(k.text);
      const f = [k.focus != null ? `t${k.focus}|${k.seat ?? ""}` : "", fin ? "final" : ""].filter(Boolean), ti = norm(k.title);
      if (dup.has(id) || (k.generic && covered(x)) || f.some((q) => facts.has(q))) return;
      dup.add(id); f.forEach((q) => facts.add(q)); if (ti) titles.add(ti);
      out.push(this._aiCardHtml(k, C, { key: `c${x.i}`, seen }));
    });
    return out;
  },
  _aiAskHtml() {
    const C = { t: this._aiL() }, S = this._aiSaved(), L = C.t, R = this._rv;
    const asked = new Set((R.ai?.answers || []).map((a) => qkey(a.q)));
    const lastA = (R.ai?.answers || [])[0], src = [...(lastA?.followUps || []), ...(S?.insights?.followUps || [])];
    const chips = []; src.forEach((q) => { const c = aiChip(q, recapLang()); if (c && !asked.has(qkey(q)) && !chips.some((x) => x.c === c)) chips.push({ c, q: String(q).slice(0, 300) }); });
    if (S && !chips.length) { const lg = recapLang(), fb = FALLBACK[lg] || FALLBACK.en, fq = FALLQ[lg] || FALLQ.en; fb.forEach((c, i) => { if (!asked.has(qkey(fq[i]))) chips.push({ c, q: fq[i] }); }); }
    const busy = this._aiUi?.loading === "ask";
    const pend = busy ? `<div class="ai-pend" role="status" aria-busy="true"><i class="ai-spin"></i><b>${esc(this._aiUi?.q || "")}</b><span>${esc((CHAT[recapLang()] || CHAT.en).pend)}</span></div>` : "";
    return `<form class="ai-ask" data-aiform>${pend}${chips.length && S ? `<div class="ai-chips">${chips.slice(0, 3).map((x) => `<button type="button" class="ai-q" data-aiq="${esc(x.q)}"${busy ? " disabled" : ""}>${esc(x.c)}</button>`).join("")}</div>` : ""}
      <div class="ai-in"><input type="text" maxlength="300" enterkeyhint="send" autocomplete="off" placeholder="${esc(L.ph)}" aria-label="${esc(L.ph)}" data-aiin${!S ? " disabled" : ""}><button type="submit" class="rv-btn pri"${busy || !S ? " disabled" : ""}>${L.ask}</button></div></form>`;
  },
  _aiRefresh() {
    const el = this._rvEl; if (!el || this._rvTab !== "ai" || this._rvStep != null) return;
    const body = el.querySelector("[data-aibody]"), ask = el.querySelector("[data-aiask]"); if (!body || !ask) return;
    const kept = ask.querySelector("[data-aiin]")?.value, had = document.activeElement === ask.querySelector("[data-aiin]");
    body.innerHTML = this._aiBodyHtml(); ask.innerHTML = this._aiAskHtml();
    if (kept) { const i = ask.querySelector("[data-aiin]"); if (i && !i.disabled) i.value = kept; }
    if (had) ask.querySelector("[data-aiin]")?.focus({ preventScroll: true });
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
    body.querySelectorAll("[data-aisimcancel]").forEach((b) => b.addEventListener("click", () => { if (this._aiUi) this._aiUi.cancel = true; b.disabled = true; }));
    body.querySelectorAll("[data-airun]").forEach((b) => b.addEventListener("click", () => this._aiRun(true)));
    body.querySelectorAll("[data-aipin]").forEach((b) => b.addEventListener("click", () => { const a = this._rv.ai?.answers?.[+b.dataset.aipin]; if (!a) return; a.pinned = !a.pinned; this._aiSave(); this._aiRefresh(); }));
    body.querySelectorAll("[data-aiopen]").forEach((b) => b.addEventListener("click", () => { this._aiOpen = +b.dataset.aiopen; this._aiRefresh(); this._aiToAnswer(this._aiOpen); }));
    body.querySelectorAll("[data-aiclear]").forEach((b) => b.addEventListener("click", () => { const ai = this._rv.ai; if (!ai) return; ai.answers = ai.answers.filter((a) => a.pinned); this._aiOpen = null; this._aiSave(); this._aiRefresh(); }));
    body.querySelectorAll("[data-airef]").forEach((b) => b.addEventListener("click", () => { const t = body.querySelector(`[data-aic="${b.dataset.airef}"]`); if (!t) return; t.scrollIntoView?.({ block: "center", behavior: "smooth" }); t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash"); }));
    ask?.querySelector("[data-aiform]")?.addEventListener("submit", (e) => { e.preventDefault(); const i = ask.querySelector("[data-aiin]"), v = i.value.trim(); if (v) { i.value = ""; this._aiAsk(v.slice(0, 300), true); } });
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
      const sn = src.text.match(/(?:[^.!?]|[.!?](?!\s|$))+[.!?]+(?:\s+|$)/g)?.map((x) => x.trim()) || [];
      if (sn.length > 1) { // whole sentences first: the most that fit, so a cut never leaves half a sentence
        const drawS = (m) => { el.innerHTML = fmt(sn.slice(0, m).join(" ")) + more(0, "1", L.more); return el.getBoundingClientRect().height <= lim; };
        let k = 0; for (let m = sn.length - 1; m >= 1; m--) if (drawS(m)) { k = m; break; }
        if (k) { drawS(k); const tg = (open) => { el.innerHTML = open ? full + more(0, "0", L.less) : (drawS(k), el.innerHTML); wire(el); el.querySelector("[data-aimore]")?.addEventListener("click", (e) => { e.stopPropagation(); tg(!open); }); }; el.querySelector("[data-aimore]").addEventListener("click", (e) => { e.stopPropagation(); tg(true); }); return; }
      }
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
      if (r.ok && Array.isArray(j?.toolRequests)) return { tr: j };
      if (!r.ok || !j?.explain) return { err: "fail" };
      return { x: j.explain };
    } catch (e) { return { err: e?.name === "AbortError" ? "time" : "net" }; } finally { clearTimeout(to); }
  },
  // ── v1.77 the tool loop: the Function answers with tool requests; tier 1 runs here at once (src/review/ai-tools.js), tier 2 on the review engine ──
  _aiSimCache() {
    const R = this._rv; if (this._aiSC?.R !== R) this._aiSC = { R, m: new Map(Object.entries(R?.ai?.cache || {})) };
    return this._aiSC.m;
  },
  async _aiSimTool(q) {
    const R = this._rv, key = q.name + JSON.stringify(q.args), cache = this._aiSimCache();
    if (cache.has(key)) return cache.get(key);
    if (!this._aiAvail() || !reviewAvailable()) return { error: "the engine is not available now" };
    const plan = aiSimPlan(this, q.name, q.args); if (plan.error) return { error: plan.error };
    const idx = plan.reqs.map((r, i) => (r.rec ? i : -1)).filter((i) => i >= 0), outs = [];
    const U = this._aiUi || (this._aiUi = {}); U.sim = { n: idx.length, done: 0 }; U.cancel = false; this._aiRefresh();
    const lanes = Math.min(idx.length, await reviewLaneCount()); let next = 0;
    const lane = async (w) => { while (next < idx.length && !U.cancel) { const i = idx[next++], r = plan.reqs[i];
      const m = await reviewRequest({ type: "evaluate", base: plan.base, rec: r.rec, opts: { ...(r.opts || {}), ...(this._aiSimOpts || {}) } }, 150000, w).catch(() => null);
      outs[i] = m?.result || null; U.sim.done += 1; if (this._rv === R) this._aiRefresh(); } };
    await Promise.all(Array.from({ length: Math.max(1, lanes) }, (_, w) => lane(w)));
    U.sim = null; const cancelled = U.cancel; U.cancel = false;
    if (this._rv !== R) return { error: "gone" };
    if (cancelled) return { cancelled: true };
    const res = aiSimResult(plan, outs); cache.set(key, res); return res;
  },
  /** Ask the Function until it answers, running its tool requests. Caps: 6 rounds, 12 tool calls, engine calls 2 (insights) / 3 (a question). */
  async _aiLoop(mode, { lang, question, ms }) {
    const R = this._rv, idx = tryv(() => aiIndex(this)); if (!idx) return { err: "none" };
    const trace = [], simCap = CAPS.sims[mode]; let history = null, results = null, rounds = 0, calls = 0, sims = 0;
    for (;;) {
      const r = await this._aiCall({ mode, lang, ...(question ? { question } : {}), index: idx.json, ...(history ? { history, toolResults: results } : {}) }, ms);
      if (this._rv !== R) return { err: "gone" };
      if (r.err) return r;
      if (!r.tr) return { x: r.x, trace, n: idx.json.length };
      if (++rounds > CAPS.rounds) return { err: "fail" };
      results = [];
      for (const q of r.tr.toolRequests.slice(0, CAPS.calls)) {
        const t2 = TIER2.has(q.name); let res;
        if (calls >= CAPS.calls) res = { error: "tool budget used up" };
        else if (t2 && sims >= simCap) res = { error: "engine budget used up" };
        else { calls += 1; if (t2) sims += 1; res = t2 ? await this._aiSimTool(q) : aiToolRun(this, q.name, q.args || {}); }
        if (this._rv !== R) return { err: "gone" };
        if (res?.cancelled) { if (mode === "game") return { err: "cancel" }; res = { error: "cancelled by the user: do not state any what-if" }; }
        trace.push({ id: q.id, name: q.name, args: q.args, res, t: t2 ? 2 : 1 });
        results.push({ id: q.id, result: res });
      }
      history = r.tr.history;
    }
  },
  /** The evidence of a card / answer: the tool calls it names (only those that ran and gave a result), as stored: the numbers they gave, and the engine runs in full. */
  _aiEvOf(ids, trace, turn = null) {
    const seen = new Set();
    let l = Array.isArray(ids) ? ids.filter((x) => (trace || []).some((t) => t.id === x)) : [], inf = false;
    if (!l.length && trace?.length) l = trace.filter((t) => turn === "all" || (turn != null && +t.args?.turn === +turn)).map((t) => t.id), inf = true; // the model named none: the calls of that turn (an answer: all of them)
    return l.map((id) => (trace || []).find((t) => t.id === id)).filter((t) => t && t.res && !t.res.error && !seen.has(t.id) && seen.add(t.id)).slice(0, 4)
      .map((t) => ({ id: t.id, n: t.name, t: t.t, ...(inf ? { inf: true } : {}), nums: evNums(t.res), ...(t.t === 2 ? { r: t.res } : t.name === "get_decision" ? { r: aiSlimDecision(t.res) } : {}) }));
  },
  _aiSimCardHtml(C) {
    const sim = this._aiUi?.sim; if (!sim) return "";
    const T = CHAT[C?.lang || recapLang()] || CHAT.en, pct = Math.round((sim.done / Math.max(1, sim.n)) * 100);
    return `<section class="ai-c ai-simc" role="status" aria-busy="true" data-aisim><b class="ai-ti">${esc(T.simN(sim.n))}</b><span class="ai-sbar"><i style="width:${Math.max(6, pct)}%"></i></span><div class="ai-ac"><span class="ai-sn">${sim.done}/${sim.n}</span><button type="button" class="ai-a" data-aisimcancel>${esc(T.cancel)}</button></div></section>`;
  },
  /** The engine's win chances for the moves a card rests on: bars, the change against the move as played with its real sign. */
  /** The bars of a record card: the played move and the alternative on ONE scale (0 to 100%, axis shown), the values the badge and the text use. */
  _aiRecordBars(rec, C) {
    const T = CHAT[C.lang] || CHAT.en, row = (x, base) => `<div class="ai-sr rec${base ? " base" : ""}"><span class="l">${base ? `${esc(T.asPlayed)}: ` : ""}${esc(x.label)}</span><span class="tr"><i style="width:${Math.max(1, Math.min(100, x.v))}%"></i></span><b>${x.v}%${x.pm ? `<small>\u00b1${x.pm}</small>` : ""}</b></div>`;
    return `<div class="ai-vz ai-sm rec" data-aisimv>${row(rec.played, true)}${rec.alts.map((x) => row(x, false)).join("")}<div class="ai-ax" aria-hidden="true"><span class="tk"><i>0%</i><i>50%</i><i>100%</i></span><span></span></div></div>`;
  },
  _aiVSim(card, C) {
    if (card.rec) return this._aiRecordBars(card.rec, C);
    const T = CHAT[C.lang] || CHAT.en, rows = [];
    (card.ev?.sim || []).forEach((r) => { if (r.storedPlayedWinPct != null && !rows.some((x) => x.base && x.t === r.turn)) rows.push({ base: true, t: r.turn, label: T.asPlayed, v: r.storedPlayedWinPct });
      (r.results || []).forEach((x) => { if (x.winPct != null) rows.push({ label: x.label, v: x.winPct, d: x.vsPlayedPct, pm: x.plusMinusPct, best: x.bestMove }); }); });
    if (!rows.length) return "";
    return `<div class="ai-vz ai-sm" data-aisimv>${rows.slice(0, 6).map((x) => `<div class="ai-sr${x.base ? " base" : ""}"><span class="l">${esc(x.label)}</span><span class="tr"><i style="width:${Math.max(2, Math.min(100, x.v))}%"></i></span><b>${x.v}%${x.pm ? `<small>\u00b1${x.pm}</small>` : ""}</b>${x.d != null && !x.base ? `<em class="${x.d > 0 ? "up" : x.d < 0 ? "dn" : ""}${Math.abs(x.d) < 8 ? " nz" : ""}" title="${Math.abs(x.d) < 8 ? esc(T.noise) : ""}">${sgn(x.d)}</em>` : ""}</div>`).join("")}</div>`;
  },
  async _aiRun(force) {
    const R = this._rv, pid = this._rvPid, lang = recapLang();
    if (!R || !this.winner || this._aiUi?.loading === "insights") return;
    if (!online()) { this._aiUi = { pid, err: "net" }; this._aiRefresh(); return; }
    this._aiUi = { pid, loading: "insights", err: null }; this._aiRefresh();
    const r = await this._aiLoop("insights", { lang, ms: 90000 });
    if (r.err === "gone") return;
    if (this._rv !== R) return;
    const cards = Array.isArray(r.x?.cards) ? r.x.cards.filter((c) => c && typeof c === "object" && (c.title || c.text)).slice(0, 10) : [];
    { const nm0 = tryv(() => aiNearMiss(this)); if (nm0 && nm0.margin >= 1 && nm0.margin <= 2 && !cards.some((c) => c.view === "nearmiss")) { const c0 = cards.find((c) => c.level === "game" && (!c.view || c.view === "none" || c.view === "points")); if (c0) c0.view = "nearmiss"; } } // the close-game card always has its needed \u2192 missing visual
    if (r.x && !cards.length && !r.err) r.err = "fail";
    if (r.err) { this._aiUi = { pid, err: r.err }; this._aiRefresh(); return; }
    const keep = (R.ai?.answers || []).filter((a) => a.pinned || (!force && R.ai?.pid === pid && R.ai?.lang === lang));
    R.ai = { pid, lang, at: Date.now(), n: r.n, insights: { headline: String(r.x.headline || "").slice(0, 200), cards: cards.map((c) => ({ level: c.level, title: c.title, text: c.text, view: c.view, turns: c.turns, focusTurn: c.focusTurn, players: c.players, clauses: Array.isArray(c.clauses) ? c.clauses.slice(0, 8).map((x) => ({ player: String(x?.player ?? ""), text: String(x?.text ?? "") })) : [], blocks: this._aiRawBlocks(c.blocks), ev: this._aiEvOf(c.evidence, r.trace, c.focusTurn) })), followUps: (r.x.followUps || []).map(String).slice(0, 8) }, answers: keep, cache: Object.fromEntries([...this._aiSimCache()].slice(-10)) };
    this._aiUi = { pid, loading: null, err: null };
    this._aiSave(); this._aiRefresh();
  },
  /** Scroll the answer (by its time stamp) to the top of the scroll area. */
  _aiToAnswer(at) {
    const ans = this._rv?.ai?.answers || [], i = ans.findIndex((a) => a.at === at), el = i < 0 ? null : this._rvEl?.querySelector(`[data-aic="a${i}"]`);
    if (el) { el.scrollIntoView?.({ block: "start", behavior: "smooth" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  },
  async _aiAsk(q, typed = false) {
    const R = this._rv, pid = this._rvPid, lang = recapLang();
    if (!R || !q || this._aiUi?.loading === "ask") return;
    const ai = R.ai; if (!ai) return;
    const hit = ai.answers.findIndex((a) => qkey(a.q) === qkey(q));
    if (hit >= 0) { this._aiOpen = ai.answers[hit].at; this._aiUi = { pid }; this._aiRefresh(); this._aiToAnswer(this._aiOpen); return; }
    if (!online()) { this._aiUi = { pid, askErr: "net" }; this._aiRefresh(); return; }
    this._aiUi = { pid, loading: "ask", q }; this._aiRefresh();
    { const end = () => { const sc = this._rvEl?.querySelector(".rv-scroll"); if (sc) sc.scrollTo?.({ top: sc.scrollHeight, behavior: "smooth" }); }; end(); setTimeout(() => { if (this._aiUi?.loading === "ask") end(); }, 450); if (typed) this._rvEl?.querySelector("[data-aiin]")?.focus({ preventScroll: true }); }
    const r = await this._aiLoop("game", { lang, question: q, ms: 70000 });
    if (this._rv !== R || r.err === "gone") return;
    if (r.err === "cancel") { this._aiUi = { pid }; this._aiRefresh(); return; }
    if (r.err || !r.x?.answer) { this._aiUi = { pid, askErr: r.err || "fail" }; this._aiRefresh(); return; }
    const x = r.x, ids = Array.isArray(x.evidence) ? [...x.evidence] : [];
    // v1.77: the app reads "X instead of Y on turn T" itself; the engine tests exactly that when the model did not, and says plainly when it cannot
    const it = aiIntent(q); let cant = null;
    if (it) {
      const have = r.trace.some((t) => t.t === 2 && t.name === "simulate_moves" && t.res && !t.res.error && +t.res.turn === it.turn && (t.res.results || []).some((w) => w.winPct != null && aiKindOf(w.label) === it.x));
      if (!have) {
        const args = aiIntentArgs(this, it);
        if (!args) cant = aiCantMsg("", it, lang);
        else { const res = await this._aiSimTool({ name: "simulate_moves", args }); if (this._rv !== R) return;
          if (res?.cancelled) { this._aiUi = { pid }; this._aiRefresh(); return; }
          const row = (res?.results || []).find((w) => w.winPct != null);
          if (res?.error || !row) cant = aiCantMsg(res?.error || (res?.results || []).find((w) => w.error)?.error, it, lang);
          else { r.trace.push({ id: "app1", name: "simulate_moves", args, res, t: 2 }); ids.push("app1"); } }
      }
    } else if (/\b(?:my|mijn)\b/i.test(q) && /\b(?:turn|beurt)[- ]?(\d+)/i.test(q) && /bad|good|mistake|best|worst|wrong|move|robber|rover|build|road|city|settlement|trade|fout|slecht|goed|zet/i.test(q) && !r.trace.some((t) => t.name === "get_decision" && t.res && !t.res.error)) {
      const T0 = +q.match(/\b(?:turn|beurt)[- ]?(\d+)/i)[1], mine = aiDecList(this).filter((e) => e.seat === this._rvPid && e.turn === T0), rb = /robber|rover/i.test(q) ? mine.find((e) => e.x.k === "robber") : null, e0 = rb || [...mine].sort((a, b) => b.gap - a.gap)[0];
      if (e0) { const res = aiToolRun(this, "get_decision", { player: "You", turn: T0, n: e0.n }); if (!res.error) { r.trace.push({ id: "app2", name: "get_decision", args: { player: "You", turn: T0, n: e0.n }, res, t: 1 }); ids.push("app2"); } }
    }
    x.evidence = ids;
    const at = Date.now(); this._aiOpen = at;
    ai.answers.unshift({ q, at, pinned: false, followUps: (x.followUps || []).map(String).slice(0, 6), a: { ...(it ? { intent: it } : {}), ...(cant ? { cant: true } : {}), answer: cant || String(x.answer), points: (x.points || []).map(String).slice(0, 4), view: x.view, turns: x.turns, focusTurn: cant ? it.turn : x.focusTurn, players: x.players, blocks: cant ? [] : this._aiRawBlocks(x.blocks), ev: cant ? [] : this._aiEvOf(ids.length ? ids : x.evidence, r.trace, "all") } });
    ai.cache = Object.fromEntries([...this._aiSimCache()].slice(-10));
    while (ai.answers.length > 12) { const i = ai.answers.map((a) => !a.pinned).lastIndexOf(true); if (i < 0) break; ai.answers.splice(i, 1); }
    this._aiUi = { pid };
    this._aiSave(); this._aiRefresh();
    this._aiToAnswer(at);
  },
};
// leaving or entering the network: the tab (and the Overview row) show only online
if (typeof window !== "undefined") ["online", "offline"].forEach((ev) => window.addEventListener(ev, () => { const g = window.__colonistGame; if (g?._rvEl && g._rvStep == null) tryv(() => g._rvDrawReview()); }));
