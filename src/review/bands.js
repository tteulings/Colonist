// v1.21 The bots' review accuracy, in ONE place (the review screen's bot band and each bot's profile card read it).
// Measured with the full review engine: every preset's own moves scored like a human's (the seat plays on as Expert),
// 300 positions, bootstrap SE. [name, accuracy, SE]. eng-124: the same 300 positions and formula (k 0.10) re-measured with the
// gbm leaf (one race of 2000 futures, 14 turns, no halving, 14 s cap; scratchpad eng124/tests/an_bands.py). Same order as
// with the fit leaf (Spearman vs win rate 0.93 both), 4-7 points lower (fit: 58 54 61 61 61 66 67 73).
// v1.42 the deep review looks 20 turns ahead everywhere (24 in set-up), so the bands are those of that engine: the same 300 positions,
// 2000 futures each, horizon 20 (scratchpad eng124/tests/an_bands140.py). Horizon 14 re-run on the same machine gave 51 49 56 56 56 61 61 66
// (the v1.21/eng-124 table within 1); horizon 20 is 0.7-2.9 points lower (Builder and Expert significant), same order (Spearman 0.93).
export const BOT_BANDS = [["Simple", 49, 5], ["Beginner", 49, 5], ["Intermediate", 55, 5], ["Shark", 54, 5], ["Trader", 55, 5], ["Builder", 58, 5], ["Expert", 58, 6], ["Master", 64, 6]];
/** [accuracy, SE] of a bot level by its name, or null when it was not measured. */
export const botBand = (name) => { const b = BOT_BANDS.find((x) => x[0] === name); return b ? [b[1], b[2]] : null; };
