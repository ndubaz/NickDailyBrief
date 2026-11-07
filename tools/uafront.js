#!/usr/bin/env node
/* Refresh data/ua-front.json from DeepState: node tools/uafront.js
   Downloads https://deepstatemap.live/api/history/last, keeps the Ukrainian layers (occupied since 2022, occupied since 2014, unknown, liberated, axes of attack),
   simplifies the polygons (Douglas-Peucker, 0.01 degree) and keeps the country outlines already in the file. No dependencies. */
const fs = require("fs"), path = require("path"), https = require("https");
const out = path.join(__dirname, "..", "data", "ua-front.json");
function get(url) { return new Promise((res, rej) => { https.get(url, { headers: { "User-Agent": "readbook-run" } }, (r) => { if (r.statusCode !== 200) return rej(new Error("HTTP " + r.statusCode)); let b = ""; r.on("data", (d) => (b += d)); r.on("end", () => res(b)); }).on("error", rej); }); }
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const d = (p, a, b) => { if (a[0] === b[0] && a[1] === b[1]) return Math.hypot(p[0] - a[0], p[1] - a[1]); const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2))); return Math.hypot(p[0] - (a[0] + t * (b[0] - a[0])), p[1] - (a[1] + t * (b[1] - a[1]))); };
  const keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true; const stack = [[0, pts.length - 1]];
  while (stack.length) { const [i, j] = stack.pop(); let mx = 0, k = -1; for (let m = i + 1; m < j; m++) { const dd = d(pts[m], pts[i], pts[j]); if (dd > mx) { mx = dd; k = m; } } if (mx > eps) { keep[k] = true; stack.push([i, k], [k, j]); } }
  return pts.filter((_, i) => keep[i]);
}
(async () => {
  const prev = JSON.parse(fs.readFileSync(out, "utf8"));
  const ds = JSON.parse(await get("https://deepstatemap.live/api/history/last"));
  const L = { occupied: [], occupied2014: [], unknown: [], liberated: [], arrows: [] };
  for (const f of ds.map.features) {
    const n = String(f.properties.name || ""), g = f.geometry;
    if (g.type === "Point") { if (/Direction of attack/.test(n)) L.arrows.push([+g.coordinates[1].toFixed(3), +g.coordinates[0].toFixed(3)]); continue; }
    if (g.type !== "Polygon") continue;
    if (/Transnistria|Abkhazia|Tskhin|Karelia|Prussia|Ichkeria/.test(n)) continue;
    const ring = rdp(g.coordinates[0].map((p) => [+p[0].toFixed(3), +p[1].toFixed(3)]), 0.01);
    if (/Crimea|CADR/.test(n)) L.occupied2014.push(ring); else if (/Occupied|Tuzla/.test(n)) L.occupied.push(ring); else if (/Unknown/.test(n)) L.unknown.push(ring); else if (/Liberated/.test(n)) L.liberated.push(ring);
  }
  const today = new Date().toISOString().slice(0, 10);
  const data = Object.assign({}, prev, L, { asof: today, asofText: ds.datetime || "" });
  fs.writeFileSync(out, JSON.stringify(data));
  console.log("ua-front.json refreshed: " + L.occupied.length + " occupied, " + L.liberated.length + " liberated, " + L.unknown.length + " unknown polygons, " + L.arrows.length + " axes; DeepState " + ds.datetime);
})().catch((e) => { console.error("uafront: " + e.message + " (file left unchanged)"); process.exit(1); });
