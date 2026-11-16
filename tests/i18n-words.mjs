// English words the Dutch UI must not show: every word of an English key that no Dutch value uses (names and shared words excluded).
import { NL, NLP } from "../src/i18n-nl.js";
const words = (s) => (s.toLowerCase().match(/[a-zà-ÿ’']{3,}/g) || []);
const nlWords = new Set(); const all = [...Object.entries(NL), ...NLP];
all.forEach(([, v]) => words(v).forEach((w) => nlWords.add(w)));
const NAMES = "katan blaauw geelen groen roodhart rosa mevrouw kolonel dominee van groenewoud pimpel professor draet wit ai lab rush sunny island seafarers monte carlo bot bots start".split(" ");
export const ENGLISH = new Set(); all.forEach(([k]) => words(k.replace(/\{\w+\}/g, " ")).forEach((w) => { if (!nlWords.has(w) && !NAMES.includes(w)) ENGLISH.add(w); }));
const COMMON = "the and for with from your you are was were has have not than this that when then they them their there what which will would could should about into over under after before between while only just also more most less than other another each every some any all one two three four five six seven eight nine ten first last next previous new old open close tap pick take give get build trade roll turn game games card cards win lose won lost points point road city settlement dice luck moves move best good better great worst bad worse".split(" ");
COMMON.forEach((w) => { if (!nlWords.has(w)) ENGLISH.add(w); });
export const looksEnglish = (t) => words(t.replace(/\{\w+\}/g, " ")).filter((w) => ENGLISH.has(w));
