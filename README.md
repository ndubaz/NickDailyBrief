# Nick's Daily Readbook

A personal daily briefing, installed on the iPhone as a home-screen web app. Static site: no build step, no server code.

## How it works

- `index.html`, `app.js`, `styles.css` draw the page. They don't change day to day.
- Each morning a scheduled Claude task writes `data/editions/<date>.json`, updates `data/index.json` and the running hybrid log `data/incidents.json`, commits to `main`, and Vercel redeploys automatically.
- Past editions stay in `data/editions/` and are reachable from the "Past editions" picker at the bottom of the page.
- `data/SCHEMA.md` documents the data format.

## One-time setup

1. **Vercel:** import this repository as a new project. Framework preset: *Other*. Build command: none. Output directory: the repository root.
2. **iPhone:** open the site in Safari, tap Share, then *Add to Home Screen*. It opens full screen like an app and keeps the last edition for offline reading.
3. **Privacy:** the page is personal (name, town, family school calendar). Keep the repository private and turn on Vercel Deployment Protection for the production URL if your plan allows it. The site already sends `noindex` and blocks crawlers, but that is not access control.
4. **Bin day:** add the Rd4 collection dates to `data/bins.json` (`[["2026-11-04","GFT"], ...]`).

## Local preview

```
python3 -m http.server 8000
```
then open http://localhost:8000.
