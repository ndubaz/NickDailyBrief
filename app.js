/* Nick's Daily Readbook v5.0 renderer.
   Reads data/index.json, then data/editions/<date>.json, plus the standing files:
   incidents, bins, threads, horizon, fx, series, canes, conflicts, world-series, calendar, deadlines, congress, exercises, releases, events, idioms, ski, search-index.
   All content lives in the JSON files; this file only draws it. Editions in the 2.5 and 3.0 formats still render.
   Everything renders expanded; nothing is folded by default. */
(function () {
  "use strict";
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var CAT = { nl:["Netherlands","--c-nl"], be:["Belgium","--c-be"], de:["Germany","--c-de"], us:["US / AFNORTH","--c-us"], mkt:["Markets & events","--c-mkt"], pro:["Work & world","--c-pro"],
              hockey:["Hurricanes","--p-hockey"], home:["Bins & home","--p-home"], school:["School breaks","--p-pro"], watch:["Horizon","--p-watch"], deadline:["Deadlines","--crit"], info:["Clocks","--muted"], out:["Out and about","--c-mkt"], ex:["Exercises","--p-pro"] };
  var CODE_COLORS = { CYB:"--c-us", SAB:"--crit", UAS:"--c-mkt", UWI:"--c-pro", GNSS:"--c-be", INF:"--c-nl", ELX:"--c-nl", MIG:"--c-de", PRX:"--warn", AIR:"--c-de", SEA:"--c-pro", COE:"--c-be", KIN:"--crit" };
  var PART_CLASSES = ["front","world","sec","watch","pro","frontier","money","home","hockey","plan"];
  var PARTS = [["front","Front","#front"],["world","The World","#p-world"],["sec","Security","#p-sec"],["watch","Watchlist","#p-watch"],["pro","Profession","#p-pro"],["frontier","Frontier","#p-frontier"],["money","Money","#p-money"],["home","Home","#p-home"],["hockey","Hockey","#p-hockey"],["plan","Planner","#p-plan"]];
  var EVCAT = { music:"Music", markets:"Markets", museums:"Museums", sport:"Sport", kids:"Kids", food:"Food", outdoors:"Outdoors", festival:"Festivals" };
  var SERIES_BY_LABEL = [["s&p 500","spx"],["nasdaq","ndx"],["aex","aex"],["brent","brent"],["dutch ttf","ttf"],["ttf","ttf"]];
  var HOME = { lat: 50.89, lon: 5.98, name: "Heerlen" };
  var app = document.getElementById("app");
  var DAY = 864e5;

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]; }); }
  function srcMap(list) { var m = {}; (list || []).forEach(function (s) { if (s && s.length >= 4) m[s[0]] = s; }); return m; }
  function citeLink(n, map) {
    if (map) { var s = map[n]; return s ? '<a href="' + esc(s[3]) + '" target="_blank" rel="noopener" title="' + esc(s[1] + " · " + s[2]) + '">' + n + "</a>" : "<span>" + n + "</span>"; }
    return '<a href="#s' + n + '">' + n + "</a>";
  }
  function rich(s, map) {
    var h = esc(s);
    h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, "$1<i>$2</i>");
    h = h.replace(/\s?\[(\d+(?:\s*,\s*\d+)*)\]/g, function (_, list) {
      return '<sup class="r">' + list.split(/\s*,\s*/).map(function (n) { return citeLink(n, map); }).join("") + "</sup>";
    });
    return h;
  }
  function plain(s) { return String(s || "").replace(/\*\*|\*/g, "").replace(/\s?\[\d+(?:\s*,\s*\d+)*\]/g, ""); }
  function cite(n) { return n ? '<sup class="r"><a href="#s' + n + '">' + n + "</a></sup>" : ""; }
  function pd(s) { var a = String(s).slice(0, 10).split("-").map(Number); return new Date(a[0], a[1] - 1, a[2]); }
  function key(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function fmt(d) { return DOW[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()]; }
  function fmtShort(s) { var d = pd(s); return d.getDate() + " " + MON[d.getMonth()]; }
  function fmtLong(s) { var d = pd(s); return d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear(); }
  function daysBetween(a, b) { return Math.round((pd(b) - pd(a)) / DAY); }
  function addDays(s, n) { var d = pd(s); d.setDate(d.getDate() + n); return key(d); }
  function badge(b) { if (!b) return ""; var u = b === "UPDATED"; return '<span class="badge ' + (u ? "upd" : "new") + '">' + esc(b) + "</span>"; }
  function fu(b) { return "fu" + (b ? " new" : ""); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function quiet(t, cls) { return '<p class="quiet' + (cls ? " " + cls : "") + '">' + esc(t || "No significant change today.") + "</p>"; }
  function nq() { return quiet("Nothing new or updated here today.", "nq"); }
  function getJSON(url) { return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); }); }
  function num(v, dp) { return (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
  function signed(v, dp, suffix) { return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp }) + (suffix || ""); }
  function dir(v) { return v > 0 ? "up" : v < 0 ? "down" : "flat"; }
  function km(lat1, lon1, lat2, lon2) { var R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180, a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2); return 2 * R * Math.asin(Math.sqrt(a)); }
  function catColor(c) { return "var(" + (CAT[c] ? CAT[c][1] : "--muted") + ")"; }
  function ordinal(n) { var s = ["th","st","nd","rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function cet(utc) { try { return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(utc)); } catch (e) { return ""; } }
  function cetDate(utc) { try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(utc)); } catch (e) { return String(utc).slice(0, 10); } }
  /* USD/EUR guard: any label written as EUR/USD with a dollars-per-euro value is shown inverted, as euros per dollar. */
  function fxGuard(label, value, change, d) {
    var v = parseFloat(String(value).replace(/[^\d.]/g, ""));
    if (/EUR\s*\/\s*USD/i.test(String(label)) && v > 1 && v < 2) {
      var pct = /%/.test(String(change || "")) ? parseFloat(String(change).replace(/[^\d.\-−+]/g, "").replace("−", "-")) : null;
      return { label: String(label).replace(/EUR\s*\/\s*USD/i, "USD/EUR"), value: (1 / v).toFixed(4), change: pct != null && !isNaN(pct) ? signed(-pct, 2, "%") : "", dir: d === "up" ? "down" : d === "down" ? "up" : d, fixed: true };
    }
    return { label: label, value: value, change: change, dir: d, fixed: false };
  }

  function item(it, opts) {
    opts = opts || {};
    var h = '<div class="item ' + fu(it.badge) + '">';
    h += "<h4>" + rich(it.h) + badge(it.badge) + (opts.inlineTag && it.tag ? ' <span class="tag">' + esc(it.tag) + "</span>" : "") + "</h4>";
    if (!opts.inlineTag && (it.tag || it.conf)) h += "<div>" + (it.tag ? '<span class="tag">' + esc(it.tag) + "</span>" : "") + (it.conf ? '<span class="conf">confidence: ' + esc(it.conf) + "</span>" : "") + "</div>";
    if (it.body) h += "<p>" + rich(it.body) + "</p>";
    if (it.sw) h += '<p class="sw-line"><b class="l">So what</b>' + rich(it.sw) + "</p>";
    if (it.fy) h += '<p class="sw-line"><b class="l">For you</b>' + rich(it.fy) + "</p>";
    return h + "</div>";
  }
  function items(list, opts, q) { return list && list.length ? '<div class="fug">' + nq() + list.map(function (i) { return item(i, opts); }).join("") + "</div>" : quiet(q); }
  function part(cls, n, title, desc, id) {
    var prev = PARTS[Math.max(0, PARTS.map(function (p) { return p[0]; }).indexOf(cls) - 1)];
    return (cls !== "front" && cls !== "world" ? nextLink(prev[0]) : "") + '<div class="part ' + cls + '" id="' + id + '" data-part="' + esc(title) + '"><span class="pn">' + esc(n) + '</span><span class="pt">' + esc(title) + '</span>' + (desc ? '<span class="pd">' + esc(desc) + "</span>" : "") + "</div>";
  }
  function table(head, rows, cls) {
    var i = 0;
    rows = rows.replace(/<tr([^>]*)>|<td([^>]*)>/g, function (m, tr, td) { if (tr !== undefined) { i = 0; return m; } var th = head[i] || ""; i++; return "<td" + (td || "") + ' data-th="' + esc(th) + '">'; });
    return '<div class="tw' + (head.length >= 3 ? " stack" : "") + '"><table' + (cls ? ' class="' + cls + '"' : "") + "><thead><tr>" + head.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows + "</tbody></table></div>";
  }
  function nextLink(cls) { var i = -1; PARTS.forEach(function (p, j) { if (p[0] === cls) i = j; }); var n = PARTS[i + 1]; return n ? '<a class="next ' + n[0] + '" href="' + n[2] + '">Next · ' + esc(n[1]) + ' →</a>' : ""; }
  function chartBox(id, h, cls) { return '<div class="chart' + (cls ? " " + cls : "") + '" id="' + id + '" style="min-height:' + h + 'px"></div>'; }
  function svgText(x, y, t, anchor, size, halo, fill) { return '<text x="' + x + '" y="' + y + '" font-size="' + (size || 10.5) + '" font-family="var(--f-mono)" fill="' + (fill || "var(--muted)") + '"' + (anchor ? ' text-anchor="' + anchor + '"' : "") + (halo ? ' stroke="var(--surface)" stroke-width="3" paint-order="stroke" stroke-linejoin="round"' : "") + ">" + esc(t) + "</text>"; }
  function tl(rows) {
    return '<div class="tl">' + rows.map(function (r) { return '<div class="tl-i' + (r[3] ? " h" : "") + '"><div class="d"><span>' + esc(fmtLong(r[0])) + '</span></div><p class="ink">' + rich(r[1], r[2] ? srcMap(r[2]) : null) + "</p></div>"; }).join("") + "</div>";
  }

  /* ---------- gantt ---------- */
  function gantt(g, today, opts) {
    opts = opts || {};
    var from = pd(g.from), to = pd(g.to), span = (to - from) / DAY;
    function pct(d) { return Math.max(0, Math.min(100, ((d - from) / DAY) / span * 100)); }
    var h = '<div class="g-axis"><div></div><div class="ticks">';
    (g.ticks || []).forEach(function (t) { var d = pd(t); h += '<span style="left:' + pct(d) + '%">' + d.getDate() + " " + MON[d.getMonth()] + (opts.year ? " " + String(d.getFullYear()).slice(2) : "") + "</span>"; });
    h += "</div></div>";
    var xmas = new Date(from.getFullYear(), 11, 25);
    g.rows.forEach(function (r) {
      h += '<div class="g-row' + (r.all ? " all" : "") + '"><div class="g-name">' + esc(r.name) + (r.sub ? "<small>" + esc(r.sub) + "</small>" : "") + '</div><div class="g-track">';
      r.segs.forEach(function (s) {
        var a = pd(s[0]), b = pd(s[1]); if (b < from || a > to) return;
        var w = Math.max(0.8, pct(new Date(+b + DAY)) - pct(a));
        h += '<div class="g-bar" title="' + esc(r.name + ": " + fmt(a) + " – " + fmt(b) + (s[2] ? " · " + s[2] : "")) + '" style="left:' + pct(a) + "%;width:" + w + "%;background:" + (r.all ? "var(--ink)" : catColor(r.color)) + '"></div>';
      });
      if (today >= from && today <= to) h += '<div class="g-today" style="left:' + pct(today) + '%"></div>';
      if (!opts.noXmas && xmas >= from && xmas <= to) h += '<div class="g-xmas" style="left:' + pct(xmas) + '%"></div>';
      h += "</div></div>";
    });
    return '<div class="gantt">' + h + "</div>";
  }

  /* ---------- charts ---------- */
  function niceTicks(lo, hi) {
    var range = hi - lo || 1, base = Math.pow(10, Math.floor(Math.log(range / 3) / Math.LN10)), mults = [1, 2, 2.5, 5, 10, 20, 25, 50], best = null;
    for (var i = 0; i < mults.length; i++) {
      var st = mults[i] * base, a = Math.ceil(lo / st - 1e-9) * st, t = [];
      for (var v = a; v <= hi + 1e-9; v += st) t.push(v);
      if (t.length >= 3 && t.length <= 4) return { ticks: t, step: st };
      if (t.length >= 3 && (!best || t.length < best.ticks.length)) best = { ticks: t, step: st };
    }
    return best ? { ticks: best.ticks.slice(0, 4), step: best.step } : { ticks: [lo, hi], step: range };
  }
  function tickFmt(v, step) { var d = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log(step) / Math.LN10)); return v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  /* generic line chart: series ascending [[date, value]], opts {W, days, avg, hi, lo, dec, label, zero} */
  function lineChart(series, o) {
    o = o || {};
    var view = o.days ? series.filter(function (p) { return p[0] > addDays(series[series.length - 1][0], -o.days); }) : series.slice();
    if (view.length < 2) return "";
    var W = Math.max(240, Math.round(o.W || 360)), H = o.H || 170, L = o.L || 48, R = 14, T = 14, B = 22, dec = o.dec == null ? 4 : o.dec;
    var vals = view.map(function (p) { return p[1]; }), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (o.avg != null) { lo = Math.min(lo, o.avg); hi = Math.max(hi, o.avg); }
    if (o.zero) lo = Math.min(lo, 0);
    var pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.05 || 1; lo -= pad; hi += pad;
    function X(i) { return L + i / (view.length - 1) * (W - L - R); }
    function Y(v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(o.label || "Line chart") + '">';
    var nt = niceTicks(lo, hi);
    nt.ticks.forEach(function (t) { var y = Y(t); s += '<line x1="' + L + '" y1="' + y.toFixed(1) + '" x2="' + (W - R) + '" y2="' + y.toFixed(1) + '" stroke="var(--line)" stroke-width="1"/>' + svgText(L - 6, y + 3.5, tickFmt(t, nt.step), "end", 10.5); });
    if (o.avg != null) { var ya = Y(o.avg); s += '<line x1="' + L + '" y1="' + ya.toFixed(1) + '" x2="' + (W - R) + '" y2="' + ya.toFixed(1) + '" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>' + svgText(W - R, ya - 4, (o.avgLabel || "avg ") + o.avg.toFixed(dec), "end", 10, true); }
    var pts = view.map(function (p, i) { return X(i).toFixed(1) + "," + Y(p[1]).toFixed(1); });
    s += '<path d="M' + pts.join(" L") + " L" + X(view.length - 1).toFixed(1) + "," + (H - B) + " L" + L + "," + (H - B) + ' Z" fill="var(--pc)" fill-opacity=".15"/>';
    s += '<polyline points="' + pts.join(" ") + '" fill="none" stroke="var(--pc)" stroke-width="1.5" stroke-linejoin="round"/>';
    [[o.hi, o.hiLabel || "high", -6], [o.lo, o.loLabel || "low", 13]].forEach(function (m) {
      if (!m[0]) return;
      var i = -1; view.forEach(function (p, j) { if (p[0] === m[0][0]) i = j; });
      if (i < 0) return;
      var x = X(i), y = Y(m[0][1]), anchor = i > view.length * 0.75 ? "end" : i < view.length * 0.25 ? "start" : "middle";
      var dy = m[2] < 0 ? (y < T + 14 ? 13 : -6) : (y > H - B - 16 ? -6 : 13);
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="var(--surface)" stroke="var(--pc)" stroke-width="1.5"/>' + svgText(x, y + dy, m[1] + " " + m[0][1].toFixed(dec), anchor, 10, true);
    });
    var li = view.length - 1, lx = X(li), ly = Y(view[li][1]);
    s += '<circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="5" fill="var(--pc)" fill-opacity=".25"/><circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="2.8" fill="var(--pc)"/>';
    var mid = Math.floor(view.length / 2);
    s += svgText(L, H - 6, fmtShort(view[0][0]), "start", 10.5) + svgText(X(mid), H - 6, fmtShort(view[mid][0]), "middle", 10.5) + svgText(W - R, H - 6, fmtShort(view[li][0]), "end", 10.5);
    return s + "</svg>";
  }
  function sparkline(series, W) {
    if (!series || series.length < 2) return "";
    W = Math.max(80, Math.round(W || 160)); var H = 36, P = 3, vals = series.map(function (p) { return p[1]; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), span = hi - lo || 1;
    function X(i) { return P + i / (series.length - 1) * (W - 2 * P); }
    function Y(v) { return P + (1 - (v - lo) / span) * (H - 2 * P); }
    var pts = series.map(function (p, i) { return X(i).toFixed(1) + "," + Y(p[1]).toFixed(1); });
    var last = series[series.length - 1], trend = last[1] >= series[0][1] ? "--up" : "--down";
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Trend from ' + esc(series[0][0]) + " to " + esc(last[0]) + '">';
    s += '<path d="M' + pts.join(" L") + " L" + X(series.length - 1).toFixed(1) + "," + (H - P) + " L" + X(0).toFixed(1) + "," + (H - P) + ' Z" fill="var(' + trend + ')" fill-opacity=".15"/>';
    s += '<polyline points="' + pts.join(" ") + '" fill="none" stroke="var(' + trend + ')" stroke-width="1.5" stroke-linejoin="round"/>';
    s += '<circle cx="' + X(series.length - 1).toFixed(1) + '" cy="' + Y(last[1]).toFixed(1) + '" r="2.5" fill="var(' + trend + ')"/>';
    return s + "</svg>";
  }
  function hbars(rows, opts) {
    opts = opts || {};
    if (!rows.length) return quiet(opts.empty || "No data.");
    var mx = Math.max.apply(null, rows.map(function (r) { return Math.abs(r[1]); })) || 1;
    return '<div class="hbars' + (opts.inner ? " inner" : "") + '">' + rows.map(function (r) { return '<div class="hbar"><span' + (opts.mono ? ' class="mono"' : "") + ">" + esc(r[0]) + '</span><span class="t"><i style="width:' + (Math.abs(r[1]) / mx * 100) + '%"></i></span><span class="v">' + esc(opts.fmt ? opts.fmt(r[1]) : r[1]) + "</span></div>"; }).join("") + (opts.foot ? '<p class="small" style="margin:2px 0 0">' + opts.foot + "</p>" : "") + "</div>";
  }
  /* vertical bars: rows [[label, value, sub?, highlight?]] */
  function vbars(rows, o) {
    o = o || {};
    if (!rows || !rows.length) return "";
    var W = Math.max(240, Math.round(o.W || 360)), H = o.H || 150, T = 18, B = 20, L = 6, R = 6, n = rows.length, bw = (W - L - R) / n;
    var mx = Math.max.apply(null, rows.map(function (r) { return r[1]; })) || 1, mn = Math.min.apply(null, rows.map(function (r) { return r[1]; }));
    var lo = o.zero ? 0 : Math.max(0, mn - (mx - mn) * 0.5), hi = mx;
    function Y(v) { return T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B); }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(o.label || "Bar chart") + '">';
    s += '<line x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B) + '" stroke="var(--line)" stroke-width="1"/>';
    rows.forEach(function (r, i) {
      var x = L + i * bw + bw * 0.15, w = bw * 0.7, y = Y(r[1]), hot = r[3];
      s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (H - B - y).toFixed(1) + '" fill="var(--pc)" fill-opacity="' + (hot ? ".9" : ".45") + '"><title>' + esc(r[0] + ": " + (o.fmt ? o.fmt(r[1]) : r[1])) + "</title></rect>";
      if (n <= 14) s += svgText(x + w / 2, y - 4, o.fmt ? o.fmt(r[1]) : String(r[1]), "middle", n > 10 ? 8.5 : 10) + svgText(x + w / 2, H - 6, r[0], "middle", n > 10 ? 9 : 10);
    });
    return s + "</svg>";
  }
  /* cumulative points line above paired goals-for and goals-against bars */
  function hockeyChart(games, W) {
    if (!games || games.length < 2) return "";
    W = Math.max(240, Math.round(W || 360)); var H1 = 110, H2 = 90, T = 14, B = 18, L = 30, R = 10, n = games.length, bw = (W - L - R) / n;
    var pts = 0, cum = games.map(function (g) { pts += g.res === "W" ? 2 : g.res === "L" ? 0 : 1; return pts; });
    var maxP = Math.max(2 * n, pts), s = '<svg viewBox="0 0 ' + W + " " + (H1 + H2) + '" role="img" aria-label="Points by game and goals for and against">';
    function Y1(v) { return T + (1 - v / maxP) * (H1 - T - 6); }
    [0, Math.round(maxP / 2), maxP].forEach(function (t) { s += '<line x1="' + L + '" y1="' + Y1(t).toFixed(1) + '" x2="' + (W - R) + '" y2="' + Y1(t).toFixed(1) + '" stroke="var(--line)"/>' + svgText(L - 5, Y1(t) + 3.5, t, "end", 10); });
    var pace = games.map(function (g, i) { return (L + (i + 0.5) * bw).toFixed(1) + "," + Y1(2 * (i + 1)).toFixed(1); });
    s += '<polyline points="' + pace.join(" ") + '" fill="none" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>';
    var line = cum.map(function (p, i) { return (L + (i + 0.5) * bw).toFixed(1) + "," + Y1(p).toFixed(1); });
    s += '<polyline points="' + line.join(" ") + '" fill="none" stroke="var(--pc)" stroke-width="1.5" stroke-linejoin="round"/>';
    s += '<circle cx="' + (L + (n - 0.5) * bw).toFixed(1) + '" cy="' + Y1(pts).toFixed(1) + '" r="3" fill="var(--pc)"/>' + svgText(W - R, Y1(pts) - 6, pts + " pts", "end", 10, true) + svgText(L, 10, "points (dotted = 2 per game pace)", "start", 10);
    var mg = Math.max.apply(null, games.map(function (g) { return Math.max(g.gf, g.ga); })) || 1, base = H1 + H2 - B;
    function Y2(v) { return base - v / mg * (H2 - B - 10); }
    s += '<line x1="' + L + '" y1="' + base + '" x2="' + (W - R) + '" y2="' + base + '" stroke="var(--line)"/>' + svgText(L, H1 + 10, "goals for (solid) and against (outline)", "start", 10);
    games.forEach(function (g, i) {
      var x = L + i * bw + bw * 0.12, w = bw * 0.36;
      s += '<rect x="' + x.toFixed(1) + '" y="' + Y2(g.gf).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (base - Y2(g.gf)).toFixed(1) + '" fill="var(--pc)" fill-opacity=".85"><title>' + esc(fmtShort(g.date) + " " + (g.home ? "vs " : "at ") + g.opp + ": " + g.gf + "–" + g.ga + " " + g.res) + "</title></rect>";
      s += '<rect x="' + (x + w + 1).toFixed(1) + '" y="' + Y2(g.ga).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (base - Y2(g.ga)).toFixed(1) + '" fill="var(--pc)" fill-opacity=".15" stroke="var(--pc)" stroke-width="1"/>';
      if (n <= 20 || i % 5 === 0) s += svgText(x + w, H1 + H2 - 6, g.opp, "middle", n > 25 ? 8 : 9);
    });
    return s + "</svg>";
  }
  /* schematic world map for the board */
  function worldMap(theatres, counts, W) {
    W = Math.max(240, Math.round(W || 360)); var lon0 = -100, lon1 = 150, lat0 = -40, lat1 = 72, H = Math.round(W * (lat1 - lat0) / (lon1 - lon0) * 1.25);
    function X(lon) { return (lon - lon0) / (lon1 - lon0) * W; }
    function Y(lat) { return H - (lat - lat0) / (lat1 - lat0) * H; }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Schematic map of tracked theatres, sized by events logged in the last 7 days">';
    for (var lo = -90; lo <= 150; lo += 30) s += '<line x1="' + X(lo).toFixed(1) + '" y1="0" x2="' + X(lo).toFixed(1) + '" y2="' + H + '" stroke="var(--line)" stroke-width="1"/>';
    for (var la = -30; la <= 60; la += 30) s += '<line x1="0" y1="' + Y(la).toFixed(1) + '" x2="' + W + '" y2="' + Y(la).toFixed(1) + '" stroke="var(--line)" stroke-width="' + (la === 0 ? 1.5 : 1) + '"/>';
    [["N. America", 45, -88], ["S. America", -22, -60], ["Europe", 64, 0], ["Africa", -14, 14], ["Asia", 46, 95], ["Pacific", 4, 140]].forEach(function (l) { s += svgText(X(l[2]), Y(l[1]), l[0], "middle", 10); });
    var hx = X(HOME.lon), hy = Y(HOME.lat);
    s += '<rect x="' + (hx - 3) + '" y="' + (hy - 3) + '" width="6" height="6" fill="var(--ink)" transform="rotate(45 ' + hx + " " + hy + ')"/>';
    theatres.forEach(function (t) {
      if (t.lat == null) return;
      var n = counts[t.id] || 0, r = n ? 5 + 3 * Math.sqrt(n) : 4, x = X(t.lon), y = Y(t.lat);
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="var(--pc)" fill-opacity="' + (n ? ".75" : ".2") + '" stroke="var(--pc)" stroke-width="1.5"><title>' + esc(t.name + ": " + n + " logged in 7 days") + "</title></circle>";
      var lp = t.lp || "below", lx = lp === "right" ? x + r + 4 : lp === "left" ? x - r - 4 : x, ly = lp === "above" ? y - r - 4 : lp === "below" ? y + r + 11 : y + 3.5;
      s += svgText(lx, ly, t.short || t.name, lp === "right" ? "start" : lp === "left" ? "end" : "middle", 10, true, "var(--ink)");
      if (n) s += svgText(x, y + 3.5, n, "middle", 10, false, "var(--bg)");
    });
    return s + "</svg>";
  }
  /* geography schematic from an edition feature: geo {bbox:[lon0,lat0,lon1,lat1], points:[{n,lat,lon,k,align}], lines:[{a:[lat,lon], b:[lat,lon], t, solid}], labels:[{t,lat,lon}]} */
  function geoSchematic(geo, W) {
    if (!geo || !geo.bbox) return "";
    W = Math.max(240, Math.round(W || 360));
    var lon0 = geo.bbox[0], lat0 = geo.bbox[1], lon1 = geo.bbox[2], lat1 = geo.bbox[3], mid = (lat0 + lat1) / 2 * Math.PI / 180;
    var H = Math.round(W * (lat1 - lat0) / ((lon1 - lon0) * Math.cos(mid)));
    H = Math.max(140, Math.min(H, Math.round(W * 1.2)));
    function X(lon) { return (lon - lon0) / (lon1 - lon0) * W; }
    function Y(lat) { return H - (lat - lat0) / (lat1 - lat0) * H; }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(geo.title || "Schematic") + '">';
    var step = (lon1 - lon0) > 10 ? 5 : (lon1 - lon0) > 3 ? 1 : 0.5;
    for (var lo = Math.ceil(lon0 / step) * step; lo <= lon1; lo += step) s += '<line x1="' + X(lo).toFixed(1) + '" y1="0" x2="' + X(lo).toFixed(1) + '" y2="' + H + '" stroke="var(--line)" stroke-width="1"/>' + svgText(X(lo) + 2, H - 3, lo + "°", "start", 9);
    for (var la = Math.ceil(lat0 / step) * step; la <= lat1; la += step) s += '<line x1="0" y1="' + Y(la).toFixed(1) + '" x2="' + W + '" y2="' + Y(la).toFixed(1) + '" stroke="var(--line)" stroke-width="1"/>' + svgText(2, Y(la) - 2, la + "°", "start", 9);
    (geo.lines || []).forEach(function (l) {
      var x1 = X(l.a[1]), y1 = Y(l.a[0]), x2 = X(l.b[1]), y2 = Y(l.b[0]), t = l.t || Math.round(km(l.a[0], l.a[1], l.b[0], l.b[1])) + " km";
      s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="var(--pc)" stroke-width="1.5" stroke-dasharray="' + (l.solid ? "0" : "4 3") + '"/>' + svgText((x1 + x2) / 2, (y1 + y2) / 2 - 5, t, "middle", 10, true, "var(--ink)");
    });
    (geo.points || []).forEach(function (p) {
      var x = X(p.lon), y = Y(p.lat), k = p.k || "city";
      if (k === "base") s += '<rect x="' + (x - 4) + '" y="' + (y - 4) + '" width="8" height="8" fill="var(--crit)"/>';
      else if (k === "chokepoint") s += '<rect x="' + (x - 4.5) + '" y="' + (y - 4.5) + '" width="9" height="9" fill="var(--pc)" transform="rotate(45 ' + x + " " + y + ')"/>';
      else if (k === "port") s += '<circle cx="' + x + '" cy="' + y + '" r="4" fill="var(--surface)" stroke="var(--pc)" stroke-width="1.5"/>';
      else s += '<circle cx="' + x + '" cy="' + y + '" r="3.5" fill="var(--ink)"/>';
      s += svgText(x + (p.align === "left" ? -7 : 7), y + 3.5, p.n, p.align === "left" ? "end" : "start", 10, true, "var(--ink)");
    });
    (geo.labels || []).forEach(function (l) { s += svgText(X(l.lon), Y(l.lat), l.t, "middle", 10, true); });
    s += "</svg>";
    return s + '<p class="small geo-key">● city · ■ base · ◆ chokepoint · ○ port · dashed line = distance</p>';
  }
  /* daylight curve for the year at the home latitude (declination approximation, a few minutes off at most) */
  function daylight(lat, todayKey, W) {
    W = Math.max(240, Math.round(W || 360)); var H = 140, T = 14, B = 22, L = 36, R = 10, year = pd(todayKey).getFullYear();
    function hours(doy) { var decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + doy) / 365), x = -Math.tan(lat * Math.PI / 180) * Math.tan(decl); x = Math.max(-1, Math.min(1, x)); return 24 / Math.PI * Math.acos(x); }
    var pts = [], jan1 = new Date(year, 0, 1), ndays = Math.round((new Date(year + 1, 0, 1) - jan1) / DAY), mn = 24, mx = 0;
    for (var d = 1; d <= ndays; d++) { var h = hours(d); pts.push(h); mn = Math.min(mn, h); mx = Math.max(mx, h); }
    var lo = Math.floor(mn) - 1, hi = Math.ceil(mx) + 1;
    function X(d) { return L + (d - 1) / (ndays - 1) * (W - L - R); }
    function Y(h) { return T + (1 - (h - lo) / (hi - lo)) * (H - T - B); }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Hours of daylight through the year">';
    for (var t = lo + 1; t < hi; t += 4) s += '<line x1="' + L + '" y1="' + Y(t).toFixed(1) + '" x2="' + (W - R) + '" y2="' + Y(t).toFixed(1) + '" stroke="var(--line)"/>' + svgText(L - 5, Y(t) + 3.5, t + " h", "end", 10);
    var path = pts.map(function (h, i) { return X(i + 1).toFixed(1) + "," + Y(h).toFixed(1); });
    s += '<path d="M' + path.join(" L") + " L" + X(ndays).toFixed(1) + "," + (H - B) + " L" + L + "," + (H - B) + ' Z" fill="var(--pc)" fill-opacity=".15"/><polyline points="' + path.join(" ") + '" fill="none" stroke="var(--pc)" stroke-width="1.5"/>';
    for (var m = 0; m < 12; m++) { var dm = Math.round((new Date(year, m, 1) - jan1) / DAY) + 1; s += svgText(X(dm) + 2, H - 7, MON[m].charAt(0), "start", 9); }
    var doy = Math.round((pd(todayKey) - jan1) / DAY) + 1, th = pts[doy - 1], tx = X(doy), ty = Y(th), hh = Math.floor(th), mm = Math.round((th - hh) * 60);
    s += '<line x1="' + tx.toFixed(1) + '" y1="' + T + '" x2="' + tx.toFixed(1) + '" y2="' + (H - B) + '" stroke="var(--crit)" stroke-width="1" stroke-dasharray="2 2"/><circle cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="3.5" fill="var(--crit)"/>' + svgText(tx + (doy > ndays * 0.7 ? -8 : 8), ty - 8, "today " + hh + " h " + String(mm).padStart(2, "0") + " min", doy > ndays * 0.7 ? "end" : "start", 10.5, true, "var(--ink)");
    var minD = pts.indexOf(mn) + 1, maxD = pts.indexOf(mx) + 1;
    s += svgText(X(maxD), Y(mx) - 5, "longest " + mx.toFixed(1) + " h", "middle", 10, true) + svgText(X(minD) + (minD > ndays * 0.7 ? -6 : 6), Y(mn) - 5, "shortest " + mn.toFixed(1) + " h", minD > ndays * 0.7 ? "end" : "start", 10, true);
    return s + "</svg>";
  }
  function incidentMap(list, W) {
    W = Math.max(240, Math.round(W || 360)); var H = Math.round(W * 2 / 3), lon0 = -4, lon1 = 32, lat0 = 46, lat1 = 61;
    function X(lon) { return (lon - lon0) / (lon1 - lon0) * W; }
    function Y(lat) { return H - (lat - lat0) / (lat1 - lat0) * H; }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Schematic map of incidents in the last 30 days">';
    for (var lo = 0; lo <= 30; lo += 10) s += '<line x1="' + X(lo) + '" y1="0" x2="' + X(lo) + '" y2="' + H + '" stroke="var(--line)" stroke-width="1"/>';
    for (var la = 48; la <= 60; la += 4) s += '<line x1="0" y1="' + Y(la) + '" x2="' + W + '" y2="' + Y(la) + '" stroke="var(--line)" stroke-width="1"/>';
    var labels = [["NL",52.4,5.4],["BE",50.6,4.4],["LU",49.7,6.1],["DE",51.6,11.6],["PL",52.0,19.4],["CZ",49.8,15.5],["DK",56.1,9.3],["SE",59.3,15.2],["FI",60.3,25.5],["EE",58.7,25.8],["LV",56.9,24.9],["LT",55.4,23.9],["RU",54.6,21.0],["BY",53.6,28.0],["UA",49.2,30.5],["FR",47.6,2.4],["UK",52.6,-1.5],["AT",47.5,14.2]];
    labels.forEach(function (l) { s += svgText(X(l[2]), Y(l[1]), l[0], "middle", 10); });
    var hx = X(HOME.lon), hy = Y(HOME.lat);
    s += '<circle cx="' + hx + '" cy="' + hy + '" r="14.3" fill="none" stroke="var(--crit)" stroke-width="1.5" stroke-dasharray="3 3"/>';
    s += '<rect x="' + (hx - 3) + '" y="' + (hy - 3) + '" width="6" height="6" fill="var(--ink)" transform="rotate(45 ' + hx + " " + hy + ')"/>';
    var groups = {};
    list.forEach(function (i) { if (i.lat == null) return; var k = i.lat.toFixed(1) + "," + i.lon.toFixed(1); (groups[k] = groups[k] || { lat: i.lat, lon: i.lon, n: 0, codes: [] }); groups[k].n++; groups[k].codes.push(i.code); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k]; if (g.lon < lon0 || g.lon > lon1 || g.lat < lat0 || g.lat > lat1) return;
      var c = CODE_COLORS[g.codes[0]] || "--crit";
      s += '<circle cx="' + X(g.lon) + '" cy="' + Y(g.lat) + '" r="' + (4 + 3 * Math.sqrt(g.n)) + '" fill="var(' + c + ')" fill-opacity=".75" stroke="var(--surface)" stroke-width="1.5"><title>' + esc(g.codes.join(", ")) + "</title></circle>";
    });
    s += '<text x="' + (hx + 18) + '" y="' + (hy + 4) + '" font-size="10" font-family="var(--f-mono)" fill="var(--ink)">' + esc(HOME.name) + ' · 100 km</text>';
    return s + "</svg>";
  }
  function incidentTrend(list, endDate, W) {
    W = Math.max(240, Math.round(W || 360));
    var days = [], byCode = {}, i;
    for (i = 29; i >= 0; i--) { var d = new Date(endDate); d.setDate(d.getDate() - i); days.push({ k: key(d), n: 0 }); }
    var idx = {}; days.forEach(function (d, j) { idx[d.k] = j; });
    list.forEach(function (x) { if (idx[x.date] != null) { days[idx[x.date]].n++; byCode[x.code] = (byCode[x.code] || 0) + 1; } });
    var max = Math.max(1, Math.max.apply(null, days.map(function (d) { return d.n; })));
    var H = 90, T = 14, bw = W / 30;
    var s = '<svg viewBox="0 0 ' + W + " " + (H + T + 16) + '" role="img" aria-label="Incidents per day, last 30 days">';
    s += '<line x1="0" y1="' + (H + T) + '" x2="' + W + '" y2="' + (H + T) + '" stroke="var(--line)" stroke-width="1"/>';
    days.forEach(function (d, j) { var h = d.n / max * (H - 4); if (d.n) s += '<rect x="' + (j * bw + 1) + '" y="' + (H + T - h) + '" width="' + (bw - 2) + '" height="' + h + '" fill="var(--pc)" fill-opacity=".85"><title>' + d.k + ": " + d.n + "</title></rect>"; });
    s += svgText(2, H + T + 13, days[0].k.slice(5)) + svgText(W - 2, H + T + 13, days[29].k.slice(5), "end") + svgText(W - 2, 10, "max " + max + "/day", "end") + "</svg>";
    var codes = Object.keys(byCode).sort(function (a, b) { return byCode[b] - byCode[a]; });
    return s + hbars(codes.map(function (c) { return [c, byCode[c]]; }), { inner: true, mono: true, empty: "No incidents logged yet." });
  }

  var ICON = {
    rising: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2 L13 11 L1 11 Z" fill="currentColor"/></svg>',
    falling: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 12 L13 3 L1 3 Z" fill="currentColor"/></svg>',
    steady: '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="5.5" width="12" height="3" fill="currentColor"/></svg>',
    watch: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="7" r="1.8" fill="currentColor"/></svg>',
    nodata: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/></svg>'
  };
  var STLBL = { rising: "Rising", falling: "Falling", steady: "Steady", watch: "Watch", nodata: "No data" };

  /* ---------- standing data views ---------- */
  function fxStats(series, asOf) {
    /* fx.json stores the ECB rate as US dollars per euro; the page shows euros per dollar, so up means the dollar buys more euros. */
    var s = series.filter(function (p) { return p[0] <= asOf && typeof p[1] === "number" && p[1] > 0; }).map(function (p) { return [p[0], 1 / p[1]]; });
    if (s.length < 2) return null;
    var last = s[s.length - 1], prev = s[s.length - 2];
    function at(daysBack) { var k = addDays(last[0], -daysBack), v = null; s.forEach(function (p) { if (p[0] <= k) v = p; }); return v; }
    var m = at(30), yearFrom = addDays(last[0], -365), year = s.filter(function (p) { return p[0] > yearFrom; }), last30 = s.filter(function (p) { return p[0] > addDays(last[0], -30); });
    var avg = year.reduce(function (a, p) { return a + p[1]; }, 0) / year.length;
    var hi30 = last30.reduce(function (a, p) { return !a || p[1] > a[1] ? p : a; }, null), lo30 = last30.reduce(function (a, p) { return !a || p[1] < a[1] ? p : a; }, null);
    var best = year.reduce(function (a, p) { return !a || p[1] > a[1] ? p : a; }, null), worst = year.reduce(function (a, p) { return !a || p[1] < a[1] ? p : a; }, null);
    var months = {}; year.forEach(function (p) { var k = p[0].slice(0, 7); (months[k] = months[k] || []).push(p[1]); });
    var pay = Object.keys(months).sort().slice(-12).map(function (k) { var a = months[k], avgm = a.reduce(function (x, y) { return x + y; }, 0) / a.length; return [MON[parseInt(k.slice(5), 10) - 1], Math.round(1000 * avgm), k]; });
    return { series: s, last: last, prev: prev, month: m, d1: last[1] - prev[1], d30: m ? last[1] - m[1] : null, avg: avg, hi30: hi30, lo30: lo30, best: best, worst: worst, pay: pay };
  }
  function threadView(list, today) {
    var out = [];
    (list || []).forEach(function (t) {
      var log = (t.log || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      if (!log.length) return;
      var last = log[log.length - 1], age = daysBetween(last.date, today), status = t.status || "moving";
      if (status === "resolved" && age > 7) return;
      if (status !== "resolved" && age > 30) status = "quiet";
      out.push({ t: t, log: log, last: last, age: age, status: status, badge: age === 0 ? "NEW" : age === 1 ? "UPDATED" : "" });
    });
    out.sort(function (a, b) { return a.last.date < b.last.date ? 1 : a.last.date > b.last.date ? -1 : 0; });
    return out;
  }
  function logList(log, cls) { return '<div class="' + (cls || "tlog") + '">' + log.slice().reverse().map(function (e) { return '<div class="e"><span class="d">' + esc(fmtLong(e.date)) + "</span><p>" + rich(e.t, srcMap(e.src)) + "</p></div>"; }).join("") + "</div>"; }
  function renderThreads(view) {
    if (!view.length) return quiet("No threads are open.");
    return '<div class="fug">' + nq() + view.map(function (v) {
      var h = '<details class="thread ' + fu(v.badge) + '" id="thread-' + esc(v.t.id) + '" open><summary><span class="tname">' + esc(v.t.name) + '<span class="chip st ' + v.status + '">' + v.status + "</span>" + badge(v.badge) + '</span><span class="tlast"><span class="d">' + esc(fmtShort(v.last.date)) + "</span>" + rich(v.last.t, srcMap(v.last.src)) + "</span></summary>";
      h += '<div class="tlog">' + (v.log.length > 1 ? logList(v.log.slice(0, -1), "sub") : "") + '<div class="meta">Opened ' + esc(v.t.opened ? fmtLong(v.t.opened) : "—") + " · " + v.log.length + (v.log.length === 1 ? " entry" : " entries") + (v.status === "quiet" ? " · quiet: nothing logged for " + v.age + " days" : "") + "</div></div></details>";
      return h;
    }).join("") + "</div>";
  }
  function relDay(n) { return n === 0 ? "today" : n === 1 ? "tomorrow" : "in " + n + " days"; }
  function renderHorizon(events, today) {
    var list = (events || []).filter(function (e) { return e.date && e.date >= today; }).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    if (!list.length) return quiet("Nothing dated on the horizon.");
    var groups = [["Next 14 days", []], ["15 to 90 days", []], ["Beyond 90 days", []]];
    list.forEach(function (e) { var n = daysBetween(today, e.date); groups[n <= 14 ? 0 : n <= 90 ? 1 : 2][1].push(e); });
    var h = '<div class="fug">' + nq();
    groups.forEach(function (g) {
      if (!g[1].length) return;
      h += '<div class="tl-group">' + esc(g[0]) + '</div><div class="tl">' + g[1].map(function (e) {
        var n = daysBetween(today, e.date), b = e.added === today ? "NEW" : e.updated === today ? "UPDATED" : "";
        return '<div class="tl-i ' + fu(b) + (e.h ? " h" : "") + '" id="hz-' + esc(e.id) + '"><div class="d"><span>' + esc(e.dateText || fmtShort(e.date)) + '</span><span class="rel">' + relDay(n) + "</span>" + (e.status === "reported" ? '<span class="chip rep">reported</span>' : "") + "</div><h4>" + esc(e.t) + "</h4>" + badge(b) + (e.n ? "<p>" + rich(e.n, srcMap(e.src)) + "</p>" : "") + "</div>";
      }).join("") + "</div>";
    });
    return h + "</div>";
  }
  function canesView(C, asOf) {
    if (!C || !C.games || !C.games.length) return null;
    var games = C.games.filter(function (g) { return g.date <= asOf; });
    if (!games.length) return null;
    var complete = games.length === C.games.length, w = 0, l = 0, o = 0;
    games.forEach(function (g) { if (g.res === "W") w++; else if (g.res === "L") l++; else o++; });
    var up = (C.upcoming || []).filter(function (g) { return g.date >= asOf; }).slice(0, 10);
    return { games: games, record: complete && C.record ? C.record : w + "-" + l + "-" + o, points: complete && C.points != null ? C.points : 2 * w + o, metro: complete ? C.metro : null, season: C.season, upcoming: up };
  }
  function boardView(theatres, today) {
    return (theatres || []).map(function (t) {
      var log = (t.log || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).filter(function (e) { return e.date <= today; });
      var last = log.length ? log[log.length - 1] : null, age = last ? daysBetween(last.date, today) : null;
      var weeks = [0, 0, 0, 0]; log.forEach(function (e) { var n = daysBetween(e.date, today); if (n >= 0 && n < 28) weeks[3 - Math.floor(n / 7)]++; });
      return { t: t, log: log, last: last, age: age, weeks: weeks, n7: weeks[3], badge: age === 0 ? "NEW" : age === 1 ? "UPDATED" : "" };
    }).sort(function (a, b) { var ad = a.last ? a.last.date : "", bd = b.last ? b.last.date : ""; return ad < bd ? 1 : ad > bd ? -1 : 0; });
  }
  function act4(weeks) { var mx = Math.max.apply(null, weeks) || 1; return '<span class="act4" title="Events logged per week, oldest to newest: ' + weeks.join(", ") + '">' + weeks.map(function (w) { return '<i style="height:' + (w ? 4 + w / mx * 12 : 2) + 'px"' + (w ? "" : ' class="z"') + "></i>"; }).join("") + "</span>"; }

  /* ---------- planner data: merge every dated source ---------- */
  function plannerEvents(E, ctx, TD) {
    var ev = [], P = E.planner || {};
    (P.events || []).forEach(function (e) { ev.push({ date: e[0], cat: e[1], t: e[2], sub: [e[3], e[4], e[5]].filter(Boolean).join(" · "), src: "edition" }); });
    ((ctx.bins && ctx.bins.dates) || []).forEach(function (b) { ev.push({ date: b[0], cat: "home", t: "Bin: " + b[1].split("·")[0].trim(), sub: b[1], src: "bins" }); });
    if (ctx.canes) {
      (ctx.canes.games || []).forEach(function (g) { ev.push({ date: g.date, cat: "hockey", t: "CAR " + g.res + " " + g.gf + "–" + g.ga + (g.home ? " vs " : " at ") + g.opp, sub: "Final", src: "canes" }); });
      (ctx.canes.upcoming || []).forEach(function (g) { var d = g.utc ? cetDate(g.utc) : g.date; ev.push({ date: d, cat: "hockey", t: "Canes " + (g.home ? "vs " : "at ") + g.opp, sub: g.utc ? "Puck drop " + cet(g.utc) + " CET" : "", src: "canes" }); });
    }
    (ctx.horizon || []).forEach(function (e) { if (e.date) ev.push({ date: e.date, cat: "watch", t: e.t, sub: (e.dateText || "") + (e.n ? " · " + plain(e.n) : ""), src: "horizon" }); });
    var cal = ctx.calendar;
    if (cal) {
      (cal.holidays || []).forEach(function (h) { ev.push({ date: h.date, cat: h.c === "info" ? "info" : h.c, t: h.n, sub: h.note || (CAT[h.c] ? CAT[h.c][0] : ""), src: "calendar" }); });
      Object.keys(cal.school || {}).forEach(function (k) {
        var sys = cal.school[k];
        (sys.segs || []).forEach(function (s) { ev.push({ date: s[0], end: s[1], cat: "school", t: sys.name + ": " + (s[2] || "break"), sub: fmtShort(s[0]) + " – " + fmtShort(s[1]), src: "calendar", sys: k }); });
        (sys.days || []).forEach(function (d) { ev.push({ date: d[0], cat: "school", t: sys.name + ": " + d[1], sub: "", src: "calendar", sys: k }); });
      });
      (cal.markets || []).forEach(function (m) { ev.push({ date: m[2], end: m[3], cat: "mkt", t: m[0] + " opens", sub: "to " + fmtShort(m[3]), src: "calendar" }); });
    }
    ((ctx.deadlines && ctx.deadlines.items) || []).forEach(function (d) { ev.push({ date: d.date, cat: "deadline", t: d.name, sub: d.note || d.cat || "", src: "deadlines" }); });
    (((E.army || {}).career || {}).dates || []).forEach(function (d) { ev.push({ date: d[0], cat: "pro", t: plain(d[1]), sub: "Career milestone", src: "edition" }); });
    (ctx.events || []).forEach(function (e) { if (e.from) ev.push({ date: e.from, end: e.to !== e.from ? e.to : undefined, cat: "out", t: e.t, sub: [e.town, e.drive != null ? "~" + e.drive + " min" : "", e.to !== e.from ? "to " + fmtShort(e.to) : ""].filter(Boolean).join(" · "), src: "events" }); });
    (ctx.congress || []).forEach(function (c) { if (c.deadline) ev.push({ date: c.deadline, cat: "pro", t: (c.title || c.post) + ": deadline", sub: c.next ? plain(c.next) : "Congress", src: "congress" }); });
    (ctx.exercises || []).forEach(function (x) { if (x.from) ev.push({ date: x.from, end: x.to !== x.from ? x.to : undefined, cat: "ex", t: x.name, sub: [x.lead, x.where].filter(Boolean).join(" · "), src: "exercises" }); });
    var seen = {};
    return ev.filter(function (e) { if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return false; var k = e.date + "|" + e.cat + "|" + e.t; if (seen[k]) return false; seen[k] = 1; return true; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  function onDay(ev, k) { return ev.filter(function (e) { return e.date === k || (e.end && e.date <= k && k <= e.end); }); }
  function calMonth(ev, y, m, TD, filter) {
    var from = new Date(y, m, 1), to = new Date(y, m + 1, 0), h = '<div class="cal">';
    ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(function (d) { h += '<div class="dow">' + d + "</div>"; });
    for (var i = 0; i < (from.getDay() + 6) % 7; i++) h += '<div class="day out"></div>';
    for (var d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      var k = key(d), list = onDay(ev, k).filter(function (e) { return filter(e.cat); }), spans = list.filter(function (e) { return e.end; }), dots = list.filter(function (e) { return !e.end; });
      h += '<div class="day' + (k === TD ? " today" : "") + (d.getDay() === 0 || d.getDay() === 6 ? " we" : "") + '"' + (list.length ? ' title="' + esc(list.map(function (e) { return e.t; }).join("\n")) + '"' : "") + '><div class="n"><b>' + d.getDate() + "</b></div>";
      if (spans.length) h += '<div class="spans">' + spans.map(function (e) { return '<i style="background:' + catColor(e.cat) + '"></i>'; }).join("") + "</div>";
      if (dots.length) h += '<div class="dots">' + dots.map(function (e) { return '<i style="background:' + catColor(e.cat) + '"></i>'; }).join("") + '</div><div class="lab">' + esc(dots.map(function (e) { return e.t; }).join(" · ")) + "</div>";
      h += "</div>";
    }
    h += "</div>";
    var ym = key(from).slice(0, 7), rows = ev.filter(function (e) { return e.date.slice(0, 7) === ym && filter(e.cat); }), lastW = null, body = "";
    rows.forEach(function (e) {
      var dd = pd(e.date), wk = key(new Date(dd.getFullYear(), dd.getMonth(), dd.getDate() - ((dd.getDay() + 6) % 7)));
      if (wk !== lastW) { lastW = wk; var we = addDays(wk, 6); body += '<tr class="wk"><td colspan="2">Week of ' + esc(fmtShort(wk)) + " – " + esc(fmtShort(we)) + "</td></tr>"; }
      body += '<tr class="' + (e.date === TD ? "soon" : e.date < TD ? "past" : "") + '"><td class="d"><span class="dot" style="background:' + catColor(e.cat) + '"></span>' + DOW[dd.getDay()] + " " + dd.getDate() + "</td><td><b>" + esc(e.t) + "</b>" + (e.sub ? '<div class="small">' + esc(e.sub) + "</div>" : "") + "</td></tr>";
    });
    h += '<div class="agenda">' + (rows.length ? table(["Date", "What"], body) : quiet("Nothing in this category this month.")) + "</div>";
    return h;
  }
  function weekStrip(ev, E, TD) {
    var T = E.today || {}, wx = {}; ((T.weather && T.weather.week) || []).forEach(function (w) { wx[w[0]] = w; });
    var h = '<div class="week scrollx"><div class="week-in">';
    for (var i = 0; i < 7; i++) {
      var k = addDays(TD, i), d = pd(k), list = onDay(ev, k), w = wx[k];
      h += '<div class="wday' + (i === 0 ? " today" : "") + '"><div class="wd"><b>' + DOW[d.getDay()] + "</b> " + d.getDate() + " " + MON[d.getMonth()] + "</div>";
      if (w) h += '<div class="wx"><span class="hi">' + esc(w[1]) + "°</span> / " + esc(w[2]) + "°" + (w[3] != null && w[3] !== "" ? ' <span class="rain">' + esc(w[3]) + "%</span>" : "") + (w[4] ? '<div class="small">' + esc(w[4]) + "</div>" : "") + "</div>";
      h += list.length ? list.slice(0, 7).map(function (e) { return '<div class="we"><i style="background:' + catColor(e.cat) + '"></i>' + esc(e.t) + "</div>"; }).join("") + (list.length > 7 ? '<div class="we small">+' + (list.length - 7) + " more</div>" : "") : '<div class="we none">—</div>';
      h += "</div>";
    }
    return h + "</div></div>";
  }
  function countdowns(ev, ctx, TD) {
    var tiles = [];
    function next(pred) { for (var i = 0; i < ev.length; i++) if (ev[i].date >= TD && pred(ev[i])) return ev[i]; return null; }
    function tile(lbl, e, alt) { if (!e) return; var n = daysBetween(TD, e.date); tiles.push('<div class="tile cd"><div class="lbl">' + esc(lbl) + '</div><div class="val">' + (n === 0 ? "Today" : n === 1 ? "Tomorrow" : n + " days") + "</div><p>" + esc((alt || e.t) + " · " + fmt(pd(e.date))) + "</p></div>"); }
    tile("Next bin day", next(function (e) { return e.cat === "home" && e.src === "bins"; }), null);
    var g = next(function (e) { return e.cat === "hockey" && e.src === "canes" && e.t.indexOf("Canes") === 0; }); if (g) tile("Next Canes game", g, g.t + (g.sub ? " · " + g.sub.replace("Puck drop ", "") : ""));
    tile("Next AFNORTH day off", next(function (e) { return e.cat === "school" && e.sys === "afnorth" && e.end; }), null);
    tile("Next school break", next(function (e) { return e.cat === "school" && e.sys === "afnorth" && e.end && daysBetween(e.date, e.end) > 1; }), null);
    tile("Next central bank", next(function (e) { return e.cat === "watch" && /ECB|Fed\b|FOMC|Federal Reserve|rate decision/i.test(e.t); }), null);
    var d = pd(TD), pay = null;
    for (var i = 0; i < 40 && !pay; i++) { var c = new Date(d); c.setDate(c.getDate() + i); if (c.getDate() === 1 || c.getDate() === 15) { while (c.getDay() === 0 || c.getDay() === 6) c.setDate(c.getDate() - 1); if (key(c) >= TD) pay = c; } }
    if (pay) { var n = daysBetween(TD, key(pay)); tiles.push('<div class="tile cd"><div class="lbl">Next payday</div><div class="val">' + (n === 0 ? "Today" : n === 1 ? "Tomorrow" : n + " days") + "</div><p>" + esc(fmt(pay) + " · 1st and 15th, or the Friday before") + "</p></div>"); }
    return '<div class="strip cds">' + tiles.join("") + "</div>";
  }
  function overlapRows(cal, TD) {
    var from = TD, to = addDays(TD, 365), rows = [], sets = [];
    Object.keys(cal.school || {}).forEach(function (k) { var s = cal.school[k], segs = (s.segs || []).filter(function (g) { return g[1] >= from && g[0] <= to; }); rows.push({ name: s.name, color: s.color, segs: segs }); sets.push(segs); });
    var all = [], d = pd(from), end = pd(to), cur = null;
    for (; d <= end; d.setDate(d.getDate() + 1)) {
      var k = key(d), off = sets.length && sets.every(function (segs) { return segs.some(function (g) { return g[0] <= k && k <= g[1]; }); });
      if (off && !cur) cur = [k, k]; else if (off) cur[1] = k; else if (cur) { all.push(cur); cur = null; }
    }
    if (cur) all.push(cur);
    rows.push({ name: "All systems off", sub: "family and neighbours", color: "us", all: true, segs: all });
    var ticks = []; for (var m = 0; m < 13; m++) { var t = new Date(pd(from).getFullYear(), pd(from).getMonth() + m + 1, 1); if (key(t) <= to) ticks.push(key(t)); }
    return { from: from, to: to, ticks: ticks, rows: rows, all: all };
  }

  /* ---------- health checks: when to remodel ---------- */
  var PAGE_V = "5.0";
  function health(E, ctx, TD, words) {
    var rows = [], realToday = key(new Date());
    function add(name, level, detail) { rows.push([name, level, detail]); }
    function lastDate(list, f) { var m = ""; (list || []).forEach(function (x) { var d = f(x); if (d && d > m) m = d; }); return m; }
    function age(d) { return d ? daysBetween(d, TD) : null; }
    function fresh(name, d, warn, act, what) { var a = age(d); if (a == null) add(name, "act", "no dated entry at all"); else add(name, a >= act ? "act" : a >= warn ? "watch" : "ok", (what || "last entry") + " " + fmtShort(d) + (a ? ", " + a + (a === 1 ? " day" : " days") + " ago" : ", today")); }
    /* format and cadence */
    var ev = parseFloat(E.v || "0"); add("Edition format", ev < parseFloat(PAGE_V) ? "act" : "ok", "edition " + (E.v || "?") + " on page " + PAGE_V + (ev < parseFloat(PAGE_V) ? ": the task prompt is behind the page" : ""));
    var lag = daysBetween(ctx.index.latest, realToday); add("Morning run", lag <= 0 ? "ok" : lag === 1 ? "watch" : "act", "latest edition " + fmtShort(ctx.index.latest) + (lag > 0 ? ", " + lag + " day" + (lag > 1 ? "s" : "") + " behind today" : ", today"));
    var mins = Math.round(words / 230); add("Read time", mins < 15 || mins > 45 ? "act" : mins < 24 || mins > 36 ? "watch" : "ok", "≈ " + mins + " min against a 30-minute budget");
    /* empty sections today and over the last week */
    var AR = E.army || {}, WO = Array.isArray(E.world) ? { items: E.world } : (E.world || {});
    var secs = [["World", (WO.items || []).length], ["World feature", WO.feature ? 1 : 0], ["Hybrid incidents", ((E.hybrid || {}).incidents || []).length], ["Europe", (E.europe || []).length], ["Euregio", (E.euregio || []).length], ["DoD", (AR.dod || []).length], ["Army", (AR.news || AR.items || []).length], ["Congress", (AR.congress || []).length], ["Career", ((AR.career || {}).items || []).length], ["NATO", ((E.nato || {}).items || []).length], ["Defence tech", ((E.deftech || {}).items || []).length], ["Frontier", ((E.frontier || {}).items || []).length], ["Netherlands", ((E.nl || {}).items || []).length], ["Out and about picks", ((E.offduty || {}).items || []).length], ["NHL news", ((E.hockey || {}).news || []).length]];
    var empty = secs.filter(function (x) { return !x[1]; }).map(function (x) { return x[0]; });
    add("Empty sections today", empty.length > 4 ? "act" : empty.length > 1 ? "watch" : "ok", empty.length ? empty.join(", ") : "none");
    var SI = ctx.searchIndex && ctx.searchIndex.editions ? ctx.searchIndex.editions.filter(function (b) { return b.date <= TD; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 7) : [];
    if (SI.length >= 3) {
      var groups = ["World", "Europe", "Euregio", "DoD", "Army", "Congress", "Career", "NATO", "Defence tech", "Frontier", "Netherlands", "Out and about", "NHL", "Taal"], dead = groups.filter(function (g) { return SI.every(function (b) { return !b.hits.some(function (h) { return h.w === g; }); }); });
      add("Quiet all week", dead.length > 2 ? "act" : dead.length ? "watch" : "ok", dead.length ? dead.join(", ") + " had no headline in the last " + SI.length + " editions: re-scope or drop" : "every section produced headlines in the last " + SI.length + " editions");
    } else add("Quiet all week", "watch", "needs three editions in the search index before it can judge");
    /* standing files */
    fresh("Conflict board", lastDate(ctx.conflicts, function (t) { return lastDate(t.log, function (e) { return e.date; }); }), 2, 4);
    var quietT = (ctx.conflicts || []).filter(function (t) { var d = lastDate(t.log, function (e) { return e.date; }); return !d || daysBetween(d, TD) > 30; }).map(function (t) { return t.short || t.name; });
    add("Theatres without an entry in 30 days", quietT.length > 5 ? "act" : quietT.length > 2 ? "watch" : "ok", quietT.length ? quietT.join(", ") : "none");
    fresh("Tracked threads", lastDate(ctx.threads, function (t) { return lastDate(t.log, function (e) { return e.date; }); }), 3, 7);
    var hz = (ctx.horizon || []).filter(function (e) { return e.date >= TD && daysBetween(TD, e.date) <= 14; }).length; add("Horizon, next 14 days", hz ? "ok" : "watch", hz + " dated event" + (hz === 1 ? "" : "s"));
    fresh("Incident log", lastDate(ctx.incidents, function (i) { return i.date; }), 7, 14, "last incident");
    fresh("USD/EUR series", ctx.fx && ctx.fx.series.length ? ctx.fx.series[ctx.fx.series.length - 1][0] : "", 4, 7, "last ECB day");
    var serOld = Object.keys(ctx.series || {}).filter(function (k) { return k[0] !== "_" && (ctx.series[k] || []).length && daysBetween(ctx.series[k][ctx.series[k].length - 1][0], TD) > 5; });
    add("Market series", serOld.length ? "act" : "ok", serOld.length ? "stale: " + serOld.join(", ") : "all five within 5 days");
    var WS = ctx.worldSeries || { meta: {}, series: {} }, wsRows = Object.keys(WS.series || {}).map(function (k) { var sr = WS.series[k] || [], m = (WS.meta || {})[k] || {}, last = sr.length ? sr[sr.length - 1][0] : null, lim = m.cadence === "weekly" ? 10 : 3; return [k, last, last ? daysBetween(last, TD) > lim : true]; });
    var wsBad = wsRows.filter(function (r) { return r[2]; }).map(function (r) { return r[0] + (r[1] ? " (" + fmtShort(r[1]) + ")" : " (empty)"); });
    add("World series", wsBad.length >= wsRows.length ? "act" : wsBad.length ? "watch" : "ok", wsBad.length ? "not kept up: " + wsBad.join(", ") : wsRows.length + " series current");
    if (ctx.canes) fresh("Canes results", ctx.canes.updated || lastDate(ctx.canes.games, function (g) { return g.date; }), 4, 8, "last game logged");
    var cgA = (ctx.congress || []).filter(function (c) { return !/^(enacted|confirmed|withdrawn|vetoed)$/.test(c.stage); }), cgStale = cgA.filter(function (c) { var d = c.dates || {}, last = [c.updated || "", c.added || ""].concat(Object.keys(d).map(function (k) { return d[k]; })).sort().pop(); return !last || daysBetween(last, TD) > 45; }).length, cgDl = cgA.filter(function (c) { return c.deadline && daysBetween(TD, c.deadline) >= 0 && daysBetween(TD, c.deadline) <= 14; }).length;
    var cwUnk = (ctx.congressWatch || []).filter(function (w) { return !w.holder; }).length;
    add("Congress tracker", !(ctx.congress || []).length ? "watch" : cgStale > 2 || cwUnk > 20 ? "act" : cgStale || cwUnk ? "watch" : "ok", cgA.length + " open" + (cwUnk ? ", " + cwUnk + " watched posts without a sourced holder" : "") + (cgDl ? ", " + cgDl + " deadline" + (cgDl > 1 ? "s" : "") + " within 14 days" : "") + (cgStale ? ", " + cgStale + " untouched for 45 days" : ""));
    var exUp = (ctx.exercises || []).filter(function (x) { return x.to >= TD; }).length; add("Exercise calendar", exUp ? "ok" : "watch", exUp + " announced");
    var rel = ((ctx.releases || {}).releases || []).filter(function (r) { return daysBetween(r.date, TD) <= 45 && r.date <= TD; }).length, sota = (ctx.releases || {}).sota || {};
    add("Frontier log", rel ? (sota.asof && daysBetween(sota.asof, TD) <= 10 ? "ok" : "watch") : "act", rel + " releases in 45 days; state-of-the-art table " + (sota.asof ? "as of " + fmtShort(sota.asof) : "never written"));
    var evLive = (ctx.events || []).filter(function (e) { return e.to >= TD; }).length; add("Events list", evLive < 6 ? "act" : evLive < 12 ? "watch" : "ok", evLive + " live events (aim for 20 to 40)");
    var ID = (ctx.idioms || []).filter(function (i) { return i.date <= TD; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }), idOK = ID.length && ID[0].date === TD, rot = ID.length > 1 && ID[0].lang === ID[1].lang;
    add("Idiom of the day", !ID.length ? "act" : idOK && !rot ? "ok" : "watch", ID.length ? (idOK ? "today's is " + ID[0].lang : "last one " + fmtShort(ID[0].date)) + (rot ? ", rotation broken (" + ID[0].lang + " twice)" : "") : "none");
    var SK = ctx.ski, md = TD.slice(5), inSeason = SK && SK.season && (md >= SK.season[0] || md <= SK.season[1]), skAsof = SK && SK.snow ? lastDate(Object.keys(SK.snow), function (k) { return SK.snow[k].asof; }) : "";
    add("Snow report", !inSeason ? "ok" : skAsof && daysBetween(skAsof, TD) <= 1 ? "ok" : "act", inSeason ? (skAsof ? "as of " + fmtShort(skAsof) : "no data") : "out of season (1 Dec to 31 Mar)" + (skAsof ? ", last fetch " + fmtShort(skAsof) : ""));
    var cal = ctx.calendar, covEnd = cal ? lastDate(Object.keys(cal.school || {}), function (k) { return lastDate(cal.school[k].segs, function (g) { return g[1]; }); }) : "", covMin = cal ? Object.keys(cal.school || {}).map(function (k) { return [cal.school[k].name, lastDate(cal.school[k].segs, function (g) { return g[1]; })]; }).sort(function (a, b) { return a[1] < b[1] ? -1 : 1; })[0] : null;
    add("School calendar coverage", !covMin ? "act" : daysBetween(TD, covMin[1]) < 60 ? "act" : daysBetween(TD, covMin[1]) < 120 ? "watch" : "ok", covMin ? "shortest: " + covMin[0] + " to " + fmtShort(covMin[1]) + " " + covMin[1].slice(0, 4) : "no calendar");
    var binLast = lastDate((ctx.bins || {}).dates, function (b) { return b[0]; }); add("Bin calendar", !binLast ? "act" : daysBetween(TD, binLast) < 14 ? "act" : daysBetween(TD, binLast) < 45 ? "watch" : "ok", binLast ? "loaded to " + fmtShort(binLast) : "not loaded");
    var dl = ((ctx.deadlines || {}).items || []).length; add("Deadlines", dl ? "ok" : "watch", dl ? dl + " listed" : "empty: add yours to data/deadlines.json");
    var siToday = ctx.searchIndex && ctx.searchIndex.editions && ctx.searchIndex.editions.some(function (b) { return b.date === TD; }); add("Search index", siToday ? "ok" : "watch", siToday ? "has today's edition" : "today's edition not indexed yet");
    return rows;
  }

  /* ---------- main render ---------- */
  function render(E, ctx) {
    var today = pd(E.date), TD = E.date, h = "";
    var T = E.today || {};
    var FX = ctx.fx && ctx.fx.series ? fxStats(ctx.fx.series, TD) : null;
    var threads = ctx.threads && ctx.threads.length ? threadView(ctx.threads, TD) : null;
    var horizonEvents = ctx.horizon && ctx.horizon.length ? ctx.horizon : null;
    var CV = canesView(ctx.canes, TD);
    var SER = ctx.series || {};
    var WS = ctx.worldSeries || { meta: {}, series: {} };
    var WO = Array.isArray(E.world) ? { items: E.world } : (E.world || {});
    var board = ctx.conflicts && ctx.conflicts.length ? boardView(ctx.conflicts, TD) : null;
    var PEV = plannerEvents(E, ctx, TD);
    ctx._pev = PEV; ctx._ws = {}; ctx._fser = null; ctx._geo = null;

    /* masthead */
    h += '<header class="mast"><div class="eyebrow">' + esc(E.place || "Hoensbroek · Parkstad Limburg") + "</div><h1>Nick's Daily Readbook</h1>";
    h += '<div class="date">' + esc(E.weekday + " " + today.getDate() + " " + MON[today.getMonth()] + " " + today.getFullYear()) + "</div>";
    h += '<div class="mast-meta"><span><b>Edition ' + esc(E.edition) + "</b></span><span>Look-back " + esc(E.lookback) + '</span><span id="readtime"></span></div>';
    h += '<div class="rule" aria-hidden="true">' + ["--p-world","--p-sec","--p-watch","--p-pro","--p-frontier","--p-money","--p-home","--p-hockey"].map(function (c) { return '<i style="background:var(' + c + ')"></i>'; }).join("") + "</div>";
    h += '<div class="status"><span id="status"></span><span class="theme" role="group" aria-label="Theme"><button type="button" data-theme="auto">Auto</button><button type="button" data-theme="light">Light</button><button type="button" data-theme="dark">Dark</button></span></div>';
    if (E.note) h += '<p class="note">' + rich(E.note) + "</p>";
    h += "</header>";

    /* slim header */
    h += '<div class="slim" id="slim"><div class="slim-row"><span class="cur" id="cur">Front</span>' +
      PARTS.map(function (p) { return '<a class="' + p[0] + '" data-p="' + p[0] + '" href="' + p[2] + '">' + esc(p[0] === "world" ? "World" : p[1]) + "</a>"; }).join("") + '<a href="#sources">Sources</a>' +
      '<button type="button" class="tg" id="newonly" aria-pressed="false" title="Show only items with a NEW or UPDATED badge">New only</button>' +
      '</div><div class="prog"><i id="prog"></i></div></div>';

    /* today strip */
    h += '<div class="strip" id="front" data-part="Front">';
    if (T.weather) { var w = T.weather; h += '<div class="tile"><div class="lbl">Weather · ' + esc(E.town || "Hoensbroek") + '</div><div class="val">' + esc(w.hi) + "° / " + esc(w.lo) + "°</div><p>" + esc(w.now) + ". " + esc(w.tomorrow) + ". Sun " + esc(w.sunrise) + "–" + esc(w.sunset) + "." + cite(w.src) + "</p></div>"; }
    if (T.canes) h += '<div class="tile hockey"><div class="lbl">Hurricanes</div><div class="val">' + esc(T.canes.line) + "</div><p>" + esc(T.canes.sub) + cite(T.canes.src) + "</p></div>";
    else if (CV) { var lg = CV.games[CV.games.length - 1]; h += '<div class="tile hockey"><div class="lbl">Hurricanes</div><div class="val">' + esc(lg.res + " " + lg.gf + "–" + lg.ga + (lg.home ? " vs " : " at ") + lg.opp) + "</div><p>" + esc(CV.record + " · " + CV.points + " pts") + "</p></div>"; }
    if (T.markets) h += '<div class="tile"><div class="lbl">Markets</div><div class="mini-mk">' + T.markets.map(function (m) { var g = fxGuard(m[0], m[1], null, m[2]); return "<span>" + esc(g.label) + '</span><span class="chg ' + esc(g.dir) + '">' + esc(g.value) + "</span>"; }).join("") + "</div></div>";
    if (FX) h += '<div class="tile money"><div class="lbl">USD/EUR · ECB</div><div class="val">' + FX.last[1].toFixed(4) + '</div><p><span class="chg ' + dir(FX.d1) + '">' + signed(FX.d1, 4) + " (" + signed(FX.d1 / FX.prev[1] * 100, 2, "%") + ")</span> vs " + esc(fmtShort(FX.prev[0])) + "</p></div>";
    h += '<div class="tile" id="bins"><div class="lbl">Bin day</div><div class="val">…</div><p></p></div>';
    h += '<button type="button" class="tile newcount" id="newcount" title="Show only new and updated items"><div class="lbl">This edition</div><div class="val"><span id="nnew">…</span><small id="nupd"></small></div><p>Tap to show only what changed</p></button>';
    h += "</div>";

    /* front: five things, pick, today and tomorrow */
    h += '<section class="front"><h2>Five things</h2><ol class="five">';
    (E.five || []).forEach(function (f) { h += '<li class="' + esc(f.part) + '">' + rich(f.t) + ' <a class="go" href="#' + esc(f.to) + '">Read →</a></li>'; });
    h += "</ol>";
    if (E.pick) h += '<div class="pick">' + rich(E.pick.t) + (E.pick.to ? ' <a href="#' + esc(E.pick.to) + '">Go →</a>' : "") + "</div>";
    if (T.items && T.items.length) {
      h += '<h3>Today and tomorrow</h3><div class="tt">';
      T.items.forEach(function (t) { h += '<div><span class="k" style="--kc:' + catColor(t.cat) + '">' + esc(t.k) + "</span><p>" + rich(t.t) + "</p></div>"; });
      h += "</div>";
    }
    h += "</section>";

    /* ===== Part 1 · The World ===== */
    h += part("world", "Part 1", "The World", "Facts and summaries only: the board, overnight developments, the numbers and the day's feature.", "p-world");
    h += '<section id="board" class="world"><h2>The board <span class="num">events logged, not a measure of intensity</span></h2>';
    if (board) {
      h += '<div class="panel"><div class="lbl">Ten theatres · marker size = events logged in 7 days</div><div class="chart" id="worldmap" style="min-height:150px"></div></div>';
      h += '<div class="fug board">' + nq() + board.map(function (b) {
        var hd = '<details class="thread brow ' + fu(b.badge) + '" id="th-' + esc(b.t.id) + '" open><summary><span class="tname">' + esc(b.t.name) + act4(b.weeks) + badge(b.badge) + "</span>";
        hd += b.last ? '<span class="tlast"><span class="d">' + esc(fmtShort(b.last.date)) + "</span>" + rich(b.last.t, srcMap(b.last.src)) + "</span>" : '<span class="tlast small">No events logged yet.</span>';
        hd += "</summary>";
        hd += '<div class="tlog">' + (b.log.length > 1 ? logList(b.log.slice(0, -1), "sub") : "") + '<div class="meta">' + b.log.length + (b.log.length === 1 ? " entry" : " entries") + (b.last ? " · last " + esc(fmtLong(b.last.date)) + (b.age > 1 ? " (" + b.age + " days ago)" : "") : "") + "</div></div></details>";
        return hd;
      }).join("") + "</div>";
    } else h += quiet("The board file is not loaded.");
    h += "</section>";
    h += '<section id="world" class="world"><h2>Developments <span class="num">beyond Europe</span></h2>';
    if (WO.items && WO.items.length) {
      var rc = {}; WO.items.forEach(function (x) { rc[x.region] = (rc[x.region] || 0) + 1; });
      h += '<div class="regions">' + Object.keys(rc).map(function (r) { return "<span>" + esc(r) + "<b>" + rc[r] + "</b></span>"; }).join("") + '</div><div class="world fug">' + nq();
      WO.items.forEach(function (x) {
        h += '<article class="wcard ' + fu(x.badge) + '"><div class="wtop"><span class="tag rg">' + esc(x.region) + "</span>" + (x.conf ? '<span class="conf">confidence: ' + esc(x.conf) + "</span>" : "") + badge(x.badge) + "</div><h4>" + rich(x.h) + "</h4><p>" + rich(x.body) + "</p>" + (x.next ? '<p class="sw-line"><b class="l">Next</b>' + rich(x.next) + "</p>" : "") + (x.sw ? '<p class="sw-line"><b class="l">So what</b>' + rich(x.sw) + "</p>" : "") + "</article>";
      });
      h += "</div>";
    } else h += quiet();
    h += "</section>";
    /* by the numbers */
    var keys = WO.numbers && WO.numbers.length ? WO.numbers : Object.keys(WS.series || {}).filter(function (k) { return (WS.series[k] || []).length; }).concat(["brent"]);
    var tiles = [];
    keys.forEach(function (k) {
      var meta = (WS.meta || {})[k] || {}, ser = (WS.series || {})[k] || SER[k] || [];
      ser = ser.filter(function (p) { return p[0] <= TD && typeof p[1] === "number"; });
      if (!ser.length) return;
      var last = ser[ser.length - 1], prev = ser.length > 1 ? ser[ser.length - 2] : null, dec = meta.decimals != null ? meta.decimals : (k === "brent" || k === "ttf" ? 2 : 0);
      var label = meta.label || (k === "brent" ? "Brent, $ per barrel" : k === "ttf" ? "Dutch TTF gas, € per MWh" : k), unit = meta.unit || "";
      tiles.push('<div class="tile nt"><div class="lbl">' + esc(label) + '</div><div class="val">' + num(last[1], dec) + (unit ? ' <small>' + esc(unit) + "</small>" : "") + "</div><p>" + (prev ? '<span class="chg ' + dir(last[1] - prev[1]) + '">' + signed(last[1] - prev[1], dec) + "</span> vs " + esc(fmtShort(prev[0])) + " · " : "") + "as of " + esc(fmtShort(last[0])) + (meta.cadence ? " · " + esc(meta.cadence) : "") + "</p>" + (ser.length > 1 ? '<div class="spark" data-ws="' + esc(k) + '"></div>' : "") + (meta.note ? '<p class="small">' + esc(meta.note) + "</p>" : "") + (meta.source ? '<p class="small">' + (meta.url ? '<a href="' + esc(meta.url) + '" target="_blank" rel="noopener">' + esc(meta.source) + "</a>" : esc(meta.source)) + "</p>" : "") + "</div>");
      ctx._ws[k] = ser.slice(-30);
    });
    h += '<section id="numbers" class="world"><h2>By the numbers</h2>' + (tiles.length ? '<div class="strip nums">' + tiles.join("") + "</div>" : quiet("No series published yet.")) + "</section>";
    /* feature */
    var FE = WO.feature;
    var WROT = [["mon","Mon","Theatre in numbers"],["tue","Tue","Actor on the record"],["wed","Wed","Trend line"],["thu","Thu","Chronology"],["fri","Fri","Week on the board"],["sat","Sat","Geography"],["sun","Sun","The record"]];
    h += '<section id="feature" class="world"><h2>' + esc(FE && FE.kind ? FE.kind : "Feature") + "</h2>";
    if (FE) {
      h += '<article class="feature"><h3 class="ft">' + esc(FE.title) + "</h3>" + (FE.body || []).map(function (p) { return "<p>" + rich(p) + "</p>"; }).join("");
      if (FE.table) h += table(FE.table.head, FE.table.rows.map(function (r) { return "<tr>" + r.map(function (c, j) { return "<td" + (j > 0 && /^[\d.,%$€+−\- ]+$/.test(String(c)) ? ' class="d"' : "") + ">" + rich(c) + "</td>"; }).join("") + "</tr>"; }).join(""), "lbl1");
      if (FE.series) { var fs = ((WS.series || {})[FE.series] || SER[FE.series] || []).filter(function (p) { return p[0] <= TD; }); var fm = (WS.meta || {})[FE.series] || {}; if (fs.length > 1) { ctx._fser = fs; ctx._fmeta = fm; h += '<div class="panel"><div class="lbl">' + esc(fm.label || FE.series) + (fm.unit ? " · " + esc(fm.unit) : "") + '</div><div class="chart" id="fchart"></div>' + (fm.source ? '<p class="small">' + esc(fm.source) + "</p>" : "") + "</div>"; } }
      if (FE.bars) h += '<div class="panel"><div class="lbl">' + esc(FE.bars.label || "") + '</div><div class="chart" id="fbars"></div></div>';
      if (FE.timeline) h += tl(FE.timeline.map(function (r) { return [r[0], r[1], null, r[2]]; }));
      if (FE.geo) { ctx._geo = FE.geo; h += '<div class="panel"><div class="lbl">' + esc(FE.geo.title || "Schematic") + '</div><div class="chart" id="fgeo"></div></div>'; }
      if (FE.after) h += FE.after.map(function (p) { return "<p>" + rich(p) + "</p>"; }).join("");
      h += "</article>";
    } else h += quiet("No feature in this edition (format 3.0 and earlier).");
    h += '<div class="ap-c"><div class="lbl">World feature rota</div><div class="rota">' + WROT.map(function (r) { return '<div class="' + (r[0] === (FE && FE.rota) ? "on " : "") + '"><b>' + r[1] + "</b>" + r[2] + "</div>"; }).join("") + "</div></div></section>";

    /* ===== Part 2 · Security ===== */
    var HY = E.hybrid || {};
    h += part("sec", "Part 2", "Security", "Hybrid activity, Europe and the Euregio.", "p-sec");
    h += '<section id="hybrid" class="sec"><h2>Hybrid watch</h2><h3>Incident log</h3>';
    if (HY.incidents && HY.incidents.length) {
      h += '<div class="incidents fug">' + nq();
      HY.incidents.forEach(function (i) {
        h += '<article class="inc ' + fu(i.badge) + '" id="inc-' + esc(i.id) + '"><div class="inc-top"><span class="when">' + esc(i.when) + '</span><span class="chip code">' + esc(i.code) + "</span>" + (i.local ? '<span class="chip local">LOCAL</span>' : "") + '<span class="chip ' + esc((i.attr || "").toLowerCase()) + '">' + esc(i.attr) + "</span>" + badge(i.badge) + '</div><div class="place">' + esc(i.place) + "</div><p>" + rich(i.text) + "</p></article>";
      });
      h += "</div>";
      var counts2 = [0, 0, 0, 0, 0, 0];
      HY.incidents.forEach(function (i) { var n = parseInt(String(i.attr).replace("A", ""), 10); if (!isNaN(n)) counts2[n]++; });
      var names = ["unexplained", "suspected", "named", "attributed", "charged", "convicted"];
      h += '<div class="ladder" role="img" aria-label="Incidents by attribution level">' + counts2.map(function (c, n) { return '<div class="rung ' + (c ? "hot" : "zero") + '"><b>A' + n + "</b><span>" + c + "</span><small>" + names[n] + "</small></div>"; }).join("") + "</div>";
    } else h += quiet("No new incidents in the window.");
    h += '<div class="viz"><div class="panel"><div class="lbl">Running log · last 30 days</div><div id="map" class="chart" style="min-height:200px"></div></div><div class="panel"><div class="lbl">Per day and by type</div><div id="trend" class="chart" style="min-height:100px"></div></div><div class="panel"><div class="lbl">By country · last 30 days</div><div id="bycountry"></div></div></div>';
    h += '<p class="small" id="logsrc"></p>';
    h += '<h3>Attribution moves <span class="small">last 7 days</span></h3><div id="attrmoves"></div>';
    h += '<h3>Within 100 km <span class="small">last 30 days</span></h3><div id="near"></div>';
    if (HY.leads && HY.leads.length) {
      h += "<h3>Lead analysis</h3>";
      HY.leads.forEach(function (l) {
        h += '<details class="lead" id="' + esc(l.id) + '" open><summary><span class="t">' + esc(l.title) + '</span><span class="te">' + rich(l.teaser) + '</span></summary><div class="lead-body"><dl>';
        l.rows.forEach(function (r) { h += "<dt>" + esc(r[0]) + "</dt><dd>" + rich(r[1]) + "</dd>"; });
        if (l.sw) h += '<dt>So what</dt><dd class="sw">' + rich(l.sw) + "</dd>";
        h += "</dl></div></details>";
      });
    }
    if (HY.pattern && HY.pattern.length) h += '<h3>Pattern check</h3><ul class="clean">' + HY.pattern.map(function (p) { return "<li>" + rich(p) + "</li>"; }).join("") + "</ul>";
    if (HY.tracker && HY.tracker.length) h += '<h3>Counter-hybrid tracker</h3><ul class="clean">' + HY.tracker.map(function (t) { return "<li>" + rich(t[0]) + ' <span class="act">' + esc(t[1]) + "</span></li>"; }).join("") + "</ul>";
    if (HY.week) h += "<h3>Week in hybrid</h3>" + (HY.week.html ? HY.week.html : "<p>" + rich(HY.week.t || "") + "</p>");
    if (HY.indicators && HY.indicators.length) {
      h += '<h3>Hybrid indicators</h3><div class="ind">';
      HY.indicators.forEach(function (x) { h += '<div class="ind-row"><div class="st ' + esc(x[0]) + '">' + (ICON[x[0]] || "") + (STLBL[x[0]] || esc(x[0])) + '</div><div style="min-width:0"><h4>' + esc(x[1]) + "</h4><p>" + rich(x[2]) + "</p></div></div>"; });
      h += "</div>";
    }
    if (HY.note) h += '<p class="small" style="margin-top:8px">' + rich(HY.note) + "</p>";
    h += "</section>";
    h += '<section id="europe" class="sec"><h2>Europe</h2>' + items(E.europe) + "</section>";
    if (E.euregio && E.euregio.length) h += '<section id="euregio" class="sec"><h2>Local &amp; Euregio</h2>' + items(E.euregio) + "</section>";

    /* ===== Part 3 · Watchlist ===== */
    var P = E.planner || {};
    h += part("watch", "Part 3", "Watchlist", "Threads that keep moving, and what is coming up.", "p-watch");
    h += '<section id="threads" class="watch"><h2>Tracked threads</h2>';
    if (threads) h += renderThreads(threads);
    else if (P.threads && P.threads.length) h += '<div class="fug">' + nq() + table(["Thread", "What moved"], P.threads.map(function (t) { return '<tr class="' + fu(t[2]) + '"><td>' + esc(t[0]) + badge(t[2]) + "</td><td>" + rich(t[1]) + "</td></tr>"; }).join(""), "lbl1") + "</div>";
    else h += quiet("No threads are open.");
    h += "</section>";
    h += '<section id="horizon" class="watch"><h2>Horizon</h2><p class="small">Filled marker = hybrid-relevant. Dashed label = reported, not confirmed.</p>';
    if (horizonEvents) h += renderHorizon(horizonEvents, TD);
    else if (P.horizon && P.horizon.length) {
      var lastG = null; h += '<div class="fug">' + nq();
      P.horizon.forEach(function (x) {
        if (x.g !== lastG) { if (lastG !== null) h += "</div>"; h += '<div class="tl-group">' + esc(x.g) + '</div><div class="tl">'; lastG = x.g; }
        h += '<div class="tl-i ' + fu(x.badge) + (x.h ? " h" : "") + '"><div class="d">' + esc(x.d) + "</div><h4>" + esc(x.t) + "</h4>" + badge(x.badge) + "<p>" + rich(x.n) + "</p></div>";
      });
      if (lastG !== null) h += "</div>";
      h += "</div>";
    } else h += quiet("Nothing dated on the horizon.");
    h += "</section>";

    /* ===== Part 4 · Profession ===== */
    var AR = E.army || {}, AP = E.aperture || {}, NA = E.nato || {}, DT = E.deftech || {};
    h += part("pro", "Part 4", "Profession", "Inside the US military, the allies you work beside, and the technology of the fight.", "p-pro");
    h += '<section id="army" class="pro"><h2>Defence &amp; Army</h2>';
    if (AR.cards) h += '<div class="cards">' + AR.cards.map(function (c) { return '<div class="card"><div class="lbl">' + esc(c.l) + '</div><div class="val">' + esc(c.v) + "</div><p>" + rich(c.n) + "</p></div>"; }).join("") + "</div>";
    var TOPICS = ["Autonomy", "Leaders' words", "SOF", "Strategy", "Posture", "Force design"], tcount = {};
    [].concat(AR.dod || [], AR.news || AR.items || [], AR.congress || [], (AR.career || {}).items || [], DT.items || [], (AR.words || []).map(function (w) { return { tag: "Leaders' words" }; })).forEach(function (it) { String(it.tag || "").split(/\s*[,·]\s*/).forEach(function (t) { TOPICS.forEach(function (T) { if (t && t.toLowerCase() === T.toLowerCase()) tcount[T] = (tcount[T] || 0) + 1; }); }); });
    h += '<div class="regions topics" title="Priority topics: items tagged today">' + TOPICS.map(function (T) { return '<span class="' + (tcount[T] ? "" : "zero") + '">' + esc(T) + "<b>" + (tcount[T] || 0) + "</b></span>"; }).join("") + "</div>";
    var AG = [["dod", "Department of Defense", AR.dod, "Nothing new from the Pentagon in the window."], ["armynews", "Army and USAREUR-AF", AR.news || AR.items, "No Army news in the window."], ["congress", "Congress and policy", AR.congress, "No new legislation or policy in the window."]];
    AG.forEach(function (g) {
      h += '<h3 id="' + g[0] + '">' + g[1] + "</h3>" + items(g[2], null, g[3]);
      if (g[0] === "dod" && AR.words && AR.words.length) h += '<h3 id="words">Senior leaders on the record</h3><div class="fug words">' + nq() + AR.words.map(function (w) { return '<blockquote class="word ' + fu(w.badge) + '"><p>“' + rich(w.quote) + '”</p><footer><b>' + esc(w.who) + "</b>" + (w.role ? ", " + esc(w.role) : "") + (w.where ? " · " + esc(w.where) : "") + (w.date ? " · " + esc(fmtShort(w.date)) : "") + badge(w.badge) + (w.context ? '<div class="small">' + rich(w.context) + "</div>" : "") + "</footer></blockquote>"; }).join("") + "</div>";
    });
    var CR = AR.career || {};
    h += '<h3 id="career">Career <span class="small">boards, assignments, education, pay and benefits</span></h3>';
    if (CR.items && CR.items.length) h += items(CR.items);
    else if (CR.note) h += "<p>" + rich(CR.note) + "</p>";
    else h += quiet("Nothing new that touches your career in the window.");
    if (CR.dates && CR.dates.length) h += table(["Date", "Milestone"], CR.dates.filter(function (d) { return d[0] >= TD; }).map(function (d) { var n = daysBetween(TD, d[0]); return '<tr class="' + (n <= 14 ? "soon" : "") + '"><td class="d">' + esc(fmtShort(d[0])) + " · " + (n === 0 ? "today" : n + " d") + "</td><td>" + rich(d[1]) + "</td></tr>"; }).join(""));
    if (CR.note && CR.items && CR.items.length) h += '<p class="small" style="margin-top:8px">' + rich(CR.note) + "</p>";
    var DP = AR.depth, PROT = [["mon","Mon","Readiness and recruiting in numbers"],["wed","Wed","An acquisition programme in numbers"],["fri","Fri","The week's personnel and policy decisions"]];
    if (DP) {
      h += '<article class="feature" id="armydepth"><div class="lbl" style="color:var(--pc)">' + esc(DP.kind || "In depth") + '</div><h3 class="ft">' + esc(DP.title) + "</h3>" + (DP.body || []).map(function (p) { return "<p>" + rich(p) + "</p>"; }).join("");
      if (DP.table) h += table(DP.table.head, DP.table.rows.map(function (r) { return "<tr>" + r.map(function (c, j) { return "<td" + (j > 0 && /^[\d.,%$€+−\- ]+$/.test(String(c)) ? ' class="d"' : "") + ">" + rich(c) + "</td>"; }).join("") + "</tr>"; }).join(""), "lbl1");
      if (DP.bars) h += '<div class="panel"><div class="lbl">' + esc(DP.bars.label || "") + "</div>" + chartBox("armybars", 150) + "</div>";
      h += "</article>";
    }
    h += '<div class="ap-c"><div class="lbl">Depth rota</div><div class="rota three">' + PROT.map(function (r) { return '<div class="' + (DP && r[0] === DP.rota ? "on" : "") + '"><b>' + r[1] + "</b>" + r[2] + "</div>"; }).join("") + "</div></div>";
    var LANES = { bill: ["introduced","committee","house","senate","conference","enacted"], budget: ["request","house","senate","cr","enacted"], nomination: ["vacant","announced","nominated","hearing","committee","floor","confirmed"] };
    var STGL = { introduced: "Introduced", committee: "Committee", house: "House", senate: "Senate", conference: "Conference", enacted: "Enacted", request: "Request", cr: "CR", vacant: "Vacant", announced: "Announced", nominated: "Nominated", hearing: "Hearing", floor: "Floor", confirmed: "Confirmed", withdrawn: "Withdrawn", stalled: "Stalled", vetoed: "Vetoed" };
    var DONE = { enacted: 1, confirmed: 1, withdrawn: 1, vetoed: 1 };
    var CG = (ctx.congress || []).map(function (c) { var d = c.dates || {}, last = Object.keys(d).reduce(function (m, k) { return d[k] > m ? d[k] : m; }, "") || c.updated || c.added || ""; return { c: c, last: last, badge: c.added === TD ? "NEW" : c.updated === TD ? "UPDATED" : "" }; }).filter(function (x) { return !(DONE[x.c.stage] && daysBetween(x.last, TD) > 30); });
    function cgCard(x) {
      var c = x.c, lane = LANES[c.kind] || LANES.bill, idx = lane.indexOf(c.stage), d = c.dates || {}, off = c.stage === "withdrawn" || c.stage === "vetoed" || c.stage === "stalled" || (c.status && /stalled|vetoed/i.test(c.status) && idx < 0);
      var pipe = '<div class="pipe' + (off ? " wd" : "") + '" style="grid-template-columns:repeat(' + lane.length + ',1fr)">' + lane.map(function (st, i) { var on = !off && i <= idx, cur = st === c.stage; return '<span class="' + (on ? "on" : "") + (cur ? " cur" : "") + '" title="' + esc(STGL[st] + (d[st] ? " · " + fmtShort(d[st]) : "")) + '"><i></i><small>' + STGL[st] + "</small></span>"; }).join("") + "</div>";
      var dl = c.deadline && c.deadline >= TD ? daysBetween(TD, c.deadline) : null;
      return '<div class="cf ' + fu(x.badge) + '" id="cg-' + esc(c.id) + '"><div class="cf-top"><b>' + esc(c.title || c.post) + '</b><span class="chip st">' + esc(STGL[c.stage] || c.stage) + (x.last ? " · " + esc(fmtShort(x.last)) : "") + "</span>" + (dl != null ? '<span class="chip st' + (dl <= 14 ? " act" : "") + '">' + esc(fmtShort(c.deadline)) + " · " + (dl === 0 ? "today" : dl + " d") + "</span>" : "") + badge(x.badge) + '</div><div class="cf-who">' + (c.kind === "nomination" ? (c.nominee ? esc(c.nominee) : '<span class="small">no nominee</span>') : esc(c.number || "")) + (c.org ? ' <span class="small">· ' + esc(c.org) + "</span>" : "") + (c.committee ? ' <span class="small">· ' + esc(c.committee) + "</span>" : "") + (c.src && c.src.length ? '<sup class="r">' + c.src.map(function (z) { return citeLink(z[0], srcMap(c.src)); }).join("") + "</sup>" : "") + "</div>" + pipe + (c.status ? '<p class="small"><b>' + esc(c.status) + "</b></p>" : "") + (c.next ? '<p class="small">' + rich(c.next, srcMap(c.src)) + "</p>" : "") + "</div>";
    }
    h += '<h3 id="congresstracker">Congress tracker <span class="small">bills, budget, confirmations</span></h3>';
    if (CG.length) {
      h += '<div class="fug">' + nq();
      [["bill", "Key defence bills"], ["budget", "Budget and appropriations"], ["nomination", "Confirmations"]].forEach(function (lane) {
        var rows = CG.filter(function (x) { return (x.c.kind || "bill") === lane[0]; }).sort(function (a, b) { var ad = DONE[a.c.stage] ? 1 : 0, bd = DONE[b.c.stage] ? 1 : 0; if (ad !== bd) return ad - bd; return a.last < b.last ? 1 : a.last > b.last ? -1 : 0; });
        h += '<div class="lbl cg-lane">' + lane[1] + "</div>" + (rows.length ? '<div class="cflist">' + rows.map(cgCard).join("") + "</div>" : quiet("Nothing tracked in this lane."));
      });
      h += "</div>";
    } else h += quiet("Nothing tracked yet.");
    var CW = ctx.congressWatch || [], CT = ctx.congressTiers || [];
    if (CW.length) {
      var openBy = {}; CG.forEach(function (x) { if (x.c.kind === "nomination" && x.c.postId && !DONE[x.c.stage]) openBy[x.c.postId] = x.c.stage; });
      h += '<div class="lbl cg-lane">Watched posts <span class="small" style="text-transform:none;letter-spacing:0">' + CW.filter(function (w) { return w.holder; }).length + " of " + CW.length + ' holders sourced</span></div><div class="wposts">';
      CT.forEach(function (t) {
        var list = CW.filter(function (w) { return w.tier === t.id; }); if (!list.length) return;
        h += '<div class="wtier"><div class="wtn">' + esc(t.name) + '</div><div class="wrow">' + list.map(function (w) {
          var st = openBy[w.id], cls = st === "vacant" ? "vac" : st ? "pend" : w.holder ? "" : "unk", b = w.updated === TD ? "UPDATED" : "";
          return '<a class="wp ' + cls + (b ? " fu new" : " fu") + '" href="#' + (st ? "cg-" + esc(CG.filter(function (x) { return x.c.postId === w.id && !DONE[x.c.stage]; })[0].c.id) : "congresstracker") + '" title="' + esc(w.post + (w.senate ? " · Senate-confirmed" : "") + (w.since ? " · since " + fmtShort(w.since) + " " + w.since.slice(0, 4) : "")) + '"><b>' + esc(w.post) + "</b>" + (w.holder ? "<span>" + esc(w.holder) + (w.acting ? " (acting)" : "") + "</span>" : '<span class="small">holder not yet sourced</span>') + (st ? '<em>' + esc(STGL[st] || st) + "</em>" : "") + badge(b) + "</a>";
        }).join("") + "</div></div>";
      });
      h += '</div><p class="small">Red = vacant, amber = nomination in progress. Posts marked Senate-confirmed in the tooltip go through the pipeline above; the rest change by assignment.</p>';
    }
    h += "</section>";

    h += '<section id="nato" class="pro"><h2>NATO &amp; European militaries</h2>' + items(NA.items, null, "Nothing new from the Alliance or the allied armies in the window.");
    if (NA.table) h += '<h3>' + esc(NA.table.title || "Allied spending and strength") + (NA.table.asof ? ' <span class="small">' + esc(NA.table.asof) + "</span>" : "") + "</h3>" + table(NA.table.head, NA.table.rows.map(function (r) { return "<tr>" + r.map(function (c, j) { return "<td" + (j > 0 && /^[\d.,%$€+−\- ]+$/.test(String(c)) ? ' class="d"' : "") + ">" + rich(c) + "</td>"; }).join("") + "</tr>"; }).join(""), "lbl1") + (NA.table.src ? '<p class="small" style="margin-top:6px">Source' + cite(NA.table.src) + "</p>" : "");
    var EXL = (ctx.exercises || []).filter(function (x) { return x.to >= addDays(TD, -60); }).sort(function (a, b) { return a.from < b.from ? -1 : 1; });
    h += '<h3 id="exercises">Exercise calendar <span class="small">recent and announced</span></h3>';
    h += EXL.length ? '<div class="fug">' + nq() + table(["When", "Exercise", "Lead · where · forces"], EXL.map(function (x) {
      var b = x.added === TD ? "NEW" : x.updated === TD ? "UPDATED" : "", n = daysBetween(TD, x.from), when = x.dateText || (fmtShort(x.from) + (x.to !== x.from ? " – " + fmtShort(x.to) : "") + (x.from > TD ? " · in " + n + " d" : ""));
      return '<tr class="' + fu(b) + (x.from <= TD && x.to >= TD ? " soon" : "") + '"><td class="d">' + esc(when) + "</td><td><b>" + esc(x.name) + "</b>" + badge(b) + (x.status ? '<div class="small">' + esc(x.status) + "</div>" : "") + "</td><td>" + esc([x.lead, x.where, x.forces].filter(Boolean).join(" · ")) + (x.src && x.src.length ? '<sup class="r">' + x.src.map(function (z) { return citeLink(z[0], srcMap(x.src)); }).join("") + "</sup>" : "") + "</td></tr>";
    }).join(""), "lbl1") + "</div>" : quiet("No exercises announced.");
    h += "</section>";

    h += '<section id="deftech" class="pro"><h2>Defence tech</h2>' + items(DT.items, null, "No new defence technology in the window.");
    var DTS = (DT.series || []).filter(function (k) { return ((WS.series || {})[k] || []).length > 1; });
    if (DTS.length) h += '<div class="viz">' + DTS.map(function (k) { var m = (WS.meta || {})[k] || {}; ctx._dts = ctx._dts || {}; ctx._dts[k] = (WS.series[k] || []).filter(function (p) { return p[0] <= TD; }); return '<div class="panel"><div class="lbl">' + esc(m.label || k) + (m.unit ? " · " + esc(m.unit) : "") + "</div>" + chartBox("dts-" + k, 170) + (m.source ? '<p class="small">' + esc(m.source) + "</p>" : "") + "</div>"; }).join("") + "</div>";
    if (DT.ttp) h += '<article class="feature" id="ttp"><div class="lbl" style="color:var(--pc)">Week in war · TTPs</div><h3 class="ft">' + esc(DT.ttp.title) + "</h3>" + (DT.ttp.body || []).map(function (p) { return "<p>" + rich(p) + "</p>"; }).join("") + "</article>";
    h += "</section>";

    h += '<section id="aperture" class="pro"><h2>Aperture</h2><div class="ap">';
    if (AP.contrarian) h += '<div class="ap-c"><div class="lbl">Contrarian read</div><p>' + rich(AP.contrarian) + "</p></div>";
    if (AP.weak) h += '<div class="ap-c"><div class="lbl">Weak signal</div><p>' + rich(AP.weak) + "</p></div>";
    if (AP.number) h += '<div class="ap-c numday"><div class="big">' + esc(AP.number.n) + '</div><div><div class="lbl">Number of the day</div><p style="margin:0">' + rich(AP.number.t) + "</p></div></div>";
    if (AP.inject) h += '<div class="ap-c"><div class="lbl">Exercise inject</div><p>' + rich(AP.inject) + "</p></div>";
    if (AP.question) h += '<div class="ap-c"><div class="lbl">Question for the staff</div><p>' + rich(AP.question) + "</p></div>";
    if (AP.deep) {
      var D = AP.deep;
      h += '<details class="deep" open><summary><div class="eyebrow" style="color:var(--pc)">' + esc(D.kind) + "</div><h4>" + esc(D.title) + '</h4></summary><div class="deep-body">' + (D.body || []).map(function (p) { return "<p>" + rich(p) + "</p>"; }).join("");
      if (D.table) h += table(D.table.head, D.table.rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + rich(c) + "</td>"; }).join("") + "</tr>"; }).join(""), "lbl1");
      h += "</div></details>";
    }
    if (AP.longread) h += '<div class="ap-c"><div class="lbl">Long read</div><p><a href="' + esc(AP.longread.url) + '" target="_blank" rel="noopener">' + esc(AP.longread.title) + "</a> · " + esc(AP.longread.outlet) + "</p><p>" + rich(AP.longread.why) + "</p></div>";
    var ROT = [["mon","Mon","Historical echo"],["tue","Tue","Outside-in"],["wed","Wed","Red lens"],["thu","Thu","Concept"],["fri","Fri","Ally spotlight + week in hybrid"],["sat","Sat","Week in war: TTPs (in Defence tech)"],["sun","Sun","Week in defence tech"]];
    h += '<div class="ap-c"><div class="lbl">Deep cuts and special topics</div><div class="rota">' + ROT.map(function (r) { return '<div class="' + (r[0] === AP.rota ? "on " : "") + (r[0] === "sat" || r[0] === "sun" ? "sp" : "") + '"><b>' + r[1] + "</b>" + r[2] + "</div>"; }).join("") + "</div></div>";
    h += "</div></section>";

    /* ===== Part 5 · Frontier ===== */
    var FR = E.frontier || {}, REL = ctx.releases || {};
    h += part("frontier", "Part 5", "Frontier", "Tech and AI: releases, results and shipped capability only.", "p-frontier");
    h += '<section id="frontier" class="frontier"><h2>Newest</h2>' + items(FR.items, null, "No new release or published result in the window.") + "</section>";
    var RL = (REL.releases || []).filter(function (r) { return r.date <= TD && r.date >= addDays(TD, -45); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    h += '<section id="releases" class="frontier"><h2>Release log <span class="num">last 45 days</span></h2>';
    h += RL.length ? '<div class="fug">' + nq() + '<div class="tl">' + RL.map(function (r) { var b = r.date === TD ? "NEW" : r.date === addDays(TD, -1) ? "UPDATED" : ""; return '<div class="tl-i ' + fu(b) + '"><div class="d"><span>' + esc(fmtLong(r.date)) + '</span><span class="chip rep">' + esc(r.kind || "release") + "</span></div><h4>" + esc(r.t) + "</h4>" + badge(b) + '<p class="ink">' + esc(r.lab || "") + (r.lab && r.n ? " · " : "") + rich(r.n || "", srcMap(r.src)) + "</p></div>"; }).join("") + "</div></div>" : quiet("No releases logged yet.");
    h += "</section>";
    var SO = REL.sota || {};
    h += '<section id="sota" class="frontier"><h2>State of the art <span class="num">' + (SO.asof ? "as of " + esc(fmtShort(SO.asof)) : "updated Fridays") + "</span></h2>";
    h += SO.rows && SO.rows.length ? table(["Domain", "Leading system", "Since"], SO.rows.map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td><b>" + esc(r[1]) + "</b>" + (r[2] ? '<div class="small">' + esc(r[2]) + "</div>" : "") + (r[4] && r[4].length ? '<sup class="r">' + r[4].map(function (z) { return citeLink(z[0], srcMap(r[4])); }).join("") + "</sup>" : "") + '</td><td class="d">' + esc(r[3] ? fmtShort(r[3]) : "—") + "</td></tr>"; }).join(""), "lbl1") : quiet("The Friday table has not been written yet.");
    h += "</section>";

    /* ===== Part 5 · Money ===== */
    var M = E.money || {};
    h += part("money", "Part 6", "Money", "Last session's markets and the numbers that move prices, pay and rates.", "p-money");
    h += '<section id="markets" class="money"><h2>Markets &amp; economy <span class="num">' + esc(M.asof || "") + "</span></h2>";
    var sparks = []; ctx._sparks = sparks;
    if (M.cards) h += '<div class="cards">' + M.cards.map(function (c) {
      var src = null, sk = null;
      [c[5], c[6]].forEach(function (v) { if (typeof v === "number") src = v; else if (typeof v === "string" && v) sk = v; });
      if (!sk) { var lab = String(c[0]).toLowerCase(); SERIES_BY_LABEL.forEach(function (m) { if (!sk && lab.indexOf(m[0]) === 0) sk = m[1]; }); }
      var g = fxGuard(c[0], c[1], c[2], c[3]), arrow = g.dir === "up" ? "▲ " : g.dir === "down" ? "▼ " : "";
      var ser = sk && SER[sk] && SER[sk].length ? SER[sk].filter(function (p) { return p[0] <= TD; }).slice(-30) : null;
      return '<div class="card"><div class="lbl">' + esc(g.label) + '</div><div class="val">' + esc(g.value) + '</div><p><span class="chg ' + esc(g.dir) + '">' + (g.change ? arrow + esc(g.change) : "") + "</span> " + esc(g.fixed ? "euros per dollar" : c[4]) + cite(src) + "</p>" + (ser ? '<div class="spark" data-s="' + (sparks.push(ser) - 1) + '" title="' + esc(fmtShort(ser[0][0]) + " – " + fmtShort(ser[ser.length - 1][0])) + '"></div>' : "") + "</div>";
    }).join("") + "</div>";
    if (M.driver) h += "<p>" + rich(M.driver) + "</p>";
    if (M.ytd) h += "<h3>Year to date</h3>" + hbars(M.ytd, { fmt: function (v) { return (v >= 0 ? "+" : "") + v.toFixed(1) + "%"; }, foot: "Change since 1 January at the last close." + cite(M.ytdSrc) });
    h += "</section>";
    if (FX) {
      var range = store("rb:fx:range") === "1y" ? 365 : 90;
      h += '<section id="fx" class="money"><h2>USD/EUR <span class="num">euros per dollar · ECB</span></h2><div class="fx">';
      h += '<div class="fx-top"><span class="big tab">' + FX.last[1].toFixed(4) + '</span><span class="asof">' + esc(fmtLong(FX.last[0])) + " · € per $</span></div>";
      h += '<div class="fx-ch"><div><div class="lbl">Since ' + esc(fmtShort(FX.prev[0])) + '</div><div class="v chg ' + dir(FX.d1) + '">' + signed(FX.d1, 4) + '</div><div class="p chg ' + dir(FX.d1) + '">' + signed(FX.d1 / FX.prev[1] * 100, 2, "%") + "</div></div>";
      if (FX.month) h += '<div><div class="lbl">Since ' + esc(fmtShort(FX.month[0])) + '</div><div class="v chg ' + dir(FX.d30) + '">' + signed(FX.d30, 4) + '</div><div class="p chg ' + dir(FX.d30) + '">' + signed(FX.d30 / FX.month[1] * 100, 2, "%") + "</div></div>";
      h += '<div><div class="lbl">30-day range</div><div class="v">' + FX.lo30[1].toFixed(4) + '</div><div class="p">to ' + FX.hi30[1].toFixed(4) + "</div></div></div>";
      h += '<div class="fx-tools"><button type="button" data-range="90" aria-pressed="' + (range === 90) + '">90 days</button><button type="button" data-range="365" aria-pressed="' + (range === 365) + '">1 year</button></div>';
      h += '<div class="chart" id="fxchart" style="min-height:150px" data-range="' + range + '"></div>';
      var eu = function (r) { return "€" + num(1000 * r, 0); };
      h += '<p class="pay"><b class="l">Pay</b>$1,000 is ' + eu(FX.last[1]) + " today" + (FX.month ? ", " + eu(FX.month[1]) + " a month ago" : "") + "; 12-month best " + eu(FX.best[1]) + " (" + esc(fmtShort(FX.best[0])) + "), worst " + eu(FX.worst[1]) + " (" + esc(fmtShort(FX.worst[0])) + "). Up means the dollar buys more euros.</p>";
      h += '<div class="lbl" style="margin-top:12px">$1,000 in euros, monthly average</div><div class="chart" id="paybars" style="min-height:110px"></div>';
      h += '<p class="small" style="margin:8px 0 0"><a href="' + esc(ctx.fx.url || "https://www.ecb.europa.eu/stats/eurofxref/") + '" target="_blank" rel="noopener">' + esc(ctx.fx.source || "ECB") + "</a>, one value per ECB business day, inverted from the ECB's dollars-per-euro quote.</p></div></section>";
    }
    h += '<section id="rates" class="money">';
    if (M.rates) h += "<h2>Rates and prices</h2>" + table(["Measure", "Latest", "Note"], M.rates.map(function (r) { var g = fxGuard(r[0], r[1], null, null); return "<tr><td>" + esc(g.label) + '</td><td class="d">' + esc(g.value) + "</td><td>" + rich(r[2]) + "</td></tr>"; }).join(""), "lbl1");
    if (M.fuel) {
      var F = M.fuel, minP = Math.min.apply(null, F.rows.map(function (r) { return r[1]; })), minD = Math.min.apply(null, F.rows.map(function (r) { return r[2]; }));
      h += '<h3>Fuel across the borders <span class="small">' + esc(F.asof) + "</span></h3>";
      h += table(["Country", "Euro 95 €/l", "Diesel €/l"], F.rows.map(function (r) { return "<tr><td>" + esc(r[0]) + '</td><td class="d"' + (r[1] === minP ? ' style="color:var(--up);font-weight:700"' : "") + ">" + r[1].toFixed(3) + '</td><td class="d"' + (r[2] === minD ? ' style="color:var(--up);font-weight:700"' : "") + ">" + r[2].toFixed(3) + "</td></tr>"; }).join(""), "lbl1");
      h += '<p class="small" style="margin-top:6px">' + rich(F.note) + cite(F.src) + (F.weekly ? " Updated " + esc(F.weekly) + "." : "") + "</p>";
    }
    if (M.week) h += '<h3>Week ahead</h3><ul class="clean">' + M.week.map(function (x) { return "<li>" + rich(x) + "</li>"; }).join("") + "</ul>";
    if (M.fy) h += '<p class="sw-line" style="margin-top:12px"><b class="l">For you</b>' + rich(M.fy) + "</p>";
    h += "</section>";

    /* ===== Part 7 · Home ===== */
    var NL = E.nl || {}, AF = E.afnorth || {}, OD = E.offduty || {};
    h += part("home", "Part 7", "Home", "The Netherlands, the family, what is on nearby, the languages and the snow.", "p-home");
    h += '<section id="nl" class="home"><h2>Netherlands</h2>' + items(NL.items);
    if (NL.temp) h += '<p class="small" style="margin-top:12px"><b>Political temperature:</b> ' + rich(NL.temp) + "</p>";
    h += "</section>";
    h += '<section id="afnorth" class="home"><h2>AFNORTH &amp; family</h2>';
    if (AF.intro) h += '<p class="small">' + rich(AF.intro) + "</p>";
    if (AF.rows && AF.rows.length) h += table(["Date", "Event", "Action"], AF.rows.map(function (r) { return '<tr class="' + (r[3] === "soon" ? "soon" : "") + '"><td class="d">' + esc(r[0]) + "</td><td>" + rich(r[1]) + "</td><td>" + rich(r[2]) + "</td></tr>"; }).join(""));
    else h += quiet("Nothing new in the next 14 days.");
    if (AF.note) h += '<p class="small" style="margin-top:8px">' + rich(AF.note) + "</p>";
    h += "</section>";
    /* out and about */
    var EVS = (ctx.events || []).filter(function (e) { return e.to >= TD; }).sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; });
    var dow = today.getDay(), fri = addDays(TD, dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow), sun = addDays(fri, 2);
    var WK = EVS.filter(function (e) { return e.from <= sun && e.to >= fri; }), N30 = EVS.filter(function (e) { return e.from <= addDays(TD, 30); });
    function evRow(e) {
      var b = e.added === TD ? "NEW" : e.updated === TD ? "UPDATED" : "", when = e.from === e.to ? fmt(pd(e.from)) : fmtShort(e.from) + " – " + fmtShort(e.to);
      return '<div class="evrow ' + fu(b) + '" data-cat="' + esc(e.cat) + '"><span class="d">' + esc(when) + '</span><div><span class="chip st" style="color:' + catColor("out") + '">' + esc(EVCAT[e.cat] || e.cat) + "</span>" + (e.kid ? '<span class="chip st quiet">kids</span>' : "") + " <b>" + esc(e.t) + "</b>" + badge(b) + '<div class="small">' + esc([e.town + (e.cc ? " (" + e.cc + ")" : ""), e.venue, e.drive != null ? "~" + e.drive + " min" : "", e.cost].filter(Boolean).join(" · ")) + (e.src && e.src.length ? '<sup class="r">' + e.src.map(function (z) { return citeLink(z[0], srcMap(e.src)); }).join("") + "</sup>" : "") + "</div></div></div>";
    }
    h += '<section id="offduty" class="home"><h2>Out and about <span class="num">within 90 minutes</span></h2>';
    h += '<h3>This weekend <span class="small">' + esc(fmtShort(fri) + " – " + fmtShort(sun)) + "</span></h3>";
    if (OD.weather) h += '<p class="small">' + rich(OD.weather) + "</p>";
    h += WK.length ? '<div class="evlist fug">' + nq() + WK.map(evRow).join("") + "</div>" : quiet("Nothing listed for the weekend yet.");
    if (OD.items && OD.items.length) h += '<h3>Editor\'s picks</h3>' + items(OD.items, { inlineTag: true });
    if (OD.weekend) {
      h += "<h3>Weekend guide</h3>" + table(["Day", "Event", "Place", "Why go", "Cost / booking"], OD.weekend.rows.map(function (r) { return "<tr>" + r.map(function (c, j) { return "<td" + (j === 0 ? ' class="d"' : "") + ">" + rich(c) + "</td>"; }).join("") + "</tr>"; }).join(""));
      if (OD.weekend.gem) h += '<p class="sw-line" style="margin-top:10px"><b class="l">Hidden gem</b>' + rich(OD.weekend.gem) + "</p>";
      if (OD.weekend.family) h += '<p class="sw-line"><b class="l">Family pick</b>' + rich(OD.weekend.family) + "</p>";
    }
    h += '<h3>Next 30 days</h3><div class="filt" id="evfilt" role="group" aria-label="Filter events"><button type="button" data-f="all" aria-pressed="true">All</button>' + Object.keys(EVCAT).map(function (k) { return '<button type="button" data-f="' + k + '" aria-pressed="false">' + EVCAT[k] + "</button>"; }).join("") + '<button type="button" data-f="kids" aria-pressed="false">With kids</button></div>';
    h += N30.length ? '<div class="evlist fug" id="evlist">' + nq() + N30.map(evRow).join("") + '<p class="quiet" id="evempty" style="display:none">Nothing in this category in the next 30 days.</p></div>' : quiet("Nothing listed for the next 30 days.");
    h += "</section>";
    /* taal */
    var ID = (ctx.idioms || []).filter(function (i) { return i.date <= TD; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var LANG = { nl: "Dutch", fr: "French", it: "Italian" };
    h += '<section id="dutch" class="home"><h2>Taal <span class="num">Dutch, French, Italian</span></h2>';
    if (ID.length) {
      var cur = ID[0], b0 = cur.date === TD ? "NEW" : "";
      h += '<div class="idiom ' + fu(b0) + '"><div class="lbl">' + esc(LANG[cur.lang] || cur.lang) + " idiom of the day" + "</div><div class=\"w\" lang=\"" + esc(cur.lang) + '">' + esc(cur.phrase) + "</div>" + badge(b0) + '<p class="lit">“' + esc(cur.literal) + "”</p><p><b>" + esc(cur.meaning) + "</b></p>" + (cur.example ? '<blockquote lang="' + esc(cur.lang) + '">' + esc(cur.example) + "</blockquote>" : "") + '<p class="small">' + esc([cur.register, cur.note].filter(Boolean).join(" · ")) + "</p></div>";
      var rev = [];
      [[1, "yesterday"], [7, "a week ago"], [30, "a month ago"]].forEach(function (r) { var k = addDays(TD, -r[0]), hit = null; ID.forEach(function (i) { if (!hit && i.date <= k) hit = i; }); if (hit && hit !== cur && rev.indexOf(hit) < 0) rev.push(hit); });
      if (rev.length) h += '<div class="review"><div class="lbl">Review</div>' + rev.map(function (i) { return '<p><span class="chip st quiet">' + esc(i.lang) + '</span> <b lang="' + esc(i.lang) + '">' + esc(i.phrase) + "</b> · " + esc(i.meaning) + "</p>"; }).join("") + "</div>";
    } else h += quiet("No idiom logged yet.");
    if (NL.lees) h += '<div class="lees"><div class="lbl">Lees mee</div><blockquote lang="nl">' + rich(NL.lees.nl) + cite(NL.lees.src) + "</blockquote><dl>" + NL.lees.gloss.map(function (g) { return '<dt lang="nl">' + esc(g[0]) + "</dt><dd>" + rich(g[1]) + "</dd>"; }).join("") + "</dl></div>";
    if (NL.phrase) h += '<div class="nl-word"><div class="w" lang="nl">' + esc(NL.phrase.w) + '</div><p class="small" style="margin:2px 0 10px">“' + esc(NL.phrase.en) + "” · " + esc(NL.phrase.lvl) + "</p><p>" + rich(NL.phrase.note) + "</p></div>";
    h += "</section>";
    /* snow */
    var SK = ctx.ski, md = TD.slice(5), inSeason = SK && SK.season && (md >= SK.season[0] || md <= SK.season[1]);
    var fresh = SK && SK.snow && Object.keys(SK.snow).some(function (k) { return SK.snow[k].asof && daysBetween(SK.snow[k].asof, TD) <= 2; });
    if (SK && (inSeason || fresh) && SK.resorts && SK.resorts.length) {
      var rows = SK.resorts.map(function (r) { var sn = SK.snow[r.id]; if (!sn) return null; var n7 = sn.days.reduce(function (a, d) { return a + (d[1] || 0); }, 0); return { r: r, sn: sn, n7: n7 }; }).filter(Boolean).sort(function (a, b) { return b.n7 - a.n7 || b.sn.depthCm - a.sn.depthCm; });
      var mx = Math.max.apply(null, rows.map(function (x) { return Math.max.apply(null, x.sn.days.map(function (d) { return d[1] || 0; })); })) || 1;
      h += '<section id="snow" class="home"><h2>Snow <span class="num">7-day forecast · ' + esc(rows.length ? fmtShort(rows[0].sn.asof) : "") + "</span></h2>";
      h += table(["Resort", "New snow 7 d", "Depth", "Drive"], rows.map(function (x) {
        var bars = '<span class="snowbars" title="' + esc(x.sn.days.map(function (d) { return d[0].slice(5) + ": " + d[1] + " cm"; }).join(", ")) + '">' + x.sn.days.map(function (d) { return '<i style="height:' + (d[1] ? 3 + (d[1] / mx) * 15 : 1) + 'px"' + (d[1] ? "" : ' class="z"') + "></i>"; }).join("") + "</span>";
        var temps = x.sn.days.length ? Math.round(Math.min.apply(null, x.sn.days.map(function (d) { return d[3]; }))) + "° to " + Math.round(Math.max.apply(null, x.sn.days.map(function (d) { return d[2]; }))) + "°" : "";
        return "<tr><td><b>" + esc(x.r.name) + '</b><div class="small">' + esc(x.r.area + " (" + x.r.cc + ") · top " + x.r.top + " m") + '</div></td><td class="d">' + bars + " " + Math.round(x.n7) + " cm" + (temps ? '<div class="small">' + esc(temps) + "</div>" : "") + '</td><td class="d">' + x.sn.depthCm + ' cm<div class="small">at ' + Math.round(x.r.modelElevation || 0) + " m</div></td><td class=\"d\">" + esc(x.r.drive) + "</td></tr>";
      }).join(""), "lbl1 snowtab");
      h += '<p class="small" style="margin-top:6px">Model forecast at the grid elevation, not the summit; depth is the model\'s snowpack. <a href="' + esc(SK.url || "https://open-meteo.com") + '" target="_blank" rel="noopener">' + esc(SK.source || "Open-Meteo") + "</a>. Drive times from Hoensbroek, approximate.</p></section>";
    }

    /* ===== Part 7 · Hockey ===== */
    var HK = E.hockey || {};
    h += part("hockey", "Part 8", "Hockey", "Carolina first, then the league.", "p-hockey");
    h += '<section id="hockey" class="hockey"><h2>Hurricanes' + (CV ? ' <span class="num">' + esc(CV.season) + "</span>" : "") + "</h2>";
    if (CV) {
      h += '<div class="season" role="list" aria-label="Last ten results">' + CV.games.slice(-10).map(function (g) { return '<div class="g ' + g.res + '" role="listitem" title="' + esc(fmtShort(g.date) + (g.home ? " vs " : " at ") + g.opp + ": " + g.res + " " + g.gf + "–" + g.ga) + '"><b>' + g.res + "</b>" + (g.home ? "" : "@") + esc(g.opp) + "</div>"; }).join("") + "</div>";
      h += '<p class="recline">Record <b>' + esc(CV.record) + "</b> · <b>" + CV.points + "</b> pts" + (CV.metro ? " · <b>" + ordinal(CV.metro) + "</b> in the Metro" : "") + " · " + CV.games.length + " games</p>";
      if (CV.upcoming.length) h += '<div class="lbl sched-l">Next ten · CET</div><div class="season up" role="list" aria-label="Next ten games">' + CV.upcoming.map(function (g) { var dk = g.utc ? cetDate(g.utc) : g.date, tm = g.utc ? cet(g.utc).replace(/^\w+,? /, "") : ""; return '<div class="g" role="listitem" title="' + esc(fmt(pd(dk)) + (g.home ? " vs " : " at ") + g.opp + (tm ? " · " + tm + " CET" : "")) + '"><b>' + esc(fmtShort(dk)) + "</b>" + (g.home ? "" : "@") + esc(g.opp) + (tm ? "<small>" + esc(tm) + "</small>" : "") + "</div>"; }).join("") + "</div>";
    }
    if (HK.canes) {
      var C = HK.canes, R = C.result;
      h += '<div class="canes">';
      if (R) {
        var carHome = R.home === "CAR", cs = carHome ? R.hs : R.as, os = carHome ? R.as : R.hs, opp = carHome ? R.away : R.home, win = cs > os;
        h += '<div class="score"><span class="wl' + (win ? "" : R.ot ? " o" : " l") + '">' + (win ? "W" : (R.ot ? "OTL" : "L")) + '</span><span class="sc">CAR ' + cs + " – " + os + " " + esc(opp) + '</span><span class="meta">' + esc(R.date) + " · " + (carHome ? "home" : "away") + " · " + esc(R.venue || "") + cite(R.src) + "</span></div>";
        if (R.lines) h += '<ul class="clean">' + R.lines.map(function (l) { return "<li>" + rich(l) + "</li>"; }).join("") + "</ul>";
      } else if (C.noGame) h += "<p>" + rich(C.noGame) + "</p>";
      if (C.record && !CV) h += '<p class="small" style="margin:0"><b>Record:</b> ' + esc(C.record) + "</p>";
      if (C.next && C.next.length) h += table(["Next", "Opponent", "Puck drop here"], C.next.map(function (n) { return '<tr><td class="d">' + esc(n[0]) + "</td><td>" + esc(n[1]) + '</td><td class="d">' + esc(n[3]) + '<div class="small">' + esc(n[2]) + "</div>" + (n[4] ? '<span class="badge live">WATCH LIVE</span>' : "") + "</td></tr>"; }).join("")) + '<p class="small" style="margin:0">Schedule' + cite(C.nextSrc) + "</p>";
      h += "</div>";
    }
    if (CV && CV.games.length > 1) h += '<div class="panel" style="margin-top:12px"><div class="lbl">Season so far · points by game, goals for and against</div><div class="chart" id="hkchart" style="min-height:170px"></div></div>';
    h += '<h3>Scores <span class="small">' + esc(HK.scoresDate || "") + "</span></h3>";
    if (HK.scores && HK.scores.length) {
      h += '<div class="scores">' + HK.scores.map(function (g) {
        var pend = g[4] === "pending", aw = g[1] > g[3];
        return '<div class="gm' + (g[0] === "CAR" || g[2] === "CAR" ? " car" : "") + '"><b class="' + (pend ? "" : aw ? "w" : "lo") + '">' + esc(g[0]) + '</b><span>' + (pend ? "–" : esc(g[1])) + '</span><b class="' + (pend ? "" : aw ? "lo" : "w") + '">' + esc(g[2]) + "</b><span>" + (pend ? "–" : esc(g[3])) + (g[4] && !pend ? " " + esc(g[4]) : "") + "</span>" + (pend ? '<span class="pend">final after press time</span>' : "") + "</div>";
      }).join("") + "</div>";
      if (HK.scoresNote) h += '<p class="small" style="margin-top:6px">' + rich(HK.scoresNote) + cite(HK.scoresSrc) + "</p>";
    } else h += quiet("No NHL games last night.");
    h += "<h3>Top NHL news</h3>" + items(HK.news) + "</section>";

    /* ===== Part 8 · Planner (always open) ===== */
    h += part("plan", "Part 9", "Planner", "The week, the countdowns, the calendar, the school year and the season.", "p-plan");
    h += '<section id="week" class="plan"><h2>This week</h2>' + weekStrip(PEV, E, TD) + "</section>";
    h += '<section id="countdown" class="plan"><h2>Countdowns</h2>' + countdowns(PEV, ctx, TD) + "</section>";
    h += '<section id="calendar" class="plan"><h2>Calendar</h2>';
    if (P.otd) h += '<div class="ap-c" style="margin-bottom:14px"><div class="lbl">' + esc(P.otd.title) + '</div><p style="margin:0">' + rich(P.otd.body) + "</p></div>";
    var FILT = [["all","All"],["nl","NL"],["be","BE"],["de","DE"],["us","US"],["ev","Events"],["out","Out and about"],["hockey","Hockey"],["homed","Home"],["school","School"],["watch","Horizon"],["ex","Exercises"]];
    h += '<div class="cal-nav"><button type="button" id="calprev" aria-label="Previous month">‹</button><span class="cal-title" id="caltitle"></span><button type="button" id="calnext" aria-label="Next month">›</button><button type="button" id="caltoday">This month</button></div>';
    h += '<div class="filt" id="calfilt" role="group" aria-label="Filter the calendar">' + FILT.map(function (f) { return '<button type="button" data-f="' + f[0] + '" aria-pressed="' + (f[0] === "all") + '">' + f[1] + "</button>"; }).join("") + "</div>";
    h += '<div class="legend">' + Object.keys(CAT).map(function (k) { return '<span><i style="background:' + catColor(k) + '"></i>' + esc(CAT[k][0]) + "</span>"; }).join("") + "</div>";
    h += '<div id="calbody"></div>';
    var dl = ((ctx.deadlines && ctx.deadlines.items) || []).filter(function (d) { return d.date >= TD && daysBetween(TD, d.date) <= 90; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    h += '<h3>Deadlines <span class="small">next 90 days · data/deadlines.json, hand-maintained</span></h3>' + (dl.length ? table(["In", "Date", "What"], dl.map(function (d) { var n = daysBetween(TD, d.date), b = d.updated === TD ? "UPDATED" : ""; return '<tr class="' + (n <= 7 ? "soon" : "") + '"><td class="d">' + (n === 0 ? "today" : n + " d") + '</td><td class="d">' + esc(fmtShort(d.date)) + "</td><td><b>" + esc(d.name) + "</b>" + badge(b) + (d.note ? '<div class="small">' + esc(d.note) + "</div>" : "") + "</td></tr>"; }).join("")) : quiet("No deadlines listed. Add items to data/deadlines.json."));
    if (P.culture) h += "<h3>" + esc(P.culture.title) + "</h3><p>" + rich(P.culture.body) + "</p>";
    h += "</section>";
    h += '<section id="school" class="plan"><h2>School year</h2>';
    if (ctx.calendar && ctx.calendar.school) {
      var OV = overlapRows(ctx.calendar, TD);
      h += '<p class="small">Twelve months from today. The bottom row marks the days when every system is off at once.</p>' + gantt(OV, today, { year: true, noXmas: true });
      if (OV.all.length) h += '<p class="small" style="margin-top:8px"><b>Everyone off:</b> ' + OV.all.map(function (s) { return fmtShort(s[0]) + " – " + fmtShort(s[1]); }).join("; ") + ".</p>";
      h += '<p class="small">Sources: ' + Object.keys(ctx.calendar.school).map(function (k) { return esc(ctx.calendar.school[k].name) + " (" + esc(ctx.calendar.school[k].source) + ")"; }).join("; ") + ".</p>";
    } else if (P.school) h += gantt(P.school, today) + (P.school.note ? '<p class="small" style="margin-top:6px">' + rich(P.school.note) + "</p>" : "");
    else h += quiet("No school calendar loaded.");
    h += '<h3>Daylight</h3><div class="panel"><div class="lbl">Hours of daylight at ' + esc(HOME.name) + " through " + today.getFullYear() + '</div><div class="chart" id="daylight" style="min-height:120px"></div></div></section>';
    if (P.season) h += '<section id="season" class="plan"><h2>' + esc(P.season.title) + "</h2>" + (P.season.intro ? '<p class="small">' + rich(P.season.intro) + "</p>" : "") + gantt(P.season, today) + (P.season.notes ? '<ul class="clean" style="margin-top:12px">' + P.season.notes.map(function (n) { return "<li>" + rich(n) + "</li>"; }).join("") + "</ul>" : "") + "</section>";

    /* ===== Footer ===== */
    h += '<a class="next" href="#sources">Sources ↓</a><section id="sources"><h2>Sources</h2><ol class="src">' + (E.sources || []).map(function (s) { return '<li id="s' + s[0] + '" value="' + s[0] + '"><a href="' + esc(s[3]) + '" target="_blank" rel="noopener">' + esc(s[1]) + '</a><span class="o"> · ' + esc(s[2]) + "</span></li>"; }).join("") + "</ol>";
    if (E.flags) h += '<p class="small" style="margin-top:12px"><b>Sourcing flags:</b> ' + rich(E.flags) + "</p>";
    h += '<div class="foot"><div class="arch"><label class="small" for="arch">Past editions</label><select id="arch"></select></div>';
    h += '<div class="search"><form id="searchform" role="search"><label class="small" for="q">Archive search</label><input id="q" type="search" placeholder="Search headlines in every edition" autocomplete="off"><button type="submit">Search</button></form><div id="hits" class="small"></div></div>';
    if (E.changelog) h += '<div><div class="small"><b>What changed in the Readbook</b></div><ul class="clean small" style="margin-top:6px">' + E.changelog.map(function (c) { return "<li>" + esc(c[0]) + ": " + rich(c[1]) + "</li>"; }).join("") + "</ul></div>";
    h += '<p class="small">Open sources only. Personal reading; not an official product.</p></div></section>';
    h += '<section id="health" class="plan"><h2>Readbook health <span class="num">when to remodel</span></h2><p class="small">Computed on the page from the edition and the standing files. Act = the data model or the task prompt needs work; watch = keep an eye on it.</p><div id="healthbody"></div></section>';
    h += '<button type="button" class="totop" id="totop" aria-label="Back to top">Top</button>';

    app.innerHTML = h;
    after(E, ctx);
  }

  /* ---------- post-render wiring ---------- */
  function after(E, ctx) {
    var today = pd(E.date), TD = E.date;
    var log = (ctx.incidents || []).filter(function (x) { var d = pd(x.date); return (today - d) / DAY <= 29 && d <= today; });
    if (!ctx.incidents) log = (E.hybrid && E.hybrid.incidents) || [];
    var FX = ctx.fx ? fxStats(ctx.fx.series, TD) : null, fxc = document.getElementById("fxchart");
    var board = ctx.conflicts && ctx.conflicts.length ? boardView(ctx.conflicts, TD) : null;
    function drawCharts() {
      var mapEl = document.getElementById("map"), trEl = document.getElementById("trend"), bc = document.getElementById("bycountry");
      mapEl.innerHTML = incidentMap(log, mapEl.clientWidth);
      trEl.innerHTML = incidentTrend(log, today, trEl.clientWidth);
      var byC = {}; log.forEach(function (i) { var c = i.country || "?"; byC[c] = (byC[c] || 0) + 1; });
      bc.innerHTML = hbars(Object.keys(byC).sort(function (a, b) { return byC[b] - byC[a]; }).map(function (c) { return [c, byC[c]]; }), { inner: true, mono: true, empty: "No incidents logged yet." });
      app.querySelectorAll(".spark[data-s]").forEach(function (el) { el.innerHTML = sparkline(ctx._sparks[+el.getAttribute("data-s")], el.clientWidth); });
      app.querySelectorAll(".spark[data-ws]").forEach(function (el) { el.innerHTML = sparkline(ctx._ws[el.getAttribute("data-ws")], el.clientWidth); });
      if (fxc && FX) fxc.innerHTML = lineChart(FX.series, { W: fxc.clientWidth, days: +fxc.getAttribute("data-range"), avg: FX.avg, avgLabel: "1y avg ", hi: FX.hi30, lo: FX.lo30, hiLabel: "30d high", loLabel: "30d low", dec: 4, label: "USD/EUR, euros per dollar" });
      var pb = document.getElementById("paybars"); if (pb && FX) pb.innerHTML = vbars(FX.pay.map(function (p) { return [p[0], p[1], p[2], p[2] === FX.last[0].slice(0, 7)]; }), { W: pb.clientWidth, H: 130, fmt: function (v) { return "€" + v; }, label: "$1,000 in euros by month" });
      var wm = document.getElementById("worldmap"); if (wm && board) { var counts = {}; board.forEach(function (b) { counts[b.t.id] = b.n7; }); wm.innerHTML = worldMap(ctx.conflicts, counts, wm.clientWidth); }
      var fc = document.getElementById("fchart"); if (fc && ctx._fser) { var fm = ctx._fmeta || {}; fc.innerHTML = lineChart(ctx._fser, { W: fc.clientWidth, days: 400, dec: fm.decimals != null ? fm.decimals : 0, zero: true, label: fm.label || "" }); }
      var fb = document.getElementById("fbars"); if (fb && E.world && E.world.feature && E.world.feature.bars) fb.innerHTML = vbars(E.world.feature.bars.rows, { W: fb.clientWidth, zero: true, label: E.world.feature.bars.label || "" });
      var fg = document.getElementById("fgeo"); if (fg && ctx._geo) fg.innerHTML = geoSchematic(ctx._geo, fg.clientWidth);
      var hk = document.getElementById("hkchart"); if (hk && ctx.canes) hk.innerHTML = hockeyChart(canesView(ctx.canes, TD).games, hk.clientWidth);
      var dlc = document.getElementById("daylight"); if (dlc) dlc.innerHTML = daylight(HOME.lat, TD, dlc.clientWidth);
      var ab = document.getElementById("armybars"); if (ab && E.army && E.army.depth && E.army.depth.bars) ab.innerHTML = vbars(E.army.depth.bars.rows, { W: ab.clientWidth, zero: true, label: E.army.depth.bars.label || "" });
      Object.keys(ctx._dts || {}).forEach(function (k) { var el = document.getElementById("dts-" + k); if (el) { var m = ((ctx.worldSeries || {}).meta || {})[k] || {}; el.innerHTML = lineChart(ctx._dts[k], { W: el.clientWidth, days: 400, dec: m.decimals != null ? m.decimals : 0, zero: true, label: m.label || k }); } });
    }
    drawCharts();
    var rsz = null; window.addEventListener("resize", function () { clearTimeout(rsz); rsz = setTimeout(drawCharts, 150); });
    document.getElementById("logsrc").textContent = ctx.incidents ? log.length + " incidents in the running log over the last 30 days (" + ctx.incidents.length + " since the log began). Bubbles sized by count; outside the map: Ireland, Iberia and beyond." : "Running log unavailable; showing this edition's incidents only.";

    /* attribution moves, last 7 days */
    var moves = (ctx.attrLog || []).filter(function (m) { var n = daysBetween(m.date, TD); return n >= 0 && n <= 6; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var byId = {}; (ctx.incidents || []).forEach(function (i) { byId[i.id] = i; });
    document.getElementById("attrmoves").innerHTML = moves.length ? '<div class="moves fug">' + nq() + moves.map(function (m) {
      var inc = byId[m.id], b = m.date === TD ? "NEW" : "";
      return '<div class="move ' + fu(b) + '"><span class="d">' + esc(fmtShort(m.date)) + '</span><div><span class="chips"><span class="chip ' + esc(String(m.from || "").toLowerCase()) + '">' + esc(m.from) + "</span><i>→</i>" + '<span class="chip ' + esc(String(m.to || "").toLowerCase()) + '">' + esc(m.to) + "</span></span>" + rich(m.t, srcMap(m.src)) + badge(b) + (inc ? '<p class="small" style="margin:2px 0 0">' + esc(inc.place) + "</p>" : "") + "</div></div>";
    }).join("") + "</div>" : quiet("No attribution changes in the last 7 days.");

    /* within 100 km, last 30 days */
    var near = log.filter(function (i) { return i.local || (i.lat != null && km(HOME.lat, HOME.lon, i.lat, i.lon) <= 100); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    document.getElementById("near").innerHTML = near.length ? '<div class="near">' + near.map(function (i) {
      var dist = i.lat != null ? Math.round(km(HOME.lat, HOME.lon, i.lat, i.lon)) : null;
      return '<div class="nearrow"><span class="d">' + esc(fmtShort(i.date)) + '</span><div><span class="chip code">' + esc(i.code) + '</span><span class="chip ' + esc(String(i.attr || "").toLowerCase()) + '">' + esc(i.attr) + "</span> <b>" + esc(i.place) + "</b>" + (dist != null ? ' <span class="small">· ~' + dist + " km</span>" : "") + "<p>" + esc(i.summary || i.text || "") + "</p></div></div>";
    }).join("") + "</div>" : quiet("Nothing within 100 km in the last 30 days.");

    /* bin day */
    var bt = document.getElementById("bins"), next = null, list = (ctx.bins && ctx.bins.dates) || [];
    list.forEach(function (b) { var d = pd(b[0]); if (d >= today && (!next || d < pd(next[0]))) next = b; });
    if (next) {
      var nd = pd(next[0]), same = list.filter(function (b) { return b[0] === next[0]; }).map(function (b) { return b[1]; });
      bt.querySelector(".val").textContent = fmt(nd);
      bt.querySelector("p").textContent = same.join(", ") + ((nd - today) / DAY === 1 ? " · put out tonight" : "");
    } else {
      bt.querySelector(".val").textContent = "Not loaded";
      bt.querySelector("p").textContent = (ctx.bins && ctx.bins.note) || "Add the Rd4 calendar to data/bins.json.";
    }

    /* health */
    var words0 = 0, stop0 = false;
    Array.prototype.forEach.call(app.children, function (el) { if (stop0 || el.id === "p-plan" || el.id === "sources") { stop0 = true; return; } if (el.id !== "slim") words0 += (el.textContent || "").split(/\s+/).length; });
    var HR = health(E, ctx, TD, words0), nAct = HR.filter(function (r) { return r[1] === "act"; }).length, nWatch = HR.filter(function (r) { return r[1] === "watch"; }).length;
    document.getElementById("healthbody").innerHTML = '<p class="hsum"><span class="chip hs ' + (nAct ? "act" : nWatch ? "watch" : "ok") + '">' + (nAct ? nAct + " to act on" : nWatch ? "nothing to act on" : "all clear") + "</span> " + HR.length + " checks · " + nWatch + " to watch · " + (HR.length - nAct - nWatch) + " ok</p>" + table(["Check", "Detail"], HR.map(function (r) { return '<tr class="h-' + r[1] + '"><td><b>' + esc(r[0]) + '</b><div><span class="chip hs ' + r[1] + '">' + r[1] + "</span></div></td><td>" + esc(r[2]) + "</td></tr>"; }).join(""));

    /* new / updated count */
    document.getElementById("nnew").textContent = app.querySelectorAll(".badge.new").length + " new";
    document.getElementById("nupd").textContent = app.querySelectorAll(".badge.upd").length + " updated";

    /* read time: Front through Hockey */
    var words = 0, stop = false;
    Array.prototype.forEach.call(app.children, function (el) { if (stop || el.id === "p-plan" || el.id === "sources") { stop = true; return; } if (el.id !== "slim") words += (el.textContent || "").split(/\s+/).length; });
    document.getElementById("readtime").textContent = "≈ " + Math.max(1, Math.round(words / 230)) + " min read";

    /* theme control and status line */
    var themeBtns = app.querySelectorAll(".theme button");
    function applyTheme(t) { if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); themeBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-theme") === t)); }); store("rb:theme", t); }
    themeBtns.forEach(function (b) { b.addEventListener("click", function () { applyTheme(b.getAttribute("data-theme")); }); });
    applyTheme(store("rb:theme") || "auto");
    var st = document.getElementById("status");
    function status() { var t = ctx.fetchedAt ? new Date(ctx.fetchedAt) : null; st.textContent = (t ? "Loaded " + String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0") : "") + (navigator.onLine === false ? " · offline, showing the last copy" : ""); st.classList.toggle("off", navigator.onLine === false); }
    window.addEventListener("online", status); window.addEventListener("offline", status); status();

    /* out-and-about filter */
    var evf = document.getElementById("evfilt");
    if (evf) evf.addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return; var f = b.getAttribute("data-f"), left = 0;
      evf.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      app.querySelectorAll("#evlist .evrow").forEach(function (r) { var on = f === "all" || (f === "kids" ? !!r.querySelector(".chip.quiet") : r.getAttribute("data-cat") === f); r.style.display = on ? "" : "none"; if (on) left++; });
      var em = document.getElementById("evempty"); if (em) em.style.display = left ? "none" : "";
    });

    /* new-only filter */
    var newOnly = store("rb:newonly") === "1", tg = document.getElementById("newonly");
    function applyNewOnly() {
      document.body.classList.toggle("newonly", newOnly);
      tg.setAttribute("aria-pressed", String(newOnly));
      app.querySelectorAll(".fug").forEach(function (g) { g.classList.toggle("empty", newOnly && !g.querySelector(".fu.new")); });
      store("rb:newonly", newOnly ? "1" : "0");
    }
    tg.addEventListener("click", function () { newOnly = !newOnly; applyNewOnly(); });
    document.getElementById("newcount").addEventListener("click", function () { newOnly = true; applyNewOnly(); document.getElementById("p-world").scrollIntoView(); });
    applyNewOnly();

    /* USD/EUR range toggle */
    if (fxc && FX) {
      app.querySelectorAll(".fx-tools button").forEach(function (b) {
        b.addEventListener("click", function () {
          var r = parseInt(b.getAttribute("data-range"), 10);
          store("rb:fx:range", r === 365 ? "1y" : "90d");
          app.querySelectorAll(".fx-tools button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          fxc.setAttribute("data-range", r);
          fxc.innerHTML = lineChart(FX.series, { W: fxc.clientWidth, days: r, avg: FX.avg, avgLabel: "1y avg ", hi: FX.hi30, lo: FX.lo30, hiLabel: "30d high", loLabel: "30d low", dec: 4, label: "USD/EUR, euros per dollar" });
        });
      });
    }

    /* scroll containers get a right-edge fade */
    function fades() { app.querySelectorAll(".tw, .scrollx").forEach(function (t) { t.classList.toggle("scroll", t.scrollWidth - t.clientWidth - t.scrollLeft > 4); }); }
    app.addEventListener("scroll", function (e) { var t = e.target; if (t && t.classList && (t.classList.contains("tw") || t.classList.contains("scrollx"))) fades(); }, true);
    window.addEventListener("resize", fades);

    /* calendar: month navigation and filter chips */
    var calState = { y: today.getFullYear(), m: today.getMonth(), f: "all" }, calBody = document.getElementById("calbody"), calTitle = document.getElementById("caltitle");
    function calFilter(cat) { var f = calState.f; return f === "all" || (f === "ev" ? (cat === "mkt" || cat === "pro") : f === "homed" ? (cat === "home" || cat === "deadline") : cat === f); }
    function drawCal() { calBody.innerHTML = calMonth(ctx._pev, calState.y, calState.m, TD, calFilter); calTitle.textContent = MON[calState.m] + " " + calState.y; fades(); }
    document.getElementById("calprev").addEventListener("click", function () { calState.m--; if (calState.m < 0) { calState.m = 11; calState.y--; } drawCal(); });
    document.getElementById("calnext").addEventListener("click", function () { calState.m++; if (calState.m > 11) { calState.m = 0; calState.y++; } drawCal(); });
    document.getElementById("caltoday").addEventListener("click", function () { calState.y = today.getFullYear(); calState.m = today.getMonth(); drawCal(); });
    var filt = document.getElementById("calfilt");
    filt.addEventListener("click", function (ev) { var b = ev.target.closest("button"); if (!b) return; calState.f = b.getAttribute("data-f"); filt.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); drawCal(); });
    drawCal();

    /* archive picker */
    var sel = document.getElementById("arch");
    (ctx.index.editions || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).forEach(function (e) {
      var o = document.createElement("option"); o.value = e.date; o.textContent = fmt(pd(e.date)) + " " + e.date.slice(0, 4) + " · Edition " + e.edition; if (e.date === E.date) o.selected = true; sel.appendChild(o);
    });
    sel.addEventListener("change", function () { location.hash = "ed-" + sel.value; });

    /* archive search */
    var form = document.getElementById("searchform"), hits = document.getElementById("hits");
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var q = document.getElementById("q").value.trim().toLowerCase();
      if (!q) { hits.innerHTML = ""; return; }
      hits.textContent = "Searching…";
      var viaIndex = ctx.searchIndex && ctx.searchIndex.editions && ctx.searchIndex.editions.length;
      (viaIndex ? Promise.resolve(ctx.searchIndex.editions.map(function (b) { return { date: b.date, edition: b.edition, _hits: b.hits }; })) : loadAllEditions(ctx)).then(function (eds) {
        var out = [];
        eds.forEach(function (ed) {
          function add(t, to, where) { if (t && String(t).toLowerCase().indexOf(q) >= 0) out.push({ date: ed.date, edition: ed.edition, t: t, to: to, where: where }); }
          if (ed._hits) { ed._hits.forEach(function (x) { add(x.t, x.to, x.w); }); return; }
          (ed.five || []).forEach(function (f) { add(f.t, f.to, "Five things"); });
          var wi = Array.isArray(ed.world) ? ed.world : ((ed.world || {}).items || []);
          wi.forEach(function (i) { add(i.h, "world", "World"); });
          if (ed.world && ed.world.feature) add(ed.world.feature.title, "feature", "Feature");
          (ed.europe || []).forEach(function (i) { add(i.h, "europe", "Europe"); });
          (ed.euregio || []).forEach(function (i) { add(i.h, "euregio", "Euregio"); });
          ((ed.hybrid || {}).leads || []).forEach(function (l) { add(l.title, l.id, "Lead"); });
          ((ed.hybrid || {}).incidents || []).forEach(function (i) { add(i.place, "hybrid", "Incident"); });
          var ar = ed.army || {};
          (ar.items || []).concat(ar.news || []).forEach(function (i) { add(i.h, "armynews", "Army"); });
          (ar.dod || []).forEach(function (i) { add(i.h, "dod", "DoD"); });
          (ar.congress || []).forEach(function (i) { add(i.h, "congress", "Congress"); });
          ((ar.career || {}).items || []).forEach(function (i) { add(i.h, "career", "Career"); });
          ((ed.nl || {}).items || []).forEach(function (i) { add(i.h, "nl", "Netherlands"); });
          ((ed.offduty || {}).items || []).forEach(function (i) { add(i.h, "offduty", "Off duty"); });
          ((ed.hockey || {}).news || []).forEach(function (i) { add(i.h, "hockey", "NHL"); });
        });
        out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
        if (!viaIndex) {} 
        hits.innerHTML = out.length ? '<ul class="hits">' + out.slice(0, 60).map(function (x) { return '<li><span class="d">' + esc(fmtShort(x.date) + " " + x.date.slice(0, 4)) + '</span><span><a href="#ed-' + x.date + "/" + esc(x.to) + '">' + esc(plain(x.t)) + '</a><span class="w">' + esc(x.where) + "</span></span></li>"; }).join("") + "</ul>" + (out.length > 60 ? '<p class="small">Showing 60 of ' + out.length + " hits.</p>" : "") : quiet("No headline matches “" + q + "” in " + eds.length + (eds.length === 1 ? " edition." : " editions."));
      }).catch(function (e) { hits.innerHTML = quiet("Search failed: " + (e.message || e)); });
    });

    /* sticky header: current part, progress, floating top button */
    var parts = Array.prototype.slice.call(app.querySelectorAll("[data-part]"));
    var cur = document.getElementById("cur"), prog = document.getElementById("prog"), slim = document.getElementById("slim"), totop = document.getElementById("totop");
    var curName = cur.textContent, fadeTimer = null;
    function onScroll() {
      var y = window.scrollY + 80, now = parts[0];
      parts.forEach(function (p) { if (p.getBoundingClientRect().top + window.scrollY <= y) now = p; });
      if (now) {
        var name = now.getAttribute("data-part");
        if (name !== curName) { curName = name; cur.classList.add("fade"); clearTimeout(fadeTimer); fadeTimer = setTimeout(function () { cur.textContent = name; cur.classList.remove("fade"); }, 150); }
        var cls = now.className.split(" ").filter(function (c) { return PART_CLASSES.indexOf(c) >= 0; })[0];
        slim.className = "slim " + (cls || "");
        slim.querySelectorAll("a[data-p]").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-p") === cls); });
        totop.classList.toggle("on", now !== parts[0]);
      }
      var max = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.width = (max > 0 ? Math.min(100, window.scrollY / max * 100) : 0) + "%";
    }
    totop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
    window.removeEventListener("scroll", window.__rbScroll || function () {});
    window.__rbScroll = onScroll;
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    document.title = "Nick's Daily Readbook · " + fmt(today);
    var m = location.hash.match(/^#ed-(\d{4}-\d{2}-\d{2})(?:\/([\w-]+))?$/);
    var target = m ? m[2] : location.hash.slice(1);
    if (target) { var t = document.getElementById(target); if (t) { var det = t.closest("details"); if (det && !det.open) det.open = true; t.scrollIntoView(); } }
  }

  /* ---------- boot ---------- */
  var ctx = {}, allEditions = null;
  function loadAllEditions(ctx) {
    if (allEditions) return allEditions;
    allEditions = Promise.all((ctx.index.editions || []).map(function (e) { return getJSON("data/editions/" + e.date + ".json").then(function (ed) { ed.date = ed.date || e.date; ed.edition = ed.edition || e.edition; return ed; }).catch(function () { return null; }); })).then(function (list) { return list.filter(Boolean); });
    return allEditions;
  }
  function load(date) {
    var target = date || ctx.index.latest;
    return getJSON("data/editions/" + target + ".json").then(function (E) { render(E, ctx); if (!location.hash || location.hash.indexOf("/") < 0) window.scrollTo(0, 0); });
  }
  function fail(e) { app.innerHTML = '<div class="err"><b>Couldn\'t load the Readbook.</b><br>' + esc(e.message || e) + "<br>Check your connection and pull down to refresh.</div>"; }
  function opt(url) { return getJSON(url).catch(function () { return null; }); }
  Promise.all([
    getJSON("data/index.json"),
    opt("data/incidents.json"), opt("data/bins.json"), opt("data/threads.json"), opt("data/horizon.json"),
    opt("data/fx.json"), opt("data/series.json"), opt("data/canes.json"),
    opt("data/conflicts.json"), opt("data/world-series.json"), opt("data/calendar.json"), opt("data/deadlines.json"),
    opt("data/congress.json"), opt("data/exercises.json"), opt("data/releases.json"), opt("data/events.json"), opt("data/idioms.json"), opt("data/ski.json"), opt("data/search-index.json")
  ]).then(function (r) {
    ctx.fetchedAt = Date.now();
    ctx.congress = r[12] && r[12].items; ctx.congressWatch = r[12] && r[12].watch; ctx.congressTiers = r[12] && r[12].tiers; ctx.exercises = r[13] && r[13].exercises; ctx.releases = r[14]; ctx.events = r[15] && r[15].events; ctx.idioms = r[16] && r[16].idioms; ctx.ski = r[17]; ctx.searchIndex = r[18];
    ctx.index = r[0]; ctx.incidents = r[1] && r[1].incidents; ctx.attrLog = r[1] && r[1].attrLog; ctx.bins = r[2];
    ctx.threads = r[3] && r[3].threads; ctx.horizon = r[4] && r[4].events;
    ctx.fx = r[5] && r[5].series && r[5].series.length ? r[5] : null; ctx.series = r[6]; ctx.canes = r[7];
    ctx.conflicts = r[8] && r[8].theatres; ctx.worldSeries = r[9]; ctx.calendar = r[10]; ctx.deadlines = r[11];
    var m = location.hash.match(/^#ed-(\d{4}-\d{2}-\d{2})/);
    return load(m ? m[1] : null);
  }).catch(fail);
  window.addEventListener("hashchange", function () { var m = location.hash.match(/^#ed-(\d{4}-\d{2}-\d{2})/); if (m && ctx.index) load(m[1]).catch(fail); });

  if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); }); }
})();
