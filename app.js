/* Nick's Daily Readbook v3.0 renderer.
   Reads data/index.json, then data/editions/<date>.json, plus the standing files:
   incidents.json, bins.json, threads.json, horizon.json, fx.json, series.json, canes.json.
   All content lives in the JSON files; this file only draws it. Editions in the 2.5 format still render. */
(function () {
  "use strict";
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var CAT = { nl:["Netherlands","--c-nl"], be:["Belgium","--c-be"], de:["Germany","--c-de"], us:["US / AFNORTH","--c-us"], mkt:["Markets & events","--c-mkt"], pro:["Work & world","--c-pro"] };
  var CODE_COLORS = { CYB:"--c-us", SAB:"--crit", UAS:"--c-mkt", UWI:"--c-pro", GNSS:"--c-be", INF:"--c-nl", ELX:"--c-nl", MIG:"--c-de", PRX:"--warn", AIR:"--c-de", SEA:"--c-pro", COE:"--c-be", KIN:"--crit" };
  var PART_CLASSES = ["front","sec","watch","pro","money","home","hockey","plan"];
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
    return '<div class="part ' + cls + '" id="' + id + '" data-part="' + esc(title) + '"><span class="pn">' + esc(n) + '</span><span class="pt">' + esc(title) + '</span>' + (desc ? '<span class="pd">' + esc(desc) + "</span>" : "") + "</div>";
  }
  function table(head, rows, cls) {
    return '<div class="tw"><table' + (cls ? ' class="' + cls + '"' : "") + "><thead><tr>" + head.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows + "</tbody></table></div>";
  }
  function svgText(x, y, t, anchor, size, halo) { return '<text x="' + x + '" y="' + y + '" font-size="' + (size || 10.5) + '" font-family="var(--f-mono)" fill="var(--muted)"' + (anchor ? ' text-anchor="' + anchor + '"' : "") + (halo ? ' stroke="var(--surface)" stroke-width="3" paint-order="stroke" stroke-linejoin="round"' : "") + ">" + esc(t) + "</text>"; }

  /* ---------- gantt ---------- */
  function gantt(g, today) {
    var from = pd(g.from), to = pd(g.to), span = (to - from) / DAY;
    function pct(d) { return ((d - from) / DAY) / span * 100; }
    var h = '<div class="g-axis"><div></div><div class="ticks">';
    (g.ticks || []).forEach(function (t) { var d = pd(t); h += '<span style="left:' + pct(d) + '%">' + d.getDate() + " " + MON[d.getMonth()] + "</span>"; });
    h += "</div></div>";
    var xmas = new Date(from.getFullYear(), 11, 25);
    g.rows.forEach(function (r) {
      h += '<div class="g-row"><div class="g-name">' + esc(r.name) + (r.sub ? "<small>" + esc(r.sub) + "</small>" : "") + '</div><div class="g-track">';
      r.segs.forEach(function (s) {
        var a = pd(s[0]), b = pd(s[1]), w = Math.max(0.8, pct(new Date(+b + DAY)) - pct(a));
        h += '<div class="g-bar" title="' + esc(r.name + ": " + fmt(a) + " – " + fmt(b)) + '" style="left:' + pct(a) + "%;width:" + w + "%;background:var(" + (CAT[r.color] ? CAT[r.color][1] : "--muted") + ')"></div>';
      });
      if (today >= from && today <= to) h += '<div class="g-today" style="left:' + pct(today) + '%"></div>';
      if (xmas >= from && xmas <= to) h += '<div class="g-xmas" style="left:' + pct(xmas) + '%"></div>';
      h += "</div></div>";
    });
    return '<div class="gantt">' + h + "</div>";
  }

  /* ---------- hybrid visuals from the running incident log ---------- */
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
    var cm = codes.length ? byCode[codes[0]] : 1;
    s += '<div class="hbars inner">' + (codes.length ? codes.map(function (c) { return '<div class="hbar"><span class="mono">' + esc(c) + '</span><span class="t"><i style="width:' + (byCode[c] / cm * 100) + '%"></i></span><span class="v">' + byCode[c] + "</span></div>"; }).join("") : quiet("No incidents logged yet.")) + "</div>";
    return s;
  }

  /* ---------- sparklines and the EUR/USD chart ---------- */
  function sparkline(series, W) {
    if (!series || series.length < 2) return "";
    W = Math.max(80, Math.round(W || 160)); var H = 36, P = 3, vals = series.map(function (p) { return p[1]; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), span = hi - lo || 1;
    function X(i) { return P + i / (series.length - 1) * (W - 2 * P); }
    function Y(v) { return P + (1 - (v - lo) / span) * (H - 2 * P); }
    var pts = series.map(function (p, i) { return X(i).toFixed(1) + "," + Y(p[1]).toFixed(1); });
    var last = series[series.length - 1], trend = last[1] >= series[0][1] ? "--up" : "--down";
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="30-day trend: from ' + esc(series[0][0]) + " to " + esc(last[0]) + '">';
    s += '<path d="M' + pts.join(" L") + " L" + X(series.length - 1).toFixed(1) + "," + (H - P) + " L" + X(0).toFixed(1) + "," + (H - P) + ' Z" fill="var(' + trend + ')" fill-opacity=".15"/>';
    s += '<polyline points="' + pts.join(" ") + '" fill="none" stroke="var(' + trend + ')" stroke-width="1.5" stroke-linejoin="round"/>';
    s += '<circle cx="' + X(series.length - 1).toFixed(1) + '" cy="' + Y(last[1]).toFixed(1) + '" r="2.5" fill="var(' + trend + ')"/>';
    return s + "</svg>";
  }
  function niceTicks(lo, hi) {
    var steps = [0.0025, 0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2], best = null;
    for (var i = 0; i < steps.length; i++) {
      var st = steps[i], a = Math.ceil(lo / st - 1e-9) * st, t = [];
      for (var v = a; v <= hi + 1e-9; v += st) t.push(Math.round(v * 10000) / 10000);
      if (t.length >= 3 && t.length <= 4) return t;
      if (t.length >= 3 && (!best || t.length < best.length)) best = t;
    }
    return best ? best.slice(0, 4) : [lo, hi];
  }
  function fxChart(series, days, avg, hi30, lo30, W) {
    var from = addDays(series[series.length - 1][0], -days), view = series.filter(function (p) { return p[0] > from; });
    if (view.length < 2) return "";
    W = Math.max(240, Math.round(W || 360)); var H = 170, L = 44, R = 14, T = 14, B = 22;
    var vals = view.map(function (p) { return p[1]; }), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (avg != null) { lo = Math.min(lo, avg); hi = Math.max(hi, avg); }
    var pad = (hi - lo) * 0.08 || 0.01; lo -= pad; hi += pad;
    function X(i) { return L + i / (view.length - 1) * (W - L - R); }
    function Y(v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="USD/EUR, euros per dollar, last ' + days + ' days">';
    niceTicks(lo, hi).forEach(function (t) { var y = Y(t); s += '<line x1="' + L + '" y1="' + y.toFixed(1) + '" x2="' + (W - R) + '" y2="' + y.toFixed(1) + '" stroke="var(--line)" stroke-width="1"/>' + svgText(L - 6, y + 3.5, t.toFixed(Math.round(t * 1000) % 10 ? 3 : 2), "end", 10.5); });
    if (avg != null) { var ya = Y(avg); s += '<line x1="' + L + '" y1="' + ya.toFixed(1) + '" x2="' + (W - R) + '" y2="' + ya.toFixed(1) + '" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>' + svgText(W - R, ya - 4, "1y avg " + avg.toFixed(4), "end", 10, true); }
    var pts = view.map(function (p, i) { return X(i).toFixed(1) + "," + Y(p[1]).toFixed(1); });
    s += '<path d="M' + pts.join(" L") + " L" + X(view.length - 1).toFixed(1) + "," + (H - B) + " L" + L + "," + (H - B) + ' Z" fill="var(--pc)" fill-opacity=".15"/>';
    s += '<polyline points="' + pts.join(" ") + '" fill="none" stroke="var(--pc)" stroke-width="1.5" stroke-linejoin="round"/>';
    [[hi30, "high", -6], [lo30, "low", 12]].forEach(function (m) {
      if (!m[0]) return;
      var i = -1; view.forEach(function (p, j) { if (p[0] === m[0][0]) i = j; });
      if (i < 0) return;
      var x = X(i), y = Y(m[0][1]), anchor = i > view.length * 0.75 ? "end" : i < view.length * 0.25 ? "start" : "middle";
      var dy = m[2] < 0 ? (y < T + 14 ? 13 : -6) : (y > H - B - 16 ? -6 : 13);
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="var(--surface)" stroke="var(--pc)" stroke-width="1.5"/>' + svgText(x, y + dy, "30d " + m[1] + " " + m[0][1].toFixed(4), anchor, 10, true);
    });
    var li = view.length - 1, lx = X(li), ly = Y(view[li][1]);
    s += '<circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="5" fill="var(--pc)" fill-opacity=".25"/><circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="2.8" fill="var(--pc)"/>';
    var mid = Math.floor(view.length / 2);
    s += svgText(L, H - 6, fmtShort(view[0][0]), "start", 10.5) + svgText(X(mid), H - 6, fmtShort(view[mid][0]), "middle", 10.5) + svgText(W - R, H - 6, fmtShort(view[li][0]), "end", 10.5);
    return s + "</svg>";
  }
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
    return { series: s, last: last, prev: prev, month: m, d1: last[1] - prev[1], d30: m ? last[1] - m[1] : null, avg: avg, hi30: hi30, lo30: lo30, best: best, worst: worst };
  }

  var ICON = {
    rising: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2 L13 11 L1 11 Z" fill="currentColor"/></svg>',
    falling: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 12 L13 3 L1 3 Z" fill="currentColor"/></svg>',
    steady: '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="5.5" width="12" height="3" fill="currentColor"/></svg>',
    watch: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="7" r="1.8" fill="currentColor"/></svg>',
    nodata: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/></svg>'
  };
  var STLBL = { rising: "Rising", falling: "Falling", steady: "Steady", watch: "Watch", nodata: "No data" };

  /* ---------- standing data: threads, horizon, canes ---------- */
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
  function renderThreads(view) {
    if (!view.length) return quiet("No threads are open.");
    return '<div class="fug">' + nq() + view.map(function (v) {
      var map = srcMap(v.last.src);
      var h = '<details class="thread ' + fu(v.badge) + '" data-k="thread-' + esc(v.t.id) + '" id="thread-' + esc(v.t.id) + '"><summary><span class="tname">' + esc(v.t.name) + '<span class="chip st ' + v.status + '">' + v.status + "</span>" + badge(v.badge) + '</span><span class="tlast"><span class="d">' + esc(fmtShort(v.last.date)) + "</span>" + rich(v.last.t, map) + "</span></summary>";
      h += '<div class="tlog">' + v.log.slice().reverse().map(function (e) { return '<div class="e"><span class="d">' + esc(fmtLong(e.date)) + "</span><p>" + rich(e.t, srcMap(e.src)) + "</p></div>"; }).join("");
      h += '<div class="meta">Opened ' + esc(v.t.opened ? fmtLong(v.t.opened) : "—") + " · " + v.log.length + (v.log.length === 1 ? " entry" : " entries") + (v.status === "quiet" ? " · quiet: nothing logged for " + v.age + " days" : "") + "</div></div></details>";
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
    var complete = games.length === C.games.length;
    var w = 0, l = 0, o = 0;
    games.forEach(function (g) { if (g.res === "W") w++; else if (g.res === "L") l++; else o++; });
    return { games: games, record: complete && C.record ? C.record : w + "-" + l + "-" + o, points: complete && C.points != null ? C.points : 2 * w + o, metro: complete ? C.metro : null, season: C.season };
  }
  function ordinal(n) { var s = ["th","st","nd","rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  /* ---------- main render ---------- */
  function render(E, ctx) {
    var today = pd(E.date), TD = E.date, h = "";
    var T = E.today || {};
    var isMonday = today.getDay() === 1;
    var FX = ctx.fx && ctx.fx.series ? fxStats(ctx.fx.series, TD) : null;
    var threads = ctx.threads && ctx.threads.length ? threadView(ctx.threads, TD) : null;
    var horizonEvents = ctx.horizon && ctx.horizon.length ? ctx.horizon : null;
    var CV = canesView(ctx.canes, TD);
    var SER = ctx.series || {};

    /* masthead */
    h += '<header class="mast"><div class="eyebrow">' + esc(E.place || "Hoensbroek · Parkstad Limburg") + "</div><h1>Nick's Daily Readbook</h1>";
    h += '<div class="date">' + esc(E.weekday + " " + today.getDate() + " " + MON[today.getMonth()] + " " + today.getFullYear()) + "</div>";
    h += '<div class="mast-meta"><span><b>Edition ' + esc(E.edition) + "</b></span><span>Look-back " + esc(E.lookback) + '</span><span id="readtime"></span></div>';
    h += '<div class="rule" aria-hidden="true">' + ["--p-sec","--p-watch","--p-pro","--p-money","--p-home","--p-hockey"].map(function (c) { return '<i style="background:var(' + c + ')"></i>'; }).join("") + "</div>";
    if (E.note) h += '<p class="note">' + rich(E.note) + "</p>";
    h += "</header>";

    /* slim header */
    h += '<div class="slim" id="slim"><div class="slim-row"><span class="cur" id="cur">Front</span>' +
      '<a class="front" href="#front">Front</a><a class="sec" href="#p-sec">Security</a><a class="watch" href="#p-watch">Watchlist</a><a class="pro" href="#p-pro">Profession</a><a class="money" href="#p-money">Money</a><a class="home" href="#p-home">Home</a><a class="hockey" href="#p-hockey">Hockey</a><a class="plan" href="#p-plan">Planner</a><a href="#sources">Sources</a>' +
      '<button type="button" class="tg" id="newonly" aria-pressed="false" title="Show only items with a NEW or UPDATED badge">New only</button>' +
      '</div><div class="prog"><i id="prog"></i></div></div>';

    /* today strip */
    h += '<div class="strip" id="front" data-part="Front">';
    if (T.weather) { var w = T.weather; h += '<div class="tile"><div class="lbl">Weather · ' + esc(E.town || "Hoensbroek") + '</div><div class="val">' + esc(w.hi) + "° / " + esc(w.lo) + "°</div><p>" + esc(w.now) + ". " + esc(w.tomorrow) + ". Sun " + esc(w.sunrise) + "–" + esc(w.sunset) + "." + cite(w.src) + "</p></div>"; }
    if (T.canes) h += '<div class="tile hockey"><div class="lbl">Hurricanes</div><div class="val">' + esc(T.canes.line) + "</div><p>" + esc(T.canes.sub) + cite(T.canes.src) + "</p></div>";
    else if (CV) { var lg = CV.games[CV.games.length - 1]; h += '<div class="tile hockey"><div class="lbl">Hurricanes</div><div class="val">' + esc(lg.res + " " + lg.gf + "–" + lg.ga + (lg.home ? " vs " : " at ") + lg.opp) + "</div><p>" + esc(CV.record + " · " + CV.points + " pts") + "</p></div>"; }
    if (T.markets) h += '<div class="tile"><div class="lbl">Markets</div><div class="mini-mk">' + T.markets.map(function (m) { return "<span>" + esc(m[0]) + '</span><span class="chg ' + esc(m[2]) + '">' + esc(m[1]) + "</span>"; }).join("") + "</div></div>";
    if (FX) h += '<div class="tile money"><div class="lbl">USD/EUR · ECB</div><div class="val">' + FX.last[1].toFixed(4) + '</div><p><span class="chg ' + dir(FX.d1) + '">' + signed(FX.d1, 4) + " (" + signed(FX.d1 / FX.prev[1] * 100, 2, "%") + ")</span> vs " + esc(fmtShort(FX.prev[0])) + "</p></div>";
    h += '<div class="tile" id="bins"><div class="lbl">Bin day</div><div class="val">…</div><p></p></div>';
    h += '<button type="button" class="tile newcount" id="newcount" title="Show only new and updated items"><div class="lbl">This edition</div><div class="val"><span id="nnew">…</span><small id="nupd"></small></div><p>Tap to show only what changed</p></button>';
    h += "</div>";

    /* front: five things, pick, today and tomorrow */
    h += '<section class="front"><h2>Five things</h2><ol class="five">';
    (E.five || []).forEach(function (f) { h += '<li class="' + esc(f.part === "watch" ? "watch" : f.part) + '">' + rich(f.t) + ' <a class="go" href="#' + esc(f.to) + '">Read →</a></li>'; });
    h += "</ol>";
    if (E.pick) h += '<div class="pick">' + rich(E.pick.t) + (E.pick.to ? ' <a href="#' + esc(E.pick.to) + '">Go →</a>' : "") + "</div>";
    if (T.items && T.items.length) {
      h += '<h3>Today and tomorrow</h3><div class="tt">';
      T.items.forEach(function (t) { h += '<div><span class="k" style="--kc:var(' + (CAT[t.cat] ? CAT[t.cat][1] : "--muted") + ')">' + esc(t.k) + "</span><p>" + rich(t.t) + "</p></div>"; });
      h += "</div>";
    }
    h += "</section>";

    /* ===== Part 1 · Security ===== */
    var HY = E.hybrid || {};
    h += part("sec", "Part 1", "Security", "Hybrid activity, Europe, the wider world and the Euregio.", "p-sec");
    h += '<section id="hybrid" class="sec"><h2>Hybrid watch</h2><h3>Incident log</h3>';
    if (HY.incidents && HY.incidents.length) {
      h += '<div class="incidents fug">' + nq();
      HY.incidents.forEach(function (i) {
        h += '<article class="inc ' + fu(i.badge) + '" id="inc-' + esc(i.id) + '"><div class="inc-top"><span class="when">' + esc(i.when) + '</span><span class="chip code">' + esc(i.code) + "</span>" + (i.local ? '<span class="chip local">LOCAL</span>' : "") + '<span class="chip ' + esc((i.attr || "").toLowerCase()) + '">' + esc(i.attr) + "</span>" + badge(i.badge) + '</div><div class="place">' + esc(i.place) + "</div><p>" + rich(i.text) + "</p></article>";
      });
      h += "</div>";
      var counts = [0, 0, 0, 0, 0, 0];
      HY.incidents.forEach(function (i) { var n = parseInt(String(i.attr).replace("A", ""), 10); if (!isNaN(n)) counts[n]++; });
      var names = ["unexplained", "suspected", "named", "attributed", "charged", "convicted"];
      h += '<div class="ladder" role="img" aria-label="Incidents by attribution level">' + counts.map(function (c, n) { return '<div class="rung ' + (c ? "hot" : "zero") + '"><b>A' + n + "</b><span>" + c + "</span><small>" + names[n] + "</small></div>"; }).join("") + "</div>";
    } else h += quiet("No new incidents in the window.");
    h += '<div class="viz"><div class="panel"><div class="lbl">Running log · last 30 days</div><div id="map"></div></div><div class="panel"><div class="lbl">Per day and by type</div><div id="trend"></div></div></div>';
    h += '<p class="small" id="logsrc"></p>';
    h += '<h3>Attribution moves <span class="small">last 7 days</span></h3><div id="attrmoves"></div>';
    h += '<h3>Within 100 km <span class="small">last 30 days</span></h3><div id="near"></div>';
    if (HY.leads && HY.leads.length) {
      h += "<h3>Lead analysis</h3>";
      HY.leads.forEach(function (l, n) {
        h += '<details class="lead" id="' + esc(l.id) + '" data-k="lead-' + n + '"' + (n === 0 ? " open" : "") + '><summary><span class="t">' + esc(l.title) + '</span><span class="te">' + rich(l.teaser) + '</span></summary><div class="lead-body"><dl>';
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

    var WO = E.world || [];
    h += '<section id="world" class="sec"><h2>World <span class="num">beyond Europe</span></h2>';
    if (WO.length) {
      var rc = {}; WO.forEach(function (x) { rc[x.region] = (rc[x.region] || 0) + 1; });
      h += '<div class="regions">' + Object.keys(rc).map(function (r) { return "<span>" + esc(r) + "<b>" + rc[r] + "</b></span>"; }).join("") + '</div><div class="world fug">' + nq();
      WO.forEach(function (x) {
        h += '<article class="wcard ' + fu(x.badge) + '"><div class="wtop"><span class="tag rg">' + esc(x.region) + "</span>" + (x.conf ? '<span class="conf">confidence: ' + esc(x.conf) + "</span>" : "") + badge(x.badge) + "</div><h4>" + rich(x.h) + "</h4><p>" + rich(x.body) + "</p>" + (x.sw ? '<p class="sw-line"><b class="l">So what</b>' + rich(x.sw) + "</p>" : "") + "</article>";
      });
      h += "</div>";
    } else h += quiet();
    h += "</section>";
    if (E.euregio && E.euregio.length) h += '<section id="euregio" class="sec"><h2>Local &amp; Euregio</h2>' + items(E.euregio) + "</section>";

    /* ===== Part 2 · Watchlist ===== */
    var P = E.planner || {};
    h += part("watch", "Part 2", "Watchlist", "Threads that keep moving, and what is coming up.", "p-watch");
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

    /* ===== Part 3 · Profession ===== */
    var AR = E.army || {}, AP = E.aperture || {};
    h += part("pro", "Part 3", "Profession", "The Army as an institution, and the thinking pieces.", "p-pro");
    h += '<section id="army" class="pro"><h2>US Army &amp; USAREUR-AF</h2>';
    if (AR.cards) h += '<div class="cards">' + AR.cards.map(function (c) { return '<div class="card"><div class="lbl">' + esc(c.l) + '</div><div class="val">' + esc(c.v) + "</div><p>" + rich(c.n) + "</p></div>"; }).join("") + "</div>";
    h += items(AR.items) + "</section>";

    h += '<section id="aperture" class="pro"><h2>Aperture</h2><div class="ap">';
    if (AP.contrarian) h += '<div class="ap-c"><div class="lbl">Contrarian read</div><p>' + rich(AP.contrarian) + "</p></div>";
    if (AP.weak) h += '<div class="ap-c"><div class="lbl">Weak signal</div><p>' + rich(AP.weak) + "</p></div>";
    if (AP.number) h += '<div class="ap-c numday"><div class="big">' + esc(AP.number.n) + '</div><div><div class="lbl">Number of the day</div><p style="margin:0">' + rich(AP.number.t) + "</p></div></div>";
    if (AP.inject) h += '<div class="ap-c"><div class="lbl">Exercise inject</div><p>' + rich(AP.inject) + "</p></div>";
    if (AP.question) h += '<div class="ap-c"><div class="lbl">Question for the staff</div><p>' + rich(AP.question) + "</p></div>";
    if (AP.deep) {
      var D = AP.deep;
      h += '<details class="deep" data-k="deep" open><summary><div class="eyebrow" style="color:var(--pc)">' + esc(D.kind) + "</div><h4>" + esc(D.title) + '</h4></summary><div class="deep-body">' + (D.body || []).map(function (p) { return "<p>" + rich(p) + "</p>"; }).join("");
      if (D.table) h += table(D.table.head, D.table.rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + rich(c) + "</td>"; }).join("") + "</tr>"; }).join(""), "lbl1");
      h += "</div></details>";
    }
    if (AP.longread) h += '<div class="ap-c"><div class="lbl">Long read</div><p><a href="' + esc(AP.longread.url) + '" target="_blank" rel="noopener">' + esc(AP.longread.title) + "</a> · " + esc(AP.longread.outlet) + "</p><p>" + rich(AP.longread.why) + "</p></div>";
    var ROT = [["mon","Mon","Historical echo"],["tue","Tue","Outside-in"],["wed","Wed","Red lens"],["thu","Thu","Concept"],["fri","Fri","Ally spotlight + week in hybrid"],["sat","Sat","Week in war: TTPs"],["sun","Sun","Week in defence tech"]];
    h += '<div class="ap-c"><div class="lbl">Deep cuts and special topics</div><div class="rota">' + ROT.map(function (r) { return '<div class="' + (r[0] === AP.rota ? "on " : "") + (r[0] === "sat" || r[0] === "sun" ? "sp" : "") + '"><b>' + r[1] + "</b>" + r[2] + "</div>"; }).join("") + "</div></div>";
    h += "</div></section>";

    /* ===== Part 4 · Money ===== */
    var M = E.money || {};
    h += part("money", "Part 4", "Money", "Last session's markets and the numbers that move prices, pay and rates.", "p-money");
    h += '<section id="markets" class="money"><h2>Markets &amp; economy <span class="num">' + esc(M.asof || "") + "</span></h2>";
    var sparks = []; ctx._sparks = sparks;
    if (M.cards) h += '<div class="cards">' + M.cards.map(function (c) {
      var arrow = c[3] === "up" ? "▲ " : c[3] === "down" ? "▼ " : "", src = null, sk = null;
      [c[5], c[6]].forEach(function (v) { if (typeof v === "number") src = v; else if (typeof v === "string" && v) sk = v; });
      if (!sk) { var lab = String(c[0]).toLowerCase(); SERIES_BY_LABEL.forEach(function (m) { if (!sk && lab.indexOf(m[0]) === 0) sk = m[1]; }); }
      var ser = sk && SER[sk] && SER[sk].length ? SER[sk].filter(function (p) { return p[0] <= TD; }).slice(-30) : null;
      return '<div class="card"><div class="lbl">' + esc(c[0]) + '</div><div class="val">' + esc(c[1]) + '</div><p><span class="chg ' + esc(c[3]) + '">' + (c[2] ? arrow + esc(c[2]) : "") + "</span> " + esc(c[4]) + cite(src) + "</p>" + (ser ? '<div class="spark" data-s="' + (sparks.push(ser) - 1) + '" title="' + esc(fmtShort(ser[0][0]) + " – " + fmtShort(ser[ser.length - 1][0])) + '"></div>' : "") + "</div>";
    }).join("") + "</div>";
    if (M.driver) h += "<p>" + rich(M.driver) + "</p>";
    if (M.ytd) {
      var mx = Math.max.apply(null, M.ytd.map(function (y) { return Math.abs(y[1]); })) * 1.15;
      h += '<h3>Year to date</h3><div class="hbars">' + M.ytd.map(function (y) { return '<div class="hbar"><span>' + esc(y[0]) + '</span><span class="t"><i style="width:' + (Math.abs(y[1]) / mx * 100) + '%"></i></span><span class="v">' + (y[1] >= 0 ? "+" : "") + y[1].toFixed(1) + "%</span></div>"; }).join("") + '<p class="small" style="margin:2px 0 0">Change since 1 January at the last close.' + cite(M.ytdSrc) + "</p></div>";
    }
    h += "</section>";
    if (FX) {
      var range = store("rb:fx:range") === "1y" ? 365 : 90;
      h += '<section id="fx" class="money"><h2>USD/EUR <span class="num">euros per dollar · ECB</span></h2><div class="fx">';
      h += '<div class="fx-top"><span class="big tab">' + FX.last[1].toFixed(4) + '</span><span class="asof">' + esc(fmtLong(FX.last[0])) + " · € per $</span></div>";
      h += '<div class="fx-ch"><div><div class="lbl">Since ' + esc(fmtShort(FX.prev[0])) + '</div><div class="v chg ' + dir(FX.d1) + '">' + signed(FX.d1, 4) + '</div><div class="p chg ' + dir(FX.d1) + '">' + signed(FX.d1 / FX.prev[1] * 100, 2, "%") + "</div></div>";
      if (FX.month) h += '<div><div class="lbl">Since ' + esc(fmtShort(FX.month[0])) + '</div><div class="v chg ' + dir(FX.d30) + '">' + signed(FX.d30, 4) + '</div><div class="p chg ' + dir(FX.d30) + '">' + signed(FX.d30 / FX.month[1] * 100, 2, "%") + "</div></div>";
      h += '<div><div class="lbl">30-day range</div><div class="v">' + FX.lo30[1].toFixed(4) + '</div><div class="p">to ' + FX.hi30[1].toFixed(4) + "</div></div></div>";
      h += '<div class="fx-tools"><button type="button" data-range="90" aria-pressed="' + (range === 90) + '">90 days</button><button type="button" data-range="365" aria-pressed="' + (range === 365) + '">1 year</button></div>';
      h += '<div class="chart" id="fxchart" data-range="' + range + '"></div>';
      var eu = function (r) { return "€" + num(1000 * r, 0); };
      h += '<p class="pay"><b class="l">Pay</b>$1,000 is ' + eu(FX.last[1]) + " today" + (FX.month ? ", " + eu(FX.month[1]) + " a month ago" : "") + "; 12-month best " + eu(FX.best[1]) + " (" + esc(fmtShort(FX.best[0])) + "), worst " + eu(FX.worst[1]) + " (" + esc(fmtShort(FX.worst[0])) + "). Up means the dollar buys more euros.</p>";
      h += '<p class="small" style="margin:8px 0 0"><a href="' + esc(ctx.fx.url || "https://www.ecb.europa.eu/stats/eurofxref/") + '" target="_blank" rel="noopener">' + esc(ctx.fx.source || "ECB") + "</a>, one value per ECB business day, inverted from the ECB's dollars-per-euro quote.</p></div></section>";
    }
    h += '<section id="rates" class="money">';
    if (M.rates) h += "<h2>Rates and prices</h2>" + table(["Measure", "Latest", "Note"], M.rates.map(function (r) { return "<tr><td>" + esc(r[0]) + '</td><td class="d">' + esc(r[1]) + "</td><td>" + rich(r[2]) + "</td></tr>"; }).join(""), "lbl1");
    if (M.fuel) {
      var F = M.fuel, minP = Math.min.apply(null, F.rows.map(function (r) { return r[1]; })), minD = Math.min.apply(null, F.rows.map(function (r) { return r[2]; }));
      h += '<h3>Fuel across the borders <span class="small">' + esc(F.asof) + "</span></h3>";
      h += table(["Country", "Euro 95 €/l", "Diesel €/l"], F.rows.map(function (r) { return "<tr><td>" + esc(r[0]) + '</td><td class="d"' + (r[1] === minP ? ' style="color:var(--up);font-weight:700"' : "") + ">" + r[1].toFixed(3) + '</td><td class="d"' + (r[2] === minD ? ' style="color:var(--up);font-weight:700"' : "") + ">" + r[2].toFixed(3) + "</td></tr>"; }).join(""), "lbl1");
      h += '<p class="small" style="margin-top:6px">' + rich(F.note) + cite(F.src) + (F.weekly ? " Updated " + esc(F.weekly) + "." : "") + "</p>";
    }
    if (M.week) h += '<h3>Week ahead</h3><ul class="clean">' + M.week.map(function (x) { return "<li>" + rich(x) + "</li>"; }).join("") + "</ul>";
    if (M.fy) h += '<p class="sw-line" style="margin-top:12px"><b class="l">For you</b>' + rich(M.fy) + "</p>";
    h += "</section>";

    /* ===== Part 5 · Home ===== */
    var NL = E.nl || {}, AF = E.afnorth || {}, OD = E.offduty || {};
    h += part("home", "Part 5", "Home", "The Netherlands, the family, weekends and the Dutch corner.", "p-home");
    h += '<section id="nl" class="home"><h2>Netherlands</h2>' + items(NL.items);
    if (NL.temp) h += '<p class="small" style="margin-top:12px"><b>Political temperature:</b> ' + rich(NL.temp) + "</p>";
    h += "</section>";
    h += '<section id="afnorth" class="home"><h2>AFNORTH &amp; family</h2>';
    if (AF.intro) h += '<p class="small">' + rich(AF.intro) + "</p>";
    if (AF.rows && AF.rows.length) h += table(["Date", "Event", "Action"], AF.rows.map(function (r) { return '<tr class="' + (r[3] === "soon" ? "soon" : "") + '"><td class="d">' + esc(r[0]) + "</td><td>" + rich(r[1]) + "</td><td>" + rich(r[2]) + "</td></tr>"; }).join(""));
    else h += quiet("Nothing new in the next 14 days.");
    if (AF.note) h += '<p class="small" style="margin-top:8px">' + rich(AF.note) + "</p>";
    h += "</section>";
    h += '<section id="offduty" class="home"><h2>Off duty <span class="num">1-hour radius</span></h2>' + items(OD.items, { inlineTag: true }, "Nothing new worth the drive today.");
    if (OD.weekend) {
      h += "<h3>Weekend guide</h3>" + table(["Day", "Event", "Place", "Why go", "Cost / booking"], OD.weekend.rows.map(function (r) { return "<tr>" + r.map(function (c, j) { return "<td" + (j === 0 ? ' class="d"' : "") + ">" + rich(c) + "</td>"; }).join("") + "</tr>"; }).join(""));
      if (OD.weekend.gem) h += '<p class="sw-line" style="margin-top:10px"><b class="l">Hidden gem</b>' + rich(OD.weekend.gem) + "</p>";
      if (OD.weekend.family) h += '<p class="sw-line"><b class="l">Family pick</b>' + rich(OD.weekend.family) + "</p>";
    }
    if (OD.weather) h += '<p class="small">' + rich(OD.weather) + "</p>";
    h += "</section>";
    h += '<section id="dutch" class="home"><h2>Dutch corner</h2>';
    if (NL.lees) h += '<div class="lees"><div class="lbl">Lees mee</div><blockquote lang="nl">' + rich(NL.lees.nl) + cite(NL.lees.src) + "</blockquote><dl>" + NL.lees.gloss.map(function (g) { return '<dt lang="nl">' + esc(g[0]) + "</dt><dd>" + rich(g[1]) + "</dd>"; }).join("") + "</dl></div>";
    if (NL.phrase) h += '<div class="nl-word"><div class="w" lang="nl">' + esc(NL.phrase.w) + '</div><p class="small" style="margin:2px 0 10px">“' + esc(NL.phrase.en) + "” · " + esc(NL.phrase.lvl) + "</p><p>" + rich(NL.phrase.note) + "</p></div>";
    h += "</section>";

    /* ===== Part 6 · Hockey ===== */
    var HK = E.hockey || {};
    h += part("hockey", "Part 6", "Hockey", "Carolina first, then the league.", "p-hockey");
    h += '<section id="hockey" class="hockey"><h2>Hurricanes' + (CV ? ' <span class="num">' + esc(CV.season) + "</span>" : "") + "</h2>";
    if (CV) {
      h += '<div class="season" role="list" aria-label="Last ten results">' + CV.games.slice(-10).map(function (g) { return '<div class="g ' + g.res + '" role="listitem" title="' + esc(fmtShort(g.date) + (g.home ? " vs " : " at ") + g.opp + ": " + g.res + " " + g.gf + "–" + g.ga) + '"><b>' + g.res + "</b>" + (g.home ? "" : "@") + esc(g.opp) + "</div>"; }).join("") + "</div>";
      h += '<p class="recline">Record <b>' + esc(CV.record) + "</b> · <b>" + CV.points + "</b> pts" + (CV.metro ? " · <b>" + ordinal(CV.metro) + "</b> in the Metro" : "") + " · " + CV.games.length + " games</p>";
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
    h += '<h3>Scores <span class="small">' + esc(HK.scoresDate || "") + "</span></h3>";
    if (HK.scores && HK.scores.length) {
      h += '<div class="scores">' + HK.scores.map(function (g) {
        var pend = g[4] === "pending", aw = g[1] > g[3];
        return '<div class="gm' + (g[0] === "CAR" || g[2] === "CAR" ? " car" : "") + '"><b class="' + (pend ? "" : aw ? "w" : "lo") + '">' + esc(g[0]) + '</b><span>' + (pend ? "–" : esc(g[1])) + '</span><b class="' + (pend ? "" : aw ? "lo" : "w") + '">' + esc(g[2]) + "</b><span>" + (pend ? "–" : esc(g[3])) + (g[4] && !pend ? " " + esc(g[4]) : "") + "</span>" + (pend ? '<span class="pend">final after press time</span>' : "") + "</div>";
      }).join("") + "</div>";
      if (HK.scoresNote) h += '<p class="small" style="margin-top:6px">' + rich(HK.scoresNote) + cite(HK.scoresSrc) + "</p>";
    } else h += quiet("No NHL games last night.");
    h += "<h3>Top NHL news</h3>" + items(HK.news) + "</section>";

    /* ===== Part 7 · Planner ===== */
    var plOpen = store("rb:open:planner:" + TD); plOpen = plOpen == null ? (P.open != null ? !!P.open : isMonday) : plOpen === "1";
    h += '<details class="planner plan" data-k="planner:' + TD + '"' + (plOpen ? " open" : "") + '><summary>' + part("plan", "Part 7", "Planner", "On this day, calendar, school holidays and the seasonal planner. Tap to " + (plOpen ? "fold" : "open") + ".", "p-plan") + "</summary>";
    h += '<section id="calendar" class="plan"><h2>Calendar &amp; culture</h2>';
    if (P.otd) h += '<div class="ap-c" style="margin-bottom:14px"><div class="lbl">' + esc(P.otd.title) + '</div><p style="margin:0">' + rich(P.otd.body) + "</p></div>";
    if (P.events && P.calFrom && P.calTo) {
      var from = pd(P.calFrom), to = pd(P.calTo);
      var FILT = [["all","All"],["nl","NL"],["be","BE"],["de","DE"],["us","US"],["ev","Events"]];
      h += '<div class="filt" id="calfilt" role="group" aria-label="Filter the calendar">' + FILT.map(function (f) { return '<button type="button" data-f="' + f[0] + '" aria-pressed="' + (f[0] === "all") + '">' + f[1] + "</button>"; }).join("") + "</div>";
      h += '<div class="legend">' + Object.keys(CAT).map(function (k) { return '<span><i style="background:var(' + CAT[k][1] + ')"></i>' + esc(CAT[k][0]) + "</span>"; }).join("") + '</div><div class="cal" id="cal">';
      ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(function (d) { h += '<div class="dow">' + d + "</div>"; });
      for (var i = 0; i < (from.getDay() + 6) % 7; i++) h += '<div class="day out"></div>';
      for (var d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        var k = key(d), ev = P.events.filter(function (e) { return e[0] === k; });
        h += '<div class="day' + (k === E.date ? " today" : "") + '"' + (ev.length ? ' title="' + esc(ev.map(function (e) { return e[2]; }).join("\n")) + '"' : "") + '><div class="n"><b>' + d.getDate() + "</b>" + (d.getDate() === 1 || +d === +from ? " " + MON[d.getMonth()] : "") + "</div>";
        if (ev.length) h += '<div class="dots">' + ev.map(function (e) { return '<i data-cat="' + esc(e[1]) + '" style="background:var(' + (CAT[e[1]] ? CAT[e[1]][1] : "--muted") + ')"></i>'; }).join("") + '</div><div class="lab">' + ev.map(function (e) { return '<span data-cat="' + esc(e[1]) + '">' + esc(e[2]) + "</span>"; }).join('<span class="sep"> · </span>') + "</div>";
        h += "</div>";
      }
      h += '</div><div class="agenda">' + table(["Date", "What · where · practical effect"], P.events.map(function (e) {
        var dd = pd(e[0]); return '<tr data-cat="' + esc(e[1]) + '"><td class="d"><span class="dot" style="background:var(' + (CAT[e[1]] ? CAT[e[1]][1] : "--muted") + ')"></span>' + dd.getDate() + " " + MON[dd.getMonth()] + "</td><td><b>" + esc(e[2]) + '</b><div class="small">' + esc([e[3], e[4], e[5]].filter(Boolean).join(" · ")) + "</div></td></tr>";
      }).join("")) + '<p class="quiet" id="calempty" style="display:none">Nothing in this category in the window.</p></div>';
    }
    if (P.culture) h += "<h3>" + esc(P.culture.title) + "</h3><p>" + rich(P.culture.body) + "</p>";
    if (P.school) h += "<h3>School holidays</h3>" + gantt(P.school, today) + (P.school.note ? '<p class="small" style="margin-top:6px">' + rich(P.school.note) + "</p>" : "");
    h += "</section>";
    if (P.season) h += '<section id="season" class="plan"><h2>' + esc(P.season.title) + "</h2>" + (P.season.intro ? '<p class="small">' + rich(P.season.intro) + "</p>" : "") + gantt(P.season, today) + (P.season.notes ? '<ul class="clean" style="margin-top:12px">' + P.season.notes.map(function (n) { return "<li>" + rich(n) + "</li>"; }).join("") + "</ul>" : "") + "</section>";
    h += "</details>";

    /* ===== Footer ===== */
    h += '<section id="sources"><h2>Sources</h2><ol class="src">' + (E.sources || []).map(function (s) { return '<li id="s' + s[0] + '" value="' + s[0] + '"><a href="' + esc(s[3]) + '" target="_blank" rel="noopener">' + esc(s[1]) + '</a><span class="o"> · ' + esc(s[2]) + "</span></li>"; }).join("") + "</ol>";
    if (E.flags) h += '<p class="small" style="margin-top:12px"><b>Sourcing flags:</b> ' + rich(E.flags) + "</p>";
    h += '<div class="foot"><div class="arch"><label class="small" for="arch">Past editions</label><select id="arch"></select></div>';
    h += '<div class="search"><form id="searchform" role="search"><label class="small" for="q">Archive search</label><input id="q" type="search" placeholder="Search headlines in every edition" autocomplete="off"><button type="submit">Search</button></form><div id="hits" class="small"></div></div>';
    if (E.changelog) h += '<div><div class="small"><b>What changed in the Readbook</b></div><ul class="clean small" style="margin-top:6px">' + E.changelog.map(function (c) { return "<li>" + esc(c[0]) + ": " + rich(c[1]) + "</li>"; }).join("") + "</ul></div>";
    h += '<p class="small">Open sources only. Personal reading; not an official product.</p></div></section>';
    h += '<button type="button" class="totop" id="totop" aria-label="Back to top">Top</button>';

    app.innerHTML = h;
    after(E, ctx);
  }

  /* ---------- post-render wiring ---------- */
  function after(E, ctx) {
    var today = pd(E.date), TD = E.date;
    /* running incident log */
    var log = (ctx.incidents || []).filter(function (x) { var d = pd(x.date); return (today - d) / DAY <= 29 && d <= today; });
    if (!ctx.incidents) log = (E.hybrid && E.hybrid.incidents) || [];
    var FX = ctx.fx ? fxStats(ctx.fx.series, TD) : null, fxc = document.getElementById("fxchart");
    function drawCharts() {
      var mapEl = document.getElementById("map"), trEl = document.getElementById("trend");
      mapEl.innerHTML = incidentMap(log, mapEl.clientWidth);
      trEl.innerHTML = incidentTrend(log, today, trEl.clientWidth);
      app.querySelectorAll(".spark[data-s]").forEach(function (el) { el.innerHTML = sparkline(ctx._sparks[+el.getAttribute("data-s")], el.clientWidth); });
      if (fxc && FX) fxc.innerHTML = fxChart(FX.series, +fxc.getAttribute("data-range"), FX.avg, FX.hi30, FX.lo30, fxc.clientWidth);
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

    /* new / updated count */
    var nNew = app.querySelectorAll(".badge.new").length, nUpd = app.querySelectorAll(".badge.upd").length;
    document.getElementById("nnew").textContent = nNew + " new";
    document.getElementById("nupd").textContent = nUpd + " updated";

    /* read time: Front through Hockey */
    var words = 0, stop = false;
    Array.prototype.forEach.call(app.children, function (el) { if (stop || el.classList.contains("planner") || el.id === "sources") { stop = true; return; } if (el.id !== "slim") words += (el.textContent || "").split(/\s+/).length; });
    document.getElementById("readtime").textContent = "≈ " + Math.max(1, Math.round(words / 230)) + " min read";

    /* remembered fold state */
    app.querySelectorAll("details[data-k]").forEach(function (d) {
      var k = "rb:open:" + d.getAttribute("data-k"), v = store(k);
      if (v != null && d.getAttribute("data-k").indexOf("planner") !== 0) d.open = v === "1";
      d.addEventListener("toggle", function () { store(k, d.open ? "1" : "0"); });
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
    document.getElementById("newcount").addEventListener("click", function () { newOnly = true; applyNewOnly(); document.getElementById("p-sec").scrollIntoView(); });
    applyNewOnly();

    /* EUR/USD range toggle */
    if (fxc && FX) {
      app.querySelectorAll(".fx-tools button").forEach(function (b) {
        b.addEventListener("click", function () {
          var r = parseInt(b.getAttribute("data-range"), 10);
          store("rb:fx:range", r === 365 ? "1y" : "90d");
          app.querySelectorAll(".fx-tools button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          fxc.setAttribute("data-range", r);
          fxc.innerHTML = fxChart(FX.series, r, FX.avg, FX.hi30, FX.lo30, fxc.clientWidth);
        });
      });
    }

    /* calendar filter chips */
    var filt = document.getElementById("calfilt");
    if (filt) {
      filt.addEventListener("click", function (ev) {
        var b = ev.target.closest("button"); if (!b) return;
        var f = b.getAttribute("data-f");
        filt.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        function match(cat) { return f === "all" || (f === "ev" ? (cat === "mkt" || cat === "pro") : cat === f); }
        var left = 0;
        app.querySelectorAll("#cal [data-cat], .agenda tr[data-cat]").forEach(function (el) { var on = match(el.getAttribute("data-cat")); el.style.display = on ? "" : "none"; if (on && el.tagName === "TR") left++; });
        app.querySelectorAll("#cal .lab").forEach(function (lab) { var vis = Array.prototype.filter.call(lab.querySelectorAll("span[data-cat]"), function (s) { return s.style.display !== "none"; }); lab.querySelectorAll(".sep").forEach(function (s) { s.style.display = "none"; }); vis.forEach(function (s, i) { if (i) { var p = s.previousElementSibling; if (p && p.classList.contains("sep")) p.style.display = ""; } }); });
        document.getElementById("calempty").style.display = left ? "none" : "";
      });
    }

    /* tables that scroll sideways get a right-edge fade */
    function fades() { app.querySelectorAll(".tw").forEach(function (t) { t.classList.toggle("scroll", t.scrollWidth - t.clientWidth - t.scrollLeft > 4); }); }
    app.querySelectorAll(".tw").forEach(function (t) { t.addEventListener("scroll", fades, { passive: true }); });
    fades();
    window.addEventListener("resize", fades);

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
      loadAllEditions(ctx).then(function (eds) {
        var out = [];
        eds.forEach(function (ed) {
          function add(t, to, where) { if (t && String(t).toLowerCase().indexOf(q) >= 0) out.push({ date: ed.date, edition: ed.edition, t: t, to: to, where: where }); }
          (ed.five || []).forEach(function (f) { add(f.t, f.to, "Five things"); });
          (ed.europe || []).forEach(function (i) { add(i.h, "europe", "Europe"); });
          (ed.world || []).forEach(function (i) { add(i.h, "world", "World"); });
          (ed.euregio || []).forEach(function (i) { add(i.h, "euregio", "Euregio"); });
          ((ed.hybrid || {}).leads || []).forEach(function (l) { add(l.title, l.id, "Lead"); });
          ((ed.hybrid || {}).incidents || []).forEach(function (i) { add(i.place, "hybrid", "Incident"); });
          ((ed.army || {}).items || []).forEach(function (i) { add(i.h, "army", "Army"); });
          ((ed.nl || {}).items || []).forEach(function (i) { add(i.h, "nl", "Netherlands"); });
          ((ed.offduty || {}).items || []).forEach(function (i) { add(i.h, "offduty", "Off duty"); });
          ((ed.hockey || {}).news || []).forEach(function (i) { add(i.h, "hockey", "NHL"); });
        });
        out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
        hits.innerHTML = out.length ? '<ul class="hits">' + out.slice(0, 60).map(function (x) { return '<li><span class="d">' + esc(fmtShort(x.date) + " " + x.date.slice(0, 4)) + '</span><span><a href="#ed-' + x.date + "/" + esc(x.to) + '">' + rich(x.t).replace(/<sup class="r">.*?<\/sup>/g, "") + '</a><span class="w">' + esc(x.where) + "</span></span></li>"; }).join("") + "</ul>" + (out.length > 60 ? '<p class="small">Showing 60 of ' + out.length + " hits.</p>" : "") : quiet("No headline matches “" + q + "” in " + eds.length + (eds.length === 1 ? " edition." : " editions."));
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
        if (name !== curName) {
          curName = name;
          cur.classList.add("fade");
          clearTimeout(fadeTimer);
          fadeTimer = setTimeout(function () { cur.textContent = name; cur.classList.remove("fade"); }, 150);
        }
        var cls = now.className.split(" ").filter(function (c) { return PART_CLASSES.indexOf(c) >= 0; })[0];
        slim.className = "slim " + (cls || "");
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
    opt("data/fx.json"), opt("data/series.json"), opt("data/canes.json")
  ]).then(function (r) {
    ctx.index = r[0]; ctx.incidents = r[1] && r[1].incidents; ctx.attrLog = r[1] && r[1].attrLog; ctx.bins = r[2];
    ctx.threads = r[3] && r[3].threads; ctx.horizon = r[4] && r[4].events;
    ctx.fx = r[5] && r[5].series && r[5].series.length ? r[5] : null; ctx.series = r[6]; ctx.canes = r[7];
    var m = location.hash.match(/^#ed-(\d{4}-\d{2}-\d{2})/);
    return load(m ? m[1] : null);
  }).catch(fail);
  window.addEventListener("hashchange", function () { var m = location.hash.match(/^#ed-(\d{4}-\d{2}-\d{2})/); if (m && ctx.index) load(m[1]).catch(fail); });

  if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); }); }
})();
