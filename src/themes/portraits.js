// Player portraits: six personas, a homage to the Dutch Cluedo cast (original drawings), one per seat colour.
// Each one is told apart at 30–44px by its silhouette (long red hair, high bun, peaked cap + moustache,
// bald crown + collar tab, white curls + cap, messy hair + round glasses) and by its clothes in the seat colour
// (var(--pc), set by the .pc-N class on the .avatar span, so the portrait follows the seat palette).
// A small brooch at the lower left carries the persona's emblem; it stays clear of the strip's points badge.
//
// Two renderings share every shape: "flat" (themes A, B, Classic: skin, hair colours, a soft face) and
// "ink" (theme C: true Fiep-style silhouettes in one neutral soft charcoal for all six, with NO eyes or
// other facial features, so no skin tone or face is implied; identity comes from the outline (hair, bun,
// cap, moustache, beard), glasses / monocle as a thin light frame only, clothes in the seat colour, brooch).
const FRAME = "#C9C2B6"; // ink style: thin light frame for glasses and the monocle

export const PERSONAS = {
  rosa: { name: "Roodhart", full: "Rosa Roodhart", seat: "#E63946", bg: "#FADBD6", emblem: "heart" },
  blaauw: { name: "Blaauw", full: "Mevrouw Blaauw van Draet", seat: "#2A6FDB", bg: "#D9E5F8", emblem: "feather" },
  geelen: { name: "Van Geelen", short: "Geelen", full: "Kolonel Van Geelen", seat: "#F58A1F", bg: "#FDE4CB", emblem: "medal" },
  groenewoud: { name: "Groenewoud", short: "Groen", full: "Dominee Groenewoud", seat: "#2DB87E", bg: "#D8F0E2", emblem: "clover" },
  dewit: { name: "De Wit", full: "Mevrouw De Wit", seat: "#EFE6D2", bg: "#DCD3C1", emblem: "star", dark: true },
  pimpel: { name: "Pimpel", full: "Professor Pimpel", seat: "#8B5FA8", bg: "#E8DEF3", emblem: "diamond" },
};

const SKIN = {
  rosa: ["#F4D5BF", "#D9AE92"], blaauw: ["#A86E4C", "#86553A"], geelen: ["#F0C3A6", "#CC9878"],
  groenewoud: ["#7A4E33", "#5C3A26"], dewit: ["#DDA87F", "#B9845F"], pimpel: ["#EED3B9", "#CBA88C"],
};

const p = (d, fill, x = "") => `<path d="${d}" fill="${fill}"${x}/>`;
const seatFill = (k) => `style="fill:var(--pc,${PERSONAS[k].seat})"`;

/** Emblem drawn around (0,0), about 10 units across. */
const EMBLEM = {
  heart: (c) => p("M0,4.4 C-7,-0.6 -5,-7 0,-3.4 C5,-7 7,-0.6 0,4.4Z", c),
  feather: (c) => p("M4.6,-5.2 Q-3,-3 -4.6,5.2 Q3.4,2.6 4.6,-5.2Z", c) + `<path d="M-4.6,5.2 L3,-3.6" stroke="#fff" stroke-width=".9" stroke-opacity=".8"/>`,
  medal: (c) => p("M-3.8,-6 H3.8 L1.6,-1 H-1.6Z", c) + `<circle cy="2" r="3.6" fill="${c}"/>`,
  clover: (c) => `<g fill="${c}"><circle cx="-2.3" cy="-2.3" r="2.6"/><circle cx="2.3" cy="-2.3" r="2.6"/><circle cx="-2.3" cy="2.3" r="2.6"/><circle cx="2.3" cy="2.3" r="2.6"/></g>`,
  star: (c) => p("M0,-5.6 L1.6,-1.8 L5.4,-1.6 L2.4,1 L3.4,5 L0,2.8 L-3.4,5 L-2.4,1 L-5.4,-1.6 L-1.6,-1.8Z", c),
  diamond: (c) => p("M0,-5.4 L4.6,0 L0,5.4 L-4.6,0Z", c) + `<path d="M-4.6,0 H4.6" stroke="#fff" stroke-width=".8" stroke-opacity=".7"/>`,
};

/** Brooch: a disc on the clothes at the lower left with the emblem in the seat colour (ivory: inverted). */
function brooch(k, ink) {
  const P = PERSONAS[k];
  const disc = P.dark ? "#4A4234" : "#FFFDF8";
  const col = P.dark ? "#F3E9D2" : `var(--pc,${P.seat})`;
  const em = EMBLEM[P.emblem](P.dark ? col : "currentColor");
  return `<g transform="translate(-21 36)"${P.dark ? "" : ` style="color:${col}"`}><circle r="8.6" fill="${disc}" stroke="${ink}" stroke-opacity=".35" stroke-width="1"/><g transform="scale(.95)">${em}</g></g>`;
}

const BODY = "M-46,54 Q-44,27 -14,22 L14,22 Q44,27 46,54Z";
const HEAD = { cx: 0, cy: -3, rx: 18.5, ry: 21.5 };

/** Face features (flat): brows, eyes, nose, smile, cheeks. o: { lash, age, ink } */
function faceFlat(k, o = {}) {
  const [, sk2] = SKIN[k], ink = o.ink || "#2B211C";
  return `<path d="M-11,-10.4 Q-7.4,-13.6 -3.6,-11.6 M3.6,-11.6 Q7.4,-13.6 11,-10.4" stroke="${o.brow || ink}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse cx="-7" cy="-4.5" rx="2.2" ry="2.7" fill="${ink}"/><ellipse cx="7" cy="-4.5" rx="2.2" ry="2.7" fill="${ink}"/>
    <circle cx="-6.2" cy="-5.4" r=".8" fill="#fff" opacity=".85"/><circle cx="7.8" cy="-5.4" r=".8" fill="#fff" opacity=".85"/>
    ${o.lash ? `<path d="M-9.4,-6.2 l-2,-1.4 M9.4,-6.2 l2,-1.4" stroke="${ink}" stroke-width="1.4" stroke-linecap="round"/>` : ""}
    ${o.age ? `<path d="M-13.5,-3 l-2.4,1 M13.5,-3 l2.4,1 M-6,13 q6,2 12,0" stroke="${sk2}" stroke-width="1.2" fill="none" stroke-linecap="round"/>` : ""}
    <path d="M.6,-1.6 Q-1.8,4 1.4,5" stroke="${sk2}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${o.noMouth ? "" : `<path d="M-6,8.6 Q0,13.4 6,8.6" stroke="${o.lips || ink}" stroke-width="${o.lips ? 2.4 : 1.8}" fill="none" stroke-linecap="round"/>`}
    <circle cx="-11.5" cy="4" r="3.6" fill="#E8707A" opacity=".2"/><circle cx="11.5" cy="4" r="3.6" fill="#E8707A" opacity=".2"/>`;
}

/** Shapes per persona: back (behind the head), front (over it), cloth (over the clothes). */
const SHAPES = {
  rosa: {
    back: "M-21,-8 Q-27,-37 0,-36 Q27,-37 21,-8 Q29,8 27,26 Q20,32 13,23 L-13,23 Q-20,32 -27,26 Q-29,8 -21,-8Z",
    front: "M-19,-4 Q-21,-30 2,-29 Q19,-29 20,-10 Q14,-21 0,-20 Q-9,-17 -13,-8 Q-16,-6 -19,-4Z",
    hair: "#B5422A", hair2: "#8E2F1C",
    cloth: () => "",
  },
  blaauw: {
    back: "M-7,-35 a11,10 0 1 1 15,-3 Z",
    bun: [3, -38, 10.5],
    front: "M-20,-2 Q-23,-31 0,-31 Q23,-31 20,-2 Q18,-20 6,-23 Q-2,-18 -14,-19 Q-18,-14 -20,-2Z",
    hair: "#221B20", hair2: "#0F0B0E",
    earrings: true,
    cloth: (k, ink) => p("M-12,22 Q0,29 12,22 L12,27 Q0,34 -12,27Z", ink, ` opacity=".22"`),
  },
  geelen: {
    front: "M-20,-15 Q-21,-36 0,-37 Q21,-36 20,-15Z",
    cap: true,
    side: "M-19,-14 Q-21,-6 -18,0 L-16,-13Z M19,-14 Q21,-6 18,0 L16,-13Z",
    hair: "#D9D3C8", hair2: "#A9A194",
    moustache: "M0,5 Q-7,1 -13,4 Q-19,8 -24,2 Q-23,13 -13,11 Q-5,10 0,8 Q5,10 13,11 Q23,13 24,2 Q19,8 13,4 Q7,1 0,5Z",
    cloth: (k, ink) => p("M-12,22 L12,22 L10,29 L-10,29Z", ink, ` opacity=".28"`) + `<circle cx="0" cy="38" r="2" fill="#E2C27A"/><circle cx="0" cy="47" r="2" fill="#E2C27A"/>`,
  },
  groenewoud: {
    front: "M-18.6,-5 Q-20,-27 0,-26.6 Q20,-27 18.6,-5 Q17,-15 11,-19 Q0,-15.6 -11,-19 Q-17,-15 -18.6,-5Z",
    beard: "M-16,3 Q-15,19.6 0,20.6 Q15,19.6 16,3 Q11,13.6 0,13.4 Q-11,13.6 -16,3Z",
    hair: "#2E2926", hair2: "#1A1716", beardCol: "#9A948C",
    cloth: (k, ink, flat) => p("M-12,22 L0,36 L12,22Z", flat ? "#24302A" : ink) + `<rect x="-3.4" y="22" width="6.8" height="6" rx="1" fill="#FFFDF8"/>`,
  },
  dewit: {
    back: "M-22,-2 Q-30,-6 -26,-16 Q-30,-28 -18,-30 Q-12,-40 0,-36 Q12,-40 18,-30 Q30,-28 26,-16 Q30,-6 22,-2Z",
    front: "M-19,-6 Q-22,-16 -15,-20 Q-12,-26 -4,-23 Q0,-28 6,-23 Q14,-26 16,-19 Q22,-15 19,-6 Q14,-16 0,-15 Q-14,-16 -19,-6Z",
    hair: "#FBFAF6", hair2: "#A9A08E",
    capFrill: true,
    cloth: (k, ink) => p("M-14,22 Q0,33 14,22", "none", ` stroke="${ink}" stroke-opacity=".45" stroke-width="2"`),
  },
  pimpel: {
    front: "M-21,-4 Q-27,-18 -19,-26 Q-18,-38 -5,-34 Q3,-43 12,-35 Q25,-37 23,-23 Q29,-14 21,-4 Q19,-17 9,-19 Q-1,-15 -11,-20 Q-17,-15 -21,-4Z",
    hair: "#8C7A68", hair2: "#5E4F42",
    glasses: true,
    cloth: (k, ink, flat) => p("M-10,22 L0,32 L10,22Z", flat ? "#FFFDF8" : "#FFF9EE") + `<path d="M-7,27 L-1,30 L-7,33Z M7,27 L1,30 L7,33Z" style="fill:var(--pc,#8B5FA8)" stroke="${ink}" stroke-opacity=".5" stroke-width="1"/>`,
  },
};

/**
 * One portrait in the -50..50 box.
 * style "flat": skin and hair colours; "ink": black silhouette (hair and face), cream eyes.
 */
export function portrait(k, { style = "flat", ink = "#2B211C", paper = "#FFF9EE" } = {}) {
  const P = PERSONAS[k] || PERSONAS.rosa, S = SHAPES[k] || SHAPES.rosa;
  k = PERSONAS[k] ? k : "rosa";
  const flat = style === "flat";
  const [skin, sk2] = flat ? SKIN[k] : [ink, ink];
  const paperHair = !flat && k === "dewit"; // white hair stays white in the ink theme
  const hair = flat ? S.hair : paperHair ? paper : ink, hair2 = flat ? S.hair2 : ink;
  const line = flat ? ` stroke="${hair2}" stroke-width="1.2"` : paperHair ? ` stroke="${ink}" stroke-width="2"` : "";
  const cloth = `<path d="${BODY}" ${seatFill(k)} stroke="${flat ? "rgba(0,0,0,.28)" : ink}" stroke-width="${flat ? 1.2 : 2}"/>`;
  let s = `<circle r="50" fill="${P.bg}"/>`;
  if (S.bun) s += `<circle cx="${S.bun[0]}" cy="${S.bun[1]}" r="${S.bun[2]}" fill="${hair}"${line}/>`;
  if (S.back) s += p(S.back, hair, line);
  s += cloth + S.cloth(k, ink, flat);
  s += p("M-7,10 h14 v13 q-7,5 -14,0Z", flat ? sk2 : ink);
  if (k === "rosa") s += p("M-9,22 L0,33 L9,22Z", flat ? skin : ink) ;
  s += `<ellipse cx="${HEAD.cx}" cy="${HEAD.cy}" rx="${HEAD.rx}" ry="${HEAD.ry}" fill="${skin}"${flat ? ` stroke="${sk2}" stroke-width="1.2"` : ""}/>`;
  if (flat) s += p("M7,-22 Q18,-16 18,-2 Q17,12 5,17 Q13,2 7,-22Z", sk2, ` opacity=".3"`);
  if (S.beard && flat) s += p(S.beard, S.beardCol, ` stroke="#77716A" stroke-width="1"`);
  if (S.beard && !flat) {
    // ink: a short full beard breaking the jaw line, the white collar tab on top, and a wide-brimmed
    // parson's hat, so the faceless silhouette alone tells Groenewoud apart
    s += p("M-19.4,-2 Q-20,18 0,23 Q20,18 19.4,-2 Q12,9 0,9 Q-12,9 -19.4,-2Z", ink);
    s += `<rect x="-3.4" y="22" width="6.8" height="6" rx="1" fill="#FFFDF8"/>`;
    s += p("M-15,-17 Q-15,-34 0,-34 Q15,-34 15,-17Z M-29,-15 Q0,-23 29,-15 Q28,-11 0,-13 Q-28,-11 -29,-15Z", ink);
  }
  if (S.shine && flat) s += `<ellipse cx="-6" cy="-19" rx="6" ry="3" fill="#fff" opacity=".18" transform="rotate(-18 -6 -19)"/>`;
  if (S.side) s += p(S.side, hair, line);
  if (S.front) s += p(S.front, hair, line);
  if (S.cap) {
    s += p(S.front, `var(--pc,${P.seat})`, ` style="fill:var(--pc,${P.seat})" stroke="${flat ? "rgba(0,0,0,.3)" : ink}" stroke-width="${flat ? 1.2 : 2}"`);
    s += p("M-20,-19 Q0,-15 20,-19 L20,-14 Q0,-10 -20,-14Z", flat ? "#3A2E22" : ink);
    s += p("M-21,-15 Q0,-9 23,-16 L21,-10 Q0,-3 -21,-10Z", flat ? "#1F1A16" : ink);
    s += `<circle cx="0" cy="-26" r="3.2" fill="#E2C27A" stroke="${flat ? "#A9822F" : ink}" stroke-width=".8"/>`;
  }
  if (S.capFrill) {
    // housekeeper's cap: a small white band with a scalloped edge
    s += p("M-15,-27 Q0,-37 15,-27 Q12,-24 9,-26 Q6,-23 3,-26 Q0,-23 -3,-26 Q-6,-23 -9,-26 Q-12,-24 -15,-27Z", "#FFFFFF", ` stroke="${flat ? "#A9A08E" : ink}" stroke-width="1.2"`);
  }
  // face
  if (flat) {
    s += faceFlat(k, { age: k === "dewit" || k === "geelen", lips: k === "rosa" ? "#C2303A" : k === "blaauw" ? "#7A2E3A" : "", noMouth: !!S.moustache, brow: k === "geelen" || k === "dewit" ? "#9C9488" : "" });
  } // ink: a faceless silhouette (no eyes, no features)
  if (S.moustache) {
    s += p(S.moustache, flat ? S.hair : ink, flat ? ` stroke="${S.hair2}" stroke-width="1"` : "");
    s += `<circle cx="7" cy="-4.5" r="5.6" fill="none" stroke="${flat ? "#C9A04A" : FRAME}" stroke-width="${flat ? 1.5 : 1.3}"/><path d="M12.4,-3 Q16,8 14,18" stroke="${flat ? "#C9A04A" : FRAME}" stroke-width=".9" fill="none"/>`;
  }
  if (S.glasses) {
    // ink: a thin light frame whose arms reach past the head outline, so it reads as glasses, not eyes
    s += flat
      ? `<g fill="none" stroke="#2F2433" stroke-width="1.9"><circle cx="-7" cy="-4.5" r="6"/><circle cx="7" cy="-4.5" r="6"/><path d="M-1.6,-5.4 Q0,-6.6 1.6,-5.4 M-13,-6 L-18.5,-8 M13,-6 L18.5,-8"/></g>`
      : `<g fill="none" stroke="${FRAME}" stroke-width="1.4"><circle cx="-7" cy="-4.5" r="6"/><circle cx="7" cy="-4.5" r="6"/><path d="M-1.6,-5.4 Q0,-6.6 1.6,-5.4 M-13,-6 L-22,-9 M13,-6 L22,-9"/></g>`;
  }
  if (S.earrings) s += `<circle cx="-18.6" cy="5" r="2.4" fill="#FFFDF5" stroke="${flat ? "#B8B0A0" : ink}" stroke-width=".8"/><circle cx="18.6" cy="5" r="2.4" fill="#FFFDF5" stroke="${flat ? "#B8B0A0" : ink}" stroke-width=".8"/>`;
  // Rosa in ink: a bow in the seat colour on her hair
  if (!flat && k === "rosa") s += `<g transform="translate(-15 -25) rotate(-24) scale(1.3)" style="fill:var(--pc,${P.seat})" stroke="${ink}" stroke-width="1.2"><path d="M0,0 L-8,-5 L-8,5Z M0,0 L8,-5 L8,5Z"/><circle r="2.4"/></g>`;
  s += brooch(k, flat ? "#000" : ink);
  return s;
}

/** Seat → persona key (seat 0 is the human: Rosa Roodhart). */
export const SEAT_PERSONAS = ["rosa", "blaauw", "geelen", "groenewoud", "dewit", "pimpel"];
