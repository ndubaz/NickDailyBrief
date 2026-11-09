#!/usr/bin/env node
/* Refresh data/fuel.json from CBS StatLine: node tools/fuel.js
   Downloads table 80416ned (Pompprijzen motorbrandstoffen; brandstofsoort, per dag), the weighted national average pump prices
   in the Netherlands including VAT and excise, published weekly. Keeps the last 400 days of Euro 95 (E10) and diesel in euros per
   litre. The page converts Euro 95 to US dollars per gallon with the ECB rate in fx.json. No dependencies. */
const fs = require("fs"), path = require("path"), https = require("https");
/* Behind an HTTPS proxy, Node's https only routes through it with NODE_USE_ENV_PROXY set: re-run this script with it. */
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = require("child_process").spawnSync(process.execPath, [__filename], { stdio: "inherit", env: Object.assign({}, process.env, { NODE_USE_ENV_PROXY: "1", NODE_NO_WARNINGS: "1" }) });
  process.exit(r.status == null ? 1 : r.status);
}
const out = path.join(__dirname, "..", "data", "fuel.json");
function once(url) { return new Promise((res, rej) => { const q = https.get(url, { headers: { "User-Agent": "readbook-run", Accept: "*/*" }, timeout: 30000 }, (r) => { if (r.statusCode !== 200) { r.resume(); return rej(new Error("HTTP " + r.statusCode)); } let b = ""; r.setEncoding("utf8"); r.on("data", (d) => (b += d)); r.on("end", () => res(b)); r.on("error", rej); }); q.on("timeout", () => q.destroy(new Error("timeout after 30 s"))); q.on("error", rej); }); }
function get(url) { return once(url).catch((e) => new Promise((r) => setTimeout(r, 3000)).then(() => once(url))); }
const iso = (d) => d.toISOString().slice(0, 10);
(async () => {
  const from = iso(new Date(Date.now() - 400 * 864e5)).replace(/-/g, "");
  const q = "https://opendata.cbs.nl/ODataApi/odata/80416ned/TypedDataSet?$filter=" + encodeURIComponent("Perioden ge '" + from + "'") + "&$select=Perioden,BenzineEuro95_1,Diesel_2";
  const rows = JSON.parse(await get(q)).value.filter((v) => /^\d{8}$/.test(v.Perioden)).map((v) => [v.Perioden.slice(0, 4) + "-" + v.Perioden.slice(4, 6) + "-" + v.Perioden.slice(6, 8), v.BenzineEuro95_1, v.Diesel_2]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const e95 = rows.filter((r) => typeof r[1] === "number" && r[1] > 0.5 && r[1] < 5).map((r) => [r[0], r[1]]);
  const dsl = rows.filter((r) => typeof r[2] === "number" && r[2] > 0.5 && r[2] < 5).map((r) => [r[0], r[2]]);
  if (e95.length < 30) throw new Error("CBS returned only " + e95.length + " Euro 95 rows; fuel.json left as it was");
  const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : {};
  const data = Object.assign({}, prev, {
    updated: iso(new Date()),
    source: "CBS StatLine 80416ned, Pompprijzen motorbrandstoffen per dag",
    url: "https://opendata.cbs.nl/statline/#/CBS/nl/dataset/80416ned/table",
    note: prev.note || "Weighted national average pump prices in the Netherlands, including VAT and excise, in euros per litre, as CBS publishes them (weekly, a few days behind). Euro 95 is sold as E10. Rewritten by tools/fuel.js; the page converts Euro 95 to US dollars per gallon with the ECB rate of the same day from fx.json.",
    unit: "EUR per litre",
    series: { "nl-e95": e95, "nl-diesel": dsl }
  });
  /* one [date, value] row per line keeps the file short and its diffs readable */
  const json = JSON.stringify(data, null, 1).replace(/\[\n\s+("\d{4}-\d{2}-\d{2}"),\n\s+([\d.]+)\n\s+\]/g, "[$1, $2]");
  fs.writeFileSync(out, json);
  console.log("fuel.json refreshed: " + e95.length + " days of Euro 95, last " + e95[e95.length - 1].join(" €"));
})().catch((e) => { console.error("fuel.js: " + e.message); process.exit(1); });
