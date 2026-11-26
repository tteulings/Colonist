// v1.99.5 DAILY PUZZLE ("Dagpuzzel"): the pure part. No DOM, no game: it runs in the page, in the worker and in Node tests.
// Spec: docs/design/dagpuzzel.md. What is here:
//   - the day: Amsterdam date -> day id -> seed -> the day's rolls, steal draws and development card stacks (DAILY_RULES is part of the seed,
//     so a later rule change never rewrites a past day: bump it and the old days keep their own rules version in the record)
//   - the score rule and the ranking, the streak, the share code (KD1-XXXX-XXXX-XXXX, 60 bits with a checksum) and the share text
//   - the storage (localStorage, every access in try/catch)
import { DEV_DECK, deckList } from "./core/constants.js";

export const DAILY_RULES = 1;   // the rules version of a day: in the seed, in the saved run, in the record
export const TURN_LIMIT = 40;   // own turns; after the 40th round the day is "Tijd op"
export const WIN_POINTS = 10;
export const TZ = "Europe/Amsterdam";
const EPOCH = Date.UTC(2026, 0, 1);

/** The clock of the daily puzzle (Date.now: a test that mocks the clock moves it). */
export const nowMs = () => Date.now();

// ── hashing and the seeded stream ──
export function xmur3(str) { // string -> a function giving 32-bit hashes (each call a new one)
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
export const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffled = (list, rng) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ── the Amsterdam day ──
let FMT = null;
const fmt = () => FMT || (FMT = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }));
/** The wall clock in Amsterdam at `ts`: { y, m, d, h, mi, s }. */
export function amsterdam(ts = nowMs()) {
  const o = {}; for (const p of fmt().formatToParts(new Date(ts))) o[p.type] = +p.value;
  return { y: o.year, m: o.month, d: o.day, h: o.hour % 24, mi: o.minute, s: o.second };
}
/** Day id: days since 2026-01-01 + 1 (24 nov 2026 = 328). Only internal: the screens show the date. */
export const dayIdOf = (ts = nowMs()) => { const a = amsterdam(ts); return Math.round((Date.UTC(a.y, a.m - 1, a.d) - EPOCH) / 864e5) + 1; };
/** { y, m (1-12), d, wd (0 = Sunday) } of a day id. */
export function dateOfDay(id) { const t = new Date(EPOCH + (id - 1) * 864e5); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() }; }
export const dayIdOfDate = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 864e5) + 1;
/** ms until the next 00:00 in Amsterdam (right on the two days a year the clock jumps). */
export function msToNextDay(ts = nowMs()) {
  const a = amsterdam(ts), today = dayIdOf(ts);
  let t = ts + (86400 - (a.h * 3600 + a.mi * 60 + a.s)) * 1000;
  if (dayIdOf(t) === today) t += 3600e3; else if (dayIdOf(t - 1000) > today) t -= 3600e3;
  return Math.max(1000, t - ts);
}

// ── the day: seed, rolls, steal draws, card stacks ──
export const seedOf = (day, rules = DAILY_RULES) => xmur3(`katan-daily|r${rules}|d${day}`)();
const ALL36 = []; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) ALL36.push([a, b]);
const sevens = (rolls, n) => rolls.slice(0, n).filter((r) => r[0] + r[1] === 7).length;
const CACHE = new Map();
/** Everything that is the same for everyone on a day. rolls[k] = the k-th roll of the game, whoever rolls it and whatever was built before. */
export function dayDef(day, rules = DAILY_RULES) {
  const key = `${rules}:${day}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const seed = seedOf(day, rules);
  let rolls = [];
  for (let attempt = 0; attempt < 40; attempt++) { // a fair opening: at most one 7 in the first 6 rolls, two to four in the first 18
    const rng = mulberry32(xmur3(`katan-dice|${seed}|${attempt}`)());
    rolls = []; for (let k = 0; k < 12; k++) rolls.push(...shuffled(ALL36, rng)); // concatenated shuffled 36-card stacks
    if (sevens(rolls, 6) <= 1 && sevens(rolls, 18) >= 2 && sevens(rolls, 18) <= 4) break;
  }
  const rs = mulberry32(xmur3(`katan-steal|${seed}`)());
  const steal = Array.from({ length: 96 }, () => rs());
  const dev = [0, 1, 2].map((s) => shuffled(deckList(DEV_DECK), mulberry32(xmur3(`katan-dev|${seed}|${s}`)()))); // one stack per seat: your n-th purchase is the same card for everyone
  const def = Object.freeze({ day, rules, seed, rolls, steal, dev });
  CACHE.set(key, def);
  return def;
}

/** The settings of every day (the player's own New game settings are never used): classic, 10 points, a balanced island, Blaauw (Medium) and Geelen (Easy). */
export const DAY_SETTINGS = Object.freeze({ mode: "classic", winPoints: WIN_POINTS, discardLimit: 7, friendlyRobber: false, dice: "random", map: "balanced", board: "island", numBots: 2,
  botStyleMode: "each", allPreset: "intermediate", perBot: ["intermediate", "beginner", "builder", "trader", "shark"], humans: [false, false, false, false, false], names: ["", "", "", "", "", ""] });
/** The characters at the table: yours in seat 0, Blaauw (1) and Geelen (2) where you are not them (then Rosa takes the free seat). A permutation of 0..5. */
export function dayLook(mine = 0) {
  const c0 = Number.isInteger(mine) && mine >= 0 && mine < 6 ? mine : 0, seats = [c0];
  for (const want of [1, 2]) seats.push(want !== c0 ? want : 0);
  for (let c = 0; c < 6; c++) if (!seats.includes(c)) seats.push(c);
  return seats;
}

// ── result, score, ranking ──
/** A finished day from the end state: w 1 = won, t = own turns at the win (or the turn the bot won; 40 on "Tijd op"), p = [you, Blaauw, Geelen] points. */
export const kindOf = (r) => (r.w ? "won" : Math.max(...r.p) >= WIN_POINTS ? "lost" : r.t >= TURN_LIMIT ? "timeup" : "gaveup");
/** Higher is better. A win beats every loss; wins: fewer turns; losses: more points, then the later turn of the bot's win. */
export const rankOf = (r) => (r.w ? 1e6 - r.t : r.p[0] * 100 + Math.min(99, r.t));
/** > 0: a is better, 0: equal (same class and same number), < 0: b is better. */
export function compare(a, b) {
  if (!!a.w !== !!b.w) return a.w ? 1 : -1;
  if (a.w) return b.t - a.t;
  return a.p[0] - b.p[0] || 0;
}

// ── the streak ──
/** { cur, best, played, won }: consecutive Amsterdam days with a finished run (win or loss). Alive until 24:00 of the day after the last play day. */
export function streakOf(days, today) {
  const ids = Object.keys(days).map(Number).filter((n) => days[n] && !days[n].practice).sort((a, b) => a - b);
  let best = 0, run = 0, prev = -9;
  for (const d of ids) { run = d === prev + 1 ? run + 1 : 1; prev = d; best = Math.max(best, run); }
  const set = new Set(ids);
  let d = set.has(today) ? today : set.has(today - 1) ? today - 1 : null, cur = 0;
  while (d != null && set.has(d)) { cur++; d--; }
  return { cur, best, played: ids.length, won: ids.filter((i) => days[i].w).length };
}

// ── the code ──
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const SALT = "katan-dag-v1";
const checksum = (v33) => xmur3(`${SALT}|${v33}`)() & 0x7ffffff; // 27 bits
/** KD1-XXXX-XXXX-XXXX: version (2 bits) | day (12) | win (1) | turns (6) | points you, Blaauw, Geelen (4+4+4) | checksum (27). */
export function encode({ day, w, t, p }) {
  let v = 0n; // code version 1 (shown as KD1)
  const put = (x, bits) => { v = (v << BigInt(bits)) | BigInt(x & ((1 << bits) - 1)); };
  put(1, 2); put(day, 12); put(w ? 1 : 0, 1); put(Math.max(1, Math.min(63, t)), 6); put(Math.min(15, p[0]), 4); put(Math.min(15, p[1]), 4); put(Math.min(15, p[2]), 4);
  const body = v; v = (body << 27n) | BigInt(checksum(body.toString()));
  let s = ""; for (let i = 11; i >= 0; i--) s += B32[Number((v >> BigInt(i * 5)) & 31n)];
  return `KD1-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}
/** The record inside a code, or { error: "short" | "bad" }. Forgiving: lower case, spaces, O for 0, I and L for 1, any dashes. */
export function decode(code) {
  const s = String(code || "").toUpperCase().replace(/^KD1/, "").replace(/[\s\-_]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (s.length < 12) return { error: s.length ? "short" : "empty" };
  if (s.length > 12 || [...s].some((c) => !B32.includes(c))) return { error: "bad" };
  let v = 0n; for (const c of s) v = (v << 5n) | BigInt(B32.indexOf(c));
  const body = v >> 27n, sum = Number(v & 0x7ffffffn);
  if (sum !== checksum(body.toString())) return { error: "bad" };
  const get = (bits, at) => Number((body >> BigInt(at)) & ((1n << BigInt(bits)) - 1n));
  const p = [get(4, 8), get(4, 4), get(4, 0)];
  const rec = { ver: get(2, 33 - 2), day: get(12, 33 - 14), w: get(1, 33 - 15) === 1, t: get(6, 12), p };
  return rec.ver === 1 && rec.day > 0 ? rec : { error: "bad" };
}
export const dayLink = (code, base = "") => `${base || (typeof location !== "undefined" ? location.origin + location.pathname : "")}#dag=${code}`;

// ── text ──
const MONTHS_NL = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"], DAYS_NL = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "di 24 nov" / "Tue 24 Nov" */
export function dayLabel(day, nl) { const x = dateOfDay(day); return nl ? `${DAYS_NL[x.wd]} ${x.d} ${MONTHS_NL[x.m - 1]}` : `${DAYS_EN[x.wd]} ${x.d} ${MONTHS_EN[x.m - 1]}`; }
const MONTH_NAMES_NL = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const MONTH_NAMES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (m, nl) => (nl ? MONTH_NAMES_NL : MONTH_NAMES_EN)[m - 1];
/** The one-line result: "Gewonnen in 17 beurten" / "Verloren met 8 punten" / "Tijd op: 9 punten na 40 beurten". */
export function resultLine(r, nl) {
  const k = kindOf(r);
  if (k === "won") return nl ? `Gewonnen in ${r.t} beurten` : `Won in ${r.t} turns`;
  if (k === "timeup") return nl ? `Tijd op: ${r.p[0]} punten na ${r.t} beurten` : `Time's up: ${r.p[0]} points after ${r.t} turns`;
  return nl ? `Verloren met ${r.p[0]} punten` : `Lost with ${r.p[0]} points`;
}
/** The share text (seven lines; the 3rd needs the local record: r.pc = [villages, cities, longest road 0/1]). */
export function shareText(r, nl, link) {
  const k = kindOf(r);
  const head = k === "won" ? `🏆 ${resultLine(r, nl)}${r.bot ? ` (${nl ? "slimme bot" : "smart bot"}: ${r.bot})` : ""}` : k === "timeup" ? `⏳ ${resultLine(r, nl)}` : `🎲 ${resultLine(r, nl)}`;
  const pc = r.pc ? `${"🏠".repeat(r.pc[0])}${r.pc[1] ? ` ${"🏙".repeat(r.pc[1])}` : ""}${r.pc[2] ? " 🛣️" : ""}` : "";
  const n = r.n || ["Blaauw", "Geelen"];
  return [`Katan ${nl ? "Dagpuzzel" : "Daily puzzle"}, ${dayLabel(r.day, nl)}`, head, pc, `${nl ? "Jij" : "You"} ${r.p[0]} · ${n[0]} ${r.p[1]} · ${n[1]} ${r.p[2]} ${nl ? "punten" : "points"}`,
    `${nl ? "Code" : "Code"} ${r.code}`, `${nl ? "Sneller dan ik?" : "Faster than me?"} ${link}`].filter(Boolean).join("\n");
}

// ── storage ──
export const KEYS = { run: "colonist.daily.v1.run", days: "colonist.daily.v1.days", seen: "colonist.daily.v1.seen", bot: "colonist.daily.v1.bot", last: "colonist.daily.v1.last" };
const ls = () => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (_) { return null; } };
const rd = (k) => { try { return ls()?.getItem(k) ?? null; } catch (_) { return null; } };
const wr = (k, v) => { try { ls()?.setItem(k, v); return true; } catch (_) { return false; } };
const jr = (k, fb) => { try { const r = rd(k); return r ? JSON.parse(r) : fb; } catch (_) { return fb; } };
/** { "328": { w, t, p, code, bot, pc, n, h, ts, rules } } */
export const loadDays = () => { const d = jr(KEYS.days, {}); return d && typeof d === "object" ? d : {}; };
export function saveDay(day, rec) { const d = loadDays(); d[day] = rec; wr(KEYS.days, JSON.stringify(d)); wr(KEYS.last, String(day)); return d; }
export function patchDay(day, patch) { const d = loadDays(); if (!d[day]) return null; d[day] = { ...d[day], ...patch }; wr(KEYS.days, JSON.stringify(d)); return d[day]; }
/** The saved run in short: { day, turn, rules, practice } or null (the full game state is in the same key, written by the game). */
export function loadRunMeta() {
  const raw = rd(KEYS.run); if (!raw) return null;
  try { const s = JSON.parse(raw); if (!s?.daily || s.winnerId != null) return null; return { day: s.daily.day, rules: s.daily.rules, turn: Math.min(TURN_LIMIT, s.turn || 1), startedAt: s.daily.startedAt || 0 }; } catch (_) { return null; }
}
export const clearRun = () => { try { ls()?.removeItem(KEYS.run); } catch (_) { /* private mode */ } };
export const introSeen = () => rd(KEYS.seen) === "1";
export const markIntroSeen = () => wr(KEYS.seen, "1");
export const loadBot = (day) => { const b = jr(KEYS.bot, {}); return b?.[`${DAILY_RULES}:${day}`]; };
export function saveBot(day, v) { const b = jr(KEYS.bot, {}); const keys = Object.keys(b); if (keys.length > 60) delete b[keys[0]]; b[`${DAILY_RULES}:${day}`] = v; wr(KEYS.bot, JSON.stringify(b)); }
/** Today's state for the cards: "open" | "busy" (a run on disk) | "done" (record) | "late" (a run from an earlier day) | "practice" (clock set back). */
export function stateOf(today, days = loadDays(), run = loadRunMeta()) {
  const last = Number(rd(KEYS.last)) || 0;
  if (days[today]) return "done";
  if (run && run.day === today) return "busy";
  if (run && run.day < today) return "late";
  if (last > today) return "practice";
  return "open";
}
