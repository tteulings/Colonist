// v1.87 Dutch tables. Each file lists [English, Dutch] pairs; a pair whose English has {name} variables is a pattern ({n} a number, {x} text).
import { NL_UI } from "./i18n-nl-ui.js";
import { NL_SET } from "./i18n-nl-set.js";
import { NL_GAME } from "./i18n-nl-game.js";
import { NL_REVIEW } from "./i18n-nl-review.js";
import { NL_MISC } from "./i18n-nl-misc.js";
import { NL_BOTSLONG } from "./i18n-nl-botslong.js";
import { NL_REASON } from "./i18n-nl-reason.js";
import { NL_MODES } from "./i18n-nl-modes.js";
import { NL_FIX } from "./i18n-nl-fix.js";
import { NL_HTML } from "./i18n-nl-html.js";
import { NL_MORE } from "./i18n-nl-more.js";
import { NL_R2 } from "./i18n-nl-r2.js";
const ALL = [...NL_UI, ...NL_SET, ...NL_GAME, ...NL_REVIEW, ...NL_MISC, ...NL_BOTSLONG, ...NL_MORE, ...NL_REASON, ...NL_MODES, ...NL_FIX, ...NL_HTML, ...NL_R2];
export const NL = Object.create(null); export const NLP = []; export const NLT = Object.create(null); // NLT: the template of every entry, for t("… {n} …", vars)
// patterns that would match almost any sentence are not allowed
const TOO_WIDE = new Set(["{x}: {y}", "{x}: {n}", "{x} · {y} · {z}", "{n} × {x}", "{n}× {x}", "{x} points", "{x} {n} points", "{x}, {n} points", "{x} on {y}", "{x} · Rush", ", {x}.", "{x} bot", "{x} played {y}", "{x} played {y}.", "{x} {y} {z}", "{x} won", "{x} thick", "{x} {n} points", "Open {x}, {y}", "{x} profile", "Bots: {x}", "{x} · moves"]);
for (const [en, nl] of ALL) { NLT[en] = nl; if (TOO_WIDE.has(en)) continue; if (/\{\w+\}/.test(en)) NLP.push([en, nl]); else NL[en] = nl; }
NLP.sort((a, b) => b[0].length - a[0].length); // the most specific pattern first
