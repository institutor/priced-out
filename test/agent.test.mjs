import test from "node:test";
import assert from "node:assert/strict";
import { runAgent, makeRedactor, STEP_PRICE } from "../agent/loop.mjs";
import { fakeFlashpoint } from "../agent/fake-flashpoint.mjs";

const recipients = [
  { name: "Ana", email: "ana+1@example.com" },
  { name: "Ben", email: "ben@example.com" },
];

// A model that plays back a fixed list of tool calls, one per turn.
function scripted(calls) {
  let i = 0;
  const seen = [];
  const llm = async ({ messages }) => {
    seen.push(JSON.stringify(messages));
    const call = calls[i++];
    if (!call) return { stop_reason: "end_turn", content: [{ type: "text", text: "nothing more" }] };
    return { stop_reason: "tool_use", content: [{ type: "text", text: `deciding ${call.name}` }, { type: "tool_use", id: `t${i}`, name: call.name, input: call.input }] };
  };
  return { llm, seen };
}

const finish = { name: "finish", input: { recommendation: "r", evidence: "e", learned_between_rounds: "l", limits: "x" } };
const ask = (message, extra = {}) => ({ name: "ask_flashpoint", input: { message, why: "because", ...extra } });

test("a full two-round run reaches an answer and counts the spend", async () => {
  const { llm } = scripted([
    ask("Make a panel from {{RECIPIENTS}} and write a survey"), ask("confirm"), ask("confirm"),
    { name: "wait_for_replies", input: { minutes: 5, why: "let them answer" } },
    ask("Show the results"),
    ask("Write a follow-up survey for {{RECIPIENTS}}", { new_survey: true }), ask("confirm"), ask("confirm"),
    ask("Show the results"),
    finish,
  ]);
  const waits = [];
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint: fakeFlashpoint(), wait: async (m) => waits.push(m) });
  assert.equal(out.answer.recommendation, "r");
  assert.equal(out.spent, 8 * STEP_PRICE);
  assert.deepEqual(waits, [5]);
  const replies = out.steps.filter((s) => s.kind === "flashpoint").map((s) => s.reply);
  assert.match(replies[3], /Survey 1: 3 of 3 answered/);
  assert.match(replies[7], /Survey 2: 3 of 3 answered/);
});

test("Flashpoint gets the real addresses; the model and the log never do", async () => {
  const sent = [];
  const flashpoint = async ({ message }) => { sent.push(message); return { text: "Added ana+1@example.com and someone@else.org" }; };
  const { llm, seen } = scripted([ask("Panel: {{RECIPIENTS}}"), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint, wait: async () => {} });
  assert.match(sent[0], /Ana <ana\+1@example\.com>\nBen <ben@example\.com>/);
  const everything = seen.join("") + JSON.stringify(out.steps);
  assert.doesNotMatch(everything, /@example\.com|@else\.org/);
  assert.match(out.steps.find((s) => s.kind === "flashpoint").reply, /\[recipient 1\] and \[email\]/);
});

test("the cap refuses a step that would go over, and nothing is sent", async () => {
  let sends = 0;
  const flashpoint = async () => { sends += 1; return { text: "ok" }; };
  const { llm } = scripted([ask("one"), ask("two"), ask("three"), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 1, llm, flashpoint, wait: async () => {} });
  assert.equal(sends, 2);
  assert.equal(out.spent, 1);
  assert.equal(out.steps.filter((s) => s.kind === "blocked").length, 1);
});

test("a failed Flashpoint call is not charged and the run goes on", async () => {
  let n = 0;
  const flashpoint = async () => { n += 1; if (n === 1) throw new Error("payment failed"); return { text: "ok" }; };
  const { llm } = scripted([ask("one"), ask("one again"), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint, wait: async () => {} });
  assert.equal(out.spent, STEP_PRICE);
  assert.equal(out.steps.filter((s) => s.kind === "flashpoint-failed").length, 1);
  assert.ok(out.answer);
});

test("a model that stops calling tools ends the run with no answer", async () => {
  const { llm } = scripted([]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint: fakeFlashpoint(), wait: async () => {} });
  assert.equal(out.answer, null);
  assert.equal(out.spent, 0);
});

test("a wait is kept between 1 and 30 minutes", async () => {
  const waits = [];
  const { llm } = scripted([{ name: "wait_for_replies", input: { minutes: 500, why: "w" } }, { name: "wait_for_replies", input: { minutes: -3, why: "w" } }, finish]);
  await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint: fakeFlashpoint(), wait: async (m) => waits.push(m) });
  assert.deepEqual(waits, [30, 1]);
});

test("the redactor removes listed and unlisted addresses", () => {
  const redact = makeRedactor(recipients);
  assert.equal(redact("to ben@example.com and x.y@z.co"), "to [recipient 2] and [email]");
});
