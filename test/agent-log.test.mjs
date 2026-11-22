import test from "node:test";
import assert from "node:assert/strict";
import { runAgent, PRICES } from "../agent/loop.mjs";
import { fakeFlashpoint } from "../agent/fake-flashpoint.mjs";
import { logEntry, logHeader, logFooter, shortLine, tally } from "../agent/log.mjs";

const recipients = [{ name: "Ana", email: "ana@example.com" }];
const calls = [
  { name: "ask_flashpoint", input: { message: "Write a survey for {{RECIPIENTS}}", action: "design", why: "start", could_change: "the questions" } },
  { name: "rehearse_on_personas", input: { audience: "members", how_many: 6, why: "check it", could_change: "the wording" } },
  { name: "seal_predictions", input: { predictions: [{ question: "Which | price?", agent_guess: "$20", personas_guess: "$25" }], why: "it is the mission" } },
  { name: "ask_flashpoint", input: { message: "confirm", action: "publish", why: "publish", could_change: "nothing yet" } },
  { name: "ask_flashpoint", input: { message: "confirm", action: "send", why: "send", could_change: "everything" } },
  { name: "wait_for_replies", input: { minutes: 2, why: "they answer fast" } },
  { name: "ask_flashpoint", input: { message: "Show the results", action: "results", why: "read", could_change: "the answer" } },
  { name: "open_envelope", input: { results: [{ question: "Which | price?", people_said: "2 of 3 picked the lower option" }] } },
  { name: "ask_commander", input: { message: "I was wrong.", order: "Tell me what you learned before you start a second round.", why: "the order" } },
  { name: "make_deck", input: { title: "Findings", findings: "2 of 3", why: "to keep", could_change: "nothing" } },
  { name: "finish", input: { recommendation: "Charge less.", evidence: "2 of 3 picked the lower option; 40% said so", scoreboard: [{ round: 1, question: "Which price?", people_said: "2 of 3 lower", agent: "wrong", personas: "partly", commander: "right" }], learned_between_rounds: "no second round", limits: "3 people" } },
];

async function mission() {
  let i = 0;
  const llm = async () => {
    const call = calls[i++];
    return { stop_reason: "tool_use", content: [{ type: "text", text: "thinking aloud" }, { type: "tool_use", id: `t${i}`, name: call.name, input: call.input }] };
  };
  const commander = async ({ kind }) => ({ approve_send: "yes", guess: "$15", ask: "fine" })[kind];
  return runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint: fakeFlashpoint(), commander, wait: async () => "ask about dinner" });
}

test("every kind of step gets a log entry and a short line", async () => {
  const out = await mission();
  const kinds = new Set(out.steps.map((s) => s.kind));
  for (const kind of ["thinking", "flashpoint", "rehearsal", "sealed", "send-approved", "wait", "opened", "commander", "deck", "finish"]) assert.ok(kinds.has(kind), kind);
  for (const step of out.steps) {
    assert.notEqual(logEntry(step), "", step.kind);
    assert.match(shortLine(step), /^\[ ?\d+\]/);
  }
  const log = out.steps.map(logEntry).join("\n");
  assert.match(log, /\| Decision it could change \| the questions \|/);
  assert.match(log, /The commander sealed a guess on 1; the agent cannot see it/);
  assert.doesNotMatch(log.split("is opened")[0], /\$15/, "the commander's guess is not in the log before the envelope opens");
  assert.match(log, /\| Which \/ price\? \| 2 of 3 picked the lower option \| \$20 \| \$25 \| \$15 \|/);
  assert.match(log, /Standing order:\* "Tell me what you learned/);
  assert.match(log, /Commander, while waiting:\* ask about dinner/);
  assert.match(log, /Check these numbers.*: 40\./);
  assert.match(log, /\| 1 \| Which price\? \| 2 of 3 lower \| wrong \| partly \| right \|/);
});

test("the bill adds up to what was spent", async () => {
  const out = await mission();
  const rows = tally(out.steps);
  assert.deepEqual(rows.map((r) => r.count), [4, 1, 1]);
  assert.equal(rows.reduce((sum, r) => sum + r.cost, 0), out.spent);
  assert.equal(out.spent, 4 * PRICES.survey + PRICES.rehearsal + PRICES.deck);
  const footer = logFooter({ steps: out.steps, cap: 8, spent: out.spent, wallet: null });
  assert.match(footer, /\| \*\*Spent\*\* \| \| \*\*\$2\.85\*\* \|/);
  assert.match(footer, /Handed back, of the \$8\.00 cap \| \| \$5\.15/);
  assert.match(footer, /went to the commander 1 time and asked for 1 send approval\./);
});

test("the header says when a run is practice", () => {
  const head = { objective: "o", people: 3, cap: 8, model: "m", orders: ["One."], stamp: "now" };
  assert.match(logHeader({ ...head, mode: "fake", practiceCommander: true }), /practice run with a fake Flashpoint[\s\S]*canned practice replies/);
  assert.match(logHeader({ ...head, mode: "practice" }), /invented every answer/);
  assert.doesNotMatch(logHeader({ ...head, mode: "real", practiceCommander: false }), /practice|canned/);
});
