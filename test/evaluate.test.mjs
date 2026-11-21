import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { evaluate, SETTINGS } from "../scripts/evaluate.mjs";

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const mapping = read("../site/data/mapping.json");
const published = read("../site/data/evaluation.json");

// The page quotes these figures, so they have to be the ones the code gives
// today. If a counting rule changes, this fails until the check is run again
// with: node scripts/evaluate.mjs
test("the check against made-up clubs in the site is the one the script gives", () => {
  assert.deepEqual(published, JSON.parse(JSON.stringify(evaluate(mapping))));
});

test("the check covers every club size it says it does", () => {
  assert.deepEqual(published.bySize.map((row) => row.size), SETTINGS.sizes);
  assert.equal(published.clubs, SETTINGS.sizes.length * SETTINGS.trials);
  for (const row of published.bySize) assert.ok(row.checks > SETTINGS.trials * 2.5, `size ${row.size}`);
});

test("a 95% interval holds the truth about 95% of the time, at every size", () => {
  for (const row of published.bySize) {
    assert.ok(row.held >= 0.92 && row.held <= 0.99, `size ${row.size}: ${row.held}`);
  }
});

test("more answers bring the page's figure closer to the truth", () => {
  const rows = published.bySize;
  for (let index = 1; index < rows.length; index++) {
    assert.ok(rows[index].typicalMiss < rows[index - 1].typicalMiss, `typical miss at ${rows[index].size}`);
    assert.ok(rows[index].badMiss < rows[index - 1].badMiss, `bad miss at ${rows[index].size}`);
    assert.ok(rows[index].priceWithinOneStep > rows[index - 1].priceWithinOneStep, `price at ${rows[index].size}`);
  }
});
