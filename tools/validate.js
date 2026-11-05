#!/usr/bin/env node
/* Readbook validator: node tools/validate.js [edition path]. Checks the data files the morning run writes. Exit code 1 on any error. */
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), D = (f) => path.join(root, "data", f);
const errors = [], warns = [];
function load(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { errors.push(f + ": invalid JSON (" + e.message + ")"); return null; } }
const index = load(D("index.json"));
const edPath = process.argv[2] || (index && D("editions/" + index.latest + ".json"));
const E = edPath && load(edPath);
const ids = ["board","world","numbers","feature","hybrid","lead-1","lead-2","europe","euregio","threads","horizon","army","congresstracker","dod","armynews","congress","career","nato","exercises","deftech","aperture","frontier","releases","sota","markets","fx","rates","nl","afnorth","offduty","dutch","snow","hockey","week","weather","countdown","calendar","school","season"];
const judge = /\b(likely|probably|unlikely|suggests|signals that|we assess|means that|so what|could lead to|is expected to)\b/i;
function walk(o, fn, p) { p = p || ""; if (typeof o === "string") fn(o, p); else if (Array.isArray(o)) o.forEach((v, i) => walk(v, fn, p + "[" + i + "]")); else if (o && typeof o === "object") Object.keys(o).forEach((k) => walk(o[k], fn, p + "." + k)); }
if (E) {
  if (E.v !== "6.0") warns.push("edition v is " + E.v + ", expected 6.0");
  (E.sources || []).forEach((x) => { if (x[4] != null && !(x[4] >= 1 && x[4] <= 4)) errors.push("source [" + x[0] + "] tier must be 1 to 4"); });
  if (!(E.sources || []).some((x) => x[4])) warns.push("no source tiers assigned");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(E.date || "")) errors.push("edition date missing");
  if (index && index.latest !== E.date) warns.push("index.latest " + index.latest + " differs from edition date " + E.date);
  const src = new Set((E.sources || []).map((s) => s[0])), used = new Set();
  if ((E.five || []).length !== 5) errors.push("five must have exactly 5 items");
  (E.five || []).concat(E.pick ? [E.pick] : []).forEach((f) => { if (f.to && ids.indexOf(f.to) < 0 && !/^lead-\d$/.test(f.to)) errors.push("unknown jump id: " + f.to); });
  walk(E, (s, p) => {
    if (p.indexOf(".sources") === 0) return;
    (s.match(/\[(\d+(?:\s*,\s*\d+)*)\]/g) || []).forEach((m) => m.replace(/[\[\]]/g, "").split(/\s*,\s*/).forEach((n) => { used.add(+n); if (!src.has(+n)) errors.push("citation [" + n + "] at " + p + " has no source"); }));
    if (/https?:\/\//.test(s) && !/\.(url|src)$|longread\.url|\.sources/.test(p)) errors.push("URL in body text at " + p);
    if (/EUR\s*\/\s*USD/i.test(s)) errors.push("EUR/USD written at " + p + " (use USD/EUR, euros per dollar)");
    if (/\b[1-9]\d{3} ?[A-Z]{2}\b/.test(s) && !/\.(url)$/.test(p)) warns.push("possible postcode at " + p);
    if (p.indexOf(".world") === 0 && judge.test(s)) errors.push("assessment language in the World part at " + p + ": " + s.match(judge)[0]);
  });
  src.forEach((n) => { if (!used.has(n)) warns.push("source [" + n + "] is never cited"); });
  (E.money && E.money.cards || []).forEach((c) => { if (/USD\/EUR/i.test(c[0]) && (parseFloat(c[1]) > 1 || parseFloat(c[1]) < 0.5)) errors.push("USD/EUR card value " + c[1] + " is not euros per dollar"); });
  if (E.world && E.world.feature && E.world.feature.rota) { const d = new Date(E.date + "T12:00:00"); const wd = ["sun","mon","tue","wed","thu","fri","sat"][d.getDay()]; if (E.world.feature.rota !== wd) errors.push("world.feature.rota " + E.world.feature.rota + " does not match weekday " + wd); }
}
/* cross-links */
if (E) {
  const reg = {}; const grab = (f, key, idk) => { const j = load(D(f)); if (j && Array.isArray(j[key])) j[key].forEach((x) => { if (x[idk || "id"]) reg[f.split(".")[0].replace("conflicts", "theatre").replace("threads", "thread").replace("congress", "congress").replace("exercises", "exercise").replace("events", "event").replace("releases", "release") + ":" + x[idk || "id"]] = 1; }); };
  grab("conflicts.json", "theatres"); grab("threads.json", "threads"); grab("congress.json", "items"); grab("exercises.json", "exercises"); grab("events.json", "events"); grab("releases.json", "releases");
  const cj = load(D("congress.json")); if (cj && cj.watch) cj.watch.forEach((w) => { reg["post:" + w.id] = 1; });
  const seenLinks = new Set();
  (function walk(o, p) { if (Array.isArray(o)) { o.forEach((v, i) => walk(v, p + "[" + i + "]")); return; } if (o && typeof o === "object") { if (Array.isArray(o.links)) o.links.forEach((l) => { seenLinks.add(l); if (!reg[l]) errors.push("link " + l + " at " + p + " matches nothing in the standing files"); }); Object.keys(o).forEach((k) => { if (k !== "sources") walk(o[k], p + "." + k); }); } })(E, "");
  if (!seenLinks.size) warns.push("no item carries links to the trackers");
}
/* standing files */
const files = { "conflicts.json": "theatres", "threads.json": "threads", "horizon.json": "events", "incidents.json": "incidents", "exercises.json": "exercises", "events.json": "events", "idioms.json": "idioms", "congress.json": "items", "releases.json": "releases" };
Object.keys(files).forEach((f) => { const j = load(D(f)); if (!j) return; if (!Array.isArray(j[files[f]])) errors.push(f + ": missing array " + files[f]); });
const fx = load(D("fx.json")); if (fx && fx.series) { let prev = ""; fx.series.forEach((p) => { if (p[0] <= prev) errors.push("fx.json not ascending at " + p[0]); prev = p[0]; if (!(p[1] > 0.8 && p[1] < 1.7)) errors.push("fx.json value out of range at " + p[0]); }); }
const ser = load(D("series.json")); if (ser) Object.keys(ser).filter((k) => k[0] !== "_").forEach((k) => { if (ser[k].length > 30) warns.push("series.json " + k + " has " + ser[k].length + " rows (keep 30)"); });
const can = load(D("canes.json")); if (can && can.games) { let w = 0, l = 0, o = 0; can.games.forEach((g) => { if (g.res === "W") w++; else if (g.res === "L") l++; else o++; }); if (can.record !== w + "-" + l + "-" + o) errors.push("canes.json record " + can.record + " does not match games " + w + "-" + l + "-" + o); }
const idi = load(D("idioms.json")); if (idi) { const seen = new Set(); idi.idioms.forEach((i) => { const k = i.lang + ":" + i.phrase.toLowerCase(); if (seen.has(k)) errors.push("idioms.json repeats " + i.phrase); seen.add(k); }); }
const con = load(D("conflicts.json")); if (con) con.theatres.forEach((t) => (t.log || []).forEach((e) => { if (judge.test(e.t)) errors.push("assessment language in conflicts.json " + t.id + " " + e.date); (e.t.match(/\[(\d+)/g) || []).forEach((m) => { const n = +m.slice(1); if (!(e.src || []).some((s) => s[0] === n)) errors.push("conflicts.json " + t.id + " " + e.date + " cites [" + n + "] without a src row"); }); }));
["world-series.json", "calendar.json", "deadlines.json", "ski.json", "search-index.json", "bins.json", "week.json", "corrections.json"].forEach((f) => load(D(f)));
const tm = load(D("teams.json")); if (tm) { ["saints", "cardinals"].forEach((k) => { const t = tm[k]; if (!t || !(t.games || []).length || !t.record) return; let w = 0, l = 0, o = 0; t.games.forEach((g) => { if (g.res === "W") w++; else if (g.res === "L") l++; else o++; }); const want = w + "-" + l + (o ? "-" + o : ""); if (t.record !== want) errors.push("teams.json " + k + " record " + t.record + " does not match games " + want); }); }
const tvf = load(D("tv.json")); if (tvf) (tvf.shows || []).forEach((x) => { if (!x.id || !x.title) errors.push("tv.json show without id or title"); ["last", "next"].forEach((k) => { if (x[k] && x[k].date && !/^\d{4}-\d{2}-\d{2}$/.test(x[k].date)) errors.push("tv.json " + x.id + " " + k + " date " + x[k].date); }); });
const rs = load(D("research.json")); if (rs && E && E.research) { if (!E.research.src) errors.push("research piece has no src"); if (!(rs.covered || []).some((c) => c.title === E.research.title)) warns.push("research.json covered does not list today's piece"); const recent = (rs.covered || []).filter((c) => c.date < E.date && (new Date(E.date) - new Date(c.date)) / 864e5 <= 10 && c.org === E.research.org); if (recent.length) warns.push("research: " + E.research.org + " was covered within the last 10 days"); }
warns.forEach((w) => console.log("warn  " + w));
errors.forEach((e) => console.log("ERROR " + e));
console.log(errors.length ? errors.length + " error(s)" : "ok: " + (E ? path.basename(edPath) : "no edition") + " and standing files pass");
process.exit(errors.length ? 1 : 0);
