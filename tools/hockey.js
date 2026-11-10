#!/usr/bin/env node
/* Refresh data/hockey.json from the NHL API: node tools/hockey.js
   Metropolitan standings, league skater and goalie leaders, Hurricanes club stats, and the Connor McDavid watch
   (season totals, points per game, 82-game projections and the game-by-game cumulative line). No dependencies. */
const fs = require("fs"), path = require("path"), https = require("https");
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = require("child_process").spawnSync(process.execPath, [__filename], { stdio: "inherit", env: Object.assign({}, process.env, { NODE_USE_ENV_PROXY: "1", NODE_NO_WARNINGS: "1" }) });
  process.exit(r.status == null ? 1 : r.status);
}
const out = path.join(__dirname, "..", "data", "hockey.json"), API = "https://api-web.nhle.com/v1/", MCDAVID = 8478402;
function once(url, hops) { hops = hops || 0; return new Promise((res, rej) => { const q = https.get(url, { headers: { "User-Agent": "readbook-run", Accept: "application/json" }, timeout: 30000 }, (r) => { if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location && hops < 4) { r.resume(); return res(once(new URL(r.headers.location, url).href, hops + 1)); } if (r.statusCode !== 200) { r.resume(); return rej(new Error("HTTP " + r.statusCode + " " + url.slice(0, 70))); } let b = ""; r.setEncoding("utf8"); r.on("data", (d) => (b += d)); r.on("end", () => res(b)); r.on("error", rej); }); q.on("timeout", () => q.destroy(new Error("timeout"))); q.on("error", rej); }); }
const get = (u) => once(u).catch(() => new Promise((r) => setTimeout(r, 3000)).then(() => once(u))).then(JSON.parse);
const name = (p) => ((p.firstName || {}).default || "") + " " + ((p.lastName || {}).default || "");
const r3 = (v) => Math.round(v * 1000) / 1000, r2 = (v) => Math.round(v * 100) / 100;
(async () => {
  const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : {}, errors = [], data = Object.assign({}, prev);
  try {
    const s = await get(API + "standings/now");
    data.asof = (s.standings[0] || {}).date || null;
    data.metro = s.standings.filter((x) => x.divisionName === "Metropolitan").sort((a, b) => a.divisionSequence - b.divisionSequence).map((x) => ({ team: x.teamAbbrev.default, name: x.teamCommonName ? x.teamCommonName.default : x.teamName.default, gp: x.gamesPlayed, w: x.wins, l: x.losses, otl: x.otLosses, pts: x.points, pct: r3(x.pointPctg), gf: x.goalFor, ga: x.goalAgainst, gd: x.goalDifferential, rw: x.regulationWins, l10: x.l10Wins + "-" + x.l10Losses + "-" + x.l10OtLosses, streak: (x.streakCode || "") + (x.streakCount || ""), div: x.divisionSequence, wc: x.wildcardSequence, conf: x.conferenceSequence }));
    data.league = s.standings.filter((x) => x.leagueSequence <= 5).sort((a, b) => a.leagueSequence - b.leagueSequence).map((x) => ({ team: x.teamAbbrev.default, pts: x.points, gp: x.gamesPlayed }));
    const edm = s.standings.find((x) => x.teamAbbrev.default === "EDM"); data._edmGp = edm ? edm.gamesPlayed : null;
  } catch (e) { errors.push("standings: " + e.message); }
  try {
    const L = await get(API + "skater-stats-leaders/current?categories=points,goals,assists&limit=10"), G = await get(API + "goalie-stats-leaders/current?categories=savePctg,wins,goalsAgainstAverage&limit=5");
    const sk = (arr) => (arr || []).map((p) => ({ name: name(p).trim(), team: p.teamAbbrev, pos: p.position, v: p.value }));
    data.leaders = { points: sk(L.points), goals: sk(L.goals), assists: sk(L.assists), savePctg: sk(G.savePctg).map((x) => ({ name: x.name, team: x.team, v: r3(x.v) })), wins: sk(G.wins), gaa: sk(G.goalsAgainstAverage).map((x) => ({ name: x.name, team: x.team, v: r2(x.v) })) };
  } catch (e) { errors.push("leaders: " + e.message); }
  try {
    const C = await get(API + "club-stats/CAR/now");
    data.canes = { skaters: C.skaters.map((x) => ({ name: name(x).trim(), pos: x.positionCode, gp: x.gamesPlayed, g: x.goals, a: x.assists, p: x.points, pm: x.plusMinus, ppg: x.powerPlayGoals, shots: x.shots, toi: x.avgTimeOnIcePerGame })).sort((a, b) => b.p - a.p || b.g - a.g).slice(0, 10), goalies: C.goalies.map((g) => ({ name: name(g).trim(), gp: g.gamesPlayed, w: g.wins, l: g.losses, otl: g.overtimeLosses, svp: r3(g.savePercentage), gaa: r2(g.goalsAgainstAverage), so: g.shutouts })).sort((a, b) => b.gp - a.gp) };
  } catch (e) { errors.push("canes: " + e.message); }
  try {
    const M = await get(API + "player/" + MCDAVID + "/landing"), GL = await get(API + "player/" + MCDAVID + "/game-log/now");
    const ss = ((M.featuredStats || {}).regularSeason || {}).subSeason || {}, log = (GL.gameLog || []).slice().sort((a, b) => (a.gameDate < b.gameDate ? -1 : 1));
    let cg = 0, ca = 0, cp = 0; const hist = log.map((g, i) => { cg += g.goals; ca += g.assists; cp += g.points; return [g.gameDate, i + 1, cg, ca, cp, g.opponentAbbrev, g.points]; });
    const gp = ss.gamesPlayed || log.length, p = ss.points || cp, g = ss.goals || cg, a = ss.assists || ca, ppg = gp ? p / gp : 0, teamGp = data._edmGp || gp;
    const last10 = log.slice(-10), l10p = last10.reduce((s, x) => s + x.points, 0);
    data.mcdavid = { id: MCDAVID, name: "Connor McDavid", team: M.currentTeamAbbrev || "EDM", number: M.sweaterNumber, season: GL.seasonId || (M.featuredStats || {}).season, gp: gp, teamGp: teamGp, g: g, a: a, p: p, ppg: r2(ppg), gpg: r2(gp ? g / gp : 0), apg: r2(gp ? a / gp : 0), plusMinus: ss.plusMinus, ppp: ss.powerPlayPoints, shots: ss.shots, shootingPctg: ss.shootingPctg != null ? r3(ss.shootingPctg) : null, l10: { gp: last10.length, p: l10p, ppg: last10.length ? r2(l10p / last10.length) : null }, pace82: { g: Math.round(gp ? g / gp * 82 : 0), a: Math.round(gp ? a / gp * 82 : 0), p: Math.round(gp ? p / gp * 82 : 0) }, remaining: { g: Math.round(g + (gp ? g / gp : 0) * (82 - teamGp)), a: Math.round(a + (gp ? a / gp : 0) * (82 - teamGp)), p: Math.round(p + ppg * (82 - teamGp)), note: "today's totals plus his per-game rate over the Oilers' " + (82 - teamGp) + " remaining games" }, marks: { own: { p: 153, season: "2022–23" }, gretzky: { p: 215, season: "1985–86" }, goals50: 50, points100: 100 }, history: hist, src: [["NHL API, player landing and game log", "https://api-web.nhle.com/v1/player/" + MCDAVID + "/landing"]] };
  } catch (e) { errors.push("mcdavid: " + e.message); }
  delete data._edmGp;
  data.updated = new Date().toISOString().slice(0, 10); data.errors = errors;
  data.src = [["NHL API: standings, stats leaders, club stats", "https://api-web.nhle.com/v1/standings/now"]];
  data.note = "Written by tools/hockey.js every run. Metropolitan standings, league leaders, Hurricanes club stats and the McDavid watch; pace82 is the straight 82-game pace, remaining adds his per-game rate over the Oilers' games left.";
  fs.writeFileSync(out, JSON.stringify(data, null, 1));
  console.log("hockey.json refreshed as of " + data.asof + (errors.length ? "; failed: " + errors.join(" | ") : "") + (data.mcdavid ? " · McDavid " + data.mcdavid.p + " pts in " + data.mcdavid.gp + ", pace " + data.mcdavid.pace82.p : ""));
  if (errors.length >= 3) process.exit(1);
})().catch((e) => { console.error("hockey.js: " + e.message); process.exit(1); });
