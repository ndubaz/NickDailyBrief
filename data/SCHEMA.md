# Readbook data format (v6.0)

The site is static. `index.html` + `app.js` + `styles.css` never change day to day; each morning's run only writes data files. The page renders every earlier format (2.5 to 5.0) as well: see "Compatibility" at the end. Wording rules live in STYLE.md. Everything on the page is expanded by default; nothing is folded. Run `node tools/validate.js` before committing; it checks everything listed here.

## Files the daily run writes

| File | What to do |
|---|---|
| `data/editions/YYYY-MM-DD.json` | Create the day's edition (format below). Never edit past editions. |
| `data/index.json` | Set `latest` to today's date and append `{"date","edition","generated"}` to `editions`, `generated` being the ISO timestamp with offset when the run finished; the page shows it as "Last run". |
| `data/conflicts.json` | Append one dated fact entry to each theatre that had a reportable event. Never edit or delete old entries. No status labels. Thirteen theatres since 7.3: `balkans` (Western Balkans) and `blacksea` (Black Sea and Moldova) joined the eleven. |
| `data/world-series.json` | Append one row per published value to each series the source published. |
| `data/incidents.json` | Append each new hybrid incident (same id never twice). When an older incident is newly attributed or charged, update its `attr` in place **and** append an entry to `attrLog`. Prune incidents older than 400 days. |
| `data/threads.json` | Append a dated log entry to each thread that moved; open new threads; set `status`. Never delete entries. |
| `data/horizon.json` | Add new dated events (`added` = today); set `updated` = today on an event you changed; remove events whose date has passed. |
| `data/fx.json` | Append the ECB EUR reference rate for each business day not yet listed (the ECB publishes about 16:00 CET, so a morning run appends yesterday). Stored exactly as the ECB quotes it, US dollars per euro; the page inverts to euros per dollar. |
| `data/series.json` | Append the last close for each of the twelve series keys (spx, dji, ndx, rut, aex, stoxx, dax, brent, ttf, gold, us10y, vix); keep the last 30 trading days per key. |
| `data/fuel.json` | Run `node tools/fuel.js` every day: it downloads CBS table 80416ned (daily average pump prices in the Netherlands, published weekly) and rewrites the file with about 400 days of Euro 95 and diesel. Do not edit by hand. If it fails, leave the file and say so in `flags`. |
| `data/canes.json` | Append each completed Carolina game; refresh `upcoming` (next 15 scheduled games with UTC start); update `record`, `points`, `metro`. |
| `data/congress.json` | Three lanes: key defence bills, the budget cycle, confirmations. Add a row when a bill is introduced, a budget deadline is set, a post falls vacant or a nominee is named; move `stage`, add the date to `dates`, set `updated`, copy cited source rows into `src`. Never delete rows. |
| `data/exercises.json` | Add announced NATO and allied exercises; set `updated` when dates change; never delete (the page hides those older than 60 days). |
| `data/releases.json` | Append one entry per AI, chip, robotics or autonomy release, published result or shipped capability (`id` as `YYYY-MM-DD-lab-slug`, `kind`, `t`, `lab`, `n`, `date`, `src`). On Fridays rewrite `sota` (one object per domain: group, system, lab, cc, open, metric, score, unit, since, runner, changed, note, src). |
| `data/feeds.json` | Fetch-first source register (7.5). Read it before any search: `feeds` are RSS feeds, listing pages and APIs that cost a fetch, not a search, each tagged with the section or theatre it serves; `blocked` are hosts that refuse scripted clients. Add a working feed when you find one; move a host to `blocked` after two failed mornings. The page does not read this file. |
| `data/local.json` | Parkstad daily life (7.4). Every run, `node tools/local.js` rewrites `air`, `power`, `maas`, `sky`, `roads`, `rail`, `notices` and `news` from open feeds (Open-Meteo air quality and flood model, Luchtmeetnet, EnergyZero, NOAA, NDW, Rijden de Treinen, the overheid.nl notices register, L1). The run then writes the rest: `woord` (append one Limburgs word a day, never repeat), `culture` and `admin` (dated rows, confirm `verified: false` rows from the organiser or gemeente page), `roda` (the next fixtures), `shops` (koopzondagen and market days once confirmed), `flu` (`{"t","src"}` from RIVM's weekly griep page) and `noise` (`{"h","t","src"}` when the NATO E-3A Component or Maastricht Aachen Airport announces unusual flying). Town-level only: never a street, postcode or plate. |
| `data/energy.json` | Household energy (7.3). Refresh when CBS updates table 85592NED (about the 10th to 15th of each month): fetch the OData TypedDataSet, keep rows with `Btw` A048944 (VAT included) and monthly `Perioden`, map gas columns 1 to 6 and electricity columns 7 to 15 into `months` (36 months), set `asof` to the last month and `updated`. Never edit older months by hand. |
| `data/fuel.json` | A tank of petrol (7.3). Every run, fetch CBS table 80416ned (daily pump prices) for dates after the last row in `daily` and append `[date, euro95, diesel, lpg]`; keep about 14 months; set `asof` and `updated`. Leave `cars` alone: it is Nick's. |
| `data/inbox.json` | Mail check (7.1). Each run, search Gmail for the last three days from the AFNORTH school office, the AFNorth PTA, JFCBS MWA, USAG Benelux-Brunssum CYS, and travel and ticket confirmations; append every dated item not already present as `{id, date, end, time, t, note, src: "AFNORTH|PTA|MWA|CYS|TRAVEL|TICKETS", added}`. Dates, titles, times and places only; never a name, grade, score, confirmation code, booking reference, ticket, order or seat number, price, medical detail or tokenised link. Set `updated` every run, even when nothing was added. |
| `data/indicators.json` | Indicators and warning (7.0). For each indicator with a fact in the window, set `status` (green, amber, red) against its `threshold`; append to `history` only when the status changes, with the date and the fact. Add an indicator when a thread or theatre gains a watchable threshold; never delete. Set `updated` every day you checked. |
| `data/forecasts.json` | Forecast ledger (7.0, run only). One to three new calls a week: a falsifiable question, `p` strictly between 0 and 1, `made`, `resolves`, `domain`, optional theatre, country or congress id, and `why`. Never edit a call after it is made. On or after `resolves`, set `status` yes, no or void, `resolvedDate` and `note` with the fact and source. |
| `data/questions.json` | Open questions (7.0). Add a question when an item turns on a fact nobody has published; close it with `status: "closed"`, `closed` date and `answer` with its source. Never delete. |
| `data/ua-front.json` | Ukraine front line (7.0). Mondays, run `node tools/uafront.js`; it downloads the DeepState layer and rewrites the file. Do not edit by hand. |
| `data/novel.json` | New uses of technology in war (6.6). Each day, scan the window for a technique seen for the first time or newly combined, in any theatre and any domain (drones, counter-drone, electronic warfare, cyber, information operations, AI and autonomy, space and GNSS, naval and undersea, air and missile defence, fires, logistics, medical, engineering, command and control). Check `items` by id and title first; append `{id, date, theatre, actor, t, what, new, domains, src, edition, prev}` only when it is not already logged. Link the news item that reports it with `novel:<id>`. Zero to three a day; none is normal. |
| `data/countries.json` | Priority countries (6.6): Hungary and Slovakia (priority), Germany (secondary); context countries (7.3): Russia, Belarus, China, profiled for what they do to the eastern flank and to the three above, no baseline-requirement grid, spending from SIPRI. Append `{date, t, src}` to a country's `log` for each dated fact on international relations, internal politics relevant to NATO, or civil resilience; update `gov`, `election`, `nato`, `stance` and `blr` only when the fact changes, with the source in `src`; set `verified: true` once every profile line is checked against an official page. Never delete log entries. Set `updated`. |
| `data/events.json` | Add events within about 90 minutes of Hoensbroek with a source; prune events whose `to` has passed; set `updated` when details change. |
| `data/idioms.json` | Append today's idiom (rotate `nl`, `fr`, `it`); never repeat a phrase. |
| `data/ski.json` | 1 Dec to 31 Mar only: refresh `snow` daily from Open-Meteo for every resort; resorts stay as they are. Outside the season, leave the file alone. |
| `data/search-index.json` | Append today's headline block (same fields as the page's search). |
| `data/teams.json` | Secondary teams (6.1). Saints: append each completed game to `games` as `{date, opp, home, pf, pa, res, week}`, refresh `upcoming` (`{date, opp, home, utc, week}`) and `record` from `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/no/schedule` (record also at `.../teams/no`). Cardinals: off-season until spring training; then the same shape from `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=138&season=<year>` and `record` from the standings endpoint. Set `updated`. |
| `data/tv.json` | Followed shows (6.1). For each show refresh `last` and `next` from `https://api.tvmaze.com/shows/<tvmaze>?embed[]=previousepisode&embed[]=nextepisode` (season, number, airdate, name); update `status` (airing, scheduled, renewed, between, awaiting, ended) and `note` when a renewal, premiere date or final is reported, with the source. Set `updated`. Leave `similar` unless Nick asks. |
| `data/research.json` | Append today's three pieces to `covered` (`{date, field, org, title, authors, url}`); take them from `queue` when queued; add to `queue` the publications picked for coming days with their field. Never delete from `covered`. |
| `data/philosophy.json` | Append today's note to `covered` (`{date, thinker, work, tradition}`). Never delete. |
| `data/corrections.json` | Append an entry when an earlier item was wrong: `{date, edition, section, t, src}`. Never edit or delete. |
| `data/calendar.json` | Only when a school year or holiday list is newly published: add the missing segments. Otherwise leave alone. |
| `data/bins.json` | Only when a new Rd4 calendar is supplied. |

Never written by the run: `data/deadlines.json` and `data/week.json` (Nick's own lists). Write the standing files first and the edition second, so a run that stops early still leaves the memory current.

The standing files are the Readbook's memory. The page reads them; it never writes.

## Text conventions (all string fields)

- Plain text, no HTML. `**bold**`, `*italic*`.
- Citations: `[12]` or `[3, 45]` at the end of a sentence; numbers refer to the edition's `sources`. Source rows carry a tier as a fifth field: `[n, title, outlet, url, tier]`, tier 1 official or primary, 2 wire or secondary document, 3 reputable outlet, 4 other.
- Cross-links: any item may carry `"links": ["theatre:<id>", "thread:<id>", "congress:<id>", "post:<id>", "exercise:<id>", "release:<id>", "event:<id>"]` naming the standing-file entries it updates. The page shows them as chips on the item and marks the tracker row "in today's edition".
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
               "week": [["YYYY-MM-DD", hi, lo, rainPct, "wind (direction and Beaufort, e.g. ENE 3)", "sky"], ... 7 rows from today; sky = sun|suncloud|cloud|fog|showers|rain|snow|storm, optional, from the forecast wording]},
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
 "brief": {"takeaways": [{"t", "to", "part", "links"}] (7.0: three to six numbered, quotable, factual sentences written last, after the edition; each names the fact and the date, no assessment language; they replace Five things at the top of the Brief), "unknowns": [{"q", "thread"}] (optional; otherwise the page shows the open items of questions.json)},
 "europe": [item], "countries": [item + {"cc": "hu|sk|de|ru|by|cn", "q": {"lang": "hu|sk|de", "t": "one sentence quoted in the country's language", "en": "its translation", "src": n}}] (6.6: today's news from the priority countries, shown under each country's profile; omit when nothing happened. 7.3: every hu, sk and de item carries `q`, a sentence quoted from a source in that language with its translation; the validator checks the source domain. ru, by and cn are context countries, 0 to 1 item each and only when the fact bears on the flank or on the three above), "euregio": [item] (section omitted when empty),
 "nato": {"items": [item] (3–5: NATO HQ and the allied armies: DE, NL, BE, FR, PL, UK, Nordics, Baltics),
   "table": {"title","asof","head":[...],"rows":[[...]],"src"} | null (allied spending and strength, from NATO's own figures; only in the edition of the day NATO publishes new figures, otherwise null. The page shows it only when asof is within 7 days)},
 "deftech": {"items": [item] (3: drones, counter-drone, air defence, EW, autonomy, munitions production),
   "series": ["<world-series key>", ...] (production series charted when published),
   "ttp": {"title","body":["para",...]} | null (Saturdays: week in war, tactics, techniques and procedures)},
 "frontier": {"items": [item] (3–5: AI, chips, robotics, autonomy; only a release, a published result or a shipped capability dated in the window)},
 "army": {"cards": [{"l","v","n"}] (4),
   "words": [{"who","role","where","date","quote","context","badge"}] (senior leaders on the record: speeches, testimony, statements; 1–3 a day when there are any),
   "depth": {"rota":"mon|wed|fri","kind","title","body":["para",...],"table": {...} | omitted,"bars": {"label","rows":[[label,value]]} | omitted} | null
            (Mon readiness and recruiting in numbers; Wed an acquisition programme in numbers; Fri the week's personnel and policy decisions),
   "dod": [item] (Department of Defense: Secretary, posture, budget execution, joint force),
   "news": [item] (Army and USAREUR-AF: units, exercises, equipment, people),
   "congress": [item] (NDAA, appropriations, hearings, nominations, policy with a bill or directive behind it),
   "career": {"items": [item] (boards, assignments, education, pay and benefits, as they touch a field-grade officer in Europe),
              "dates": [["YYYY-MM-DD", "milestone"]] (optional; also shown on the calendar), "note": "optional line"}},
 "makkelijk": {"niveau": "B1", "items": [{"kop","nl" (two to four short sentences in B1 Dutch),"en","woorden":[["woord","meaning"]],"src": n,"to": section id,"badge"}]} (7.5: Nieuws in makkelijke taal, four to six items retold from this edition; drawn in Home before Taal),
 "aperture": {"rota","deep":{"kind","title","body":[...],"table"},"longread":{"title","url","outlet","why"},"redteam" (Saturdays, carried on Sundays with "carried": true): {"title","actor","premise","body":["..."],"moves":[["their move","first observable"]],"assumptions":["..."],"links":[...],"src"} (7.5: contrarian, weak, number, inject and question are no longer written or drawn)
   "deep": {"kind","title","body":["para",...],"table": {"head":[...],"rows":[[...]]} | null},
   "longread": {"title","outlet","url","why"} | null, "rota": "mon|tue|wed|thu|fri|sat|sun"},
 "money": {"asof","cards":[[label,value,change,dir,note,src,series]],"ytd":[[name,pct]],"ytdSrc","driver",
   "rates":[[measure,latest,note]],"week":["…"],"fy",
   "fuel": {"asof","rows":[["Netherlands",95,diesel],...],"note","src","weekly":"Fridays"} | null},
 "nl": {"items":[item],"temp","lees":{"nl","gloss":[[word,meaning]],"src"},"phrase":{"w","en","lvl","note"}},
 "afnorth": {"intro","rows":[[date,event,action,"soon"|""]],"note"},
 "offduty": {"items":[item + "tag"] (editor's picks; the event list itself comes from events.json),"weekend": {"rows":[[day,event,place,why,cost]],"gem","family"} | null,"weather": "Fridays: KNMI weekend line" | null},
 "hockey": {
   "canes": {"result": {"date","home","hs","away","as","ot":bool,"venue","lines":["…"],"src"} | null,
             "noGame": "text when Carolina did not play",
             "next": [[localDate, opponent, "20:00 ET", "Wed 02:00 CET", watchLive:bool]], "nextSrc"},
   "scores": [[away, awayGoals, home, homeGoals, ""|"OT"|"SO"|"pending"]], "scoresDate", "scoresNote", "scoresSrc",
   "news": [item] (3–5)
 },
 "planner": {
   "events": [[date,"nl|be|de|us|mkt|pro",label,where,what,effect,priority?]] (only what calendar.json does not already hold; a 7th element true puts the row in This week),
   "season": {"title","intro","from","to","ticks","rows":[{"name","sub","color","segs"}],"notes"} | null,
   "otd": {"title","body"}, "culture": {"title","body"} | null},
 "research": [piece, piece, piece] (7.1: three a day; the first has field "military", the other two come from the wider fields in research.json; an older edition's single object still renders), where piece = {"field","org","title","authors","date","kind":"brief|report|article|monograph|CRS report|paper|working paper","length":"24 pp","src":n,
   "summary":["para",...] (what it argues and shows, 150–250 words), "findings":["…"] (3–6 bullets with the numbers), "table": {...} | omitted,
   "method":"how it was done and what it cannot show", "sw":"For Brunssum line on the military piece, a So what on the others", "links":[...], "badge":"NEW"},
 "philosophy": {"thinker","work","where" (book, chapter or section),"year","tradition","quote" (exact, from a named edition or translation),"translation","gloss" (two to five sentences on the idea in plain words, with the objection a good student would raise),"why" (one question for the day, optional),"src":n} (7.1: one a day),
 "weekreview": {"title","body":["para",...],"rows":[[date,text]]} | omitted (Sundays: the week ahead, dated; the page adds a computed week-behind scorecard),
 "sources": [[n,title,outlet,url,tier]], "flags": "…", "changelog": [[date,text]]
}
```

`item` may also carry `"links": [...]` (see Text conventions).

`item` = `{"h","tag","conf","badge","body","sw","fy"}` (all optional except `h`).

Defence items carry priority-topic tags in `tag` (several separated by ` · `): `Autonomy` (AUTOWARCOM and defence autonomy), `Leaders' words`, `SOF`, `Strategy`, `Posture` (posture and basing), `Force design`. The page counts them in a chip row at the top of Defence & Army so gaps are visible; other tags (DoD, Army, USAREUR-AF, NATO, a country) stay allowed.

The World feature rota: Monday "Theatre in numbers" (table), Tuesday "Actor on the record" (dated quotes, table of capabilities), Wednesday "Trend line" (`series`), Thursday "Chronology" (`timeline`, 30 days), Friday "Week on the board" (table of what moved per theatre), Saturday "Geography" (`geo` schematic), Sunday "The record" (`timeline` over 12 months plus `series`). A worked example is in `data/examples/edition-4.0-sample.json`.

### Page changes on 8 Nov (format stays 7.3)

- Markets & economy is its own tier, `money`, with a Markets tab in the sticky header, between The news and The reading (at weekends after The news, as The reading leads). It holds the `markets` section (cards, driver, year to date, the USD/EUR tracker, the pump price) and `rates`; `nl` closes The news. `five[].part` "money" points there.
- `money.cards` is twelve cards, each with a series key in its seventh field so every card draws a sparkline: S&P 500 `spx`, Dow `dji`, Nasdaq `ndx`, Russell 2000 `rut`, AEX `aex`, Stoxx 600 `stoxx`, DAX `dax`, VIX `vix`, Brent `brent`, Dutch TTF gas `ttf`, gold `gold`, US 10-year `us10y`, in that order (six rows of two on phones, three rows of four on wide screens). No USD/EUR card: the tracker carries it.
- The USD/EUR tracker moves from The watch into Markets & economy, after the year-to-date bars; its jump id stays `fx`. The edition's USD/EUR card in `money.cards` is still written but hidden on the page while the tracker shows, since the tracker carries the same figure. The watch has nine sections.
- New block `fuel` (jump id `fuel`) under the tracker: the Euro 95 (E10) pump price in the Netherlands in US dollars per gallon, from `data/fuel.json` and `data/fx.json`.
- The Today strip's Markets tile adds a Brent row from `series.json` (last close, change in the tooltip) when the edition's `today.markets` has no Brent row; `today.markets` stays four rows.

### Page changes on 3 Nov (format stays 5.0)

- This week lists only holidays, AFNORTH days, bins, deadlines, career dates, Christmas markets opening, events with `prio`, planner rows with the priority flag, exercise start and end dates, and Canes games that start between 07:00 and 22:59 CET. Spans show on their first and last day only.
- New section `weather` in the Planner: the seven-day forecast from `today.weather.week`, today's sunrise, sunset and day length, and the daylight curve (moved out of School year).
- The NATO spending table shows only in the week NATO publishes. The Congress tracker shows only what moved in 7 days; the register is compact chips coloured by state. The exercise calendar is one line per exercise. Readbook health lists act and watch items and puts the ok checks on one line.

### Changes from v5.0

- The page is organised in five tiers (Today, The news, The watch, The reading, Home and planning); every edition object stays where it was, so no field moved. Jump ids added: `research`, `congress-sec`, `exercises-sec`, `production`, `depth`, `ttpsec`, `since`, `year`, `weekreview`, `tv` (6.1). Decisions due was removed in 6.1.
- `sources` rows gain the tier field; items gain optional `links`; `weekreview` added for Sundays.
- `"v": "7.0"` (6.0 to 6.5 still validate). 7.0 reorders the page: the Brief (takeaways, what changed, what to watch, what we do not know, indicators), then The news, The reading and The watch (each tracker showing its last ten log entries), then Home and planning. On Saturdays and Sundays The reading comes before The news. New watch sections: Ukraine in detail (inside the board), Indicators and warning (inside Numbers and indicators), Forecast ledger; 7.2 merged the exercise calendar into Horizon, Decisions due and From your mail into Coming up, and the School year and season gantts into The year ahead.

### Changes from v4.0

- New edition objects: `nato`, `deftech`, `frontier`, `army.depth`. Jump ids added: `congresstracker`, `nato`, `exercises`, `deftech`, `frontier`, `releases`, `sota`, `snow`.
- The Off duty section became Out and about: events live in `events.json`; `offduty.items` are editor's picks only.
- Dutch corner became Taal: the idiom of the day comes from `idioms.json`; `nl.lees` and `nl.phrase` stay.
- `five[].part` may be `"frontier"`.
- `"v": "5.0"`.

### Changes from v3.0

- `world` is an object (items, numbers, feature) instead of an array; the World part is Part 1, before Security.
- `planner.calFrom`, `calTo`, `school`, `open` are gone: the page draws any month from the merged calendar and reads school breaks from `calendar.json`. `planner.events` only carries what the standing calendar does not already hold.
- `today.weather.week` added (7-day forecast for the week strip).
- `five[].part` may be `"world"`; `to` may be `board`, `world`, `numbers`, `feature`.
- `army.items` is split into `dod`, `news`, `congress` and `career` (3.0 editions with `items` render under Army and USAREUR-AF). Jump ids: `army`, `dod`, `armynews`, `congress`, `career`.
- `"v": "4.0"`.

## Standing files

### `data/congress.json`

`{ "items": [ {"id","kind":"bill|budget|nomination","title","number","post","org","nominee","stage","dates":{"<stage>":"YYYY-MM-DD"},"deadline","status","committee","next","added","updated","src"} ] }`. Stages: bill = introduced, committee, house, senate, conference, enacted (status "stalled" or "vetoed" greys the pipeline); budget = request, house, senate, cr, enacted, with `deadline` for the next expiry; nomination = vacant, announced, nominated, hearing, committee, floor, confirmed, or withdrawn. The page shows only rows that moved in the last 7 days (a stage date, `added` or `updated` within 7 days) or carry a deadline within 21 days, as compact cards coloured by state (red vacant, blue in the pipeline, amber stopgap, green confirmed or enacted, grey stalled or withdrawn); every other open row is one line under "Open, no change this week". So the run only touches a row when something happened, and never sets `updated` without a change.

The same file carries `tiers` and `watch`: the register of posts the confirmations lane follows (`{"id","post","tier":"army|joint|cocom|army4|europe","senate":bool,"holder","since","acting","src","updated"}`). A nomination row carries `postId` to link it to its post. The page shows the register as small chips per tier, coloured by state (red vacant, blue nomination in progress, amber acting, green confirmed in the last 30 days, grey filled, dashed not yet sourced), and lists only the exceptions by name.

### `data/exercises.json`

`{ "exercises": [ {"id","name","from","to","dateText","lead","where","forces","status":"planned|under way|complete","added","updated","src"} ] }`. Feeds the Planner (category Exercises; This week shows only the start and end dates) and the one-line-per-exercise calendar in Profession, which lists exercises under way or announced and those ended in the last 7 days. `dateText` replaces the date range when the dates are not firm (for example "early 2027").

### `data/releases.json`

`{ "releases": [ {"id","date","kind":"model|chip|robot|autonomy|result|tool","t","lab","n","src"} ], "sota": {"asof","rows":[{"domain","group":"Models|Media|Physical|Compute","system","lab","cc","open":bool,"metric","score","unit","since","runner":{"system","lab","score"},"changed":bool,"note","src":[[n,title,outlet,url]]}]} }`. The release log shows the last 45 days; `sota` is rewritten on Fridays. The page shows a summary strip (leads by country, leads changed this week, open-weights leaders, longest-held lead), a bar chart of days each lead has been held, then one card per domain grouped by `group` with the lab, country and open-weights chips, the metric and score, the challenger and gap on the same metric, the lead date and the note. The older array form `[domain, system, lab, since, src]` still renders.

### `data/local.json`

`{ "updated", "asof", "town", "errors": [], "air": {"src","days":[{"date","aqi","pm10","pm25","uv","pollen":{...}}],"lki":{"station","value","time","src"}}, "power": {"src","note","days":[{"date","hours":[[hour,eurPerKwh]],"avg","cheapest3":{"from","to","avg"},"dearest3"}]}, "maas": {"src","unit","thresholds":{"amber","red","note"},"days":[[date,discharge,max]]}, "sky": {"src","now":{"time","kp"},"max3d":{"time","kp","scale"},"note"}, "roads": {"src","asof","count","highSeverity","items":[{"km","lat","lon","type","cause","mgmt","by","from","to","sev"}]}, "rail": {"src","total","items":[{"id","date","t","url"}],"asof"}, "notices": {"src","count","items":[{"id","date","t","url"}]}, "news": {"src","items":[{"id","t","en","url"}],"asof"}, "woord": [{"date","word","meaning_nl","meaning_en","example","example_en","uitspraak":{"ipa","say","tip"},"note","src"}], "culture": [{"date","end","t","prio","verified","note","src"}], "admin": [{"date","t","verified","note"}], "roda": [{"date","opp","home","time","src"}], "shops": {"koopzondag","weekmarkt"}, "flu": {"t","src"} | null, "noise": {"h","t","src"} | null }`. The page draws Parkstad today at the top of Home and planning (six tiles, the notices, six L1 headlines, the local calendar), the Limburgs word in Taal, and feeds `culture` and `admin` into the planner, the week board and Coming up. The `maas-glofas` indicator reads `maas.days`.

### `data/energy.json`

`{ "updated", "asof": "YYYY-MM", "vat": "included", "src": [[title,url]], "api", "region", "typical": {"kwh","m3","note"}, "note", "months": [ {"m": "YYYY-MM", "elec": {"var","tax","ode","dyn","net","fixed"}, "gas": {"var","tax","ode","net","fixed"}, "rebate"} ] }`. Prices per kWh and per m³ with VAT; `net` and `fixed` and `rebate` per year. The page shows electricity and gas all-in (var + tax + ode) with 24-month sparklines, a typical-home annual estimate and the fixed charges, in Markets under Household energy.

### `data/fuel.json`

Written by `tools/fuel.js`: `{ "updated", "source", "url", "note", "unit": "EUR per litre", "series": { "nl-e95": [["YYYY-MM-DD", 2.284], ...], "nl-diesel": [...] } }`, ascending, about 400 days, CBS weighted national averages including VAT and excise (Euro 95 is sold as E10). The page converts Euro 95 to US dollars per gallon with the ECB rate of the same day from `fx.json` (the last one before it at weekends; 1 US gallon = 3.785411784 litres) and shows it in Markets & economy under the USD/EUR tracker: the latest price in dollars per gallon and euros per litre, the change over a week, a month and a year, a 90-day or one-year chart, and the cost of a 50-litre tank. The Friday `money.fuel` table gains a Euro 95 dollars-per-gallon column computed the same way. The validator checks order and range and warns when the last CBS day is more than 12 days old. `cars` (7.3) lists the household cars as `{"id","name","litres","fuel":"e95|diesel","note"}`; tools/fuel.js keeps the key. The page multiplies the day's pump price by each tank and converts at that day's ECB rate: one card per car (today, a year ago, the 12-month high and low in dollars) and a 12-month chart with rises in red and falls in green.


### `data/inbox.json`

`{ "updated", "items": [ {"id","date","end","time","t","note","src":"AFNORTH|PTA|MWA|CYS|TRAVEL|TICKETS","added","url"} ] }`. Shown as "From your mail" in Home and planning (next 45 days), on the week board, on the calendar (category From your mail) and in the Brief's What to watch. The validator rejects ticket or order numbers and tracking links.

### `data/indicators.json`

`{ "updated", "items": [ {"id","name","theatre","country","congress","threshold","series","rule":"mean7|incidents7|fx","status":"green|amber|red","src","history":[{"date","status","t"}]} ] }`. 7.3 adds `cyber-kev-7d` (CISA Known Exploited Vulnerabilities added in 7 days, from the JSON feed) and `ecdc-threats` (new EU/EEA event in the ECDC weekly Communicable Disease Threats Report). The page draws the status row in the Brief, lists the ones that changed in two days, and the board in The watch with the current value for numeric rules, the last change and the last eight changes as a strip.

### `data/forecasts.json`

`{ "updated", "items": [ {"id","q","p","made","resolves","domain","theatre","country","congress","status":"open|yes|no|void","why","resolvedDate","note","src"} ] }`. The page shows open calls with a probability bar, resolved calls with their Brier contribution, and the mean Brier score, calibration and open count; the Sunday review counts the week's resolutions.

### `data/questions.json`

`{ "updated", "items": [ {"id","q","thread","opened","status":"open|closed","closed","answer","src"} ] }`. `thread` is a link id (`theatre:`, `thread:`, `country:`, `novel:`, `congress:`). Open questions show in the Brief under "What we do not know".

### `data/ua-front.json`

Written by `tools/uafront.js`: `{ "asof", "asofText", "countries": {ISO: rings}, "occupied", "occupied2014", "unknown", "liberated": [rings], "arrows": [[lat, lon]] }`, coordinates [lon, lat] rounded to 0.001. Drawn in the Ukraine panel of The watch.

### `data/novel.json`

The page shows the last ten entries in full and folds the rest into a one-line index by month (7.5); nothing is deleted from the file.

`{ "updated", "domains": {code: label}, "items": [ {"id":"YYYY-MM-DD-slug","date","theatre","actor","t","what","new","domains":[codes],"src":[[n,title,outlet,url,tier]],"edition","prev"} ] }`. Append-only. `what` carries the facts with citations into `src`; `new` is one or two sentences on the mechanism in the reporters' and actors' terms, with no assessment language (the validator rejects it). The page shows the section "New in war" in The watch after the board, with 90-day domain and theatre bars and one card per entry, newest first; a news item whose `links` include `novel:<id>` is marked NEW USE.

### `data/countries.json`

`{ "updated", "blr": [seven requirement names], "countries": [ {"id":"hu|sk|de|ru|by|cn","name","role":"priority|secondary|context","gov":{"head","title","party","since","majority","president","fm","defmin"},"election":{"last","due","next","dateText","snapFrom","snapNote"},"nato":{"member","spend","posture":[...]},"spend":{"pct":[[year, pctOfGDP]],"src","note","verified"},"stance":[{"k","t"}],"blr":[{"n":1-7,"t","date"}],"log":[{"date","t","src":[[title,url]]}],"src":[[title,url]],"verified":bool} ] }`. The file also carries `map` (`points` with `n`, `s` short label, `lat`, `lon`, `k` hq|force|capital|energy; `lines` with `n`, `k` gas|oil, `pts` as [lat, lon]) drawn on the section map over the outlines in `data/ceu.json` (Natural Earth, static). The page draws the map, a defence-spending chart from `spend.pct` with the 2% and 3.5% guides, an election clock from `election.last` to `election.due` (hatched from `snapFrom`), a seven-cell resilience grid lit where `blr` has a note, a 12-week log-activity bar, and one profile card per country in The news after Europe, with the seven-baseline-requirement notes numbered, the last four log entries, and today's `countries` items beneath. Items link with `country:hu`. Health flags the file when no log entry is younger than 7 days.

### `data/events.json`

`{ "events": [ {"id","t","cat":"music|markets|museums|sport|kids|food|outdoors|festival","from","to","town","venue","cc","drive":minutes,"cost","kid":bool,"prio":bool,"added","updated","src"} ] }`. Radius about 90 minutes by car. The page shows This weekend (Friday to Sunday) and Next 30 days with category chips, and feeds the calendar. Only events with `"prio": true` (a handful: major festivals, the carnival opening, a Sinterklaas arrival in Parkstad) appear in This week; long-running exhibitions never do.

### `data/idioms.json`

`{ "idioms": [ {"date","lang":"nl|fr|it","phrase","literal","meaning","example","register","note"} ] }`. One per day, rotating languages; the page shows today's and a review line (yesterday, a week ago, a month ago).

### `data/ski.json`

`{ "season": ["12-01","03-31"], "resorts": [{"id","name","cc","area","lat","lon","drive","top","modelElevation"}], "snow": { "<id>": {"asof","depthCm","days":[[date, newSnowCm, tMax, tMin]]} } }`. Shown 1 Dec to 31 Mar only (the `season` window), whatever the date of the data. Refreshed daily from Open-Meteo in season (`daily=snowfall_sum,temperature_2m_max,temperature_2m_min&hourly=snow_depth`); outside the season the run leaves the file alone.

### `data/search-index.json`

`{ "editions": [ {"date","edition","hits":[{"t","to","w"}]} ] }`. One block per edition with the headlines of five, world, feature, europe, euregio, leads, incidents, army groups, nl, offduty picks and hockey news. The page searches this file and falls back to downloading editions when it is missing.

### `data/conflicts.json`

```
{ "theatres": [ { "id": "ru-ua", "name": "Russia–Ukraine", "short": "Ukraine", "lp": "above", "lat": 48.5, "lon": 35.0,
    "log": [ {"date": "2026-11-03", "t": "Fact sentence(s) with citations. [14, 18]", "src": [[14,"title","outlet","url"], ...]} ] } ] }
```

Eleven theatres (the Arctic and High North added 7 Nov 2026). Append one entry per theatre per day it had a reportable event, copying the cited source rows into `src`. Never edit or delete entries; do not add status fields. The page orders rows by last entry, draws a four-week activity bar from the dates, sizes the map marker by the 7-day count, and shows NEW when the last entry is today, UPDATED when yesterday. `short` and `lp` (above, below, left, right) place the map label.

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

### `data/research.json`

`{ "fields": {code: label}, "rotation": {field: [institutions and journals]}, "queue": [{"field","org","title","authors","date","url","for","note"}], "covered": [{"date","field","org","title","authors","url"}] }`. The page shows the last fifteen covered with their field and the open queue under the day's pieces; health expects three pieces a day with one military, and flags an institution repeated within 10 days in the same field.

### `data/philosophy.json`

`{ "updated", "traditions": [...], "covered": [{"date","thinker","work","tradition"}] }`. Serious philosophy only: the `canon` list names the pool (Plato to Parfit, Kant, Hegel, Nietzsche, Kierkegaard, Arendt and their peers). Append one row per edition; no thinker within 30 days, no work within 90; touch every tradition within a fortnight.

### `data/teams.json`

`{ "updated", "saints": {"name","abbr","league","season","record","standing","src","games":[{"date","opp","home","pf","pa","res","week"}],"upcoming":[{"date","opp","home","utc","week"}]}, "cardinals": {"name","abbr","league","season","status","record","last","src","springTraining":{"date","opp","home","note"},"opener":{"date","opp","home","utc","note"},"games":[],"upcoming":[]} }`. Shown as "Also following" under the Hurricanes, on the calendar (category Saints & Cardinals), in the countdowns and, when a game is watchable between 07:00 and 22:00 CET, on the week board. `record` must match `games`.

### `data/tv.json`

`{ "updated", "shows": [{"id","tvmaze","title","where","status","last":{"s","e","date","name"},"next":{"s","e","date","name","time"}|null,"note","src":[[title,url]]}], "similar": [{"title","where","like":[ids],"why"}] }`. The TV section in the Planner sorts shows by next air date, puts the next episode on the week board, the calendar (category TV) and the countdowns, and lists `similar` under "If you like these". Since 7.5 the suggestions live in `recs.pool` as `{"title","lang":"nl|vls|it|de|en|fr","where","like":[show ids],"why"}`; the page rotates three a day by date (one Dutch or Flemish, one Italian, one other) and folds the rest by language.

### `data/week.json`

`{ "items": [ {"date","end","t","note","time","url","act":bool} ] }`. Hand-maintained by Nick. `time` (e.g. "16:00–17:00") joins the title; `url` is a join link shown with the note. Entries appear on the week board, the calendar (category Yours), the year-ahead board. `act` is kept for compatibility and no longer changes the page. Names and dates only.

### `data/corrections.json`

`{ "items": [ {"date","edition","section","t","src"} ] }`. Append-only. The footer shows the last 30 days.

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
`{ "spx", "dji", "ndx", "rut", "aex", "stoxx", "dax", "brent", "ttf", "gold", "us10y", "vix" }`, 30 trading days each, last close only, every key a list of `["YYYY-MM-DD", close]`. Yahoo Finance chart API tickers: ^GSPC, ^DJI, ^IXIC, ^RUT, ^AEX, ^STOXX, ^GDAXI, BZ=F, TTF=F, GC=F, ^VIX; `us10y` is the 10-year par yield from the US Treasury daily yield curve. Each key feeds the sparkline of the money card that names it in its seventh field; the page also matches cards by label. `ndx` is the Nasdaq Composite, `brent` the ICE front month in $/bbl, `ttf` the TTF front month in €/MWh.

#### incidents.json
As before, plus `attrLog`: `[{"id","date","from","to","t","src"}]`.

## Compatibility

- A 5.0 edition renders in the five tiers unchanged; "About this edition" says source tiers are not assigned and the health section flags it until the prompt catches up.
- A 4.0 edition renders with the Profession, Frontier and Home sections showing their standing-file content and quiet lines for the missing edition objects.
- A 3.0 or 2.5 edition whose `world` is an array renders it under Developments; the board, the numbers and the planner come from the standing files; the feature block says there is none.
- A 2.5 edition's `planner.threads` and `planner.horizon` still render when the standing files are empty; `planner.school` renders when `calendar.json` is missing.
- When `fx.json` is missing the USD/EUR tracker and tile are hidden; when a series key is missing the card has no sparkline; when `canes.json` is missing the Hockey part falls back to the edition's `hockey.canes.record`.
