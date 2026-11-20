import test from "node:test";
import assert from "node:assert/strict";
import { wilson, quantile, median } from "../site/js/lib/stats.js";

const near = (actual, expected, tolerance = 0.0005) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

test("wilson gives the textbook interval for 5 of 10", () => {
  const { low, high } = wilson(5, 10);
  near(low, 0.2366);
  near(high, 0.7634);
});

test("wilson touches 0 and 1 at the extremes", () => {
  assert.equal(wilson(0, 10).low, 0);
  assert.equal(wilson(10, 10).high, 1);
  assert.ok(wilson(0, 10).high > 0.2);
  assert.ok(wilson(10, 10).low < 0.8);
});

test("wilson with no observations spans everything", () => {
  assert.deepEqual(wilson(0, 0), { low: 0, high: 1 });
});

test("quantile interpolates and leaves its input alone", () => {
  const values = [4, 1, 3, 2];
  assert.equal(quantile(values, 0.5), 2.5);
  assert.equal(quantile(values, 0), 1);
  assert.equal(quantile(values, 1), 4);
  assert.deepEqual(values, [4, 1, 3, 2]);
});

test("median of nothing is null", () => {
  assert.equal(median([]), null);
  assert.equal(median([7]), 7);
  assert.equal(median([1, 9, 5]), 5);
});
