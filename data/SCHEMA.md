# Readbook data format (v3.0)

The site is static. `index.html` + `app.js` + `styles.css` never change day to day; each morning's run only writes data files. The page still renders v2.5 editions (Editions 1 and 2): see "Compatibility" at the end.

## Files the daily run writes

| File | What to do |
|---|---|
| `data/editions/YYYY-MM-DD.json` | Create the day's edition (format below). Never edit past editions. |
| `data/index.json` | Set `latest` to today's date and append `{"date","edition"}` to `editions`. |
| `data/incidents.json` | Append each new hybrid incident (same id never twice). When an older incident is newly attributed or charged, update its `attr` in place **and** append an entry to `attrLog`. Prune incidents older than 400 days. |
| `data/threads.json` | Append a dated log entry to each thread that moved; open new threads; set `status`. Never delete entries. |
| `data/horizon.json` | Add new dated events (`added` = today); set `updated` = today on an event you changed; remove events whose date has passed. |
| `data/fx.json` | Append today's ECB EUR/USD reference rate when the ECB has published it (about 16:00 CET; a morning run appends the previous business day). One value per ECB business day, ascending, no duplicates. |
| `data/series.json` | Append the last close for each series key; keep the last 30 trading days per key. |
| `data/canes.json` | Append each completed Carolina game; update `record`, `points`, `metro`. |
| `data/bins.json` | Only when a new Rd4 calendar is supplied: `dates` = `[["YYYY-MM-DD","GFT"], ...]`. |

The standing files are the Readbook's memory. The page reads them; it never writes.

## Text conventions (all string fields)

- Plain text, no HTML. `**bold**`, `*italic*`.
- Citations: `[12]` or `[3, 45]` at the end of a sentence; numbers refer to the edition's `sources`.
- Every link appears once, in `sources`. No URLs in body text.
- Badges: `"badge": "NEW"` or `"UPDATED"`; omit when unchanged. The Today strip counts badges, and the "New only" toggle hides everything without one.
- Empty arrays are fine: the page shows a one-line "No significant change today."
- Never write a home address, postcode or house number anywhere in `data/`. Town names are fine.

## Edition object

```
{
 "v": "3.0", "date": "YYYY-MM-DD", "weekday": "Monday", "edition": N, "lookback": "31 Oct – 2 Nov",
 "note": "optional one-liner under the masthead",
 "today": {
   "weather": {"now","hi","lo","tomorrow","sunrise","sunset","src"},
   "canes": {"line": "W 7–0 vs WPG", "sub": "12-2-2 · …", "src"}   (optional; when absent the strip derives it from canes.json),
   "markets": [["S&P 500","−1.8%","down"], ...4 rows; dir = up|down|flat],
   "items": [{"k":"Wed","t":"…","cat":"nl|be|de|us|mkt|pro"}]
 },
 "five": [{"t","to": "<element id>","part": "sec|watch|pro|money|home|hockey"}] (exactly 5),
 "pick": {"t","to"},
 "hybrid": {
   "incidents": [{"id","date","when","code","attr":"A0..A5","local":bool,"country","place","lat","lon","text","badge"}],
   "leads": [{"id":"lead-1","title","teaser","rows":[["What","…"],["Attribution","…"],...],"sw"}],
   "pattern": ["…"], "tracker": [["…","Deny|Defend|Punish|Resilience"]],
   "indicators": [["rising|falling|steady|watch|nodata","name","reason"]],
   "week": {"t": "Fridays only: week in hybrid summary"} | null,
   "note": "…"
 },
 "europe": [item], "world": [item + "region"], "euregio": [item] (section omitted when empty),
 "army": {"cards": [{"l","v","n"}] (4), "items": [item]},
 "aperture": {"contrarian","weak"|null,"number":{"n","t"},"inject","question",
   "deep": {"kind","title","body":["para",...],"table": {"head":[...],"rows":[[...]]} | null},
   "longread": {"title","outlet","url","why"} | null, "rota": "mon|tue|wed|thu|fri|sat|sun"},
 "money": {"asof","cards":[[label,value,change,dir,note,src,series]],"ytd":[[name,pct]],"ytdSrc","driver",
   "rates":[[measure,latest,note]],"week":["…"],"fy",
   "fuel": {"asof","rows":[["Netherlands",95,diesel],...],"note","src","weekly":"Fridays"} | null},
 "nl": {"items":[item],"temp","lees":{"nl","gloss":[[word,meaning]],"src"},"phrase":{"w","en","lvl","note"}},
 "afnorth": {"intro","rows":[[date,event,action,"soon"|""]],"note"},
 "offduty": {"items":[item + "tag"],"weekend": {"rows":[[day,event,place,why,cost]],"gem","family"} | null,"weather": "Fridays: KNMI weekend line" | null},
 "hockey": {
   "canes": {"result": {"date","home","hs","away","as","ot":bool,"venue","lines":["…"],"src"} | null,
             "noGame": "text when Carolina did not play",
             "next": [[localDate, opponent, "20:00 ET", "Wed 02:00 CET", watchLive:bool]], "nextSrc"},
   "scores": [[away, awayGoals, home, homeGoals, ""|"OT"|"SO"|"pending"]], "scoresDate", "scoresNote", "scoresSrc",
   "news": [item] (3–5)
 },
 "planner": {"open": true on Mondays (optional; the page defaults to open on Mondays),
   "calFrom","calTo","events": [[date,"nl|be|de|us|mkt|pro",label,where,what,effect]],
   "school": {"from","to","ticks":[...],"rows":[{"name","color","segs":[[from,to]]}],"note"} | null,
   "season": {"title","intro","from","to","ticks","rows":[{"name","sub","color","segs"}],"notes"} | null,
   "otd": {"title","body"}, "culture": {"title","body"} | null},
 "sources": [[n,title,outlet,url]], "flags": "…", "changelog": [[date,text]]
}
```

`item` = `{"h","tag","conf","badge","body","sw","fy"}` (all optional except `h`).

### Changes from v2.5

- `planner.threads` and `planner.horizon` are gone; threads and horizon live in `threads.json` and `horizon.json`.
- `today.fx` is gone; the Today strip and the USD/EUR tracker read `fx.json`.
- `hockey.canes.record` is no longer needed; the season strip and record line come from `canes.json`. The run appends the game to `canes.json` instead.
- `money.cards` rows gain an optional seventh field, `series`: a key into `series.json` (`"spx"`, `"ndx"`, `"aex"`, `"brent"`, `"ttf"`). The card then shows a 30-day sparkline. Example: `["S&P 500", "7,580.07", "−1.8%", "down", "Fri close", 56, "spx"]`. The page also accepts the key in the sixth position when a card has no source number, and falls back to matching the label (S&P 500, Nasdaq, AEX, Brent, Dutch TTF) when the field is absent.
- `five[].part` may be `"watch"` for a Watchlist item.
- `"v": "3.0"`.

## Standing files

### `data/threads.json`

```
{ "threads": [ { "id": "cold-chain", "name": "Cold-chain attacks", "status": "moving|quiet|resolved", "opened": "2026-11-02",
    "log": [ {"date": "2026-11-02", "t": "France 11–12 Oct, then seven countries 1–2 Nov. Belgian criminal case open. [2, 45]",
              "src": [[2,"title","outlet","url"],[45,"title","outlet","url"]]} ] } ] }
```

- Each run appends one log entry per thread that moved (newest last). Entries are never edited or deleted.
- `[n]` in `t` refers to the sources of the edition that added the entry, so copy those source rows into the entry's `src`; the page renders the superscript as a direct link. An entry with no citations carries `"src": []`.
- Page rules: threads ordered by most recent log date; a thread whose last entry is older than 30 days and whose status is not `resolved` is shown as `quiet`; `resolved` threads disappear 7 days after their last entry. The row shows the latest entry with NEW when it is dated today and UPDATED when dated yesterday; tapping expands the full dated log.

### `data/horizon.json`

```
{ "events": [ { "id": "us-midterms-2026", "date": "2026-11-03", "dateText": "3 Nov", "t": "US midterm elections",
    "n": "Posture, NATO rhetoric, Iran timing", "h": true, "status": "confirmed|reported", "added": "2026-11-02",
    "updated": "2026-11-05" (optional), "src": [[n,"title","outlet","url"]] } ] }
```

- Events without a firm date carry `date` as the first day of their window and `dateText` as the human text ("early 2027").
- Page rules: sorted by date; grouped into Next 14 days, 15 to 90 days, Beyond 90 days; "today", "tomorrow" or "in N days" beside each date; events dated before today are dropped; NEW when `added` is today, UPDATED when `updated` is today; filled marker when `h` is true; `reported` shown as a small label.

### `data/fx.json`

```
{ "source": "ECB euro foreign exchange reference rates", "url": "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip",
  "pair": "EUR/USD", "updated": "2026-11-02", "series": [ ["2024-11-01", 1.0885], ... ascending, one value per ECB business day ] }
```

Two years of history are kept. Values are stored exactly as the ECB quotes them, US dollars per euro. The page inverts them and shows euros per dollar (USD/EUR), so up means dollar pay buys more euros. See README for extending it by hand.

### `data/series.json`

```
{ "spx": [["2026-10-30", 7580.07], ...], "ndx": [...], "aex": [...], "brent": [...], "ttf": [...] }
```

Thirty trading days per key, ascending, last close only. `ndx` is the Nasdaq Composite (matching the "Nasdaq" card), `brent` the ICE Brent front month in $/bbl, `ttf` the TTF front month in €/MWh. Keys starting with `_` are notes and are ignored.

### `data/canes.json`

```
{ "season": "2026-27", "team": "CAR", "games": [ {"date": "2026-11-01", "opp": "WPG", "home": true, "gf": 7, "ga": 0, "res": "W|L|OTL|SOL"} ],
  "record": "12-2-2", "points": 26, "metro": 1, "updated": "2026-11-01" }
```

Regular-season games only, ascending by date. The page draws the last ten results and the record line; when an older edition is viewed it recomputes the record from the games up to that date.

### `data/incidents.json`

As before, plus:

```
"attrLog": [ {"id": "<incident id>", "date": "2026-11-05", "from": "A1", "to": "A4", "t": "Lithuania charged two suspects", "src": [[n,"title","outlet","url"]]} ]
```

The Hybrid section lists the last 7 days of `attrLog` under "Attribution moves" and the last 30 days of incidents flagged `local` or within 100 km under "Within 100 km".

## Compatibility

- A v2.5 edition that carries `planner.threads` or `planner.horizon` renders them under the Watchlist when `threads.json` or `horizon.json` is absent or empty; when the standing files have content, they win.
- When `fx.json` is missing or empty the USD/EUR tracker and the strip tile are hidden.
- When `series.json` lacks a key, the card shows no sparkline. When `canes.json` is missing, the Hockey part falls back to the edition's `hockey.canes.record`.
