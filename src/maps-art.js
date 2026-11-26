// v1.99.3 The lake tile of the Lake map, for every SVG theme: a hex of water (radius 100, like a terrain tile) with a darker rim and a few ripples.
// Drawn by src/themes/board-renderer.js where a hex has `lake` (the engine treats it as the desert: no number, pays nobody, the robber starts there).
import { hexPath } from "./themes/art-util.js";

const isNight = () => typeof document !== "undefined" && ["night", "dusk"].includes(document.documentElement.dataset.palette);

export function lakeTile() {
  const c = isNight() ? { a: "#2A7B86", b: "#17505E", rim: "#0E3440", wave: "rgba(190,230,236,.45)", glow: "rgba(150,210,220,.16)" }
    : { a: "#5CC0CF", b: "#2F93A8", rim: "#1F7488", wave: "rgba(255,255,255,.6)", glow: "rgba(255,255,255,.22)" };
  const ripple = (x, y, w) => `<path d="M${x - w},${y} q${w / 2},-${w / 3} ${w},0 t${w},0" fill="none" stroke="${c.wave}" stroke-width="5" stroke-linecap="round"/>`;
  return `<defs><linearGradient id="lk-g" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="${c.a}"/><stop offset="1" stop-color="${c.b}"/></linearGradient><clipPath id="lk-c"><path d="${hexPath(0, 0, 100)}"/></clipPath></defs>
    <g clip-path="url(#lk-c)"><path d="${hexPath(0, 0, 100)}" fill="url(#lk-g)"/>
    <path d="M-100,-52 Q-40,-76 20,-58 Q64,-70 100,-50 V-100 H-100Z" fill="${c.glow}"/>
    ${ripple(-52, -18, 22)}${ripple(10, 34, 26)}${ripple(30, -52, 16)}${ripple(-64, 52, 14)}
    <path d="${hexPath(0, 0, 96)}" fill="none" stroke="${c.rim}" stroke-width="9" opacity=".75"/></g>`;
}
