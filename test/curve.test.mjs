import test from "node:test";
import assert from "node:assert/strict";
import { stateAt, sharesAt, priceGrid, curve, maxPriceFor, outOfAny, accessTier, answeredAll } from "../site/js/lib/curve.js";

const formal = { id: "formal", label: "A ticket to the club formal", max: 150, step: 5 };
const dues = { id: "dues", label: "One semester of club dues", max: 100, step: 5 };
const four = [
  { formal: [10, 20] },
  { formal: [20, 40] },
  { formal: [30, 60] },
  { formal: [100, 150] },
];

test("stateAt separates out, stretched and fine", () => {
  assert.equal(stateAt([40, 70], formal, 70), "out");
  assert.equal(stateAt([40, 70], formal, 65), "stretched");
  assert.equal(stateAt([40, 70], formal, 35), "fine");
});

test("a stretch price above the skip price is treated as the skip price", () => {
  assert.equal(stateAt([90, 70], formal, 65), "fine");
  assert.equal(stateAt([90, 70], formal, 70), "out");
});

test("answers at the top of the range mean 'this much or more'", () => {
  assert.equal(stateAt([40, 150], formal, 145), "stretched");
  assert.equal(stateAt([150, 150], formal, 145), "fine");
});

test("sharesAt with no answers returns nulls, not NaN", () => {
  const shares = sharesAt([], formal, 50);
  assert.equal(shares.n, 0);
  assert.equal(shares.out, null);
  assert.equal(shares.stretched, null);
  assert.equal(shares.outLow, null);
});

test("sharesAt leaves out rows that did not answer the item", () => {
  const rows = [...four, { formal: null }, { dues: [5, 10] }];
  const shares = sharesAt(rows, formal, 40);
  assert.equal(shares.n, 4);
  assert.equal(shares.outCount, 2);
  assert.equal(shares.out, 0.5);
  assert.equal(shares.stretchedCount, 1);
  assert.equal(shares.fineCount, 1);
  assert.ok(shares.outLow < 0.5 && shares.outHigh > 0.5);
});

test("priceGrid stops one step below the max", () => {
  const grid = priceGrid(formal);
  assert.equal(grid[0], 0);
  assert.equal(grid.at(-1), 145);
  assert.equal(grid.length, 30);
});

test("curve never goes down as the price goes up", () => {
  const points = curve(four, formal);
  assert.equal(points.length, 30);
  for (let i = 1; i < points.length; i++) assert.ok(points[i].out >= points[i - 1].out);
  assert.equal(points.at(-1).out, 0.75);
});

test("maxPriceFor finds the highest price inside the target", () => {
  assert.equal(maxPriceFor(four, formal, 0.25), 35);
  assert.equal(maxPriceFor(four, formal, 0), 15);
  assert.equal(maxPriceFor([{ formal: [0, 0] }, { formal: [50, 80] }], formal, 0.25), null);
  assert.equal(maxPriceFor([], formal, 0.25), null);
});

test("outOfAny counts a person once and skips incomplete rows", () => {
  const rows = [
    { dues: [10, 20], formal: [40, 70] },
    { dues: [10, 50], formal: [40, 60] },
    { dues: null, formal: [10, 20] },
    { dues: [5, 10], formal: [5, 10] },
    { dues: [90, 100], formal: [100, 150] },
  ];
  const result = outOfAny(rows, [{ item: dues, price: 30 }, { item: formal, price: 65 }]);
  assert.equal(result.n, 4);
  assert.equal(result.count, 3);
  assert.equal(result.share, 0.75);
  assert.equal(outOfAny(rows, []).n, 0);
  assert.equal(outOfAny(rows, []).share, null);
});

test("accessTier reports who a cheaper tier brings back", () => {
  const tier = accessTier(four, formal, 60);
  assert.equal(tier.accessPrice, 15);
  assert.equal(tier.regained, 0.75);
  assert.equal(tier.addedRevenuePer100, 1125);
  assert.equal(accessTier(four, formal, 0), null);
  assert.equal(accessTier(four, formal, 15), null);
});

test("answeredAll keeps only rows that gave a skip price for every item", () => {
  const rows = [
    { dues: [10, 20], formal: [40, 70] },
    { dues: null, formal: [10, 20] },
    { dues: [5, null], formal: [5, 10] },
    { dues: [5, 10] },
  ];
  assert.deepEqual(answeredAll(rows, [dues, formal]), [rows[0]]);
  assert.deepEqual(answeredAll(rows, [formal]), [rows[0], rows[1], rows[2]]);
  assert.deepEqual(answeredAll(rows, []), rows);
});
