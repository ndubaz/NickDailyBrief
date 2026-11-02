# Readbook data format (v2.5)

The site is static. `index.html` + `app.js` + `styles.css` never change day to day; each morning's run only writes data files.

## Files the daily run writes

| File | What to do |
|---|---|
| `data/editions/YYYY-MM-DD.json` | Create the day's edition (format below). Never edit past editions. |
| `data/index.json` | Set `latest` to today's date and append `{"date","edition"}` to `editions`. |
| `data/incidents.json` | Append each new hybrid incident (same id never twice). When an older incident is newly attributed or charged, update its `attr` in place. Prune entries older than 400 days. |
| `data/bins.json` | Only when a new Rd4 calendar is supplied: `dates` = `[["YYYY-MM-DD","GFT"], ...]`. |

## Text conventions (all string fields)

- Plain text, no HTML. `**bold**`, `*italic*`.
- Citations: `[12]` or `[3, 45]` at the end of a sentence; numbers refer to `sources`.
- Every link appears once, in `sources`. No URLs in body text.
- Badges: `"badge": "NEW"` or `"UPDATED"`; omit when unchanged.
- Empty arrays are fine: the page shows a one-line "No significant change today."

## Edition object

```
{
 "v": "2.5", "date": "YYYY-MM-DD", "weekday": "Monday", "edition": N, "lookback": "31 Oct – 2 Nov",
 "note": "optional one-liner under the masthead",
 "today": {
   "weather": {"now","hi","lo","tomorrow","sunrise","sunset","src"},
   "canes": {"line": "W 7–0 vs WPG", "sub": "12-2-2 · …", "src"},
   "markets": [["S&P 500","−1.8%","down"], ...4 rows; dir = up|down|flat],
   "items": [{"k":"Wed","t":"…","cat":"nl|be|de|us|mkt|pro"}]
 },
 "five": [{"t","to": "<element id>","part": "sec|pro|money|home|hockey"}] (exactly 5),
 "pick": {"t","to"},
 "hybrid": {
   "incidents": [{"id","date","when","code","attr":"A0..A5","local":bool,"country","place","lat","lon","text","badge"}],
   "leads": [{"id":"lead-1","title","teaser","rows":[["What","…"],["Attribution","…"],...],"sw"}],
   "pattern": ["…"], "tracker": [["…","Deny|Defend|Punish|Resilience"]],
   "indicators": [["rising|falling|steady|watch|nodata","name","reason"]],
   "week": {"t": "Fridays only: week in hybrid summary"} | null,
   "note": "…"
 },
 "europe": [item], "world": [item + "region"], "euregio": [item],
 "army": {"cards": [{"l","v","n"}] (4), "items": [item]},
 "aperture": {"contrarian","weak"|null,"number":{"n","t"},"inject","question",
   "deep": {"kind","title","body":["para",...],"table": {"head":[...],"rows":[[...]]} | null},
   "longread": {"title","outlet","url","why"} | null, "rota": "mon|tue|wed|thu|fri|sat|sun"},
 "money": {"asof","cards":[[label,value,change,dir,note,src]],"ytd":[[name,pct]],"ytdSrc","driver",
   "rates":[[measure,latest,note]],"week":["…"],"fy",
   "fuel": {"asof","rows":[["Netherlands",95,diesel],...],"note","src","weekly":"Fridays"} | null},
 "nl": {"items":[item],"temp","lees":{"nl","gloss":[[word,meaning]],"src"},"phrase":{"w","en","lvl","note"}},
 "afnorth": {"intro","rows":[[date,event,action,"soon"|""]],"note"},
 "offduty": {"items":[item + "tag"],"weekend": {"rows":[[day,event,place,why,cost]],"gem","family"} | null,"weather": "Fridays: KNMI weekend line" | null},
 "hockey": {
   "canes": {"result": {"date","home","hs","away","as","ot":bool,"venue","lines":["…"],"src"} | null,
             "noGame": "text when Carolina did not play", "record",
             "next": [[localDate, opponent, "20:00 ET", "Wed 02:00 CET", watchLive:bool]], "nextSrc"},
   "scores": [[away, awayGoals, home, homeGoals, ""|"OT"|"SO"|"pending"]], "scoresDate", "scoresNote", "scoresSrc",
   "news": [item] (3–5)
 },
 "planner": {"open": true on Mondays,
   "threads": [[thread, what moved, badge]],
   "horizon": [{"g":"Next 14 days|15 to 90 days|Beyond 90 days","d","t","n","h":bool,"badge"}],
   "calFrom","calTo","events": [[date,"nl|be|de|us|mkt|pro",label,where,what,effect]],
   "school": {"from","to","ticks":[...],"rows":[{"name","color","segs":[[from,to]]}],"note"} | null,
   "season": {"title","intro","from","to","ticks","rows":[{"name","sub","color","segs"}],"notes"} | null,
   "otd": {"title","body"}, "culture": {"title","body"} | null},
 "sources": [[n,title,outlet,url]], "flags": "…", "changelog": [[date,text]]
}
```

`item` = `{"h","tag","conf","badge","body","sw","fy"}` (all optional except `h`).
