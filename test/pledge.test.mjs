import test from "node:test";
import assert from "node:assert/strict";
import { cascade, seatsCovered } from "../site/js/lib/pledge.js";

const repeat = (pledge, times) => Array.from({ length: times }, () => pledge);

test("no answers means no pledges", () => {
  const result = cascade([], 50);
  assert.equal(result.answered, 0);
  assert.equal(result.pledgers, 0);
  assert.equal(result.pool, 0);
});

test("everyone giving regardless pledges at once", () => {
  const result = cascade(repeat([2, 0], 10), 50);
  assert.equal(result.pledgers, 50);
  assert.equal(result.pool, 100);
  assert.deepEqual(result.steps, [50]);
});

test("a second group joins once enough others have", () => {
  const pledges = [...repeat([5, 0], 5), ...repeat([5, 10], 5)];
  const result = cascade(pledges, 40);
  assert.deepEqual(result.steps, [20, 40]);
  assert.equal(result.pledgers, 40);
  assert.equal(result.pool, 200);
});

test("the same people in a small club never tip", () => {
  const pledges = [...repeat([5, 0], 5), ...repeat([5, 10], 5)];
  const result = cascade(pledges, 10);
  assert.deepEqual(result.steps, [5]);
  assert.equal(result.pledgers, 5);
  assert.equal(result.pool, 25);
});

test("'only if most of the club did' cannot start on its own", () => {
  assert.equal(cascade(repeat([1, "most"], 8), 30).pledgers, 0);
});

test("'most' joins after a majority already pledges", () => {
  const pledges = [...repeat([2, 0], 6), ...repeat([2, "most"], 4)];
  const result = cascade(pledges, 20);
  assert.deepEqual(result.steps, [12, 20]);
});

test("an amount of 0 is a no", () => {
  const result = cascade([[0, 0], [0, 0], [3, 0]], 30);
  assert.equal(result.answered, 3);
  assert.equal(result.pledgers, 10);
  assert.equal(result.pool, 30);
});

test("seatsCovered rounds down and survives a zero price", () => {
  assert.equal(seatsCovered(100, 30), 3);
  assert.equal(seatsCovered(100, 0), 0);
  assert.equal(seatsCovered(0, 30), 0);
});
