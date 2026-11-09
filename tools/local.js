#!/usr/bin/env node
/* Refresh data/local.json, the Parkstad daily-life feeds: node tools/local.js
   Air quality and pollen (Open-Meteo air-quality API, CAMS, plus the Luchtmeetnet index at Heerlen-Looierstraat), day-ahead power
   prices (EnergyZero, VAT included), the Maas discharge from the GloFAS flood model (Open-Meteo), the NOAA Kp forecast, road works and
   closures within 25 km from the NDW "actueel beeld", Limburg rail disruptions (Rijden de Treinen), municipal notices for Hoensbroek
   (Officiële bekendmakingen SRU) and the newest L1 headlines. No dependencies. Keys the tool does not write (flu, noise, woord,
   culture, admin, roda, shops) are kept from the previous file: the morning run writes those. Town-level coordinates only. */
const fs = require("fs"), path = require("path"), https = require("https"), zlib = require("zlib");
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = require("child_process").spawnSync(process.execPath, [__filename], { stdio: "inherit", env: Object.assign({}, process.env, { NODE_USE_ENV_PROXY: "1", NODE_NO_WARNINGS: "1" }) });
  process.exit(r.status == null ? 1 : r.status);
}
const out = path.join(__dirname, "..", "data", "local.json");
const TOWN = { name: "Hoensbroek", lat: 50.92, lon: 5.93 }; /* town centre, public */
function get(url, opts, hops) { return once(url, opts, hops).catch((e) => { if (/HTTP 4/.test(e.message)) throw e; return new Promise((r) => setTimeout(r, 3000)).then(() => once(url, opts, hops)); }); }
function once(url, opts, hops) {
  opts = opts || {}; hops = hops || 0;
  return new Promise((res, rej) => {
    const q = https.get(url, { headers: { "User-Agent": "readbook-run", Accept: opts.accept || "*/*" }, timeout: 30000 }, (r) => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location && hops < 4) { r.resume(); return res(get(new URL(r.headers.location, url).href, opts, hops + 1)); }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error("HTTP " + r.statusCode + " " + url.slice(0, 80))); }
      const chunks = []; r.on("data", (d) => chunks.push(d)); r.on("error", rej);
      r.on("end", () => { let b = Buffer.concat(chunks); if (opts.gzip) { try { b = zlib.gunzipSync(b); } catch (e) { return rej(e); } } res(b.toString("utf8")); });
    }); q.on("timeout", () => q.destroy(new Error("timeout after 30 s"))); q.on("error", rej);
  });
}
const iso = (d) => d.toISOString().slice(0, 10), today = iso(new Date()), round = (v, n) => v == null ? null : Math.round(v * Math.pow(10, n)) / Math.pow(10, n);
function km(lat, lon) { return Math.hypot((lat - TOWN.lat) * 111.2, (lon - TOWN.lon) * 70.2); }
function nl(k) { return new Date(k).toLocaleString("en-GB", { timeZone: "Europe/Amsterdam", hour12: false }); }
function hourNL(isoT) { return +new Date(isoT).toLocaleString("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", hour12: false }).slice(0, 2) % 24; }
function dateNL(isoT) { const d = new Date(isoT); const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); return p; }
async function air() {
  const q = "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" + TOWN.lat + "&longitude=" + TOWN.lon + "&hourly=pm10,pm2_5,european_aqi,uv_index,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen,olive_pollen&timezone=Europe%2FBerlin&forecast_days=2";
  const h = JSON.parse(await get(q)).hourly, days = {};
  h.time.forEach((t, i) => { const d = t.slice(0, 10); days[d] = days[d] || { aqi: null, pm10: null, pm25: null, uv: null, pollen: {} }; const D = days[d]; const mx = (a, b) => (b == null ? a : a == null ? b : Math.max(a, b)); D.aqi = mx(D.aqi, h.european_aqi[i]); D.pm10 = mx(D.pm10, h.pm10[i]); D.pm25 = mx(D.pm25, h.pm2_5[i]); D.uv = mx(D.uv, h.uv_index[i]); ["alder", "birch", "grass", "mugwort", "ragweed", "olive"].forEach((p) => { D.pollen[p] = mx(D.pollen[p], h[p + "_pollen"][i]); }); });
  const res = { src: "Open-Meteo air-quality API (CAMS Europe), daily maxima for the town grid cell", days: Object.keys(days).sort().map((d) => ({ date: d, aqi: round(days[d].aqi, 0), pm10: round(days[d].pm10, 1), pm25: round(days[d].pm25, 1), uv: round(days[d].uv, 1), pollen: Object.fromEntries(Object.entries(days[d].pollen).map(([k, v]) => [k, round(v, 0)])) })) };
  try { const l = JSON.parse(await get("https://api.luchtmeetnet.nl/open_api/lki?station_number=NL10136&order_by=timestamp_measured&order_direction=desc")).data; if (l && l.length) res.lki = { station: "Heerlen-Looierstraat (NL10136)", value: l[0].value, time: l[0].timestamp_measured, src: "Luchtmeetnet (RIVM) air-quality index LKI, 1 good to 11 very bad" }; } catch (e) { res.lkiError = e.message; }
  return res;
}
async function power() {
  const now = new Date(), d0 = new Date(now.getTime()); d0.setUTCHours(0, 0, 0, 0);
  const from = new Date(d0.getTime() - 2 * 3600e3).toISOString(), till = new Date(d0.getTime() + 47 * 3600e3).toISOString();
  const j = JSON.parse(await get("https://api.energyzero.nl/v1/energyprices?fromDate=" + encodeURIComponent(from) + "&tillDate=" + encodeURIComponent(till) + "&interval=4&usageType=1&inclBtw=true"));
  const byDay = {}; (j.Prices || []).forEach((p) => { const d = dateNL(p.readingDate), h = hourNL(p.readingDate); byDay[d] = byDay[d] || []; byDay[d].push([h, round(p.price, 4)]); });
  const days = Object.keys(byDay).sort().map((d) => { const hrs = byDay[d].sort((a, b) => a[0] - b[0]); let best = null, worst = null; for (let i = 0; i + 2 < hrs.length; i++) { const a = (hrs[i][1] + hrs[i + 1][1] + hrs[i + 2][1]) / 3; if (!best || a < best.avg) best = { from: hrs[i][0], to: hrs[i + 2][0] + 1, avg: round(a, 3) }; if (!worst || a > worst.avg) worst = { from: hrs[i][0], to: hrs[i + 2][0] + 1, avg: round(a, 3) }; } return { date: d, hours: hrs, avg: round(hrs.reduce((s, x) => s + x[1], 0) / hrs.length, 3), cheapest3: best, dearest3: worst }; });
  return { src: "EnergyZero day-ahead hourly prices, euro per kWh, VAT included, before energy tax and the supplier margin", note: "Add the energy tax per kWh from energy.json and your supplier's margin to get the dynamic-contract price.", days };
}
async function maas() {
  const j = JSON.parse(await get("https://flood-api.open-meteo.com/v1/flood?latitude=50.975&longitude=5.725&daily=river_discharge,river_discharge_max&past_days=7&forecast_days=7"));
  return { src: "Open-Meteo Flood API (GloFAS model), Maas grid cell north of Maastricht; a model estimate, not the Rijkswaterstaat gauge", unit: "m3/s", thresholds: { amber: 1000, red: 1500, note: "Rijkswaterstaat raises the Maas to heightened watch above about 1,000 m3/s at Sint Pieter and to high water above 1,500; July 2021 peaked near 3,300 (to confirm against the current RWS phases)" }, days: j.daily.time.map((t, i) => [t, round(j.daily.river_discharge[i], 1), round(j.daily.river_discharge_max[i], 1)]) };
}
async function sky() {
  const k = JSON.parse(await get("https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json"));
  const obs = k.filter((r) => r.observed === "observed"), pred = k.filter((r) => r.observed !== "observed");
  const mx = pred.reduce((a, r) => (!a || r.kp > a.kp ? r : a), null), last = obs[obs.length - 1];
  return { src: "NOAA SWPC planetary K-index forecast", now: last ? { time: last.time_tag, kp: last.kp } : null, max3d: mx ? { time: mx.time_tag, kp: mx.kp, scale: mx.noaa_scale } : null, note: "Kp 5 is a minor storm (aurora possible on the northern horizon from Limburg on a clear night), Kp 7 or more reached the Netherlands in May and October 2024" };
}
async function roads() {
  const x = await get("https://opendata.ndw.nu/actueel_beeld.xml.gz", { gzip: true });
  const sits = x.match(/<sit:situation id="[^"]*">[\s\S]*?<\/sit:situation>/g) || [], items = [];
  sits.forEach((s) => {
    const pos = (s.match(/<loc:posList>([^<]+)<\/loc:posList>/g) || []).map((m) => m.replace(/<[^>]+>/g, "")), pts = [];
    pos.forEach((p) => { const v = p.trim().split(/\s+/); for (let i = 0; i + 1 < v.length; i += 2) pts.push([+v[i], +v[i + 1]]); });
    if (!pts.length) { const la = /<loc:latitude>([\d.]+)/.exec(s), lo = /<loc:longitude>([\d.]+)/.exec(s); if (la && lo) pts.push([+la[1], +lo[1]]); }
    if (!pts.length) return;
    let best = null; pts.forEach((p) => { const d = km(p[0], p[1]); if (!best || d < best.d) best = { d: d, lat: p[0], lon: p[1] }; });
    if (best.d > 25) return;
    const g = (re) => { const m = re.exec(s); return m ? m[1] : ""; };
    items.push({ km: round(best.d, 1), lat: round(best.lat, 3), lon: round(best.lon, 3), type: g(/situationRecord xsi:type="sit:([A-Za-z]+)"/), cause: g(/<sit:causeType>([^<]+)/), mgmt: g(/ManagementType>([^<]+)/), by: g(/<com:value lang="nl">([^<]+)/), from: g(/overallStartTime>([^<]+)/).slice(0, 10), to: g(/overallEndTime>([^<]+)/).slice(0, 10), sev: g(/overallSeverity>([^<]+)/) });
  });
  items.sort((a, b) => a.km - b.km);
  const seen = {}, uniq = items.filter((i) => { const k = [i.lat, i.lon, i.by, i.to, i.mgmt].join("|"); if (seen[k]) return false; seen[k] = 1; return true; });
  items.length = 0; uniq.forEach((i) => items.push(i));
  return { src: "NDW open data, actueel beeld (traffic measures and incidents in force), within 25 km of the town centre", asof: new Date().toISOString(), count: items.length, highSeverity: items.filter((i) => i.sev === "high").length, items: items.slice(0, 12) };
}
async function rail() {
  const h = await get("https://www.rijdendetreinen.nl/storingen", { accept: "text/html" });
  const re = /href="\/storingen\/(\d+)-(\d{1,2}-[a-z]+-\d{4})-([a-z0-9-]+)"/g, seen = {}, all = [], lim = /heerlen|maastricht|sittard|roermond|venlo|weert|kerkrade|landgraaf|valkenburg|meerssen|eindhoven|aachen|aken|luik|liege|visé|hasselt|genk/;
  let m; while ((m = re.exec(h))) { if (seen[m[1]]) continue; seen[m[1]] = 1; const t = m[3].replace(/-/g, " "); all.push({ id: m[1], date: m[2], t: t.charAt(0).toUpperCase() + t.slice(1), url: "https://www.rijdendetreinen.nl/storingen/" + m[1] + "-" + m[2] + "-" + m[3], limburg: lim.test(m[3]) }); }
  return { src: "Rijden de Treinen, current disruptions (NS and regional operators)", total: all.length, items: all.filter((x) => x.limburg).slice(0, 8), asof: new Date().toISOString() };
}
async function notices() {
  const since = iso(new Date(Date.now() - 21 * 864e5));
  const q = "https://repository.overheid.nl/sru?operation=searchRetrieve&version=2.0&maximumRecords=50&query=" + encodeURIComponent('dt.title any "Hoensbroek" and dt.modified>=' + since);
  const x = await get(q, { accept: "application/xml" }), recs = x.match(/<(?:\w+:)?record>[\s\S]*?<\/(?:\w+:)?record>/g) || [], items = [];
  recs.forEach((r) => { const t = (/<dcterms:title>([^<]*)/.exec(r) || [])[1] || "", id = (/<dcterms:identifier>([^<]*)/.exec(r) || [])[1] || "", d = (/<dcterms:modified>([^<]*)/.exec(r) || [])[1] || ""; if (!t || !/Hoensbroek/i.test(t)) return; items.push({ id: id, date: d, t: t.replace(/\s+/g, " ").replace(/\b\d{4}\s?[A-Z]{2}\b/g, "").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").trim(), url: /^gmb-/.test(id) ? "https://zoek.officielebekendmakingen.nl/" + id + ".html" : "https://zoek.officielebekendmakingen.nl/zoeken/resultaat/?zkt=Uitgebreid&pst=Gemeenteblad&vrt=" + encodeURIComponent(t.slice(0, 40)) }); });
  items.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { src: "Officiële bekendmakingen (overheid.nl SRU), gemeente Heerlen notices that name Hoensbroek, last three weeks; street postcodes stripped", count: items.length, items: items.slice(0, 15) };
}
async function news() {
  const h = await get("https://www.l1nieuws.nl/nieuws", { accept: "text/html" }), re = /<a[^>]*href="(\/nieuws\/(\d+)\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g, seen = {}, items = []; let m;
  while ((m = re.exec(h))) { const t = m[3].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim(); if (t.length < 16 || seen[m[2]]) continue; seen[m[2]] = 1; items.push({ id: m[2], t: t.slice(0, 140), url: "https://www.l1nieuws.nl" + m[1] }); }
  /* English lines are written by the morning run; keep them for headlines that are still on the list */
  const prevEn = {}; try { ((JSON.parse(fs.readFileSync(out, "utf8")).news || {}).items || []).forEach((x) => { if (x.en) prevEn[x.id] = x.en; }); } catch (e) {}
  items.forEach((x) => { if (prevEn[x.id]) x.en = prevEn[x.id]; });
  return { src: "L1 Nieuws (L1 and 1Limburg), newest headlines, English by the morning run", items: items.slice(0, 12), asof: new Date().toISOString() };
}
(async () => {
  const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : {}, data = Object.assign({}, prev), errors = [];
  for (const [k, fn] of [["air", air], ["power", power], ["maas", maas], ["sky", sky], ["roads", roads], ["rail", rail], ["notices", notices], ["news", news]]) {
    try { data[k] = await fn(); data[k].fetched = new Date().toISOString(); } catch (e) { errors.push(k + ": " + e.message); if (data[k]) data[k].stale = true; }
  }
  data.updated = today; data.asof = new Date().toISOString(); data.town = TOWN.name; data.errors = errors;
  data.note = prev.note || "Parkstad daily-life feeds. The tool rewrites air, power, maas, sky, roads, rail, notices and news; the run writes flu, noise, woord (Limburgs word of the day, appended), culture (dated local events, confirmed), admin (dated household admin), roda (next fixtures) and shops. Town-centre coordinates only; no address or postcode is stored.";
  fs.writeFileSync(out, JSON.stringify(data, null, 1));
  console.log("local.json refreshed" + (errors.length ? "; failed: " + errors.join(" | ") : "") + " · roads " + ((data.roads || {}).count || 0) + " · rail " + ((data.rail || {}).items || []).length + "/" + ((data.rail || {}).total || 0) + " · notices " + ((data.notices || {}).count || 0) + " · news " + ((data.news || {}).items || []).length);
  if (errors.length >= 4) process.exit(1);
})().catch((e) => { console.error("local.js: " + e.message); process.exit(1); });
