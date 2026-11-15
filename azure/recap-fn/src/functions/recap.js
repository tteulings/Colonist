// Katan game recap: turns the review's facts into a short story with Azure OpenAI.
// Auth to Azure OpenAI with the Function's managed identity (no key stored anywhere).
// Only this fixed task is served: the system prompt lives here, input and output are capped.
const { app } = require("@azure/functions");

const MAX_FACTS = 40000;       // characters of game facts accepted
const MAX_OUT = 2600;          // completion tokens (reasoning included)
const PER_IP_HOUR = 20, PER_IP_STEPS = 150;        // simple abuse guard per instance
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
(2) ALL STRATEGIES: ALWAYS include exactly one level "strategy" card with view "plan" and players = ALL players (every name in facts.plans, "You" included) that covers every player\'s win strategy. Use facts.plans[name].plan and its timeline. Its text is ONE short sentence of max 16 words on the overall pattern; additionally fill "clauses" with one entry per player {player: exact name, text: max 14 words that NAMES THE GOAL and THE GAP from facts.plans[name].routeToTarget (goal, pointsShort, stillMissing, verdict), e.g. "Aimed at cities + army; one city short." or "Spread roads with an ore start: headless chicken."}. Playful ("headless chicken", Dutch "kip zonder kop") ONLY when planCoherencePct is under 50, never insulting. If routeToTarget.verdict starts with "stalled" or "wrong" the clause MUST start with what the player aimed at, say the plan stalled/did not work and give the SPECIFIC reason from the verdict (never just "points short"; use the verdict text: the resource with low income, the locked longest road, the start mismatch), e.g. "Army plan stalled: only 1 knight drawn after turn 9." or "Longest road plan blocked: Blaauw held it."; if the verdict is "worked" say the plan worked (winner: how the goal was reached, matched or not). Winner: say how the 10 was reached, e.g. "Reached 10 via cities and army, as planned." Use only these numbers. LUCK: facts.plans[name].routeToTarget.pointsBySourceInOrder marks every point source "[drawn: luck]" (point cards) or "[built]". If the verdict says "with luck" (the decisive last point was a drawn point card) the clause MUST say so (e.g. "Cities + army, but the 10th point was a lucky draw."); never call that route plain "as planned". If a verdict says "stalled by dice" say the dice (too few cards received) stalled it, not the plan; "(plan, not dice)" means the plan itself stalled. INCOME: routeToTarget has incomePerTurn (cards per turn by resource), bottleneck (the resource the goal needs most vs what they got), harbours and tradedBy (bank/player trades, monopoly); when a plan stalled, name the bottleneck resource with its per-turn number and the missing harbour or trade if the facts show it (e.g. "City plan on 0.3 ore per turn: no ore harbour, so it stalled."). Other cards: clauses = []. For each card pick the visual that explains it best: view = "winchance" | "luck" | "points" | "plan" | "board" | "moves" | "nearmiss" | "none"; turns (max 4), focusTurn (or null), players (names it is about).
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


// ── v1.77 tool loop: the app sends a compact INDEX; the model asks for details with tools; the app runs them (tier 1: lookups in the stored
// review, instant; tier 2: the review engine, seconds) and posts the results back with the history. The Function keeps no state.
const MAX_ROUNDS = 6, MAX_CALLS = 12, SIM_CAP = { insights: 2, game: 3 }, SIM = new Set(["simulate_moves", "can_still_win"]);
const fnT = (name, description, properties) => ({ type: "function", function: { name, description, strict: true, parameters: { type: "object", additionalProperties: false, required: Object.keys(properties), properties } } });
const INT = { type: "integer" }, STR = { type: "string" }, NINT = { type: ["integer", "null"] }, NSTR = { type: ["string", "null"] };
const TOOLS = [
  fnT("get_decision", "Tier 1, instant. All moves the review engine evaluated at one decision of a player on a turn: win chance of each (played move first), the cost, the aims (where the points would come from) and the simple choice. n = which decision of that turn (0-based; null = the costliest).", { turn: INT, player: STR, n: NINT }),
  fnT("get_turn", "Tier 1, instant. What happened on one turn: every player's actions, dice, cards, luck events and the win chance before/after, plus the reviewed decisions of that turn.", { turn: INT }),
  fnT("get_luck", "Tier 1, instant. Luck in win chance of a player (dice, steals, card draws, seat order) and resource cards got vs expected.", { player: STR }),
  fnT("get_plan", "Tier 1, instant. A player's point plan: route to the target, points by source, verdict (worked / stalled / wrong), what was missing.", { player: STR }),
  fnT("get_lessons", "Tier 1, instant. The reviewed player's decisions of one category in this game with their cost.", { category: { type: "string", enum: ["setup", "robber", "build", "dev_cards", "trading", "timing"] } }),
  fnT("list_swings", "Tier 1, instant. The n biggest win-chance swings of the game (any player).", { n: INT }),
  fnT("simulate_moves", "Tier 2, the review engine, takes seconds (100 futures per move). Win chance if each of up to 4 moves is played at that decision. Use only for a move that get_decision does not list, or to verify a what-if before you state it. build: type road|settlement|city|ship and optional at (spot id from get_decision, null = the engine's best spot of that type). bank: give, get = resource names (wood, brick, sheep, wheat, ore). robber: hex. buy: development card. play: card (knight, roadBuilding, yearOfPlenty, monopoly). end: end the turn.",
    { turn: INT, player: STR, n: NINT, moves: { type: "array", items: { type: "object", additionalProperties: false, required: ["kind", "type", "at", "give", "get", "hex", "card"], properties: { kind: { type: "string", enum: ["build", "bank", "robber", "buy", "play", "end"] }, type: { type: ["string", "null"], enum: ["road", "settlement", "city", "ship", null] }, at: NINT, give: NSTR, get: NSTR, hex: NINT, card: NSTR } } } }),
  fnT("can_still_win", "Tier 2, the review engine, takes seconds. The best-line win chance of the player at the first decision on or after that turn, searched afresh.", { turn: INT, player: STR }),
];
const TOOLS_COMMON = `\n\nYOU HAVE TOOLS. The message holds only an INDEX of the game (players, result, nearMiss, plans, top swings, the list of reviewed decisions); the details are fetched with tools that the app runs on the stored review. Tier 1 (get_decision, get_turn, get_luck, get_plan, get_lessons, list_swings) is instant: ask for several in ONE round, and never more than needed. Tier 2 (simulate_moves, can_still_win) runs the engine and takes seconds.
Numbers: quote only numbers that are in the index or in a tool result (whole %, as given). Players are named exactly as in the index ("You" is the reviewed player).
COUNTERFACTUALS ("what if", "would have", "had you ..."): state one only if a tool result shows it: the evaluated candidates of get_decision are engine results; for a move that is not listed, call simulate_moves first. Small differences (under about 8 points) are noise with 100 futures: say so rather than calling one move better.
"evidence" = the ids of the tool calls whose results this card/answer states (empty if it rests on the index alone).`;
const TOOLS_INSIGHTS = `${TOOLS_COMMON}
For the cards: fetch first the 3-5 decisions / turns that look most interesting from the index (costliest decisions, top swings), then write. The index's nearMiss and plans are complete for the CLOSE GAME and ALL STRATEGIES cards (use them as "facts.nearMiss" and "facts.plans"). At most 2 engine simulations in total; use them to VERIFY a counterfactual claim before a card states it; no sim, no counterfactual.`;
const TOOLS_GAME = `${TOOLS_COMMON}
Answer from tier 1 whenever you can (a move that was a candidate is already evaluated). If the question names a turn, call get_decision / get_turn for it first. Use simulate_moves only for a move that is not listed, at most 3 engine calls per question. If a tool says a move is not possible or the engine could not run, say that plainly instead of guessing.`;
const withEv = (schema, path) => { const s = JSON.parse(JSON.stringify(schema)), o = path ? s.properties.cards.items : s; o.required = [...o.required, "evidence"]; o.properties.evidence = { type: "array", items: { type: "string" } }; return s; };
const cap = (s, n) => (String(s).length > n ? String(s).slice(0, n) : String(s));
/** The history the app sends back: only assistant tool calls and tool results, rebuilt field by field. */
function cleanHistory(h) {
  if (!Array.isArray(h) || h.length > 40) return null;
  const out = [];
  for (const m of h) {
    if (m?.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length && m.tool_calls.length <= MAX_CALLS) {
      out.push({ role: "assistant", content: null, tool_calls: m.tool_calls.map((c) => ({ id: cap(c?.id, 24), type: "function", function: { name: cap(c?.function?.name, 40), arguments: cap(c?.function?.arguments || "{}", 3000) } })) });
    } else if (m?.role === "tool" && typeof m.tool_call_id === "string") out.push({ role: "tool", tool_call_id: cap(m.tool_call_id, 24), content: cap(m.content ?? "", 9000) });
    else return null;
  }
  return out;
}

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
    let body; try { body = await req.json(); } catch { return { status: 400, jsonBody: { error: "bad json" } }; }
    const cont = Array.isArray(body?.history) && body.history.length > 0, bucket = cont ? "s" + ip : ip, lim = cont ? PER_IP_STEPS : PER_IP_HOUR;
    const now = Date.now(), list = (hits.get(bucket) || []).filter((t) => now - t < 3600e3);
    if (list.length >= lim) return { status: 429, jsonBody: { error: "Too many recaps, try again later." } };
    list.push(now); hits.set(bucket, list);

    if ((body?.mode === "insights" || body?.mode === "game") && body.index != null) {
      const index = typeof body.index === "string" ? body.index : JSON.stringify(body.index);
      if (!index || index.length > MAX_FACTS) return { status: 413, jsonBody: { error: "index missing or too large" } };
      const lang = body.lang === "nl" ? "nl" : "en", ins = body.mode === "insights", q = String(body.question || "").slice(0, 300);
      let hist = cleanHistory(body.history || []); if (!hist) return { status: 400, jsonBody: { error: "bad history" } };
      if (hist.length) { // the results of the last round, in the order of its calls
        const last = hist[hist.length - 1], res = Array.isArray(body.toolResults) ? body.toolResults : [];
        if (last.role === "assistant") hist = [...hist, ...last.tool_calls.map((c) => ({ role: "tool", tool_call_id: c.id, content: cap(JSON.stringify(res.find((r) => r?.id === c.id)?.result ?? { error: "no result" }), 9000) }))];
      }
      const asst = hist.filter((m) => m.role === "assistant"), rounds = asst.length, calls = asst.reduce((a, m) => a + m.tool_calls.length, 0), sims = asst.reduce((a, m) => a + m.tool_calls.filter((c) => SIM.has(c.function.name)).length, 0), simCap = SIM_CAP[body.mode];
      let tools = rounds >= MAX_ROUNDS || calls >= MAX_CALLS ? null : sims >= simCap ? TOOLS.filter((t) => !SIM.has(t.function.name)) : TOOLS;
      const schema = withEv(ins ? INSIGHTS_SCHEMA : GAME_SCHEMA, ins);
      const run = async (useTools) => {
        const r = await fetch(`${process.env.OAI_ENDPOINT}/openai/v1/chat/completions`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
          body: JSON.stringify({ model: process.env.OAI_DEPLOYMENT, max_completion_tokens: 4200,
            response_format: { type: "json_schema", json_schema: { name: ins ? "insights" : "game", strict: true, schema } },
            ...(useTools ? { tools: useTools, tool_choice: "auto" } : {}),
            messages: [{ role: "system", content: (ins ? INSIGHTS + TOOLS_INSIGHTS : GAME + TOOLS_GAME) + (useTools ? "" : "\n\nNo more tool calls are possible: answer now from the index and the tool results you have.") + (lang === "nl" ? "\n\nWrite all text fields in natural Dutch (Nederlands)." : "\n\nWrite all text fields in English.") },
              { role: "user", content: ins ? `index:\n${index}` : `question: ${q || "What decided this game?"}\nindex:\n${index}` }, ...hist] }) });
        const j = await r.json(); if (!r.ok) { ctx.error("oai", r.status, JSON.stringify(j).slice(0, 500)); throw new Error("model error " + r.status); } return j;
      };
      try {
        let j = await run(tools), m = j.choices?.[0]?.message;
        if (m?.tool_calls?.length && tools) {
          const room = MAX_CALLS - calls; let simLeft = simCap - sims;
          const keep = []; for (const c of m.tool_calls) { if (keep.length >= room) break; if (SIM.has(c.function?.name)) { if (simLeft <= 0) continue; simLeft -= 1; } keep.push(c); }
          if (!keep.length) { j = await run(null); m = j.choices?.[0]?.message; }
          else {
            const ids = keep.map((c, i) => ({ id: "k" + (calls + i + 1), name: c.function.name, args: (() => { try { return JSON.parse(c.function.arguments || "{}"); } catch { return {}; } })() }));
            const msg = { role: "assistant", content: null, tool_calls: keep.map((c, i) => ({ id: ids[i].id, type: "function", function: { name: c.function.name, arguments: JSON.stringify(ids[i].args) } })) };
            return { jsonBody: { toolRequests: ids, history: [...hist, msg], usage: j.usage } };
          }
        }
        let ex; try { ex = JSON.parse(m?.content || ""); } catch { return { status: 502, jsonBody: { error: "model returned no JSON" } }; }
        return { jsonBody: { explain: ex, usage: j.usage, rounds, calls } };
      } catch (e) { ctx.error(String(e)); return { status: 502, jsonBody: { error: "model error" } }; }
    }
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
