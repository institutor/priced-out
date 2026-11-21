// The walk up the price: who steps out where, how the line stands along the
// ruler, and how the scroll is spent.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { maxPriceFor, priceGrid, sharesAt, walkAway } from "../site/js/lib/curve.js";
import { lineUp, tickEvery, walkLength, walkStage } from "../site/js/lib/walk.js";

const formal = { id: "formal", label: "A ticket to the club formal", max: 150, step: 5 };
const four = [
  { formal: [10, 20] },
  { formal: [20, 40] },
  { formal: [30, 60] },
  { formal: [100, 150] },
];

test("a line of four for four respondents is each of them, in order", () => {
  assert.deepEqual(walkAway(four, formal, 4), [20, 40, 60, Infinity]);
});

test("a longer line repeats respondents, a shorter one picks from the middle of each share", () => {
  assert.deepEqual(walkAway(four, formal, 8), [20, 20, 40, 40, 60, 60, Infinity, Infinity]);
  assert.deepEqual(walkAway(four, formal, 2), [40, Infinity]);
});

test("rows that did not answer are not in the line, and nobody answering gives no line", () => {
  assert.deepEqual(walkAway([...four, { formal: null }, { dues: [5, 10] }], formal, 4), [20, 40, 60, Infinity]);
  assert.deepEqual(walkAway([{ dues: [5, 10] }], formal, 20), []);
});

test("an answer at the top of the range never steps out inside it", () => {
  assert.deepEqual(walkAway([{ formal: [150, 150] }, { formal: [40, 200] }], formal, 2), [Infinity, Infinity]);
});

test("on the survey's own answers the line agrees with the price check at every price", () => {
  const dataset = JSON.parse(readFileSync(new URL("../site/data/dataset.json", import.meta.url), "utf8"));
  for (const item of dataset.items) {
    const line = walkAway(dataset.rows, item, 20);
    assert.equal(line.length, 20);
    assert.deepEqual(line, [...line].sort((a, b) => a - b));
    for (const price of priceGrid(item)) {
      const steppedOut = line.filter((skip) => price >= skip).length;
      const share = sharesAt(dataset.rows, item, price).out;
      assert.ok(Math.abs(steppedOut - share * 20) <= 0.5 + 1e-9, `${item.id} at ${price}: ${steppedOut} against ${share * 20}`);
    }
    // No more than 1 in 20 are out at the access price, so no more than one
    // of the twenty has stepped out there.
    const access = maxPriceFor(dataset.rows, item, 0.05);
    if (access !== null) assert.ok(line.filter((skip) => access >= skip).length <= 1, item.id);
  }
});

test("people with room to spare stand exactly on their spots", () => {
  assert.deepEqual(lineUp([0, 100, 250], 20), [0, 100, 250]);
  assert.deepEqual(lineUp([], 20), []);
});

test("people who belong at the same spot stand side by side around it", () => {
  const places = lineUp([100, 100, 100], 20);
  assert.deepEqual(places, [80, 100, 120]);
  const pair = lineUp([50, 50], 30);
  assert.deepEqual(pair, [35, 65]);
});

test("nobody stands closer than the gap, and nobody changes order", () => {
  const spots = [0, 3, 5, 80, 81, 81, 82, 150, 300, 300, 305, 500];
  const places = lineUp(spots, 12);
  assert.equal(places.length, spots.length);
  for (let i = 1; i < places.length; i++) {
    assert.ok(places[i] - places[i - 1] >= 12 - 1e-9, `${places[i - 1]} then ${places[i]}`);
  }
  // A crowded stretch spreads around where it belongs, not off to one side.
  const mean = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;
  assert.ok(Math.abs(mean(places.slice(3, 7)) - mean(spots.slice(3, 7))) < 1e-9);
  // Someone with room keeps their own spot.
  assert.equal(places.at(-1), 500);
  assert.equal(places[7], 150);
});

test("ruler labels are a round amount apart, with room between them", () => {
  assert.equal(tickEvery(12, 80), 10);
  assert.equal(tickEvery(25, 80), 5);
  assert.equal(tickEvery(4.6, 80), 20);
  assert.equal(tickEvery(3, 80), 50);
  assert.equal(tickEvery(0.001, 80), 500);
});

test("the scroll is spent on a wait, a zoom in, the walk, a zoom out and a wait", () => {
  const plan = { lead: 50, zoom: 200, pan: 1000 };
  assert.equal(walkLength(plan), 1500);
  // Before the strip is pinned, and during the first wait: the whole line.
  assert.deepEqual(walkStage(-80, plan), { along: 0, zoom: 0, leaving: false });
  assert.deepEqual(walkStage(50, plan), { along: 0, zoom: 0, leaving: false });
  // Half way through the zoom in.
  assert.equal(walkStage(150, plan).zoom, 0.5);
  assert.equal(walkStage(150, plan).along, 0);
  // The walk: close up, moving along.
  assert.deepEqual(walkStage(250, plan), { along: 0, zoom: 1, leaving: false });
  assert.deepEqual(walkStage(750, plan), { along: 0.5, zoom: 1, leaving: false });
  assert.deepEqual(walkStage(1250, plan), { along: 1, zoom: 1, leaving: false });
  // Zooming back out, at the far end.
  const out = walkStage(1350, plan);
  assert.equal(out.along, 1);
  assert.equal(out.zoom, 0.5);
  assert.equal(out.leaving, true);
  assert.deepEqual(walkStage(9999, plan), { along: 1, zoom: 0, leaving: true });
});

test("the zoom eases: slow to start, slow to finish, never outside its range", () => {
  const plan = { lead: 0, zoom: 100, pan: 100 };
  let before = 0;
  for (let scrolled = 0; scrolled <= 100; scrolled += 5) {
    const { zoom } = walkStage(scrolled, plan);
    assert.ok(zoom >= before && zoom >= 0 && zoom <= 1);
    before = zoom;
  }
  assert.ok(walkStage(10, plan).zoom < 0.1);
  assert.ok(walkStage(90, plan).zoom > 0.9);
});

test("with no zoom the view is close up from the start", () => {
  const plan = { lead: 20, zoom: 0, pan: 500 };
  assert.deepEqual(walkStage(0, plan), { along: 0, zoom: 1, leaving: false });
  assert.deepEqual(walkStage(270, plan), { along: 0.5, zoom: 1, leaving: false });
  assert.equal(walkStage(600, plan).along, 1);
  assert.equal(walkStage(600, plan).zoom, 1);
});
