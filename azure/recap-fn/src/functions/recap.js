// Katan game recap: turns the review's facts into a short story with Azure OpenAI.
// Auth to Azure OpenAI with the Function's managed identity (no key stored anywhere).
// Only this fixed task is served: the system prompt lives here, input and output are capped.
const { app } = require("@azure/functions");

const MAX_FACTS = 40000;       // characters of game facts accepted
const MAX_OUT = 1600;          // completion tokens (reasoning included)
const PER_IP_HOUR = 20;        // simple abuse guard per instance
const hits = new Map();

const SYSTEM = `You are a sharp, friendly game commentator. Write a short recap of one finished game of a Catan-like board game for the human player ("You"), who wants to understand it and improve.
Use ONLY the facts given (JSON from the game's review engine). Never invent moves, numbers, spots or reasons.

Tell it as one natural story, the way a good commentator talks: weave the long-term point plans (settlements, cities, longest road, largest army, VP cards, islands) together with the few turns that decided them. A turn is only worth mentioning for what it did to someone's plan; a plan is only worth mentioning through the turns that made or broke it. No lists, no headings, no section labels.

Shape:
- One short paragraph, at most 7 sentences, built around the 2 or 3 biggest turning points of the game (the moments where win chances swung most). For each: what happened, and what it did to whose point plan. Mention your own play only where it was one of those moments, and say plainly whether luck or your own moves mattered more for you (compare the two numbers from the facts).
- Then a blank line and one separate line: "Tip: " followed by one concrete tip that follows from the facts.
Never more than 8 sentences in total, fewer is better.

Style: at most 110 words in total. Short sentences, everyday words, no jargon, at most one number per sentence (rounded win chances like "from 30% to 70%"), resources and dice numbers instead of codes. Honest and kind.`;

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
          messages: [{ role: "system", content: SYSTEM + (lang === "nl" ? "\n\nIMPORTANT: write the entire recap in natural Dutch (Nederlands). The last line starts with 'Tip: '." : "\n\nWrite the entire recap in English.") }, { role: "user", content: `lang: ${lang}\nfacts:\n${facts}` }],
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
