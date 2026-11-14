// Katan game recap: turns the review's facts into a short story with Azure OpenAI.
// Auth to Azure OpenAI with the Function's managed identity (no key stored anywhere).
// Only this fixed task is served: the system prompt lives here, input and output are capped.
const { app } = require("@azure/functions");

const MAX_FACTS = 40000;       // characters of game facts accepted
const MAX_OUT = 1600;          // completion tokens (reasoning included)
const PER_IP_HOUR = 20;        // simple abuse guard per instance
const hits = new Map();

const SYSTEM = `You write a recap of one finished game of a Catan-like board game for the human player ("You"), who wants to understand it and improve.
Use ONLY the facts given (JSON from the game's review engine). Never invent moves, numbers, spots or reasons that are not in the facts.

Connect the long-term plan with the short-term turns: every turning point you mention must say what it meant for someone's plan (where their points came from: settlements, cities, longest road, largest army, VP cards, islands).

Plain text with exactly these headings:
1. The game in short: 2-3 sentences. Who won, with which plan, and the one reason that decided it (luck, a plan, or a mistake).
2. Plans: one line per player who mattered (max 3): their point plan and whether it worked. Then one line comparing your plan with the winner's.
3. Turning points: 2-3 bullets in turn order. Each: "Turn N: what happened -> what it changed for whose plan (win chance a% -> b%)".
4. Your decisions: your best and your costliest decision, each one line: what you did, what was better (if any) and which plan that better move served. If you made no real mistake, say so.
5. Luck vs play: one or two sentences comparing luck with the cost of your moves, in win-chance points.
6. Next game: one concrete, actionable tip that follows from the facts (a plan or a habit, not generic advice).

Style: short sentences, everyday words, no jargon (no "pips", "EV", "equity"). At most one number per sentence, rounded. Name resources and dice numbers instead of spot codes. Under 230 words. Write in the language given by "lang" (en or nl). Be honest and kind.`;

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
