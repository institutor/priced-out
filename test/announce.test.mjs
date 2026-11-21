import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { announcement } from "../site/js/lib/announce.js";
import { priceGrid, waysToPrice } from "../site/js/lib/curve.js";
import { datasetFromExport } from "../site/js/ingest/club.js";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const published = JSON.parse(read("../site/data/dataset.json"));
const mapping = JSON.parse(read("../site/data/mapping.json"));
const example = datasetFromExport(read("../site/data/example-club.csv"), mapping, { name: "example-club.csv" }).dataset;

const view = { itemId: "formal", price: 45, size: 60 };
// The same answers with one fix moved to the top of the ranking.
const led = (dataset, id) => ({
  ...dataset,
  fixes: dataset.fixes.map((fix) => ({ ...fix, score: fix.id === id ? 0.9 : Math.min(fix.score, 0.5) })),
});

test("the message for the opening view offers the access price the way that ranked first", () => {
  const said = announcement(published, view);
  assert.deepEqual(said.fix, { id: "open", label: "Open waiver code" });
  assert.equal(said.lower, 20);
  assert.equal(
    said.text,
    "Formal tickets are $45. If that is a stretch, use the code [your code] and it is $20. Everyone is getting this code, and nobody will ask who used it.",
  );
});

test("the lower price in the message is the one in the sum with two prices", () => {
  for (const dataset of [published, example]) {
    for (const item of dataset.items) {
      for (const price of priceGrid(item)) {
        const said = announcement(dataset, { itemId: item.id, price, size: 60 });
        const two = waysToPrice(dataset.rows, item, price, 60).find((way) => way.kind === "two");
        if (said.text === null) {
          assert.equal(said.why, "nobody");
          assert.equal(two, undefined);
        } else {
          assert.equal(said.lower, two.accessPrice);
        }
      }
    }
  }
});

test("a sliding scale lists the full price, the nine-in-ten price when it falls between, and the lower price", () => {
  const said = announcement(led(published, "sliding"), view);
  assert.equal(
    said.text,
    "Formal tickets: pick the price that fits you, $45, $30 or $20. Every price gets you the same as everyone else, and nobody sees which one you picked.",
  );
  // At the nine-in-ten price there is no step between.
  const close = announcement(led(published, "sliding"), { ...view, price: 30 });
  assert.match(close.text, /pick the price that fits you, \$30 or \$20\./);
});

test("every way of offering a lower price has a message, and each names the price", () => {
  const texts = new Set();
  for (const fix of published.fixes) {
    for (const item of published.items) {
      const price = item.id === "trip" ? 180 : 45;
      const said = announcement(led(published, fix.id), { itemId: item.id, price, size: 60 });
      assert.equal(said.fix.id, fix.id);
      assert.ok(said.text.includes(`$${price}`));
      assert.doesNotMatch(said.text, /undefined|null|NaN|\s{2}/);
      assert.match(said.text, /\.$/);
      texts.add(said.text);
    }
  }
  assert.equal(texts.size, published.fixes.length * published.items.length);
});

test("the message never mentions the survey or whose answers it came from", () => {
  for (const dataset of [published, example]) {
    for (const fix of dataset.fixes) {
      const said = announcement(led(dataset, fix.id), view);
      assert.doesNotMatch(said.text, /survey|simulat|persona|made-up|answer|percent|%/i);
    }
  }
});

test("a tie at the top is not settled by the page", () => {
  const tied = { ...published, fixes: published.fixes.map((fix) => ({ ...fix, score: fix.id === "open" || fix.id === "sliding" ? 0.4 : -0.1 })) };
  const said = announcement(tied, view);
  assert.equal(said.text, null);
  assert.equal(said.why, "tie");
  assert.deepEqual([...said.tied].sort(), ["Open waiver code", "Sliding scale"]);
});

test("where no lower price would bring anyone back, there is no message", () => {
  const said = announcement(published, { ...view, price: 0 });
  assert.equal(said.text, null);
  assert.equal(said.why, "nobody");
});

test("too few answers, or no ranking, gives no message", () => {
  assert.equal(announcement({ ...published, rows: published.rows.slice(0, 3) }, view).why, "few");
  assert.equal(announcement({ ...published, fixes: [] }, view).why, "none");
  assert.equal(announcement({ ...published, fixes: null }, view).why, "none");
});

test("a lower price of nothing is written as free", () => {
  // Twenty members: three skip at $5, the rest at $60. More than 1 in 20 is
  // lost at $5, so the access price is $0.
  const rows = Array.from({ length: 20 }, (_, index) => ({ formal: index < 3 ? [5, 5] : [50, 60] }));
  const said = announcement({ ...published, rows }, { itemId: "formal", price: 40, size: 20 });
  assert.equal(said.lower, 0);
  assert.match(said.text, /use the code \[your code\] and it is free\./);
});
