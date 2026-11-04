# Readbook style guide

The morning run reads this before writing. It governs every string in the edition and the standing files. Where SCHEMA.md and this file disagree, SCHEMA.md wins on structure and this file wins on wording.

## Voice

- Plain English, active voice, concrete numbers, named mechanisms, dated quotes. Write for a reader who knows the field and has ten seconds per item.
- Never use: delve, crucial, furthermore, moreover, testament, tapestry, beacon, revolutionize, "in conclusion", "it's not X, it's Y". No em dashes in prose; en dashes mark ranges (2–8 Nov, 20:00–22:00).
- No emoji, no exclamation marks, no rhetorical questions in body text (the Aperture "question for the staff" is the one exception).
- Spell out an acronym at first use in the edition, then use the acronym: "the Senate Armed Services Committee (SASC)". Service and NATO shorthand the reader uses daily (DoD, NATO, EUCOM, SACEUR, USAREUR-AF, NDAA) needs no expansion.

## Headlines

- One clause, one fact, a verb in the present or past tense, no label prefix: "Senate confirms Rudd to lead Cyber Command", not "Cyber Command: new commander confirmed".
- Under 90 characters. Numbers in the headline where the number is the news ("Oil fell 7.6% to $104.77").
- Headlines carry no attribution words ("reportedly", "sources say"); put the sourcing in the body and in `conf`.

## Bodies

- Two to five sentences. First sentence: what happened, with the date and the actor. Then the number, the quote or the document. Then what is scheduled next, dated.
- Cite at sentence end as `[12]` or `[3, 45]`. Every fact that could be contested has a citation; opinions of the writer have none because there are none in the news and watch tiers.
- Quote exactly, inside curly quotes, with the speaker, role, venue and date. Never paraphrase inside quotation marks.
- Numbers: thousands separators (1,594,830), one decimal for percentages (7.6%), currency symbol before the figure ($104.77, €93.45), units after a space (20.9 mb/d, 39 km, 155 mm). Exchange rate always USD/EUR, euros per dollar, four decimals.
- Dates: day then month (10 Nov), year only when it is not this year, times in CET with the zone named when it is not CET.
- Country and place names in English; proper names in the local spelling (Koalicja, Vastelaovend, Mestreech Geit Loos).

## Analysis and its limits

- The World part and conflicts.json are facts and summaries only: no "likely", "probably", "suggests", "signals", "we assess", "means that", no So what lines. Say what happened, who said what, what the numbers are, what is scheduled.
- In Security, Defence, Frontier, Money and Home a `sw` ("So what") line ties the item to the reader's work: one sentence, a named mechanism (a baseline requirement, a host-nation-support obligation, a budget line), never a prediction dressed as a fact. A `fy` ("For you") line names the action: book, check, hold off, ask.
- `conf` is high, moderate or low and describes the sourcing, not the writer's belief. Single-source claims go in `flags`.

## Sources and tiers

Every source row is `[n, title, outlet, url, tier]`:

1. Official or primary: government and military sites, court documents, company filings, the organisation that did the thing, transcripts.
2. Wire or secondary document: Reuters, AP, AFP, ANP, DPA, Bloomberg, the Congressional Research Service, think-tank data pages, the NHL and ECB feeds.
3. Reputable outlet: national and specialist press with named reporters and a corrections policy.
4. Other: aggregators, blogs, wikis, anonymous accounts. Use only when nothing better exists, and say so in `flags`.

Prefer the highest tier that has the fact. Never cite a wiki mirror when the official page exists. A tier-4 source alone cannot carry a headline.

## Badges, links and ids

- `badge: "NEW"` on an item's first appearance; `"UPDATED"` when a previous edition's item changed. Omit otherwise. Standing files carry no badges.
- `links` on an item name the trackers it updates: `["theatre:iran", "thread:cold-chain", "congress:ndaa-fy27", "post:usareur", "exercise:koalicja-26", "release:<id>", "event:<id>"]`. Link only to ids that exist; add the tracker entry first if it does not.
- Ids are lower-case ASCII with hyphens, dated where the thing is dated (`2026-11-04-de-uas-ramstein`), and never reused.

## Corrections

When a previous edition stated something wrong, append to corrections.json with the date, the edition, the section, what was wrong and what is right, and the source that settles it. Never edit the past edition.

## Privacy

Never write a home address, postcode, house number, plate, document number or a child's name. Town names, school names and unit names are fine.
