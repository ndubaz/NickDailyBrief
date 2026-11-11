#!/usr/bin/env node
/* Refresh data/cozi.json from the family's Cozi calendar feed:
     COZI_URL='<feed link>' COZI_STRIP='Name1,Name2' COZI_ME='Name1' node tools/cozi.js
   The feed link and the names live only in the scheduled task's prompt, never in this repository.
   The site is public, so the tool keeps only one-off events in the next 120 days and drops recurring entries (routines and
   birthdays), anything that looks medical, and every name given in COZI_STRIP; locations are kept only when short and without numbers.
   On a failed fetch the previous items stay, marked stale. No dependencies. */
const fs = require("fs"), path = require("path"), https = require("https"), crypto = require("crypto");
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = require("child_process").spawnSync(process.execPath, [__filename], { stdio: "inherit", env: Object.assign({}, process.env, { NODE_USE_ENV_PROXY: "1", NODE_NO_WARNINGS: "1" }) });
  process.exit(r.status == null ? 1 : r.status);
}
const out = path.join(__dirname, "..", "data", "cozi.json"), URL_ = process.env.COZI_URL || "", DAYS = 120;
const STRIP = (process.env.COZI_STRIP || "").split(",").map((s) => s.trim()).filter(Boolean), ME = (process.env.COZI_ME || "").trim().toLowerCase();
const MEDICAL = /\b(ekg|ecg|dr\.?|doctor|docter|arts|huisarts|tandarts|dentist|orthodont\w*|fysio\w*|physio\w*|nephrolog\w*|cardiolog\w*|dermatolog\w*|neurolog\w*|uroloog|urolog\w*|gyn\w*|psych\w*|therap\w*|klinik\w*|klinikum|clinic|kliniek|hospital|ziekenhuis|krankenhaus|blood|bloed|pressure|bloeddruk|vaccin\w*|flu shot|shot|injection|prik|mri|ct scan|scan|x-ray|r[oö]ntgen|lab|labs|apotheek|pharmacy|prescription|recept|medical|medisch|surgery|operatie|check-up|checkup|optometr\w*|eye exam|oogarts|audiolog\w*|pediatric\w*|kinderarts|consult)\b/i;
const BIRTHDAY = /\b(birthday|verjaardag|geburtstag|bday)\b/i;
function once(url, hops) { hops = hops || 0; return new Promise((res, rej) => { const q = https.get(url, { headers: { "User-Agent": "readbook-run", Accept: "text/calendar" }, timeout: 30000 }, (r) => { if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location && hops < 4) { r.resume(); return res(once(new URL(r.headers.location, url).href, hops + 1)); } if (r.statusCode !== 200) { r.resume(); return rej(new Error("HTTP " + r.statusCode)); } let b = ""; r.setEncoding("utf8"); r.on("data", (d) => (b += d)); r.on("end", () => res(b)); r.on("error", rej); }); q.on("timeout", () => q.destroy(new Error("timeout"))); q.on("error", rej); }); }
const get = (u) => once(u).catch(() => new Promise((r) => setTimeout(r, 3000)).then(() => once(u)));
const pad = (n) => String(n).padStart(2, "0"), ymd = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const unesc = (s) => String(s || "").replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
function clean(t) {
  let s = unesc(t).replace(/^[^:\n]{1,60}:\s*/, "");                     /* owner prefix such as "Name/Name: " */
  STRIP.forEach((n) => { s = s.replace(new RegExp("\\b" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(['’]s)?\\b", "gi"), ""); });
  s = s.replace(/^\s*[A-Z][a-zà-ÿ]+['’]s\s+/, "");                      /* a leading possessive name: "Someone's party" */
  s = s.replace(/\s{2,}/g, " ").replace(/^[\s,·\/-]+|[\s,·\/-]+$/g, "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
function who(t) { const m = /^([^:\n]{1,60}):/.exec(unesc(t)); if (!m) return "family"; const p = m[1].toLowerCase().split(/[\/,&]| and /).map((x) => x.trim()).filter(Boolean); if (p.length === 1 && p[0] === "all") return "all"; if (ME && p.length === 1 && p[0].startsWith(ME)) return "me"; return "family"; }
function place(l) { const s = unesc(l).split("\n")[0].replace(/^address:\s*/i, "").trim(); return s && s.length <= 40 && !/\d/.test(s) && !/^tbd$/i.test(s) ? s : undefined; }
function dt(v) { /* 20261113 or 20261113T100000 (local, TZID Europe/Paris) or ...Z */ const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?(Z?)/.exec(v || ""); if (!m) return null; if (m[6] === "Z") { const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0))); const loc = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" })); return { date: ymd(loc), time: pad(loc.getHours()) + ":" + pad(loc.getMinutes()) }; } return { date: m[1] + "-" + m[2] + "-" + m[3], time: m[4] ? m[4] + ":" + m[5] : null }; }
(async () => {
  const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : { items: [] };
  const today = ymd(new Date()), until = ymd(new Date(Date.now() + DAYS * 864e5));
  if (!URL_) { console.error("cozi: COZI_URL is not set; data/cozi.json left as it was"); process.exit(0); }
  let raw;
  try { raw = await get(URL_); } catch (e) {
    prev.stale = true; prev.errors = ["fetch: " + e.message]; prev.updated = today;
    fs.writeFileSync(out, JSON.stringify(prev, null, 1) + "\n"); console.log("cozi.json kept from " + (prev.fetched || "never") + " (" + e.message + ")"); return;
  }
  raw = raw.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const dropped = { recurring: 0, medical: 0, birthday: 0, empty: 0, outside: 0 }, items = [];
  raw.split("BEGIN:VEVENT").slice(1).forEach((block) => {
    const e = {}; block.split("END:VEVENT")[0].trim().split("\n").forEach((line) => { const i = line.indexOf(":"); if (i > 0) { const k = line.slice(0, i).split(";")[0]; if (!(k in e)) e[k] = line.slice(i + 1); } });
    if (e.RRULE) { dropped.recurring++; return; }
    const s = dt(e.DTSTART), en = dt(e.DTEND); if (!s) return;
    const allDay = !/T\d/.test(e.DTSTART || ""), endDate = en ? (allDay ? ymd(new Date(pd(en.date).getTime() - 864e5)) : en.date) : s.date;
    if (endDate < today || s.date > until) { dropped.outside++; return; }
    const text = unesc(e.SUMMARY) + " " + unesc(e.DESCRIPTION) + " " + unesc(e.LOCATION);
    if (BIRTHDAY.test(text)) { dropped.birthday++; return; }
    if (MEDICAL.test(text)) { dropped.medical++; return; }
    const t = clean(e.SUMMARY); if (!t) { dropped.empty++; return; }
    const it = { id: crypto.createHash("sha1").update(e.UID || (e.DTSTART + e.SUMMARY)).digest("hex").slice(0, 10), date: s.date, t: t, who: who(e.SUMMARY) };
    if (endDate > s.date) it.end = endDate;
    if (!allDay && s.time) it.time = s.time + (en && en.time && en.date === s.date ? "–" + en.time : "");
    const w = place(e.LOCATION); if (w) it.where = w;
    items.push(it);
  });
  function pd(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || "") < (b.time || "") ? -1 : 1));
  const data = { updated: today, fetched: today, stale: false, src: "Family Cozi calendar (read-only feed; link kept in the task prompt)", window: [today, until], dropped: dropped, items: items };
  fs.writeFileSync(out, JSON.stringify(data, null, 1) + "\n");
  console.log("cozi.json: " + items.length + " events to " + until + " · dropped " + Object.entries(dropped).map(([k, v]) => k + " " + v).join(", "));
})();
