// v1.94 Lessons: the background analysis of old saved games, one game at a time (src/lessons.js). Gets the stored (gzip) blob of a game and its list entry, unpacks it here,
// builds the game's lessonRow (src/lessons-row.js) and sends back only that row (about 1 KB): the page's thread never unpacks or analyses a game.
import { rowOf, rowKey, ROW_V } from "./lessons-row.js";
async function unpack(b) {
  if (b.enc === "gz") return JSON.parse(await new Response(new Blob([b.data]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
  return JSON.parse(b.data);
}
self.onmessage = async (ev) => {
  const { id, meta, blob } = ev.data || {};
  try { const payload = await unpack(blob); const row = rowOf(payload, meta); self.postMessage({ id, row: row || { v: ROW_V, k: rowKey(meta), none: 1 } }); } catch (e) { self.postMessage({ id, err: String(e && e.message || e) }); }
};
