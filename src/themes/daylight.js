// v1.04 proposal (dusk-104): "Auto · time of day" for Sunny Island — day → dusk → night from the local clock.
// No location permission: the place is estimated from the device's time zone (Intl time-zone name → a nearby city;
// otherwise longitude from the standard UTC offset and a mid latitude), and sunrise / sunset are computed locally
// (NOAA sunrise equation, ±a few minutes — far below the size of the dusk window). Pure functions, no DOM.

// A city per common time zone: [latitude, longitude]. Anything else falls back to the UTC-offset estimate.
const TZ = {
  "Europe/Amsterdam": [52.37, 4.9], "Europe/Brussels": [50.85, 4.35], "Europe/Luxembourg": [49.61, 6.13], "Europe/London": [51.51, -0.13],
  "Europe/Dublin": [53.35, -6.26], "Europe/Paris": [48.86, 2.35], "Europe/Berlin": [52.52, 13.4], "Europe/Zurich": [47.37, 8.54],
  "Europe/Vienna": [48.21, 16.37], "Europe/Copenhagen": [55.68, 12.57], "Europe/Oslo": [59.91, 10.75], "Europe/Stockholm": [59.33, 18.07],
  "Europe/Helsinki": [60.17, 24.94], "Europe/Madrid": [40.42, -3.7], "Europe/Lisbon": [38.72, -9.14], "Europe/Rome": [41.9, 12.5],
  "Europe/Athens": [37.98, 23.73], "Europe/Warsaw": [52.23, 21.01], "Europe/Prague": [50.08, 14.44], "Europe/Istanbul": [41.01, 28.98],
  "Atlantic/Canary": [28.12, -15.43], "Atlantic/Reykjavik": [64.15, -21.94],
  "America/New_York": [40.71, -74.01], "America/Chicago": [41.88, -87.63], "America/Denver": [39.74, -104.99], "America/Los_Angeles": [34.05, -118.24],
  "America/Phoenix": [33.45, -112.07], "America/Toronto": [43.65, -79.38], "America/Vancouver": [49.28, -123.12], "America/Mexico_City": [19.43, -99.13],
  "America/Sao_Paulo": [-23.55, -46.63], "America/Argentina/Buenos_Aires": [-34.6, -58.38], "America/Santiago": [-33.45, -70.67], "America/Curacao": [12.11, -68.93],
  "America/Paramaribo": [5.85, -55.2], "Asia/Tokyo": [35.68, 139.69], "Asia/Shanghai": [31.23, 121.47], "Asia/Singapore": [1.35, 103.82],
  "Asia/Kolkata": [22.57, 88.36], "Asia/Dubai": [25.2, 55.27], "Asia/Jakarta": [-6.2, 106.85], "Australia/Sydney": [-33.87, 151.21],
  "Australia/Melbourne": [-37.81, 144.96], "Australia/Perth": [-31.95, 115.86], "Pacific/Auckland": [-36.85, 174.76], "Africa/Johannesburg": [-26.2, 28.05],
  "Africa/Cairo": [30.04, 31.24], "Africa/Lagos": [6.52, 3.38], "Africa/Nairobi": [-1.29, 36.82],
};
const SOUTH = /^(Australia|Antarctica)\/|^Pacific\/(Auckland|Chatham|Fiji)|^America\/(Sao_Paulo|Argentina|Santiago|Montevideo|Asuncion|Lima|La_Paz)|^Africa\/(Johannesburg|Maputo|Harare|Windhoek|Lusaka)|^Indian\/(Mauritius|Reunion)/;

/** { lat, lon, how, tz } — where we think the device is, from the time zone alone. */
export function estimatePlace(now = new Date()) {
  let tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* old engine */ }
  if (TZ[tz]) return { lat: TZ[tz][0], lon: TZ[tz][1], how: "zone", tz };
  // standard (winter) offset: the larger of January's and July's getTimezoneOffset (DST shrinks it)
  const y = now.getFullYear(), jan = new Date(y, 0, 1).getTimezoneOffset(), jul = new Date(y, 6, 1).getTimezoneOffset();
  const std = Math.max(jan, jul), south = SOUTH.test(tz) || jan < jul;
  return { lat: south ? -35 : 45, lon: -std / 4, how: "offset", tz };
}

const RAD = Math.PI / 180;
/** Sun events (ms since epoch) for the local date of `date` at (lat, lon): rise / set (−0.833°) and civil dawn / dusk
 *  (−6°). A missing event (polar day / night) is null. */
export function sunTimes(date, lat, lon) {
  const noonLocal = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const jd = noonLocal.getTime() / 86400000 + 2440587.5;
  const n = Math.round(jd - 2451545.0 + 0.0008);
  const js = n - lon / 360;
  const M = (357.5291 + 0.98560028 * js) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const L = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545.0 + js + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * L * RAD);
  const dec = Math.asin(Math.sin(L * RAD) * Math.sin(23.4397 * RAD));
  const toMs = (j) => (j - 2440587.5) * 86400000;
  const at = (h) => {
    const c = (Math.sin(h * RAD) - Math.sin(lat * RAD) * Math.sin(dec)) / (Math.cos(lat * RAD) * Math.cos(dec));
    if (c > 1) return { always: "below" };
    if (c < -1) return { always: "above" };
    const w = Math.acos(c) / RAD;
    return { a: toMs(transit - w / 360), b: toMs(transit + w / 360) };
  };
  const sun = at(-0.833), civ = at(-6);
  return { rise: sun.a ?? null, set: sun.b ?? null, dawn: civ.a ?? null, dusk: civ.b ?? null, polar: sun.always || null, polarCivil: civ.always || null, noon: toMs(transit) };
}

// The dusk palette covers the golden hour and civil twilight: from GOLDEN before sunset until civil dusk (and the
// mirror image in the morning: civil dawn until GOLDEN after sunrise).
export const GOLDEN = 40 * 60000;
/** Fixed fallback when no sun times can be computed: dusk 19:15–20:15, night 20:15–06:30, dusk 06:30–07:30. */
const FIXED = { dawn: [6.5, 7.5], dusk: [19.25, 20.25] };

/** "day" | "dusk" | "night" for the moment `now`, plus the next switch time. */
export function timePhase(now = new Date(), place = estimatePlace(now)) {
  const t = now.getTime();
  const s = sunTimes(now, place.lat, place.lon);
  let edges; // [time, phase from then on]
  if (s.polar === "above") edges = [];
  else if (s.rise == null || s.set == null) {
    // polar night: a dusk-lit midday where civil twilight exists, otherwise night all day
    edges = s.dawn != null ? [[s.dawn, "dusk"], [s.dusk, "night"]] : [];
  } else {
    // white nights (the sun never gets 6° below the horizon): no night, dusk from before sunset until after sunrise
    edges = s.dawn == null ? [[s.rise + GOLDEN, "day"], [s.set - GOLDEN, "dusk"]] : [[s.dawn, "dusk"], [s.rise + GOLDEN, "day"], [s.set - GOLDEN, "dusk"], [s.dusk, "night"]];
  }
  if (!edges.length) return { phase: s.polar === "above" ? "day" : "night", next: null, sun: s, place };
  if (edges.some((e) => !Number.isFinite(e[0]))) {
    const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
    const T = (x) => d0.getTime() + x * 3600000;
    edges = [[T(FIXED.dawn[0]), "dusk"], [T(FIXED.dawn[1]), "day"], [T(FIXED.dusk[0]), "dusk"], [T(FIXED.dusk[1]), "night"]];
  }
  let phase = "night", next = edges[0][0];
  for (let i = 0; i < edges.length; i += 1) {
    if (t >= edges[i][0]) { phase = edges[i][1]; next = edges[i + 1]?.[0] ?? null; }
  }
  if (t < edges[0][0]) phase = edges[edges.length - 1][1]; // before the first edge: still yesterday's last phase
  if (next == null && t >= edges[edges.length - 1][0]) { // after today's last edge: tomorrow's first one
    const tm = new Date(now); tm.setDate(tm.getDate() + 1); tm.setHours(12, 0, 0, 0);
    const e2 = timePhase(tm, place).edges;
    if (e2?.length) { next = e2[0][0]; edges = [...edges, e2[0]]; }
  }
  return { phase, next, sun: s, place, edges };
}
