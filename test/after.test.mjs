import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { afterEvent } from "../site/js/lib/after.js";
import { priceGrid, waysToPrice } from "../site/js/lib/curve.js";
import { datasetFromExport } from "../site/js/ingest/club.js";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const published = JSON.parse(read("../site/data/dataset.json"));
const mapping = JSON.parse(read("../site/data/mapping.json"));
const exampleFile = read("../site/data/example-club.csv");
const example = datasetFromExport(exampleFile, mapping, { name: "example-club.csv" }).dataset;
// The same rows, as if people had answered them.
const asPeople = exampleFile.split("\n").map((line, index) => (index < 2 ? line : line.replace(/^(\d+),example,/, "$1,link,"))).join("\n");
const club = datasetFromExport(asPeople, mapping, { name: "our-club.csv" }).dataset;

const view = { itemId: "formal", price: 45, size: 60 };
const textOf = (result, key) => result.lines.find((line) => line.key === key)?.text ?? null;

test("before anything is counted, it says what the answers gave and nothing else", () => {
  const result = afterEvent(published, view);
  assert.equal(result.offered, true);
  assert.equal(result.price, 45);
  assert.equal(result.lower, 20);
  assert.deepEqual(result.said, { full: 41, low: 16, there: 57, share: 16 / 57 });
  assert.deepEqual(result.lines, []);
  assert.deepEqual(afterEvent(published, view, { full: 36 }).lines, []);
  assert.deepEqual(afterEvent(published, view, { low: 9 }).lines, []);
  assert.deepEqual(afterEvent(published, view, { full: 0, low: 0 }).lines, []);
});

test("what was counted is set beside what the answers said", () => {
  const result = afterEvent(published, view, { full: 36, low: 9 });
  assert.deepEqual(result.lines.map((line) => line.key), ["came", "share", "reading", "money"]);
  assert.equal(textOf(result, "came"), "45 came: 36 at $45 and 9 at $20.");
  assert.equal(
    textOf(result, "share"),
    "The simulated students' answers said about 16 of every 57 who come would take the lower price, which is 28%. At your event it was 9 of 45, which is 20%.",
  );
  assert.match(textOf(result, "reading"), /^Fewer took the lower price than the answers said\./);
  assert.equal(textOf(result, "money"), "The club took in $1,800.");
});

test("more taking the lower price than said is read as more need or as people who could pay", () => {
  const result = afterEvent(published, view, { full: 30, low: 25 });
  assert.match(textOf(result, "reading"), /^More took the lower price than the answers said\. Either more needed it than said so, or some who could pay in full took it\.$/);
});

test("the same share, as written, is called the same", () => {
  // 16 of 57 is 28%. So is 28 of 100.
  const result = afterEvent(published, view, { full: 72, low: 28 });
  assert.equal(textOf(result, "reading"), "That is the share the answers gave.");
  // 14 of 50 is exactly 28% too.
  assert.equal(textOf(afterEvent(published, view, { full: 36, low: 14 }), "reading"), "That is the share the answers gave.");
});

test("with a figure from before, the people and the money are compared with it", () => {
  const more = afterEvent(published, view, { full: 36, low: 9, before: 35 });
  assert.equal(textOf(more, "money"), "Before, 35 paid $45, which is $1,575. This time 10 more came and the club took in $1,800, $225 more.");
  const fewer = afterEvent(published, view, { full: 20, low: 10, before: 35 });
  assert.equal(textOf(fewer, "money"), "Before, 35 paid $45, which is $1,575. This time 5 fewer came and the club took in $1,100, $475 less.");
  const same = afterEvent(published, view, { full: 40, low: 0, before: 40 });
  assert.equal(textOf(same, "money"), "Before, 40 paid $45, which is $1,800. This time as many came and the club took in $1,800, the same.");
});

test("a count that is not a whole number of people is not used", () => {
  for (const bad of [-1, 2.5, Number.NaN, "12", undefined]) {
    assert.deepEqual(afterEvent(published, view, { full: bad, low: 9 }).lines, [], String(bad));
    assert.deepEqual(afterEvent(published, view, { full: 36, low: bad }).lines, [], String(bad));
    assert.equal(textOf(afterEvent(published, view, { full: 36, low: 9, before: bad }), "money"), "The club took in $1,800.", String(bad));
  }
});

test("where the page works out no second price, there is nothing to check", () => {
  assert.deepEqual(afterEvent(published, { ...view, price: 20 }), { offered: false });
  assert.deepEqual(afterEvent(published, { ...view, price: 0 }, { full: 3, low: 4 }), { offered: false });
});

test("a free second price is written as free", () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({ formal: index < 3 ? [5, 5] : [50, 60] }));
  const result = afterEvent({ ...published, rows }, { itemId: "formal", price: 40, size: 20 }, { full: 15, low: 4, before: 15 });
  assert.equal(result.lower, 0);
  assert.equal(textOf(result, "came"), "19 came: 15 at $40 and 4 for free.");
  assert.equal(textOf(result, "money"), "Before, 15 paid $40, which is $600. This time 4 more came and the club took in $600, the same.");
});

test("whose answers they are is said in the words the rest of the page uses", () => {
  assert.equal(afterEvent(published, view).whose, "The simulated students' answers");
  assert.equal(afterEvent(example, view).whose, "The made-up members' answers");
  assert.equal(afterEvent(club, view).whose, "Your members' answers");
  assert.equal(afterEvent({ ...published, meta: { kind: "real" } }, view).whose, "The answers");
});

test("what the answers said is the sum with two prices, at every price", () => {
  for (const dataset of [published, example]) {
    for (const item of dataset.items) {
      for (const price of priceGrid(item)) {
        for (const size of [5, 60, 300]) {
          const result = afterEvent(dataset, { itemId: item.id, price, size }, { full: 7, low: 3, before: 8 });
          const ways = waysToPrice(dataset.rows, item, price, size);
          const two = ways.find((way) => way.kind === "two");
          assert.equal(result.offered, Boolean(two));
          if (!two) continue;
          assert.equal(result.said.full + result.said.low, two.there);
          assert.equal(result.lower, two.accessPrice);
          assert.ok(result.said.low > 0 && result.said.share > 0 && result.said.share <= 1);
          for (const line of result.lines) {
            assert.doesNotMatch(line.text, /undefined|null|NaN|\s{2}|\$-/, line.text);
            assert.match(line.text, /^[A-Z0-9].*\.$/, line.text);
          }
        }
      }
    }
  }
});
