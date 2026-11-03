# Readbook data format (v4.0)

The site is static. `index.html` + `app.js` + `styles.css` never change day to day; each morning's run only writes data files. The page renders every earlier format (2.5 and 3.0) as well: see "Compatibility" at the end. Everything on the page is expanded by default; nothing is folded.

## Files the daily run writes

| File | What to do |
|---|---|
| `data/editions/YYYY-MM-DD.json` | Create the day's edition (format below). Never edit past editions. |
| `data/index.json` | Set `latest` to today's date and append `{"date","edition"}` to `editions`. |
| `data/conflicts.json` | Append one dated fact entry to each theatre that had a reportable event. Never edit or delete old entries. No status labels. |
| `data/world-series.json` | Append one row per published value to each series the source published. |
| `data/incidents.json` | Append each new hybrid incident (same id never twice). When an older incident is newly attributed or charged, update its `attr` in place **and** append an entry to `attrLog`. Prune incidents older than 400 days. |
| `data/threads.json` | Append a dated log entry to each thread that moved; open new threads; set `status`. Never delete entries. |
| `data/horizon.json` | Add new dated events (`added` = today); set `updated` = today on an event you changed; remove events whose date has passed. |
| `data/fx.json` | Append the ECB EUR reference rate for each business day not yet listed (the ECB publishes about 16:00 CET, so a morning run appends yesterday). Stored exactly as the ECB quotes it, US dollars per euro; the page inverts to euros per dollar. |
| `data/series.json` | Append the last close for each series key; keep the last 30 trading days per key. |
| `data/canes.json` | Append each completed Carolina game; refresh `upcoming` (next 15 scheduled games with UTC start); update `record`, `points`, `metro`. |
| `data/calendar.json` | Only when a school year or holiday list is newly published: add the missing segments. Otherwise leave alone. |
| `data/bins.json` | Only when a new Rd4 calendar is supplied. |

Never written by the run: `data/deadlines.json` (Nick's own list).

The standing files are the Readbook's memory. The page reads them; it never writes.

## Text conventions (all string fields)

- Plain text, no HTML. `**bold**`, `*italic*`.
- Citations: `[12]` or `[3, 45]` at the end of a sentence; numbers refer to the edition's `sources`.
- Every link appears once, in `sources`. No URLs in body text.
- Badges: `"badge": "NEW"` or `"UPDATED"`; omit when unchanged. The Today strip counts badges and the "New only" toggle hides everything without one. Standing files carry no badges; the page derives them from dates.
- Empty arrays are fine: the page shows a one-line "No significant change today."
- The exchange rate is always USD/EUR, euros per dollar, four decimals (0.8916), in the strip, the cards, the rates table and the pay line. The page relabels and inverts any EUR/USD row it finds, but do not rely on that.
- Never write a home address, postcode or house number anywhere in `data/`. Town names are fine.
- The World part is facts and summaries only: what happened, who said what, what is scheduled. No assessments, no "what it means", no So what lines.

## Edition object

```
{
 "v": "4.0", "date": "YYYY-MM-DD", "weekday": "Monday", "edition": N, "lookback": "31 Oct – 2 Nov",
 "note": "optional one-liner under the masthead",
 "today": {
   "weather": {"now","hi","lo","tomorrow","sunrise","sunset","src",
               "week": [["YYYY-MM-DD", hi, lo, rainPct, "wind"], ... 7 rows from today]},
   "canes": {"line": "W 7–0 vs WPG", "sub": "12-2-2 · …", "src"}   (optional; the strip derives it from canes.json when absent),
   "markets": [["S&P 500","−1.8%","down"], ...4 rows; dir = up|down|flat],
   "items": [{"k":"Wed","t":"…","cat":"nl|be|de|us|mkt|pro"}]
 },
 "five": [{"t","to": "<element id>","part": "world|sec|watch|pro|money|home|hockey"}] (exactly 5),
 "pick": {"t","to"},
 "world": {
   "items": [{"region","h","body","next","conf","badge"}] (3–5; next = what is scheduled, dated),
   "numbers": ["ru-personnel-day","ru-uav-day","brent","ttf"] (keys into world-series.json or series.json, 4–6),
   "feature": {"rota": "mon|tue|wed|thu|fri|sat|sun", "kind": "Monday · Theatre in numbers", "title", "body": ["para", ...],
               "table": {"head":[...],"rows":[[...]]} | omitted,
               "series": "<world-series key charted over 12 months>" | omitted,
               "bars": {"label", "rows": [[label, value], ...]} | omitted,
               "timeline": [[date, text, hybridRelevant:bool], ...] | omitted,
               "geo": {"title","bbox":[lon0,lat0,lon1,lat1],"points":[{"n","lat","lon","k":"city|port|base|chokepoint","align":"left"?}],
                       "lines":[{"a":[lat,lon],"b":[lat,lon],"t":"optional label","solid":bool}],"labels":[{"t","lat","lon"}]} | omitted,
               "after": ["closing para", ...] | omitted}
 },
 "hybrid": {
   "incidents": [{"id","date","when","code","attr":"A0..A5","local":bool,"country","place","lat","lon","text","badge"}],
   "leads": [{"id":"lead-1","title","teaser","rows":[["What","…"],["Attribution","…"],...],"sw"}],
   "pattern": ["…"], "tracker": [["…","Deny|Defend|Punish|Resilience"]],
   "indicators": [["rising|falling|steady|watch|nodata","name","reason"]],
   "week": {"t": "Fridays only: week in hybrid summary"} | null,
   "note": "…"
 },
 "europe": [item], "euregio": [item] (section omitted when empty),
 "army": {"cards": [{"l","v","n"}] (4),
   "dod": [item] (Department of Defense: Secretary, posture, budget execution, joint force),
   "news": [item] (Army and USAREUR-AF: units, exercises, equipment, people),
   "congress": [item] (NDAA, appropriations, hearings, nominations, policy with a bill or directive behind it),
   "career": {"items": [item] (boards, assignments, education, pay and benefits, as they touch a field-grade officer in Europe),
              "dates": [["YYYY-MM-DD", "milestone"]] (optional; also shown on the calendar), "note": "optional line"}},
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
 "planner": {
   "events": [[date,"nl|be|de|us|mkt|pro",label,where,what,effect]] (only what calendar.json does not already hold),
   "season": {"title","intro","from","to","ticks","rows":[{"name","sub","color","segs"}],"notes"} | null,
   "otd": {"title","body"}, "culture": {"title","body"} | null},
 "sources": [[n,title,outlet,url]], "flags": "…", "changelog": [[date,text]]
}
```

`item` = `{"h","tag","conf","badge","body","sw","fy"}` (all optional except `h`).

The World feature rota: Monday "Theatre in numbers" (table), Tuesday "Actor on the record" (dated quotes, table of capabilities), Wednesday "Trend line" (`series`), Thursday "Chronology" (`timeline`, 30 days), Friday "Week on the board" (table of what moved per theatre), Saturday "Geography" (`geo` schematic), Sunday "The record" (`timeline` over 12 months plus `series`). A worked example is in `data/examples/edition-4.0-sample.json`.

### Changes from v3.0

- `world` is an object (items, numbers, feature) instead of an array; the World part is Part 1, before Security.
- `planner.calFrom`, `calTo`, `school`, `open` are gone: the page draws any month from the merged calendar and reads school breaks from `calendar.json`. `planner.events` only carries what the standing calendar does not already hold.
- `today.weather.week` added (7-day forecast for the week strip).
- `five[].part` may be `"world"`; `to` may be `board`, `world`, `numbers`, `feature`.
- `army.items` is split into `dod`, `news`, `congress` and `career` (3.0 editions with `items` render under Army and USAREUR-AF). Jump ids: `army`, `dod`, `armynews`, `congress`, `career`.
- `"v": "4.0"`.

## Standing files

### `data/conflicts.json`

```
{ "theatres": [ { "id": "ru-ua", "name": "Russia–Ukraine", "short": "Ukraine", "lp": "above", "lat": 48.5, "lon": 35.0,
    "log": [ {"date": "2026-11-03", "t": "Fact sentence(s) with citations. [14, 18]", "src": [[14,"title","outlet","url"], ...]} ] } ] }
```

Ten theatres. Append one entry per theatre per day it had a reportable event, copying the cited source rows into `src`. Never edit or delete entries; do not add status fields. The page orders rows by last entry, draws a four-week activity bar from the dates, sizes the map marker by the 7-day count, and shows NEW when the last entry is today, UPDATED when yesterday. `short` and `lp` (above, below, left, right) place the map label.

### `data/world-series.json`

```
{ "meta": { "<key>": {"label","unit","cadence":"daily|weekly","source","url","decimals","note"} },
  "series": { "<key>": [["YYYY-MM-DD", value], ...] } }
```

Append one row per published value; never backfill estimates. A weekly series keeps its weekly cadence and the tile shows the as-of date. New keys need a `meta` entry.

### `data/calendar.json`

```
{ "from", "to", "holidays": [{"date","c":"nl|be|de|us|info","n","note"}],
  "school": { "<system>": {"name","color","source","segs":[[from,to,label]],"days":[[date,label]],"weekly"} },
  "markets": [[name, c, from, to]] }
```

Edited rarely. Add a school year when the ministry publishes it. The page merges holidays, school breaks, markets, bins, Canes games, horizon events, deadlines and `planner.events` into one calendar with month navigation, a seven-day strip, countdown tiles and the twelve-month school overlap chart.

### `data/deadlines.json`

```
{ "items": [ {"name","date","note","cat":"home|money|school|car|docs","updated":"YYYY-MM-DD"} ] }
```

Hand-maintained by Nick. The run never writes it. No addresses or document numbers.

### `data/threads.json`, `data/horizon.json`, `data/fx.json`, `data/series.json`, `data/canes.json`, `data/incidents.json`

As in 3.0 (see the 3.0 notes kept below), with one addition to `canes.json`:

```
"upcoming": [ {"date": "2026-11-05", "opp": "NYI", "home": false, "utc": "2026-11-06T00:00:00Z"} ]
```

The page converts `utc` to CET for the schedule strip, the calendar and the countdown tile.

#### threads.json
`{ "threads": [ { "id", "name", "status": "moving|quiet|resolved", "opened", "log": [ {"date", "t", "src": [[n,title,outlet,url]]} ] } ] }`. Append entries; never edit. Quiet after 30 days without an entry; resolved threads disappear 7 days after their last entry.

#### horizon.json
`{ "events": [ { "id", "date", "dateText", "t", "n", "h": bool, "status": "confirmed|reported", "added", "updated", "src" } ] }`. Events without a firm date carry `date` as the first day of their window.

#### fx.json
`{ "source", "url", "pair": "EUR/USD", "updated", "series": [["YYYY-MM-DD", usd_per_euro], ...] }`. Two years kept. The page shows euros per dollar.

#### series.json
`{ "spx": [...], "ndx": [...], "aex": [...], "brent": [...], "ttf": [...] }`, 30 trading days each, last close only. `ndx` is the Nasdaq Composite, `brent` the ICE front month in $/bbl, `ttf` the TTF front month in €/MWh.

#### incidents.json
As before, plus `attrLog`: `[{"id","date","from","to","t","src"}]`.

## Compatibility

- A 3.0 or 2.5 edition whose `world` is an array renders it under Developments; the board, the numbers and the planner come from the standing files; the feature block says there is none.
- A 2.5 edition's `planner.threads` and `planner.horizon` still render when the standing files are empty; `planner.school` renders when `calendar.json` is missing.
- When `fx.json` is missing the USD/EUR tracker and tile are hidden; when a series key is missing the card has no sparkline; when `canes.json` is missing the Hockey part falls back to the edition's `hockey.canes.record`.
