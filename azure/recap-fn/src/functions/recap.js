// Katan game recap: turns the review's facts into a short story with Azure OpenAI.
// Auth to Azure OpenAI with the Function's managed identity (no key stored anywhere).
// Only this fixed task is served: the system prompt lives here, input and output are capped.
const { app } = require("@azure/functions");

const MAX_FACTS = 40000;       // characters of game facts accepted
const MAX_OUT = 1600;          // completion tokens (reasoning included)
const PER_IP_HOUR = 20;        // simple abuse guard per instance
const hits = new Map();
const NUM = { type: ["integer", "null"] };
const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["headline", "turningPoints", "luckOrPlay", "tip"],
  properties: {
    headline: { type: "string" },
    turningPoints: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["turn", "player", "title", "text", "from", "to"],
      properties: { turn: { type: "integer" }, player: { type: "string" }, title: { type: "string" }, text: { type: "string" }, from: NUM, to: NUM } } },
    luckOrPlay: { type: "object", additionalProperties: false, required: ["verdict", "luck", "moves", "text"],
      properties: { verdict: { type: "string", enum: ["luck", "play", "both"] }, luck: { type: ["number", "null"] }, moves: { type: ["number", "null"] }, text: { type: "string" } } },
    tip: { type: "string" },
  },
};
// Plain-text rendering for older app versions (v1.62 expects `text`).
const toText = (r, nl) => [
  `## ${nl ? "Kantelmomenten" : "Turning points"}`,
  ...r.turningPoints.map((t) => `**${nl ? "Beurt" : "Turn"} ${t.turn}, ${t.title}:** ${t.text}${t.from != null && t.to != null ? ` (${t.from}% -> ${t.to}%)` : ""}`),
  "", `**${nl ? "Geluk of spel" : "Luck or play"}:** ${r.luckOrPlay.text}`, "", `**Tip:** ${r.tip}`,
].join("\n");

const SYSTEM = `You are a sharp, friendly game commentator. You analyse one finished game of a Catan-like board game for the human player ("You"), who wants to understand it and improve.
Use ONLY the facts given (JSON from the game's review engine). Never invent moves, numbers, spots or reasons.
Pick the requested number of turning points: the moments where win chances swung most. For each, weave short-term and long-term: what happened that turn, and what it did to whose point plan (settlements, cities, longest road, largest army, VP cards, islands).
Return JSON matching the schema. Field rules:
- headline: one sentence, the whole game in short (who won, with which plan, the deciding reason).
- turningPoints[]: in turn order. turn = turn number; player = name of the player it was about; title = 2-5 words; text = one or two short sentences; from/to = that player's win chance in % before/after (integers, from the facts; null if not in the facts).
- luckOrPlay: verdict for you, decided by numbers: if facts give a computed verdict (luckOrPlayVerdict), use it; else "luck" when |luck| >= 3 x |moves|, "play" when |moves| >= 3 x |luck|, otherwise "both"; luck and moves = your win-chance points from the facts (numbers, null if missing); text = one sentence that matches the verdict and says plainly which mattered more.
- tip: one concrete tip that follows from the facts.
Style: short sentences, everyday words, no jargon, resources and dice numbers instead of codes. Honest and kind.`;

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

    try {
      const r = await fetch(`${process.env.OAI_ENDPOINT}/openai/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({
          model: process.env.OAI_DEPLOYMENT,
          max_completion_tokens: MAX_OUT,
          response_format: { type: "json_schema", json_schema: { name: "recap", strict: true, schema: SCHEMA } },
          messages: [
            { role: "system", content: SYSTEM + (lang === "nl" ? "\n\nWrite all text fields in natural Dutch (Nederlands)." : "\n\nWrite all text fields in English.") },
            { role: "user", content: `turningPoints wanted: ${nTp}\nfacts:\n${facts}` },
          ],
        }),
      });
      const j = await r.json();
      if (!r.ok) { ctx.error("oai", r.status, JSON.stringify(j).slice(0, 500)); return { status: 502, jsonBody: { error: "model error " + r.status } }; }
      let recap; try { recap = JSON.parse(j.choices?.[0]?.message?.content || ""); } catch { return { status: 502, jsonBody: { error: "model returned no JSON" } }; }
      if (Array.isArray(recap.turningPoints)) recap.turningPoints = recap.turningPoints.slice(0, nTp);
      return { jsonBody: { recap, text: toText(recap, lang === "nl"), usage: j.usage } };
    } catch (e) {
      ctx.error(String(e)); return { status: 500, jsonBody: { error: "recap failed" } };
    }
  },
});
