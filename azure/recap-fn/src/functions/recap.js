// Katan game recap: turns the review's facts into a short story with Azure OpenAI.
// Auth to Azure OpenAI with the Function's managed identity (no key stored anywhere).
// Only this fixed task is served: the system prompt lives here, input and output are capped.
const { app } = require("@azure/functions");

const MAX_FACTS = 40000;       // characters of game facts accepted
const MAX_OUT = 1600;          // completion tokens (reasoning included)
const PER_IP_HOUR = 20;        // simple abuse guard per instance
const hits = new Map();

const SYSTEM = `You write a short, insightful recap of one finished game of a Catan-like board game, for the human player ("You").
Use ONLY the facts given (JSON from the game's review engine). Never invent moves, numbers or reasons that are not in the facts.
Structure, plain text with these headings:
1. The story (3-4 sentences: how the game went, who won and why).
2. Turning points (2-3 bullets, each with turn number and the win-chance change).
3. Your best decision and your costliest decision (one bullet each, with the strategy behind it if given).
4. Luck (one or two sentences: how much luck mattered vs play, with numbers from the facts).
5. One tip for next game (concrete, based on the facts).
Keep it under 220 words. Write in the language given by "lang" (en or nl). Be honest: if the player played well and lost to luck, say so; if they made a big mistake, say so kindly.`;

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

    try {
      const r = await fetch(`${process.env.OAI_ENDPOINT}/openai/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({
          model: process.env.OAI_DEPLOYMENT,
          max_completion_tokens: MAX_OUT,
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `lang: ${lang}\nfacts:\n${facts}` }],
        }),
      });
      const j = await r.json();
      if (!r.ok) { ctx.error("oai", r.status, JSON.stringify(j).slice(0, 500)); return { status: 502, jsonBody: { error: "model error " + r.status } }; }
      const text = j.choices?.[0]?.message?.content?.trim() || "";
      return { jsonBody: { text, usage: j.usage } };
    } catch (e) {
      ctx.error(String(e)); return { status: 500, jsonBody: { error: "recap failed" } };
    }
  },
});
