// v1.91 avatar rig helper: render every portrait (6 personas x tones A/B x 28/40/64/96 px, 2x) from a portraits module to PNG
// buffers, so a rig can be compared byte for byte with the v1.90 drawings. Used by tests/avatar192.js.
const { chromium } = require("playwright");
const { pathToFileURL } = require("url");
const SIZES = [28, 40, 64, 96];
const SEATS = ["#D1453A", "#3C75C6", "#F08A2E", "#1E8A7C", "#EFE7D4", "#5A2C88"];
const KEYS = ["rosa", "blaauw", "geelen", "groenewoud", "dewit", "pimpel"];
const pc = (i) => `--pc:${SEATS[i]};--pc-light:color-mix(in srgb,${SEATS[i]} 70%,#fff);--pc-dark:color-mix(in srgb,${SEATS[i]} 70%,#000);--pc-line:color-mix(in srgb,${SEATS[i]} 50%,#000)`;

/** opts(k, tone) -> options for portrait(); returns { "rosa-A-28": Buffer, ... } */
async function renderStills(modulePath, opts = () => ({}), { browser } = {}) {
  const mod = await import(pathToFileURL(modulePath).href + "?" + Math.random());
  const b = browser || (await chromium.launch());
  const page = await b.newPage({ viewport: { width: 800, height: 400 }, deviceScaleFactor: 2 });
  const out = {};
  for (const tone of ["A", "B"]) for (const [i, k] of KEYS.entries()) for (const sz of SIZES) {
    const svg = mod.portrait(k, { tone, ...opts(k, tone) });
    await page.setContent(`<body style="margin:0;background:#fff"><span id="a" style="display:block;width:${sz}px;height:${sz}px;border-radius:50%;overflow:hidden;${pc(i)}"><svg viewBox="-50 -50 100 100" width="${sz}" height="${sz}" style="display:block">${svg}</svg></span></body>`);
    out[`${k}-${tone}-${sz}`] = await (await page.$("#a")).screenshot({ omitBackground: false });
  }
  await page.close();
  if (!browser) await b.close();
  return out;
}
module.exports = { renderStills, SIZES, KEYS };
