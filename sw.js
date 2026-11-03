/* Readbook service worker: app shell cached; data files fetched network-first, with the last good copy kept for offline reading. */
const SHELL = "rb-shell-v4";
const DATA = "rb-data-v4";
const SHELL_FILES = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png"];
/* Network-first data: index.json, editions/*.json and the standing files incidents.json, bins.json, threads.json, horizon.json, fx.json, series.json, canes.json, conflicts.json, world-series.json, calendar.json, deadlines.json. Anything under /data/ follows the same rule. */
const DATA_FILES = ["data/index.json", "data/incidents.json", "data/bins.json", "data/threads.json", "data/horizon.json", "data/fx.json", "data/series.json", "data/canes.json", "data/conflicts.json", "data/world-series.json", "data/calendar.json", "data/deadlines.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const isData = url.pathname.includes("/data/") || DATA_FILES.some((f) => url.pathname.endsWith("/" + f));
  const isShell = SHELL_FILES.some((f) => url.pathname.endsWith(f.replace("./", "/")) || url.pathname === "/");
  if (isData || isShell) {
    // network first, fall back to the last cached copy when offline
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(isData ? DATA : SHELL).then((c) => c.put(e.request, copy)); }
        return res;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
  }
});
