import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { forSite } from "../agent/publish-run.mjs";

const run = {
  objective: "Pick a price", mode: "practice", model: "m", cap: 8, orders: ["Check with me before any email goes out."], people: 2, stamp: "s", practiceCommander: true,
  steps: [
    { n: 1, kind: "sealed", round: 1, why: "w", hash: "abc", envelope: { predictions: [{ question: "Which price?", agent: "low", personas: null, commander: "high" }, { question: "Why?", agent: "cost", personas: null, commander: null }] } },
    { n: 2, kind: "flashpoint", round: 1, action: "send", message: "Send to [person 1] <[recipient 1]>", reply: "Sent.", receipts: [], price: 0.5, spent: 0.5 },
  ],
};

test("a sealed envelope is published with its questions and without its guesses", () => {
  const out = forSite(run);
  assert.deepEqual(out.steps[0].questions, ["Which price?", "Why?"]);
  assert.equal(out.steps[0].commanderGuessed, 1);
  assert.equal("envelope" in out.steps[0], false);
  assert.equal(out.mode, "practice");
  assert.equal(out.practiceCommander, true);
});

test("a run that still holds an address is not published", () => {
  const leaky = { ...run, steps: [...run.steps, { n: 3, kind: "thinking", text: "I will write to ana+1@example.com next." }] };
  assert.throws(() => forSite(leaky), /still holds an email address/);
});

test("the mission on the site holds no address and says what kind of run it is", () => {
  const file = new URL("../site/data/agent-run.json", import.meta.url);
  const text = fs.readFileSync(file, "utf8");
  const published = JSON.parse(text);
  assert.ok(["real", "practice", "fake"].includes(published.mode));
  assert.ok(published.steps.length > 0);
  assert.doesNotThrow(() => forSite({ ...published, steps: published.steps.map((step) => (step.kind === "sealed" ? { ...step, envelope: { predictions: [] } } : step)) }));
  // A practice run's replies carry the stand-in's label, so nobody can take them for Flashpoint's.
  if (published.mode !== "real") {
    for (const step of published.steps.filter((s) => s.kind === "flashpoint")) assert.match(step.reply, /^\[(PRACTICE|FAKE) FLASHPOINT/, `step ${step.n}`);
  }
});

test("the replay page puts the run on the page as text, never as markup", () => {
  const script = fs.readFileSync(new URL("../site/agent/replay.js", import.meta.url), "utf8");
  assert.doesNotMatch(script, /innerHTML|insertAdjacentHTML|document\.write/);
});

test("several runs can be published, and the page's first run stays first", async () => {
  const { fileFor, listed, withRun } = await import("../agent/publish-run.mjs");
  assert.equal(fileFor(undefined), "agent-run.json");
  assert.equal(fileFor("hands-off"), "agent-run-hands-off.json");
  assert.throws(() => fileFor("../x"), /small letters/);
  assert.throws(() => fileFor("A b"), /small letters/);

  const run = { objective: "o", mode: "practice", handsOff: true, people: 8, memory: ["a", "b"], stamp: "s", steps: [{ kind: "flashpoint", round: 1, spent: 0.5 }, { kind: "flashpoint", round: 2, spent: 3 }, { kind: "finish", spent: 3 }] };
  const entry = listed(run, "two");
  assert.deepEqual(entry, { name: "two", file: "agent-run-two.json", objective: "o", mode: "practice", handsOff: true, standInCommander: false, people: 8, rounds: 2, remembered: 2, spent: 3, stamp: "s" });

  const main = listed({ ...run, handsOff: false }, undefined);
  let list = withRun([], entry);
  list = withRun(list, main);
  assert.deepEqual(list.map((item) => item.file), ["agent-run.json", "agent-run-two.json"]);
  list = withRun(list, listed(run, "three"));
  list = withRun(list, { ...entry, objective: "again" });
  assert.deepEqual(list.map((item) => item.name), ["", "two", "three"]);
  assert.equal(list[1].objective, "again");
});
