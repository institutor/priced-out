// The agent page tells a saved run as a story in parts. These check the
// grouping, and that the published example still tells a whole story.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { autonomy, partsOf, roundsIn } from "../site/agent/story.js";
import { autonomy as summaryCount } from "../agent/summary.mjs";

const fp = (round, action, spent) => ({ kind: "flashpoint", round, action, spent });

test("a round is told as write, seal, send, open, decide", () => {
  const steps = [
    { kind: "plan" },
    fp(1, "design", 0.5),
    fp(1, "publish", 1),
    { kind: "sealed", round: 1 },
    fp(1, "publish", 1.5),
    { kind: "send-approved", round: 1 },
    fp(1, "send", 2),
    { kind: "wait" },
    fp(1, "results", 2.5),
    { kind: "commander" },
    { kind: "opened", round: 1 },
    { kind: "challenge", round: 1 },
    { kind: "debrief", round: 1 },
    { kind: "finish", spent: 2.5 },
  ];
  const parts = partsOf(steps);
  assert.deepEqual(parts.map((part) => part.part), ["plan", "write", "seal", "send", "open", "decide", "answer"]);
  assert.deepEqual(parts.map((part) => part.steps.length), [1, 2, 1, 4, 3, 2, 1]);
  assert.deepEqual(parts.map((part) => part.round), [0, 1, 1, 1, 1, 1, 0]);
  assert.deepEqual(parts.map((part) => part.spent), [0, 1, 1, 2, 2.5, 2.5, 2.5]);
});

test("a second round starts its own parts", () => {
  const parts = partsOf([
    fp(1, "design", 0.5), { kind: "sealed", round: 1 }, fp(1, "send", 1), fp(1, "results", 1.5), { kind: "opened", round: 1 }, { kind: "debrief", round: 1 },
    fp(2, "design", 2), { kind: "sealed", round: 2 }, fp(2, "send", 2.5),
  ]);
  assert.deepEqual(parts.map((part) => `${part.part}${part.round}`), ["write1", "seal1", "send1", "open1", "decide1", "write2", "seal2", "send2"]);
});

test("a step with no part of its own stays with the part before it", () => {
  const parts = partsOf([{ kind: "thinking" }, fp(1, "design", 0.5), { kind: "blocked" }, { kind: "email-limit" }]);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].steps.length, 4);
});

test("the page counts what the agent did alone the same way the summary does", () => {
  const run = JSON.parse(fs.readFileSync(new URL("../site/data/agent-run.json", import.meta.url), "utf8"));
  assert.deepEqual(autonomy(run.steps), summaryCount(run.steps));
});

test("the published run tells a whole story", () => {
  const run = JSON.parse(fs.readFileSync(new URL("../site/data/agent-run.json", import.meta.url), "utf8"));
  const parts = partsOf(run.steps);
  assert.equal(parts[0].part, "plan");
  assert.equal(parts[parts.length - 1].part, "answer");
  assert.equal(parts.reduce((sum, part) => sum + part.steps.length, 0), run.steps.length);
  for (let round = 1; round <= roundsIn(run.steps); round++) {
    const mine = parts.filter((part) => part.round === round).map((part) => part.part);
    assert.deepEqual(mine, ["write", "seal", "send", "open", "decide"], `round ${round}`);
  }
});
