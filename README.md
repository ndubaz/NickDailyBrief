# Nick's Daily Readbook

A personal daily briefing, installed on the iPhone as a home-screen web app. Static site: no build step, no server code. Version 3.0.

## How it works

- `index.html`, `app.js`, `styles.css`, `sw.js` draw the page. They don't change day to day.
- Each morning a scheduled Claude task writes `data/editions/<date>.json`, updates `data/index.json` and the standing files, commits to `main`, and Vercel redeploys automatically.
- Past editions stay in `data/editions/` and are reachable from the "Past editions" picker and the archive search at the bottom of the page.
- `data/SCHEMA.md` documents the edition format and every standing file.

## The page

One scroll: Front (masthead, Today strip, Five things, Today and tomorrow), then Part 1 Security, Part 2 Watchlist, Part 3 Profession, Part 4 Money, Part 5 Home, Part 6 Hockey, Part 7 Planner (folded except on Mondays), and the footer with Sources, Past editions, Archive search and the changelog. The sticky header has jump chips per part and a "New only" toggle that hides everything without a NEW or UPDATED badge (remembered on the phone).

## The memory model

The edition is a daily snapshot. The standing files under `data/` are the Readbook's memory: the morning run edits them, the page reads them, and nothing on the page ever writes.

| File | Holds | Shown as |
|---|---|---|
| `data/threads.json` | Tracked threads with a dated log per thread and the sources behind each entry | Watchlist · Tracked threads |
| `data/horizon.json` | Dated upcoming events with status and sources | Watchlist · Horizon |
| `data/incidents.json` | Running hybrid incident log plus `attrLog`, the attribution changes | Hybrid map, 30-day charts, Attribution moves, Within 100 km |
| `data/fx.json` | Two years of ECB EUR/USD reference rates | Today strip tile and the EUR/USD tracker in Money |
| `data/series.json` | Thirty trading days per market series | Sparklines on the market cards |
| `data/canes.json` | Carolina's regular-season results, record, points and Metro position | Season strip and record line in Hockey |
| `data/bins.json` | Rd4 collection dates | Bin day tile |

Editions in the 2.5 format still render: when the standing files are missing or empty, the page falls back to the edition's own threads and horizon, hides the EUR/USD tracker and skips the sparklines.

## One-time setup

1. **Vercel:** import this repository as a new project. Framework preset: *Other*. Build command: none. Output directory: the repository root.
2. **iPhone:** open the site in Safari, tap Share, then *Add to Home Screen*. It opens full screen like an app and keeps the last edition and standing files for offline reading.
3. **Privacy:** the page is personal (name, town, family school calendar). Keep the repository private and turn on Vercel Deployment Protection for the production URL if your plan allows it. The site already sends `noindex` and blocks crawlers, but that is not access control. Never put a home address, postcode or house number in the repository.
4. **Bin day:** add the Rd4 collection dates to `data/bins.json` (`[["2026-11-04","GFT"], ...]`).

## Keeping fx.json current by hand

The morning run appends one row per ECB business day from the ECB history ZIP (`https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip`; the `.csv` at the same path has served a stale test file, so use the ZIP). If the download fails, add the missing days yourself:

1. Read the rate from the ECB's daily page: https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html (USD per euro, four decimals).
2. Append `["YYYY-MM-DD", 1.1216]` to the end of `series` in `data/fx.json`, one entry per business day, in date order, no duplicates. Skip weekends and ECB holidays.
3. Set `updated` to the last date you added, then validate: `python3 -c "import json; json.load(open('data/fx.json'))"`.

Entries older than two years can be dropped from the front of the array; the page needs about 13 months for the one-year view and the 12-month best and worst.

## Local preview

```
python3 -m http.server 8000
```

then open http://localhost:8000. Validate every data file before committing:

```
for f in data/*.json data/editions/*.json; do python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$f" || echo "BAD $f"; done
```
