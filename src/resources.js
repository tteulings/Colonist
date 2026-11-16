// v1.86 The one resource table: key, English and Dutch name, colour and icon. Everything that names a resource
// (hand, trade, review, lessons, AI page, build card) reads it from here, so Lumber / Brick / Wool / Grain / Ore
// (Hout / Baksteen / Wol / Graan / Erts) is spelled one way and no two-letter abbreviation is ever needed.
// The same colours are CSS tokens (--res-wood ... in themes/base.css).
export const RESOURCES = {
  wood: { en: "Lumber", nl: "Hout", color: "#3E9A4E", icon: "./assets/icons/resource-wood-v3.svg" },
  brick: { en: "Brick", nl: "Baksteen", color: "#D8613C", icon: "./assets/icons/resource-brick-v2.svg" },
  sheep: { en: "Wool", nl: "Wol", color: "#86BF3C", icon: "./assets/icons/resource-sheep-v2.svg" },
  wheat: { en: "Grain", nl: "Graan", color: "#E3A21F", icon: "./assets/icons/resource-wheat-v2.svg" },
  ore: { en: "Ore", nl: "Erts", color: "#7D8DA5", icon: "./assets/icons/resource-ore-v2.svg" },
};
const pick = (f) => Object.fromEntries(Object.entries(RESOURCES).map(([k, v]) => [k, v[f]]));
export const RES_EN = pick("en");
export const RES_NL = pick("nl");
export const RES_COLOR = pick("color");
export const RES_ICON_URL = pick("icon");
export const resName = (k, lang = "en") => RESOURCES[k]?.[lang === "nl" ? "nl" : "en"] || k;
