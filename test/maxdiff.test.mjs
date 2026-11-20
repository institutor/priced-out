import test from "node:test";
import assert from "node:assert/strict";
import { scoreMaxDiff, bootstrapMaxDiff } from "../scripts/lib/maxdiff.mjs";

const ids = ["a", "b", "c", "d", "never"];
const person = (tasks) => ({ maxdiff: tasks });
const respondents = [
  person([{ shown: ["a", "b", "c"], best: "a", worst: "c" }, { shown: ["a", "b", "d"], best: "a", worst: "d" }]),
  person([{ shown: ["a", "c", "d"], best: "a", worst: "c" }, { shown: ["a", "b", "c"], best: "b", worst: "c" }]),
  person([]),
];

test("score is best minus worst over times shown", () => {
  const scores = Object.fromEntries(scoreMaxDiff(respondents, ids).map((row) => [row.id, row]));
  assert.equal(scores.a.shown, 4);
  assert.equal(scores.a.best, 3);
  assert.equal(scores.a.worst, 0);
  assert.equal(scores.a.score, 0.75);
  assert.equal(scores.c.score, -1);
  assert.equal(scores.never.shown, 0);
  assert.equal(scores.never.score, 0);
});

test("scores come back in the order of the ids given", () => {
  assert.deepEqual(scoreMaxDiff(respondents, ids).map((row) => row.id), ids);
});

test("bootstrap interval brackets the score and is repeatable", () => {
  const first = bootstrapMaxDiff(respondents, ids, { reps: 200, seed: 3 });
  const second = bootstrapMaxDiff(respondents, ids, { reps: 200, seed: 3 });
  assert.deepEqual(first, second);
  assert.ok(first.a.low <= 0.75 && first.a.high >= 0.75);
  assert.ok(first.c.low <= -1 && first.c.high >= -1);
  assert.deepEqual(first.never, { low: 0, high: 0 });
});

test("bootstrap with nobody answering returns flat intervals", () => {
  assert.deepEqual(bootstrapMaxDiff([person([])], ["a"], { reps: 10, seed: 1 }), { a: { low: 0, high: 0 } });
});
