// Katan game recap: turns the review's facts into a short story with Azure OpenAI.
// Auth to Azure OpenAI with the Function's managed identity (no key stored anywhere).
// Only this fixed task is served: the system prompt lives here, input and output are capped.
const { app } = require("@azure/functions");

const MAX_FACTS = 40000;       // characters of game facts accepted
const MAX_OUT = 1600;          // completion tokens (reasoning included)
const PER_IP_HOUR = 20;        // simple abuse guard per instance
const hits = new Map();
const EXPLAIN = `You explain one moment of a finished game of a Catan-like board game to the human player ("You"), like an analyst talking to a friend.
Use ONLY the facts given (JSON from the game's review engine for this moment: the position, the move played (B), the engine's better move (A) if any, win chances, point-plan sources ("aims"), usual next builds in the simulated futures, the simple choice). Never invent moves, numbers or reasons.
Answer the player's question about this moment. Compare A and B concretely: which resources and dice numbers each move gains or blocks, which point plan each serves, what usually happens next in the futures, and the win-chance difference.
Return JSON: answer = 2-4 short sentences, every sentence a concrete fact, no stock phrases; points = 2-4 short bullet facts (max 12 words each) that support the answer; highlight = "A", "B" or "none" (which move on the board the answer is mostly about).
Say "points" (Dutch "punten"), never "VP".
Questions unrelated to this game moment: answer only "I can only explain this game moment." with empty points.`;
const EXPLAIN_SCHEMA = { type: "object", additionalProperties: false, required: ["answer", "points", "highlight"],
  properties: { answer: { type: "string" }, points: { type: "array", items: { type: "string" } }, highlight: { type: "string", enum: ["A", "B", "none"] } } };
const NUM = { type: ["integer", "null"] };
const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["headline", "turningPoints", "luckOrPlay", "tip", "lessonTitle", "lessonKind"],
  properties: {
    headline: { type: "string" },
    turningPoints: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["turn", "player", "title", "text", "from", "to"],
      properties: { turn: { type: "integer" }, player: { type: "string" }, title: { type: "string" }, text: { type: "string" }, from: NUM, to: NUM } } },
    luckOrPlay: { type: "object", additionalProperties: false, required: ["verdict", "luck", "moves", "text"],
      properties: { verdict: { type: "string", enum: ["luck", "play", "both", "none"] }, luck: { type: ["number", "null"] }, moves: { type: ["number", "null"] }, text: { type: "string" } } },
    tip: { type: "string" },
    lessonTitle: { type: "string" },
    lessonKind: { type: "string", enum: ["played_well", "placement", "plan", "robber", "trading", "development_cards", "timing", "board_reading"] },
  },
};
// Plain-text rendering for older app versions (v1.62 expects `text`).
const toText = (r, nl) => [
  `## ${nl ? "Kantelmomenten" : "Turning points"}`,
  ...r.turningPoints.map((t) => `**${nl ? "Beurt" : "Turn"} ${t.turn}, ${t.title}:** ${t.text}${t.from != null && t.to != null ? ` (${t.from}% -> ${t.to}%)` : ""}`),
  ...(r.luckOrPlay?.verdict && r.luckOrPlay.verdict !== "none" ? ["", `**${nl ? "Geluk of spel" : "Luck or play"}:** ${r.luckOrPlay.text}`] : []), "", `**${nl ? "Les" : "Lesson"}: ${r.lessonTitle || ""}** ${r.tip}`,
].join("\n");

const SYSTEM = `You are a sharp, friendly game commentator. You analyse one finished game of a Catan-like board game for the human player ("You"), who wants to understand it and improve.
Use ONLY the facts given (JSON from the game's review engine). Never invent moves, numbers, spots or reasons.
Pick the requested number of turning points: the moments where win chances swung most, for ANY player and including luck (dice, steals, development card draws), not only your own moves. If the facts describe how the game ended (e.g. the winner's last action or card draw) and it swung win chances a lot, it must be the last turning point. When an opponent's turn turned the game, say exactly what they did. For each, weave short-term and long-term: what happened that turn, and what it did to whose point plan (settlements, cities, longest road, largest army, VP cards, islands).
Return JSON matching the schema. Field rules:
- headline: one sentence, the whole game in short (who won, with which plan, the deciding reason).
- turningPoints[]: in turn order. turn = turn number; player = name of the player it was about; title = 2-5 words; text = one or two short sentences; from/to = that player's win chance in % before/after (integers, from the facts; null if not in the facts).
- luckOrPlay: only when luck clearly mattered for the outcome. verdict decided by numbers: if facts give luckOrPlayVerdict use it; else "luck" when |luck| >= 3 x |moves|, "play" when |moves| >= 3 x |luck|, otherwise "both". If luck was small or irrelevant, set verdict "none", text "" and luck/moves null. luck and moves = your win-chance points from the facts; text = one sentence matching the verdict.
- tip + lessonTitle + lessonKind: a LESSON, not a quick tip: the general pattern behind this game that the player can reuse in future games, at their level. lessonTitle = 3-7 words (e.g. "Spread your numbers at set-up", "On an ore-rich board, plan cities early"); tip = 1-2 sentences: the reusable rule plus how it showed in this game. If the player played well and lost to luck, say so honestly (lessonKind "played_well", e.g. "You played well; this happens. Keep doing X."). Never advise against luck you cannot influence. lessonKind = the category that fits best.

Terminology: say "points" (Dutch "punten"), never "VP" or "victory points" abbreviations; a Victory Point card is "punt-kaart" in Dutch and "point card" in English.
Style: explain like an analyst talking to a friend, not like a sports recap. Every sentence must carry a concrete fact: who did what (card, build, roll, trade), the points or numbers involved, and the effect (e.g. "Blaauw bought a development card, drew a Victory Point card and went from 9 to 10 points: your win chance fell by 60 points."). No filler or stock phrases such as "pushed the plan forward", "kept you close", "locked in the lead", "put pressure on", "turned the tide", "the race was on". No moralising closing lines, and no sentence that only restates a previous one. Short sentences, everyday words, resources and dice numbers instead of codes. Honest and kind.`;

async function token() {
  const r = await fetch(`${process.env.IDENTITY_ENDPOINT}?resource=https://cognitiveservices.azure.com&api-version=2019-08-01`,
    { headers: { "X-IDENTITY-HEADER": process.env.IDENTITY_HEADER } });
  if (!r.ok) throw new Error("identity " + r.status);
  return (await r.json()).access_token;
}

app.http("recap", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (req, ctx) => {
    const ip = (req.headers.get("x-forwarded-for") || "?").split(",")[0].split(":")[0];
    const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
    if (list.length >= PER_IP_HOUR) return { status: 429, jsonBody: { error: "Too many recaps, try again later." } };
    list.push(now); hits.set(ip, list);

    let body; try { body = await req.json(); } catch { return { status: 400, jsonBody: { error: "bad json" } }; }
    const facts = typeof body?.facts === "string" ? body.facts : JSON.stringify(body?.facts ?? "");
    if (!facts || facts.length > MAX_FACTS) return { status: 413, jsonBody: { error: "facts missing or too large" } };
    const lang = body?.lang === "nl" ? "nl" : "en";
    const nTp = Math.max(1, Math.min(5, parseInt(body?.turningPoints, 10) || 3));
    const explain = body?.mode === "explain";
    const question = String(body?.question || "Why is the better move better than what I did?").slice(0, 300);

    try {
      const r = await fetch(`${process.env.OAI_ENDPOINT}/openai/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({
          model: process.env.OAI_DEPLOYMENT,
          max_completion_tokens: MAX_OUT,
          response_format: { type: "json_schema", json_schema: { name: explain ? "explain" : "recap", strict: true, schema: explain ? EXPLAIN_SCHEMA : SCHEMA } },
          messages: [
            { role: "system", content: (explain ? EXPLAIN : SYSTEM) + (lang === "nl" ? "\n\nWrite all text fields in natural Dutch (Nederlands)." : "\n\nWrite all text fields in English.") },
            { role: "user", content: explain ? `question: ${question}\nfacts:\n${facts}` : `turningPoints wanted: ${nTp}\nfacts:\n${facts}` },
          ],
        }),
      });
      const j = await r.json();
      if (!r.ok) { ctx.error("oai", r.status, JSON.stringify(j).slice(0, 500)); return { status: 502, jsonBody: { error: "model error " + r.status } }; }
      if (explain) { let ex; try { ex = JSON.parse(j.choices?.[0]?.message?.content || ""); } catch { return { status: 502, jsonBody: { error: "model returned no JSON" } }; } return { jsonBody: { explain: ex, usage: j.usage } }; }
      let recap; try { recap = JSON.parse(j.choices?.[0]?.message?.content || ""); } catch { return { status: 502, jsonBody: { error: "model returned no JSON" } }; }
      if (Array.isArray(recap.turningPoints)) recap.turningPoints = recap.turningPoints.slice(0, nTp);
      const lp = recap.luckOrPlay || {}, L = Math.abs(lp.luck ?? NaN), M = Math.abs(lp.moves ?? NaN);
      if (lp.verdict !== "none" && Number.isFinite(L) && Number.isFinite(M)) lp.verdict = L >= 3 * M ? "luck" : M >= 3 * L ? "play" : "both"; // decided by numbers, not by the model
      return { jsonBody: { recap, text: toText(recap, lang === "nl"), usage: j.usage } };
    } catch (e) {
      ctx.error(String(e)); return { status: 500, jsonBody: { error: "recap failed" } };
    }
  },
});
