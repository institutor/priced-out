import test from "node:test";
import assert from "node:assert/strict";
import { stateAt, sharesAt, priceGrid, curve, maxPriceFor, outOfAny, accessTier, answeredAll, waysToPrice, roomForTwo } from "../site/js/lib/curve.js";

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

test("waysToPrice sets the price now beside one lower price and beside two prices", () => {
  // Three of the four would skip a $60 formal, so 2 of a club of 8 pay.
  assert.deepEqual(waysToPrice(four, formal, 60, 8), [
    { kind: "now", price: 60, there: 2, taken: 120 },
    { kind: "lower", price: 15, there: 8, taken: 120 },
    { kind: "two", price: 60, accessPrice: 15, there: 8, taken: 210 },
  ]);
});

test("waysToPrice gives only the price now when nothing lower would bring anyone back", () => {
  assert.deepEqual(waysToPrice(four, formal, 15, 8), [{ kind: "now", price: 15, there: 8, taken: 120 }]);
});

test("waysToPrice leaves out a way that would not move one whole person in a small club", () => {
  // At $25 one in four skips. In a club of 1 that rounds to nobody.
  assert.deepEqual(waysToPrice(four, formal, 25, 1), [{ kind: "now", price: 25, there: 1, taken: 25 }]);
});

test("waysToPrice counts a free access price as bringing people and no money", () => {
  const rows = [{ formal: [0, 5] }, { formal: [50, 100] }, { formal: [50, 100] }, { formal: [50, 100] }];
  const ways = waysToPrice(rows, formal, 50, 4);
  assert.deepEqual(ways.at(-1), { kind: "two", price: 50, accessPrice: 0, there: 4, taken: 150 });
});

test("waysToPrice is null when nobody answered", () => {
  assert.equal(waysToPrice([], formal, 60, 8), null);
});

test("roomForTwo counts how many full payers can take the lower price before the club loses money", () => {
  // 41 pay $45 now. A $20 price brings 16 back, which is $320 more. Each
  // payer who takes the $20 price instead gives up $25 of that.
  const ways = [
    { kind: "now", price: 45, there: 41, taken: 1845 },
    { kind: "two", price: 45, accessPrice: 20, there: 57, taken: 2165 },
  ];
  assert.deepEqual(roomForTwo(ways), { room: 12, payers: 41, each: 25, accessPrice: 20 });
  assert.ok(2165 - 12 * 25 >= 1845);
  assert.ok(2165 - 13 * 25 < 1845);
});

test("roomForTwo counts a switch that leaves the money exactly the same as allowed", () => {
  // Two pay $60. Both taking the $15 price leaves 8 x $15 = $120, the same as now.
  assert.deepEqual(roomForTwo(waysToPrice(four, formal, 60, 8)), { room: 2, payers: 2, each: 45, accessPrice: 15 });
});

test("roomForTwo is never more than the number who pay now", () => {
  const ways = [
    { kind: "now", price: 45, there: 10, taken: 450 },
    { kind: "two", price: 45, accessPrice: 40, there: 30, taken: 1250 },
  ];
  assert.equal(roomForTwo(ways).room, 10);
});

test("roomForTwo leaves no room when the lower price is free", () => {
  const rows = [{ formal: [0, 5] }, { formal: [50, 100] }, { formal: [50, 100] }, { formal: [50, 100] }];
  assert.deepEqual(roomForTwo(waysToPrice(rows, formal, 50, 4)), { room: 0, payers: 3, each: 50, accessPrice: 0 });
});

test("roomForTwo is null when there is no second price to offer", () => {
  assert.equal(roomForTwo(waysToPrice(four, formal, 15, 8)), null);
  assert.equal(roomForTwo(null), null);
});
