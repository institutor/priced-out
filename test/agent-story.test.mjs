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

test("the page only loads a run that is on the list, by a safe file name", async () => {
  const { runFor, aboutRun } = await import("../site/agent/story.js");
  const list = [{ name: "", file: "agent-run.json" }, { name: "two", file: "agent-run-two.json" }, { name: "bad", file: "../secrets.json" }];
  assert.equal(runFor(list, "two").file, "agent-run-two.json");
  assert.equal(runFor(list, null).file, "agent-run.json");
  assert.equal(runFor(list, "nope").file, "agent-run.json");
  assert.equal(runFor(list, "bad").file, "agent-run.json");
  assert.equal(runFor([], "two").file, "agent-run.json");
  assert.equal(runFor(undefined, null).file, "agent-run.json");
  assert.equal(aboutRun({ mode: "practice", handsOff: true, remembered: 3, rounds: 2, spent: 5 }), "a practice run, hands-off: nobody approved the sends, started with 3 lessons from earlier runs, 2 rounds, $5.00 spent");
  assert.equal(aboutRun({ mode: "real", handsOff: false, remembered: 0, rounds: 1, spent: 3.5 }), "a real run, the commander approved each send, 1 round, $3.50 spent");
});

test("every published run on the list tells a whole story", () => {
  const dir = new URL("../site/data/", import.meta.url);
  const list = JSON.parse(fs.readFileSync(new URL("agent-runs.json", dir), "utf8"));
  assert.ok(list.length >= 1);
  assert.equal(list[0].file, "agent-run.json");
  for (const entry of list) {
    const run = JSON.parse(fs.readFileSync(new URL(entry.file, dir), "utf8"));
    assert.equal(run.objective, entry.objective);
    const parts = partsOf(run.steps);
    assert.equal(parts.reduce((sum, part) => sum + part.steps.length, 0), run.steps.length, entry.file);
    assert.equal(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(JSON.stringify(run)), false, entry.file);
  }
});

test("what the agent says before its plan is told with the plan", () => {
  const parts = partsOf([{ kind: "thinking" }, { kind: "plan", first: true }, fp(1, "design", 0.5)]);
  assert.deepEqual(parts.map((part) => `${part.part}${part.round}`), ["plan0", "write1"]);
  assert.equal(parts[0].steps.length, 2);
});

test("a plan changed part way through stays in the part it was changed in", () => {
  const parts = partsOf([{ kind: "plan", first: true }, fp(1, "design", 0.5), { kind: "plan", first: false }, { kind: "sealed", round: 1 }]);
  assert.deepEqual(parts.map((part) => part.part), ["plan", "write", "seal"]);
  assert.equal(parts[1].steps.length, 2);
});

test("a run that stopped before any part began still shows its steps", () => {
  const parts = partsOf([{ kind: "thinking" }, { kind: "blocked" }]);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].steps.length, 2);
  assert.equal(parts[0].round, 1);
});
