// v1.21 The bots' review accuracy, in ONE place (the review screen's bot band and each bot's profile card read it).
// Measured with the full review engine: every preset's own moves scored like a human's (the seat plays on as Expert),
// 300 positions, bootstrap SE. [name, accuracy, SE]. eng-124: the same 300 positions and formula (k 0.10) re-measured with the
// gbm leaf (one race of 2000 futures, 14 turns, no halving, 14 s cap; scratchpad eng124/tests/an_bands.py). Same order as
// with the fit leaf (Spearman vs win rate 0.93 both), 4-7 points lower (fit: 58 54 61 61 61 66 67 73).
export const BOT_BANDS = [["Simple", 52, 5], ["Beginner", 50, 5], ["Intermediate", 57, 6], ["Shark", 56, 5], ["Trader", 57, 6], ["Builder", 61, 5], ["Expert", 61, 5], ["Master", 66, 6]];
/** [accuracy, SE] of a bot level by its name, or null when it was not measured. */
export const botBand = (name) => { const b = BOT_BANDS.find((x) => x[0] === name); return b ? [b[1], b[2]] : null; };
