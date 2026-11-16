// Tags per game, derived from the facts (never from the page): they say what a good page MUST cover.
//   won | lost | near-miss | close-finish | luck-decided | luck-minor | no-luck-data | stalled | pivot | steady | wobbly | headless
//   costly-decision | big-swing | wait-on-resource | no-wc
function tagsOf(fx) {
  const t = [], Y = fx.keys[fx.me], S = fx.strat[fx.me], nm = fx.near;
  t.push(fx.won ? "won" : "lost");
  if (nm && !fx.won && nm.youPoints >= nm.pointsToWin - 3 && nm.margin > 0) t.push("near-miss");
  if (nm && nm.margin != null && nm.margin <= 2) t.push("close-finish");
  if (!fx.luck) t.push("no-luck-data");
  else if (Math.abs(fx.luck.tot[fx.me]) >= 8 || fx.luck.dominant) t.push("luck-decided"); else if (Math.max(...fx.luck.tot.map(Math.abs)) < 5) t.push("luck-minor");
  if (S) {
    if (S.share >= 0.3 || S.idleN >= 5) t.push("stalled");
    if (S.pivot) t.push("pivot"); if (S.steady) t.push("steady"); if (S.wobbly) t.push("wobbly"); if (S.headless) t.push("headless");
    if (S.waitRes && S.waitN >= 3) t.push("wait-on-resource");
  }
  const d = fx.decs.find((x) => x.gap >= 3 && x.vc !== "close"); if (d && d.gap >= 5) t.push("costly-decision");
  if (!fx.hasWc) t.push("no-wc"); else { const sw = fx.swings(fx.me, 1)[0]; if (sw && Math.abs(sw.d) >= 10) t.push("big-swing"); }
  return t;
}
module.exports = { tagsOf };
