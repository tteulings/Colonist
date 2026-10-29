// v0.90 Master: a minimal "anything goes" DOM so src/game.js can run headless inside the Web Worker
// (from the research branch, research/dom.mjs). Every property is a callable stub.
const handler = {
  get(t, k) {
    if (k === Symbol.toPrimitive) return (hint) => (hint === "number" ? 0 : "");
    if (k === Symbol.iterator) return function* () {};
    if (k === "then") return undefined;
    if (k === "length") return 0;
    if (k === "dataset") { if (!t[k]) t[k] = {}; return t[k]; }
    if (k === "style" || k === "classList") { if (!t[k]) t[k] = stub(); return t[k]; }
    if (k in t) return t[k];
    if (["firstChild","lastChild","firstElementChild","lastElementChild","nextSibling","previousSibling","nextElementSibling","offsetParent","parentElement","activeElement"].includes(k)) return null;
    if (k === "children" || k === "childNodes" || k === "files") return [];
    if (k === "getAttribute" || k === "closest" || k === "querySelector" && false) return () => null;
    if (k === "querySelectorAll" || k === "getElementsByClassName" || k === "getElementsByTagName") return () => [];
    if (k === "getBoundingClientRect") return () => ({ left: 0, top: 0, width: 360, height: 780, right: 360, bottom: 780, x: 0, y: 0 });
    if (k === "matches" || k === "contains") return () => false;
    return stub();
  },
  set(t, k, v) { t[k] = v; return true; },
  apply() { return stub(); },
  construct() { return stub(); },
  has() { return true; },
};
export function stub() { const f = function () {}; return new Proxy(f, handler); }
const store = new Map();
const def = (k, v) => { try { Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); } catch (_) { try { globalThis[k] = v; } catch (__) {} } };
def("localStorage", { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear(), key: () => null, get length() { return store.size; } });
def("document", stub());
def("window", globalThis);
def("navigator", stub());
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {} });
globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = () => {};
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 360; globalThis.innerHeight = 780;
for (const k of ["HTMLElement", "Element", "Node", "Image", "AudioContext", "ResizeObserver", "MutationObserver", "IntersectionObserver", "FontFace", "Path2D", "DOMMatrix", "Event", "CustomEvent", "KeyboardEvent"]) globalThis[k] = class { constructor() { return stub(); } };
if (typeof WorkerGlobalScope === "undefined") { globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {}; }
if (typeof WorkerGlobalScope === "undefined") def("location", { search: "", hash: "", href: "http://x/", pathname: "/" });
globalThis.history = { replaceState() {}, pushState() {} };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => "" });
globalThis.screen = { width: 360, height: 780 };
if (typeof WorkerGlobalScope === "undefined") globalThis.fetch = async () => ({ ok: false, json: async () => ({}), text: async () => "" });
