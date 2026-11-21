import test from "node:test";
import assert from "node:assert/strict";
import { buildDataset } from "../site/js/ingest/aggregate.js";
import { ITEMS, FIXES, SAID, MIN_CELL } from "../site/js/ingest/vocab.js";

const base = {
  year: "Sophomore",
  officer: false,
  prices: { dues: [20, 40], formal: [40, 70], trip: [120, 200] },
  guess: 30,
  skipped: "never",
  said: [],
  maxdiff: [{ shown: ["open", "request", "pwyc", "draw"], best: "open", worst: "request" }],
  pledge: [3, 10],
};
const make = (overrides = {}) => ({ ...base, ...overrides });
const meta = { kind: "sample", title: "test" };

test("the vocabulary matches the spec", () => {
  assert.deepEqual(ITEMS.map((item) => [item.id, item.max, item.step]), [["dues", 100, 5], ["formal", 150, 5], ["trip", 400, 10]]);
  assert.deepEqual(FIXES.map((fix) => fix.id), ["sliding", "request", "open", "pwyc", "forward", "draw"]);
  assert.deepEqual(SAID.map((option) => option.id), ["truth", "busy", "exam", "plans", "uninterested", "silent", "other"]);
  assert.equal(MIN_CELL, 5);
});

test("public rows carry only price pairs and the pledge", () => {
  const dataset = buildDataset([make(), make({ year: "Senior", officer: true })], meta);
  assert.equal(dataset.rows.length, 2);
  for (const row of dataset.rows) {
    assert.deepEqual(Object.keys(row).sort(), ["dues", "formal", "pledge", "trip"]);
  }
  assert.equal(dataset.meta.n, 2);
  assert.equal(dataset.meta.kind, "sample");
  assert.deepEqual(dataset.items, ITEMS);
});

test("a blank skip price drops the item; a blank stretch price is filled from skip", () => {
  const dataset = buildDataset([make({ prices: { dues: [20, null], formal: [null, 70], trip: null } })], meta);
  assert.equal(dataset.rows[0].dues, null);
  assert.deepEqual(dataset.rows[0].formal, [70, 70]);
  assert.equal(dataset.rows[0].trip, null);
});

test("row order says nothing about the order respondents came in", () => {
  const prices = [35, 5, 90, 20, 60, 15, 45, 80, 10, 55];
  const respondents = prices.map((skip) => make({ prices: { ...base.prices, dues: [5, skip] } }));
  const forwards = buildDataset(respondents, meta).rows;
  const backwards = buildDataset([...respondents].reverse(), meta).rows;
  assert.deepEqual(forwards, backwards);
  assert.notDeepEqual(forwards.map((row) => row.dues[1]), prices);
  assert.deepEqual(forwards.map((row) => row.dues[1]).sort((a, b) => a - b), [...prices].sort((a, b) => a - b));
});

test("officer split of the guesses is hidden under the minimum cell size", () => {
  const others = Array.from({ length: 6 }, () => make({ guess: 20 }));
  const fourOfficers = Array.from({ length: 4 }, () => make({ officer: true, guess: 10 }));
  const hidden = buildDataset([...others, ...fourOfficers], meta);
  assert.equal(hidden.guess.officers, null);
  assert.equal(hidden.guess.others.n, 6);
  assert.equal(hidden.guess.all.n, 10);
  assert.equal(hidden.guess.all.median, 20);
  const shown = buildDataset([...others, ...fourOfficers, make({ officer: true, guess: 10 })], meta);
  assert.equal(shown.guess.officers.n, 5);
  assert.equal(shown.guess.officers.median, 10);
  assert.equal(shown.guess.price, 40);
  assert.equal(shown.guess.item, "formal");
});

test("what people said is hidden when too few skipped for cost", () => {
  const skippers = (count) => Array.from({ length: count }, () => make({ skipped: "once", said: ["busy", "exam"] }));
  assert.equal(buildDataset([...skippers(4), make()], meta).said, null);
  const dataset = buildDataset([...skippers(5), make()], meta);
  assert.equal(dataset.said.n, 5);
  const busy = dataset.said.options.find((option) => option.id === "busy");
  assert.equal(busy.count, 5);
  assert.equal(dataset.said.options.find((option) => option.id === "truth").count, 0);
  assert.equal(dataset.said.options.length, SAID.length);
});

test("skipped counts add up and leave out blanks", () => {
  const respondents = [make(), make(), make({ skipped: "once" }), make({ skipped: "several" }), make({ skipped: "preferNot" }), make({ skipped: null })];
  const { skipped } = buildDataset(respondents, meta);
  assert.deepEqual(skipped, { n: 5, never: 2, once: 1, several: 1, preferNot: 1 });
});

test("skipped counts are left out when too few answered", () => {
  const respondents = [make(), make({ skipped: "once" }), make({ skipped: "several" }), make({ skipped: null })];
  const { skipped } = buildDataset(respondents, meta);
  assert.deepEqual(skipped, { n: 3, never: null, once: null, several: null, preferNot: null });
});

test("fixes carry scores, intervals and labels", () => {
  const dataset = buildDataset(Array.from({ length: 6 }, () => make()), meta);
  assert.equal(dataset.fixesN, 6);
  assert.equal(dataset.fixes.length, FIXES.length);
  const open = dataset.fixes.find((fix) => fix.id === "open");
  assert.equal(open.score, 1);
  assert.equal(open.label, "Open waiver code");
  assert.ok(open.low <= open.score && open.high >= open.score);
  assert.equal(buildDataset([make({ maxdiff: [] })], meta).fixes, null);
});

test("synthetic respondents are kept apart and labelled", () => {
  const dataset = buildDataset([make()], meta, { synthetic: { label: "AI-simulated", respondents: [make(), make()] } });
  assert.equal(dataset.synthetic.n, 2);
  assert.equal(dataset.synthetic.label, "AI-simulated");
  assert.equal(dataset.synthetic.rows.length, 2);
  assert.equal(buildDataset([make()], meta).synthetic, null);
});
