// v1.21 The bots' review accuracy, in ONE place (the review screen's bot band and each bot's profile card read it).
// Measured with the full review engine: every preset's own moves scored like a human's (the seat plays on as Expert),
// 300 positions, bootstrap SE. [name, accuracy, SE]. (scratchpad step105/tests/an4.py, formula k 0.10)
export const BOT_BANDS = [["Simple", 58, 5], ["Beginner", 54, 4], ["Intermediate", 61, 5], ["Shark", 61, 5], ["Trader", 61, 5], ["Builder", 66, 4], ["Expert", 67, 4], ["Master", 73, 4]];
/** [accuracy, SE] of a bot level by its name, or null when it was not measured. */
export const botBand = (name) => { const b = BOT_BANDS.find((x) => x[0] === name); return b ? [b[1], b[2]] : null; };
