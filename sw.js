/* Readbook service worker: app shell cached; data files fetched network-first, with the last good copy kept for offline reading. */
const SHELL = "rb-shell-v65";
const DATA = "rb-data-v65";
const SHELL_FILES = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png", "fonts/barlowcondensed-normal-500.woff2", "fonts/barlowcondensed-normal-600.woff2", "fonts/barlowcondensed-normal-700.woff2", "fonts/publicsans-normal-400-600-700.woff2", "fonts/publicsans-italic-400.woff", "fonts/jetbrainsmono-normal-500.woff"];
/* Network-first data: index.json, editions/*.json and the standing files incidents.json, bins.json, threads.json, horizon.json, fx.json, series.json, canes.json, conflicts.json, world-series.json, calendar.json, deadlines.json. Anything under /data/ follows the same rule. */
const DATA_FILES = ["data/index.json", "data/incidents.json", "data/bins.json", "data/threads.json", "data/horizon.json", "data/fx.json", "data/series.json", "data/canes.json", "data/conflicts.json", "data/world-series.json", "data/calendar.json", "data/deadlines.json", "data/congress.json", "data/exercises.json", "data/releases.json", "data/events.json", "data/idioms.json", "data/ski.json", "data/search-index.json", "data/land.json", "data/week.json", "data/corrections.json", "data/research.json", "data/teams.json", "data/tv.json", "data/countries.json", "data/ceu.json"];

const CORE = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest"];
self.addEventListener("install", (e) => {
  // the page shell must all cache or the worker does not install; fonts and icons are best effort
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(CORE).then(() => Promise.all(SHELL_FILES.filter((f) => CORE.indexOf(f) < 0).map((f) => c.add(f).catch(() => {}))))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const isData = url.pathname.includes("/data/") || DATA_FILES.some((f) => url.pathname.endsWith("/" + f));
  const isShell = SHELL_FILES.some((f) => url.pathname.endsWith(f.replace("./", "/")) || url.pathname === "/");
  if (/\/(fonts|icons)\//.test(url.pathname)) {
    // fonts and icons never change under the same name: cache first
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => { if (res.ok) { const copy = res.clone(); e.waitUntil(caches.open(SHELL).then((c) => c.put(e.request, copy))); } return res; })));
    return;
  }
  if (isData || isShell) {
    // network first, fall back to the last cached copy when offline; the shell waits at most 4 s for the network
    const net = fetch(e.request), timed = isShell ? Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000))]) : net;
    e.waitUntil(net.then((res) => { if (res.ok) { const copy = res.clone(); return caches.open(isData ? DATA : SHELL).then((c) => c.put(e.request, copy)); } }).catch(() => {}));
    e.respondWith(
      timed.then((res) => {
        if (res.ok) return res;
        if (res.status < 500) return res; // a 404 is an answer; only a server error falls back to the last good copy
        return caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || res);
      }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || net))
    );
  }
});
