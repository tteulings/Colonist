// Katan game recap: turns the review's facts into a short story with Azure OpenAI.
// Auth to Azure OpenAI with the Function's managed identity (no key stored anywhere).
// Only this fixed task is served: the system prompt lives here, input and output are capped.
const { app } = require("@azure/functions");

const MAX_FACTS = 40000;       // characters of game facts accepted
const MAX_OUT = 1600;          // completion tokens (reasoning included)
const PER_IP_HOUR = 20;        // simple abuse guard per instance
const hits = new Map();

const SYSTEM = `You write a short recap of one finished game of a Catan-like board game for the human player ("You"), who wants to understand it and improve.
Use ONLY the facts given (JSON from the game's review engine). Never invent moves, numbers, spots or reasons.
Link short-term turns to long-term point plans (settlements, cities, longest road, largest army, VP cards, islands).

Output format, exactly, nothing else (a heading line starts with "## ", a bullet with "- "):
## In short
One sentence: who won, with which plan, and the one reason that decided it.
## Plans
- Winner: their plan in a few words, and why it worked.
- You: your plan in a few words, and how it compared.
## Turning points
- Turn N: what happened -> what it did to whose plan (a% -> b%).
(2 or 3 bullets, in turn order)
## Your moves
- Best: ...
- Costliest: ... (or "No real mistakes.")
## Luck vs play
One sentence with both numbers in win-chance points.
## Next game
One concrete tip that follows from the facts.

Rules: every bullet and sentence at most 20 words. Whole recap at most 150 words. Everyday words, no jargon, at most one number per sentence, resources and dice numbers instead of codes. Be honest and kind.`;

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
          messages: [{ role: "system", content: SYSTEM + (lang === "nl" ? "\n\nIMPORTANT: write the entire recap in Dutch (Nederlands). Use exactly these headings: "## In het kort", "## Plannen", "## Keerpunten", "## Jouw zetten", "## Geluk tegenover spel", "## Volgend potje"." : "\n\nWrite the entire recap in English.") }, { role: "user", content: `lang: ${lang}\nfacts:\n${facts}` }],
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
