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
