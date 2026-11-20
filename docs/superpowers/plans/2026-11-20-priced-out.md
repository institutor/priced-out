# Priced Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static calculator site that shows a club treasurer how many surveyed students a price excludes, built from a Flashpoint survey export.

**Architecture:** Pure ES-module libraries in `site/js/lib/` hold every rule the numbers follow and are shared by the browser and by Node. Node scripts in `scripts/` turn a Flashpoint CSV export (or generated sample respondents) into one file, `site/data/dataset.json`. The site reads that file and renders six sections with no framework and no build step.

**Tech Stack:** Node 26 (`node:test`, no test dependencies), plain HTML/CSS/JS ES modules, inline SVG charts, GitHub Pages via Actions.

**Spec:** `docs/superpowers/specs/2026-11-20-priced-out-design.md`

## Global Constraints

- No runtime dependencies in the site and none added to `package.json` beyond what the Flashpoint starter already needs.
- Items, fixes, excuse ids and pledge values are exactly those in the spec's "Fixed vocabulary".
- A blank answer is missing, never zero.
- An answer at an item's slider max never counts as priced out or stretched; selectable prices run from 0 to max minus one step.
- Any figure based on fewer than 5 respondents is not shown (`MIN_CELL = 5`). Fewer than 20 respondents overall shows a pilot warning (`PILOT_N = 20`).
- When `dataset.meta.kind !== "real"` every screen shows the sample-data banner.
- The public dataset has no free text, no year and no officer flag per row.
- `.env` and `data/raw/` are never committed.
- Commit after each task. Commit messages end with the Co-Authored-By trailer.

## Review Focus

1. **Empty or tiny samples.** An item with 0 answers must show "not enough answers", never `NaN%`. Pinned in Task 2 (`sharesAt` with no rows) and Task 8 (render guard).
2. **Blank cells read as $0.** A skipped price question would count as "skips even when free". Pinned in Task 6 (`normalizeExport` blank price is `null`).
3. **Answers at the slider max.** "This much or more" must not flip to priced out at the top of the range. Pinned in Task 2.
4. **Stretch above skip, or stretch missing.** Pinned in Task 2 (`stateAt`).
5. **Small cells leaking.** An officer split or an excuse table with under 5 people must be suppressed in the dataset itself, not only hidden in the page. Pinned in Task 5.

---

### Task 1: Stats helpers

**Files:** Create `site/js/lib/stats.js`, `test/stats.test.mjs`. Modify `package.json` (add `"test": "node --test test/"`).

**Interfaces — Produces:**
- `wilson(successes: number, n: number, z = 1.96): {low: number, high: number}`; `n === 0` returns `{low: 0, high: 1}`.
- `quantile(values: number[], q: number): number | null` (linear interpolation on the sorted copy; empty returns `null`).
- `median(values: number[]): number | null`.

- [ ] Tests: `wilson(5, 10)` is about `{low: 0.237, high: 0.763}` (3 dp); `wilson(0, 10).low === 0`; `wilson(10, 10).high === 1`; `wilson(0, 0)` is `{low: 0, high: 1}`; `quantile([1,2,3,4], 0.5) === 2.5`; `median([]) === null`; input array is not mutated.
- [ ] Run `npm test`, see it fail; implement; see it pass; commit.

### Task 2: Price curve

**Files:** Create `site/js/lib/curve.js`, `test/curve.test.mjs`.

**Interfaces — Consumes:** `wilson`. A *row* is `{dues: [stretch, skip] | null, formal: ..., trip: ..., pledge: [amount, threshold] | null}`. An *item* is `{id, label, max, step}`.

**Produces:**
- `stateAt(pair: [number, number], item, price): "out" | "stretched" | "fine"`.
- `sharesAt(rows, item, price): {n, outCount, stretchedCount, fineCount, out, stretched, fine, outLow, outHigh}`; with `n === 0` every share is `null`.
- `priceGrid(item): number[]` from 0 to `max - step`.
- `curve(rows, item): Array<{price, out, stretched, outLow, outHigh}>`.
- `maxPriceFor(rows, item, maxShareOut: number): number | null`, the largest grid price whose `out` share is at most `maxShareOut`.
- `outOfAny(rows, lines: Array<{item, price}>): {n, count, share, low, high}` over rows that answered every listed item.
- `accessTier(rows, item, price, target = 0.05): {accessPrice, regained, addedRevenuePer100} | null` (null when no cheaper access price exists or nothing is regained).

- [ ] Tests, using item `{id: "formal", max: 150, step: 5}`: `stateAt([40, 70], item, 70) === "out"`; `stateAt([40, 70], item, 65) === "stretched"`; `stateAt([40, 70], item, 35) === "fine"`; stretch above skip `stateAt([90, 70], item, 65) === "fine"`; censored skip `stateAt([40, 150], item, 145) === "stretched"`; censored stretch `stateAt([150, 150], item, 145) === "fine"`.
- [ ] Tests: `sharesAt([], item, 50)` has `n === 0` and `out === null`; rows with `formal: null` are left out of `n`; four rows with skip prices 20, 40, 60, 150 give `out === 0.5` at price 40.
- [ ] Tests: `priceGrid(item)` starts at 0, ends at 145, has 30 entries; `curve` is non-decreasing in `out`; `maxPriceFor` on the four rows with `maxShareOut = 0.25` is 35; returns `null` when a skip price of 0 already exceeds the target.
- [ ] Tests: `outOfAny` counts a row once when it is out of two lines and ignores rows missing any listed item; `accessTier` on the four rows at price 60 returns an `accessPrice` below 60 and `regained > 0`, and returns `null` at price 0.
- [ ] Implement, pass, commit.

### Task 3: Pledge cascade

**Files:** Create `site/js/lib/pledge.js`, `test/pledge.test.mjs`.

**Produces:**
- `cascade(pledges: Array<[number, 0|5|10|20|"most"]>, payers: number): {answered, steps: number[], pledgers: number, pool: number}`.
- `seatsCovered(pool: number, price: number): number` (0 when `price <= 0`).

Algorithm (not determined by the signature): among answered pledges, group those with amount above 0 by threshold; `share_t` is the group's count over all answered, `mean_t` its mean amount. Start with `k = payers * share_0`. Repeat: a threshold is met when it is a number and `k >= t`, or it is `"most"` and `k > payers / 2`; set `k = payers * sum(share_t over met thresholds)`; stop when `k` stops growing. `steps` records `Math.round(k)` after each round, `pledgers` is the last, `pool` is `payers * sum(share_t * mean_t over met thresholds)`.

- [ ] Tests: no answers gives `{answered: 0, pledgers: 0, pool: 0}`; ten answers all `[2, 0]` with 50 payers gives `pledgers === 50` and `pool === 100`; a population split half `[5, 0]` and half `[5, 10]` with 40 payers tips to 40 pledgers in two steps; the same split with 10 payers stays at 5 because the second group needs 10 others; `[1, "most"]` alone never starts; amount 0 never counts; `seatsCovered(100, 30) === 3`.
- [ ] Implement, pass, commit.

### Task 4: CSV parser and seeded random numbers

**Files:** Create `scripts/lib/csv.mjs`, `scripts/lib/rng.mjs`, `test/csv.test.mjs`.

**Produces:** `parseCsv(text: string): string[][]`; `toObjects(rows: string[][]): Array<Record<string, string>>`; `mulberry32(seed: number): () => number`; `shuffle(array, random): array` (new array).

- [ ] Tests: quoted commas, doubled quotes, CRLF line ends, a newline inside quotes, a leading byte-order mark, a trailing blank line ignored, an empty trailing cell kept as `""`; `mulberry32(1)` gives the same first three numbers on two calls; `shuffle` keeps every element and does not mutate its input.
- [ ] Implement, pass, commit.

### Task 5: MaxDiff scoring and dataset assembly

**Files:** Create `scripts/lib/maxdiff.mjs`, `scripts/lib/aggregate.mjs`, `scripts/lib/vocab.mjs`, `test/maxdiff.test.mjs`, `test/aggregate.test.mjs`.

**Interfaces — Consumes:** `quantile`, `median`, `mulberry32`, `shuffle`.

A *respondent* (normalised) is `{year, officer: boolean | null, prices: {dues, formal, trip: [stretch | null, skip | null] | null}, guess: number | null, skipped: "never" | "once" | "several" | "preferNot" | null, said: string[], maxdiff: Array<{shown: string[], best: string, worst: string}>, pledge: [number, threshold] | null}`.

**Produces:**
- `vocab.mjs`: `ITEMS`, `FIXES`, `SAID`, `PLEDGE_AMOUNTS`, `PLEDGE_THRESHOLDS`, `MIN_CELL = 5`, `GUESS = {item: "formal", price: 40}`.
- `scoreMaxDiff(respondents, fixIds): Array<{id, best, worst, shown, score}>` where `score = (best - worst) / shown` (0 when never shown).
- `bootstrapMaxDiff(respondents, fixIds, {reps = 1000, seed = 1}): Record<string, {low, high}>`.
- `buildDataset(respondents, meta, options = {seed: 1}): Dataset`, the shape in the spec. Rows keep only price pairs (stretch filled from skip when missing, the whole item `null` when skip is missing) and the pledge, in shuffled order. `guess.officers` and `guess.others` are `null` under `MIN_CELL`; `said` is `null` when fewer than `MIN_CELL` respondents skipped for cost.

- [ ] Tests: an item picked best in 3 of 4 showings and never worst scores 0.75; an item never shown scores 0; bootstrap interval contains the score and is identical across two runs with the same seed.
- [ ] Tests: rows carry no `year`, `officer`, `guess` or `said` keys; a respondent with a blank skip price has that item `null`; with 4 officers `guess.officers === null`, with 5 it has `n === 5`; with 4 respondents who skipped for cost `said === null`; `meta.n` equals the respondent count; `skipped` counts add up.
- [ ] Implement, pass, commit.

### Task 6: Flashpoint export adapter and build script

**Files:** Create `scripts/lib/flashpoint-export.mjs`, `scripts/build-data.mjs`, `data/mapping.json`, `test/fixtures/export-small.csv`, `test/export.test.mjs`. Modify `package.json` (add `"build-data"`).

**Produces:**
- `normalizeExport(objects: Array<Record<string, string>>, mapping): respondents[]`. `mapping` names the column for each field and the answer text for each coded value; it is the only place export column names appear. Respondents whose year is the screen-out answer are dropped.
- `node scripts/build-data.mjs <export.csv> [--mapping data/mapping.json] [--survey <id>] [--from <date>] [--to <date>] [--synthetic <export.csv>]` writes `site/data/dataset.json` with `meta.kind = "real"`.

The real column names are unknown until Flashpoint produces an export. Write the adapter against the fixture, keep every name in `data/mapping.json`, and expect to edit only that file and, for MaxDiff, one function.

- [ ] Tests on the fixture: a blank price is `null`, not 0; "$45" and "45" both read as 45; the screen-out row is dropped; multi-select "what you said" splits into ids; MaxDiff columns become tasks; an unknown answer text throws an error naming the column and the value.
- [ ] Implement, run the script on the fixture into a temp path, pass, commit.

### Task 7: Sample data and dev server

**Files:** Create `scripts/make-sample.mjs`, `scripts/serve.mjs`, `site/data/dataset.json` (generated), `.claude/launch.json`, `test/sample.test.mjs`. Modify `package.json` (add `"sample"`, `"dev"`).

**Produces:** `makeSampleRespondents(count = 60, seed = 20261120): respondents[]` exported from `scripts/make-sample.mjs`; running the file writes the dataset with `meta.kind = "sample"` and a `meta.note` saying the rows are generated and are not real responses. `scripts/serve.mjs` serves `site/` on port 4173 with correct content types.

- [ ] Tests: same seed gives identical respondents; `buildDataset` of the sample has `meta.kind === "sample"`; every price is on its item's grid.
- [ ] Implement, generate, pass, commit.

### Task 8: Site shell, price check and curve chart

**Files:** Create `site/index.html`, `site/css/style.css`, `site/js/main.js`, `site/js/state.js`, `site/js/lib/format.js`, `site/js/ui/banner.js`, `site/js/ui/priceCheck.js`, `site/js/ui/chart.js`, `test/format.test.mjs`.

**Produces:** `money(n)`, `pct(share)` (whole percent, `"–"` for `null`), `people(share, size)`; `createState(initial)` with `get()`, `set(patch)`, `subscribe(fn)`; each UI module exports `mount(element, dataset, state)`.

- [ ] Tests: `pct(null) === "–"`, `pct(0.314) === "31%"`, `money(45) === "$45"`, `people(0.31, 60) === 19`.
- [ ] Build the shell, banner (sample and pilot warnings), price check with guess-then-reveal, and the SVG curve. With an item that has no answers the section says "not enough answers".
- [ ] Open in the browser at desktop and phone width; commit.

### Task 9: Remaining sections

**Files:** Create `site/js/ui/access.js`, `site/js/ui/fixes.js`, `site/js/ui/pledges.js`, `site/js/ui/receipt.js`, `site/js/ui/said.js`, `site/js/ui/method.js`.

- [ ] One commit per section: what it would take, fixes, pledges, receipt, what people said and the guess gap, method and limits. Each hides any figure under `MIN_CELL`.
- [ ] Check each in the browser in both colour schemes.

### Task 10: Repository front door

**Files:** Create `README.md`, `.env.example`, `.github/workflows/pages.yml`, `docs/submission/write-up.md`.

- [ ] README: what it does, how it uses Flashpoint (with the briefs and replies trail), setup and run commands, environment variables with placeholders, how to rebuild the data, limits, AI tools disclosed.
- [ ] Pages workflow runs the tests, then deploys `site/`.
- [ ] Write-up draft under 1,000 words with every survey number marked as pending until the real export is in.
- [ ] Final check: `npm test`, a scan for secrets, and a full browser pass; commit.
