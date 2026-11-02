/* Nick's Daily Readbook v2.5 renderer.
   Reads data/index.json, then data/editions/<date>.json, plus data/incidents.json and data/bins.json.
   All content lives in the JSON files; this file only draws it. */
(function () {
  "use strict";
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var CAT = { nl:["Netherlands","--c-nl"], be:["Belgium","--c-be"], de:["Germany","--c-de"], us:["US / AFNORTH","--c-us"], mkt:["Markets & events","--c-mkt"], pro:["Work & world","--c-pro"] };
  var CODE_COLORS = { CYB:"--c-us", SAB:"--crit", UAS:"--c-mkt", UWI:"--c-pro", GNSS:"--c-be", INF:"--c-nl", ELX:"--c-nl", MIG:"--c-de", PRX:"--warn", AIR:"--c-de", SEA:"--c-pro", COE:"--c-be", KIN:"--crit" };
  var app = document.getElementById("app");

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]; }); }
  function rich(s) {
    var h = esc(s);
    h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, "$1<i>$2</i>");
    h = h.replace(/\s?\[(\d+(?:\s*,\s*\d+)*)\]/g, function (_, list) {
      return '<sup class="r">' + list.split(/\s*,\s*/).map(function (n) { return '<a href="#s' + n + '">' + n + "</a>"; }).join("") + "</sup>";
    });
    return h;
  }
  function cite(n) { return n ? '<sup class="r"><a href="#s' + n + '">' + n + "</a></sup>" : ""; }
  function pd(s) { var a = s.split("-").map(Number); return new Date(a[0], a[1] - 1, a[2]); }
  function key(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function fmt(d) { return DOW[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()]; }
  function badge(b) { if (!b) return ""; return '<span class="badge' + (b === "UPDATED" ? " upd" : "") + '">' + esc(b) + "</span>"; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function quiet(t) { return '<p class="quiet">' + esc(t || "No significant change today.") + "</p>"; }
  function getJSON(url) { return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); }); }

  function item(it, opts) {
    opts = opts || {};
    var h = '<div class="item">';
    h += "<h4>" + rich(it.h) + badge(it.badge) + (opts.inlineTag && it.tag ? ' <span class="tag">' + esc(it.tag) + "</span>" : "") + "</h4>";
    if (!opts.inlineTag && (it.tag || it.conf)) h += "<div>" + (it.tag ? '<span class="tag">' + esc(it.tag) + "</span>" : "") + (it.conf ? '<span class="conf">confidence: ' + esc(it.conf) + "</span>" : "") + "</div>";
    if (it.body) h += "<p>" + rich(it.body) + "</p>";
    if (it.sw) h += '<p class="sw-line"><b class="l">So what</b>' + rich(it.sw) + "</p>";
    if (it.fy) h += '<p class="sw-line"><b class="l">For you</b>' + rich(it.fy) + "</p>";
    return h + "</div>";
  }
  function items(list, opts, q) { return list && list.length ? list.map(function (i) { return item(i, opts); }).join("") : quiet(q); }
  function part(cls, n, title, desc, id) {
    return '<div class="part ' + cls + '" id="' + id + '" data-part="' + esc(title) + '"><span class="pn">' + esc(n) + '</span><span class="pt">' + esc(title) + '</span>' + (desc ? '<span class="pd">' + esc(desc) + "</span>" : "") + "</div>";
  }

  /* ---------- gantt ---------- */
  function gantt(g, today) {
    var from = pd(g.from), to = pd(g.to), span = (to - from) / 864e5;
    function pct(d) { return ((d - from) / 864e5) / span * 100; }
    var h = '<div class="g-axis"><div></div><div class="ticks">';
    (g.ticks || []).forEach(function (t) { var d = pd(t); h += '<span style="left:' + pct(d) + '%">' + d.getDate() + " " + MON[d.getMonth()] + "</span>"; });
    h += "</div></div>";
    var xmas = new Date(from.getFullYear(), 11, 25);
    g.rows.forEach(function (r) {
      h += '<div class="g-row"><div class="g-name">' + esc(r.name) + (r.sub ? "<small>" + esc(r.sub) + "</small>" : "") + '</div><div class="g-track">';
      r.segs.forEach(function (s) {
        var a = pd(s[0]), b = pd(s[1]), w = Math.max(0.8, pct(new Date(+b + 864e5)) - pct(a));
        h += '<div class="g-bar" title="' + esc(r.name + ": " + fmt(a) + " – " + fmt(b)) + '" style="left:' + pct(a) + "%;width:" + w + "%;background:var(" + CAT[r.color][1] + ')"></div>';
      });
      if (today >= from && today <= to) h += '<div class="g-today" style="left:' + pct(today) + '%"></div>';
      if (xmas >= from && xmas <= to) h += '<div class="g-xmas" style="left:' + pct(xmas) + '%"></div>';
      h += "</div></div>";
    });
    return '<div class="gantt">' + h + "</div>";
  }

  /* ---------- hybrid visuals from the running incident log ---------- */
  function incidentMap(list) {
    var W = 360, H = 240, lon0 = -4, lon1 = 32, lat0 = 46, lat1 = 61;
    function X(lon) { return (lon - lon0) / (lon1 - lon0) * W; }
    function Y(lat) { return H - (lat - lat0) / (lat1 - lat0) * H; }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Schematic map of incidents in the last 30 days">';
    for (var lo = 0; lo <= 30; lo += 10) s += '<line x1="' + X(lo) + '" y1="0" x2="' + X(lo) + '" y2="' + H + '" stroke="var(--line)" stroke-width="1"/>';
    for (var la = 48; la <= 60; la += 4) s += '<line x1="0" y1="' + Y(la) + '" x2="' + W + '" y2="' + Y(la) + '" stroke="var(--line)" stroke-width="1"/>';
    var labels = [["NL",52.4,5.4],["BE",50.6,4.4],["LU",49.7,6.1],["DE",51.2,10.3],["PL",52.0,19.4],["CZ",49.8,15.5],["DK",56.1,9.3],["SE",59.3,15.2],["FI",60.6,25.5],["EE",58.7,25.8],["LV",56.9,24.9],["LT",55.4,23.9],["RU",54.6,21.0],["BY",53.6,28.0],["UA",49.2,30.5],["FR",47.6,2.4],["UK",52.6,-1.5],["AT",47.5,14.2]];
    labels.forEach(function (l) { s += '<text x="' + X(l[2]) + '" y="' + Y(l[1]) + '" font-size="10" font-family="var(--f-mono)" fill="var(--muted)" text-anchor="middle">' + l[0] + "</text>"; });
    var hx = X(5.98), hy = Y(50.89);
    s += '<circle cx="' + hx + '" cy="' + hy + '" r="14.3" fill="none" stroke="var(--crit)" stroke-dasharray="3 3"/>';
    s += '<rect x="' + (hx - 3) + '" y="' + (hy - 3) + '" width="6" height="6" fill="var(--ink)" transform="rotate(45 ' + hx + " " + hy + ')"/>';
    var groups = {};
    list.forEach(function (i) { if (i.lat == null) return; var k = i.lat.toFixed(1) + "," + i.lon.toFixed(1); (groups[k] = groups[k] || { lat: i.lat, lon: i.lon, n: 0, codes: [] }); groups[k].n++; groups[k].codes.push(i.code); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k]; if (g.lon < lon0 || g.lon > lon1 || g.lat < lat0 || g.lat > lat1) return;
      var c = CODE_COLORS[g.codes[0]] || "--crit";
      s += '<circle cx="' + X(g.lon) + '" cy="' + Y(g.lat) + '" r="' + (4 + 3 * Math.sqrt(g.n)) + '" fill="var(' + c + ')" fill-opacity=".75" stroke="var(--surface)" stroke-width="1.5"><title>' + esc(g.codes.join(", ")) + "</title></circle>";
    });
    s += '<text x="' + (hx + 18) + '" y="' + (hy + 4) + '" font-size="10" fill="var(--ink)">Heerlen · 100 km</text>';
    return s + "</svg>";
  }
  function incidentTrend(list, endDate) {
    var days = [], byCode = {}, i;
    for (i = 29; i >= 0; i--) { var d = new Date(endDate); d.setDate(d.getDate() - i); days.push({ k: key(d), n: 0 }); }
    var idx = {}; days.forEach(function (d, j) { idx[d.k] = j; });
    list.forEach(function (x) { if (idx[x.date] != null) { days[idx[x.date]].n++; byCode[x.code] = (byCode[x.code] || 0) + 1; } });
    var max = Math.max(1, Math.max.apply(null, days.map(function (d) { return d.n; })));
    var W = 360, H = 90, bw = W / 30;
    var s = '<svg viewBox="0 0 ' + W + " " + (H + 16) + '" role="img" aria-label="Incidents per day, last 30 days">';
    s += '<line x1="0" y1="' + H + '" x2="' + W + '" y2="' + H + '" stroke="var(--line)"/>';
    days.forEach(function (d, j) { var h = d.n / max * (H - 8); if (d.n) s += '<rect x="' + (j * bw + 1) + '" y="' + (H - h) + '" width="' + (bw - 2) + '" height="' + h + '" fill="var(--pc)"><title>' + d.k + ": " + d.n + "</title></rect>"; });
    s += '<text x="0" y="' + (H + 13) + '" font-size="10" fill="var(--muted)" font-family="var(--f-mono)">' + days[0].k.slice(5) + '</text><text x="' + W + '" y="' + (H + 13) + '" font-size="10" fill="var(--muted)" font-family="var(--f-mono)" text-anchor="end">' + days[29].k.slice(5) + '</text><text x="' + W + '" y="10" font-size="10" fill="var(--muted)" font-family="var(--f-mono)" text-anchor="end">max ' + max + "/day</text></svg>";
    var codes = Object.keys(byCode).sort(function (a, b) { return byCode[b] - byCode[a]; });
    var cm = codes.length ? byCode[codes[0]] : 1;
    s += '<div class="hbars" style="border:0;padding:8px 0 0">' + (codes.length ? codes.map(function (c) { return '<div class="hbar"><span class="mono">' + esc(c) + '</span><span class="t"><i style="width:' + (byCode[c] / cm * 100) + '%"></i></span><span class="v">' + byCode[c] + "</span></div>"; }).join("") : '<p class="quiet">No incidents logged yet.</p>') + "</div>";
    return s;
  }

  var ICON = {
    rising: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2 L13 11 L1 11 Z" fill="currentColor"/></svg>',
    falling: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 12 L13 3 L1 3 Z" fill="currentColor"/></svg>',
    steady: '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="5.5" width="12" height="3" fill="currentColor"/></svg>',
    watch: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="7" r="1.8" fill="currentColor"/></svg>',
    nodata: '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/></svg>'
  };
  var STLBL = { rising: "Rising", falling: "Falling", steady: "Steady", watch: "Watch", nodata: "No data" };

  /* ---------- main render ---------- */
  function render(E, ctx) {
    var today = pd(E.date), h = "";
    var T = E.today || {};

    /* masthead */
    h += '<header class="mast"><div class="eyebrow">' + esc(E.place || "Hoensbroek · Parkstad Limburg") + "</div><h1>Nick's Daily Readbook</h1>";
    h += '<div class="mast-meta"><span><b>' + esc(E.weekday + " " + today.getDate() + " " + MON[today.getMonth()] + " " + today.getFullYear()) + "</b></span><span>Look-back " + esc(E.lookback) + "</span><span>Edition " + esc(E.edition) + '</span><span id="readtime"></span></div>';
    if (E.note) h += '<p class="note">' + rich(E.note) + "</p>";
    h += "</header>";

    /* slim header */
    h += '<div class="slim" id="slim"><div class="slim-row"><span class="cur" id="cur">Front</span>' +
      '<a class="front" href="#front">Front</a><a class="sec" href="#p-sec">Security</a><a class="pro" href="#p-pro">Profession</a><a class="money" href="#p-money">Money</a><a class="home" href="#p-home">Home</a><a class="hockey" href="#p-hockey">Hockey</a><a class="plan" href="#p-plan">Planner</a><a href="#sources">Sources</a>' +
      '</div><div class="prog"><i id="prog"></i></div></div>';

    /* today strip */
    h += '<div class="strip" id="front" data-part="Front">';
    if (T.weather) { var w = T.weather; h += '<div class="tile"><div class="lbl">Weather · Hoensbroek</div><div class="val">' + esc(w.hi) + "° / " + esc(w.lo) + "°</div><p>" + esc(w.now) + ". " + esc(w.tomorrow) + ". Sun " + esc(w.sunrise) + "–" + esc(w.sunset) + "." + cite(w.src) + "</p></div>"; }
    if (T.canes) h += '<div class="tile hockey"><div class="lbl">Hurricanes</div><div class="val">' + esc(T.canes.line) + "</div><p>" + esc(T.canes.sub) + cite(T.canes.src) + "</p></div>";
    if (T.markets) h += '<div class="tile"><div class="lbl">Markets</div><div class="mini-mk">' + T.markets.map(function (m) { return "<span>" + esc(m[0]) + '</span><span class="chg ' + esc(m[2]) + '">' + esc(m[1]) + "</span>"; }).join("") + "</div></div>";
    h += '<div class="tile" id="bins"><div class="lbl">Bin day</div><div class="val">…</div><p></p></div>';
    h += "</div>";

    /* front: five things, pick, today and tomorrow */
    h += '<section class="front"><h2>Five things</h2><ol class="five">';
    (E.five || []).forEach(function (f) { h += '<li class="' + esc(f.part) + '">' + rich(f.t) + ' <a class="go" href="#' + esc(f.to) + '">Read →</a></li>'; });
    h += "</ol>";
    if (E.pick) h += '<div class="pick">' + rich(E.pick.t) + (E.pick.to ? ' <a href="#' + esc(E.pick.to) + '">Go →</a>' : "") + "</div>";
    if (T.items && T.items.length) {
      h += '<h3>Today and tomorrow</h3><div class="tt">';
      T.items.forEach(function (t) { h += '<div><span class="k" style="--kc:var(' + (CAT[t.cat] ? CAT[t.cat][1] : "--muted") + ')">' + esc(t.k) + "</span><p>" + rich(t.t) + "</p></div>"; });
      h += "</div>";
    }
    h += "</section>";

    /* ===== Security ===== */
    var HY = E.hybrid || {};
    h += part("sec", "Part 1", "Security", "Hybrid activity, Europe, the wider world and the Euregio.", "p-sec");
    h += '<section id="hybrid" class="sec"><h2>Hybrid watch</h2><h3>Incident log</h3>';
    if (HY.incidents && HY.incidents.length) {
      h += '<div class="incidents">';
      HY.incidents.forEach(function (i) {
        h += '<article class="inc"><div class="inc-top"><span class="when">' + esc(i.when) + '</span><span class="chip code">' + esc(i.code) + "</span>" + (i.local ? '<span class="chip local">LOCAL</span>' : "") + '<span class="chip ' + esc((i.attr || "").toLowerCase()) + '">' + esc(i.attr) + "</span>" + badge(i.badge) + '</div><div class="place">' + esc(i.place) + "</div><p>" + rich(i.text) + "</p></article>";
      });
      h += "</div>";
      var counts = [0, 0, 0, 0, 0, 0];
      HY.incidents.forEach(function (i) { var n = parseInt(String(i.attr).replace("A", ""), 10); if (!isNaN(n)) counts[n]++; });
      var names = ["unexplained", "suspected", "named", "attributed", "charged", "convicted"];
      h += '<div class="ladder" role="img" aria-label="Incidents by attribution level">' + counts.map(function (c, n) { return '<div class="rung ' + (c ? "hot" : "zero") + '"><b>A' + n + "</b><span>" + c + "</span><small>" + names[n] + "</small></div>"; }).join("") + "</div>";
    } else h += quiet("No new incidents in the window.");
    h += '<div class="viz"><div class="panel"><div class="lbl">Running log · last 30 days</div><div id="map"></div></div><div class="panel"><div class="lbl">Per day and by type</div><div id="trend"></div></div></div>';
    h += '<p class="small" id="logsrc"></p>';
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
      h += '<div class="regions">' + Object.keys(rc).map(function (r) { return "<span>" + esc(r) + "<b>" + rc[r] + "</b></span>"; }).join("") + '</div><div class="world">';
      WO.forEach(function (x) {
        h += '<article class="wcard"><div class="wtop"><span class="tag rg">' + esc(x.region) + "</span>" + (x.conf ? '<span class="conf">confidence: ' + esc(x.conf) + "</span>" : "") + badge(x.badge) + "</div><h4>" + rich(x.h) + "</h4><p>" + rich(x.body) + "</p>" + (x.sw ? '<p class="sw-line"><b class="l">So what</b>' + rich(x.sw) + "</p>" : "") + "</article>";
      });
      h += "</div>";
    } else h += quiet();
    h += "</section>";
    if (E.euregio && E.euregio.length) h += '<section id="euregio" class="sec"><h2>Local &amp; Euregio</h2>' + items(E.euregio) + "</section>";

    /* ===== Profession ===== */
    var AR = E.army || {}, AP = E.aperture || {};
    h += part("pro", "Part 2", "Profession", "The Army as an institution, and the thinking pieces.", "p-pro");
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
      if (D.table) h += '<div class="tw"><table><thead><tr>' + D.table.head.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" + D.table.rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + rich(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
      h += "</div></details>";
    }
    if (AP.longread) h += '<div class="ap-c"><div class="lbl">Long read</div><p><a href="' + esc(AP.longread.url) + '" target="_blank" rel="noopener">' + esc(AP.longread.title) + "</a> · " + esc(AP.longread.outlet) + "</p><p>" + rich(AP.longread.why) + "</p></div>";
    var ROT = [["mon","Mon","Historical echo"],["tue","Tue","Outside-in"],["wed","Wed","Red lens"],["thu","Thu","Concept"],["fri","Fri","Ally spotlight + week in hybrid"],["sat","Sat","Week in war: TTPs"],["sun","Sun","Week in defence tech"]];
    h += '<div class="ap-c"><div class="lbl">Deep cuts and special topics</div><div class="rota">' + ROT.map(function (r) { return '<div class="' + (r[0] === AP.rota ? "on " : "") + (r[0] === "sat" || r[0] === "sun" ? "sp" : "") + '"><b>' + r[1] + "</b>" + r[2] + "</div>"; }).join("") + "</div></div>";
    h += "</div></section>";

    /* ===== Money ===== */
    var M = E.money || {};
    h += part("money", "Part 3", "Money", "Last session's markets and the numbers that move prices, pay and rates.", "p-money");
    h += '<section id="markets" class="money"><h2>Markets &amp; economy <span class="num">' + esc(M.asof || "") + "</span></h2>";
    if (M.cards) h += '<div class="cards">' + M.cards.map(function (c) { var arrow = c[3] === "up" ? "▲ " : c[3] === "down" ? "▼ " : ""; return '<div class="card"><div class="lbl">' + esc(c[0]) + '</div><div class="val">' + esc(c[1]) + '</div><p><span class="chg ' + esc(c[3]) + '">' + (c[2] ? arrow + esc(c[2]) : "") + "</span> " + esc(c[4]) + cite(c[5]) + "</p></div>"; }).join("") + "</div>";
    if (M.driver) h += "<p>" + rich(M.driver) + "</p>";
    if (M.ytd) {
      var mx = Math.max.apply(null, M.ytd.map(function (y) { return Math.abs(y[1]); })) * 1.15;
      h += '<h3>Year to date</h3><div class="hbars">' + M.ytd.map(function (y) { return '<div class="hbar"><span>' + esc(y[0]) + '</span><span class="t"><i style="width:' + (Math.abs(y[1]) / mx * 100) + '%"></i></span><span class="v">' + (y[1] >= 0 ? "+" : "") + y[1].toFixed(1) + "%</span></div>"; }).join("") + '<p class="small" style="margin:2px 0 0">Change since 1 January at the last close.' + cite(M.ytdSrc) + "</p></div>";
    }
    if (M.rates) h += '<h3>Rates and prices</h3><div class="tw"><table><thead><tr><th>Measure</th><th>Latest</th><th>Note</th></tr></thead><tbody>' + M.rates.map(function (r) { return "<tr><td>" + esc(r[0]) + '</td><td class="d">' + esc(r[1]) + "</td><td>" + rich(r[2]) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    if (M.fuel) {
      var F = M.fuel, minP = Math.min.apply(null, F.rows.map(function (r) { return r[1]; })), minD = Math.min.apply(null, F.rows.map(function (r) { return r[2]; }));
      h += '<h3>Fuel across the borders <span class="small">' + esc(F.asof) + "</span></h3>";
      h += '<div class="tw"><table><thead><tr><th>Country</th><th>Euro 95 €/l</th><th>Diesel €/l</th></tr></thead><tbody>' + F.rows.map(function (r) { return "<tr><td>" + esc(r[0]) + '</td><td class="d"' + (r[1] === minP ? ' style="color:var(--up);font-weight:700"' : "") + ">" + r[1].toFixed(3) + '</td><td class="d"' + (r[2] === minD ? ' style="color:var(--up);font-weight:700"' : "") + ">" + r[2].toFixed(3) + "</td></tr>"; }).join("") + "</tbody></table></div>";
      h += '<p class="small" style="margin-top:6px">' + rich(F.note) + cite(F.src) + (F.weekly ? " Updated " + esc(F.weekly) + "." : "") + "</p>";
    }
    if (M.week) h += '<h3>Week ahead</h3><ul class="clean">' + M.week.map(function (x) { return "<li>" + rich(x) + "</li>"; }).join("") + "</ul>";
    if (M.fy) h += '<p class="sw-line" style="margin-top:12px"><b class="l">For you</b>' + rich(M.fy) + "</p>";
    h += "</section>";

    /* ===== Home ===== */
    var NL = E.nl || {}, AF = E.afnorth || {}, OD = E.offduty || {};
    h += part("home", "Part 4", "Home", "The Netherlands, the family, weekends and the Dutch corner.", "p-home");
    h += '<section id="nl" class="home"><h2>Netherlands</h2>' + items(NL.items);
    if (NL.temp) h += '<p class="small"><b>Political temperature:</b> ' + rich(NL.temp) + "</p>";
    h += "</section>";
    h += '<section id="afnorth" class="home"><h2>AFNORTH &amp; family</h2>';
    if (AF.intro) h += '<p class="small">' + rich(AF.intro) + "</p>";
    if (AF.rows && AF.rows.length) h += '<div class="tw"><table><thead><tr><th>Date</th><th>Event</th><th>Action</th></tr></thead><tbody>' + AF.rows.map(function (r) { return '<tr class="' + (r[3] === "soon" ? "soon" : "") + '"><td class="d">' + esc(r[0]) + "</td><td>" + rich(r[1]) + "</td><td>" + rich(r[2]) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    else h += quiet("Nothing new in the next 14 days.");
    if (AF.note) h += '<p class="small" style="margin-top:8px">' + rich(AF.note) + "</p>";
    h += "</section>";
    h += '<section id="offduty" class="home"><h2>Off duty <span class="num">1-hour radius</span></h2>' + items(OD.items, { inlineTag: true }, "Nothing new worth the drive today.");
    if (OD.weekend) {
      h += '<h3>Weekend guide</h3><div class="tw"><table><thead><tr><th>Day</th><th>Event</th><th>Place</th><th>Why go</th><th>Cost / booking</th></tr></thead><tbody>' + OD.weekend.rows.map(function (r) { return "<tr>" + r.map(function (c, j) { return "<td" + (j === 0 ? ' class="d"' : "") + ">" + rich(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
      if (OD.weekend.gem) h += '<p class="sw-line" style="margin-top:10px"><b class="l">Hidden gem</b>' + rich(OD.weekend.gem) + "</p>";
      if (OD.weekend.family) h += '<p class="sw-line"><b class="l">Family pick</b>' + rich(OD.weekend.family) + "</p>";
    }
    if (OD.weather) h += '<p class="small">' + rich(OD.weather) + "</p>";
    h += "</section>";
    h += '<section id="dutch" class="home"><h2>Dutch corner</h2>';
    if (NL.lees) h += '<div class="lees"><div class="lbl" style="font-family:var(--f-display);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:13px;color:var(--pc);margin-bottom:6px">Lees mee</div><blockquote lang="nl">' + rich(NL.lees.nl) + cite(NL.lees.src) + "</blockquote><dl>" + NL.lees.gloss.map(function (g) { return '<dt lang="nl">' + esc(g[0]) + "</dt><dd>" + rich(g[1]) + "</dd>"; }).join("") + "</dl></div>";
    if (NL.phrase) h += '<div class="nl-word"><div class="w" lang="nl">' + esc(NL.phrase.w) + '</div><p class="small" style="margin:2px 0 10px">“' + esc(NL.phrase.en) + "” · " + esc(NL.phrase.lvl) + "</p><p>" + rich(NL.phrase.note) + "</p></div>";
    h += "</section>";

    /* ===== Hockey ===== */
    var HK = E.hockey || {};
    h += part("hockey", "Part 5", "Hockey", "Carolina first, then the league.", "p-hockey");
    h += '<section id="hockey" class="hockey"><h2>Hurricanes</h2>';
    if (HK.canes) {
      var C = HK.canes, R = C.result;
      h += '<div class="canes">';
      if (R) {
        var carHome = R.home === "CAR", cs = carHome ? R.hs : R.as, os = carHome ? R.as : R.hs, opp = carHome ? R.away : R.home, win = cs > os;
        h += '<div class="score"><span class="wl' + (win ? "" : " l") + '">' + (win ? "W" : (R.ot ? "OTL" : "L")) + '</span><span class="sc">CAR ' + cs + " – " + os + " " + esc(opp) + '</span><span class="meta">' + esc(R.date) + " · " + (carHome ? "home" : "away") + " · " + esc(R.venue || "") + cite(R.src) + "</span></div>";
        if (R.lines) h += '<ul class="clean">' + R.lines.map(function (l) { return "<li>" + rich(l) + "</li>"; }).join("") + "</ul>";
      } else if (C.noGame) h += "<p>" + rich(C.noGame) + "</p>";
      if (C.record) h += '<p class="small" style="margin:0"><b>Record:</b> ' + esc(C.record) + "</p>";
      if (C.next && C.next.length) h += '<div class="tw"><table><thead><tr><th>Next</th><th>Opponent</th><th>Puck drop here</th></tr></thead><tbody>' + C.next.map(function (n) { return '<tr><td class="d">' + esc(n[0]) + "</td><td>" + esc(n[1]) + '</td><td class="d">' + esc(n[3]) + '<div class="small">' + esc(n[2]) + "</div>" + (n[4] ? '<span class="badge" style="margin-left:0">WATCH LIVE</span>' : "") + "</td></tr>"; }).join("") + '</tbody></table></div><p class="small" style="margin:0">Schedule' + cite(C.nextSrc) + "</p>";
      h += "</div>";
    }
    h += '<h3>Scores · ' + esc(HK.scoresDate || "") + "</h3>";
    if (HK.scores && HK.scores.length) {
      h += '<div class="scores">' + HK.scores.map(function (g) {
        var pend = g[4] === "pending", aw = g[1] > g[3];
        return '<div class="gm' + (g[0] === "CAR" || g[2] === "CAR" ? " car" : "") + '"><b class="' + (pend ? "" : aw ? "w" : "lo") + '">' + esc(g[0]) + '</b><span>' + (pend ? "–" : esc(g[1])) + '</span><b class="' + (pend ? "" : aw ? "lo" : "w") + '">' + esc(g[2]) + "</b><span>" + (pend ? "–" : esc(g[3])) + (g[4] && !pend ? " " + esc(g[4]) : "") + "</span>" + (pend ? '<span class="pend">final after press time</span>' : "") + "</div>";
      }).join("") + "</div>";
      if (HK.scoresNote) h += '<p class="small" style="margin-top:6px">' + rich(HK.scoresNote) + cite(HK.scoresSrc) + "</p>";
    } else h += quiet("No NHL games last night.");
    h += "<h3>Top NHL news</h3>" + items(HK.news) + "</section>";

    /* ===== Planner ===== */
    var P = E.planner || {};
    var plOpen = store("rb:open:planner"); plOpen = plOpen == null ? !!P.open : plOpen === "1";
    h += '<details class="planner plan" data-k="planner"' + (plOpen ? " open" : "") + '><summary>' + part("plan", "Part 6", "Planner", "Threads, horizon, calendar, school holidays and the seasonal planner. Tap to " + (plOpen ? "fold" : "open") + ".", "p-plan") + "</summary>";
    h += '<section id="threads" class="plan"><h2>Tracked threads</h2>';
    h += P.threads && P.threads.length ? '<div class="tw"><table><thead><tr><th>Thread</th><th>What moved</th></tr></thead><tbody>' + P.threads.map(function (t) { return "<tr><td>" + esc(t[0]) + badge(t[2]) + "</td><td>" + rich(t[1]) + "</td></tr>"; }).join("") + "</tbody></table></div>" : quiet();
    h += "</section>";
    h += '<section id="horizon" class="plan"><h2>Horizon</h2><p class="small">Filled marker = hybrid-relevant.</p>';
    var lastG = null;
    (P.horizon || []).forEach(function (x) {
      if (x.g !== lastG) { if (lastG !== null) h += "</div>"; h += '<div class="tl-group">' + esc(x.g) + '</div><div class="tl">'; lastG = x.g; }
      h += '<div class="tl-i' + (x.h ? " h" : "") + '"><div class="d">' + esc(x.d) + "</div><h4>" + esc(x.t) + badge(x.badge) + "</h4><p>" + rich(x.n) + "</p></div>";
    });
    if (lastG !== null) h += "</div>";
    h += "</section>";
    h += '<section id="calendar" class="plan"><h2>Calendar &amp; culture</h2>';
    if (P.otd) h += '<div class="ap-c" style="margin-bottom:14px"><div class="lbl">' + esc(P.otd.title) + '</div><p style="margin:0">' + rich(P.otd.body) + "</p></div>";
    if (P.events) {
      var from = pd(P.calFrom), to = pd(P.calTo);
      h += '<div class="legend">' + Object.keys(CAT).map(function (k) { return '<span><i style="background:var(' + CAT[k][1] + ')"></i>' + esc(CAT[k][0]) + "</span>"; }).join("") + '</div><div class="cal">';
      ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(function (d) { h += '<div class="dow">' + d + "</div>"; });
      for (var i = 0; i < (from.getDay() + 6) % 7; i++) h += '<div class="day out"></div>';
      for (var d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        var k = key(d), ev = P.events.filter(function (e) { return e[0] === k; });
        h += '<div class="day' + (k === E.date ? " today" : "") + '"' + (ev.length ? ' title="' + esc(ev.map(function (e) { return e[2]; }).join("\n")) + '"' : "") + '><div class="n"><b>' + d.getDate() + "</b>" + (d.getDate() === 1 || +d === +from ? " " + MON[d.getMonth()] : "") + "</div>";
        if (ev.length) h += '<div class="dots">' + ev.map(function (e) { return '<i style="background:var(' + CAT[e[1]][1] + ')"></i>'; }).join("") + '</div><div class="lab">' + esc(ev.map(function (e) { return e[2]; }).join(" · ")) + "</div>";
        h += "</div>";
      }
      h += '</div><div class="agenda tw"><table><thead><tr><th>Date</th><th>What · where · practical effect</th></tr></thead><tbody>' + P.events.map(function (e) {
        var dd = pd(e[0]); return '<tr><td class="d"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(' + CAT[e[1]][1] + ');margin-right:6px"></span>' + dd.getDate() + " " + MON[dd.getMonth()] + "</td><td><b>" + esc(e[2]) + '</b><div class="small">' + esc([e[3], e[4], e[5]].filter(Boolean).join(" · ")) + "</div></td></tr>";
      }).join("") + "</tbody></table></div>";
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
    if (E.changelog) h += '<div><div class="small"><b>What changed in the Readbook</b></div><ul class="clean small" style="margin-top:6px">' + E.changelog.map(function (c) { return "<li>" + esc(c[0]) + ": " + rich(c[1]) + "</li>"; }).join("") + "</ul></div>";
    h += '<p class="small">Open sources only. Personal reading; not an official product.</p></div></section>';

    app.innerHTML = h;
    after(E, ctx);
  }

  /* ---------- post-render wiring ---------- */
  function after(E, ctx) {
    var today = pd(E.date);
    /* running incident log */
    var log = (ctx.incidents || []).filter(function (x) { var d = pd(x.date); return (today - d) / 864e5 <= 29 && d <= today; });
    if (!ctx.incidents) log = (E.hybrid && E.hybrid.incidents) || [];
    document.getElementById("map").innerHTML = incidentMap(log);
    document.getElementById("trend").innerHTML = incidentTrend(log, today);
    document.getElementById("logsrc").textContent = ctx.incidents ? log.length + " incidents in the running log over the last 30 days (" + ctx.incidents.length + " since the log began). Bubbles sized by count; outside the map: Ireland, Iberia and beyond." : "Running log unavailable; showing this edition's incidents only.";

    /* bin day */
    var bt = document.getElementById("bins"), next = null, list = (ctx.bins && ctx.bins.dates) || [];
    list.forEach(function (b) { var d = pd(b[0]); if (d >= today && (!next || d < pd(next[0]))) next = b; });
    if (next) {
      var nd = pd(next[0]), same = list.filter(function (b) { return b[0] === next[0]; }).map(function (b) { return b[1]; });
      bt.querySelector(".val").textContent = fmt(nd);
      bt.querySelector("p").textContent = same.join(", ") + ((nd - today) / 864e5 === 1 ? " · put out tonight" : "");
    } else {
      bt.querySelector(".val").textContent = "Not loaded";
      bt.querySelector("p").textContent = (ctx.bins && ctx.bins.note) || "Add the Rd4 calendar to data/bins.json.";
    }

    /* read time */
    var words = 0;
    Array.prototype.forEach.call(app.children, function (el) { if (el.id !== "sources" && !el.classList.contains("planner")) words += (el.textContent || "").split(/\s+/).length; });
    document.getElementById("readtime").textContent = "≈ " + Math.max(1, Math.round(words / 230)) + " min read";

    /* remembered fold state */
    app.querySelectorAll("details[data-k]").forEach(function (d) {
      var k = "rb:open:" + d.getAttribute("data-k"), v = store(k);
      if (v != null && d.getAttribute("data-k") !== "planner") d.open = v === "1";
      d.addEventListener("toggle", function () { store(k, d.open ? "1" : "0"); });
    });

    /* archive picker */
    var sel = document.getElementById("arch");
    (ctx.index.editions || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).forEach(function (e) {
      var o = document.createElement("option"); o.value = e.date; o.textContent = fmt(pd(e.date)) + " " + e.date.slice(0, 4) + " · Edition " + e.edition; if (e.date === E.date) o.selected = true; sel.appendChild(o);
    });
    sel.addEventListener("change", function () { location.hash = "ed-" + sel.value; });

    /* sticky header: current part and progress */
    var parts = Array.prototype.slice.call(app.querySelectorAll("[data-part]"));
    var cur = document.getElementById("cur"), prog = document.getElementById("prog"), slim = document.getElementById("slim");
    function onScroll() {
      var y = window.scrollY + 80, now = parts[0];
      parts.forEach(function (p) { if (p.getBoundingClientRect().top + window.scrollY <= y) now = p; });
      if (now) { cur.textContent = now.getAttribute("data-part"); var cls = now.className.split(" ").filter(function (c) { return ["sec","pro","money","home","hockey","plan","front"].indexOf(c) >= 0; })[0]; slim.className = "slim " + (cls || ""); }
      var max = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.width = (max > 0 ? Math.min(100, window.scrollY / max * 100) : 0) + "%";
    }
    window.removeEventListener("scroll", window.__rbScroll || function () {});
    window.__rbScroll = onScroll;
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    document.title = "Nick's Daily Readbook · " + fmt(today);
    var h = location.hash.slice(1);
    if (h && h.indexOf("ed-") !== 0) { var t = document.getElementById(h); if (t) t.scrollIntoView(); }
  }

  /* ---------- boot ---------- */
  var ctx = {};
  function load(date) {
    var target = date || ctx.index.latest;
    return getJSON("data/editions/" + target + ".json").then(function (E) { render(E, ctx); window.scrollTo(0, 0); });
  }
  function fail(e) { app.innerHTML = '<div class="err"><b>Couldn\'t load the Readbook.</b><br>' + esc(e.message || e) + "<br>Check your connection and pull down to refresh.</div>"; }
  Promise.all([
    getJSON("data/index.json"),
    getJSON("data/incidents.json").catch(function () { return null; }),
    getJSON("data/bins.json").catch(function () { return null; })
  ]).then(function (r) {
    ctx.index = r[0]; ctx.incidents = r[1] && r[1].incidents; ctx.bins = r[2];
    var m = location.hash.match(/^#ed-(\d{4}-\d{2}-\d{2})$/);
    return load(m ? m[1] : null);
  }).catch(fail);
  window.addEventListener("hashchange", function () { var m = location.hash.match(/^#ed-(\d{4}-\d{2}-\d{2})$/); if (m && ctx.index) load(m[1]).catch(fail); });

  if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); }); }
})();
