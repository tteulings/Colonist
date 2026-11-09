// v1.29 Compact storage of the review recording. Every record holds the whole position before a decision (`st`, ~3.7 KB
// of JSON); two records in a row differ in a few fields, so on disk a record keeps only what changed since the record
// before it (`d`, a JSON patch), with the whole position again every KEY records (a bad patch cannot spoil more than that).
// In memory the records stay whole: the review sends `st` to the worker as before. Packing is memoised per record, so a
// save during the game only diffs the records that are new. No imports, no DOM.
export const KEY = 32;

const isObj = (v) => v !== null && typeof v === "object";
function same(a, b) {
  if (a === b) return true;
  if (!isObj(a) || !isObj(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i += 1) if (!same(a[i], b[i])) return false; return true; }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !same(a[k], b[k])) return false;
  return true;
}
/** The patch that turns a into b (undefined: nothing changed). A primitive replaces; {$v} replaces with an object;
 *  {$x:1} deletes a key; {$i:{index: patch}} patches an array of the same length; any other object patches its keys. */
export function diff(a, b) {
  if (same(a, b)) return undefined;
  if (!isObj(b)) return b;
  if (!isObj(a) || Array.isArray(a) !== Array.isArray(b)) return { $v: b };
  if (Array.isArray(b)) {
    if (a.length !== b.length) return { $v: b };
    const out = {}; let n = 0;
    for (let i = 0; i < b.length; i += 1) { const d = diff(a[i], b[i]); if (d !== undefined) { out[i] = d; n += 1; } }
    return n * 2 > b.length && JSON.stringify(out).length > JSON.stringify(b).length ? { $v: b } : { $i: out };
  }
  const out = {};
  for (const k of Object.keys(b)) { const d = diff(a[k], b[k]); if (d !== undefined) out[k] = d; }
  for (const k of Object.keys(a)) if (!Object.prototype.hasOwnProperty.call(b, k)) out[k] = { $x: 1 };
  return out;
}
const clone = (v) => (isObj(v) ? JSON.parse(JSON.stringify(v)) : v);
/** a with the patch applied (a new value; a is not changed). */
export function patch(a, d) {
  if (!isObj(d)) return d;
  if (d.$v !== undefined) return clone(d.$v);
  if (d.$i) { const out = Array.isArray(a) ? a.slice() : []; for (const [i, x] of Object.entries(d.$i)) out[+i] = patch(out[+i], x); return out; }
  const out = isObj(a) && !Array.isArray(a) ? { ...a } : {};
  for (const [k, x] of Object.entries(d)) { if (isObj(x) && x.$x) delete out[k]; else out[k] = patch(out[k], x); }
  return out;
}

const hid = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: false, configurable: true, writable: true });
const objOf = (r) => r._o || hid(r, "_o", JSON.parse(r.st))._o;

/** Records as they are stored: `st` on every KEY-th record (and the first), `d` (the patch from the record before) on the rest. */
export function packRecs(recs) {
  if (!Array.isArray(recs)) return recs;
  return recs.map((r, i) => {
    if (!r || typeof r.st !== "string") return r; // already packed (or nothing to pack)
    if (i % KEY === 0) { const { st, ...rest } = r; return { ...rest, st }; }
    const prev = recs[i - 1];
    if (r._pk && r._pk.prev === prev && r._pk.pst === prev.st) return r._pk.out;
    const { st, trk, ...rest } = r;
    let out;
    try {
      out = { ...rest, d: diff(objOf(prev), objOf(r)) ?? {} };
      if (Array.isArray(trk) && Array.isArray(prev.trk)) out.dk = diff(prev.trk, trk) ?? { $i: {} }; else out.trk = trk; // the card tracker: a patch too
    } catch (_) { out = { ...rest, st, trk }; }
    hid(r, "_pk", { prev, pst: prev.st, out });
    return out;
  });
}
/** Whole records again (each `st` a JSON string, as the recorder made it). Records that are already whole pass through. */
export function unpackRecs(recs) {
  if (!Array.isArray(recs) || !recs.some((r) => r && r.d !== undefined && r.st === undefined)) return recs;
  let prev = null, ptrk = null;
  const out = [];
  for (const r of recs) {
    if (!r) { out.push(r); continue; }
    let o;
    if (typeof r.st === "string") o = JSON.parse(r.st);
    else if (r.d !== undefined && prev) o = patch(prev, r.d);
    else { out.push(r); prev = null; continue; } // a patch without its base: kept as it is (the review skips it)
    const { d, dk, ...rest } = r;
    const trk = dk !== undefined ? patch(ptrk, dk) : r.trk;
    const w = { ...rest, st: typeof r.st === "string" ? r.st : JSON.stringify(o), trk: trk ?? null };
    hid(w, "_o", o);
    out.push(w);
    prev = o; ptrk = w.trk;
  }
  return out;
}
