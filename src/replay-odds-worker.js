// v1.28 The Replay's running win chance, off the page (src/replay-odds.js): one step at a time, each result posted.
//   → { type: "start", D }        ← { type: "step", s, p, ms } … { type: "done" }
//   → { type: "at", id, s, upto } ← { type: "at", id, p }     (a moment inside a step, for the review's play-by-play)
import { oddsRunner } from "./replay-odds.js?v=149";

let R = null;
self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.type === "start") {
      R = oddsRunner(m.D);
      const pump = () => {
        const t0 = performance.now();
        let r;
        while ((r = R.next())) { self.postMessage({ type: "step", s: r.s, p: r.p, ms: r.ms, su: r.su }); if (performance.now() - t0 > 30) break; }
        if (r) setTimeout(pump, 0); else self.postMessage({ type: "done" });
      };
      pump();
    } else if (m.type === "at") self.postMessage({ type: "at", id: m.id, p: R ? R.at(m.s, m.upto) : null });
  } catch (err) { self.postMessage({ type: "error", id: m.id, message: String(err?.stack || err) }); }
};
