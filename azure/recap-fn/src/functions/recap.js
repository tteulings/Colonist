// Katan game recap: turns the review's facts into a short story with Azure OpenAI.
// Auth to Azure OpenAI with the Function's managed identity (no key stored anywhere).
// Only this fixed task is served: the system prompt lives here, input and output are capped.
const { app } = require("@azure/functions");

const MAX_FACTS = 40000;       // characters of game facts accepted
const MAX_OUT = 2600;          // completion tokens (reasoning included)
const PER_IP_HOUR = 20;        // simple abuse guard per instance
const hits = new Map();
const EXPLAIN = `You explain one moment of a finished game of a Catan-like board game to the human player ("You"), like an analyst talking to a friend.
Use ONLY the facts given (JSON from the game's review engine for this moment: the position, the move played (B), the engine's better move (A) if any, win chances, point-plan sources ("aims"), usual next builds in the simulated futures, the simple choice). Never invent moves, numbers or reasons.
Answer the player's question about this moment. Compare A and B concretely: which resources and dice numbers each move gains or blocks, which point plan each serves, what usually happens next in the futures, and the win-chance difference.
Return JSON: answer = 2-4 short sentences, every sentence a concrete fact, no stock phrases; points = 2-4 short bullet facts (max 12 words each) that support the answer; highlight = "A", "B" or "none" (which move on the board the answer is mostly about).
Say "points" (Dutch "punten"), never "VP".
Questions unrelated to this game moment: answer only "I can only explain this game moment." with empty points.`;
const LESSON = `You are a friendly Catan-like board game coach. The player asks about one skill category across their own reviewed games (set-up placement, robber, building choice, development cards, trading or timing).
Use ONLY the facts given: the category, their stats (mistakes, win chance lost, trend), the built-in rule, and examples from their games with the move played (B), the better move (A), win chances and point-plan sources. Never invent games, moves or numbers.
Answer the question as a coach: name the pattern you see in their examples, the concrete habit to change, and how to recognise the situation next time. Refer to examples by turn and resources in plain words.
Return JSON: answer = 2-4 short sentences, every sentence concrete, no stock phrases; points = 2-4 short bullet facts or habits (max 12 words each); highlight = "none".
Say "points" (Dutch "punten"), never "VP"; win chance as %. Questions unrelated to the game: answer only "I can only help with your Catan play." with empty points.`;
const GAME = `You are an interactive game analyst for one finished game of a Catan-like board game, talking to the human player ("You").
Use ONLY the facts given (JSON from the game's review engine: players, final points and point sources, win-chance timeline per turn, key moments with actions, luck events, your decisions with A/B, lessons). Never invent moves, numbers or reasons.
DECISIONS: in the facts, "played" (or B) is the move that was ACTUALLY made in the game; "better" (or A) is the engine\'s better alternative that was NOT played. Never describe the better move as if it was played, never swap players, and only attribute a move to the player named in the facts.
Answer the player's question about this game AND choose the best visualisation for it, so the app can draw it:
- view: "winchance" (win-chance lines over turns), "luck" (luck per player), "points" (final point sources per player), "plan" (each player's point plan over the game: when settlements, cities, longest road, largest army, point cards came), "board" (the board at one turn, with the better move A and the played move B if it is a decision), "moves" (your decisions with cost), or "none".
Work on three levels, whichever the question needs: the game as a whole (what decided it), individual decisions (yours or an opponent's: what was played, what was better and why, with the A/B facts), and the bigger strategy of you and of each opponent (their point plan, how it developed, what worked against whom, and what you could do against it next time).
- turns: the turn numbers the answer is about (max 4, may be empty); focusTurn: the single most relevant turn or null; players: names of the players the answer is about (may be empty).
Return JSON: answer = 2-4 short sentences, every sentence a concrete fact; points = 0-4 short bullet facts (max 12 words); view, turns, focusTurn, players as above; followUps = 2-3 short follow-up questions the player may want to ask next.
Say "points" (Dutch "punten"), never "VP"; win chance as %. Off-topic questions: answer "I can only talk about this game." with view "none".`;
const GAME_SCHEMA = { type: "object", additionalProperties: false, required: ["answer", "points", "view", "turns", "focusTurn", "players", "followUps"],
  properties: { answer: { type: "string" }, points: { type: "array", items: { type: "string" } }, view: { type: "string", enum: ["winchance", "luck", "points", "plan", "board", "moves", "none"] },
    turns: { type: "array", items: { type: "integer" } }, focusTurn: { type: ["integer", "null"] }, players: { type: "array", items: { type: "string" } }, followUps: { type: "array", items: { type: "string" } } } };
const INSIGHTS = `You curate the AI tab for ONE finished game of a Catan-like board game for the human player ("You"). Every game is different: pick what is genuinely interesting in THIS game, not a fixed template.
Use ONLY the facts given (review engine data). Never invent moves, numbers or reasons.
DECISIONS: in the facts, "played" (or B) is the move that was ACTUALLY made in the game; "better" (or A) is the engine\'s better alternative that was NOT played. Never describe the better move as if it was played, never swap players, and only attribute a move to the player named in the facts.
Choose 4 to 7 insight cards, ordered as a story, mixing levels where the facts support it:
- level "game": what decided the game (luck, a plan, a single moment);
- level "decision": one specific decision of you or an opponent that mattered (what was played, what was better, why);
- level "strategy": the point plan of you or an opponent and how it worked out, or a pattern (e.g. "Blaauw went for cities and the army; nobody blocked his ore").
Skip levels with nothing interesting, EXCEPT these two cards which are ALWAYS required:
(1) CLOSE GAME: if facts.nearMiss.margin is 2 or less (you lost by 1-2 points, or won by 1-2), ALWAYS include one level "game" card about how close it was, view "nearmiss", players ["You"], turns = [nearMiss.bestWinChance.turn]. Use nearMiss only: points vs the winner, the best win chance turn, and when you lost: what the cheapest next point needed (nearMiss.needed, nearMiss.finalHand missing resources) and "about N turns away" from nearMiss.turnsAway (call it an estimate, e.g. "You were one point away: a settlement needed 1 wood and 1 wheat, about 4 turns off."). If turnsAway is null say the production was missing. If you won, say how close the others came. Never invent a need that nearMiss does not give.
(2) ALL STRATEGIES: ALWAYS include exactly one level "strategy" card with view "plan" and players = ALL players (every name in facts.plans, "You" included) that covers every player\'s win strategy. Use facts.plans[name].plan and its timeline. Its text is ONE short sentence of max 16 words on the overall pattern; additionally fill "clauses" with one entry per player {player: exact name, text: max 14 words that NAMES THE GOAL and THE GAP from facts.plans[name].routeToTarget (goal, pointsShort, stillMissing, verdict), e.g. "Aimed at cities + army; one city short." or "Spread roads with an ore start: headless chicken."}. Playful ("headless chicken", Dutch "kip zonder kop") ONLY when planCoherencePct is under 50, never insulting. If routeToTarget.verdict starts with "stalled" or "wrong" the clause MUST start with what the player aimed at, say the plan stalled/did not work and give the SPECIFIC reason from the verdict (never just "points short"; use the verdict text: the resource with low income, the locked longest road, the start mismatch), e.g. "Army plan stalled: only 1 knight drawn after turn 9." or "Longest road plan blocked: Blaauw held it."; if the verdict is "worked" say the plan worked (winner: how the goal was reached, matched or not). Winner: say how the 10 was reached, e.g. "Reached 10 via cities and army, as planned." Use only these numbers. Other cards: clauses = []. For each card pick the visual that explains it best: view = "winchance" | "luck" | "points" | "plan" | "board" | "moves" | "nearmiss" | "none"; turns (max 4), focusTurn (or null), players (names it is about).
WRITE FOR A PHONE SCREEN. Hard limits: headline max 14 words; card title max 6 words; card text exactly ONE complete sentence of max 16 words (the all-players strategy card also has its per-player clauses) (never rely on truncation, no trailing clauses), a concrete fact with a number or name; never repeat the same point in two cards (merge similar strategy cards into one); each followUp max 24 characters (e.g. "Why did I lose?").
Return JSON: headline, cards[] {level, title, text, view, turns, focusTurn, players, clauses}, followUps (3 short questions this game invites, specific to it).
CHECK BEFORE ANSWERING: (a) if facts.nearMiss.margin <= 2, one card has view "nearmiss" (not "none", not "points"); (b) exactly one strategy card has view "plan", players = every name in facts.plans, and its "clauses" has ONE entry per player (so 4 players = 4 clauses, empty clauses are a mistake). Example strategy card: {"level":"strategy","title":"Everyone's plan","text":"Blaauw's cities and army beat your roads.","view":"plan","turns":[],"focusTurn":null,"players":["You","Blaauw","Van Geelen"],"clauses":[{"player":"You","text":"Settlements and roads as planned; one city short."},{"player":"Blaauw","text":"Reached 10 via cities and army, as planned."},{"player":"Van Geelen","text":"Spread roads with an ore start: headless chicken."}]}.
Say "points" (Dutch "punten"), never "VP"; win chance as %.`;
const INSIGHTS_SCHEMA = { type: "object", additionalProperties: false, required: ["headline", "cards", "followUps"], properties: {
  headline: { type: "string" },
  cards: { type: "array", items: { type: "object", additionalProperties: false, required: ["level", "title", "text", "view", "turns", "focusTurn", "players", "clauses"], properties: {
    level: { type: "string", enum: ["game", "decision", "strategy"] }, title: { type: "string" }, text: { type: "string" },
    view: { type: "string", enum: ["winchance", "luck", "points", "plan", "board", "moves", "nearmiss", "none"] }, turns: { type: "array", items: { type: "integer" } }, focusTurn: { type: ["integer", "null"] }, players: { type: "array", items: { type: "string" } },
    clauses: { type: "array", items: { type: "object", additionalProperties: false, required: ["player", "text"], properties: { player: { type: "string" }, text: { type: "string" } } } } } } },
  followUps: { type: "array", items: { type: "string" } } } };
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

Terminology: win-chance numbers are always written as percentages of win chance ("-40% win chance", Dutch "-40% winkans"), never as "points"; "points" (Dutch "punten") only means game points. Write fully in the requested language (Dutch: "geluk", "zetten", "ontwikkelingskaart", no English words). Say "points" (Dutch "punten"), never "VP" or "victory points" abbreviations; a Victory Point card is "punt-kaart" in Dutch and "point card" in English.
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
    const lesson = body?.mode === "lesson";
    const game = body?.mode === "game";
    const insights = body?.mode === "insights";
    const explain = body?.mode === "explain" || lesson || game || insights;
    const question = String(body?.question || "Why is the better move better than what I did?").slice(0, 300);

    try {
      const r = await fetch(`${process.env.OAI_ENDPOINT}/openai/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({
          model: process.env.OAI_DEPLOYMENT,
          max_completion_tokens: MAX_OUT,
          response_format: { type: "json_schema", json_schema: { name: insights ? "insights" : game ? "game" : explain ? "explain" : "recap", strict: true, schema: insights ? INSIGHTS_SCHEMA : game ? GAME_SCHEMA : explain ? EXPLAIN_SCHEMA : SCHEMA } },
          messages: [
            { role: "system", content: (insights ? INSIGHTS : game ? GAME : lesson ? LESSON : explain ? EXPLAIN : SYSTEM) + (lang === "nl" ? "\n\nWrite all text fields in natural Dutch (Nederlands)." : "\n\nWrite all text fields in English.") },
            { role: "user", content: insights ? `facts:\n${facts}` : explain ? `question: ${question}\nfacts:\n${facts}` : `turningPoints wanted: ${nTp}\nfacts:\n${facts}` },
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
