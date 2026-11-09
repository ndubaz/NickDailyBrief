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
              hockey:["Hurricanes","--p-hockey"], home:["Bins & home","--p-home"], school:["School breaks","--p-pro"], watch:["Horizon","--p-watch"], deadline:["Deadlines","--crit"], info:["Clocks","--muted"], out:["Out and about","--c-mkt"], ex:["Exercises","--p-pro"], me:["Yours","--ink"], nfl:["Saints & Cardinals","--p-sec"], tv:["TV","--p-reading"], mail:["From your mail","--c-us"] };
  var CODE_COLORS = { CYB:"--c-us", SAB:"--crit", UAS:"--c-mkt", UWI:"--c-pro", GNSS:"--c-be", INF:"--c-nl", ELX:"--c-nl", MIG:"--c-de", PRX:"--warn", AIR:"--c-de", SEA:"--c-pro", COE:"--c-be", KIN:"--crit" };
  var PART_CLASSES = ["front","news","money","watch","reading","home"];
  var PART_DEF = { front: ["front","Today","#front"], news: ["news","The news","#p-news"], money: ["money","Markets & economy","#p-money"], watch: ["watch","The watch","#p-watch"], reading: ["reading","The reading","#p-reading"], home: ["home","Home and planning","#p-home"] };
  var PARTS = ["front","news","money","reading","watch","home"].map(function (k) { return PART_DEF[k]; });
  function setPartOrder(weekend) { PARTS = (weekend ? ["front","reading","news","money","watch","home"] : ["front","news","money","reading","watch","home"]).map(function (k) { return PART_DEF[k]; }); }
  function pn(cls) { var i = PARTS.map(function (p) { return p[0]; }).indexOf(cls); return "Part " + i; }
  var TIERS = { news: ["world","hybrid","europe","countries","euregio","army","nato","deftech","frontier","nl"], money: ["markets","fx","fuel","rates"], watch: ["board","numbers","horizon","threads","novel","congress-sec","releases","sota","forecasts"], reading: ["feature","research","philosophy","depth","ttpsec","aperture"], home: ["local","afnorth","offduty","dutch","snow","hockey","week","coming","weather","countdown","tv","calendar","year"] };
  var EVCAT = { music:"Music", markets:"Markets", museums:"Museums", sport:"Sport", kids:"Kids", food:"Food", outdoors:"Outdoors", festival:"Festivals" };
  var SERIES_BY_LABEL = [["s&p 500","spx"],["dow","dji"],["nasdaq","ndx"],["russell","rut"],["aex","aex"],["stoxx","stoxx"],["dax","dax"],["brent","brent"],["dutch ttf","ttf"],["ttf","ttf"],["gold","gold"],["us 10-year","us10y"],["vix","vix"]];
  var HOME = { lat: 50.89, lon: 5.98, name: "Heerlen" };
  var app = document.getElementById("app");
  var DAY = 864e5;
  var ctx = {};

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
  function fmt(d) { return !d || isNaN(d.getTime()) ? "" : DOW[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()]; }
  function fmtShort(s) { var d = pd(s); return isNaN(d.getTime()) ? "" : d.getDate() + " " + MON[d.getMonth()]; }
  function fmtLong(s) { var d = pd(s); return isNaN(d.getTime()) ? "" : d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear(); }
  function daysBetween(a, b) { return Math.round((pd(b) - pd(a)) / DAY); }
  function addDays(s, n) { var d = pd(s); d.setDate(d.getDate() + n); return key(d); }
  function badge(b) { if (!b) return ""; var u = b === "UPDATED"; return '<span class="badge ' + (u ? "upd" : "new") + '">' + esc(b) + "</span>"; }
  function fu(b) { return "fu" + (b ? " new" : ""); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function quiet(t, cls) { return '<p class="quiet' + (cls ? " " + cls : "") + '">' + esc(t || "No significant change today.") + "</p>"; }
  function nq() { return quiet("Nothing new or updated here today.", "nq"); }
  function getJSON(url) { return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(url + " " + r.status); var lm = r.headers.get("last-modified"); if (lm) { var t = Date.parse(lm); if (t && (!ctx.dataUpdated || t > ctx.dataUpdated)) ctx.dataUpdated = t; } return r.json(); }); }
  function stamp(ms) { try { var d = new Date(ms); return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d).replace(",", "") + " CET"; } catch (e) { return new Date(ms).toISOString().slice(0, 16).replace("T", " "); } }
  function num(v, dp) { return (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
  function signed(v, dp, suffix) { return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp }) + (suffix || ""); }
  function dir(v) { return v > 0 ? "up" : v < 0 ? "down" : "flat"; }
  function km(lat1, lon1, lat2, lon2) { var R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180, a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2); return 2 * R * Math.asin(Math.sqrt(a)); }
  function catColor(c) { return "var(" + (CAT[c] ? CAT[c][1] : "--muted") + ")"; }
  function ordinal(n) { var s = ["th","st","nd","rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function cet(utc) { try { return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(utc)); } catch (e) { return ""; } }
  function cetHour(utc) { try { return parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", hour12: false }).format(new Date(utc)), 10); } catch (e) { return -1; } }
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
    var nu = (it.links || []).some(function (l) { return String(l).indexOf("novel:") === 0; });
    var h = '<div class="item ' + fu(it.badge) + (nu ? " nu" : "") + '">';
    h += "<h4>" + rich(it.h) + badge(it.badge) + (nu ? '<span class="badge nu">NEW USE</span>' : "") + (opts.inlineTag && it.tag ? ' <span class="tag">' + esc(it.tag) + "</span>" : "") + "</h4>";
    if (!opts.inlineTag && (it.tag || it.conf)) h += "<div>" + (it.tag ? '<span class="tag">' + esc(it.tag) + "</span>" : "") + (it.conf ? '<span class="conf">confidence: ' + esc(it.conf) + "</span>" : "") + "</div>";
    if (it.body) h += "<p>" + rich(it.body) + "</p>";
    if (it.q && it.q.t) h += '<p class="lq"><span class="o" lang="' + esc(it.q.lang || "") + '">' + rich(it.q.t) + "</span>" + (it.q.en ? ' <span class="small">' + rich(it.q.en) + "</span>" : "") + cite(it.q.src) + "</p>";
    h += linkChips(it.links);
    if (it.sw) h += '<p class="sw-line"><b class="l">So what</b>' + rich(it.sw) + "</p>";
    if (it.fy) h += '<p class="sw-line"><b class="l">For you</b>' + rich(it.fy) + "</p>";
    return h + "</div>";
  }
  function items(list, opts, q) { return list && list.length ? '<div class="fug">' + nq() + list.map(function (i) { return item(i, opts); }).join("") + "</div>" : quiet(q); }
  function part(cls, n, title, desc, id) {
    var prev = PARTS[Math.max(0, PARTS.map(function (p) { return p[0]; }).indexOf(cls) - 1)];
    return (cls !== "front" && cls !== "news" ? nextLink(prev[0]) : "") + '<div class="part ' + cls + '" id="' + id + '" data-part="' + esc(title) + '"><span class="pn">' + esc(n) + '</span><span class="pt">' + esc(title) + '</span>' + (desc ? '<span class="pd">' + esc(desc) + "</span>" : "") + "</div>";
  }
  function table(head, rows, cls) {
    var i = 0;
    rows = rows.replace(/<tr([^>]*)>|<td([^>]*)>/g, function (m, tr, td) { if (tr !== undefined) { i = 0; return m; } var th = head[i] || ""; i++; return "<td" + (td || "") + ' data-th="' + esc(th) + '">'; });
    var cells = (rows.match(/<td/g) || []).length, txt = rows.replace(/<[^>]+>/g, ""), avg = cells ? txt.length / cells : 0;
    return '<div class="tw' + (head.length >= 5 || (head.length >= 3 && avg > 22) ? " stack" : "") + '"><table' + (cls ? ' class="' + cls + '"' : "") + "><thead><tr>" + head.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows + "</tbody></table></div>";
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
    var h = '<div class="g-axis"><div></div><div class="ticks">', grid = "";
    if (opts.year) {
      var ms = [], cur = new Date(from.getFullYear(), from.getMonth(), 1);
      while (cur <= to) { var nx = new Date(cur.getFullYear(), cur.getMonth() + 1, 1), a = Math.max(+cur, +from), b = Math.min(+nx, +to + DAY), l = pct(new Date(a)), w = pct(new Date(b)) - l; if (w >= 3.5) ms.push({ l: l, w: w, d: cur, first: a === +cur }); cur = nx; }
      ms.forEach(function (m, i) { h += '<span class="mo' + (i % 2 ? " alt" : "") + '" style="left:' + m.l.toFixed(2) + "%;width:" + m.w.toFixed(2) + '%">' + MON[m.d.getMonth()] + '<i class="yr">' + (m.d.getMonth() === 0 || (i === 0 && m.w >= 8) ? " ’" + String(m.d.getFullYear()).slice(2) : "") + "</i></span>"; if (m.first && m.l > 0.5) grid += '<i class="g-m" style="left:' + m.l.toFixed(2) + '%"></i>'; });
    } else (g.ticks || []).forEach(function (t) { var d = pd(t); h += '<span style="left:' + pct(d) + '%">' + d.getDate() + " " + MON[d.getMonth()] + "</span>"; });
    h += "</div></div>";
    var xmas = new Date(from.getFullYear(), 11, 25);
    g.rows.forEach(function (r) {
      h += '<div class="g-row' + (r.all ? " all" : "") + '"><div class="g-name">' + esc(r.name) + (r.sub ? "<small>" + esc(r.sub) + "</small>" : "") + '</div><div class="g-track">' + grid;
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
      var st = mults[i] * base, a = Math.ceil(lo / st - 1e-9) * st || 0, t = [];
      for (var v = a; v <= hi + 1e-9; v += st) t.push(v);
      if (t.length >= 3 && t.length <= 4) return { ticks: t, step: st };
      if (t.length >= 3 && (!best || t.length < best.ticks.length)) best = { ticks: t, step: st };
    }
    return best ? { ticks: best.ticks.slice(0, 4), step: best.step } : { ticks: [lo, hi], step: range };
  }
  function tickFmt(v, step) { var e = Math.floor(Math.log(step) / Math.LN10 + 1e-9), m = Math.round(step / Math.pow(10, e) * 10) / 10, d = Math.min(4, Math.max(0, -e + (m % 1 ? 1 : 0))); return v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  /* generic line chart: series ascending [[date, value]], opts {W, days, avg, hi, lo, dec, label, zero} */
  function lineChart(series, o) {
    o = o || {};
    var view = o.days ? series.filter(function (p) { return p[0] > addDays(series[series.length - 1][0], -o.days); }) : series.slice();
    if (view.length < 2) return "";
    var W = Math.max(240, Math.round(o.W || 360)), H = o.H || 170, L = o.L || 48, R = 14, T = 14, B = 22, dec = o.dec == null ? 4 : o.dec;
    var vals = view.map(function (p) { return p[1]; }), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (o.avg != null) { lo = Math.min(lo, o.avg); hi = Math.max(hi, o.avg); }
    var ex = o.extra ? o.extra.filter(function (p) { return p[0] >= view[0][0] && p[0] <= view[view.length - 1][0]; }) : null; if (ex && ex.length > 1) ex.forEach(function (p) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }); else ex = null;
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
    if (ex) { var idx = {}; view.forEach(function (p, i) { idx[p[0]] = i; }); var ep = ex.filter(function (p) { return idx[p[0]] != null; }).map(function (p) { return X(idx[p[0]]).toFixed(1) + "," + Y(p[1]).toFixed(1); }); if (ep.length > 1) { var el = ex[ex.length - 1]; s += '<polyline points="' + ep.join(" ") + '" fill="none" stroke="var(--up)" stroke-width="1.5" stroke-linejoin="round"/>' + '<circle cx="' + X(idx[el[0]]).toFixed(1) + '" cy="' + Y(el[1]).toFixed(1) + '" r="2.8" fill="var(--up)"/>' + svgText(W - R, Y(el[1]) - 5, (o.extraLabel || "") + el[1].toFixed(dec), "end", 10, true, "var(--up)"); } }
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
    var lo = o.zero || mn < 0 ? Math.min(0, mn) : Math.max(0, mn - (mx - mn) * 0.5), hi = Math.max(mx, lo + 1e-9);
    function Y(v) { return T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B); }
    var base = Y(Math.max(lo, Math.min(0, hi))), s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(o.label || "Bar chart") + '">';
    s += '<line x1="' + L + '" y1="' + base.toFixed(1) + '" x2="' + (W - R) + '" y2="' + base.toFixed(1) + '" stroke="var(--line)" stroke-width="1"/>';
    rows.forEach(function (r, i) {
      var x = L + i * bw + bw * 0.15, w = bw * 0.7, yv = Y(r[1]), y = Math.min(yv, base), hot = r[3];
      s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.abs(base - yv).toFixed(1) + '" fill="var(--pc)" fill-opacity="' + (hot ? ".9" : ".45") + '"><title>' + esc(r[0] + ": " + (o.fmt ? o.fmt(r[1]) : r[1])) + "</title></rect>";
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
  function worldMap(theatres, counts, W, land) {
    W = Math.max(240, Math.round(W || 360)); var lon0 = -100, lon1 = 150, lat0 = -40, lat1 = 80, H = Math.round(W * (lat1 - lat0) / (lon1 - lon0) * 1.2);
    function X(lon) { return (lon - lon0) / (lon1 - lon0) * W; }
    function Y(lat) { return H - (lat - lat0) / (lat1 - lat0) * H; }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" style="overflow:hidden" role="img" aria-label="Map of tracked theatres, sized by events logged in the last 7 days">';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="var(--pc)" fill-opacity=".05"/>';
    if (land && land.length) {
      var d = "";
      land.forEach(function (ring) { var inView = ring.some(function (p) { return p[0] >= lon0 - 5 && p[0] <= lon1 + 5 && p[1] >= lat0 - 5 && p[1] <= lat1 + 5; }); if (!inView) return; d += "M" + ring.map(function (p) { return X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1); }).join("L") + "Z"; });
      s += '<path d="' + d + '" fill="var(--surface)" stroke="var(--muted)" stroke-opacity=".55" stroke-width=".8" stroke-linejoin="round" fill-rule="evenodd"/>';
    }
    for (var lo = -90; lo <= 150; lo += 30) s += '<line x1="' + X(lo).toFixed(1) + '" y1="0" x2="' + X(lo).toFixed(1) + '" y2="' + H + '" stroke="var(--line)" stroke-width="1" stroke-opacity=".6"/>';
    for (var la = -30; la <= 60; la += 30) s += '<line x1="0" y1="' + Y(la).toFixed(1) + '" x2="' + W + '" y2="' + Y(la).toFixed(1) + '" stroke="var(--line)" stroke-width="' + (la === 0 ? 1.5 : 1) + '" stroke-opacity=".6"/>';
    if (!land || !land.length) [["N. America", 45, -88], ["S. America", -22, -60], ["Europe", 64, 0], ["Africa", -14, 14], ["Asia", 46, 95], ["Pacific", 4, 140]].forEach(function (l) { s += svgText(X(l[2]), Y(l[1]), l[0], "middle", 10); });
    var hx = X(HOME.lon), hy = Y(HOME.lat);
    s += '<rect x="' + (hx - 3) + '" y="' + (hy - 3) + '" width="6" height="6" fill="var(--ink)" transform="rotate(45 ' + hx + " " + hy + ')"/>';
    theatres.forEach(function (t) {
      if (t.lat == null) return;
      var n = counts[t.id] || 0, r = n ? 6 + 3 * Math.sqrt(n) : 4.5, x = X(t.lon), y = Y(t.lat);
      if (n) s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (r + 5).toFixed(1) + '" fill="var(--pc)" fill-opacity=".18"/>';
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="' + (n ? "var(--pc)" : "var(--surface)") + '" stroke="var(--pc)" stroke-width="1.5"><title>' + esc(t.name + ": " + n + " logged in 7 days") + "</title></circle>";
      var lp = t.lp || "below"; if (lp === "right" && x > W - 48) lp = "left"; if (lp === "left" && x < 48) lp = "right";
      var lx = lp === "right" ? x + r + 4 : lp === "left" ? x - r - 4 : x, ly = lp === "above" ? y - r - 4 : lp === "below" ? y + r + 11 : y + 3.5;
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
  function daylight(lat, todayKey, W, todayH) {
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
    var doy = Math.round((pd(todayKey) - jan1) / DAY) + 1, th = pts[doy - 1], tx = X(doy), ty = Y(th), lh = todayH > 0 ? todayH : th, hh = Math.floor(lh), mm = Math.round((lh - hh) * 60), minD0 = pts.indexOf(mn) + 1, nearMin = Math.abs(doy - minD0) < 75, ly = nearMin ? Math.max(T + 10, Y(mn) - 22) : ty - 8;
    s += '<line x1="' + tx.toFixed(1) + '" y1="' + T + '" x2="' + tx.toFixed(1) + '" y2="' + (H - B) + '" stroke="var(--crit)" stroke-width="1" stroke-dasharray="2 2"/><circle cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="3.5" fill="var(--crit)"/>' + svgText(tx + (doy > ndays * 0.7 ? -8 : 8), ly, "today " + hm(lh) + (nearMin ? " · shortest " + mn.toFixed(1) + " h" : ""), doy > ndays * 0.7 ? "end" : "start", 10.5, true, "var(--ink)");
    var minD = pts.indexOf(mn) + 1, maxD = pts.indexOf(mx) + 1;
    s += svgText(X(maxD), Y(mx) - 5, "longest " + mx.toFixed(1) + " h", "middle", 10, true) + (nearMin ? "" : svgText(X(minD) + (minD > ndays * 0.7 ? -6 : 6), Y(mn) - 5, "shortest " + mn.toFixed(1) + " h", minD > ndays * 0.7 ? "end" : "start", 10, true));
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
  var GAL = 3.785411784; /* litres per US gallon */
  function fuelStats(fuel, fx, asOf) {
    /* fuel.json holds the CBS daily average pump price in euros per litre; fx.json the ECB rate in dollars per euro. Each day converts at that day's ECB rate, or the last one before it at weekends and holidays. */
    var raw = (((fuel || {}).series || {})["nl-e95"] || []).filter(function (p) { return p[0] <= asOf && typeof p[1] === "number" && p[1] > 0; });
    var rates = ((fx || {}).series || []).filter(function (p) { return typeof p[1] === "number" && p[1] > 0; });
    if (raw.length < 2 || !rates.length) return null;
    var j = 0, rate = null, rows = [];
    raw.forEach(function (p) { while (j < rates.length && rates[j][0] <= p[0]) { rate = rates[j][1]; j++; } if (rate) { var n = taxFreePerLitre(fuel, "e95", p[1]); rows.push([p[0], p[1], p[1] * rate * GAL, n != null ? n : null, n != null ? n * rate * GAL : null]); } });
    if (rows.length < 2) return null;
    var last = rows[rows.length - 1];
    function at(daysBack) { var k = addDays(last[0], -daysBack), v = null; rows.forEach(function (p) { if (p[0] <= k) v = p; }); return v; }
    var year = rows.filter(function (p) { return p[0] > addDays(last[0], -365); }), avg = year.reduce(function (a, p) { return a + p[2]; }, 0) / year.length;
    var usd = rows.map(function (p) { return [p[0], p[2]]; }), y90 = usd.filter(function (p) { return p[0] > addDays(last[0], -90); });
    var hi = y90.reduce(function (a, p) { return !a || p[1] > a[1] ? p : a; }, null), lo = y90.reduce(function (a, p) { return !a || p[1] < a[1] ? p : a; }, null);
    var yhi = year.reduce(function (a, p) { return !a || p[2] > a[2] ? p : a; }, null), ylo = year.reduce(function (a, p) { return !a || p[2] < a[2] ? p : a; }, null);
    var nato = rows[rows.length - 1][4] != null ? rows.filter(function (p) { return p[4] != null; }).map(function (p) { return [p[0], p[4]]; }) : null;
    return { rows: rows, usd: usd, nato: nato, last: last, week: at(7), month: at(30), year: at(365), avg: avg, hi: hi, lo: lo, yhi: yhi, ylo: ylo, src: fuel.source, url: fuel.url };
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
  function logList(log, cls) { var yr = (ctx._TD || "").slice(0, 4); return '<div class="' + (cls || "tlog") + '">' + log.slice().reverse().map(function (e) { return '<div class="e"><span class="d">' + esc(fmtShort(e.date) + (e.date.slice(0, 4) !== yr ? " " + e.date.slice(0, 4) : "")) + "</span><p>" + rich(e.t, srcMap(e.src)) + "</p></div>"; }).join("") + "</div>"; }
  function renderThreads(view) {
    if (!view.length) return quiet("No threads are open.");
    return '<div class="fug">' + nq() + view.map(function (v) {
      var h = '<details class="thread ' + fu(v.badge) + '" id="thread-' + esc(v.t.id) + '" open><summary><span class="tname">' + esc(v.t.name) + '<span class="chip st ' + esc(v.status) + '">' + esc(v.status) + "</span>" + badge(v.badge) + inToday("thread", v.t.id) + '</span><span class="tlast"><span class="d">' + esc(fmtShort(v.last.date)) + "</span>" + rich(v.last.t, srcMap(v.last.src)) + "</span></summary>";
      h += '<div class="tlog">' + (v.log.length > 1 ? logList(v.log.slice(0, -1).slice(-9), "sub") : "") + '<div class="meta">Opened ' + esc(v.t.opened ? fmtLong(v.t.opened) : "—") + " · " + v.log.length + (v.log.length === 1 ? " entry" : " entries") + (v.log.length > 10 ? ", last 10 shown" : "") + (v.status === "quiet" ? " · quiet: nothing logged for " + v.age + " days" : "") + "</div></div></details>";
      return h;
    }).join("") + "</div>";
  }
  /* one dated list for the watch: horizon.json, exercises, Congress deadlines, forecasts resolving, elections */
  /* "8–10 Nov" or "28 Nov – 2 Dec" in dateText: the event runs to the second day */
  function hzEnd(e) {
    if (e.end) return e.end; if (!e.date || !e.dateText) return null;
    var m = /^(\d{1,2})\s*[–-]\s*(\d{1,2})\s+([A-Z][a-z]{2})/.exec(e.dateText) || /^\d{1,2}\s+[A-Z][a-z]{2}\s*[–-]\s*(\d{1,2})\s+([A-Z][a-z]{2})/.exec(e.dateText);
    if (!m) return null;
    var day = +m[m.length - 2], mon = MON.indexOf(m[m.length - 1]); if (mon < 0) return null;
    var y = +e.date.slice(0, 4); if (mon < pd(e.date).getMonth()) y++;
    var k = y + "-" + String(mon + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0"); return k > e.date ? k : null;
  }
  function horizonAll(ctx, P, TD) {
    var rows = [];
    (ctx.horizon || []).forEach(function (e) { var en = hzEnd(e); if (e.date && (en || e.date) >= TD && e.status !== "done") rows.push({ date: e.date < TD ? TD : e.date, end: en || undefined, kind: e.h ? "Hybrid" : "", t: e.t + (en && e.date < TD ? " (under way)" : ""), n: e.n, src: e.src, dateText: e.dateText, status: e.status, badge: e.added === TD ? "NEW" : e.updated === TD ? "UPDATED" : "", id: "hz-" + e.id }); });
    (ctx.exercises || []).forEach(function (x) { if (x.to >= TD) { var on = x.from <= TD; rows.push({ date: on ? TD : x.from, end: x.to, kind: "Exercise", t: x.name + (on ? " (under way)" : ""), n: [x.lead, x.where, x.forces].filter(Boolean).join(" · "), src: x.src, dateText: x.from === x.to ? "" : fmtShort(x.from) + " – " + fmtShort(x.to), badge: x.added === TD ? "NEW" : x.updated === TD ? "UPDATED" : "", id: "ex-" + x.id, link: "exercise:" + x.id }); } });
    (ctx.congress || []).forEach(function (c) { if (c.deadline && c.deadline >= TD) rows.push({ date: c.deadline, kind: "Congress", t: (c.title || c.post) + ": deadline", n: plain(c.next || ""), badge: "", id: "cgd-" + c.id, link: "congress:" + c.id }); });
    (((ctx.forecasts || {}).items) || []).forEach(function (f) { if (f.status === "open" && f.resolves >= TD) rows.push({ date: f.resolves, kind: "Forecast", t: "Resolves: " + f.q, n: Math.round(f.p * 100) + "% · made " + fmtShort(f.made), badge: f.made === TD ? "NEW" : "", id: "fcr-" + f.id }); });
    (ctx.countries || []).forEach(function (c) { if (c.election && c.election.next && c.election.next >= TD) rows.push({ date: c.election.next, kind: "Election", t: c.name + " election", n: c.election.dateText || "", id: "el-" + c.id, link: "country:" + c.id }); });
    if (!rows.length && P && P.horizon && P.horizon.length) return quiet("Horizon items are in the edition only; the standing file is empty.");
    rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    if (!rows.length) return quiet("Nothing dated on the horizon.");
    var groups = [["Next 14 days", []], ["15 to 90 days", []], ["Beyond 90 days", []]];
    rows.forEach(function (e) { var n = daysBetween(TD, e.date); groups[n <= 14 ? 0 : n <= 90 ? 1 : 2][1].push(e); });
    var h = '<p class="small">Run entries, exercises, Congress deadlines, forecasts resolving and elections in one order. Filled marker = hybrid-relevant.</p><div class="fug">' + nq();
    groups.forEach(function (g) {
      if (!g[1].length) return;
      var shown = g[0] === "Beyond 90 days" ? g[1].slice(0, 12) : g[1], more = g[1].length - shown.length;
      h += '<div class="tl-group">' + esc(g[0]) + (more > 0 ? ' <span class="small">· first 12 of ' + g[1].length + ", the rest on the calendar</span>" : "") + '</div><div class="tl">' + shown.map(function (e) {
        var n = daysBetween(TD, e.date);
        return '<div class="tl-i ' + fu(e.badge) + (e.kind === "Hybrid" ? " h" : "") + '" id="' + esc(e.id) + '"><div class="d"><span>' + esc(e.dateText || fmtShort(e.date)) + '</span><span class="rel">' + relDay(n) + "</span>" + (e.kind && e.kind !== "Hybrid" ? '<span class="chip st">' + esc(e.kind) + "</span>" : "") + (e.status === "reported" ? '<span class="chip rep">reported</span>' : "") + icsLink(e.t, e.date, e.end) + "</div><h4>" + esc(e.t) + "</h4>" + badge(e.badge) + (e.n ? "<p>" + rich(e.n, srcMap(e.src)) + "</p>" : "") + "</div>";
      }).join("") + "</div>";
    });
    return h + "</div>";
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
    (P.events || []).forEach(function (e) { ev.push({ date: e[0], cat: e[1], t: e[2], sub: [e[3], e[4], e[5]].filter(Boolean).join(" · "), src: "edition", prio: e[6] === true }); });
    ((ctx.bins && ctx.bins.dates) || []).forEach(function (b) { ev.push({ date: b[0], cat: "home", t: "Bin: " + b[1].split("·")[0].trim(), sub: b[1], src: "bins" }); });
    if (ctx.canes) {
      (ctx.canes.games || []).forEach(function (g) { ev.push({ date: g.date, cat: "hockey", t: "CAR " + g.res + " " + g.gf + "–" + g.ga + (g.home ? " vs " : " at ") + g.opp, sub: "Final", src: "canes" }); });
      (ctx.canes.upcoming || []).forEach(function (g) { var d = g.utc ? cetDate(g.utc) : g.date, hr = g.utc ? cetHour(g.utc) : -1; ev.push({ date: d, cat: "hockey", t: "Canes " + (g.home ? "vs " : "at ") + g.opp, sub: g.utc ? "Puck drop " + cet(g.utc) + " CET" : "", src: "canes", live: hr >= 7 && hr <= 22 }); });
    }
    if (ctx.teams) {
      var TS = ctx.teams.saints, TC = ctx.teams.cardinals;
      if (TS) {
        (TS.games || []).forEach(function (g) { ev.push({ date: g.date, cat: "nfl", t: "Saints " + g.res + " " + g.pf + "–" + g.pa + (g.home ? " vs " : " at ") + g.opp, sub: "Final", src: "teams" }); });
        (TS.upcoming || []).forEach(function (g) { var d = g.utc ? cetDate(g.utc) : g.date, hr = g.utc ? cetHour(g.utc) : -1; ev.push({ date: d, cat: "nfl", t: "Saints " + (g.home ? "vs " : "at ") + g.opp, sub: g.utc ? "Kick-off " + cet(g.utc) + " CET" : "", src: "teams", live: hr >= 7 && hr <= 22 }); });
      }
      if (TC) {
        if (TC.springTraining && TC.springTraining.date) ev.push({ date: TC.springTraining.date, cat: "nfl", t: "Cardinals spring training opens", sub: TC.springTraining.note || "", src: "teams" });
        if (TC.opener && TC.opener.date) ev.push({ date: TC.opener.date, cat: "nfl", t: "Cardinals Opening Day" + (TC.opener.home ? " vs " : " at ") + TC.opener.opp, sub: TC.opener.utc ? "First pitch " + cet(TC.opener.utc) + " CET" : TC.opener.note || "", src: "teams", prio: true });
        (TC.games || []).forEach(function (g) { ev.push({ date: g.date, cat: "nfl", t: "Cardinals " + g.res + " " + g.pf + "–" + g.pa + (g.home ? " vs " : " at ") + g.opp, sub: "Final", src: "teams" }); });
        (TC.upcoming || []).forEach(function (g) { var d = g.utc ? cetDate(g.utc) : g.date, hr = g.utc ? cetHour(g.utc) : -1; ev.push({ date: d, cat: "nfl", t: "Cardinals " + (g.home ? "vs " : "at ") + g.opp, sub: g.utc ? "First pitch " + cet(g.utc) + " CET" : "", src: "teams", live: hr >= 7 && hr <= 22 }); });
      }
    }
    ((ctx.tv && ctx.tv.shows) || []).forEach(function (x) { if (x.next && x.next.date) ev.push({ date: x.next.date, cat: "tv", t: x.title + " " + epCode(x.next), sub: [x.next.name, x.next.time, x.where].filter(Boolean).join(" · "), src: "tv" }); });
    (ctx.horizon || []).forEach(function (e) { if (e.date) ev.push({ date: e.date, end: hzEnd(e) || undefined, cat: "watch", t: e.t, sub: (e.dateText || "") + (e.n ? " · " + plain(e.n) : ""), src: "horizon" }); });
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
    (((E.army || {}).career || {}).dates || []).forEach(function (d) { ev.push({ date: d[0], cat: "pro", t: plain(d[1]), sub: "Career milestone", src: "career" }); });
    (ctx.events || []).forEach(function (e) { if (e.from) ev.push({ date: e.from, end: e.to !== e.from ? e.to : undefined, cat: "out", t: e.t, sub: [e.town, e.drive != null ? "~" + e.drive + " min" : "", e.to !== e.from ? "to " + fmtShort(e.to) : ""].filter(Boolean).join(" · "), src: "events", prio: e.prio === true }); });
    (ctx.congress || []).forEach(function (c) { if (c.deadline) ev.push({ date: c.deadline, cat: "pro", t: (c.title || c.post) + ": deadline", sub: c.next ? plain(c.next) : "Congress", src: "congress" }); });
    (ctx.exercises || []).forEach(function (x) { if (x.from) ev.push({ date: x.from, end: x.to !== x.from ? x.to : undefined, cat: "ex", t: x.name, sub: [x.lead, x.where].filter(Boolean).join(" · "), src: "exercises" }); });
    (((ctx.inbox || {}).items) || []).forEach(function (m) { if (m.date) ev.push({ date: m.date, end: m.end && m.end !== m.date ? m.end : undefined, cat: "mail", t: m.t + (m.time ? " · " + m.time : ""), sub: [m.src, m.note].filter(Boolean).join(" · "), src: "inbox", prio: true }); });
    (((ctx.local || {}).culture) || []).forEach(function (e) { if (e.date) ev.push({ date: e.date, end: e.end && e.end !== e.date ? e.end : undefined, cat: "mkt", t: e.t.split(";")[0].split(":")[0], sub: e.t, src: "local", prio: e.prio === true }); });
    (((ctx.local || {}).admin) || []).forEach(function (e) { if (e.date) ev.push({ date: e.date, cat: "deadline", t: e.t, sub: e.note || "Household admin", src: "local", prio: true }); });
    ((ctx.week && ctx.week.items) || []).forEach(function (w) { if (w.date) ev.push({ date: w.date, end: w.end && w.end !== w.date ? w.end : undefined, cat: "me", t: w.t + (w.time ? " · " + w.time : ""), sub: [w.note, w.url ? "Join: " + w.url : ""].filter(Boolean).join(" · "), src: "week", prio: true }); });
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
    var ym = key(from).slice(0, 7), curM = ym === TD.slice(0, 7), rows = ev.filter(function (e) { return e.date.slice(0, 7) === ym && filter(e.cat) && (!curM || e.date >= TD); });
    function agendaBody(list) {
      var lastW = null, body = "";
      list.forEach(function (e) {
        var dd = pd(e.date), wk = key(new Date(dd.getFullYear(), dd.getMonth(), dd.getDate() - ((dd.getDay() + 6) % 7)));
        if (wk !== lastW) { lastW = wk; var we = addDays(wk, 6); body += '<tr class="wk"><td colspan="2">Week of ' + esc(fmtShort(wk)) + " – " + esc(fmtShort(we)) + "</td></tr>"; }
        body += '<tr class="' + (e.date === TD ? "soon" : e.date < TD ? "past" : "") + '"><td class="d"><span class="dot" style="background:' + catColor(e.cat) + '"></span>' + DOW[dd.getDay()] + " " + dd.getDate() + "</td><td><b>" + esc(e.t) + "</b>" + (e.sub ? ' <span class="small">' + esc(e.sub) + "</span>" : "") + "</td></tr>";
      });
      return table(["Date", "What"], body);
    }
    var cut = addDays(TD, 14), near = curM ? rows.filter(function (e) { return e.date <= cut; }) : rows, later = curM ? rows.filter(function (e) { return e.date > cut; }) : [];
    h += '<div class="agenda">' + (near.length ? agendaBody(near) : later.length ? "" : quiet(curM ? "Nothing more in this category this month." : "Nothing in this category this month."));
    if (later.length) h += '<details class="more"><summary>' + later.length + " more from " + esc(fmtShort(addDays(cut, 1))) + " to " + esc(fmtShort(key(to))) + "</summary>" + agendaBody(later) + "</details>";
    return h + "</div>";
  }
  /* This week: only what Nick has to do or will plan around (holidays, AFNORTH days, bins, deadlines, career dates,
     major festivals marked prio, Christmas markets opening, exercise start and end, Canes games watchable live in CET) */
  function weekPrio(e) {
    if (e.src === "bins" || e.src === "deadlines" || e.src === "career" || e.src === "exercises" || e.src === "week") return true;
    if (e.src === "calendar") return e.cat !== "school" || e.sys === "afnorth";
    if (e.src === "canes" || e.src === "teams") return !!e.live || !!e.prio;
    if (e.src === "tv" || e.src === "inbox") return true;
    if (e.src === "local") return !!e.prio;
    if (e.src === "events" || e.src === "edition") return !!e.prio;
    return false;
  }
  function weekStrip(ev, E, TD) {
    var pick = ev.filter(weekPrio), h = '<div class="week scrollx"><div class="week-in">';
    for (var i = 0; i < 7; i++) {
      var k = addDays(TD, i), d = pd(k), list = [];
      pick.forEach(function (e) {
        var span = e.end && e.end !== e.date, se = e.src === "exercises" || e.cat === "school";
        if (e.date === k) list.push([e.cat, span && se ? e.t + " starts" : e.t]);
        else if (span && se && e.end === k) list.push([e.cat, e.t + " ends"]);
        else if (span && e.cat === "school" && i === 0 && e.date < k && k < e.end) list.push([e.cat, e.t + ", to " + fmtShort(e.end)]);
      });
      h += '<div class="wday' + (i === 0 ? " today" : "") + '"><div class="wd"><b>' + DOW[d.getDay()] + "</b> " + d.getDate() + " " + MON[d.getMonth()] + "</div>";
      h += list.length ? list.map(function (x) { return '<div class="we"><i style="background:' + catColor(x[0]) + '"></i>' + esc(x[1]) + "</div>"; }).join("") : '<div class="we none">—</div>';
      h += "</div>";
    }
    return h + "</div></div>";
  }

  /* ---------- weather glyphs (inline SVG, currentColor) ---------- */
  var WXK = { sun: "Sunny", suncloud: "Sun and cloud", cloud: "Cloudy", fog: "Fog", showers: "Showers", rain: "Rain", snow: "Snow", storm: "Thunder", wind: "Windy" };
  function wxIcon(kind, size) {
    size = size || 28;
    var sun = '<circle cx="12" cy="12" r="4.2" fill="var(--c-be)"/><g stroke="var(--c-be)" stroke-width="1.6" stroke-linecap="round"><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7"/></g>';
    var cloud = '<path d="M7 18h10.5a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 7.3 9.6 4.2 4.2 0 0 0 7 18z" fill="var(--surface)" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>';
    var drops = function (n) { var d = ""; for (var i = 0; i < n; i++) d += '<path d="M' + (8 + i * 4) + ' 19.5l-1 2.4a1.1 1.1 0 1 0 2 0z" fill="var(--accent)"/>'; return d; };
    var body = {
      sun: sun,
      suncloud: '<g transform="translate(-3 -3) scale(.8)">' + sun + "</g>" + cloud,
      cloud: cloud,
      fog: cloud + '<g stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".7"><path d="M5 21h9M9 23.5h10"/></g>',
      showers: '<g transform="translate(-3 -3) scale(.8)">' + sun + "</g>" + cloud + drops(2),
      rain: cloud + drops(3),
      snow: cloud + '<g fill="currentColor"><circle cx="8.5" cy="21" r="1.1"/><circle cx="12.5" cy="22.5" r="1.1"/><circle cx="16.5" cy="21" r="1.1"/></g>',
      storm: cloud + '<path d="M12.5 17.5l-2.5 4.5h2.2l-1 3 3.6-5h-2.3l1.3-2.5z" fill="var(--warn)"/>',
      wind: '<g stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"><path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 14h15a2.5 2.5 0 1 1-2.5 2.5M3 19h8"/></g>'
    };
    return '<svg class="wxi" width="' + size + '" height="' + size + '" viewBox="0 0 24 26" role="img" aria-label="' + esc(WXK[kind] || kind) + '"><title>' + esc(WXK[kind] || kind) + "</title>" + (body[kind] || body.cloud) + "</svg>";
  }
  function wxKind(row, text) {
    var sky = row && row[5] ? String(row[5]).toLowerCase() : "", r = row && row[3] != null && row[3] !== "" ? +row[3] : null, t = String(text || "").toLowerCase();
    if (sky && WXK[sky]) return sky;
    if (/thunder|storm/.test(t)) return "storm"; if (/snow|sleet/.test(t)) return "snow"; if (/fog|mist/.test(t)) return "fog";
    if (r != null) return r >= 60 ? "rain" : r >= 30 ? "showers" : r >= 10 ? "suncloud" : (/cloud|grey|overcast/.test(t) ? "cloud" : "sun");
    if (/rain|wet|shower/.test(t)) return "rain"; if (/sunny|clear|bright/.test(t)) return "sun"; if (/cloud|grey|overcast/.test(t)) return "cloud";
    return "suncloud";
  }
  var WDIR = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5, O: 90, Z: 180, ZW: 225, ZO: 135, NO: 45 };
  function windGlyph(txt) {
    var m = /^([NESWOZ]{1,3})\s*(\d+)?/i.exec(String(txt || "").trim()); if (!m || WDIR[m[1].toUpperCase()] == null) return txt ? '<span class="wnd">' + esc(txt) + "</span>" : "";
    var deg = WDIR[m[1].toUpperCase()], bft = m[2] ? +m[2] : null;
    return '<span class="wnd" title="Wind from ' + esc(m[1].toUpperCase()) + (bft != null ? ", force " + bft : "") + '"><svg width="12" height="12" viewBox="0 0 12 12" style="transform:rotate(' + (deg + 180) + 'deg)"><path d="M6 1l3.2 6.2H7.2V11H4.8V7.2H2.8z" fill="currentColor"/></svg>' + esc(m[1].toUpperCase()) + (bft != null ? " " + bft : "") + "</span>";
  }
  function rainGlyph(pct) { if (pct == null || pct === "") return ""; var p = +pct, n = p >= 60 ? 3 : p >= 30 ? 2 : p > 0 ? 1 : 0; return '<span class="rn" title="' + p + '% chance of rain">' + (n ? '<svg width="' + (n * 6 + 2) + '" height="11" viewBox="0 0 ' + (n * 6 + 2) + ' 11">' + Array.apply(null, Array(n)).map(function (_, i) { return '<path d="M' + (4 + i * 6) + ' 1l-2.4 4.6a2.4 2.4 0 1 0 4.8 0z" fill="var(--accent)"/>'; }).join("") + "</svg>" : "") + p + "%</span>"; }
  function tempBand(wk, W) {
    if (!wk || wk.length < 2) return "";
    W = Math.max(240, Math.round(W || 360)); var H = 84, T = 16, B = 18, L = 8, R = 8, n = wk.length, hi = Math.max.apply(null, wk.map(function (r) { return +r[1]; })), lo = Math.min.apply(null, wk.map(function (r) { return +r[2]; }));
    if (hi - lo < 6) { hi += 3; lo -= 3; }
    function X(i) { return L + (i + 0.5) * (W - L - R) / n; }
    function Y(v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); }
    var ph = wk.map(function (r, i) { return X(i).toFixed(1) + "," + Y(+r[1]).toFixed(1); }), pl = wk.map(function (r, i) { return X(i).toFixed(1) + "," + Y(+r[2]).toFixed(1); });
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Highs and lows for the week">';
    if (lo <= 0 && hi >= 0) svg += '<line x1="' + L + '" y1="' + Y(0).toFixed(1) + '" x2="' + (W - R) + '" y2="' + Y(0).toFixed(1) + '" stroke="var(--line)" stroke-dasharray="2 3"/>' + svgText(W - R, Y(0) - 3, "0°", "end", 9);
    svg += '<path d="M' + ph.join(" L") + " L" + pl.slice().reverse().join(" L") + ' Z" fill="var(--p-home)" fill-opacity=".15"/>';
    svg += '<polyline points="' + ph.join(" ") + '" fill="none" stroke="var(--p-home)" stroke-width="1.5"/><polyline points="' + pl.join(" ") + '" fill="none" stroke="var(--accent)" stroke-width="1.5"/>';
    wk.forEach(function (r, i) { svg += svgText(X(i), Y(+r[1]) - 5, r[1] + "°", "middle", 10, true, "var(--ink)") + svgText(X(i), Y(+r[2]) + 12, r[2] + "°", "middle", 10, true); });
    return svg + "</svg>";
  }
  function nextGameLine(up, TD) {
    var g = null; (up || []).forEach(function (x) { var dk = x.utc ? cetDate(x.utc) : x.date; if (!g && dk >= TD) g = x; });
    if (!g) return "";
    var dk = g.utc ? cetDate(g.utc) : g.date, tm = g.utc ? cet(g.utc).replace(/^\w+,? /, "") : "", n = daysBetween(TD, dk);
    return '<p class="nextg">Next game <b>' + (n === 0 ? "tonight" : n === 1 ? "tomorrow" : DOW[pd(dk).getDay()] + " " + fmtShort(dk)) + "</b>" + (tm ? " " + esc(tm) + " CET" : "") + (g.home ? " vs " : " at ") + esc(g.opp) + "</p>";
  }
  function teamsBlock(TM, TD) {
    if (!TM) return "";
    var h = '<h3>Also following</h3><div class="teams">', S = TM.saints, C = TM.cardinals;
    if (S) {
      var g = (S.games || []).slice(), lg = g[g.length - 1];
      h += '<div class="tile team"><div class="lbl">' + esc(S.name) + " · NFL " + esc(S.season) + '</div><div class="val">' + esc(S.record || "") + "</div>";
      if (g.length) h += '<div class="season mini" role="list">' + g.slice(-8).map(function (x) { return '<div class="g ' + esc(x.res) + '" role="listitem" title="' + esc(fmtShort(x.date) + (x.home ? " vs " : " at ") + x.opp + ": " + x.res + " " + x.pf + "–" + x.pa) + '"><b>' + esc(x.res) + "</b>" + (x.home ? "" : "@") + esc(x.opp) + "</div>"; }).join("") + "</div>";
      if (lg) h += '<p class="small">Last: ' + esc(lg.res + " " + lg.pf + "–" + lg.pa + (lg.home ? " vs " : " at ") + lg.opp + ", " + fmtShort(lg.date)) + (S.standing ? " · " + esc(S.standing) : "") + "</p>";
      h += nextGameLine(S.upcoming, TD);
      var nx = (S.upcoming || []).filter(function (x) { return (x.utc ? cetDate(x.utc) : x.date) >= TD; })[0];
      if (nx) h += '<p class="small">' + icsLink("Saints " + (nx.home ? "vs " : "at ") + nx.opp, nx.utc ? cetDate(nx.utc) : nx.date, null, "New Orleans Saints", nx.utc) + "</p>";
      h += "</div>";
    }
    if (C) {
      var op = C.opener, st = C.springTraining, nxc = (C.upcoming || []).filter(function (x) { return (x.utc ? cetDate(x.utc) : x.date) >= TD; })[0];
      h += '<div class="tile team"><div class="lbl">' + esc(C.name) + " · MLB " + esc(C.season) + '</div><div class="val">' + esc(C.record || (C.status === "off-season" ? "Off-season" : C.status || "")) + "</div>";
      if (C.last) h += '<p class="small">' + esc(C.last) + "</p>";
      if (nxc) h += nextGameLine(C.upcoming, TD);
      else {
        if (st && st.date >= TD) h += '<p class="small">Spring training opens <b>' + esc(fmtShort(st.date)) + "</b>" + (st.home ? " vs " : " at ") + esc(st.opp) + " · " + daysBetween(TD, st.date) + " days</p>";
        if (op && op.date >= TD) h += '<p class="nextg">Opening Day <b>' + esc(DOW[pd(op.date).getDay()] + " " + fmtShort(op.date)) + "</b>" + (op.utc ? " " + esc(cet(op.utc).replace(/^\w+,? /, "")) + " CET" : "") + (op.home ? " vs " : " at ") + esc(op.opp) + " · " + daysBetween(TD, op.date) + " days</p>" + '<p class="small">' + icsLink("Cardinals Opening Day " + (op.home ? "vs " : "at ") + op.opp, op.date, null, op.note || "", op.utc) + "</p>";
      }
      h += "</div>";
    }
    return h + "</div>";
  }
  var TVST = { airing: "Airing", scheduled: "Date set", renewed: "Renewed", between: "Between series", awaiting: "Awaiting renewal", ended: "Ended" };
  function epCode(x) { return x ? "S" + x.s + "E" + x.e : ""; }
  function tvBlock(ctx, TD) {
    var TV = ctx.tv; if (!TV || !(TV.shows || []).length) return quiet("No shows tracked. Add them to data/tv.json.");
    var shows = TV.shows.slice().sort(function (a, b) { var ad = a.next && a.next.date ? a.next.date : "9", bd = b.next && b.next.date ? b.next.date : "9"; return ad < bd ? -1 : ad > bd ? 1 : 0; });
    var h = '<div class="shows">' + shows.map(function (x) {
      var n = x.next, l = x.last, nd = n && n.date ? daysBetween(TD, n.date) : null, past = n && n.date && n.date < TD;
      var c = '<div class="show"><div class="sh"><b>' + esc(x.title) + '</b><span><span class="small">' + esc(x.where || "") + '</span> <span class="chip st tier' + (x.status === "airing" || x.status === "scheduled" ? " on" : "") + '">' + esc(TVST[x.status] || x.status || "") + "</span></span></div>";
      if (n && n.date && !past) c += '<p class="nextg">' + (nd === 0 ? "Tonight" : nd === 1 ? "Tomorrow" : "In " + nd + " days") + " · <b>" + esc(DOW[pd(n.date).getDay()] + " " + fmtShort(n.date)) + "</b> · " + esc(epCode(n) + (n.name ? " " + n.name : "")) + (n.time ? " · " + esc(n.time) : "") + " " + icsLink(x.title + " " + epCode(n), n.date, null, n.name || "") + "</p>";
      else c += '<p class="nextg muted">No date for the next episode</p>';
      if (l && l.date) c += '<p class="small">Last: ' + esc(epCode(l) + (l.name ? " " + l.name : "") + ", " + fmtShort(l.date) + (l.date.slice(0, 4) !== TD.slice(0, 4) ? " " + l.date.slice(0, 4) : "")) + "</p>";
      if (x.note) c += '<p class="small note">' + esc(x.note) + (x.src && x.src.length ? ' <a href="' + esc(x.src[0][1]) + '" target="_blank" rel="noopener" class="srcl">source</a>' : "") + "</p>";
      return c + "</div>";
    }).join("") + "</div>";
    if ((TV.similar || []).length) {
      var byId = {}; TV.shows.forEach(function (x) { byId[x.id] = x.title; });
      h += '<h3>If you like these</h3><ul class="clean rec">' + TV.similar.map(function (r) { return "<li><b>" + esc(r.title) + "</b>" + (r.where ? ' <span class="small">' + esc(r.where) + "</span>" : "") + (r.like && r.like.length ? ' <span class="small like">· like ' + esc(r.like.map(function (k) { return byId[k] || k; }).join(" and ")) + "</span>" : "") + (r.why ? '<div class="small">' + esc(r.why) + "</div>" : "") + "</li>"; }).join("") + "</ul>";
    }
    if (TV.updated) h += '<p class="small">Episode data from TVMaze, refreshed ' + esc(fmtShort(TV.updated)) + ". Dates are the broadcaster's local air date.</p>";
    return h;
  }
  function dayHours(lat, k) { var d = pd(k), doy = Math.round((d - new Date(d.getFullYear(), 0, 1)) / DAY) + 1, decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + doy) / 365), x = Math.max(-1, Math.min(1, -Math.tan(lat * Math.PI / 180) * Math.tan(decl))); return 24 / Math.PI * Math.acos(x); }
  function moonPhase(k) { var age = ((pd(k).getTime() / DAY + 0.5 - 10962.76) % 29.530588853 + 29.530588853) % 29.530588853, p = 2 * Math.PI * age / 29.530588853, c = Math.cos(p), r = 9, rx = (r * Math.abs(c)).toFixed(2), wax = age < 14.765;
    var name = age < 1.85 || age > 27.68 ? "new moon" : age < 5.53 ? "waxing crescent" : age < 9.22 ? "first quarter" : age < 12.91 ? "waxing gibbous" : age < 16.61 ? "full moon" : age < 20.30 ? "waning gibbous" : age < 23.99 ? "last quarter" : "waning crescent";
    var lit = wax ? "M0,-" + r + " A" + r + "," + r + " 0 0 1 0," + r + " A" + rx + "," + r + " 0 0 " + (c > 0 ? 0 : 1) + " 0,-" + r + "Z" : "M0,-" + r + " A" + r + "," + r + " 0 0 0 0," + r + " A" + rx + "," + r + " 0 0 " + (c > 0 ? 1 : 0) + " 0,-" + r + "Z";
    return { age: age, name: name, svg: '<svg class="moon" viewBox="-11 -11 22 22" width="22" height="22" role="img" aria-label="' + name + '"><circle r="' + r + '" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="' + lit + '" fill="currentColor"/></svg>' };
  }
  function hm(hrs) { var a = Math.abs(hrs), hh = Math.floor(a), mm = Math.round((a - hh) * 60); if (mm === 60) { hh++; mm = 0; } return hh + " h " + String(mm).padStart(2, "0") + " min"; }
  function weatherBlock(E, TD) {
    var w = (E.today || {}).weather || {}, wk = w.week || [], h = "";
    if (wk.length) h += '<div class="wxrow scrollx"><div class="wx-in">' + wk.slice(0, 7).map(function (r, i) { var d = pd(r[0]), k = wxKind(r, i === 0 ? w.now : ""); return '<div class="wxd' + (r[0] === TD ? " today" : "") + '"><div class="wd"><b>' + DOW[d.getDay()] + "</b> " + d.getDate() + "</div>" + wxIcon(k, 30) + '<div class="t"><span class="hi">' + esc(r[1]) + "°</span> " + esc(r[2]) + '°</div><div class="r">' + (rainGlyph(r[3]) || "–") + '</div><div class="small">' + windGlyph(r[4]) + "</div></div>"; }).join("") + '</div></div><div class="chart" id="tempband" style="min-height:70px"></div>';
    else h += quiet("No forecast in this edition.");
    var geo = dayHours(HOME.lat, TD), diff = (geo - dayHours(HOME.lat, addDays(TD, -7))) * 60, now = geo, sr = /^(\d{1,2}):(\d{2})$/.exec(w.sunrise || ""), ss = /^(\d{1,2}):(\d{2})$/.exec(w.sunset || "");
    if (sr && ss) now = (ss[1] * 60 + +ss[2] - sr[1] * 60 - +sr[2]) / 60;
    h += '<p class="small dl-line">' + (w.sunrise ? "Sunrise <b>" + esc(w.sunrise) + "</b> · sunset <b>" + esc(w.sunset) + "</b> · " : "") + hm(now) + " of daylight, " + Math.abs(Math.round(diff)) + " min " + (diff < 0 ? "less" : "more") + " than a week ago." + (w.weekNote ? " " + rich(w.weekNote) : "") + (w.src && !/\[\d/.test(w.weekNote || "") ? cite(w.src) : "") + "</p>";
    return h + '<div class="panel"><div class="lbl">Hours of daylight at ' + esc(HOME.name) + " through the year</div>" + '<div class="chart" id="daylight" data-h="' + now.toFixed(3) + '" style="min-height:120px"></div></div>';
  }
  function countdowns(ev, ctx, TD) {
    var tiles = [];
    function next(pred) { for (var i = 0; i < ev.length; i++) if (ev[i].date >= TD && pred(ev[i])) return ev[i]; return null; }
    function tile(lbl, e, alt) { if (!e) return; var n = daysBetween(TD, e.date); tiles.push('<div class="tile cd"><div class="lbl">' + esc(lbl) + '</div><div class="val">' + (n === 0 ? "Today" : n === 1 ? "Tomorrow" : n + " days") + "</div><p>" + esc((alt || e.t) + " · " + fmt(pd(e.date))) + "</p></div>"); }
    tile("Next bin day", next(function (e) { return e.cat === "home" && e.src === "bins"; }), null);
    var g = next(function (e) { return e.cat === "hockey" && e.src === "canes" && e.t.indexOf("Canes") === 0; }); if (g) tile("Next Canes game", g, g.t + (g.sub ? " · " + g.sub.replace("Puck drop ", "") : ""));
    var sg = next(function (e) { return e.cat === "nfl" && /^Saints (vs|at)/.test(e.t); }); if (sg) tile("Next Saints game", sg, sg.t + (sg.sub ? " · " + sg.sub.replace("Kick-off ", "") : ""));
    var te = next(function (e) { return e.cat === "tv"; }); if (te) tile("Next episode", te, te.t);
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
  var PAGE_V = "7.5";
  function health(E, ctx, TD, words) {
    var rows = [], realToday = key(new Date());
    function add(name, level, detail) { rows.push([name, level, detail]); }
    function lastDate(list, f) { var m = ""; (list || []).forEach(function (x) { var d = f(x); if (d && d > m) m = d; }); return m; }
    function age(d) { return d ? daysBetween(d, TD) : null; }
    function fresh(name, d, warn, act, what) { var a = age(d); if (a == null) add(name, "act", "no dated entry at all"); else add(name, a >= act ? "act" : a >= warn ? "watch" : "ok", (what || "last entry") + " " + fmtShort(d) + (a ? ", " + a + (a === 1 ? " day" : " days") + " ago" : ", today")); }
    /* format and cadence */
    var ev = parseFloat(E.v || "0"); add("Edition format", ev < parseFloat(PAGE_V) ? "act" : "ok", "edition " + (E.v || "?") + " on page " + PAGE_V + (ev < parseFloat(PAGE_V) ? ": the task prompt is behind the page" : ""));
    var lag = daysBetween(ctx.index.latest, realToday); add("Morning run", lag <= 0 ? "ok" : lag === 1 ? "watch" : "act", "latest edition " + fmtShort(ctx.index.latest) + (lag > 0 ? ", " + lag + " day" + (lag > 1 ? "s" : "") + " behind today" : ", today"));
    var mins = Math.round(words / 230), RB = 48; add("Read time", mins < 24 || mins > 62 ? "act" : mins < 34 || mins > 55 ? "watch" : "ok", "≈ " + mins + " min against a " + RB + "-minute budget for the Brief, the news and the reading");
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
    var fuS = ctx.fuel && ctx.fuel.series && ctx.fuel.series["nl-e95"]; fresh("Pump prices", fuS && fuS.length ? fuS[fuS.length - 1][0] : "", 11, 18, "last CBS day");
    var serOld = Object.keys(ctx.series || {}).filter(function (k) { return k[0] !== "_" && (ctx.series[k] || []).length && daysBetween(ctx.series[k][ctx.series[k].length - 1][0], TD) > 5; });
    add("Market series", serOld.length ? "act" : "ok", serOld.length ? "stale: " + serOld.join(", ") : "all " + Object.keys(ctx.series || {}).filter(function (k) { return k[0] !== "_" && Array.isArray(ctx.series[k]); }).length + " within 5 days");
    var WS = ctx.worldSeries || { meta: {}, series: {} }, wsRows = Object.keys(WS.series || {}).map(function (k) { var sr = WS.series[k] || [], m = (WS.meta || {})[k] || {}, last = sr.length ? sr[sr.length - 1][0] : null, lim = m.cadence === "weekly" ? 10 : 3; return [k, last, last ? daysBetween(last, TD) > lim : true]; });
    var wsBad = wsRows.filter(function (r) { return r[2]; }).map(function (r) { return r[0] + (r[1] ? " (" + fmtShort(r[1]) + ")" : " (empty)"); });
    add("World series", wsBad.length >= wsRows.length ? "act" : wsBad.length ? "watch" : "ok", wsBad.length ? "not kept up: " + wsBad.join(", ") : wsRows.length + " series current");
    if (ctx.inbox) fresh("Mail check", ctx.inbox.updated, 3, 7, "last pull");
    if (ctx.local) { fresh("Parkstad feeds", ctx.local.updated, 2, 4, "tools/local.js ran"); if ((ctx.local.errors || []).length) add("Parkstad feeds", "watch", "failed last run: " + ctx.local.errors.map(function (e) { return String(e).split(":")[0]; }).join(", ")); }
    if (ctx.energy && ctx.energy.asof) fresh("Household energy", ctx.energy.asof + "-01", 75, 110, "CBS month");
    if (ctx.indicators) fresh("Indicators", ctx.indicators.updated, 3, 7, "last status check");
    if (ctx.forecasts) { var fo = (ctx.forecasts.items || []).filter(function (f) { return f.status === "open" && f.resolves < TD; }); add("Forecast ledger", fo.length ? "act" : "ok", fo.length ? fo.length + " overdue to resolve" : (ctx.forecasts.items || []).filter(function (f) { return f.status === "open"; }).length + " open, none overdue"); }
    if (ctx.uaFront) fresh("Ukraine front line", ctx.uaFront.asof, 8, 15, "DeepState layer as of");
    if (ctx.novel) fresh("New in war log", (ctx.novel.items || []).length ? lastDate(ctx.novel.items, function (x) { return x.date; }) : "", 10, 21, "last technique logged");
    if (ctx.countries) fresh("Priority countries", ctx.countriesUpdated || lastDate(ctx.countries, function (c) { return lastDate(c.log, function (e) { return e.date; }); }), 7, 14, "last log entry");
    if (ctx.teams) fresh("Saints and Cardinals", ctx.teams.updated, 5, 12, "last refresh");
    if (ctx.tv) fresh("TV shows", ctx.tv.updated, 8, 21, "last refresh");
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
    var tiered = (E.sources || []).filter(function (x) { return x[4]; }).length, t12 = (E.sources || []).filter(function (x) { return x[4] == 1 || x[4] == 2; }).length;
    add("Source tiers", !tiered ? "act" : t12 / tiered < 0.25 ? "watch" : "ok", tiered ? Math.round(100 * t12 / tiered) + "% of " + tiered + " tiered sources are official, primary or wire" : "no tiers assigned: the task prompt is behind the page");
    var rsOrgs = ((ctx.research || {}).covered || []).filter(function (c) { return daysBetween(c.date, TD) <= 10 && c.date <= TD; }).map(function (c) { return c.org; }), rsDup = rsOrgs.filter(function (o, i) { return rsOrgs.indexOf(o) !== i; }), rsQ = ((ctx.research || {}).queue || []).filter(function (q) { return !q.for || q.for >= TD; }).length;
    var rsList = Array.isArray(E.research) ? E.research : (E.research ? [E.research] : []), rsFields = rsList.map(function (r) { return r.field || "military"; });
    add("Research rotation", rsList.length < 3 ? "watch" : rsDup.length ? "watch" : rsFields.indexOf("military") < 0 ? "watch" : "ok", (rsList.length ? rsList.length + " today: " + rsList.map(function (r) { return r.org; }).join(", ") : "no piece today") + (rsList.length && rsList.length < 3 ? " (three expected)" : "") + (rsFields.length && rsFields.indexOf("military") < 0 ? "; no military piece" : "") + (rsDup.length ? "; repeated within 10 days: " + rsDup.join(", ") : "") + " · " + rsQ + " queued");
    var phc = ((ctx.philosophy || {}).covered || []); add("Philosophy note", !E.philosophy ? "watch" : "ok", E.philosophy ? "today: " + E.philosophy.thinker + " · " + phc.length + " notes logged" : "no note in this edition");
    var xl = Object.keys(ctx._linked || {}).length; add("Cross-links", xl ? "ok" : "watch", xl ? xl + " items link to trackers" : "no item links to a tracker yet");
    var siToday = ctx.searchIndex && ctx.searchIndex.editions && ctx.searchIndex.editions.some(function (b) { return b.date === TD; }); add("Search index", siToday ? "ok" : "watch", siToday ? "has today's edition" : "today's edition not indexed yet");
    return rows;
  }


  /* ---------- 6.0: cross-links, calendar files, since yesterday, contents, decisions, year ahead, review, corrections, about ---------- */
  var LINK_KIND = { theatre: ["#th-", "Board"], thread: ["#thread-", "Thread"], congress: ["#cg-", "Congress"], post: ["#congresstracker", "Post"], exercise: ["#exercises-sec", "Exercise"], release: ["#releases", "Release"], event: ["#offduty", "Event"], country: ["#ctry-", "Country"], novel: ["#novel-", "New use"] };
  function linkNames(ctx) {
    var n = { theatre: {}, thread: {}, congress: {}, post: {}, exercise: {}, release: {}, event: {}, country: {}, novel: {} };
    (((ctx.novel || {}).items) || []).forEach(function (x) { n.novel[x.id] = x.t; });
    (ctx.countries || []).forEach(function (c) { n.country[c.id] = c.name; });
    (ctx.conflicts || []).forEach(function (t) { n.theatre[t.id] = t.short || t.name; });
    (ctx.threads || []).forEach(function (t) { n.thread[t.id] = t.name; });
    (ctx.congress || []).forEach(function (c) { n.congress[c.id] = c.title || c.post; });
    (ctx.congressWatch || []).forEach(function (w) { n.post[w.id] = w.post; });
    (ctx.exercises || []).forEach(function (x) { n.exercise[x.id] = x.name; });
    (((ctx.releases || {}).releases) || []).forEach(function (r, i) { if (r.id) n.release[r.id] = r.t; });
    (ctx.events || []).forEach(function (e) { n.event[e.id] = e.t; });
    return n;
  }
  function linkChips(links) {
    if (!links || !links.length || !ctx._names) return "";
    var out = links.map(function (l) { var a = String(l).split(":"), k = a[0], id = a.slice(1).join(":"), kind = LINK_KIND[k]; if (!kind) return ""; var name = (ctx._names[k] || {})[id] || id; return '<a class="xl" href="' + kind[0] + (kind[0].slice(-1) === "-" ? esc(id) : "") + '" title="' + esc(kind[1] + ": " + name) + '">' + esc(name) + "</a>"; }).filter(Boolean);
    return out.length ? '<div class="xlinks"><span class="small">updates</span>' + out.join("") + "</div>" : "";
  }
  function collectLinks(E) {
    var set = {};
    function walk(o) { if (Array.isArray(o)) { o.forEach(walk); return; } if (o && typeof o === "object") { if (Array.isArray(o.links)) o.links.forEach(function (l) { set[l] = 1; }); Object.keys(o).forEach(function (k) { if (k !== "sources" && k !== "links") walk(o[k]); }); } }
    walk(E); return set;
  }
  /* when each standing file last took in data: its updated field, else its newest dated entry */
  function ingestLine(ctx, TD) {
    function newest(list, f) { var m = ""; (list || []).forEach(function (x) { var d = f(x); if (d && d > m) m = d; }); return m; }
    function logs(list) { return newest(list, function (t) { return newest(t.log, function (e) { return e.date; }); }); }
    var rows = [
      ["Board", logs(ctx.conflicts)], ["Threads", logs(ctx.threads)], ["Horizon", newest(ctx.horizon, function (e) { return e.updated || e.added; })],
      ["Incidents", newest(ctx.incidents, function (i) { return i.date; })], ["Congress", newest(ctx.congress, function (c) { return c.updated || c.added; })],
      ["Exercises", newest(ctx.exercises, function (x) { return x.updated || x.added; })], ["Releases", newest((ctx.releases || {}).releases, function (r) { return r.date; })],
      ["Events", newest(ctx.events, function (e) { return e.added; })], ["Countries", ctx.countriesUpdated || logs(ctx.countries)],
      ["World series", newest(Object.keys((ctx.worldSeries || {})).filter(function (k) { return k !== "meta" && Array.isArray(ctx.worldSeries[k]); }), function (k) { var a = ctx.worldSeries[k]; return a.length ? a[a.length - 1][0] : ""; })],
      ["FX", ctx.fx ? (ctx.fx.updated || ctx.fx.series[ctx.fx.series.length - 1][0]) : ""], ["Markets", ctx.series ? newest(Object.keys(ctx.series).filter(function (k) { return k[0] !== "_" && Array.isArray(ctx.series[k]); }), function (k) { var a = ctx.series[k]; return a.length ? a[a.length - 1][0] : ""; }) : ""],
      ["Canes", ctx.canes ? (ctx.canes.updated || newest(ctx.canes.games, function (g) { return g.date; })) : ""], ["Teams", (ctx.teams || {}).updated], ["TV", (ctx.tv || {}).updated],
      ["Idioms", newest(ctx.idioms, function (i) { return i.date; })], ["Snow", ctx.ski && ctx.ski.snow ? newest(Object.keys(ctx.ski.snow), function (k) { return (ctx.ski.snow[k] || {}).asof; }) : ""], ["Research", newest((ctx.research || {}).covered, function (c) { return c.date; })]
    ].filter(function (r) { return r[1]; });
    if (!rows.length) return "";
    var size = { Board: cnt(ctx.conflicts, function (t) { return (t.log || []).length; }), Threads: cnt(ctx.threads, function (t) { return (t.log || []).length; }), Horizon: (ctx.horizon || []).length, Incidents: (ctx.incidents || []).length, Congress: (ctx.congress || []).length, Exercises: (ctx.exercises || []).length, Releases: ((ctx.releases || {}).releases || []).length, Events: (ctx.events || []).length, Countries: cnt(ctx.countries, function (c) { return (c.log || []).length; }), "World series": cnt(Object.keys(ctx.worldSeries || {}), function (k) { return Array.isArray(ctx.worldSeries[k]) ? ctx.worldSeries[k].length : 0; }), FX: ctx.fx ? ctx.fx.series.length : 0, Markets: cnt(Object.keys(ctx.series || {}), function (k) { return Array.isArray(ctx.series[k]) ? ctx.series[k].length : 0; }), Canes: ctx.canes ? (ctx.canes.games || []).length : 0, Teams: cnt(Object.keys(ctx.teams || {}), function (k) { return ((ctx.teams[k] || {}).games || []).length; }), TV: ((ctx.tv || {}).shows || []).length, Idioms: (ctx.idioms || []).length, Snow: Object.keys((ctx.ski || {}).snow || {}).length, Research: ((ctx.research || {}).covered || []).length };
    function cnt(list, f) { var n = 0; (list || []).forEach(function (x) { n += f(x) || 0; }); return n; }
    return '<h3>Data ingest <span class="small">newest entry per standing file, as of this edition</span></h3>' + table(["File", "Newest", "Age", "Rows"], rows.map(function (r) { var n = daysBetween(r[1], TD); return '<tr class="' + (n >= 3 ? "soon" : "") + '"><td><b>' + esc(r[0]) + '</b></td><td class="d">' + esc(fmtShort(r[1])) + (r[1].slice(0, 4) !== TD.slice(0, 4) ? " " + r[1].slice(0, 4) : "") + '</td><td class="d">' + (n <= 0 ? "today" : n === 1 ? "1 day" : n + " days") + '</td><td class="d">' + (size[r[0]] != null ? size[r[0]].toLocaleString("en-GB") : "") + "</td></tr>"; }).join(""), "lbl1 ingest").replace('class="tw stack"', 'class="tw"');
  }

  /* ---------- 7.2: Coming up, the one personal list in the planner ---------- */
  function comingUp(PEV, ctx, TD) {
    var end = addDays(TD, 30), rows = (PEV || []).filter(function (e) { return (e.end || e.date) >= TD && e.date <= end && (e.src === "week" || e.src === "deadlines" || e.src === "career" || (e.src === "inbox" && !/^(AFNORTH|PTA|CYS) · /.test(e.sub)) || (e.src === "local" && e.cat === "deadline")); });
    var h = '<section id="coming" class="home"><h2>Coming up <span class="num">yours, deadlines, mail, work · next 30 days</span></h2>';
    h += rows.length ? '<ul class="clean wn">' + rows.map(function (e) { var n = daysBetween(TD, e.date), span = e.end && e.end !== e.date; return '<li><span class="d">' + esc(DOW[pd(e.date).getDay()] + " " + fmtShort(e.date)) + (span ? " – " + esc(fmtShort(e.end)) : "") + '</span><span class="w"><span class="dot" style="background:' + catColor(e.cat) + '"></span><b>' + esc(e.t) + "</b> " + icsLink(e.t, e.date, e.end, e.sub) + '<span class="small">' + esc([e.sub, n <= 0 ? (span ? "under way" : "today") : n === 1 ? "tomorrow" : "in " + n + " days"].filter(Boolean).join(" · ")).replace(/Join: (https?:\/\/\S+)/, 'Join: <a href="$1" target="_blank" rel="noopener">$1</a>') + "</span></span></li>"; }).join("") + "</ul>" : quiet("Nothing of yours in the next 30 days. week.json, deadlines.json and the mail check feed this list.");
    h += '<p class="small">School, PTA and CYS dates are under AFNORTH; events near home are under Out and about; the world is on the Horizon. ' + (ctx.inbox && ctx.inbox.updated ? "Mail last checked " + esc(fmtShort(ctx.inbox.updated)) + "." : "") + "</p>";
    return h + "</section>";
  }
  /* ---------- 7.0: the Brief helpers ---------- */
  function watchNext(PEV, ctx, TD) {
    var end = addDays(TD, 7), rows = (PEV || []).filter(function (e) { return e.date > TD && e.date <= end && (e.cat === "watch" || e.cat === "pro" || e.cat === "ex" || e.cat === "deadline" || e.cat === "me" || e.src === "congress"); });
    (ctx.countries || []).forEach(function (c) { if (c.election && c.election.next && c.election.next > TD && c.election.next <= end) rows.push({ date: c.election.next, cat: "pro", t: c.name + " election", sub: "", src: "countries" }); });
    (((ctx.forecasts || {}).items) || []).forEach(function (f) { if (f.status === "open" && f.resolves > TD && f.resolves <= end) rows.push({ date: f.resolves, cat: "watch", t: "Forecast resolves: " + f.q, sub: Math.round(f.p * 100) + "%", src: "forecasts" }); });
    var seen = {}; rows = rows.filter(function (e) { var k = e.date + e.t; if (seen[k]) return false; seen[k] = 1; return true; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).slice(0, 8);
    return '<h3 id="watchnext">What to watch <span class="small">next seven days</span></h3>' + (rows.length ? '<ul class="clean wn">' + rows.map(function (e) { return '<li><span class="d">' + esc(DOW[pd(e.date).getDay()] + " " + fmtShort(e.date)) + '</span><span class="w"><span class="dot" style="background:' + catColor(e.cat) + '"></span>' + esc(e.t) + " " + icsLink(e.t, e.date, e.end, e.sub) + (e.sub ? '<span class="small">' + esc(e.sub) + "</span>" : "") + "</span></li>"; }).join("") + "</ul>" : quiet("Nothing dated in the next seven days."));
  }
  function unknownsBlock(BR, ctx, TD) {
    var list = (BR.unknowns && BR.unknowns.length ? BR.unknowns.map(function (u) { return typeof u === "string" ? { q: u } : u; }) : (((ctx.questions || {}).items) || []).filter(function (q) { return q.status === "open"; })).slice(0, 5);
    if (!list.length) return "";
    return '<h3 id="unknowns">What we do not know <span class="small">open questions the Readbook is carrying</span></h3><ul class="clean unk">' + list.map(function (q) { var l = q.thread ? linkChips([q.thread]) : ""; return "<li>" + esc(q.q) + (q.opened ? ' <span class="small">since ' + esc(fmtShort(q.opened)) + "</span>" : "") + l + "</li>"; }).join("") + "</ul>";
  }
  var IND_COL = { green: "var(--up)", amber: "var(--warn)", red: "var(--crit)" };
  function indicatorValue(x, ctx) {
    try {
      if (x.rule === "mean7" && x.series && ctx.worldSeries && ctx.worldSeries.series[x.series]) { var a = ctx.worldSeries.series[x.series].slice(-7); return a.length ? Math.round(a.reduce(function (t, p) { return t + p[1]; }, 0) / a.length) + " (7-day mean of " + a.length + ")" : ""; }
      if (x.rule === "incidents7" && ctx.incidents) { var TD = ctx._TD; return ctx.incidents.filter(function (i) { return daysBetween(i.date, TD) >= 0 && daysBetween(i.date, TD) < 7; }).length + " in 7 days"; }
      if (x.rule === "local-maas" && ctx.local && ctx.local.maas) { var md = ctx.local.maas.days.filter(function (r) { return r[0] <= ctx._TD; }), mlast = md[md.length - 1], mmax = Math.max.apply(null, ctx.local.maas.days.map(function (r) { return r[2] || r[1]; })); return mlast ? Math.round(mlast[1]) + " m³/s, 7-day max " + Math.round(mmax) : ""; }
      if (x.rule === "fx" && ctx.fx) { var last = ctx.fx.series[ctx.fx.series.length - 1]; return (1 / last[1]).toFixed(4) + " on " + fmtShort(last[0]); }
    } catch (e) { return ""; }
    return "";
  }
  function indicatorsMoved(ctx, TD) {
    var items = ((ctx.indicators || {}).items) || [], y = addDays(TD, -1), moved = items.filter(function (x) { return (x.history || []).some(function (hh) { return hh.date === TD || hh.date === y; }); });
    if (!items.length) return "";
    return '<h3 id="indmoved">Indicators <span class="small">' + (moved.length ? moved.length + " changed in two days" : "none changed in two days") + ' · <a href="#indicators">board</a></span></h3><p class="indrow">' + items.map(function (x) { return '<a href="#ind-' + esc(x.id) + '" class="indchip" title="' + esc(x.name + ": " + x.status) + '"><i style="background:' + IND_COL[x.status] + '"></i>' + esc(x.name.length > 28 ? x.name.slice(0, 26) + "…" : x.name) + "</a>"; }).join("") + "</p>" + (moved.length ? '<ul class="clean small">' + moved.map(function (x) { var hh = x.history[x.history.length - 1]; return '<li><i class="dot" style="background:' + IND_COL[hh.status] + '"></i><b>' + esc(x.name) + "</b> → " + esc(hh.status) + ": " + esc(hh.t) + "</li>"; }).join("") + "</ul>" : "");
  }
  /* ---------- 7.0: indicators and warning board ---------- */
  function indicatorsBlock(ctx, TD) {
    var IW = ctx.indicators; if (!IW || !(IW.items || []).length) return "";
    ctx._TD = TD;
    var n = { green: 0, amber: 0, red: 0 }; IW.items.forEach(function (x) { n[x.status] = (n[x.status] || 0) + 1; });
    var h = '<h3 id="indicators">Indicators and warning <span class="small">' + n.red + " red · " + n.amber + " amber · " + n.green + " green</span></h3>";
    h += '<p class="small">Each card: the threshold that moves the status, the source, the last change and a strip of the last eight.</p>';
    h += '<div class="indgrid">' + IW.items.map(function (x) {
      var hist = (x.history || []).slice(-8), last = hist[hist.length - 1], val = indicatorValue(x, ctx), age = last ? daysBetween(last.date, TD) : null;
      var links = [x.theatre ? "theatre:" + x.theatre : "", x.country ? "country:" + x.country : "", x.congress ? "congress:" + x.congress : ""].filter(Boolean);
      return '<div class="ind ' + fu(age === 0 ? "NEW" : "") + '" id="ind-' + esc(x.id) + '"><div class="ind-h"><i class="st" style="background:' + IND_COL[x.status] + '"></i><b>' + esc(x.name) + "</b>" + badge(age === 0 ? "NEW" : age === 1 ? "UPDATED" : "") + '</div><div class="small">Threshold: ' + esc(x.threshold || "") + (x.src ? " · " + esc(x.src) : "") + "</div>" + (val ? '<div class="ind-v">Now <b>' + esc(val) + "</b></div>" : "") + (last ? '<p class="small">Last change ' + esc(fmtShort(last.date)) + ": " + esc(last.t) + "</p>" : "") + '<div class="ind-strip">' + hist.map(function (hh) { return '<i style="background:' + IND_COL[hh.status] + '" title="' + esc(fmtShort(hh.date) + " " + hh.status + ": " + hh.t) + '"></i>'; }).join("") + "</div>" + linkChips(links) + "</div>";
    }).join("") + "</div>";
    return h;
  }
  /* ---------- 7.0: forecast ledger ---------- */
  function forecastBlock(ctx, TD) {
    var F = ctx.forecasts; if (!F || !(F.items || []).length) return "";
    var items = F.items.slice(), open = items.filter(function (f) { return f.status === "open"; }).sort(function (a, b) { return a.resolves < b.resolves ? -1 : 1; }), done = items.filter(function (f) { return f.status === "yes" || f.status === "no"; }).sort(function (a, b) { return a.resolves < b.resolves ? 1 : -1; });
    var brier = done.length ? done.reduce(function (t, f) { var o = f.status === "yes" ? 1 : 0; return t + Math.pow(f.p - o, 2); }, 0) / done.length : null;
    var h = '<section id="forecasts" class="watch"><h2>Forecast ledger <span class="num">run only · ' + open.length + " open · " + done.length + " resolved</span></h2>";
    h += '<p class="small">Dated, falsifiable calls with a probability. A call is never edited after it is made; it resolves on its date with the fact. Brier score: 0 is perfect, 0.25 is a coin flip.</p>';
    h += '<div class="strip cds"><div class="tile cd"><div class="lbl">Brier score</div><div class="val">' + (brier == null ? "—" : brier.toFixed(3)) + "</div><p>" + (done.length ? "over " + done.length + " resolved" : "nothing resolved yet") + '</p></div><div class="tile cd"><div class="lbl">Open calls</div><div class="val">' + open.length + "</div><p>" + (open.length ? "next resolves " + esc(fmtShort(open[0].resolves)) : "none") + '</p></div><div class="tile cd"><div class="lbl">Calibration</div><div class="val">' + (done.length ? Math.round(100 * done.filter(function (f) { return (f.p >= 0.5) === (f.status === "yes"); }).length / done.length) + "%" : "—") + "</div><p>calls on the right side of 50%</p></div></div>";
    if (open.length) h += '<h3>Open</h3><div class="fcl">' + open.map(function (f) { var pct = Math.round(f.p * 100), left = daysBetween(TD, f.resolves); return '<div class="fc" id="fc-' + esc(f.id) + '"><div class="fc-q">' + esc(f.q) + '</div><div class="fc-p"><div class="bar"><i style="width:' + pct + '%"></i><b style="left:50%"></b></div><span class="pv">' + pct + "%</span></div>" + '<div class="small">Made ' + esc(fmtShort(f.made)) + " · resolves " + esc(fmtShort(f.resolves)) + (left >= 0 ? " · " + (left === 0 ? "today" : left + " days") : " · overdue") + (f.domain ? " · " + esc(f.domain) : "") + "</div>" + (f.why ? '<p class="small">' + esc(f.why) + "</p>" : "") + linkChips([f.theatre ? "theatre:" + f.theatre : "", f.congress ? "congress:" + f.congress : "", f.country ? "country:" + f.country : ""].filter(Boolean)) + "</div>"; }).join("") + "</div>";
    if (done.length) h += '<h3>Resolved</h3>' + table(["Call", "p", "Outcome", "Brier"], done.slice(0, 20).map(function (f) { var o = f.status === "yes" ? 1 : 0; return "<tr><td>" + esc(f.q) + (f.note ? '<div class="small">' + esc(f.note) + "</div>" : "") + '</td><td class="d">' + Math.round(f.p * 100) + '%</td><td class="d">' + (f.status === "yes" ? "Yes" : "No") + " · " + esc(fmtShort(f.resolvedDate || f.resolves)) + '</td><td class="d">' + Math.pow(f.p - o, 2).toFixed(2) + "</td></tr>"; }).join(""), "lbl1");
    return h + "</section>";
  }
  /* ---------- 7.0: Ukraine panel ---------- */
  var UA_CITIES = [["Kyiv", 50.45, 30.52], ["Kharkiv", 49.99, 36.23], ["Sumy", 50.91, 34.80], ["Dnipro", 48.46, 35.05], ["Zaporizhzhia", 47.84, 35.14], ["Kherson", 46.64, 32.61], ["Odesa", 46.48, 30.73], ["Kramatorsk", 48.72, 37.55], ["Pokrovsk", 48.28, 37.18], ["Donetsk", 48.00, 37.80], ["Mariupol", 47.10, 37.55], ["Sevastopol", 44.62, 33.53]];
  function uaMap(F, W) {
    W = Math.max(240, Math.round(W || 360)); var lon0 = 22, lon1 = 41, lat0 = 44.2, lat1 = 52.5, H = Math.round(W * (lat1 - lat0) / (lon1 - lon0) / 0.67);
    function X(lon) { return (lon - lon0) / (lon1 - lon0) * W; }
    function Y(lat) { return H - (lat - lat0) / (lat1 - lat0) * H; }
    function path(rings) { var d = ""; (rings || []).forEach(function (r) { d += "M" + r.map(function (p) { return X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1); }).join("L") + "Z"; }); return d; }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" style="overflow:hidden" role="img" aria-label="Ukraine front line"><rect width="' + W + '" height="' + H + '" fill="var(--pc)" fill-opacity=".04"/>';
    Object.keys(F.countries || {}).forEach(function (iso) { s += '<path d="' + path(F.countries[iso]) + '" fill="' + (iso === "UKR" ? "var(--surface)" : "var(--bg)") + '" stroke="var(--muted)" stroke-opacity=".5" stroke-width=".8" stroke-linejoin="round"/>'; });
    s += '<path d="' + path(F.occupied2014) + '" fill="var(--crit)" fill-opacity=".22" stroke="var(--crit)" stroke-opacity=".5" stroke-width=".6"/>';
    s += '<path d="' + path(F.occupied) + '" fill="var(--crit)" fill-opacity=".45" stroke="var(--crit)" stroke-width=".8"/>';
    s += '<path d="' + path(F.unknown) + '" fill="var(--muted)" fill-opacity=".35" stroke="var(--muted)" stroke-width=".6"/>';
    s += '<path d="' + path(F.liberated) + '" fill="var(--up)" fill-opacity=".35" stroke="var(--up)" stroke-width=".6"/>';
    (F.arrows || []).forEach(function (a) { s += '<circle cx="' + X(a[1]).toFixed(1) + '" cy="' + Y(a[0]).toFixed(1) + '" r="2" fill="var(--crit)"/>'; });
    UA_CITIES.forEach(function (c) { if (W < 420 && ["Sumy", "Dnipro", "Kramatorsk", "Mariupol", "Sevastopol"].indexOf(c[0]) >= 0) return; s += '<circle cx="' + X(c[2]).toFixed(1) + '" cy="' + Y(c[1]).toFixed(1) + '" r="1.8" fill="var(--ink)"/>' + svgText(X(c[2]) + 4, Y(c[1]) + 3, c[0], "start", W < 420 ? 8 : 9, true, "var(--ink)"); });
    return s + "</svg>";
  }
  function ukraineBlock(ctx, E, TD) {
    var F = ctx.uaFront, WS = (ctx.worldSeries || {}).series || {}, M = (ctx.worldSeries || {}).meta || {};
    if (!F && !WS["ua-air"]) return "";
    var h = '<h3 id="ukraine">Ukraine in detail <span class="small">front line, the nightly numbers, talks</span></h3>';
    function last(k) { var a = WS[k] || []; return a.length ? a[a.length - 1] : null; }
    function mean7(k) { var a = (WS[k] || []).slice(-7); return a.length ? Math.round(a.reduce(function (t, p) { return t + p[1]; }, 0) / a.length) : null; }
    var tiles = [["ua-air", "Launched overnight"], ["ru-personnel-day", "Russian personnel, claimed per day"], ["ru-uav-day", "Russian UAVs claimed destroyed"], ["ua-drones-month", "Shahed-type launched, per month"]];
    h += '<div class="strip cds">' + tiles.map(function (t) { var l = last(t[0]); if (!l) return ""; var m = mean7(t[0]); return '<div class="tile cd"><div class="lbl">' + esc(t[1]) + '</div><div class="val">' + l[1].toLocaleString("en-GB") + "</div><p>" + esc(fmtShort(l[0])) + (m != null && (WS[t[0]] || []).length >= 3 && t[0] !== "ua-drones-month" ? " · 7-day mean " + m.toLocaleString("en-GB") : "") + (M[t[0]] && M[t[0]].source ? " · " + esc(M[t[0]].source) : "") + "</p></div>"; }).join("") + "</div>";
    if (F) h += '<div class="panel"><div class="lbl">Front line · DeepState, ' + esc(F.asofText || F.asof || "") + '</div><div class="chart" id="uamap" style="min-height:220px"></div><p class="small maplegend"><span><i class="solid" style="border-color:var(--crit);border-top-width:8px;opacity:.5"></i>occupied since 2022</span><span><i class="solid" style="border-color:var(--crit);border-top-width:8px;opacity:.25"></i>occupied since 2014</span><span><i class="solid" style="border-color:var(--muted);border-top-width:8px;opacity:.4"></i>status unknown</span><span><i class="solid" style="border-color:var(--up);border-top-width:8px;opacity:.4"></i>liberated</span><span><i class="ring" style="border-color:var(--crit);width:4px;height:4px"></i>axis of attack</span></p><p class="small">Source: <a href="' + esc(F.url || "https://deepstatemap.live/") + '" target="_blank" rel="noopener">DeepStateMAP</a>, simplified for this page; the run refreshes it weekly.</p></div>';
    var keys = ["ua-air", "ru-personnel-day", "ru-uav-day"].filter(function (k) { return (WS[k] || []).length > 1; });
    if (keys.length) { ctx._dts = ctx._dts || {}; h += '<div class="viz">' + keys.map(function (k) { ctx._dts[k] = (WS[k] || []).filter(function (p) { return p[0] <= TD; }); return '<div class="panel"><div class="lbl">' + esc((M[k] || {}).label || k) + "</div>" + chartBox("dts-" + k, 150) + "</div>"; }).join("") + "</div>"; }
    var talks = (((ctx.indicators || {}).items) || []).filter(function (x) { return x.theatre === "ru-ua"; });
    if (talks.length) h += '<p class="small">Indicators: ' + talks.map(function (x) { return '<a href="#ind-' + esc(x.id) + '"><i class="dot" style="background:' + IND_COL[x.status] + '"></i>' + esc(x.name) + "</a>"; }).join(" · ") + "</p>";
    h += '<p class="small">The theatre log is in the Russia–Ukraine card below; Saturday\'s week in war is in <a href="#ttpsec">The reading</a>.</p>';
    return h;
  }
  /* ---------- new uses of technology in war ---------- */
  function novelBlock(ctx, E, TD) {
    var NV = ctx.novel || {}, items = (NV.items || []).filter(function (x) { return x.date && x.date <= TD; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }), DOM = NV.domains || {};
    var h = '<section id="novel" class="watch"><h2>New in war <span class="num">first-seen uses of technology · ' + items.length + " logged</span></h2>";
    if (!items.length) return h + quiet("Nothing logged yet. The run appends a technique the first time it is observed.") + "</section>";
    h += '<p class="small">Techniques the run saw used for the first time, in any theatre and domain. The what-is-new line describes the mechanism as reported; it is not a forecast. Items in The news that carry one of these are marked NEW USE.</p>';
    var recent = items.filter(function (x) { return daysBetween(x.date, TD) <= 90; }), byD = {};
    recent.forEach(function (x) { (x.domains || []).forEach(function (d) { byD[d] = (byD[d] || 0) + 1; }); });
    var th = {}; (ctx.conflicts || []).forEach(function (t) { th[t.id] = t.short || t.name; });
    var byT = {}; recent.forEach(function (x) { var k = th[x.theatre] || x.theatre || "other"; byT[k] = (byT[k] || 0) + 1; });
    h += '<div class="viz"><div class="panel"><div class="lbl">By domain · last 90 days</div>' + hbars(Object.keys(byD).sort(function (a, b) { return byD[b] - byD[a]; }).map(function (d) { return [DOM[d] || d, byD[d]]; }), { inner: true, empty: "No entries in 90 days." }) + '</div><div class="panel"><div class="lbl">By theatre · last 90 days</div>' + hbars(Object.keys(byT).sort(function (a, b) { return byT[b] - byT[a]; }).map(function (k) { return [k, byT[k]]; }), { inner: true, empty: "No entries in 90 days." }) + "</div></div>";
    h += '<div class="nvlist">' + items.slice(0, 10).map(function (x) {
      var age = daysBetween(x.date, TD), map = srcMap(x.src);
      var c = '<div class="nv ' + fu(age <= 1 ? "NEW" : "") + '" id="novel-' + esc(x.id) + '"><div class="nv-h"><span class="d">' + esc(fmtShort(x.date)) + (x.date.slice(0, 4) !== TD.slice(0, 4) ? " " + x.date.slice(0, 4) : "") + "</span>" + (x.theatre ? '<a class="chip st" href="#th-' + esc(x.theatre) + '">' + esc(th[x.theatre] || x.theatre) + "</a>" : "") + (x.actor ? '<span class="chip st actor" title="' + esc(x.actor) + '">' + esc(x.actor.length > 48 ? x.actor.slice(0, 46).replace(/\s+\S*$/, "") + "…" : x.actor) + "</span>" : "") + (x.domains || []).map(function (d) { return '<span class="chip st dom">' + esc(DOM[d] || d) + "</span>"; }).join("") + badge(age === 0 ? "NEW" : age === 1 ? "UPDATED" : "") + inToday("novel", x.id) + "</div>";
      c += "<h4>" + esc(x.t) + "</h4>";
      if (x.what) c += "<p>" + rich(x.what, map) + "</p>";
      if (x.new) c += '<p class="sw-line"><b class="l">What is new</b>' + esc(x.new) + "</p>";
      if (x.prev) c += '<p class="small">Develops <a href="#novel-' + esc(x.prev) + '">' + esc(((NV.items || []).filter(function (y) { return y.id === x.prev; })[0] || {}).t || x.prev) + "</a></p>";
      return c + "</div>";
    }).join("") + "</div>";
    if (items.length > 10) h += '<p class="small">' + (items.length - 10) + " older entries stay in data/novel.json and the archive search.</p>";
    return h + "</section>";
  }
  /* ---------- state of the art: one card per domain, grouped, with lead held, score, challenger and sources ---------- */
  var SOTA_GROUPS = ["Models", "Media", "Physical", "Compute", "Other"];
  function sotaRow(r) {
    if (Array.isArray(r)) { var parts = String(r[1] || "").split(" · "); return { domain: r[0], system: parts[0], label: r[1], metric: parts.length > 1 ? parts.slice(1).join(" · ") : "", lab: r[2], since: r[3], src: r[4] || [] }; }
    return r || {};
  }
  function sotaGroup(r) { if (r.group) return r.group; var d = String(r.domain || "").toLowerCase(); return /model|coding|reasoning|agent|weights/.test(d) ? "Models" : /image|video|audio|voice|music/.test(d) ? "Media" : /robot|taxi|humanoid|drone|autonom/.test(d) ? "Physical" : /chip|accelerator|compute|cluster|fab/.test(d) ? "Compute" : "Other"; }
  function fmtScore(r) { if (r.score == null || r.score === "") return ""; var v = +r.score; return (isNaN(v) ? esc(r.score) : v >= 10000 ? v.toLocaleString("en-GB") : String(v)) + esc(r.unit || ""); }
  function sotaBlock(SO, TD) {
    var h = '<section id="sota" class="watch"><h2>State of the art <span class="num">' + (SO.asof ? "as of " + esc(fmtShort(SO.asof)) + " · rewritten Fridays" : "updated Fridays") + "</span></h2>";
    var rows = (SO.rows || []).map(sotaRow).filter(function (r) { return r.domain; });
    if (!rows.length) return h + quiet("The Friday table has not been written yet.") + "</section>";
    /* summary strip */
    var byCc = {}, open = 0, changed = 0, longest = null;
    rows.forEach(function (r) { if (r.cc) byCc[r.cc] = (byCc[r.cc] || 0) + 1; if (r.open) open++; if (r.changed) changed++; if (r.since) { var n = daysBetween(r.since, TD); if (!longest || n > longest[1]) longest = [r, n]; } });
    var ccs = Object.keys(byCc).sort(function (a, b) { return byCc[b] - byCc[a]; });
    h += '<div class="strip cds sota-sum">';
    h += '<div class="tile cd"><div class="lbl">Leads by country</div><div class="val">' + (ccs.length ? ccs.map(function (c) { return esc(c) + " " + byCc[c]; }).join(" · ") : "—") + "</div><p>" + rows.length + " domains tracked</p></div>";
    h += '<div class="tile cd"><div class="lbl">Changed this week</div><div class="val">' + changed + "</div><p>" + (changed ? rows.filter(function (r) { return r.changed; }).map(function (r) { return esc(r.domain); }).join(", ") : "no lead changed hands") + "</p></div>";
    h += '<div class="tile cd"><div class="lbl">Open weights</div><div class="val">' + open + " of " + rows.length + "</div><p>" + (open ? rows.filter(function (r) { return r.open; }).map(function (r) { return esc(r.system); }).join(", ") : "every leader is closed") + "</p></div>";
    if (longest) h += '<div class="tile cd"><div class="lbl">Longest-held lead</div><div class="val">' + longest[1] + " days</div><p>" + esc(longest[0].domain + " · " + longest[0].system) + "</p></div>";
    h += "</div>";
    /* lead held, all domains on one bar chart */
    var dated = rows.filter(function (r) { return r.since; }).sort(function (a, b) { return daysBetween(b.since, TD) - daysBetween(a.since, TD); });
    if (dated.length) h += '<div class="panel"><div class="lbl">Days the current leader has held each domain</div>' + hbars(dated.map(function (r) { return [r.domain + " · " + r.system, daysBetween(r.since, TD)]; }), { inner: true, fmt: function (v) { return v + " d"; } }) + "</div>";
    /* cards by group */
    var groups = {}; rows.forEach(function (r) { var g = sotaGroup(r); (groups[g] = groups[g] || []).push(r); });
    SOTA_GROUPS.forEach(function (g) {
      if (!groups[g]) return;
      h += "<h3>" + esc(g) + ' <span class="small">' + groups[g].length + (groups[g].length === 1 ? " domain" : " domains") + "</span></h3><div class=\"sota\">";
      groups[g].forEach(function (r) {
        var n = r.since ? daysBetween(r.since, TD) : null, map = srcMap(r.src), cites = (r.src || []).length ? '<sup class="r">' + r.src.map(function (z) { return citeLink(z[0], map); }).join("") + "</sup>" : "";
        h += '<div class="sotac' + (r.changed ? " chg" : "") + '"><div class="sc-d">' + esc(r.domain) + (r.changed ? '<span class="badge new">NEW LEADER</span>' : "") + "</div>";
        h += '<div class="sc-s">' + esc(r.system) + cites + "</div>";
        h += '<div class="sc-m">' + (r.lab ? '<span class="chip st">' + esc(r.lab) + "</span>" : "") + (r.cc ? '<span class="chip st cc">' + esc(r.cc) + "</span>" : "") + (r.open ? '<span class="chip st open">open weights</span>' : "") + "</div>";
        if (r.metric || r.score != null) h += '<div class="sc-k"><span class="small">' + esc(r.metric || "") + "</span>" + (r.score != null && r.score !== "" ? " <b>" + fmtScore(r) + "</b>" : "") + "</div>";
        if (r.runner && r.runner.system) h += '<div class="sc-r small">Challenger: ' + esc(r.runner.system) + (r.runner.lab ? " (" + esc(r.runner.lab) + ")" : "") + (r.runner.score != null ? " · " + esc(String(r.runner.score)) + esc(r.unit || "") : "") + (r.score != null && r.runner.score != null && !isNaN(+r.score) && !isNaN(+r.runner.score) ? '<span class="gap">gap ' + esc(String(Math.round((+r.score - +r.runner.score) * 100) / 100)) + esc(r.unit || "") + "</span>" : "") + "</div>";
        h += '<div class="sc-t small">' + (r.since ? "Lead since <b>" + esc(fmtShort(r.since)) + (r.since.slice(0, 4) !== TD.slice(0, 4) ? " " + r.since.slice(0, 4) : "") + "</b> · " + n + (n === 1 ? " day" : " days") : "Lead date not recorded") + "</div>";
        if (r.note) h += '<p class="small sc-n">' + esc(r.note) + "</p>";
        h += "</div>";
      });
      h += "</div>";
    });
    return h + '<p class="small">Leader per domain on the stated public benchmark or published figure; the lab\'s country, not the benchmark\'s. Challenger and gap are on the same metric.</p></section>';
  }
  /* ---------- priority countries: map, spending, election clock, resilience grid, activity ---------- */
  var CTRY_COL = { hu: "var(--p-sec)", sk: "var(--accent)", de: "var(--c-de)", ru: "var(--crit)", by: "var(--warn)", cn: "var(--c-mkt)" }, CTRY_ISO = { hu: "HUN", sk: "SVK", de: "DEU" };
  function ceuMap(ctx, W) {
    var geo = ctx.ceu || {}, M = ctx.countriesMap || {}, list = ctx.countries || [];
    W = Math.max(240, Math.round(W || 360)); var ph = W < 420, lon0 = ph ? 4.5 : 3.5, lon1 = ph ? 24.5 : 25.5, lat0 = 45.3, lat1 = 55.3, H = Math.round(W * (lat1 - lat0) / (lon1 - lon0) * (ph ? 1.9 : 1.5));
    function X(lon) { return (lon - lon0) / (lon1 - lon0) * W; }
    function Y(lat) { return H - (lat - lat0) / (lat1 - lat0) * H; }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" style="overflow:hidden" role="img" aria-label="Map of the priority countries with NATO sites and energy corridors">';
    s += '<rect width="' + W + '" height="' + H + '" fill="var(--pc)" fill-opacity=".04"/>';
    var role = {}; list.forEach(function (c) { role[CTRY_ISO[c.id]] = c; });
    Object.keys(geo).forEach(function (iso) {
      var c = role[iso], d = "";
      geo[iso].forEach(function (ring) { d += "M" + ring.map(function (p) { return X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1); }).join("L") + "Z"; });
      s += '<path d="' + d + '" fill="' + (c ? CTRY_COL[c.id] : "var(--surface)") + '" fill-opacity="' + (c ? (c.role === "priority" ? ".28" : ".16") : "1") + '" stroke="' + (c ? CTRY_COL[c.id] : "var(--muted)") + '" stroke-opacity="' + (c ? ".9" : ".45") + '" stroke-width="' + (c ? 1.3 : .7) + '" stroke-linejoin="round"/>';
    });
    (M.lines || []).forEach(function (l) { s += '<polyline points="' + l.pts.map(function (p) { return X(p[1]).toFixed(1) + "," + Y(p[0]).toFixed(1); }).join(" ") + '" fill="none" stroke="' + (l.k === "gas" ? "var(--c-be)" : "var(--c-nl)") + '" stroke-width="2.2" stroke-dasharray="' + (l.k === "gas" ? "5 3" : "1 0") + '" stroke-linecap="round" stroke-opacity=".9"><title>' + esc(l.n) + "</title></polyline>"; });
    (M.points || []).forEach(function (pt) {
      var x = X(pt.lon), y = Y(pt.lat), k = pt.k;
      if (k === "capital") s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.6" fill="var(--ink)"/>';
      else if (k === "hq") s += '<rect x="' + (x - 4).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" width="8" height="8" fill="var(--c-us)" stroke="var(--surface)" stroke-width="1"/>';
      else if (k === "force") s += '<path d="M' + x.toFixed(1) + " " + (y - 5.5).toFixed(1) + "l5 9h-10z" + '" fill="var(--up)" stroke="var(--surface)" stroke-width="1"/>';
      else s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" fill="none" stroke="var(--warn)" stroke-width="2"/>';
      var right = pt.lon < (lon0 + lon1) / 2 + 6, lab = pt.n; if (ph) { if (k === "capital" || k === "energy") lab = ""; else lab = pt.s || pt.n; }
      if (lab && k === "energy") s += svgText(x, y + 13, lab, "middle", 8.5, true, "var(--muted)");
      else if (lab && k === "capital") s += svgText(x, y - 5, lab, "middle", 8.5, true, "var(--muted)");
      else if (lab) s += svgText(x + (right ? 6 : -6), y + 3.5, lab, right ? "start" : "end", ph ? 8.5 : 9.5, true, "var(--ink)");
    });
    list.forEach(function (c) { var pt = { hu: [46.5, 17.0], sk: [49.1, 20.6], de: [51.3, 10.2] }[c.id]; if (pt) s += svgText(X(pt[1]), Y(pt[0]), c.name.toUpperCase(), "middle", ph ? 10 : 12, true, CTRY_COL[c.id]); });
    return s + "</svg>";
  }
  function spendChart(list, W) {
    var sets = list.filter(function (c) { return c.spend && (c.spend.pct || []).length > 1; }); if (!sets.length) return "";
    W = Math.max(240, Math.round(W || 360)); var H = 180, L = 34, R = 12, T = 14, B = 22, y0 = 2014, y1 = 2025, lo = 0, hi = 3.6;
    sets.forEach(function (c) { c.spend.pct.forEach(function (p) { y0 = Math.min(y0, p[0]); y1 = Math.max(y1, p[0]); hi = Math.max(hi, p[1] + 0.2); }); });
    function X(y) { return L + (y - y0) / (y1 - y0) * (W - L - R); }
    function Y(v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Defence spending as a share of GDP, NATO estimates">';
    [1, 2, 3].forEach(function (v) { s += '<line x1="' + L + '" y1="' + Y(v).toFixed(1) + '" x2="' + (W - R) + '" y2="' + Y(v).toFixed(1) + '" stroke="var(--line)"/>' + svgText(L - 4, Y(v) + 3.5, v + "%", "end", 9.5); });
    [[2, "NATO 2%"], [3.5, "core 3.5% by 2035"]].forEach(function (g) { s += '<line x1="' + L + '" y1="' + Y(g[0]).toFixed(1) + '" x2="' + (W - R) + '" y2="' + Y(g[0]).toFixed(1) + '" stroke="var(--crit)" stroke-dasharray="3 3" stroke-opacity=".8"/>' + svgText(L + 4, Y(g[0]) - 3, g[1], "start", 9, true, "var(--crit)"); });
    for (var y = y0; y <= y1; y += (W < 420 ? 2 : 1)) s += svgText(X(y), H - 6, String(y).slice(2), "middle", 9);
    sets.forEach(function (c) {
      var pts = c.spend.pct.map(function (p) { return X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1); }), last = c.spend.pct[c.spend.pct.length - 1];
      s += '<polyline points="' + pts.join(" ") + '" fill="none" stroke="' + CTRY_COL[c.id] + '" stroke-width="' + (c.role === "priority" ? 2.2 : 1.5) + '" stroke-linejoin="round"' + (c.role !== "priority" ? ' stroke-dasharray="4 3"' : "") + "/>";
      s += '<circle cx="' + X(last[0]).toFixed(1) + '" cy="' + Y(last[1]).toFixed(1) + '" r="3" fill="' + CTRY_COL[c.id] + '"/>';
    });
    return s + "</svg>" + '<p class="small maplegend">' + sets.map(function (c) { var last = c.spend.pct[c.spend.pct.length - 1]; return '<span><i class="' + (c.role === "priority" ? "solid" : "dash") + '" style="border-color:' + CTRY_COL[c.id] + '"></i>' + esc(c.name) + " <b>" + last[1].toFixed(2) + "%</b> in " + last[0] + "</span>"; }).join("") + "</p>";
  }
  function electionClock(c, TD) {
    var el = c.election || {}; if (!el.last || !el.due) return "";
    var a = pd(el.last), b = pd(el.due), span = (b - a) / DAY, t = Math.max(0, Math.min(1, (pd(TD) - a) / DAY / span)), snap = el.snapFrom ? Math.max(0, Math.min(1, (pd(el.snapFrom) - a) / DAY / span)) : null, left = daysBetween(TD, el.due);
    var h = '<div class="eclock"><div class="eclock-l"><span>' + esc(fmtShort(el.last) + " " + el.last.slice(0, 4)) + '</span><span>' + (left > 0 ? Math.round(left / 30.4) + " months to the due date" : "due") + '</span><span>' + esc(fmtShort(el.due) + " " + el.due.slice(0, 4)) + "</span></div>";
    h += '<div class="eclock-bar"><i class="done" style="width:' + (t * 100).toFixed(1) + '%;background:' + CTRY_COL[c.id] + '"></i>' + (snap != null ? '<i class="snap" title="' + esc(el.snapNote || "snap election possible") + '" style="left:' + (snap * 100).toFixed(1) + "%;width:" + ((1 - snap) * 100).toFixed(1) + '%"></i>' : "") + '<b style="left:' + (t * 100).toFixed(1) + '%"></b></div>';
    if (el.snapFrom) h += '<p class="small" style="margin:2px 0 0">Hatched: ' + esc(el.snapNote || "snap election possible") + ".</p>";
    return h + "</div>";
  }
  var BLR_SHORT = ["Govt", "Energy", "People", "Food, water", "Casualties", "Comms", "Transport"];
  function blrGrid(c, BLR) {
    var notes = {}; (c.blr || []).forEach(function (b) { notes[b.n] = b; });
    return '<div class="blrg" role="list" aria-label="Seven baseline requirements">' + BLR.map(function (name, i) { var b = notes[i + 1]; return '<div class="blrc' + (b ? " has" : "") + '" role="listitem" title="' + esc((i + 1) + ". " + name + (b ? ": " + b.t : ": no note yet")) + '"><b>' + (i + 1) + "</b><span>" + esc(BLR_SHORT[i] || name) + "</span></div>"; }).join("") + "</div>";
  }
  function activityBars(c, TD) {
    var weeks = []; for (var i = 11; i >= 0; i--) weeks.push(0);
    (c.log || []).forEach(function (e) { var n = daysBetween(e.date, TD); if (n >= 0 && n < 84) weeks[11 - Math.floor(n / 7)]++; });
    var mx = Math.max.apply(null, weeks) || 1, W = 120, H = 26;
    return '<svg class="actv" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Log entries per week, last 12 weeks"><title>Log entries per week, last 12 weeks</title>' + weeks.map(function (v, i) { var h = v ? Math.max(3, v / mx * (H - 2)) : 1.5; return '<rect x="' + (i * 10) + '" y="' + (H - h).toFixed(1) + '" width="7" height="' + h.toFixed(1) + '" rx="1" fill="' + (v ? CTRY_COL[c.id] : "var(--line)") + '"/>'; }).join("") + "</svg>";
  }
  /* priority countries: standing profile per country, then today's items for it */
  /* Parkstad today: the local feeds in data/local.json (tools/local.js) plus what the run writes there */
  var LKI_L = ["", "good", "good", "good", "moderate", "moderate", "moderate", "insufficient", "insufficient", "bad", "bad", "very bad"];
  function localBlock(ctx, TD, PEV) {
    var LO = ctx.local; if (!LO) return "";
    var h = '<section id="local" class="home"><h2>Parkstad today <span class="num">air, power, roads, rails, the Maas, the sky, notices, news</span></h2>', tiles = [];
    var A = LO.air, ad = A && A.days ? (A.days.filter(function (x) { return x.date === TD; })[0] || A.days[0]) : null, at = A && A.days ? A.days.filter(function (x) { return x.date > TD; })[0] : null;
    if (ad) {
      var lk = A.lki, pol = Object.keys(ad.pollen || {}).filter(function (k) { return ad.pollen[k] > 0; }).sort(function (a, b) { return ad.pollen[b] - ad.pollen[a]; });
      tiles.push('<div class="tile"><div class="lbl">Air · ' + (lk ? "Heerlen" : "model") + '</div><div class="val">' + (lk ? '<span class="lki l' + Math.min(11, lk.value) + '">' + lk.value + "</span> <small>" + (LKI_L[Math.min(11, lk.value)] || "") + "</small>" : "AQI " + ad.aqi) + "</div><p>" + (lk ? "LKI at " + esc(fmtShort(lk.time.slice(0, 10))) + " " + esc(lk.time.slice(11, 16)) + " · " : "") + "PM2.5 " + ad.pm25 + " µg/m³ · UV max " + ad.uv + (pol.length ? " · pollen: " + pol.map(function (k) { return k + " " + ad.pollen[k]; }).join(", ") : " · no pollen") + "</p>" + (at ? "<p>Tomorrow AQI " + at.aqi + ", UV " + at.uv + (Object.keys(at.pollen || {}).some(function (k) { return at.pollen[k] > 0; }) ? ", pollen rising" : "") + "</p>" : "") + "</div>");
    }
    var P = LO.power, pday = P && P.days ? (P.days.filter(function (x) { return x.date > TD; })[0] || P.days.filter(function (x) { return x.date === TD; })[0] || P.days[P.days.length - 1]) : null;
    if (pday && pday.hours && pday.hours.length) {
      var mx = Math.max.apply(null, pday.hours.map(function (x) { return x[1]; })), mn = Math.min.apply(null, pday.hours.map(function (x) { return x[1]; }));
      var bars = pday.hours.map(function (x) { var t = mx > mn ? (x[1] - mn) / (mx - mn) : 0; return '<i title="' + x[0] + ':00 €' + x[1].toFixed(3) + '" style="height:' + (4 + t * 24).toFixed(0) + 'px;background:' + (t < 0.33 ? "var(--up)" : t > 0.66 ? "var(--crit)" : "var(--muted)") + '"></i>'; }).join("");
      tiles.push('<div class="tile"><div class="lbl">Power · day-ahead ' + (pday.date === TD ? "today" : pday.date === addDays(TD, 1) ? "tomorrow" : esc(fmtShort(pday.date))) + '</div><div class="val">€' + pday.avg.toFixed(3) + " <small>per kWh avg</small></div>" + (pday.cheapest3 ? "<p>cheapest " + pday.cheapest3.from + "–" + pday.cheapest3.to + ":00 at €" + pday.cheapest3.avg.toFixed(3) + (pday.dearest3 ? " · dearest " + pday.dearest3.from + "–" + pday.dearest3.to + ":00 at €" + pday.dearest3.avg.toFixed(3) : "") + "</p>" : "") + '<div class="pbar" role="img" aria-label="Hourly price, midnight to midnight">' + bars + '</div><p class="small">market price with VAT, before energy tax and margin</p></div>');
    }
    var Mz = LO.maas, mdays = Mz && Mz.days ? Mz.days : [];
    if (mdays.length) {
      var past = mdays.filter(function (r) { return r[0] <= TD; }), ml = past[past.length - 1] || mdays[0], fut = mdays.filter(function (r) { return r[0] > TD; }), fmax = fut.reduce(function (a, r) { return !a || (r[2] || r[1]) > (a[2] || a[1]) ? r : a; }, null), thr = Mz.thresholds || {};
      var mst = ml[1] >= (thr.red || 1500) ? "crit" : ml[1] >= (thr.amber || 1000) ? "warn" : "up";
      tiles.push('<div class="tile"><div class="lbl">Maas · model</div><div class="val"><span style="color:var(--' + mst + ')">' + Math.round(ml[1]) + '</span> <small>m³/s</small></div><p>' + (fmax ? "7-day peak " + Math.round(fmax[2] || fmax[1]) + " on " + esc(fmtShort(fmax[0])) + " · " : "") + "watch above " + (thr.amber || 1000).toLocaleString("en-GB") + ", high water above " + (thr.red || 1500).toLocaleString("en-GB") + '</p><p class="small">GloFAS estimate north of Maastricht, not the gauge</p></div>');
    }
    var S = LO.sky;
    if (S && S.max3d) {
      var kp = S.max3d.kp, kc = kp >= 7 ? "crit" : kp >= 5 ? "warn" : "muted";
      tiles.push('<div class="tile"><div class="lbl">Sky · geomagnetic</div><div class="val"><span style="color:var(--' + kc + ')">Kp ' + kp.toFixed(1) + "</span>" + (S.max3d.scale ? ' <small>' + esc(S.max3d.scale) + "</small>" : "") + "</div><p>peak of the next three days, " + esc(nl2(S.max3d.time)) + (S.now ? " · now Kp " + S.now.kp.toFixed(1) : "") + "</p><p>" + (kp >= 5 ? "aurora possible low in the north on a clear night" : "no aurora chance; Kp 5 is the line") + "</p></div>");
    }
    var R = LO.roads;
    if (R && R.items) {
      var hs = R.items.filter(function (i) { return i.sev === "high"; }), n1 = R.items[0];
      var MG = { carriagewayClosures: "closure", lanesDeviated: "lane shift", laneClosures: "lane closure", roadClosed: "road closed", contraflow: "contraflow" };
      tiles.push('<div class="tile"><div class="lbl">Roads · 25 km</div><div class="val">' + R.count + " <small>measures in force</small></div><p>" + (n1 ? "nearest: " + (MG[n1.mgmt] || n1.mgmt || n1.cause || "work") + " by " + esc(n1.by || "unknown") + ", " + n1.km + " km, to " + esc(fmtShort(n1.to)) : "") + "</p>" + (hs.length ? "<p>" + hs.length + " high-severity: " + hs.slice(0, 2).map(function (i) { return esc(i.by) + " to " + esc(fmtShort(i.to)) + " (" + i.km + " km)"; }).join("; ") + "</p>" : "") + '<p class="small">NDW, incidents and works with coordinates; the feed carries no road numbers</p></div>');
    }
    var RL = LO.rail;
    if (RL) tiles.push('<div class="tile"><div class="lbl">Rails · Limburg</div><div class="val">' + (RL.items && RL.items.length ? RL.items.length + " <small>disruption" + (RL.items.length > 1 ? "s" : "") + "</small>" : "Clear") + "</div>" + (RL.items && RL.items.length ? '<ul class="clean small">' + RL.items.slice(0, 3).map(function (x) { return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.t) + "</a></li>"; }).join("") + "</ul>" : "<p>no disruption touching Limburg or the Aachen and Liège lines</p>") + "<p class=\"small\">" + RL.total + " nationwide · Rijden de Treinen, " + esc(nl2(RL.asof)) + "</p></div>");
    if (LO.noise) tiles.push('<div class="tile"><div class="lbl">Noise · AWACS and Beek</div><div class="val">' + esc(LO.noise.h || "Flights") + "</div><p>" + rich(LO.noise.t || "") + "</p></div>");
    h += '<div class="strip">' + tiles.join("") + "</div>";
    var N = LO.notices;
    if (N && N.items && N.items.length) h += '<h3>Notices for Hoensbroek <span class="small">gemeente Heerlen, last three weeks</span></h3><ul class="exl">' + N.items.slice(0, 8).map(function (x) { return '<li><span class="d">' + esc(fmtShort(x.date)) + '</span><span><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.t) + "</a></span></li>"; }).join("") + "</ul>";
    else if (N) h += '<p class="small">No gemeente notice named Hoensbroek in the last three weeks.</p>';
    var NW = LO.news;
    if (NW && NW.items && NW.items.length) h += '<h3>Limburg this morning <span class="small">L1, newest first · Dutch with English beneath</span></h3><ul class="clean small nwl">' + NW.items.slice(0, 6).map(function (x) { return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener" lang="nl">' + esc(x.t) + "</a>" + (x.en ? '<span class="en">' + esc(x.en) + "</span>" : '<span class="en muted">English follows with the next run</span>') + "</li>"; }).join("") + "</ul>";
    var CU = (LO.culture || []).filter(function (e) { return (e.end || e.date) >= TD; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 5), AD = (LO.admin || []).filter(function (e) { return e.date >= TD; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 3);
    if (CU.length || AD.length || (LO.roda || []).length) {
      h += '<h3>Local calendar <span class="small">Vastelaovend, Pinkpop, the Roda, the household admin</span></h3><ul class="wn">';
      CU.forEach(function (e) { var n = daysBetween(TD, e.date); h += '<li><span class="d">' + esc(fmtShort(e.date) + (e.end ? " – " + fmtShort(e.end) : "")) + '</span><span class="w"><span class="dot" style="background:' + catColor("mkt") + '"></span>' + esc(e.t) + " " + icsLink(e.t.split(";")[0], e.date, e.end) + '<span class="small">' + (n <= 0 ? "today" : n === 1 ? "tomorrow" : "in " + n + " days") + (e.verified === false ? " · to confirm" : "") + "</span></span></li>"; });
      (LO.roda || []).filter(function (g) { return g.date >= TD; }).slice(0, 3).forEach(function (g) { h += '<li><span class="d">' + esc(fmtShort(g.date)) + '</span><span class="w"><span class="dot" style="background:' + catColor("nfl") + '"></span>Roda JC ' + (g.home ? "vs " : "at ") + esc(g.opp) + (g.time ? " · " + esc(g.time) : "") + (g.home ? " · Parkstad Limburg Stadion" : "") + "</span></li>"; });
      AD.forEach(function (e) { var n = daysBetween(TD, e.date); h += '<li><span class="d">' + esc(fmtShort(e.date)) + '</span><span class="w"><span class="dot" style="background:' + catColor("deadline") + '"></span>' + esc(e.t) + '<span class="small">in ' + n + " days" + (e.verified === false ? " · to confirm" : "") + "</span></span></li>"; });
      h += "</ul>";
    }
    if (LO.shops && (LO.shops.koopzondag || LO.shops.weekmarkt)) h += '<p class="small"><b>Shops and markets:</b> ' + esc([LO.shops.koopzondag, LO.shops.weekmarkt].filter(Boolean).join(" · ")) + "</p>";
    if (LO.flu) h += '<p class="small"><b>Flu:</b> ' + rich(LO.flu.t || "") + "</p>";
    var stale = ["air", "power", "maas", "sky", "roads", "rail", "notices", "news"].filter(function (k) { return LO[k] && LO[k].stale; });
    h += '<p class="small">Feeds refreshed ' + esc(nl2(LO.asof)) + " by tools/local.js" + (LO.errors && LO.errors.length ? " · failed: " + esc(LO.errors.map(function (e) { return e.split(":")[0]; }).join(", ")) : "") + (stale.length ? " · showing the last good copy of " + esc(stale.join(", ")) : "") + ". Town-level only; no address is stored.</p>";
    return h + "</section>";
  }
  function nl2(isoT) { if (!isoT) return "–"; try { var d = new Date(isoT); if (isNaN(d.getTime())) return "–"; return DOW[d.getDay()] + " " + d.toLocaleTimeString("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }
  /* household electricity and gas: CBS average consumer tariffs, standing file data/energy.json */
  function energyBlock(ctx, sparks, TD) {
    var EN = ctx.energy, M = EN && EN.months ? EN.months.filter(function (x) { return x.elec && x.gas; }) : [];
    if (M.length < 2) return "";
    var L = M[M.length - 1], P = M[M.length - 2], Y = M.filter(function (x) { return x.m === String(+L.m.slice(0, 4) - 1) + L.m.slice(4); })[0];
    function allin(x, k) { return (x[k].var || 0) + (x[k].tax || 0) + (x[k].ode || 0); }
    function mon(m) { return MON[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); }
    function pct(a, b) { return b ? signed((a - b) / b * 100, 1, "%") : ""; }
    function card(lbl, k, unit, dec) {
      var v = allin(L, k), pv = allin(P, k), yv = Y ? allin(Y, k) : null, ser = M.slice(-24).map(function (x) { return [x.m + "-01", allin(x, k)]; });
      return '<div class="card"><div class="lbl">' + lbl + '</div><div class="val">€' + v.toFixed(dec) + ' <small>' + unit + '</small></div><p><span class="chg ' + dir(v - pv) + '">' + pct(v, pv) + "</span> vs " + mon(P.m) + (yv != null ? ' · <span class="chg ' + dir(v - yv) + '">' + pct(v, yv) + "</span> vs a year ago" : "") + "</p><p>supply €" + (L[k].var || 0).toFixed(dec) + " + tax €" + ((L[k].tax || 0) + (L[k].ode || 0)).toFixed(dec) + (k === "elec" && L.elec.dyn ? " · dynamic supply €" + L.elec.dyn.toFixed(dec) : "") + '</p><div class="spark" data-s="' + (sparks.push(ser) - 1) + '" title="' + esc(mon(ser[0][0].slice(0, 7)) + " – " + mon(L.m)) + '"></div></div>';
    }
    var T = EN.typical || { kwh: 2500, m3: 1200 }, fixed = (L.elec.net || 0) + (L.elec.fixed || 0) + (L.gas.net || 0) + (L.gas.fixed || 0) + (L.rebate || 0), yr = T.kwh * allin(L, "elec") + T.m3 * allin(L, "gas") + fixed;
    var yrP = Y ? T.kwh * allin(Y, "elec") + T.m3 * allin(Y, "gas") + (Y.elec.net || 0) + (Y.elec.fixed || 0) + (Y.gas.net || 0) + (Y.gas.fixed || 0) + (Y.rebate || 0) : null;
    var h = '<h3 id="energy">Household energy <span class="small">new variable contracts, VAT included · CBS, ' + esc(mon(L.m)) + "</span></h3>";
    h += '<div class="cards">' + card("Electricity, all-in", "elec", "per kWh", 3) + card("Gas, all-in", "gas", "per m³", 3);
    h += '<div class="card"><div class="lbl">Typical home, a year</div><div class="val">€' + Math.round(yr).toLocaleString("en-GB") + "</div><p>" + T.kwh.toLocaleString("en-GB") + " kWh and " + T.m3.toLocaleString("en-GB") + " m³ at this month\'s prices" + (yrP != null ? ' · <span class="chg ' + dir(yr - yrP) + '">' + pct(yr, yrP) + "</span> vs a year ago" : "") + "</p><p>energy €" + Math.round(T.kwh * allin(L, "elec") + T.m3 * allin(L, "gas")).toLocaleString("en-GB") + " · fixed charges €" + Math.round(fixed).toLocaleString("en-GB") + " after the tax rebate</p></div>";
    h += '<div class="card"><div class="lbl">Fixed charges, a year</div><div class="val">€' + Math.round((L.elec.net || 0) + (L.gas.net || 0)).toLocaleString("en-GB") + ' <small>network</small></div><p>electricity €' + Math.round(L.elec.net || 0) + " · gas €" + Math.round(L.gas.net || 0) + "</p><p>standing charges €" + Math.round((L.elec.fixed || 0) + (L.gas.fixed || 0)) + " · tax rebate €" + Math.round(L.rebate || 0) + "</p></div></div>";
    h += '<p class="small">' + esc(EN.region || "") + ". " + (EN.src && EN.src[0] ? '<a href="' + esc(EN.src[0][1]) + '" target="_blank" rel="noopener">' + esc(EN.src[0][0]) + "</a>. " : "") + "The last month is provisional until CBS publishes the next.</p>";
    return h;
  }
  /* a tank for each car: CBS daily pump price (fuel.json series) × tank size, at the pump and tax-exempt, in euros and in dollars at that day's ECB rate */
  function taxFreePerLitre(F, fuel, pump) { var t = (F && F.taxFree) || {}; if (t.price && typeof t.price[fuel] === "number") return t.price[fuel]; var vat = typeof t.vat === "number" ? t.vat : 0.21, ex = (t.excise || {})[fuel]; return typeof ex === "number" ? pump / (1 + vat) - ex : null; }
  function tankBlock(ctx, TD) {
    var F = ctx.fuel, S = (F && F.series) || {}, cars = (F && F.cars) || [];
    if (!cars.length || !ctx.fx || !ctx.fx.series) return "";
    var fx = ctx.fx.series.filter(function (p) { return p[0] <= TD && p[1] > 0; });
    function rateAt(k) { var v = null; for (var i = 0; i < fx.length && fx[i][0] <= k; i++) v = fx[i][1]; return v; }
    function ser(fuel) { return (S[fuel === "diesel" ? "nl-diesel" : "nl-e95"] || []).filter(function (r) { return r[0] <= TD && typeof r[1] === "number"; }); }
    var base = ser(cars[0].fuel || "e95"); if (base.length < 30) return "";
    var last = base[base.length - 1], from = addDays(last[0], -365), tf = F.taxFree || {}, anyTF = cars.some(function (c) { return taxFreePerLitre(F, c.fuel || "e95", last[1]) != null; });
    var h = '<h3 id="tank">A tank for each car' + (anyTF ? ", tax-exempt" : "") + ' <span class="small">' + (anyTF ? "pump price without VAT and excise, the NATO rate · " : "") + "CBS, " + esc(fmtShort(last[0])) + "</span></h3>";
    h += '<div class="cards">' + cars.map(function (c) {
      var fuel = c.fuel || "e95", D = ser(fuel); if (D.length < 2) return "";
      var L1 = D[D.length - 1], ago = null; D.forEach(function (r) { if (r[0] <= from) ago = r; }); ago = ago || D[0];
      var r0 = rateAt(L1[0]), rA = rateAt(ago[0]), net = taxFreePerLitre(F, fuel, L1[1]), netA = taxFreePerLitre(F, fuel, ago[1]), pay = net != null ? net : L1[1], payA = netA != null ? netA : ago[1];
      var eur = pay * c.litres, usd = r0 ? eur * r0 : null, eurA = payA * c.litres, usdA = rA ? eurA * rA : null, pump = L1[1] * c.litres, pumpU = r0 ? pump * r0 : null;
      var hi = null, lo = null; D.filter(function (r) { return r[0] >= from; }).forEach(function (r) { var rr = rateAt(r[0]), n = taxFreePerLitre(F, fuel, r[1]); if (!rr) return; var u = (n != null ? n : r[1]) * c.litres * rr; if (!hi || u > hi[1]) hi = [r[0], u]; if (!lo || u < lo[1]) lo = [r[0], u]; });
      var o = '<div class="card tank"><div class="lbl">' + esc(c.name) + " · " + c.litres + " L" + (fuel === "diesel" ? " diesel" : "") + '</div><div class="val">€' + eur.toFixed(2) + (usd ? ' <small>$' + usd.toFixed(2) + (net != null ? " tax-exempt" : "") + "</small>" : "") + "</div>";
      if (net != null) o += "<p>at the pump €" + pump.toFixed(2) + (pumpU ? ", $" + pumpU.toFixed(2) : "") + " · the exemption saves €" + (pump - eur).toFixed(2) + " a tank</p>";
      o += "<p>" + (usdA ? '<span class="chg ' + (eur > eurA + 0.005 ? "down" : eur < eurA - 0.005 ? "up" : "flat") + '">' + signed((eur - eurA) / eurA * 100, 1, "%") + "</span> on a year ago: €" + eurA.toFixed(2) + ", $" + usdA.toFixed(2) + " on " + esc(fmtShort(ago[0])) : "") + "</p>";
      if (hi && lo) o += "<p>12-month high $" + hi[1].toFixed(2) + " (" + esc(fmtShort(hi[0])) + "), low $" + lo[1].toFixed(2) + " (" + esc(fmtShort(lo[0])) + ")</p>";
      return o + "</div>";
    }).join("") + "</div>";
    var petrol = cars.filter(function (c) { return (c.fuel || "e95") === "e95"; });
    if (petrol.length) {
      ctx._tank = { year: base.filter(function (r) { return r[0] >= from; }).map(function (r) { var n = taxFreePerLitre(F, "e95", r[1]); return [r[0], n != null ? n : r[1], rateAt(r[0])]; }).filter(function (r) { return r[2]; }), cars: petrol };
      h += '<div class="panel"><div class="lbl">A ' + (anyTF ? "tax-exempt " : "") + "tank in dollars, last 12 months · rises red, falls green · left axis " + esc(petrol[0].name.replace(/^\d{4} /, "")) + (petrol[1] ? ", right axis " + esc(petrol[1].name.replace(/^\d{4} /, "")) : "") + '</div><div class="chart" id="tankchart" style="min-height:170px"></div></div>';
    }
    h += '<p class="small">' + (anyTF ? (tf.price ? "Tax-exempt price as set in data/fuel.json. " : "Tax-exempt price = pump price ÷ " + (1 + (typeof tf.vat === "number" ? tf.vat : 0.21)).toFixed(2) + " (VAT) minus excise of €" + ((tf.excise || {}).e95 || 0).toFixed(3) + " a litre for petrol" + ((tf.excise || {}).diesel ? " and €" + tf.excise.diesel.toFixed(3) + " for diesel" : "") + (tf.note ? "; " + esc(tf.note) : "") + ". ") : "") + "Dollar figures use that day\'s ECB rate. Tank sizes, fuel and the exemption rates are in data/fuel.json.</p>";
    return h;
  }
  function tankChart(T, W) {
    if (!T || !T.year || T.year.length < 2 || !T.cars.length) return "";
    var lA = T.cars[0].litres, lB = T.cars[1] ? T.cars[1].litres : null, pts = T.year.map(function (r) { return [r[0], r[1] * r[2]]; });
    W = Math.max(240, Math.round(W || 360)); var H = 170, L = 40, R = lB ? 44 : 12, Tp = 10, B = 22, lo = Infinity, hi = -Infinity;
    pts.forEach(function (p) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }); var pad = (hi - lo) * 0.08 || 0.1; lo -= pad; hi += pad;
    var t0 = pd(pts[0][0]).getTime(), t1 = pd(pts[pts.length - 1][0]).getTime();
    function X(k) { return L + (pd(k).getTime() - t0) / (t1 - t0 || 1) * (W - L - R); }
    function Y(v) { return Tp + (1 - (v - lo) / (hi - lo)) * (H - Tp - B); }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Cost of a tank in dollars over twelve months">';
    var step = (hi - lo) * lA > 40 ? 10 : 5, vA0 = Math.ceil(lo * lA / step) * step;
    for (var v = vA0; v <= hi * lA; v += step) { var y = Y(v / lA); s += '<line x1="' + L + '" y1="' + y.toFixed(1) + '" x2="' + (W - R) + '" y2="' + y.toFixed(1) + '" stroke="var(--line)"/>' + svgText(L - 4, y + 3.5, "$" + v, "end", 9.5); if (lB) s += svgText(W - R + 4, y + 3.5, "$" + Math.round(v / lA * lB), "start", 9.5); }
    var months = {}; pts.forEach(function (p) { var m = p[0].slice(0, 7); if (!months[m]) months[m] = p[0]; });
    var every = W < 420 ? 2 : 1; Object.keys(months).forEach(function (m, i) { if (i === 0 || i % every) return; var x = X(months[m]); s += svgText(x, H - 6, MON[+m.slice(5, 7) - 1], "middle", 9); });
    for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i]; if (a[1] === b[1]) continue; s += '<line x1="' + X(a[0]).toFixed(1) + '" y1="' + Y(a[1] * 1).toFixed(1) + '" x2="' + X(b[0]).toFixed(1) + '" y2="' + Y(b[1]).toFixed(1) + '" stroke="' + (b[1] > a[1] ? "var(--crit)" : "var(--up)") + '" stroke-width="1.8" stroke-linecap="round"/>'; }
    var mx = pts[0], mn = pts[0]; pts.forEach(function (p) { if (p[1] > mx[1]) mx = p; if (p[1] < mn[1]) mn = p; });
    [[mx, "high", -6], [mn, "low", 12]].forEach(function (q) { var p = q[0]; s += '<circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="3" fill="' + (q[1] === "high" ? "var(--crit)" : "var(--up)") + '"/>' + svgText(Math.min(W - R - 30, Math.max(L + 30, X(p[0]))), Y(p[1]) + q[2], "$" + (p[1] * lA).toFixed(0) + " " + fmtShort(p[0]), "middle", 9.5, true, "var(--ink)"); });
    var e = pts[pts.length - 1]; s += '<circle cx="' + X(e[0]).toFixed(1) + '" cy="' + Y(e[1]).toFixed(1) + '" r="3.5" fill="var(--ink)"/>';
    return s + "</svg>";
  }
  function countriesBlock(E, ctx, TD) {
    var list = ctx.countries || [], its = E.countries || [], BLR = (ctx.countriesBLR || []);
    if (!list.length && !its.length) return "";
    var h = '<section id="countries" class="news"><h2>Priority countries <span class="num">Hungary · Slovakia · Germany · context: Russia, Belarus, China</span></h2>';
    h += '<p class="small">Hungary and Slovakia are the assigned priority countries, Germany the secondary. Russia, Belarus and China are profiled as context for what they do to the flank and to those three. Profiles change only when the facts do; items are today\'s news and each priority-country item quotes one source in the country\'s language; numbered rows are NATO\'s seven baseline requirements.</p>';
    if (ctx.ceu) h += '<div class="panel"><div class="lbl">NATO sites and energy corridors</div><div class="chart" id="ceumap" style="min-height:200px"></div><p class="small maplegend"><span><i class="sq"></i>NATO headquarters</span><span><i class="tri"></i>NATO force</span><span><i class="ring"></i>nuclear plant</span><span><i class="dash"></i>TurkStream gas</span><span><i class="solid"></i>Druzhba oil</span></p></div>';
    if (list.some(function (c) { return c.spend; })) h += '<div class="panel"><div class="lbl">Defence spending, share of GDP · NATO estimates for allies, SIPRI for context countries' + (list.some(function (c) { return c.spend && c.spend.verified === false; }) ? " · to confirm" : "") + '</div><div class="chart" id="spendchart" style="min-height:180px"></div></div>';
    list.forEach(function (c) {
      var g = c.gov || {}, el = c.election || {}, nato = c.nato || {}, mine = its.filter(function (i) { return i.cc === c.id; }), log = (c.log || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 4);
      var age = log.length ? daysBetween(log[0].date, TD) : null, isCtx = c.role === "context";
      h += '<div class="ctry ' + fu(age === 0 ? "NEW" : "") + '" id="ctry-' + esc(c.id) + '"><div class="ctry-h"><b>' + esc(c.name) + '</b><span class="chip st tier">' + esc(c.role || "") + "</span>" + (c.verified === false ? '<span class="chip st">profile to confirm</span>' : "") + inToday("country", c.id) + badge(age === 0 ? "NEW" : age === 1 ? "UPDATED" : "") + '<span class="actw" title="Log entries per week, last 12 weeks">' + activityBars(c, TD) + "</span></div>";
      h += '<dl class="kv">';
      if (g.head) h += "<dt>Government</dt><dd>" + esc(g.head) + (g.title ? ", " + esc(g.title) : "") + (g.party ? " (" + esc(g.party) + ")" : "") + (g.since ? ", since " + esc(fmtLong(g.since)) : "") + (g.majority ? ". " + esc(g.majority) + "." : "") + (g.defmin ? " Defence: " + esc(g.defmin) + "." : "") + (g.fm ? " Foreign: " + esc(g.fm) + "." : "") + "</dd>";
      if (el.dateText || el.next) h += "<dt>Election</dt><dd>" + esc(el.dateText || "") + (el.next ? " · <b>" + daysBetween(TD, el.next) + " days</b> " + icsLink(c.name + " election", el.next) : "") + electionClock(c, TD) + "</dd>";
      if (nato.member || nato.spend) h += "<dt>" + (isCtx ? "Defence" : "NATO") + "</dt><dd>" + (nato.member ? "Member since " + esc(nato.member) + ". " : "") + esc(nato.spend || "") + "</dd>";
      if ((nato.posture || []).length) h += "<dt>" + (isCtx ? "Facing NATO" : "Posture") + "</dt><dd>" + nato.posture.map(esc).join(" · ") + "</dd>";
      (c.stance || []).forEach(function (st) { h += "<dt>" + esc(st.k) + "</dt><dd>" + esc(st.t) + "</dd>"; });
      h += "</dl>";
      if (BLR.length && !isCtx) h += blrGrid(c, BLR);
      if ((c.blr || []).length) h += '<div class="blr">' + c.blr.slice().sort(function (a, b) { return a.n - b.n; }).map(function (b) { return '<div class="blr-r"><span class="blr-n" title="' + esc(BLR[b.n - 1] || "") + '">' + esc(b.n) + "</span><span>" + (BLR[b.n - 1] ? "<b>" + esc(BLR[b.n - 1]) + ".</b> " : "") + esc(b.t) + (b.date ? ' <span class="small">(' + esc(fmtShort(b.date)) + ")</span>" : "") + "</span></div>"; }).join("") + "</div>";
      if (log.length) h += '<ul class="clean small ctry-log">' + log.map(function (e) { return "<li><b>" + esc(fmtShort(e.date)) + (e.date.slice(0, 4) !== TD.slice(0, 4) ? " " + e.date.slice(0, 4) : "") + "</b> · " + esc(e.t) + ((e.src || []).length ? ' <a href="' + esc(e.src[0][1]) + '" target="_blank" rel="noopener" class="srcl">source</a>' : "") + "</li>"; }).join("") + "</ul>";
      h += mine.length ? '<div class="fug">' + nq() + mine.map(function (i) { return item(i); }).join("") + "</div>" : quiet("Nothing new from " + c.name + " today.", "nq");
      h += "</div>";
    });
    its.filter(function (i) { return !list.some(function (c) { return c.id === i.cc; }); }).forEach(function (i) { h += item(i); });
    return h + "</section>";
  }
  function inToday(kind, id) { return ctx._linked && ctx._linked[kind + ":" + id] ? '<a class="chip st intoday" href="#p-news" title="An item in today\'s edition updates this">in today\'s edition</a>' : ""; }
  /* .ics file as a data link: all-day when no time */
  function icsLink(title, date, end, desc, utc) {
    if (!date && !utc) return "";
    function dt(k) { return String(k || date).replace(/-/g, ""); }
    var uid = (title + date).replace(/[^a-z0-9]/gi, "").slice(0, 40) + "@readbook", lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Readbook//EN", "BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"];
    if (utc) { var st = new Date(utc), en = new Date(st.getTime() + 3 * 36e5); lines.push("DTSTART:" + st.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z", "DTEND:" + en.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"); }
    else lines.push("DTSTART;VALUE=DATE:" + dt(date), "DTEND;VALUE=DATE:" + dt(addDays(end || date, 1)));
    lines.push("SUMMARY:" + String(title).replace(/[\n,;]/g, " "), "DESCRIPTION:" + String(desc || "Nick's Daily Readbook").replace(/[\n,;]/g, " "), "END:VEVENT", "END:VCALENDAR");
    return '<a class="cal-add" download="' + esc(String(title).replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) + ".ics") + '" href="data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join("\r\n")) + '" title="Add to calendar">+ cal</a>';
  }
  function sinceYesterday(E, ctx, TD) {
    var y = addDays(TD, -1), rows = [];
    function row(label, items, href) { if (items.length) rows.push('<li><a href="' + href + '"><b>' + esc(label) + "</b></a> " + items.map(esc).join(" · ") + "</li>"); }
    row("Board", (ctx.conflicts || []).filter(function (t) { return (t.log || []).some(function (e) { return e.date === TD || e.date === y; }); }).map(function (t) { return t.short || t.name; }), "#board");
    row("Threads", (ctx.threads || []).filter(function (t) { return (t.log || []).some(function (e) { return e.date === TD || e.date === y; }); }).map(function (t) { return t.name; }), "#threads");
    row("Forecasts", (((ctx.forecasts || {}).items) || []).filter(function (f) { return f.resolvedDate === TD || f.made === TD; }).map(function (f) { return (f.made === TD ? "new: " : "resolved: ") + f.q; }), "#forecasts");
    row("New in war", (((ctx.novel || {}).items) || []).filter(function (x) { return x.date === TD || x.date === y; }).map(function (x) { return x.t; }), "#novel");
    row("Countries", (ctx.countries || []).filter(function (c) { return (c.log || []).some(function (e) { return e.date === TD || e.date === y; }); }).map(function (c) { return c.name; }), "#countries");
    row("Horizon", (ctx.horizon || []).filter(function (e) { return e.added === TD || e.updated === TD; }).map(function (e) { return e.t; }), "#horizon");
    row("Congress", (ctx.congress || []).filter(function (c) { return c.added === TD || c.updated === TD; }).map(function (c) { return c.title || c.post; }), "#congress-sec");
    row("Posts", (ctx.congressWatch || []).filter(function (w) { return w.updated === TD; }).map(function (w) { return w.post; }), "#congress-sec");
    row("Exercises", (ctx.exercises || []).filter(function (x) { return x.added === TD || x.updated === TD; }).map(function (x) { return x.name; }), "#exercises-sec");
    row("Releases", (((ctx.releases || {}).releases) || []).filter(function (r) { return r.date === TD; }).map(function (r) { return r.t; }), "#releases");
    row("Events", (ctx.events || []).filter(function (e) { return e.added === TD; }).map(function (e) { return e.t; }), "#offduty");
    (Array.isArray(E.research) ? E.research : (E.research ? [E.research] : [])).forEach(function (r) { rows.push('<li><a href="#research"><b>Research</b></a> ' + esc(r.org + ": " + r.title) + "</li>"); });
    var inc = (ctx.incidents || []).filter(function (i) { return i.date === TD || i.date === y; }).length; if (inc) rows.push('<li><a href="#hybrid"><b>Incidents</b></a> ' + inc + " logged in the last two days</li>");
    var mv = (ctx.attrLog || []).filter(function (m) { return m.date === TD; }).length; if (mv) rows.push('<li><a href="#hybrid"><b>Attribution</b></a> ' + mv + " move" + (mv > 1 ? "s" : "") + "</li>");
    return '<h3 id="since">What changed <span class="small">in the memory since yesterday</span></h3>' + (rows.length ? '<ul class="since">' + rows.join("") + "</ul>" : quiet("Nothing in the standing files moved since yesterday."));
  }
  function contentsBlock() {
    var tiers = PARTS.slice(1).map(function (p) { return [p[0], p[1], TIERS[p[0]]]; });
    var SN = { world: "World", hybrid: "Hybrid", europe: "Europe", countries: "Priority countries", euregio: "Euregio", army: "Defence & Army", nato: "NATO & allies", deftech: "Defence tech", frontier: "Frontier", markets: "Markets", rates: "Rates", nl: "Netherlands", board: "The board", forecasts: "Forecasts", novel: "New in war", numbers: "Numbers and indicators", fx: "USD/EUR", fuel: "Pump price", threads: "Threads", horizon: "Horizon", "congress-sec": "Congress", releases: "Releases", sota: "State of the art", feature: "World feature", research: "Research", philosophy: "Philosophy", depth: "Army in depth", ttpsec: "Week in war", aperture: "Aperture", local: "Parkstad", afnorth: "AFNORTH", offduty: "Out and about", dutch: "Taal", snow: "Snow", hockey: "Canes", week: "This week", coming: "Coming up", weather: "Weather", countdown: "Countdowns", tv: "TV", calendar: "Calendar", year: "Year ahead", school: "School year", season: "Season" };
    return '<h3>In this edition</h3><ol class="toc">' + tiers.map(function (t, i) { return '<li data-tier="' + t[0] + '" class="' + t[0] + '"><a href="#p-' + t[0] + '"><b>' + (i + 1) + " · " + esc(t[1]) + '</b></a><span class="tm"></span><span class="secs">' + t[2].map(function (id) { return '<a href="#' + id + '">' + esc(SN[id] || id) + "</a>"; }).join(" · ") + "</span></li>"; }).join("") + "</ol>";
  }
  function yearAhead(ctx, E, TD, today) {
    var from = TD, to = addDays(TD, 365), rows = [], cal = ctx.calendar || {};
    function seg(list) { return list.filter(function (g) { return g[1] >= from && g[0] <= to; }); }
    Object.keys(cal.school || {}).forEach(function (k) { var sy = cal.school[k]; rows.push({ name: sy.name, color: sy.color, segs: seg(sy.segs || []) }); });
    var ex = seg((ctx.exercises || []).map(function (x) { return [x.from, x.to, x.name]; })); if (ex.length) rows.push({ name: "Exercises", color: "ex", segs: ex });
    var car = seg((((E.army || {}).career || {}).dates || []).map(function (d) { return [d[0], d[0], plain(d[1])]; })), cg = seg((ctx.congress || []).filter(function (c) { return c.deadline; }).map(function (c) { return [c.deadline, c.deadline, (c.title || c.post) + " deadline"]; }));
    if (car.length || cg.length) rows.push({ name: "Career and Congress", sub: "dates", color: "pro", segs: car.concat(cg) });
    var hz = seg((ctx.horizon || []).map(function (e) { return [e.date, e.date, e.t]; })); if (hz.length) rows.push({ name: "Horizon", sub: "dated events", color: "watch", segs: hz });
    var mk = seg((cal.markets || []).map(function (m) { return [m[2], m[3], m[0]]; })), y0 = today.getMonth() >= 11 ? today.getFullYear() : today.getFullYear() - 1, sk = ctx.ski && ctx.ski.season ? seg([[y0 + "-" + ctx.ski.season[0], (y0 + 1) + "-" + ctx.ski.season[1], "Ski season"], [(y0 + 1) + "-" + ctx.ski.season[0], (y0 + 2) + "-" + ctx.ski.season[1], "Ski season"]]) : [];
    if (mk.length || sk.length) rows.push({ name: "Seasons", sub: "markets, snow", color: "mkt", segs: mk.concat(sk) });
    var me = seg(((ctx.week && ctx.week.items) || []).map(function (w) { return [w.date, w.end || w.date, w.t]; })); if (me.length) rows.push({ name: "Yours", sub: "week.json", color: "me", segs: me });
    var OVR = cal.school ? overlapRows(cal, TD) : null; if (OVR && OVR.all.length) rows.push({ name: "All systems off", sub: "family and neighbours", color: "us", all: true, segs: OVR.all });
    var ticks = []; for (var m = 0; m < 13; m++) { var t = new Date(today.getFullYear(), today.getMonth() + m + 1, 1); if (key(t) <= to) ticks.push(key(t)); }
    /* leave windows: every school system off and no exercise under way */
    var sets = Object.keys(cal.school || {}).map(function (k) { return cal.school[k].segs || []; }), win = [], cur = null, d = pd(from), end = pd(to);
    for (; d <= end; d.setDate(d.getDate() + 1)) { var k = key(d), off = sets.length && sets.every(function (sg) { return sg.some(function (g) { return g[0] <= k && k <= g[1]; }); }) && !ex.some(function (g) { return g[0] <= k && k <= g[1]; }); if (off && !cur) cur = [k, k]; else if (off) cur[1] = k; else if (cur) { win.push(cur); cur = null; } }
    if (cur) win.push(cur);
    var h = gantt({ from: from, to: to, ticks: ticks, rows: rows }, today, { year: true, noXmas: true });
    h += '<p class="small" style="margin-top:8px"><b>Leave windows</b> (every school system off, no exercise under way): ' + (win.length ? win.map(function (w) { return fmtShort(w[0]) + " – " + fmtShort(w[1]) + " " + w[1].slice(0, 4); }).join("; ") : "none in the next twelve months with the calendars loaded so far") + ".</p>";
    if (cal.school) h += '<p class="small">School calendars: ' + Object.keys(cal.school).map(function (k) { return '<span title="' + esc(cal.school[k].source || "") + '">' + esc(cal.school[k].name) + "</span>"; }).join(" · ") + " (tap a name for the source).</p>";
    var PS = (E.planner || {}).season; if (PS && (PS.notes || PS.intro)) h += '<h3>' + esc(PS.title || "Season notes") + "</h3>" + (PS.intro ? '<p class="small">' + rich(PS.intro) + "</p>" : "") + (PS.notes ? '<ul class="clean">' + PS.notes.map(function (n) { return "<li>" + rich(n) + "</li>"; }).join("") + "</ul>" : "");
    return h;
  }
  function weekReview(E, ctx, TD, today) {
    var WR = E.weekreview, sun = today.getDay() === 0;
    if (!WR && !sun) return "";
    var from = addDays(TD, -7);
    function cnt(list, f) { return (list || []).filter(f).length; }
    var tiles = [["Board entries", cnt([].concat.apply([], (ctx.conflicts || []).map(function (t) { return t.log || []; })), function (e) { return e.date > from && e.date <= TD; })], ["Thread entries", cnt([].concat.apply([], (ctx.threads || []).map(function (t) { return t.log || []; })), function (e) { return e.date > from && e.date <= TD; })], ["Congress moves", cnt(ctx.congress, function (c) { return (c.updated || c.added) > from; })], ["Releases", cnt((ctx.releases || {}).releases, function (r) { return r.date > from && r.date <= TD; })], ["Incidents", cnt(ctx.incidents, function (i) { return i.date > from && i.date <= TD; })], ["Idioms learned", cnt(ctx.idioms, function (i) { return i.date > from && i.date <= TD; })], ["Forecasts resolved", cnt((ctx.forecasts || {}).items, function (f) { return f.resolvedDate > from && f.resolvedDate <= TD; })]];
    var h = '<section id="weekreview" class="home"><h2>The week <span class="num">' + esc(fmtShort(addDays(TD, -6)) + " – " + fmtShort(TD)) + "</span></h2>";
    h += '<div class="strip cds">' + tiles.map(function (t) { return '<div class="tile cd"><div class="lbl">' + esc(t[0]) + '</div><div class="val">' + t[1] + "</div><p>last 7 days</p></div>"; }).join("") + "</div>";
    if (WR) { h += '<h3>' + esc(WR.title || "The week ahead") + "</h3>" + (WR.body || []).map(function (p) { return "<p>" + rich(p) + "</p>"; }).join(""); var wrows = (WR.rows || []).filter(function (r) { return !r[0] || r[0] >= TD; }); if (wrows.length) h += table(["Date", "Scheduled"], wrows.map(function (r) { return '<tr><td class="d">' + (r[0] ? esc(fmtShort(r[0])) : "—") + "</td><td>" + rich(r[1]) + " " + icsLink(plain(r[1]), r[0]) + "</td></tr>"; }).join(""), "lbl1"); }
    return h + "</section>";
  }
  function correctionsBlock(ctx, E, TD) {
    var C = ((ctx.corrections || {}).items || []).filter(function (c) { return daysBetween(c.date, TD) <= 30 && c.date <= TD; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return '<h3 id="corrections">Corrections <span class="small">last 30 days</span></h3>' + (C.length ? '<ul class="clean small">' + C.map(function (c) { return "<li><b>" + esc(fmtShort(c.date)) + "</b> · " + (c.edition ? "Edition " + esc(c.edition) + ", " : "") + esc(c.section || "") + ": " + rich(c.t, srcMap(c.src)) + "</li>"; }).join("") + "</ul>" : quiet("No corrections in the last 30 days."));
  }
  function aboutBlock(E, TD) {
    var src = E.sources || [], tiers = [0, 0, 0, 0, 0]; src.forEach(function (x) { var t = +x[4]; tiers[t >= 1 && t <= 4 ? t : 0]++; });
    var tiered = tiers[1] + tiers[2] + tiers[3] + tiers[4], share = tiered ? Math.round(100 * (tiers[1] + tiers[2]) / tiered) : null;
    return '<h3 id="about">About this edition</h3><p class="small">Format ' + esc(E.v || "?") + (tiered ? " · " + tiers[1] + " official or primary, " + tiers[2] + " wire or document, " + tiers[3] + " outlet, " + tiers[4] + " other (" + share + "% tier one or two)" : " · source tiers not yet assigned") + ' · <span id="aboutwords"></span>. Open sources only; the morning run writes the data files and the page draws them. Checks run by <code>tools/validate.js</code> before every commit.</p>';
  }

  /* ---------- main render ---------- */
  function render(E, ctx) {
    ctx._names = linkNames(ctx); ctx._linked = collectLinks(E); ctx._TD = E.date;
    var today = pd(E.date), TD = E.date, h = "", TIER_HTML = {}, weekend = today.getDay() === 0 || today.getDay() === 6;
    setPartOrder(weekend);
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
    var idxE = ((ctx.index || {}).editions || []).filter(function (x) { return x.date === E.date; })[0] || {}, gen = E.generated || idxE.generated;
    h += '<div class="topline"><span>Last run <b id="dataup">' + (gen ? esc(stamp(Date.parse(gen))) : esc(fmt(today)) + ", time not recorded") + '</b></span><span id="status"></span></div>';
    var realTD = key(new Date()), lagDays = ctx.index && ctx.index.latest === E.date ? daysBetween(E.date, realTD) : 0;
    if (lagDays > 0) h += '<p class="stale">This is the edition of <b>' + esc(fmt(today)) + "</b>. Today is " + esc(fmt(pd(realTD))) + " and the morning run has not posted yet, so the planner counts from " + esc(fmtShort(E.date)) + ".</p>";
    h += '<header class="mast"><div class="eyebrow">' + esc(E.place || "Hoensbroek · Parkstad Limburg") + "</div><h1>Nick's Daily Readbook</h1>";
    h += '<div class="date">' + esc((E.weekday || ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][today.getDay()]) + " " + today.getDate() + " " + MON[today.getMonth()] + " " + today.getFullYear()) + "</div>";
    h += '<div class="mast-meta"><span><b>Edition ' + esc(E.edition) + "</b></span><span>Look-back " + esc(E.lookback) + '</span><span id="readtime"></span></div>';
    h += '<div class="rule" aria-hidden="true">' + ["--ink","--p-news","--p-money","--p-watch","--p-reading","--p-home"].map(function (c) { return '<i style="background:var(' + c + ')"></i>'; }).join("") + "</div>";
    h += '<div class="status"><span id="resumebox"></span><span class="dens" role="group" aria-label="Density"><button type="button" data-d="normal">Normal</button><button type="button" data-d="compact">Compact</button></span><span class="theme" role="group" aria-label="Theme"><button type="button" data-theme="auto">Auto</button><button type="button" data-theme="light">Light</button><button type="button" data-theme="dark">Dark</button></span></div>';
    if (E.note) h += '<p class="note">' + rich(E.note) + "</p>";
    h += "</header>";

    /* slim header */
    h += '<div class="slim" id="slim"><div class="slim-row"><span class="cur" id="cur">Front</span>' +
      PARTS.map(function (p) { return '<a class="' + p[0] + '" data-p="' + p[0] + '" href="' + p[2] + '">' + esc(p[0] === "home" ? "Home" : p[0] === "front" ? "Today" : p[0] === "money" ? "Markets" : p[1].replace("The ", "")) + "</a>"; }).join("") + '<a href="#sources">Sources</a>' +
      '<button type="button" class="tg" id="newonly" aria-pressed="false" title="Show only items with a NEW or UPDATED badge">New only</button>' +
      '</div><div class="prog"><i id="prog"></i></div></div>';

    /* today strip */
    h += '<div class="strip" id="front" data-part="Front">';
    if (T.weather) { var w = T.weather, w0 = (w.week || []).filter(function (r) { return r[0] === TD; })[0] || (w.week || [])[0], w1 = (w.week || []).filter(function (r) { return r[0] === addDays(TD, 1); })[0]; h += '<div class="tile wxt"><div class="lbl">Weather · ' + esc(E.town || "Hoensbroek") + '</div><div class="wxtop">' + wxIcon(wxKind(w0, w.now), 36) + '<div class="val">' + esc(w.hi) + "° / " + esc(w.lo) + "°</div></div>" + (w0 ? '<div class="wxmeta">' + rainGlyph(w0[3]) + " " + windGlyph(w0[4]) + "</div>" : "") + "<p>" + esc(w.now) + ". " + (w1 ? '<span class="wxtm">' + wxIcon(wxKind(w1, w.tomorrow), 16) + "</span>" : "") + esc(w.tomorrow) + "." + cite(w.src) + "</p></div>";
      var dl = dayHours(HOME.lat, TD), dl7 = (dl - dayHours(HOME.lat, addDays(TD, -7))) * 60, sr = /^(\d{1,2}):(\d{2})$/.exec(w.sunrise || ""), ss = /^(\d{1,2}):(\d{2})$/.exec(w.sunset || ""), mp = moonPhase(TD);
      if (sr && ss) dl = (ss[1] * 60 + +ss[2] - sr[1] * 60 - +sr[2]) / 60;
      h += '<div class="tile sun"><div class="lbl">Sun and moon</div><div class="val">' + wxIcon("sun", 22) + " " + esc(w.sunrise || "–") + "–" + esc(w.sunset || "–") + '</div><p>' + hm(dl) + " of daylight, " + Math.abs(Math.round(dl7)) + " min " + (dl7 < 0 ? "less" : "more") + ' than a week ago</p><p class="moonl">' + mp.svg + " " + esc(mp.name.charAt(0).toUpperCase() + mp.name.slice(1)) + ", day " + Math.round(mp.age) + "</p></div>"; }
    var nxg = CV ? nextGameLine(CV.upcoming, TD) : "";
    if (T.canes) h += '<div class="tile hockey"><div class="lbl">Hurricanes</div><div class="val">' + esc(T.canes.line) + "</div><p>" + esc(nxg ? String(T.canes.sub || "").replace(/;?\s*next:.*$/i, "") : T.canes.sub) + cite(T.canes.src) + "</p>" + nxg + "</div>";
    else if (CV) { var lg = CV.games[CV.games.length - 1]; h += '<div class="tile hockey"><div class="lbl">Hurricanes</div><div class="val">' + esc(lg.res + " " + lg.gf + "–" + lg.ga + (lg.home ? " vs " : " at ") + lg.opp) + "</div><p>" + esc(CV.record + " · " + CV.points + " pts") + "</p>" + nxg + "</div>"; }
    var mkRows = (T.markets || []).slice(), br = (SER.brent || []).filter(function (p) { return p[0] <= TD; });
    if (br.length >= 2 && !mkRows.some(function (m) { return /brent/i.test(m[0]); })) { var b1 = br[br.length - 1], b0 = br[br.length - 2], bp = (b1[1] - b0[1]) / b0[1] * 100; mkRows.push(["Brent", "$" + b1[1].toFixed(2), Math.abs(bp) < 0.1 ? "flat" : bp > 0 ? "up" : "down", signed(bp, 2, "%") + " on " + fmtShort(b1[0])]); }
    if (mkRows.length) h += '<div class="tile"><div class="lbl">Markets</div><div class="mini-mk">' + mkRows.map(function (m) { var g = fxGuard(m[0], m[1], null, m[2]); return "<span>" + esc(g.label) + '</span><span class="chg ' + esc(g.dir) + '"' + (m[3] ? ' title="' + esc(m[3]) + '"' : "") + ">" + esc(g.value) + "</span>"; }).join("") + "</div></div>";
    if (FX) h += '<div class="tile money"><div class="lbl">USD/EUR · ECB</div><div class="val">' + FX.last[1].toFixed(4) + '</div><p><span class="chg ' + dir(FX.d1) + '">' + signed(FX.d1, 4) + " (" + signed(FX.d1 / FX.prev[1] * 100, 2, "%") + ")</span> vs " + esc(fmtShort(FX.prev[0])) + "</p></div>";
    h += '<div class="tile" id="bins"><div class="lbl">Bin day</div><div class="val">…</div><p></p></div>';
    var NU = PEV.filter(function (e) { return (e.end || e.date) >= TD && (e.src === "week" || e.src === "inbox" || e.src === "deadlines" || e.src === "career") && daysBetween(TD, e.date) <= 30; }).slice(0, 3);
    if (NU.length) { var n0 = daysBetween(TD, NU[0].date); h += '<div class="tile nextup"><div class="lbl">Next up · yours</div><div class="val">' + (n0 <= 0 ? "Today" : n0 === 1 ? "Tomorrow" : "In " + n0 + " days") + '</div><ul class="nul">' + NU.map(function (e) { return "<li><b>" + esc(fmt(pd(e.date))) + "</b> " + esc(e.t.replace(/^AFNORTH: /, "")) + "</li>"; }).join("") + "</ul></div>"; }
    h += '<button type="button" class="tile newcount" id="newcount" title="Show only new and updated items"><div class="lbl">This edition</div><div class="val"><span id="nnew">…</span><small id="nupd"></small></div><p>Tap to show only what changed</p></button>';
    h += "</div>";

    /* the Brief: takeaways, pick, today and tomorrow, what changed, what to watch, unknowns, indicators that moved, contents */
    var BR = E.brief || {}, TK = (BR.takeaways && BR.takeaways.length ? BR.takeaways : E.five) || [];
    h += '<section class="front brief"><h2>' + (BR.takeaways && BR.takeaways.length ? "Takeaways" : "Five things") + ' <span class="num">' + (weekend ? "weekend edition · long reads first" : "the brief · seven minutes") + '</span></h2><ol class="five">';
    TK.forEach(function (f) { h += '<li class="' + esc(f.part || "") + '">' + rich(f.t) + (f.to ? ' <a class="go" href="#' + esc(f.to) + '">Read →</a>' : "") + linkChips(f.links) + "</li>"; });
    h += "</ol>";
    if (E.pick) h += '<div class="pick">' + rich(E.pick.t) + (E.pick.to ? ' <a href="#' + esc(E.pick.to) + '">Go →</a>' : "") + "</div>";
    if (T.items && T.items.length) {
      h += '<h3>Today and tomorrow</h3><div class="tt">';
      T.items.forEach(function (t) { h += '<div><span class="k" style="--kc:' + catColor(t.cat) + '">' + esc(t.k) + "</span><p>" + rich(t.t) + "</p></div>"; });
      h += "</div>";
    }
    h += sinceYesterday(E, ctx, TD);
    h += watchNext(PEV, ctx, TD);
    h += unknownsBlock(BR, ctx, TD);
    h += indicatorsMoved(ctx, TD);
    h += contentsBlock();
    h += "</section>";


    /* ===== Part 1 · The news ===== */
    TIER_HTML.front = h; h = "";
    h += part("news", pn("news"), "The news", "What happened: the world, security, defence, frontier technology and the Netherlands.", "p-news");
    h += '<section id="world" class="news"><h2>Developments <span class="num">beyond Europe</span></h2>';
    if (WO.items && WO.items.length) {
      var rc = {}; WO.items.forEach(function (x) { rc[x.region] = (rc[x.region] || 0) + 1; });
      h += '<div class="regions">' + Object.keys(rc).map(function (r) { return "<span>" + esc(r) + "<b>" + rc[r] + "</b></span>"; }).join("") + '</div><div class="world fug">' + nq();
      WO.items.forEach(function (x) {
        h += '<article class="wcard ' + fu(x.badge) + '"><div class="wtop"><span class="tag rg">' + esc(x.region) + "</span>" + (x.conf ? '<span class="conf">confidence: ' + esc(x.conf) + "</span>" : "") + badge(x.badge) + "</div><h4>" + rich(x.h) + "</h4><p>" + rich(x.body) + "</p>" + linkChips(x.links) + (x.next ? '<p class="sw-line"><b class="l">Next</b>' + rich(x.next) + "</p>" : "") + (x.sw ? '<p class="sw-line"><b class="l">So what</b>' + rich(x.sw) + "</p>" : "") + "</article>";
      });
      h += "</div>";
    } else h += quiet();
    h += "</section>";
    var HY = E.hybrid || {};
    h += '<section id="hybrid" class="news"><h2>Hybrid watch</h2><h3>Incident log</h3>';
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
    if (HY.week) h += "<h3>Week in hybrid</h3>" + "<p>" + rich(HY.week.t || HY.week.html || "") + "</p>";
    if (HY.indicators && HY.indicators.length) {
      h += '<h3>Hybrid indicators</h3><div class="ind">';
      HY.indicators.forEach(function (x) { h += '<div class="ind-row"><div class="st ' + esc(x[0]) + '">' + (ICON[x[0]] || "") + (STLBL[x[0]] || esc(x[0])) + '</div><div style="min-width:0"><h4>' + esc(x[1]) + "</h4><p>" + rich(x[2]) + "</p></div></div>"; });
      h += "</div>";
    }
    if (HY.note) h += '<p class="small" style="margin-top:8px">' + rich(HY.note) + "</p>";
    h += "</section>";
    h += '<section id="europe" class="news"><h2>Europe</h2>' + items(E.europe) + "</section>";
    h += countriesBlock(E, ctx, TD);
    if (E.euregio && E.euregio.length) h += '<section id="euregio" class="news"><h2>Local &amp; Euregio</h2>' + items(E.euregio) + "</section>";

    var AR = E.army || {}, AP = E.aperture || {}, NA = E.nato || {}, DT = E.deftech || {};
    h += '<section id="army" class="news"><h2>Defence &amp; Army</h2>';
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
    h += "</section>";
    h += '<section id="nato" class="news"><h2>NATO &amp; European militaries</h2>' + items(NA.items, null, "Nothing new from the Alliance or the allied armies in the window.");
    if (NA.table && (NA.table.badge === "NEW" || (NA.table.asof && daysBetween(NA.table.asof, TD) <= 7))) h += '<h3>' + esc(NA.table.title || "Allied spending and strength") + (NA.table.asof ? ' <span class="small">' + esc(NA.table.asof) + "</span>" : "") + "</h3>" + table(NA.table.head, NA.table.rows.map(function (r) { return "<tr>" + r.map(function (c, j) { return "<td" + (j > 0 && /^[\d.,%$€+−\- ]+$/.test(String(c)) ? ' class="d"' : "") + ">" + rich(c) + "</td>"; }).join("") + "</tr>"; }).join(""), "lbl1") + (NA.table.src ? '<p class="small" style="margin-top:6px">Source' + cite(NA.table.src) + "</p>" : "");
    h += "</section>";
    h += '<section id="deftech" class="news"><h2>Defence tech</h2>' + items(DT.items, null, "No new defence technology in the window.");
    h += "</section>";
    var FR = E.frontier || {}, REL = ctx.releases || {};
    h += '<section id="frontier" class="news"><h2>Newest</h2>' + items(FR.items, null, "No new release or published result in the window.") + "</section>";
    var NL = E.nl || {}, AF = E.afnorth || {}, OD = E.offduty || {};
    h += '<section id="nl" class="news"><h2>Netherlands</h2>' + items(NL.items);
    if (NL.temp) h += '<p class="small" style="margin-top:12px"><b>Political temperature:</b> ' + rich(NL.temp) + "</p>";
    h += "</section>";

    /* ===== Markets & economy: its own part ===== */
    TIER_HTML.news = h; h = "";
    h += part("money", pn("money"), "Markets & economy", "The markets, the dollar in euros, the pump price in dollars, rates and the week ahead.", "p-money");
    var M = E.money || {};
    h += '<section id="markets" class="money"><h2>Markets &amp; economy <span class="num">' + esc(M.asof || "") + "</span></h2>";
    var sparks = []; ctx._sparks = sparks;
    if (M.cards) h += '<div class="cards">' + M.cards.filter(function (c) { return !(FX && /(USD|EUR)\s*\/\s*(EUR|USD)/i.test(c[0])); }).map(function (c) {
      var src = null, sk = null;
      [c[5], c[6]].forEach(function (v) { if (typeof v === "number") src = v; else if (typeof v === "string" && v) sk = v; });
      if (!sk) { var lab = String(c[0]).toLowerCase(); SERIES_BY_LABEL.forEach(function (m) { if (!sk && lab.indexOf(m[0]) === 0) sk = m[1]; }); }
      var g = fxGuard(c[0], c[1], c[2], c[3]), arrow = g.dir === "up" ? "▲ " : g.dir === "down" ? "▼ " : "";
      var ser = sk && SER[sk] && SER[sk].length ? SER[sk].filter(function (p) { return p[0] <= TD; }).slice(-30) : null;
      return '<div class="card"><div class="lbl">' + esc(g.label) + '</div><div class="val">' + esc(g.value) + '</div><p><span class="chg ' + esc(g.dir) + '">' + (g.change ? arrow + esc(g.change) : "") + "</span> " + esc(g.fixed ? "euros per dollar" : c[4]) + cite(src) + "</p>" + (ser ? '<div class="spark" data-s="' + (sparks.push(ser) - 1) + '" title="' + esc(fmtShort(ser[0][0]) + " – " + fmtShort(ser[ser.length - 1][0])) + '"></div>' : "") + "</div>";
    }).join("") + "</div>";
    if (M.driver) h += "<p>" + rich(M.driver) + "</p>";
    h += energyBlock(ctx, sparks, TD);
    if (M.ytd) h += "<h3>Year to date</h3>" + hbars(M.ytd, { fmt: function (v) { return (v >= 0 ? "+" : "") + v.toFixed(1) + "%"; }, foot: "Change since 1 January at the last close." + cite(M.ytdSrc) });
    if (FX) {
      var range = store("rb:fx:range") === "1y" ? 365 : 90;
      h += '<h3 id="fx">USD/EUR <span class="small">euros per dollar · ECB</span></h3><div class="fx">';
      h += '<div class="fx-top"><span class="big tab">' + FX.last[1].toFixed(4) + '</span><span class="asof">' + esc(fmtLong(FX.last[0])) + " · € per $</span></div>";
      h += '<div class="fx-ch"><div><div class="lbl">Since ' + esc(fmtShort(FX.prev[0])) + '</div><div class="v chg ' + dir(FX.d1) + '">' + signed(FX.d1, 4) + '</div><div class="p chg ' + dir(FX.d1) + '">' + signed(FX.d1 / FX.prev[1] * 100, 2, "%") + "</div></div>";
      if (FX.month) h += '<div><div class="lbl">Since ' + esc(fmtShort(FX.month[0])) + '</div><div class="v chg ' + dir(FX.d30) + '">' + signed(FX.d30, 4) + '</div><div class="p chg ' + dir(FX.d30) + '">' + signed(FX.d30 / FX.month[1] * 100, 2, "%") + "</div></div>";
      h += '<div><div class="lbl">30-day range</div><div class="v">' + FX.lo30[1].toFixed(4) + '</div><div class="p">to ' + FX.hi30[1].toFixed(4) + "</div></div></div>";
      h += '<div class="fx-tools"><button type="button" data-range="90" aria-pressed="' + (range === 90) + '">90 days</button><button type="button" data-range="365" aria-pressed="' + (range === 365) + '">1 year</button></div>';
      h += '<div class="chart" id="fxchart" style="min-height:150px" data-range="' + range + '"></div>';
      var eu = function (r) { return "€" + num(1000 * r, 0); };
      h += '<p class="pay"><b class="l">Pay</b>$1,000 is ' + eu(FX.last[1]) + " today" + (FX.month ? ", " + eu(FX.month[1]) + " a month ago" : "") + "; 12-month best " + eu(FX.best[1]) + " (" + esc(fmtShort(FX.best[0])) + "), worst " + eu(FX.worst[1]) + " (" + esc(fmtShort(FX.worst[0])) + "). Up means the dollar buys more euros.</p>";
      h += '<div class="lbl" style="margin-top:12px">$1,000 in euros, monthly average</div><div class="chart" id="paybars" style="min-height:110px"></div>';
      h += '<p class="small" style="margin:8px 0 0"><a href="' + esc(ctx.fx.url || "https://www.ecb.europa.eu/stats/eurofxref/") + '" target="_blank" rel="noopener">' + esc(ctx.fx.source || "ECB") + "</a>, one value per ECB business day, inverted from the ECB's dollars-per-euro quote.</p></div>";
    }
    var FU = fuelStats(ctx.fuel, ctx.fx, TD);
    if (FU) {
      var frange = store("rb:fuel:range") === "90d" ? 90 : 365, L1 = FU.last, usd = function (v) { return "$" + v.toFixed(2); }, chgCell = function (lbl, ref) { if (!ref) return ""; var d = L1[2] - ref[2]; return '<div><div class="lbl">' + esc(lbl) + '</div><div class="v chg ' + (d > 0.005 ? "down" : d < -0.005 ? "up" : "flat") + '">' + signed(d, 2) + '</div><div class="p">' + signed(d / ref[2] * 100, 1, "%") + " · €" + ref[1].toFixed(3) + "/l</div></div>"; };
      var hasN = L1[4] != null, natoC = function (ref) { return hasN && ref && ref[4] != null ? '<div class="p nato">NATO ' + signed(L1[4] - ref[4], 2) + " · €" + ref[3].toFixed(3) + "/l</div>" : ""; };
      chgCell = function (lbl, ref) { if (!ref) return ""; var d = L1[2] - ref[2]; return '<div><div class="lbl">' + esc(lbl) + '</div><div class="v chg ' + (d > 0.005 ? "down" : d < -0.005 ? "up" : "flat") + '">' + signed(d, 2) + '</div><div class="p">' + signed(d / ref[2] * 100, 1, "%") + " · €" + ref[1].toFixed(3) + "/l</div>" + natoC(ref) + "</div>"; };
      h += '<h3 id="fuel">Pump price · Euro 95 (E10) <span class="small">Netherlands average in US dollars per gallon: what everyone pays, and the NATO tax-exempt rate</span></h3><div class="fx">';
      h += '<div class="fx-top dual"><div><span class="big tab">' + usd(L1[2]) + '</span><span class="asof">at the pump · €' + L1[1].toFixed(3) + " a litre</span></div>" + (hasN ? '<div><span class="big tab nato">' + usd(L1[4]) + '</span><span class="asof">NATO tax-exempt · €' + L1[3].toFixed(3) + " a litre</span></div>" : "") + '<span class="asof">per US gallon · ' + esc(fmtLong(L1[0])) + "</span></div>";
      h += '<div class="fx-ch">' + chgCell("Week", FU.week) + chgCell("Month", FU.month) + chgCell("Year", FU.year) + "</div>";
      h += '<div class="fuel-tools fx-tools"><button type="button" data-range="90" aria-pressed="' + (frange === 90) + '">90 days</button><button type="button" data-range="365" aria-pressed="' + (frange === 365) + '">1 year</button></div>';
      h += '<div class="chart" id="fuelchart" style="min-height:150px" data-range="' + frange + '"></div>';
      h += '<p class="pay"><b class="l">Tank</b>50 litres cost €' + (50 * L1[1]).toFixed(2) + ", " + usd(50 * L1[2] / GAL) + " at the pump" + (hasN ? " and €" + (50 * L1[3]).toFixed(2) + ", " + usd(50 * L1[4] / GAL) + " at the NATO rate" : "") + ", at that day\'s dollar rate" + (FU.year ? "; a year ago €" + (50 * FU.year[1]).toFixed(2) + ", " + usd(50 * FU.year[2] / GAL) + (hasN && FU.year[4] != null ? " (NATO €" + (50 * FU.year[3]).toFixed(2) + ", " + usd(50 * FU.year[4] / GAL) + ")" : "") : "") + ". 12-month high " + usd(FU.yhi[2]) + (hasN && FU.yhi[4] != null ? " pump, " + usd(FU.yhi[4]) + " NATO" : "") + " (" + esc(fmtShort(FU.yhi[0])) + "), low " + usd(FU.ylo[2]) + (hasN && FU.ylo[4] != null ? " pump, " + usd(FU.ylo[4]) + " NATO" : "") + " (" + esc(fmtShort(FU.ylo[0])) + "). Rises show in red.</p>";
      h += '<p class="small" style="margin:8px 0 0"><a href="' + esc(FU.url || "https://opendata.cbs.nl/statline/#/CBS/nl/dataset/80416ned/table") + '" target="_blank" rel="noopener">' + esc(FU.src || "CBS, Pompprijzen motorbrandstoffen") + "</a>: the weighted national average pump price including VAT and excise, published weekly. Each day converts at that day's ECB rate (the last one before it at weekends); 1 US gallon is 3.785 litres." + (hasN ? " The NATO rate is the pump price without 21% VAT and without excise (€" + (((ctx.fuel || {}).taxFree || {}).excise || {}).e95.toFixed(3) + " a litre), what a tax-exempt card pays at a Dutch station." : "") + "</p></div>";
    }
    h += tankBlock(ctx, TD);
    h += "</section>";
    h += '<section id="rates" class="money">';
    if (M.rates) h += "<h2>Rates and prices</h2>" + table(["Measure", "Latest", "Note"], M.rates.map(function (r) { var g = fxGuard(r[0], r[1], null, null); return "<tr><td>" + esc(g.label) + '</td><td class="d">' + esc(g.value) + "</td><td>" + rich(r[2]) + "</td></tr>"; }).join(""), "lbl1");
    if (M.fuel) {
      var F = M.fuel, minP = Math.min.apply(null, F.rows.map(function (r) { return r[1]; })), minD = Math.min.apply(null, F.rows.map(function (r) { return r[2]; }));
      h += '<h3>Fuel across the borders <span class="small">' + esc(F.asof) + "</span></h3>";
      var fxUsd = ctx.fx && ctx.fx.series.length ? ctx.fx.series[ctx.fx.series.length - 1][1] : null;
      h += table(["Country", "Euro 95 €/l"].concat(fxUsd ? ["Euro 95 $/gal"] : []).concat(["Diesel €/l"]), F.rows.map(function (r) { return "<tr><td>" + esc(r[0]) + '</td><td class="d"' + (r[1] === minP ? ' style="color:var(--up);font-weight:700"' : "") + ">" + r[1].toFixed(3) + "</td>" + (fxUsd ? '<td class="d">$' + (r[1] * fxUsd * GAL).toFixed(2) + "</td>" : "") + '<td class="d"' + (r[2] === minD ? ' style="color:var(--up);font-weight:700"' : "") + ">" + r[2].toFixed(3) + "</td></tr>"; }).join(""), "lbl1");
      h += '<p class="small" style="margin-top:6px">' + rich(F.note) + cite(F.src) + (F.weekly ? " Updated " + esc(F.weekly) + "." : "") + "</p>";
    }
    if (M.week) h += '<h3>Week ahead</h3><ul class="clean">' + M.week.map(function (x) { return "<li>" + rich(x) + "</li>"; }).join("") + "</ul>";
    if (M.fy) h += '<p class="sw-line" style="margin-top:12px"><b class="l">For you</b>' + rich(M.fy) + "</p>";
    h += "</section>";

    /* ===== Part 2 · The watch ===== */
    TIER_HTML.money = h; h = "";
    h += part("watch", pn("watch"), "The watch", "The memory: the board with Ukraine in detail, the numbers and indicators, one Horizon, the threads, New in war, Congress, the frontier record and the forecast ledger.", "p-watch");
    h += '<section id="board" class="watch"><h2>The board <span class="num">events logged, not a measure of intensity</span></h2>';
    if (board) {
      h += '<div class="panel"><div class="lbl">' + (ctx.conflicts || []).length + ' theatres · filled marker = events logged in 7 days, sized by count</div><div class="chart" id="worldmap" style="min-height:150px"></div></div>';
      h += ukraineBlock(ctx, E, TD);
      h += '<h3>Theatre logs <span class="small">last ten entries each, newest first</span></h3><div class="fug board">' + nq() + board.map(function (b) {
        var hd = '<details class="thread brow ' + fu(b.badge) + '" id="th-' + esc(b.t.id) + '" open><summary><span class="tname">' + esc(b.t.name) + act4(b.weeks) + badge(b.badge) + inToday("theatre", b.t.id) + "</span>";
        hd += b.last ? '<span class="tlast"><span class="d">' + esc(fmtShort(b.last.date)) + "</span>" + rich(b.last.t, srcMap(b.last.src)) + "</span>" : '<span class="tlast small">No events logged yet.</span>';
        hd += "</summary>";
        hd += '<div class="tlog">' + (b.log.length > 1 ? logList(b.log.slice(0, -1).slice(-9), "sub") : "") + '<div class="meta">' + b.log.length + (b.log.length === 1 ? " entry" : " entries") + (b.log.length > 10 ? ", last 10 shown" : "") + (b.last ? " · last " + esc(fmtLong(b.last.date)) + (b.age > 1 ? " (" + b.age + " days ago)" : "") : "") + "</div></div></details>";
        return hd;
      }).join("") + "</div>";
    } else h += quiet("The board file is not loaded.");
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
    var DTS = (DT.series || []).filter(function (k) { return ((WS.series || {})[k] || []).length > 1; });
    h += '<section id="numbers" class="watch"><h2>Numbers and indicators <span class="num">what the run counts and what would change our mind</span></h2>';
    h += indicatorsBlock(ctx, TD);
    h += '<h3>By the numbers <span class="small">latest value and 30-day sparkline</span></h3>' + (tiles.length ? '<div class="strip nums">' + tiles.join("") + "</div>" : quiet("No series published yet."));
    if (DTS.length) h += '<h3 id="production">Production and capacity <span class="small">series the run keeps up</span></h3><div class="viz">' + DTS.map(function (k) { var m = (WS.meta || {})[k] || {}; ctx._dts = ctx._dts || {}; ctx._dts[k] = (WS.series[k] || []).filter(function (p) { return p[0] <= TD; }); return '<div class="panel"><div class="lbl">' + esc(m.label || k) + (m.unit ? " · " + esc(m.unit) : "") + "</div>" + chartBox("dts-" + k, 170) + (m.source ? '<p class="small">' + esc(m.source) + "</p>" : "") + "</div>"; }).join("") + "</div>";
    h += "</section>";
    h += '<section id="threads" class="watch"><h2>Tracked threads</h2>';
    if (threads) h += renderThreads(threads);
    else if ((E.planner || {}).threads && E.planner.threads.length) h += '<div class="fug">' + nq() + table(["Thread", "What moved"], E.planner.threads.map(function (t) { return '<tr class="' + fu(t[2]) + '"><td>' + esc(t[0]) + badge(t[2]) + "</td><td>" + rich(t[1]) + "</td></tr>"; }).join(""), "lbl1") + "</div>";
    else h += quiet("No threads are open.");
    h += "</section>";
    h += '<section id="horizon" class="watch"><h2>Horizon <span class="num">everything dated in the watch, one list</span></h2><span id="exercises-sec"></span><span id="exercises"></span>' + horizonAll(ctx, P, TD) + "</section>";
    h += novelBlock(ctx, E, TD);
    h += '<section id="congress-sec" class="watch"><h2>Congress and commands <span class="num">bills, budget, confirmations, watched posts</span></h2>';
    var LANES = { bill: ["introduced","committee","house","senate","conference","enacted"], budget: ["request","house","senate","cr","enacted"], nomination: ["vacant","announced","nominated","hearing","committee","floor","confirmed"] };
    var STGL = { introduced: "Introduced", committee: "Committee", house: "House", senate: "Senate", conference: "Conference", enacted: "Enacted", request: "Request", cr: "CR", vacant: "Vacant", announced: "Announced", nominated: "Nominated", hearing: "Hearing", floor: "Floor", confirmed: "Confirmed", withdrawn: "Withdrawn", stalled: "Stalled", vetoed: "Vetoed" };
    var STGS = { introduced: "Intro", committee: "Cmte", house: "House", senate: "Senate", conference: "Conf", enacted: "Law", request: "Req", cr: "CR", vacant: "Vacant", announced: "Named", nominated: "Nom", hearing: "Hearing", floor: "Floor", confirmed: "Conf'd" };
    var DONE = { enacted: 1, confirmed: 1, withdrawn: 1, vetoed: 1 };
    var CG = (ctx.congress || []).map(function (c) { var d = c.dates || {}, last = Object.keys(d).reduce(function (m, k) { return d[k] > m ? d[k] : m; }, "") || c.updated || c.added || ""; return { c: c, last: last, badge: c.added === TD ? "NEW" : c.updated === TD ? "UPDATED" : "" }; }).filter(function (x) { return !(DONE[x.c.stage] && daysBetween(x.last, TD) > 30); });
    function stg(c) { var st = c.stage; if (st === "vacant") return "vac"; if (st === "withdrawn" || st === "stalled" || st === "vetoed" || /stalled|vetoed/i.test(c.status || "")) return "off"; if (st === "confirmed" || st === "enacted") return "done"; if (st === "cr") return "cr"; return "prog"; }
    function cgCard(x) {
      var c = x.c, lane = LANES[c.kind] || LANES.bill, idx = lane.indexOf(c.stage), d = c.dates || {}, g = stg(c);
      var pipe = '<div class="pipe g-' + g + '" style="grid-template-columns:repeat(' + lane.length + ',1fr)">' + lane.map(function (st, i) { var on = g !== "off" && i <= idx, cur = st === c.stage; return '<span class="' + (on ? "on" : "") + (cur ? " cur" : "") + '" title="' + esc(STGL[st] + (d[st] ? " · " + fmtShort(d[st]) : "")) + '"><i></i><small>' + STGL[st] + "</small></span>"; }).join("") + "</div>";
      var dl = c.deadline && c.deadline >= TD ? daysBetween(TD, c.deadline) : null;
      return '<div class="cf g-' + g + " " + fu(x.badge) + '" id="cg-' + esc(c.id) + '"><div class="cf-top"><b>' + esc(c.title || c.post) + '</b><span class="chip st g-' + g + '">' + esc(STGL[c.stage] || c.stage) + (x.last ? " · " + esc(fmtShort(x.last)) : "") + "</span>" + (dl != null ? '<span class="chip st' + (dl <= 14 ? " act" : "") + '">due ' + esc(fmtShort(c.deadline)) + " · " + (dl === 0 ? "today" : dl + " d") + "</span>" : "") + badge(x.badge) + '</div><div class="cf-who">' + (c.kind === "nomination" ? (c.nominee ? esc(c.nominee) : '<span class="small">no nominee</span>') : esc(c.number || "")) + (c.number && c.kind === "nomination" ? ' <span class="small">· ' + esc(c.number) + "</span>" : "") + (c.src && c.src.length ? '<sup class="r">' + c.src.map(function (z) { return citeLink(z[0], srcMap(c.src)); }).join("") + "</sup>" : "") + "</div>" + pipe + (c.next || c.status ? '<p class="small">' + rich(c.next || c.status, srcMap(c.src)) + "</p>" : "") + "</div>";
    }
    var RECENT = 7;
    function cgRecent(x) { var c = x.c, d = c.dates || {}, acts = [c.updated || "", c.added || ""].concat(Object.keys(d).map(function (k) { return d[k]; })).filter(function (v) { return v && v <= TD; }).sort(), lastAct = acts.pop(); return (lastAct && daysBetween(lastAct, TD) <= RECENT) || (c.deadline && c.deadline >= TD && daysBetween(TD, c.deadline) <= 21); }
    var CGN = CG.filter(cgRecent), CGQ = CG.filter(function (x) { return !cgRecent(x) && !DONE[x.c.stage]; });
    h += '<h3 id="congresstracker">Congress tracker <span class="small">what moved in the last ' + RECENT + ' days</span></h3>';
    h += '<div class="cg-key small"><span class="k g-vac"></span>vacant <span class="k g-prog"></span>in the pipeline <span class="k g-cr"></span>stopgap <span class="k g-done"></span>confirmed or enacted <span class="k g-off"></span>stalled or withdrawn</div>';
    function cgRow(x) {
      var c = x.c, lane = LANES[c.kind] || LANES.bill, idx = lane.indexOf(c.stage), d = c.dates || {}, g = stg(c), moved = cgRecent(x), dl = c.deadline && c.deadline >= TD ? daysBetween(TD, c.deadline) : null;
      var cells = lane.map(function (st, i) { var on = g !== "off" && i <= idx, cur = st === c.stage; return '<i class="' + (on ? "on" : "") + (cur ? " cur" : "") + '" title="' + esc(STGL[st] + (d[st] ? " · " + fmtShort(d[st]) : "")) + '"></i>'; }).join("");
      return '<div class="cgr g-' + g + " " + fu(x.badge) + (moved ? " moved" : "") + '" id="cg-' + esc(c.id) + '"><div class="cgt"><b>' + esc(c.title || c.post) + "</b>" + (c.kind === "nomination" ? '<span class="small"> · ' + esc(c.nominee || "no nominee") + "</span>" : c.number ? '<span class="small"> · ' + esc(c.number) + "</span>" : "") + badge(x.badge) + inToday("congress", c.id) + '</div><div class="cgm" style="grid-template-columns:repeat(' + lane.length + ',1fr)">' + cells + '</div><div class="cgs"><span class="chip st g-' + g + '">' + esc(STGL[c.stage] || c.stage) + (x.last ? " · " + esc(fmtShort(x.last)) : "") + "</span>" + (dl != null ? '<span class="chip st' + (dl <= 14 ? " act" : "") + '">due ' + esc(fmtShort(c.deadline)) + " · " + (dl === 0 ? "today" : dl + " d") + "</span>" : "") + (c.src && c.src.length ? '<sup class="r">' + c.src.map(function (z) { return citeLink(z[0], srcMap(c.src)); }).join("") + "</sup>" : "") + "</div>" + (moved && (c.next || c.status) ? '<p class="small">' + rich(c.next || c.status, srcMap(c.src)) + "</p>" : "") + "</div>";
    }
    h += '<div class="fug">' + nq();
    [["bill", "Key defence bills", LANES.bill], ["budget", "Budget and appropriations", LANES.budget], ["nomination", "Confirmations", LANES.nomination]].forEach(function (lane) {
      var rows = CG.filter(function (x) { return (x.c.kind || "bill") === lane[0]; }).sort(function (a, b) { var am = cgRecent(a) ? 0 : 1, bm = cgRecent(b) ? 0 : 1; if (am !== bm) return am - bm; return a.last < b.last ? 1 : a.last > b.last ? -1 : 0; });
      if (!rows.length) return;
      h += '<div class="lbl cg-lane">' + lane[1] + '</div><div class="cgm head" style="grid-template-columns:repeat(' + lane[2].length + ',1fr)">' + lane[2].map(function (st) { return '<small title="' + esc(STGL[st]) + '">' + esc(STGS[st] || STGL[st]) + "</small>"; }).join("") + '</div><div class="cglist">' + rows.map(cgRow).join("") + "</div>";
    });
    h += "</div>";
    if (!CG.length) h += quiet("Nothing tracked yet.");
    var CW = ctx.congressWatch || [], CT = ctx.congressTiers || [];
    if (CW.length) {
      var openBy = {}, openId = {}, conf30 = {}; CG.forEach(function (x) { var c = x.c; if (c.kind !== "nomination" || !c.postId) return; if (!DONE[c.stage]) { openBy[c.postId] = c.stage; openId[c.postId] = c.id; } else if (c.stage === "confirmed" && x.last && daysBetween(x.last, TD) <= 30) conf30[c.postId] = 1; });
      function wst(w) { var st = openBy[w.id]; if (st === "vacant") return "vac"; if (st) return "prog"; if (!w.holder) return "unk"; if (w.acting) return "acting"; if (conf30[w.id]) return "done"; return "ok"; }
      var cnt = {}; CW.forEach(function (w) { var k = wst(w); cnt[k] = (cnt[k] || 0) + 1; });
      var WL = [["vac", "vacant"], ["prog", "nomination in progress"], ["acting", "acting holder"], ["done", "confirmed in 30 days"], ["ok", "filled"], ["unk", "not yet sourced"]];
      h += '<div class="lbl cg-lane">Watched posts</div><div class="cg-key small">' + WL.filter(function (l) { return cnt[l[0]]; }).map(function (l) { return '<span class="k w-' + l[0] + '"></span>' + cnt[l[0]] + " " + l[1]; }).join(" ") + '</div><div class="wposts">';
      CT.forEach(function (t) {
        var list = CW.filter(function (w) { return w.tier === t.id; }); if (!list.length) return;
        h += '<div class="wtier"><span class="wtn">' + esc(t.name) + "</span>" + list.map(function (w) { var k = wst(w); return '<a class="wpc w-' + k + (w.updated && daysBetween(w.updated, TD) <= RECENT && w.updated !== TD ? " chg" : "") + '" href="#' + (openId[w.id] ? "cg-" + esc(openId[w.id]) : "congresstracker") + '" title="' + esc(w.post + ": " + (w.holder ? w.holder + (w.acting ? " (acting)" : "") : "holder not sourced") + (w.since ? " · since " + fmtShort(w.since) + " " + w.since.slice(0, 4) : "") + (w.note ? " · " + w.note : "")) + '">' + esc(w.post) + "</a>"; }).join("") + "</div>";
      });
      var EXC = CW.filter(function (w) { var k = wst(w); return k === "vac" || k === "prog" || k === "acting" || k === "done" || (w.updated && w.updated > addDays(TD, -RECENT) && w.updated < TD); });
      h += "</div>" + (EXC.length ? '<ul class="wexc">' + EXC.map(function (w) { var k = wst(w); return '<li class="w-' + k + '"><b>' + esc(w.post) + "</b> " + (w.holder ? esc(w.holder) + (w.acting ? " (acting)" : "") : '<span class="small">no holder</span>') + (openBy[w.id] ? ' <em>' + esc(STGL[openBy[w.id]] || openBy[w.id]) + "</em>" : "") + (w.src && w.src.length ? '<sup class="r">' + w.src.map(function (z) { return citeLink(z[0], srcMap(w.src)); }).join("") + "</sup>" : "") + "</li>"; }).join("") + "</ul>" : "") + '<p class="small">Each chip is a watched post, coloured by its state; tap for the holder. Listed below the chips: anything vacant, acting, in the pipeline or newly confirmed.</p>';
    }
    h += "</section>";
    var RL = (REL.releases || []).filter(function (r) { return r.date <= TD && r.date >= addDays(TD, -45); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    h += '<section id="releases" class="watch"><h2>Release log <span class="num">last 45 days</span></h2>';
    h += RL.length ? '<div class="fug">' + nq() + '<div class="tl">' + RL.map(function (r) { var b = r.date === TD ? "NEW" : r.date === addDays(TD, -1) ? "UPDATED" : ""; return '<div class="tl-i ' + fu(b) + '"><div class="d"><span>' + esc(fmtLong(r.date)) + '</span><span class="chip rep">' + esc(r.kind || "release") + "</span></div><h4>" + esc(r.t) + "</h4>" + badge(b) + '<p class="ink">' + esc(r.lab || "") + (r.lab && r.n ? " · " : "") + rich(r.n || "", srcMap(r.src)) + "</p></div>"; }).join("") + "</div></div>" : quiet("No releases logged yet.");
    h += "</section>";
    var SO = REL.sota || {};
    h += sotaBlock(SO, TD);

    /* ===== Part 3 · The reading ===== */
    var P = E.planner || {};
    h += forecastBlock(ctx, TD);
    TIER_HTML.watch = h; h = "";
    h += part("reading", pn("reading"), "The reading", "The long pieces: the feature, the Army in depth, the week in war and Aperture.", "p-reading");
    /* feature */
    var FE = WO.feature;
    var WROT = [["mon","Mon","Theatre in numbers"],["tue","Tue","Actor on the record"],["wed","Wed","Trend line"],["thu","Thu","Chronology"],["fri","Fri","Week on the board"],["sat","Sat","Geography"],["sun","Sun","The record"]];
    h += '<section id="feature" class="reading"><h2>' + esc(FE && FE.kind ? FE.kind : "Feature") + "</h2>";
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

    var RJ = ctx.research || {}, RSL = Array.isArray(E.research) ? E.research : (E.research ? [E.research] : []), RF = RJ.fields || {};
    h += '<section id="research" class="reading"><h2>Research <span class="num">' + (RSL.length ? RSL.length + (RSL.length === 1 ? " publication" : " publications") + " today · one military, the rest across the fields" : "rotating publications") + "</span></h2>";
    if (RSL.length) {
      RSL.forEach(function (RS, i) {
        var lead = i === 0;
        h += '<article class="feature rsp ' + (lead ? "lead" : "") + " " + fu(RS.badge || "NEW") + '"><div class="lbl" style="color:var(--pc)">' + (RS.field ? '<span class="chip st fld">' + esc(RF[RS.field] || RS.field) + "</span> " : "") + esc(RS.org || "") + (RS.kind ? " · " + esc(RS.kind) : "") + '</div><h3 class="ft">' + esc(RS.title) + "</h3>";
        h += '<p class="small">' + esc([RS.authors, RS.date ? fmtLong(RS.date) : "", RS.length].filter(Boolean).join(" · ")) + cite(RS.src) + "</p>";
        h += (RS.summary || []).map(function (q) { return "<p>" + rich(q) + "</p>"; }).join("");
        if (RS.findings && RS.findings.length) h += '<h4>What it finds</h4><ul class="clean">' + RS.findings.map(function (f) { return "<li>" + rich(f) + "</li>"; }).join("") + "</ul>";
        if (RS.table) h += table(RS.table.head, RS.table.rows.map(function (r) { return "<tr>" + r.map(function (c, j) { return "<td" + (j > 0 && /^[\d.,%$€+−\- ]+$/.test(String(c)) ? ' class="d"' : "") + ">" + rich(c) + "</td>"; }).join("") + "</tr>"; }).join(""), "lbl1");
        if (RS.method) h += '<p class="small"><b>Method and limits:</b> ' + rich(RS.method) + "</p>";
        if (RS.sw) h += '<p class="sw-line"><b class="l">' + (lead ? "For Brunssum" : "So what") + "</b>" + rich(RS.sw) + "</p>";
        h += linkChips(RS.links) + "</article>";
      });
    } else h += quiet("No research piece in this edition.");
    var RC = (RJ.covered || []).filter(function (c) { return c.date <= TD; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 15), RQ = (RJ.queue || []).filter(function (q) { return !q.for || q.for >= TD; });
    if (RC.length) h += '<h3>Covered recently</h3><ul class="exl">' + RC.map(function (c) { return '<li><span class="d">' + esc(fmtShort(c.date)) + '</span><span>' + (c.field ? '<span class="chip st fld">' + esc(RF[c.field] || c.field) + "</span> " : "") + "<b>" + esc(c.org) + "</b> · " + (c.url ? '<a href="' + esc(c.url) + '" target="_blank" rel="noopener">' + esc(c.title) + "</a>" : esc(c.title)) + "</span></li>"; }).join("") + "</ul>";
    if (RQ.length) h += '<h3>In the queue</h3><ul class="exl">' + RQ.map(function (q) { return '<li><span class="d">' + esc(q.for ? fmtShort(q.for) : "soon") + '</span><span><b>' + esc(q.org) + "</b> · " + (q.url ? '<a href="' + esc(q.url) + '" target="_blank" rel="noopener">' + esc(q.title) + "</a>" : esc(q.title)) + (q.note ? ' <span class="small">· ' + esc(q.note) + "</span>" : "") + "</span></li>"; }).join("") + "</ul>";
    h += "</section>";
    /* philosophy note of the day */
    var PH = E.philosophy;
    if (PH) {
      h += '<section id="philosophy" class="reading"><h2>Philosophy note <span class="num">' + esc(PH.tradition || "one idea a day") + "</span></h2>";
      h += '<div class="phil ' + fu(PH.badge || "NEW") + '"><blockquote>' + rich(PH.quote) + "</blockquote>";
      h += '<p class="attr"><b>' + esc(PH.thinker) + "</b>" + (PH.work ? ", <i>" + esc(PH.work) + "</i>" : "") + (PH.where ? ", " + esc(PH.where) : "") + (PH.year ? " (" + esc(PH.year) + ")" : "") + (PH.translation ? ' <span class="small">· ' + esc(PH.translation) + "</span>" : "") + cite(PH.src) + "</p>";
      if (PH.gloss) h += "<p>" + rich(PH.gloss) + "</p>";
      if (PH.why) h += '<p class="sw-line"><b class="l">For the day</b>' + rich(PH.why) + "</p>";
      h += "</div></section>";
    }
    h += '<section id="depth" class="reading"><h2>Army in depth <span class="num">Mon numbers · Wed programme · Fri decisions</span></h2>';
    var DP = AR.depth, PROT = [["mon","Mon","Readiness and recruiting in numbers"],["wed","Wed","An acquisition programme in numbers"],["fri","Fri","The week's personnel and policy decisions"]];
    if (DP) {
      h += '<article class="feature" id="armydepth"><div class="lbl" style="color:var(--pc)">' + esc(DP.kind || "In depth") + '</div><h3 class="ft">' + esc(DP.title) + "</h3>" + (DP.body || []).map(function (p) { return "<p>" + rich(p) + "</p>"; }).join("");
      if (DP.table) h += table(DP.table.head, DP.table.rows.map(function (r) { return "<tr>" + r.map(function (c, j) { return "<td" + (j > 0 && /^[\d.,%$€+−\- ]+$/.test(String(c)) ? ' class="d"' : "") + ">" + rich(c) + "</td>"; }).join("") + "</tr>"; }).join(""), "lbl1");
      if (DP.bars) h += '<div class="panel"><div class="lbl">' + esc(DP.bars.label || "") + "</div>" + chartBox("armybars", 150) + "</div>";
      h += "</article>";
    }
    h += '<div class="ap-c"><div class="lbl">Depth rota</div><div class="rota three">' + PROT.map(function (r) { return '<div class="' + (DP && r[0] === DP.rota ? "on" : "") + '"><b>' + r[1] + "</b>" + r[2] + "</div>"; }).join("") + "</div></div>";
    if (!DP) h += quiet("No depth piece today; the rota is below.");
    h += "</section>";
    h += '<section id="ttpsec" class="reading"><h2>Week in war <span class="num">tactics, techniques and procedures · Saturdays</span></h2>';
    if (DT.ttp) h += '<article class="feature" id="ttp"><h3 class="ft">' + esc(DT.ttp.title) + "</h3>" + (DT.ttp.body || []).map(function (p) { return "<p>" + rich(p) + "</p>"; }).join("") + "</article>";
    if (!DT.ttp) h += quiet("Written on Saturdays.");
    h += "</section>";
    /* 7.5: the contrarian read, weak signal, number, exercise inject and staff question were dropped at Nick's request; the deep cut and the long read remain */
    h += '<section id="aperture" class="reading"><h2>Aperture <span class="num">the deep cut and a long read</span></h2><div class="ap">';
    if (AP.deep) {
      var D = AP.deep;
      h += '<details class="deep" open><summary><div class="eyebrow" style="color:var(--pc)">' + esc(D.kind) + "</div><h4>" + esc(D.title) + '</h4></summary><div class="deep-body">' + (D.body || []).map(function (p) { return "<p>" + rich(p) + "</p>"; }).join("");
      if (D.table) h += table(D.table.head, D.table.rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + rich(c) + "</td>"; }).join("") + "</tr>"; }).join(""), "lbl1");
      h += "</div></details>";
    }
    var RT = AP.redteam;
    if (RT && RT.title) {
      h += '<article class="redteam ' + fu(RT.carried ? "" : "NEW") + '"><div class="lbl">Red team · ' + esc(RT.actor || "the other side") + (RT.carried ? " · from Saturday" : "") + "</div><h4>" + esc(RT.title) + "</h4>" + badge(RT.carried ? "" : "NEW");
      if (RT.premise) h += '<p class="premise"><b class="l">Assumption under test</b>' + rich(RT.premise) + "</p>";
      h += (RT.body || []).map(function (p) { return "<p>" + rich(p) + "</p>"; }).join("");
      if (RT.moves && RT.moves.length) h += '<h5>What they would do, and what we would see first</h5>' + table(["Their move", "First observable"], RT.moves.map(function (m) { return "<tr><td>" + rich(m[0]) + "</td><td>" + rich(m[1]) + "</td></tr>"; }).join(""));
      if (RT.assumptions && RT.assumptions.length) h += '<p class="small"><b>Allied assumptions attacked:</b> ' + RT.assumptions.map(esc).join(" · ") + "</p>";
      h += linkChips(RT.links) + '<p class="small">Assessment written from the adversary\'s seat; it argues a case, it does not report one. Facts cited; the rest is the exercise.' + cite(RT.src) + "</p></article>";
    }
    if (AP.longread) h += '<div class="ap-c"><div class="lbl">Long read</div><p><a href="' + esc(AP.longread.url) + '" target="_blank" rel="noopener">' + esc(AP.longread.title) + "</a> · " + esc(AP.longread.outlet) + "</p><p>" + rich(AP.longread.why) + "</p></div>";
    var ROT = [["mon","Mon","Historical echo"],["tue","Tue","Outside-in"],["wed","Wed","Red lens"],["thu","Thu","Concept"],["fri","Fri","Ally spotlight + week in hybrid"],["sat","Sat","Red team (and the TTP piece in Defence tech)"],["sun","Sun","Red team carried; week in defence tech"]];
    h += '<p class="small rotal"><b>Rota</b> ' + ROT.map(function (r) { return '<span class="' + (r[0] === AP.rota ? "on" : "") + '">' + r[1] + " " + r[2] + "</span>"; }).join(" · ") + "</p>";
    h += "</div></section>";


    /* ===== Part 4 · Home and planning ===== */
    TIER_HTML.reading = h; h = "";
    h += part("home", pn("home"), "Home and planning", "Family, what is on nearby, the languages, the snow, the Canes, and the week and year ahead.", "p-home");
    h += localBlock(ctx, TD, PEV);
    h += '<section id="afnorth" class="home"><h2>AFNORTH &amp; family</h2>';
    if (AF.intro) h += '<p class="small">' + rich(AF.intro) + "</p>";
    if (AF.rows && AF.rows.length) h += table(["Date", "Event", "Action"], AF.rows.map(function (r) { return '<tr class="' + (r[3] === "soon" ? "soon" : "") + '"><td class="d">' + esc(r[0]) + "</td><td>" + rich(r[1]) + "</td><td>" + rich(r[2]) + "</td></tr>"; }).join(""));
    var afDates = {}; (AF.rows || []).forEach(function (r) { var m = /^(\d{1,2})[–-]?\d{0,2}\s+([A-Z][a-z]{2})/.exec(String(r[0])); if (m) afDates[m[1] + " " + m[2]] = 1; });
    var hasRows = !!(AF.rows && AF.rows.length);
    var SCH = (PEV || []).filter(function (e) { return (e.end || e.date) >= TD && daysBetween(TD, e.date) <= 60 && (hasRows ? (e.src === "inbox" && /^(AFNORTH|PTA|CYS) · /.test(e.sub) && !afDates[fmtShort(e.date)]) : ((e.cat === "school" && e.sys === "afnorth") || (e.src === "inbox" && /^(AFNORTH|PTA|CYS) · /.test(e.sub)))); });
    if (SCH.length) h += '<h3>' + (hasRows ? "Also from the mail" : "School dates") + ' <span class="small">next 60 days' + (hasRows ? "" : " · the academic calendar and the mail check") + '</span></h3><ul class="clean wn">' + SCH.map(function (e) { var n = daysBetween(TD, e.date), span = e.end && e.end !== e.date; return '<li><span class="d">' + esc(DOW[pd(e.date).getDay()] + " " + fmtShort(e.date)) + (span ? " – " + esc(fmtShort(e.end)) : "") + '</span><span class="w"><span class="dot" style="background:' + catColor(e.cat) + '"></span>' + esc(e.t.replace(/^AFNORTH: /, "")) + " " + icsLink(e.t, e.date, e.end, e.sub) + (e.sub && e.cat !== "school" ? '<span class="small">' + esc(e.sub) + "</span>" : "") + "</span></li>"; }).join("") + "</ul>";
    else if (!(AF.rows && AF.rows.length)) h += quiet("Nothing on the school calendar in the next 60 days.");
    if (AF.note) h += '<p class="small" style="margin-top:8px">' + rich(AF.note) + "</p>";
    h += "</section>";
    /* out and about */
    var EVS = (ctx.events || []).filter(function (e) { return e.to >= TD; }).sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; });
    var dow = today.getDay(), fri = addDays(TD, dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow), sun = addDays(fri, 2);
    var WK = EVS.filter(function (e) { return e.from <= sun && e.to >= fri; }).sort(function (a, b) { return (a.drive == null ? 999 : a.drive) - (b.drive == null ? 999 : b.drive); }), N30 = EVS.filter(function (e) { return e.from <= addDays(TD, 30) && WK.indexOf(e) < 0; });
    var WX = ((E.today || {}).weather || {}).week || [], wkWx = WX.filter(function (r) { return r[0] >= fri && r[0] <= sun; });
    function evRow(e) {
      var b = e.added === TD ? "NEW" : e.updated === TD ? "UPDATED" : "", when = e.from === e.to ? fmt(pd(e.from)) : fmtShort(e.from) + " – " + fmtShort(e.to);
      return '<div class="evrow ' + fu(b) + '" data-cat="' + esc(e.cat) + '"><span class="d">' + esc(when) + '</span><div><span class="chip st" style="color:' + catColor("out") + '">' + esc(EVCAT[e.cat] || e.cat) + "</span>" + (e.kid && e.cat !== "kids" ? '<span class="chip st quiet">kids</span>' : "") + " <b>" + esc(e.t) + "</b>" + badge(b) + '<div class="small">' + esc([e.town + (e.cc ? " (" + e.cc + ")" : ""), e.venue, e.drive != null ? "~" + e.drive + " min" : "", e.cost].filter(Boolean).join(" · ")) + (e.src && e.src.length ? (typeof e.src[0][0] === "number" || /^\d+$/.test(e.src[0][0]) ? '<sup class="r">' + e.src.map(function (z) { return citeLink(z[0], srcMap(e.src)); }).join("") + "</sup>" : ' · <a href="' + esc(e.src[0][1] || "#") + '" target="_blank" rel="noopener" class="srcl">source</a>') : "") + " " + icsLink(e.t, e.from, e.to, [e.venue, e.town, e.cost].filter(Boolean).join(", ")) + "</div></div></div>";
    }
    h += '<section id="offduty" class="home"><h2>Out and about <span class="num">within 90 minutes</span></h2>';
    h += '<h3>This weekend <span class="small">' + esc(fmtShort(fri) + " – " + fmtShort(sun)) + "</span></h3>";
    if (OD.weather) h += '<p class="small">' + rich(OD.weather) + "</p>";
    if (wkWx.length) h += '<p class="small wkwx">' + wkWx.map(function (r) { var d = pd(r[0]); return "<b>" + DOW[d.getDay()] + "</b> " + esc(r[1]) + "° / " + esc(r[2]) + "°" + (r[3] != null && r[3] !== "" ? ", " + esc(r[3]) + "% rain" : ""); }).join(" · ") + "</p>";
    h += WK.length ? '<p class="small">Nearest first; tap + cal to add one to your calendar.</p><div class="evlist fug">' + nq() + WK.map(evRow).join("") + "</div>" : quiet("Nothing listed for the weekend yet.");
    if (OD.items && OD.items.length) h += '<h3>Editor\'s picks</h3>' + items(OD.items, { inlineTag: true });
    if (OD.weekend) {
      h += "<h3>Weekend guide</h3>" + table(["Day", "Event", "Place", "Why go", "Cost / booking"], OD.weekend.rows.map(function (r) { return "<tr>" + r.map(function (c, j) { return "<td" + (j === 0 ? ' class="d"' : "") + ">" + rich(c) + "</td>"; }).join("") + "</tr>"; }).join(""));
      if (OD.weekend.gem) h += '<p class="sw-line" style="margin-top:10px"><b class="l">Hidden gem</b>' + rich(OD.weekend.gem) + "</p>";
      if (OD.weekend.family) h += '<p class="sw-line"><b class="l">Family pick</b>' + rich(OD.weekend.family) + "</p>";
    }
    h += '<h3>Next 30 days' + (WK.length ? ' <span class="small">after this weekend</span>' : "") + '</h3><div class="filt" id="evfilt" role="group" aria-label="Filter events"><button type="button" data-f="all" aria-pressed="true">All</button>' + Object.keys(EVCAT).map(function (k) { return '<button type="button" data-f="' + k + '" aria-pressed="false">' + EVCAT[k] + "</button>"; }).join("") + '<button type="button" data-f="kids" aria-pressed="false">With kids</button></div>';
    h += N30.length ? '<div class="evlist fug" id="evlist">' + nq() + N30.map(evRow).join("") + '<p class="quiet" id="evempty" style="display:none">Nothing in this category in the next 30 days.</p></div>' : quiet("Nothing listed for the next 30 days.");
    h += "</section>";
    /* taal */
    var ID = (ctx.idioms || []).filter(function (i) { return i.date <= TD; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var LANG = { nl: "Dutch", fr: "French", it: "Italian" };
    h += '<section id="dutch" class="home"><h2>Taal <span class="num">Dutch, French, Italian, Limburgs</span></h2>';
    var WD = (((ctx.local || {}).woord) || []).filter(function (w) { return w.date <= TD; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
    if (WD) h += '<div class="idiom li ' + fu(WD.date === TD ? "NEW" : "") + '"><div class="lbl">Limburgs word of the day</div><div class="w" lang="li">' + esc(WD.word) + "</div>" + badge(WD.date === TD ? "NEW" : "") + '<p class="lit">' + esc(WD.meaning_nl || "") + (WD.meaning_en ? " · " + esc(WD.meaning_en) : "") + "</p>" + (WD.example ? "<p><i>" + esc(WD.example) + "</i>" + (WD.example_en ? ' <span class="small">' + esc(WD.example_en) + "</span>" : "") + "</p>" : "") + (WD.note ? '<p class="small">' + esc(WD.note) + (WD.src && WD.src[0] && WD.src[0][1] ? ' · <a href="' + esc(WD.src[0][1]) + '" target="_blank" rel="noopener">source</a>' : "") + "</p>" : "") + "</div>";
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
    if (SK && inSeason && SK.resorts && SK.resorts.length) {
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

    var HK = E.hockey || {};
    h += '<section id="hockey" class="home"><h2>Hurricanes' + (CV ? ' <span class="num">' + esc(CV.season) + "</span>" : "") + "</h2>";
    if (CV) {
      h += '<div class="season" role="list" aria-label="Last ten results">' + CV.games.slice(-10).map(function (g) { return '<div class="g ' + esc(g.res) + '" role="listitem" title="' + esc(fmtShort(g.date) + (g.home ? " vs " : " at ") + g.opp + ": " + g.res + " " + g.gf + "–" + g.ga) + '"><b>' + g.res + "</b>" + (g.home ? "" : "@") + esc(g.opp) + "</div>"; }).join("") + "</div>";
      h += '<p class="recline">Record <b>' + esc(CV.record) + "</b> · <b>" + CV.points + "</b> pts" + (CV.metro ? " · <b>" + ordinal(CV.metro) + "</b> in the Metro" : "") + " · " + CV.games.length + " games</p>";
      if (CV.upcoming.length) h += '<div class="lbl sched-l">Next ten · CET</div><div class="season up" role="list" aria-label="Next ten games">' + CV.upcoming.map(function (g) { var dk = g.utc ? cetDate(g.utc) : g.date, tm = g.utc ? cet(g.utc).replace(/^\w+,? /, "") : ""; return '<div class="g" role="listitem" title="' + esc(fmt(pd(dk)) + (g.home ? " vs " : " at ") + g.opp + (tm ? " · " + tm + " CET" : "")) + '"><b>' + esc(fmtShort(dk)) + "</b>" + (g.home ? "" : "@") + esc(g.opp) + (tm ? "<small>" + esc(tm) + "</small>" : "") + "</div>"; }).join("") + "</div>" + '<p class="small">' + CV.upcoming.slice(0, 3).map(function (g) { return icsLink("Canes " + (g.home ? "vs " : "at ") + g.opp, g.utc ? cetDate(g.utc) : g.date, null, "Carolina Hurricanes", g.utc); }).join(" ") + " for the next three games</p>";
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
      if (C.next && C.next.length && !(CV && CV.upcoming.length)) h += table(["Next", "Opponent", "Puck drop here"], C.next.map(function (n) { return '<tr><td class="d">' + esc(n[0]) + "</td><td>" + esc(n[1]) + '</td><td class="d">' + esc(n[3]) + '<div class="small">' + esc(n[2]) + "</div>" + (n[4] ? '<span class="badge live">WATCH LIVE</span>' : "") + "</td></tr>"; }).join("")) + '<p class="small" style="margin:0">Schedule' + cite(C.nextSrc) + "</p>";
      h += "</div>";
    }
    if (CV && CV.games.length > 1) h += '<div class="panel" style="margin-top:12px"><div class="lbl">Season so far · points by game, goals for and against</div><div class="chart" id="hkchart" style="min-height:170px"></div></div>';
    h += teamsBlock(ctx.teams, TD);
    h += '<h3>Scores <span class="small">' + esc(HK.scoresDate || "") + "</span></h3>";
    if (HK.scores && HK.scores.length) {
      h += '<div class="scores">' + HK.scores.map(function (g) {
        var pend = g[4] === "pending", aw = g[1] > g[3];
        return '<div class="gm' + (g[0] === "CAR" || g[2] === "CAR" ? " car" : "") + '"><b class="' + (pend ? "" : aw ? "w" : "lo") + '">' + esc(g[0]) + '</b><span>' + (pend ? "–" : esc(g[1])) + '</span><b class="' + (pend ? "" : aw ? "lo" : "w") + '">' + esc(g[2]) + "</b><span>" + (pend ? "–" : esc(g[3])) + (g[4] && !pend ? " " + esc(g[4]) : "") + "</span>" + (pend ? '<span class="pend">final after press time</span>' : "") + "</div>";
      }).join("") + "</div>";
      if (HK.scoresNote) h += '<p class="small" style="margin-top:6px">' + rich(HK.scoresNote) + cite(HK.scoresSrc) + "</p>";
    } else h += quiet("No NHL games last night.");
    h += "<h3>Top NHL news</h3>" + items(HK.news) + "</section>";

    h += weekReview(E, ctx, TD, today);
    h += '<section id="week" class="home"><h2>This week <span class="num">holidays, school, bins, deadlines, major events</span></h2>' + weekStrip(PEV, E, TD) + "</section>";
    h += comingUp(PEV, ctx, TD);
    h += '<section id="weather" class="home"><h2>Weather and daylight <span class="num">' + esc(HOME.name) + " · 7 days</span></h2>" + weatherBlock(E, TD) + "</section>";
    h += '<section id="countdown" class="home"><h2>Countdowns</h2>' + countdowns(PEV, ctx, TD) + "</section>";
    h += '<section id="tv" class="home"><h2>TV <span class="num">what you follow, what comes next</span></h2>' + tvBlock(ctx, TD) + "</section>";
    h += '<section id="calendar" class="home"><h2>Calendar</h2>';
    if (P.otd) h += '<div class="ap-c" style="margin-bottom:14px"><div class="lbl">' + esc(P.otd.title) + '</div><p style="margin:0">' + rich(P.otd.body) + "</p></div>";
    var FILT = [["all","All"],["me","Yours"],["nl","NL"],["be","BE"],["de","DE"],["us","US"],["ev","Events"],["out","Out and about"],["teams","Teams"],["tv","TV"],["mail","Mail"],["homed","Home"],["school","School"],["watch","Horizon"],["ex","Exercises"]];
    h += '<div class="cal-nav"><button type="button" id="calprev" aria-label="Previous month">‹</button><span class="cal-title" id="caltitle"></span><button type="button" id="calnext" aria-label="Next month">›</button><button type="button" id="caltoday">This month</button></div>';
    h += '<div class="filt" id="calfilt" role="group" aria-label="Filter the calendar">' + FILT.map(function (f) { return '<button type="button" data-f="' + f[0] + '" aria-pressed="' + (f[0] === "all") + '">' + f[1] + "</button>"; }).join("") + "</div>";
    h += '<div class="legend">' + Object.keys(CAT).map(function (k) { return '<span><i style="background:' + catColor(k) + '"></i>' + esc(CAT[k][0]) + "</span>"; }).join("") + "</div>";
    h += '<div id="calbody"></div>';
    if (P.culture) h += "<h3>" + esc(P.culture.title) + "</h3><p>" + rich(P.culture.body) + "</p>";
    h += "</section>";
    h += '<section id="year" class="home"><h2>The year ahead <span class="num">family, work, world, seasons</span></h2>' + yearAhead(ctx, E, TD, today) + "</section>";
    TIER_HTML.home = h;
    h = TIER_HTML.front + PARTS.slice(1).map(function (p) { return TIER_HTML[p[0]] || ""; }).join("");
    /* ===== Footer ===== */
    var SRC = E.sources || [], outlets = {}, t12 = 0, tiered = 0; SRC.forEach(function (x) { outlets[x[2]] = 1; if (x[4]) { tiered++; if (x[4] == 1 || x[4] == 2) t12++; } });
    h += '<a class="next" href="#sources">Sources ↓</a><section id="sources"><h2>Sources <span class="num">' + SRC.length + " from " + Object.keys(outlets).length + " outlets" + (tiered ? " · " + Math.round(100 * t12 / tiered) + "% official, primary or wire" : "") + "</span></h2>";
    h += '<details class="srcfold" id="srcfold"><summary>Open the numbered list <span class="small">· bold = official, primary or wire · a citation number anywhere on the page opens it here</span></summary><ol class="src">' + SRC.map(function (s) { return '<li id="s' + esc(s[0]) + '" value="' + esc(s[0]) + '"' + (s[4] ? ' class="t' + esc(s[4]) + '"' : "") + '><a href="' + esc(s[3]) + '" target="_blank" rel="noopener">' + esc(s[1]) + '</a><span class="o"> · ' + esc(s[2]) + "</span></li>"; }).join("") + "</ol></details>";
    if (E.flags) h += '<p class="small" style="margin-top:12px"><b>Sourcing flags:</b> ' + rich(E.flags) + "</p>";
    h += correctionsBlock(ctx, E, TD);
    h += aboutBlock(E, TD);
    h += '<div class="foot"><div class="arch"><label class="small" for="arch">Past editions</label><select id="arch"></select></div>';
    h += '<div class="search"><form id="searchform" role="search"><label class="small" for="q">Archive search</label><input id="q" type="search" placeholder="Search headlines in every edition" autocomplete="off"><button type="submit">Search</button></form><div id="hits" class="small"></div></div>';
    if (E.changelog) h += '<details class="srcfold small"><summary><b>What changed in the Readbook</b> · ' + E.changelog.length + " entries</summary><ul class=\"clean small\" style=\"margin-top:6px\">" + E.changelog.map(function (c) { return "<li>" + esc(c[0]) + ": " + rich(c[1]) + "</li>"; }).join("") + "</ul></details>";
    h += '<p class="small">Open sources only. Personal reading; not an official product.</p></div></section>';
    h += '<section id="health" class="plan"><h2>Readbook health <span class="num">act = fix the data model or the prompt</span></h2><div id="healthbody"></div></section>';
    h += '<button type="button" class="totop" id="totop" aria-label="Back to top">Top</button>';

    app.innerHTML = h;
    after(E, ctx);
  }

  /* ---------- post-render wiring ---------- */
  /* window listeners survive a re-render (archive picker, hash change): bind by name so the previous one is removed first */
  function bindWin(name, type, fn, opts) { ctx._win = ctx._win || {}; if (ctx._win[name]) window.removeEventListener(type, ctx._win[name], opts); ctx._win[name] = fn; window.addEventListener(type, fn, opts); }
  function after(E, ctx) {
    var today = pd(E.date), TD = E.date;
    var log = (ctx.incidents || []).filter(function (x) { var d = pd(x.date); return (today - d) / DAY <= 29 && d <= today; });
    if (!ctx.incidents) log = (E.hybrid && E.hybrid.incidents) || [];
    var FX = ctx.fx ? fxStats(ctx.fx.series, TD) : null, fxc = document.getElementById("fxchart");
    var FU = fuelStats(ctx.fuel, ctx.fx, TD);
    function fuelChart(days, W) { return lineChart(FU.usd, { W: W, H: FU.nato ? 210 : 170, days: days, avg: days >= 365 ? FU.avg : null, avgLabel: "1y avg $", hi: FU.hi, lo: FU.lo, hiLabel: "90d high", loLabel: "90d low", dec: 2, extra: FU.nato, extraLabel: "NATO $", label: "Euro 95 (E10) in the Netherlands, US dollars per gallon, at the pump and at the NATO tax-exempt rate" }); }
    var board = ctx.conflicts && ctx.conflicts.length ? boardView(ctx.conflicts, TD) : null;
    function drawCharts() { try { drawCharts0(); } catch (e) { if (window.console) console.error("charts: " + (e && e.message)); } }
    function drawCharts0() {
      var mapEl = document.getElementById("map"), trEl = document.getElementById("trend"), bc = document.getElementById("bycountry");
      if (!mapEl || !trEl || !bc) return;
      mapEl.innerHTML = incidentMap(log, mapEl.clientWidth);
      trEl.innerHTML = incidentTrend(log, today, trEl.clientWidth);
      var byC = {}; log.forEach(function (i) { var c = i.country || "?"; byC[c] = (byC[c] || 0) + 1; });
      bc.innerHTML = hbars(Object.keys(byC).sort(function (a, b) { return byC[b] - byC[a]; }).map(function (c) { return [c, byC[c]]; }), { inner: true, mono: true, empty: "No incidents logged yet." });
      app.querySelectorAll(".spark[data-s]").forEach(function (el) { el.innerHTML = sparkline(ctx._sparks[+el.getAttribute("data-s")], el.clientWidth); });
      app.querySelectorAll(".spark[data-ws]").forEach(function (el) { el.innerHTML = sparkline(ctx._ws[el.getAttribute("data-ws")], el.clientWidth); });
      if (fxc && FX) fxc.innerHTML = lineChart(FX.series, { W: fxc.clientWidth, days: +fxc.getAttribute("data-range"), avg: FX.avg, avgLabel: "1y avg ", hi: FX.hi30, lo: FX.lo30, hiLabel: "30d high", loLabel: "30d low", dec: 4, label: "USD/EUR, euros per dollar" });
      var fuc = document.getElementById("fuelchart"); if (fuc && FU) fuc.innerHTML = fuelChart(+fuc.getAttribute("data-range"), fuc.clientWidth);
      var pb = document.getElementById("paybars"); if (pb && FX) pb.innerHTML = vbars(FX.pay.map(function (p) { return [p[0], p[1], p[2], p[2] === FX.last[0].slice(0, 7)]; }), { W: pb.clientWidth, H: 130, fmt: function (v) { return "€" + v; }, label: "$1,000 in euros by month" });
      var wm = document.getElementById("worldmap"); if (wm && board) { var counts = {}; board.forEach(function (b) { counts[b.t.id] = b.n7; }); wm.innerHTML = worldMap(ctx.conflicts, counts, wm.clientWidth, ctx.land); }
      var fc = document.getElementById("fchart"); if (fc && ctx._fser) { var fm = ctx._fmeta || {}; fc.innerHTML = lineChart(ctx._fser, { W: fc.clientWidth, days: 400, dec: fm.decimals != null ? fm.decimals : 0, zero: true, label: fm.label || "" }); }
      var fb = document.getElementById("fbars"); if (fb && E.world && E.world.feature && E.world.feature.bars) fb.innerHTML = vbars(E.world.feature.bars.rows, { W: fb.clientWidth, zero: true, label: E.world.feature.bars.label || "" });
      var fg = document.getElementById("fgeo"); if (fg && ctx._geo) fg.innerHTML = geoSchematic(ctx._geo, fg.clientWidth);
      var hk = document.getElementById("hkchart"); if (hk && ctx.canes) hk.innerHTML = hockeyChart(canesView(ctx.canes, TD).games, hk.clientWidth);
      var um = document.getElementById("uamap"); if (um && ctx.uaFront) um.innerHTML = uaMap(ctx.uaFront, um.clientWidth);
      var cm = document.getElementById("ceumap"); if (cm) cm.innerHTML = ceuMap(ctx, cm.clientWidth);
      var sc = document.getElementById("spendchart"); if (sc) sc.innerHTML = spendChart(ctx.countries || [], sc.clientWidth);
      var tk = document.getElementById("tankchart"); if (tk) tk.innerHTML = tankChart(ctx._tank, tk.clientWidth);
      var tb = document.getElementById("tempband"); if (tb) tb.innerHTML = tempBand(((E.today || {}).weather || {}).week, tb.clientWidth);
      var dlc = document.getElementById("daylight"); if (dlc) dlc.innerHTML = daylight(HOME.lat, TD, dlc.clientWidth, parseFloat(dlc.getAttribute("data-h")));
      var ab = document.getElementById("armybars"); if (ab && E.army && E.army.depth && E.army.depth.bars) ab.innerHTML = vbars(E.army.depth.bars.rows, { W: ab.clientWidth, zero: true, label: E.army.depth.bars.label || "" });
      Object.keys(ctx._dts || {}).forEach(function (k) { app.querySelectorAll('[id="dts-' + k + '"]').forEach(function (el) { var m = ((ctx.worldSeries || {}).meta || {})[k] || {}; el.innerHTML = lineChart(ctx._dts[k], { W: el.clientWidth, days: 400, dec: m.decimals != null ? m.decimals : 0, zero: true, label: m.label || k }); }); });
    }
    drawCharts();
    var rsz = null; bindWin("charts", "resize", function () { clearTimeout(rsz); rsz = setTimeout(drawCharts, 150); });
    /* a cross-link whose target is not on this page (file missing, or an entry dated after this edition) is shown as text, not a dead link */
    app.querySelectorAll('a[href^="#"]').forEach(function (a) { var id = a.getAttribute("href").slice(1); if (!id || /^(ed-|top$|sources$|front$|p-)/.test(id) || a.closest(".toc, .hdr, header, nav")) return; if (!document.getElementById(id)) { var sp = document.createElement("span"); sp.className = a.className + " dead"; sp.title = a.title || ""; sp.textContent = a.textContent; a.parentNode.replaceChild(sp, a); } });
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
    var inRec0 = false;
    Array.prototype.forEach.call(app.children, function (el) { if (stop0 || el.id === "weekreview" || el.id === "week" || el.id === "sources") { stop0 = true; return; } if (el.classList && el.classList.contains("part")) inRec0 = el.classList.contains("watch"); if (inRec0 || el.id === "slim") return; words0 += (el.textContent || "").split(/\s+/).length; });
    var HR = health(E, ctx, TD, words0), nAct = HR.filter(function (r) { return r[1] === "act"; }).length, nWatch = HR.filter(function (r) { return r[1] === "watch"; }).length;
    var HB = HR.filter(function (r) { return r[1] !== "ok"; }).sort(function (a, b) { return (a[1] === "act" ? 0 : 1) - (b[1] === "act" ? 0 : 1); }), HG = HR.filter(function (r) { return r[1] === "ok"; });
    document.getElementById("healthbody").innerHTML = '<p class="hsum"><span class="chip hs ' + (nAct ? "act" : nWatch ? "watch" : "ok") + '">' + (nAct ? nAct + " to act on" : nWatch ? "nothing to act on" : "all clear") + "</span> " + HR.length + " checks · " + nWatch + " to watch · " + HG.length + " ok</p>" + (HB.length ? '<ul class="hl">' + HB.map(function (r) { return '<li class="h-' + r[1] + '"><span class="chip hs ' + r[1] + '">' + r[1] + "</span><b>" + esc(r[0]) + "</b> " + esc(r[2]) + "</li>"; }).join("") + "</ul>" : "") + (HG.length ? '<p class="small hok"><b>OK:</b> ' + HG.map(function (r) { return '<span title="' + esc(r[2]) + '">' + esc(r[0]) + "</span>"; }).join(" · ") + "</p>" : "") + ingestLine(ctx, TD);

    /* new / updated count */
    document.getElementById("nnew").textContent = app.querySelectorAll(".badge.new").length + " new";
    document.getElementById("nupd").textContent = app.querySelectorAll(".badge.upd").length + " updated";

    /* read time: Front through Hockey */
    var words = 0, stop = false;
    var inRec = false;
    Array.prototype.forEach.call(app.children, function (el) { if (stop || el.id === "weekreview" || el.id === "week" || el.id === "sources") { stop = true; return; } if (el.classList && el.classList.contains("part")) inRec = el.classList.contains("watch"); if (inRec || el.id === "slim") return; words += (el.textContent || "").split(/\s+/).length; });
    document.getElementById("readtime").textContent = "≈ " + Math.max(1, Math.round(words / 230)) + " min read";
    var aw = document.getElementById("aboutwords"); if (aw) aw.textContent = "about " + Math.round(words / 50) * 50 + " words in the Brief, the news and the reading; the watch is read on need";
    /* read time per tier for the contents block */
    var tierWords = {}, curTier = "front";
    Array.prototype.forEach.call(app.children, function (el) { if (el.classList && el.classList.contains("part")) { curTier = PART_CLASSES.filter(function (c) { return el.classList.contains(c); })[0] || curTier; return; } if (el.id === "slim" || el.id === "sources" || el.id === "health") return; tierWords[curTier] = (tierWords[curTier] || 0) + (el.textContent || "").split(/\s+/).length; });
    app.querySelectorAll(".toc [data-tier]").forEach(function (li) { var t = li.getAttribute("data-tier"); li.querySelector(".tm").textContent = "≈ " + Math.max(1, Math.round((tierWords[t] || 0) / 230)) + " min"; });

    /* theme control and status line */
    var themeBtns = app.querySelectorAll(".theme button");
    function applyTheme(t) { if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); themeBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-theme") === t)); }); store("rb:theme", t); }
    themeBtns.forEach(function (b) { b.addEventListener("click", function () { applyTheme(b.getAttribute("data-theme")); }); });
    applyTheme(store("rb:theme") || "auto");
    /* density */
    var densBtns = app.querySelectorAll(".dens button");
    function applyDens(d) { document.documentElement.classList.toggle("compact", d === "compact"); densBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-d") === (d === "compact" ? "compact" : "normal"))); }); store("rb:dens", d === "compact" ? "compact" : "normal"); }
    densBtns.forEach(function (b) { b.addEventListener("click", function () { applyDens(b.getAttribute("data-d")); }); });
    applyDens(store("rb:dens") || "normal");
    /* resume marker: offer a jump back to where the last read of this edition stopped */
    var rbox = document.getElementById("resumebox"), posKey = "rb:pos:" + E.date, saved = null;
    try { saved = JSON.parse(store(posKey) || "null"); } catch (e) { saved = null; }
    if (rbox && saved && saved.y > 1200 && !location.hash) { rbox.innerHTML = '<a class="resume" href="#' + esc(saved.id || "") + '">Resume at ' + esc(saved.name || "where you stopped") + "</a>"; rbox.querySelector("a").addEventListener("click", function (ev) { ev.preventDefault(); window.scrollTo(0, saved.y); rbox.innerHTML = ""; }); }
    var SECS = Array.prototype.slice.call(app.querySelectorAll("section[id]")), rrKey = "rb:rr:" + E.date, rr = {};
    try { rr = JSON.parse(store(rrKey) || "{}") || {}; } catch (e) { rr = {}; }
    function secName(sec) { var h2 = sec.querySelector("h2"); return h2 ? (h2.childNodes[0].textContent || "").trim().slice(0, 26) : sec.id; }
    function tierOf(sec) { return PART_CLASSES.filter(function (c) { return sec.classList.contains(c); })[0] || "home"; }
    function paintRR() { app.querySelectorAll(".toc li[data-tier]").forEach(function (li) { var t = li.getAttribute("data-tier"), el = li.querySelector(".rr"); if (!el) { el = document.createElement("span"); el.className = "rr"; li.appendChild(el); } el.textContent = rr[t] ? "read to " + rr[t] : ""; }); }
    paintRR();
    var rrTick = 0;
    ctx._track = function () {
      var now = Date.now(); if (now - rrTick < 1500) return; rrTick = now;
      var y = window.scrollY, cur = null; for (var i = 0; i < SECS.length; i++) { if (SECS[i].getBoundingClientRect().top + y <= y + 120) cur = SECS[i]; else break; }
      if (!cur) return;
      store(posKey, JSON.stringify({ y: y, id: cur.id, name: secName(cur) }));
      var t = tierOf(cur), idx = SECS.indexOf(cur), prev = rr[t] ? SECS.map(secName).indexOf(rr[t]) : -1;
      if (idx > prev) { rr[t] = secName(cur); store(rrKey, JSON.stringify(rr)); paintRR(); }
    };
    var st = document.getElementById("status");
    function status() { var t = ctx.fetchedAt ? new Date(ctx.fetchedAt) : null; st.textContent = (t ? "Loaded " + String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0") : "") + (navigator.onLine === false ? " · offline, showing the last copy" : ""); st.classList.toggle("off", navigator.onLine === false); }
    bindWin("online", "online", status); bindWin("offline", "offline", status); status();

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
    document.getElementById("newcount").addEventListener("click", function () { newOnly = true; applyNewOnly(); document.getElementById("p-news").scrollIntoView(); });
    applyNewOnly();

    /* USD/EUR range toggle */
    if (fxc && FX) {
      app.querySelectorAll(".fx-tools:not(.fuel-tools) button").forEach(function (b) {
        b.addEventListener("click", function () {
          var r = parseInt(b.getAttribute("data-range"), 10);
          store("rb:fx:range", r === 365 ? "1y" : "90d");
          app.querySelectorAll(".fx-tools:not(.fuel-tools) button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          fxc.setAttribute("data-range", r);
          fxc.innerHTML = lineChart(FX.series, { W: fxc.clientWidth, days: r, avg: FX.avg, avgLabel: "1y avg ", hi: FX.hi30, lo: FX.lo30, hiLabel: "30d high", loLabel: "30d low", dec: 4, label: "USD/EUR, euros per dollar" });
        });
      });
    }

    /* pump-price range toggle */
    var fuc2 = document.getElementById("fuelchart");
    if (fuc2 && FU) {
      app.querySelectorAll(".fuel-tools button").forEach(function (b) {
        b.addEventListener("click", function () {
          var r = parseInt(b.getAttribute("data-range"), 10);
          store("rb:fuel:range", r === 365 ? "1y" : "90d");
          app.querySelectorAll(".fuel-tools button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          fuc2.setAttribute("data-range", r); fuc2.innerHTML = fuelChart(r, fuc2.clientWidth);
        });
      });
    }

    /* scroll containers get a right-edge fade */
    function fades() { app.querySelectorAll(".tw, .scrollx").forEach(function (t) { t.classList.toggle("scroll", t.scrollWidth - t.clientWidth - t.scrollLeft > 4); }); }
    if (ctx._appScroll) app.removeEventListener("scroll", ctx._appScroll, true);
    ctx._appScroll = function (e) { var t = e.target; if (t && t.classList && (t.classList.contains("tw") || t.classList.contains("scrollx"))) fades(); };
    app.addEventListener("scroll", ctx._appScroll, true);
    bindWin("fades", "resize", fades);

    /* calendar: month navigation and filter chips */
    var calState = { y: today.getFullYear(), m: today.getMonth(), f: "all" }, calBody = document.getElementById("calbody"), calTitle = document.getElementById("caltitle");
    function calFilter(cat) { var f = calState.f; return f === "all" || (f === "ev" ? (cat === "mkt" || cat === "pro") : f === "homed" ? (cat === "home" || cat === "deadline") : f === "teams" ? (cat === "hockey" || cat === "nfl") : cat === f); }
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
          (Array.isArray(ed.research) ? ed.research : (ed.research ? [ed.research] : [])).forEach(function (r) { add(r.title, "research", "Research"); });
          if (ed.philosophy) add(ed.philosophy.thinker + ": " + (ed.philosophy.work || ""), "philosophy", "Philosophy");
        });
        out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
        if (!viaIndex) {} 
        hits.innerHTML = out.length ? '<ul class="hits">' + out.slice(0, 60).map(function (x) { return '<li><span class="d">' + esc(fmtShort(x.date) + " " + x.date.slice(0, 4)) + '</span><span><a href="#ed-' + esc(x.date) + "/" + esc(x.to) + '">' + esc(plain(x.t)) + '</a><span class="w">' + esc(x.where) + "</span></span></li>"; }).join("") + "</ul>" + (out.length > 60 ? '<p class="small">Showing 60 of ' + out.length + " hits.</p>" : "") : quiet("No headline matches “" + q + "” in " + eds.length + (eds.length === 1 ? " edition." : " editions."));
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
      if (ctx._track) ctx._track();
    }
    totop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
    bindWin("scroll", "scroll", onScroll, { passive: true });
    onScroll();
    document.title = "Nick's Daily Readbook · " + fmt(today);
    var m = location.hash.match(/^#ed-(\d{4}-\d{2}-\d{2})(?:\/([\w-]+))?$/);
    var target = m ? m[2] : location.hash.slice(1);
    jumpTo(target);
    /* prune contents links whose section is not in this edition */
    app.querySelectorAll(".toc .secs a").forEach(function (a) { if (!document.getElementById(a.getAttribute("href").slice(1))) { var nx = a.nextSibling; if (nx && nx.nodeType === 3) nx.parentNode.removeChild(nx); else if (a.previousSibling && a.previousSibling.nodeType === 3) a.parentNode.removeChild(a.previousSibling); a.parentNode.removeChild(a); } });
  }
  function jumpTo(target) { if (!target) return false; var t = document.getElementById(target); if (!t) return false; var det = t.closest("details"); if (det && !det.open) det.open = true; try { t.scrollIntoView({ behavior: "instant", block: "start" }); } catch (err) { t.scrollIntoView(); } return true; }

  /* ---------- boot ---------- */
  var allEditions = null;
  function loadAllEditions(ctx) {
    if (allEditions) return allEditions;
    allEditions = Promise.all((ctx.index.editions || []).map(function (e) { return getJSON("data/editions/" + e.date + ".json").then(function (ed) { ed.date = ed.date || e.date; ed.edition = ed.edition || e.edition; return ed; }).catch(function () { return null; }); })).then(function (list) { return list.filter(Boolean); });
    return allEditions;
  }
  function load(date) {
    var target = date || ctx.index.latest;
    var p = ctx._pre && ctx._pre.date === target ? ctx._pre.p : getJSON("data/editions/" + target + ".json");
    ctx._pre = null;
    return p.then(function (E) { render(E, ctx); ctx._cur = E.date; if (!location.hash || /^#ed-\d{4}-\d{2}-\d{2}$/.test(location.hash)) window.scrollTo(0, 0); })
      .catch(function (e) { if (date && date !== ctx.index.latest) { history.replaceState(null, "", location.pathname + location.search); return load(null); } throw e; });
  }
  function fail(e) { if (window.console && console.error) console.error(e && e.stack || e); app.innerHTML = '<div class="err"><b>Couldn\'t load the Readbook.</b><br>' + esc(e.message || e) + "<br>Check your connection and pull down to refresh.</div>"; }
  function opt(url) { return getJSON(url).catch(function () { return null; }); }
  Promise.all([
    getJSON("data/index.json").then(function (i) { var m = location.hash.match(/^#ed-(\d{4}-\d{2}-\d{2})/), d = m && (i.editions || []).some(function (e) { return e.date === m[1]; }) ? m[1] : i.latest; if (m && d !== m[1]) history.replaceState(null, "", location.pathname + location.search); ctx._pre = { date: d, p: getJSON("data/editions/" + d + ".json") }; ctx._pre.p.catch(function () {}); return i; }),
    opt("data/incidents.json"), opt("data/bins.json"), opt("data/threads.json"), opt("data/horizon.json"),
    opt("data/fx.json"), opt("data/series.json"), opt("data/canes.json"),
    opt("data/conflicts.json"), opt("data/world-series.json"), opt("data/calendar.json"), opt("data/deadlines.json"),
    opt("data/congress.json"), opt("data/exercises.json"), opt("data/releases.json"), opt("data/events.json"), opt("data/idioms.json"), opt("data/ski.json"), opt("data/search-index.json"), opt("data/land.json"), opt("data/week.json"), opt("data/corrections.json"), opt("data/research.json"), opt("data/teams.json"), opt("data/tv.json"), opt("data/countries.json"), opt("data/ceu.json"), opt("data/novel.json"), opt("data/indicators.json"), opt("data/forecasts.json"), opt("data/questions.json"), opt("data/ua-front.json"), opt("data/philosophy.json"), opt("data/inbox.json"), opt("data/fuel.json"), opt("data/energy.json"), opt("data/local.json")
  ]).then(function (r) {
    ctx.fuel = r[34] && r[34].series ? r[34] : null; ctx.energy = r[35]; ctx.local = r[36];
    ctx.novel = r[27]; ctx.indicators = r[28]; ctx.forecasts = r[29]; ctx.questions = r[30]; ctx.uaFront = r[31]; ctx.philosophy = r[32]; ctx.inbox = r[33];
    ctx.ceu = r[26] && r[26].countries; ctx.countriesMap = r[25] && r[25].map;
    ctx.week = r[20]; ctx.corrections = r[21]; ctx.research = r[22]; ctx.teams = r[23]; ctx.tv = r[24];
    ctx.countries = r[25] && r[25].countries; ctx.countriesBLR = r[25] && r[25].blr; ctx.countriesUpdated = r[25] && r[25].updated;
    ctx.fetchedAt = Date.now();
    ctx.congress = r[12] && r[12].items; ctx.congressWatch = r[12] && r[12].watch; ctx.congressTiers = r[12] && r[12].tiers; ctx.exercises = r[13] && r[13].exercises; ctx.releases = r[14]; ctx.events = r[15] && r[15].events; ctx.idioms = r[16] && r[16].idioms; ctx.ski = r[17]; ctx.searchIndex = r[18]; ctx.land = r[19] && r[19].rings;
    ctx.index = r[0]; ctx.incidents = r[1] && r[1].incidents; ctx.attrLog = r[1] && r[1].attrLog; ctx.bins = r[2];
    ctx.threads = r[3] && r[3].threads; ctx.horizon = r[4] && r[4].events;
    ctx.fx = r[5] && r[5].series && r[5].series.length ? r[5] : null; ctx.series = r[6]; ctx.canes = r[7];
    ctx.conflicts = r[8] && r[8].theatres; ctx.worldSeries = r[9]; ctx.calendar = r[10]; ctx.deadlines = r[11];
    var m = location.hash.match(/^#ed-(\d{4}-\d{2}-\d{2})/);
    return load(m ? m[1] : null);
  }).catch(fail);
  window.addEventListener("hashchange", function () { var id = location.hash.slice(1); if (/^s\d+$/.test(id)) jumpTo(id); });
  window.addEventListener("hashchange", function () { var m = location.hash.match(/^#ed-(\d{4}-\d{2}-\d{2})(?:\/([\w-]+))?$/); if (!m || !ctx.index) return; if (m[1] === ctx._cur) { if (m[2]) jumpTo(m[2]); return; } load(m[1]).catch(fail); });

  if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); }); }
})();
