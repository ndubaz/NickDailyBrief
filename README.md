# Nick's Daily Readbook

A personal daily briefing, installed on the iPhone as a home-screen web app. Static site: no build step, no server code. Version 5.0.

## How it works

- `index.html`, `app.js`, `styles.css`, `sw.js` draw the page. They don't change day to day.
- Each morning a scheduled Claude task writes `data/editions/<date>.json`, updates `data/index.json` and the standing files, commits to `main`, and Vercel redeploys automatically.
- Past editions stay in `data/editions/` and are reachable from the "Past editions" picker and the archive search at the bottom of the page.
- `data/SCHEMA.md` documents the edition format and every standing file. `data/examples/edition-4.0-sample.json` is a worked example of the 4.0 edition shape (not an edition; it is not listed in `index.json`).

## The page

One scroll, everything expanded, nothing folded: Front (masthead, Today strip, Five things, Today and tomorrow), then Part 1 The World, Part 2 Security, Part 3 Watchlist, Part 4 Profession (Defence & Army with a Congress tracker, NATO & European militaries with an exercise calendar, Defence tech, Aperture), Part 5 Frontier (tech and AI releases, the release log, the Friday state-of-the-art table), Part 6 Money, Part 7 Home (Netherlands, AFNORTH, Out and about within 90 minutes, Taal with a daily idiom, Snow in season), Part 8 Hockey, Part 9 Planner, and the footer with Sources, Past editions, Archive search and the changelog. The sticky header has jump chips per part and a "New only" toggle that hides everything without a NEW or UPDATED badge (remembered on the phone).

The World part is facts and summaries only: the board (ten theatres on a schematic map, each with a dated log and a four-week activity bar), overnight developments, a "By the numbers" row of open-source series with sparklines, and one feature a day on a seven-day rota (theatre in numbers, actor on the record, trend line, chronology, week on the board, geography, the record). The page draws every chart from data: tables, series, timelines and geography schematics come from the edition; no hand-made images.

The exchange rate is shown everywhere as USD/EUR, euros per dollar. The three typefaces are self-hosted in `fonts/` (all SIL Open Font License) and precached, so the page looks the same offline. The masthead has a theme control (auto, light, dark) and a status line that says when the data was loaded and whether the phone is offline.

The footer ends with **Readbook health**: 24 checks computed on the page (format drift, run cadence, read time, empty and quiet sections, freshness of every standing file, coverage running out). "Act" means the data model or the task prompt needs work.

`node tools/validate.js` checks the latest edition and every standing file (citations, jump ids, the USD/EUR rule, the no-assessment rule for the World part, record and series lengths). The morning run executes it before committing.

## The memory model

The edition is a daily snapshot. The standing files under `data/` are the Readbook's memory: the morning run edits them, the page reads them, and nothing on the page ever writes.

| File | Holds | Shown as |
|---|---|---|
| `data/conflicts.json` | Ten theatres with a dated log of facts and sources per theatre | The board: map, activity bars, logs |
| `data/world-series.json` | Dated open-source counts (daily or weekly) | By the numbers tiles; the Wednesday and Sunday charts |
| `data/threads.json` | Tracked threads with a dated log per thread and the sources behind each entry | Watchlist · Tracked threads |
| `data/horizon.json` | Dated upcoming events with status and sources | Watchlist · Horizon; the calendar; countdowns |
| `data/incidents.json` | Running hybrid incident log plus `attrLog`, the attribution changes | Hybrid map, 30-day charts, by-country bars, Attribution moves, Within 100 km |
| `data/fx.json` | Two years of ECB reference rates, stored as dollars per euro | USD/EUR tile, tracker, monthly pay bars |
| `data/series.json` | Thirty trading days per market series | Sparklines on the market cards |
| `data/canes.json` | Carolina's results, upcoming games, record, points, Metro position | Results strip, next-ten strip, season chart, calendar, countdown |
| `data/calendar.json` | Public holidays, school breaks for four systems, clocks, market seasons, 18 months | Calendar, week strip, countdowns, school overlap chart |
| `data/deadlines.json` | Nick's own deadlines, hand-maintained, never touched by the run | Deadlines table, calendar, week strip |
| `data/bins.json` | Rd4 collection dates | Bin day tile, calendar, countdown |
| `data/congress.json` | Key defence bills, the budget cycle, confirmations, and the register of 38 watched posts (Army leadership, Joint Staff, combatant commands, Army four-star commands, Europe-based general officers) | Congress tracker in Profession, deadlines on the Planner |
| `data/exercises.json` | NATO and allied exercises with dates | Exercise calendar, Planner |
| `data/releases.json` | Dated AI and tech releases, plus the Friday state-of-the-art table | Frontier |
| `data/events.json` | Curated events within about 90 minutes, with sources | Out and about, calendar, week strip |
| `data/idioms.json` | The idiom bank, one a day in Dutch, French or Italian | Taal |
| `data/ski.json` | Twelve resorts and a daily Open-Meteo snow forecast | Snow, December to March |
| `data/search-index.json` | Headlines per edition | Archive search |

Editions in the 2.5, 3.0 and 4.0 formats still render: an edition whose `world` is an array shows under Developments, and the page falls back to the edition's own threads, horizon and school rows when a standing file is missing.

## Keeping your own files current

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
