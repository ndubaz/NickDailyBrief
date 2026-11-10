# Nick's Daily Readbook

A personal daily briefing, installed on the iPhone as a home-screen web app. Static site: no build step, no server code. Version 7.0.

## How it works

- `index.html`, `app.js`, `styles.css`, `sw.js` draw the page. They don't change day to day.
- Each morning a scheduled Claude task writes `data/editions/<date>.json`, updates `data/index.json` and the standing files, commits to `main`, and Vercel redeploys automatically.
- Past editions stay in `data/editions/` and are reachable from the "Past editions" picker and the archive search at the bottom of the page.
- `data/SCHEMA.md` documents the edition format and every standing file. `data/examples/edition-4.0-sample.json` is a worked example of the 4.0 edition shape (not an edition; it is not listed in `index.json`).

## The page

One scroll in seven tiers, everything expanded. Only three things fold: the calendar agenda beyond two weeks, the numbered source list in the footer (a citation number opens it at the right line) and the changelog. Logs read as dated run-in lines, event and horizon rows are single lines where they can be, and tables stack into cards only when their cells are long. Every growing record has a bound on the page: board and thread logs show their last ten entries, threads quiet for a month fold into an index, green indicators compact to one line each, New in war folds beyond ten, ended TV shows become one line, and the validator warns when a file should be pruned or compacted:

1. **The Brief.** Masthead with the last-run time, the Today strip (weather, sun and moon, the Canes, markets with Brent, USD/EUR, bin day, your next three dated items, the new count), the takeaways (numbered, factual, written last by the run), the pick, Today and tomorrow, what changed in the memory since yesterday, what to watch in the next seven days, what we do not know, the indicator row, and a contents block with a read time and read receipt per tier.
2. **The news.** World developments, Security (hybrid, Europe, Priority countries: Hungary, Slovakia, Germany, with Russia, Belarus and China as context profiles, then Euregio), Defence & Army (DoD, Army, Congress, Career, leaders on the record), NATO & allies, Defence tech, Frontier, Netherlands. Same item anatomy everywhere; items link to the trackers they update.
3. **Markets & economy** (its own tier and header tab since 8 Nov). Twelve market cards, each with a 30-day sparkline from `series.json` (S&P 500, Dow, Nasdaq, Russell 2000, AEX, Stoxx 600, DAX, VIX, Brent, Dutch TTF gas, gold, the US 10-year), the driver and year-to-date bars, the USD/EUR tracker with its pay bars, Household energy (CBS all-in electricity and gas, a typical home, the fixed charges), the Euro 95 pump price in US dollars per gallon with a tank for each car at the tax-exempt rate, then Rates and prices with the Friday cross-border fuel table, the week ahead and the For you line.
4. **The watch** (after The reading; at weekends The reading comes first). Nine sections: the board (map, Ukraine in detail with the DeepState front line and nightly numbers, then the theatre logs), Numbers and indicators (the indicator board, the numbers tiles, the production series), one Horizon (everything dated: the run's horizon entries, exercises, Congress deadlines, open forecasts, elections), threads, New in war, Congress and commands, the release log, the state of the art, the forecast ledger. Every log shows its last ten entries.
5. **The reading.** The World feature, Research (three recent publications a day: one military or security, two from economics, political science, international relations, social movements, history, technology policy, climate, demography, psychology or the ethics of war), the Philosophy note (one passage a day from a major philosopher, Kant to Arendt, quoted exactly and glossed), the Army in depth piece, the Saturday week in war, Aperture.
7. **Home and planning.** Parkstad today (air, power, the Maas, the sky, roads, rails, notices, L1 headlines, the local calendar), AFNORTH, Out and about (weekend first, nearest first, with the forecast), Taal, Snow in season, then the Planner: the Sunday review, the week board, Coming up (yours, deadlines, mail and work for 30 days), weather, countdowns, TV, the calendar (the agenda starts today and folds after two weeks), and the year-ahead board with the all-systems-off row, leave windows and the season notes. School dates sit under AFNORTH.
6. **Sports.** The Hurricanes (results, next games, the game report, Metropolitan standings, league and club leaders, the McDavid watch, scores and NHL news), the Saints (results strip, next kick-off in CET, NFC South, team leaders, the full schedule), the Cardinals (last season, the off-season calendar, moves as they come), and Local football (Oranje, the six clubs from Sittard to Sint-Truiden with form and fixtures, the Eredivisie, Eerste Divisie and Belgian tables).

The sticky header carries one chip per tier and the "New only" toggle. Anything dated (events, deadlines, exercises, the next games, the next episodes) has a "+ cal" link that downloads a calendar file. The footer holds Sources (count, outlets and the share that is official, primary or wire; the numbered list folded beneath), Corrections, About this edition, the archive, the search and Readbook health.

Wording rules for the run are in `STYLE.md`. The exchange rate is shown everywhere as USD/EUR, euros per dollar. The three typefaces are self-hosted in `fonts/` and declared at the top of `styles.css`.

`node tools/sports.js` refreshes the Saints, Cardinals and local football feeds; `node tools/hockey.js` refreshes the NHL standings, leaders and the McDavid watch; `node tools/local.js` refreshes the Parkstad feeds (each feed retries once, times out after 30 s and keeps its last good copy on failure); `node tools/uafront.js` refreshes the Ukraine front line from DeepState; `node tools/fuel.js` refreshes the Dutch pump prices from CBS. `node tools/validate.js` checks the latest edition and every standing file (citations, jump ids, source tiers, cross-link ids, the USD/EUR rule, the no-assessment rule for the World part, record and series lengths). The morning run executes it before committing.

## The memory model

The edition is a daily snapshot. The standing files under `data/` are the Readbook's memory: the morning run edits them, the page reads them, and nothing on the page ever writes.

| File | Holds | Shown as |
|---|---|---|
| `data/conflicts.json` | Eleven theatres (incl. the Arctic) with a dated log of facts and sources per theatre | The board: map, activity bars, logs |
| `data/world-series.json` | Dated open-source counts (daily or weekly) | By the numbers tiles; the Wednesday and Sunday charts |
| `data/threads.json` | Tracked threads with a dated log per thread and the sources behind each entry | Watchlist · Tracked threads |
| `data/horizon.json` | Dated upcoming events with status and sources | Watchlist · Horizon; the calendar; countdowns |
| `data/incidents.json` | Running hybrid incident log plus `attrLog`, the attribution changes | Hybrid map, 30-day charts, by-country bars, Attribution moves, Within 100 km |
| `data/fx.json` | Two years of ECB reference rates, stored as dollars per euro | USD/EUR tile, the tracker in Markets & economy, monthly pay bars, the pump price in dollars |
| `data/fuel.json` | About 400 days of CBS daily average pump prices in the Netherlands (Euro 95 E10 and diesel, euros per litre), rewritten by `tools/fuel.js`, plus `cars` with the two tank sizes | Pump price in Markets & economy: dollars per gallon at each day's ECB rate, week, month and year changes, a 90-day or one-year chart, a 50-litre tank |
| `data/series.json` | Thirty trading days per market series | Sparklines on the market cards |
| `data/canes.json` | Carolina's results, upcoming games, record, points, Metro position | Results strip, next-ten strip, season chart, calendar, countdown |
| `data/calendar.json` | Public holidays, school breaks for four systems, clocks, market seasons, 18 months | Calendar, week strip, countdowns, school overlap chart |
| `data/deadlines.json` | Nick's own deadlines, hand-maintained, never touched by the run | Deadlines table, calendar, week board |
| `data/week.json` | Nick's own dated entries (TDY, duty, travel), hand-maintained | Week board, calendar, year ahead |
| `data/teams.json` | Saints and Cardinals: record, results, next games, refreshed by the run from the ESPN and MLB feeds | Also following, calendar, countdowns |
| `data/tv.json` | Followed shows with last and next episodes from TVMaze, renewal notes, and similar shows | TV section, week board, calendar, countdowns |
| `data/research.json` | Research rotation by field: institutions and journals per field, the queue, the log of pieces covered | Research in The reading, three a day |
| `data/philosophy.json` | Traditions rotation and the log of philosophy notes | Philosophy note in The reading |
| `data/corrections.json` | Corrections appended by the run | Footer |
| `data/bins.json` | Rd4 collection dates | Bin day tile, calendar, countdown |
| `data/congress.json` | Key defence bills, the budget cycle, confirmations, and the register of 38 watched posts (Army leadership, Joint Staff, combatant commands, Army four-star commands, Europe-based general officers) | Congress tracker in Profession, deadlines on the Planner |
| `data/exercises.json` | NATO and allied exercises with dates | Exercise calendar, Planner |
| `data/releases.json` | Dated AI and tech releases, plus the Friday state-of-the-art table | Frontier |
| `data/feeds.json` | The fetch-first register: 59 RSS feeds, listing pages and APIs by section, and the hosts that block scripts; the run reads these before spending a web search | Not drawn; steers the run |
| `data/local.json` | Parkstad daily life: air and pollen, day-ahead power, the Maas model, the Kp forecast, road works within 25 km, Limburg rail disruptions, gemeente notices for Hoensbroek, L1 headlines (tools/local.js), plus the Limburgs word, the local calendar, household admin, Roda fixtures, flu and flight noise written by the run | Parkstad today, Taal, the planner |
| `data/sports.json` | ESPN and MLB feeds: Saints standings, schedule and leaders, the Cardinals record and off-season calendar, Eredivisie, Eerste Divisie and Belgian tables with Fortuna, Roda, MVV, VVV, Genk and STVV, and Oranje fixtures (tools/sports.js) | Sports tier |
| `data/hockey.json` | NHL API: Metropolitan standings, league leaders, Hurricanes club stats and the McDavid watch (tools/hockey.js) | Hurricanes section |
| `data/energy.json` | CBS average consumer tariffs for electricity and gas, 36 months, VAT included | Markets: Household energy (all-in prices, typical home, fixed charges) |
| `data/inbox.json` | Dated items the run pulls from the school, PTA and MWA mail: dates, titles, times and places only | From your mail, week board, calendar, What to watch |
| `data/indicators.json` | Named indicators with thresholds, status and a change history | Indicator row in the Brief; Indicators and warning board |
| `data/forecasts.json` | The run's dated, falsifiable calls with probabilities, resolved on their dates | Forecast ledger with Brier score; Sunday review |
| `data/questions.json` | Open questions the Readbook is carrying, closed with the answer | What we do not know, in the Brief |
| `data/ua-front.json` | Ukraine front line from DeepState, simplified by `tools/uafront.js` on Mondays | Ukraine panel map |
| `data/novel.json` | First-seen uses of technology in war: what happened, what is new, domains, theatre, sources | New in war in The watch; NEW USE badge on the news item |
| `data/countries.json` | Profiles and dated logs for Hungary, Slovakia and Germany, plus Russia, Belarus and China as context: government, election clock, NATO posture and spending series, stances, seven-baseline-requirement notes, map points | Priority countries in The news (map, spending chart, election clocks, resilience grids), Since yesterday, health |
| `data/ceu.json` | Central Europe country outlines (Natural Earth, static) | The priority-countries map |
| `data/events.json` | Curated events within about 90 minutes, with sources | Out and about, calendar, week strip |
| `data/idioms.json` | The idiom bank, one a day in Dutch, French or Italian | Taal |
| `data/ski.json` | Twelve resorts and a daily Open-Meteo snow forecast | Snow, December to March |
| `data/search-index.json` | Headlines per edition | Archive search |
| `data/land.json` | Simplified Natural Earth land outlines (static, never edited by the run) | The board map |

Editions in the 2.5, 3.0 and 4.0 formats still render: an edition whose `world` is an array shows under Developments, and the page falls back to the edition's own threads, horizon and school rows when a standing file is missing.

## If the morning edition does not appear

The scheduled run writes its commit and must push it to `main`; Vercel deploys nothing else. When a session is given a `claude/...` branch name it can end up pushing there instead. Check `git ls-remote --heads origin` for a branch whose last commit is today's edition, then fast-forward main to it and push:

```bash
git fetch origin && git merge --ff-only origin/<branch> && node tools/validate.js && git push origin main
```

The prompt (section 8) tells the run to push to main and to say "NOT ON MAIN" first when it could not.

## Keeping your own files current

- **week.json:** add `{"date": "2026-11-20", "end": "2026-11-21", "t": "TDY Brussels", "time": "16:00–17:00", "note": "…", "url": "https://…"}` to `items`; `time` and `url` are optional and show on the board and the calendar. `act` is kept for compatibility and no longer changes the page.
- **deadlines.json:** add `{"name": "APK", "date": "2027-03-14", "note": "garage booked", "cat": "car"}` to `items`. Set `"updated"` on an item to today's date and the page badges it UPDATED for that day. Keep names generic; no addresses, plate or document numbers.
- **calendar.json:** when a ministry publishes a new school year, add its breaks under `school.<system>.segs` as `["YYYY-MM-DD", "YYYY-MM-DD", "label"]`. The AFNORTH entries come from the school's academic calendar PDF; the run completes them when it can read the PDF.
- **bins.json:** paste the next Rd4 calendar as `[["YYYY-MM-DD","GFT · after 07:00"], ...]`.

## One-time setup

1. **Vercel:** import this repository as a new project. Framework preset: *Other*. Build command: none. Output directory: the repository root.
2. **iPhone:** open the site in Safari, tap Share, then *Add to Home Screen*. It opens full screen like an app and keeps the last edition and standing files for offline reading.
3. **Privacy:** the page is personal (name, town, family school calendar). Keep the repository private and turn on Vercel Deployment Protection for the production URL if your plan allows it. The site already sends `noindex` and blocks crawlers, but that is not access control. Never put a home address, postcode or house number in the repository.

## Keeping fx.json current by hand

The morning run appends one row per ECB business day from the ECB history ZIP (`https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip`; the `.csv` at the same path has served a stale test file, so use the ZIP). If the download fails, add the missing days yourself:

1. Read the rate from the ECB's daily page: https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html (US dollars per euro, four decimals, as the ECB quotes it; do not invert, the page does that).
2. Append `["YYYY-MM-DD", 1.1216]` to the end of `series` in `data/fx.json`, one entry per business day, in date order, no duplicates. Skip weekends and ECB holidays.
3. Set `updated` to the last date you added, then validate: `python3 -c "import json; json.load(open('data/fx.json'))"`.

Entries older than two years can be dropped from the front of the array; the page needs about 13 months for the one-year view, the monthly pay bars and the 12-month best and worst.

## Local preview

```
python3 -m http.server 8000
```

then open http://localhost:8000. Validate every data file before committing:

```
for f in data/*.json data/editions/*.json data/examples/*.json; do python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$f" || echo "BAD $f"; done
```
