import test from "node:test";
import assert from "node:assert/strict";
import { runAgent, PRICES } from "../agent/loop.mjs";
import { fakeFlashpoint } from "../agent/fake-flashpoint.mjs";
import { summarize, score, rounds } from "../agent/summary.mjs";

const recipients = [{ name: "Ana", email: "ana+1@example.com" }, { name: "Ben", email: "ben@example.com" }];
const head = { objective: "Pick a price", model: "m", cap: 8, orders: ["Check with me before any email goes out."], people: 2, stamp: "2026-01-01T00-00-00", practiceCommander: false };

const ask = (message, action, extra = {}) => ({ name: "ask_flashpoint", input: { message, action, why: "because", could_change: "what I ask next", ...extra } });
const seal = (question) => ({ name: "seal_predictions", input: { predictions: [{ question, agent_guess: "the lower option" }], why: "it decides the answer" } });
const open = (question) => ({ name: "open_envelope", input: { results: [{ question, people_said: "2 of 2 picked the higher option" }] } });
const debrief = (next_move, still_unknown = "nothing") => ({ name: "debrief", input: { who_was_wrong: "me", biggest_surprise: "price did not matter", still_unknown, next_move, reason: "the reason" } });
const board = [
  { round: 1, question: "Which price?", people_said: "2 of 2 higher", agent: "wrong", personas: "no guess", commander: "right" },
  { round: 2, question: "Why?", people_said: "2 of 2 the venue", agent: "partly", personas: "no guess", commander: "no guess" },
];
const finish = { name: "finish", input: { recommendation: "Charge the higher price.", evidence: "2 of 2 picked it.", scoreboard: board, learned_between_rounds: "Round two asked why.", limits: "Two people." } };

// A whole mission against the fake Flashpoint, with its steps kept.
async function mission(calls) {
  let i = 0;
  const llm = async () => {
    const call = calls[i++];
    if (!call) return { stop_reason: "end_turn", content: [{ type: "text", text: "nothing more" }] };
    return { stop_reason: "tool_use", content: [{ type: "tool_use", id: `t${i}`, name: call.name, input: call.input }] };
  };
  const commander = async (request) => ({ approve_send: "yes", guess: "the higher option", ask: "carry on" })[request.kind];
  const out = await runAgent({ objective: head.objective, recipients, cap: 8, llm, flashpoint: fakeFlashpoint(), commander, wait: async () => {} });
  return out.steps;
}

const round = (question, extra = {}) => [ask("Write a survey", "design", extra), seal(question), ask("confirm", "publish"), ask("confirm", "send"), ask("Show the results", "results"), open(question)];
const twoRounds = () => mission([
  ...round("Which price?"), debrief("finish", "why they chose it"), debrief("another_round", "why they chose it"),
  { name: "ask_commander", input: { message: "Round one surprised me.", order: "Tell me what you learned before you start a second round.", why: "the order" } },
  ...round("Why?", { new_survey: true }), debrief("finish"), finish,
]);

test("the scoreboard is counted for each guesser, and a missing guess is not a wrong one", () => {
  const s = score(board);
  assert.deepEqual(s.agent, { right: 0, partly: 1, wrong: 1, guesses: 2 });
  assert.deepEqual(s.commander, { right: 1, partly: 0, wrong: 0, guesses: 1 });
  assert.equal(s.personas.guesses, 0);
});

test("the summary says what happened in each round", async () => {
  const steps = await twoRounds();
  const list = rounds(steps);
  assert.equal(list.length, 2);
  assert.deepEqual(list[0].sealed, ["Which price?"]);
  assert.equal(list[0].challenged, true);
  assert.equal(list[0].debrief.nextMove, "another_round");
  assert.equal(list[1].emailed, true);

  const text = summarize({ ...head, mode: "real", steps });
  assert.match(text, /\*\*Round 1\.\*\*[\s\S]*sealed guesses on: "Which price\?"[\s\S]*asked it once to think again[\s\S]*\*\*run another round\*\*/);
  assert.match(text, /\*\*Round 2\.\*\*[\s\S]*Its decision: \*\*finish\*\*/);
  assert.match(text, /under the order "Tell me what you learned before you start a second round\."/);
  assert.match(text, /Charge the higher price\./);
  assert.match(text, /The agent: 0 right, 1 partly, 1 wrong\. The AI personas made no guess\. The commander: 1 right, 0 partly, 0 wrong\./);
  assert.match(text, /The agent marked these itself/);
  assert.match(text, new RegExp(`\\*\\*\\$${(8 * PRICES.survey).toFixed(2)}\\*\\* of the \\$8\\.00 cap`));
  assert.doesNotMatch(text, /practice|ana\+1@example\.com|ben@example\.com/i);
});

test("a practice run's summary says so before anything else, and a real one does not", async () => {
  const steps = await twoRounds();
  for (const mode of ["practice", "fake"]) {
    const text = summarize({ ...head, mode, practiceCommander: true, steps });
    assert.ok(text.indexOf("No survey was sent and no real person answered") < text.indexOf("The mission:"), mode);
    assert.match(text, /Nothing below is a finding/);
    assert.match(text, /This practice run paid nothing/);
    assert.match(text, /replies and approvals were canned/);
  }
});

test("a run that stopped early still gets a summary", async () => {
  const steps = await mission([ask("Write a survey", "design")]);
  const text = summarize({ ...head, mode: "real", steps });
  assert.match(text, /The survey was not emailed/);
  assert.match(text, /The agent stopped without an answer/);
  assert.match(summarize({ ...head, mode: "real", steps: [] }), /The agent wrote no survey/);
});
