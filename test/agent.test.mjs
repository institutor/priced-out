import test from "node:test";
import assert from "node:assert/strict";
import { runAgent, makeRedactor, envelopeHash, unbackedNumbers, asksToSend, PRICES, TOOLS, systemPrompt, readSendReply, sendChecks, HANDS_OFF_ORDERS } from "../agent/loop.mjs";
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

// A commander who gives fixed answers and remembers what they were asked.
function desk({ approve = ["yes"], guess = "about half", reply = "carry on" } = {}) {
  const asked = [];
  let approvals = 0;
  const commander = async (request) => {
    asked.push(request);
    if (request.kind === "approve_send") return approve[Math.min(approvals++, approve.length - 1)];
    if (request.kind === "guess") return guess;
    return reply;
  };
  return { commander, asked };
}

const ask = (message, action = "other", extra = {}) => ({ name: "ask_flashpoint", input: { message, action, why: "because", could_change: "what I ask next", ...extra } });
const seal = (question = "What will most people pick?") => ({ name: "seal_predictions", input: { predictions: [{ question, agent_guess: "the lower option" }], why: "it decides the answer" } });
const open = (people_said = "2 of 3 picked the lower option") => ({ name: "open_envelope", input: { results: [{ question: "What will most people pick?", people_said }] } });
const debrief = (next_move = "finish") => ({ name: "debrief", input: { who_was_wrong: "me", biggest_surprise: "none", still_unknown: "nothing", next_move, reason: "r" } });

test("stopping after one round with an open question and budget left is challenged once", async () => {
  const stop = { name: "debrief", input: { who_was_wrong: "me", biggest_surprise: "price did not matter", still_unknown: "what does decide it", next_move: "finish", reason: "only 3 people" } };
  const round = [ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send"), ask("Show the results", "results"), open()];
  const { llm, seen } = scripted([...round, stop, finish, stop, finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint: fakeFlashpoint(), commander: desk().commander, wait: async () => {} });
  assert.match(seen[7], /Before you stop: you say this is still unknown: \\"what does decide it\\"/);
  assert.match(seen[8], /have not debriefed/, "finish waits for the final decision");
  assert.equal(kinds(out, "challenge").length, 1);
  assert.equal(kinds(out, "debrief").length, 1, "the second debrief stands");
  assert.ok(out.answer);

  const tight = await run([...round, stop, finish], { cap: 3, commander: desk().commander });
  assert.equal(kinds(tight, "challenge").length, 0, "no challenge when a second round cannot be afforded");
  assert.ok(tight.answer);
});
const pause = { name: "wait_for_replies", input: { minutes: 5, why: "let them answer" } };
const finish = { name: "finish", input: { recommendation: "r", evidence: "e", scoreboard: [], learned_between_rounds: "l", limits: "x" } };
const kinds = (out, kind) => out.steps.filter((s) => s.kind === kind);
const run = (calls, more = {}) => runAgent({ objective: "o", recipients, cap: 8, llm: scripted(calls).llm, flashpoint: fakeFlashpoint(), wait: async () => {}, ...more });

test("a full two-round mission: rehearse, seal, approve, send, open, learn, repeat", async () => {
  const { commander, asked } = desk();
  const waits = [];
  const out = await run([
    ask("Make a panel from {{RECIPIENTS}} and write a survey", "design"),
    ask("confirm", "publish"),
    { name: "rehearse_on_personas", input: { audience: "club members", how_many: 8, why: "catch broken questions", could_change: "the wording" } },
    ask("Show the persona rehearsal results", "results"),
    seal(),
    ask("confirm", "send"),
    pause,
    ask("Show the results", "results"),
    open(),
    debrief("another_round"),
    { name: "ask_commander", input: { message: "I guessed right. Round two will ask why.", order: "Tell me what you learned before you start a second round.", why: "the order" } },
    ask("Write a follow-up survey for {{RECIPIENTS}}", "design", { new_survey: true }),
    seal("Why?"),
    ask("confirm", "publish"),
    ask("confirm", "send"),
    ask("Show the results", "results"),
    { name: "open_envelope", input: { results: [{ question: "Why?", people_said: "All 3 gave the same reason" }] } },
    debrief(),
    { name: "finish", input: { ...finish.input, scoreboard: [{ round: 1, question: "q", people_said: "2 of 3", agent: "right", personas: "no guess", commander: "wrong" }] } },
  ], { commander, wait: async (m) => { waits.push(m); } });

  assert.equal(out.answer.recommendation, "r");
  assert.equal(out.answer.scoreboard.length, 1);
  assert.equal(out.spent, 9 * PRICES.survey + PRICES.rehearsal);
  assert.deepEqual(waits, [5]);
  assert.equal(asked.filter((a) => a.kind === "approve_send").length, 2, "one approval for each survey");
  assert.equal(asked.filter((a) => a.kind === "guess").length, 2);
  assert.match(asked.find((a) => a.kind === "approve_send").survey, /Drafted survey 1/);
  assert.deepEqual(kinds(out, "sealed").map((s) => s.round), [1, 2]);
  assert.deepEqual(kinds(out, "opened").map((s) => s.intact), [true, true]);
  assert.deepEqual(kinds(out, "debrief").map((s) => s.nextMove), ["another_round", "finish"]);
  assert.match(kinds(out, "rehearsal")[0].reply, /SYNTHETIC/);
  const replies = kinds(out, "flashpoint").map((s) => s.reply);
  assert.match(replies[2], /SYNTHETIC rehearsal of survey 1/);
  assert.match(replies[4], /Survey 1: 3 of 3 answered/);
  assert.match(replies[8], /Survey 2: 3 of 3 answered/);
  assert.equal(kinds(out, "finish")[0].handedBack, 8 - out.spent);
});

test("Flashpoint gets the real addresses; the model and the log never do", async () => {
  const sent = [];
  const flashpoint = async ({ message }) => { sent.push(message); return { text: "Added ana+1@example.com and someone@else.org" }; };
  const { commander } = desk({ reply: "ask ben@example.com" });
  const { llm, seen } = scripted([ask("Panel: {{RECIPIENTS}}", "design"), { name: "ask_commander", input: { message: "Anything to add?", why: "local knowledge" } }, finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint, commander, wait: async () => {} });
  assert.match(sent[0], /Ana <ana\+1@example\.com>\nBen <ben@example\.com>/);
  const everything = seen.join("") + JSON.stringify(out.steps);
  assert.doesNotMatch(everything, /@example\.com|@else\.org/);
  assert.match(kinds(out, "flashpoint")[0].reply, /\[recipient 1\] and \[email\]/);
  assert.doesNotMatch(everything, /\bAna\b|\bBen\b/, "names on the list stay out too");
  assert.equal(kinds(out, "commander")[0].reply, "ask [recipient 2]");
});

test("the cap refuses a step that would go over, and nothing is sent", async () => {
  let sends = 0;
  const flashpoint = async () => { sends += 1; return { text: "ok" }; };
  const out = await run([ask("one"), ask("two"), ask("three"), finish], { cap: 1, flashpoint });
  assert.equal(sends, 2);
  assert.equal(out.spent, 1);
  assert.equal(kinds(out, "blocked").length, 1);
});

test("a failed Flashpoint call is not charged and the mission goes on", async () => {
  let n = 0;
  const flashpoint = async () => { n += 1; if (n === 1) throw new Error("payment failed"); return { text: "ok" }; };
  const out = await run([ask("one"), ask("one again"), finish], { flashpoint });
  assert.equal(out.spent, PRICES.survey);
  assert.equal(kinds(out, "flashpoint-failed").length, 1);
  assert.ok(out.answer);
});

test("a model that stops calling tools ends the mission with no answer", async () => {
  const out = await run([]);
  assert.equal(out.answer, null);
  assert.equal(out.spent, 0);
});

test("a wait is kept between 1 and 30 minutes, and the commander can speak during it", async () => {
  const waits = [];
  const { llm, seen } = scripted([{ name: "wait_for_replies", input: { minutes: 500, why: "w" } }, { name: "wait_for_replies", input: { minutes: -3, why: "w" } }, finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint: fakeFlashpoint(), wait: async (m) => { waits.push(m); return m === 30 ? "ask the freshmen too" : ""; } });
  assert.deepEqual(waits, [30, 1]);
  assert.equal(kinds(out, "wait")[0].said, "ask the freshmen too");
  assert.match(seen[1], /the commander said: \\"ask the freshmen too\\"/);
});

test("no email goes out before the envelope is sealed", async () => {
  const { commander, asked } = desk();
  const out = await run([ask("Write a survey", "design"), ask("confirm", "publish"), ask("confirm", "send"), finish], { commander });
  assert.equal(out.spent, 2 * PRICES.survey, "the refused send is not charged");
  assert.equal(asked.length, 0, "the commander is not asked to approve an unsealed send");
  assert.doesNotMatch(JSON.stringify(out.steps), /was emailed/);
});

test("a confirm that would send is gated even when the model labels it something else", async () => {
  const out = await run([ask("Write a survey", "design"), ask("confirm", "publish"), ask("Confirm.", "other"), finish], { commander: desk().commander });
  assert.doesNotMatch(JSON.stringify(out.steps), /was emailed/);
  assert.equal(out.spent, 2 * PRICES.survey);
});

test("the commander can refuse a send, and their reason goes back to the agent", async () => {
  const { commander } = desk({ approve: ["no, question 2 is too personal", "yes"] });
  const { llm, seen } = scripted([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send"), ask("Remove question 2", "design"), ask("confirm", "publish"), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint: fakeFlashpoint(), commander, wait: async () => {} });
  assert.equal(kinds(out, "send-refused")[0].reason, "no, question 2 is too personal");
  assert.match(seen[4], /did not approve this send.*question 2 is too personal/);
  assert.equal(kinds(out, "send-approved").length, 1);
  assert.match(kinds(out, "flashpoint").at(-1).reply, /was emailed/);
  assert.equal(out.spent, 4 * PRICES.survey, "the refused send was not charged");
});

test("a mislabelled confirm cannot slip an email past the commander", async () => {
  const { commander, asked } = desk({ approve: ["no"] });
  // After a refusal the survey is published and waiting to send, so a bare confirm would send it.
  const out = await run([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send"), ask("What is the status?", "other"), ask("confirm", "publish"), finish], { commander });
  assert.equal(asked.filter((a) => a.kind === "approve_send").length, 2);
  assert.doesNotMatch(JSON.stringify(out.steps), /was emailed/);
});

test("with nobody at the desk, no email is sent", async () => {
  const out = await run([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send"), { name: "ask_commander", input: { message: "Are you there?", why: "w" } }, finish]);
  assert.doesNotMatch(JSON.stringify(out.steps), /was emailed/);
  assert.equal(kinds(out, "send-refused").length, 1);
  assert.equal(kinds(out, "commander")[0].reply, null);
});

test("the commander's guess stays sealed until the envelope is opened", async () => {
  const { commander } = desk({ guess: "the pricey one, I bet" });
  const { llm, seen } = scripted([ask("Write a survey", "design"), seal(), open(), ask("confirm", "publish"), ask("confirm", "send"), seal(), ask("Show the results", "results"), open(), finish, ask("Round two", "design", { new_survey: true }), debrief(), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint: fakeFlashpoint(), commander, wait: async () => {} });
  assert.match(seen[9], /have not debriefed/, "finish is refused until the envelope is debriefed");
  assert.match(seen[10], /have not debriefed/, "so is a new round");
  assert.ok(out.answer);
  const sealed = kinds(out, "sealed")[0];
  assert.equal(sealed.hash, envelopeHash(sealed.envelope));
  assert.equal(sealed.envelope.predictions[0].commander, "the pricey one, I bet");
  assert.equal(kinds(out, "sealed").length, 1, "a guess after the send is refused");
  assert.match(seen[3], /Not yet: the envelope opens after/);
  assert.match(seen[6], /already been sent/);
  assert.doesNotMatch(seen[7], /pricey/, "the model has not seen the guess before opening");
  assert.match(seen[8], /Commander guessed: the pricey one, I bet/);
  assert.deepEqual(kinds(out, "opened")[0].rows[0], { question: "What will most people pick?", people_said: "2 of 3 picked the lower option", agent: "the lower option", personas: null, commander: "the pricey one, I bet" });
});

test("a rehearsal that fails is not charged and does not stop the mission", async () => {
  const rehearse = { name: "rehearse_on_personas", input: { audience: "a", how_many: 99, why: "w", could_change: "c" } };
  const early = await run([rehearse, finish]);
  assert.equal(early.spent, 0, "nothing to rehearse before a draft");

  const unpublished = await run([ask("Write a survey", "design"), rehearse, finish]);
  assert.match(kinds(unpublished, "rehearsal-failed")[0].error, /personas take the published version/);

  const out = await run([ask("Write a survey", "design"), ask("confirm", "publish"), rehearse, finish], { flashpoint: fakeFlashpoint({ rehearsalFails: true }) });
  assert.match(kinds(out, "rehearsal-failed")[0].error, /interrupted/);
  assert.equal(out.spent, 2 * PRICES.survey);
  assert.equal(kinds(out, "rehearsal-failed")[0].charged, false);
  assert.ok(out.answer);

  const asked = [];
  const charged = { survey: async () => ({ text: "draft" }), rehearse: async (args) => { asked.push(args); const err = new Error("the run started and then broke"); err.charged = true; throw err; } };
  const paid = await run([ask("Write a survey", "design"), rehearse, finish], { flashpoint: charged });
  assert.equal(paid.spent, PRICES.survey + PRICES.rehearsal);
  assert.equal(asked[0].howMany, 30, "the persona count is kept between 5 and 30");
});

test("tools the run cannot use are not offered to the model", async () => {
  let offered = [];
  const llm = async ({ tools }) => { offered = tools.map((t) => t.name); return { stop_reason: "end_turn", content: [] }; };
  await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint: async () => ({ text: "ok" }), wait: async () => {} });
  assert.ok(!offered.includes("rehearse_on_personas") && !offered.includes("make_deck"));
  await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint: fakeFlashpoint(), wait: async () => {} });
  assert.deepEqual(offered, TOOLS.map((t) => t.name));
});

test("numbers in the answer that came from nowhere are flagged", async () => {
  assert.deepEqual(unbackedNumbers("4 of 5 said $25, up 12%", ["Survey: 4 of 5 answered", "price $25"]), ["12"]);
  const out = await run([ask("Write a survey", "design"), { name: "finish", input: { ...finish.input, evidence: "3 of 3 answered and 87% agreed" } }], { flashpoint: async () => ({ text: "3 of 3 answered" }) });
  assert.deepEqual(kinds(out, "finish")[0].unbacked, ["87"]);
});

test("the redactor removes listed and unlisted addresses", () => {
  const redact = makeRedactor(recipients);
  assert.equal(redact("to ben@example.com and x.y@z.co"), "to [recipient 2] and [email]");
  assert.equal(redact("Ana <ana+1@example.com> answered"), "[person 1] <[recipient 1]> answered");
  assert.equal(redact("Analysis for Ben. Benefits: none"), "Analysis for [person 2]. Benefits: none");
});

test("the practice writer plays Flashpoint without ever seeing an address", async () => {
  const { practiceWriter, PRACTICE_TAG } = await import("../agent/practice-writer.mjs");
  const prompts = [];
  const askModel = async (system, prompt) => { prompts.push(prompt); return `written ${prompts.length}`; };
  const flashpoint = fakeFlashpoint({ writer: practiceWriter({ ask: askModel }), tag: PRACTICE_TAG });
  const { commander } = desk();
  const out = await run([
    ask("Make a panel from {{RECIPIENTS}} and ask about price", "design"),
    ask("confirm", "publish"),
    { name: "rehearse_on_personas", input: { audience: "members", how_many: 5, why: "w", could_change: "c" } },
    ask("Show the persona rehearsal results", "results"),
    seal(), ask("confirm", "send"), ask("Show the results", "results"), open(), debrief(), finish,
  ], { flashpoint, commander });
  assert.doesNotMatch(prompts.join("\n"), /@example\.com/);
  assert.match(prompts[0], /Invent exactly 2 members/);
  for (const step of kinds(out, "flashpoint")) assert.ok(step.reply.startsWith(PRACTICE_TAG));
  assert.match(kinds(out, "flashpoint")[0].reply, /Drafted survey 1\.\n\nwritten 2\nIt is not published/);
  assert.equal(kinds(out, "opened").length, 1);
  assert.equal(prompts.length, 6, "cast, draft, persona answers, persona results, people's answers, results");
});

test("a message that tells Flashpoint to email people is gated, whatever it is labelled", async () => {
  for (const text of ["Publish it and send it to the panel", "Now email the survey to everyone", "Please distribute", "Sending now: go ahead"]) assert.ok(asksToSend(text), text);
  for (const text of ["Make a panel from these names and emails", "Write the survey. Do not publish or send yet.", "Draft it, but don't email it", "How many emails bounced?", "Show the results before sending anything"]) assert.ok(!asksToSend(text), text);

  let reached = 0;
  const flashpoint = async () => { reached += 1; return { text: "ok" }; };
  const { llm, seen } = scripted([ask("Make a panel from {{RECIPIENTS}}, write a survey, publish it and send it", "design"), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint, commander: desk().commander, wait: async () => {} });
  assert.equal(reached, 0, "Flashpoint never got the message");
  assert.equal(out.spent, 0);
  assert.match(seen[1], /would email people, and the round's envelope is not sealed/);
});

test("the commander approves from the latest full survey, plus any changes since", async () => {
  const long = (name) => `${name}: Q1 What would you pay? Q2 Would you come? ${"x".repeat(200)}`;
  const replies = [long("first draft"), long("second draft"), "Reworded Q2 as asked.", "Publishing makes it live. Reply confirm.", "Sent."];
  const flashpoint = async () => ({ text: replies.shift() });
  const { commander, asked } = desk();
  await run([ask("Write a survey", "design"), ask("Shorten it and show it again", "design"), ask("Reword Q2", "design"), seal(), ask("publish it", "publish"), ask("confirm", "send"), finish], { flashpoint, commander });
  const approval = asked.find((a) => a.kind === "approve_send");
  assert.match(approval.survey, /^second draft/);
  assert.deepEqual(approval.changes, ["Reworded Q2 as asked."]);
  assert.deepEqual(asked.filter((a) => a.kind === "guess").map((a) => [a.number, a.of]), [[1, 1]]);
});

test("go-aheads are judged by what Flashpoint last offered", async () => {
  const offers = async (offer, goAhead) => {
    let n = 0;
    const flashpoint = async () => { n += 1; return { text: n === 1 ? offer : "done" }; };
    const { commander, asked } = desk();
    const out = await run([ask("Write a survey", "design"), seal(), ask(goAhead, "publish"), finish], { flashpoint, commander });
    return { gated: asked.some((a) => a.kind === "approve_send"), spent: out.spent };
  };
  assert.equal((await offers("Publishing will make the survey immediately live. Reply confirm.", "confirm")).gated, false);
  assert.equal((await offers("Pushing v2 will replace the live survey immediately. Please reply confirm once more.", "Confirm.")).gated, false);
  assert.equal((await offers("I will publish and notify the panel. Reply confirm.", "confirm")).gated, true);
  assert.equal((await offers("I will publish it and share the link with members. Reply confirm.", "Yes, confirm")).gated, true);
  assert.equal((await offers("Ready when you are.", "Confirmed, go ahead")).gated, true, "an unknown offer is treated as a send");
});

test("asking for results never counts as sending, and the envelope can then be opened", async () => {
  assert.ok(!asksToSend("Please send me the results with exact counts"));
  assert.ok(!asksToSend("Send back a summary"));
  const out = await run([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send"), ask("Please send me the results", "results"), open(), debrief(), finish], { commander: desk().commander });
  assert.equal(kinds(out, "opened").length, 1);
});

test("a changed survey needs the commander's approval again", async () => {
  let fail = true;
  const fake = fakeFlashpoint();
  const flashpoint = { survey: async (args) => { if (/^confirm$/i.test(args.message) && fail === "next") { fail = false; throw new Error("network dropped"); } return fake.survey(args); } };
  const { commander, asked } = desk();
  fail = false;
  const { llm, seen } = scripted([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), { name: "wait_for_replies", input: { minutes: 1, why: "arm the failure" } }, ask("confirm", "send"), ask("Add a question about dinner", "design"), ask("confirm", "send"), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint, commander, wait: async () => { fail = "next"; } });
  assert.equal(asked.filter((a) => a.kind === "approve_send").length, 2, "approved once before the failed send, and again after the change");
  assert.match(seen[5], /outcome is not known: ask Flashpoint for the survey's status/);
  assert.equal(kinds(out, "flashpoint-failed")[0].charged, false);
});

test("a failure that was charged is counted against the budget", async () => {
  let n = 0;
  const flashpoint = async () => { n += 1; if (n === 1) throw Object.assign(new Error("reply had no text"), { charged: true }); return { text: "ok" }; };
  const out = await run([ask("one"), ask("two"), ask("three"), finish], { cap: 1, flashpoint });
  assert.equal(out.spent, 1);
  assert.equal(n, 2);
  assert.equal(kinds(out, "flashpoint-failed")[0].charged, true);
});

test("a round cannot be abandoned with its results read and its envelope sealed", async () => {
  const { llm, seen } = scripted([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send"), ask("Show the results", "results"), ask("Round two", "design", { new_survey: true }), finish]);
  await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint: fakeFlashpoint(), commander: desk().commander, wait: async () => {} });
  assert.match(seen[6], /envelope is still sealed/);
});

// A run that is stopped part-way: the promise it returns never settles, like a
// process that was killed. `until` resolves when the run has reached the stop.
const never = () => new Promise(() => {});
const copy = (value) => JSON.parse(JSON.stringify(value));

test("a mission stopped during a wait carries on where it left off", async () => {
  const flashpoint = fakeFlashpoint();
  const saved = [];
  let reached;
  const until = new Promise((resolve) => { reached = resolve; });
  const first = scripted([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send"), pause]);
  runAgent({ objective: "o", recipients, cap: 8, llm: first.llm, flashpoint, commander: desk({ guess: "nearly all" }).commander, wait: () => { reached(); return never(); }, save: (s) => saved.push(copy(s)) });
  await until;

  const state = saved[saved.length - 1];
  assert.equal(state.spent, 3 * PRICES.survey);
  assert.equal(state.survey.sent, true);

  const { commander, asked } = desk();
  const second = scripted([ask("Show the results", "results"), open(), debrief(), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm: second.llm, flashpoint, commander, wait: async () => {}, resume: state });

  assert.match(second.seen[0], /paused during this wait and has now been resumed/);
  assert.deepEqual(out.steps[0].cutOff, ["wait_for_replies"]);
  assert.equal(out.steps[0].kind, "resumed");
  assert.equal(out.steps[0].n, state.steps + 1, "step numbers carry on");
  assert.equal(out.spent, 4 * PRICES.survey, "what was spent before the stop still counts");
  assert.equal(kinds(out, "opened")[0].rows[0].commander, "nearly all", "the commander's sealed guess survived the stop");
  assert.equal(asked.length, 0, "nothing is approved or sent a second time");
  assert.ok(out.answer);
});

test("a mission stopped in the middle of a send is told the outcome is not known", async () => {
  const fake = fakeFlashpoint();
  const saved = [];
  let reached;
  const until = new Promise((resolve) => { reached = resolve; });
  // The connection hangs on the third message, which is the send.
  let messages = 0;
  const hanging = { ...fake, survey: (args) => { messages += 1; if (messages === 3) { reached(); return never(); } return fake.survey(args); } };
  const first = scripted([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send")]);
  runAgent({ objective: "o", recipients, cap: 8, llm: first.llm, flashpoint: hanging, commander: desk().commander, wait: async () => {}, save: (s) => saved.push(copy(s)) });
  await until;

  const state = saved[saved.length - 1];
  const second = scripted([ask("What is the status of the survey?", "other"), ask("Show the results", "results"), open(), debrief(), finish]);
  // Only the commander can say that the cut-off send went out.
  const after = desk({ reply: "yes, it arrived" });
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm: second.llm, flashpoint: fake, commander: after.commander, wait: async () => {}, resume: state });

  assert.match(after.asked[0].message, /Did the survey go out\?/);
  assert.match(second.seen[1], /commander confirms that the survey went out/);
  assert.match(second.seen[0], /Whether the step happened is not known/);
  assert.match(second.seen[0], /ask Flashpoint for the survey's status before you repeat it/);
  assert.deepEqual(out.steps[0].cutOff, ["ask_flashpoint"]);
  assert.equal(out.spent, 5 * PRICES.survey, "two paid steps before the stop, the cut-off send counted to be safe, two after");
  assert.equal(kinds(out, "send-approved").length, 0, "nobody is emailed a second time");
  assert.equal(kinds(out, "opened").length, 1, "once Flashpoint has said where the survey stands, the round can finish");
});

test("a mission stopped between steps resumes without inventing a result", async () => {
  const flashpoint = fakeFlashpoint();
  const saved = [];
  const first = scripted([ask("Write a survey", "design"), seal()]);
  let turns = 0;
  const stopping = async (args) => { turns += 1; if (turns === 3) return never(); return first.llm(args); };
  let reached;
  const until = new Promise((resolve) => { reached = resolve; });
  runAgent({ objective: "o", recipients, cap: 8, llm: async (args) => { if (turns === 2) reached(); return stopping(args); }, flashpoint, commander: desk().commander, wait: async () => {}, save: (s) => saved.push(copy(s)) });
  await until;

  const state = saved[saved.length - 1];
  assert.equal(state.done, null);
  const before = state.messages.length;
  const second = scripted([finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm: second.llm, flashpoint, commander: desk().commander, wait: async () => {}, resume: state });
  assert.deepEqual(out.steps[0].cutOff, []);
  assert.equal(JSON.parse(second.seen[0]).length, before, "no message is added when nothing was cut off");
  assert.equal(state.survey.envelope !== null, true, "the sealed envelope is in the saved state");
});

test("after a debrief the agent is shown its standing orders again", async () => {
  const { llm, seen } = scripted([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send"), ask("Show the results", "results"), open(), debrief(), finish]);
  await runAgent({ objective: "o", recipients, cap: 8, orders: ["Come to me if the answers split evenly."], llm, flashpoint: fakeFlashpoint(), commander: desk().commander, wait: async () => {} });
  assert.match(seen[7], /read your standing orders again[^"]*- Come to me if the answers split evenly\./);
});

test("the stand-in Flashpoint can be put back where a stopped run left it", async () => {
  const first = fakeFlashpoint();
  await first.survey({ message: "Write a survey", newSurvey: false });
  await first.survey({ message: "confirm", newSurvey: false });
  const second = fakeFlashpoint();
  second.restore(copy(first.state()));
  const reply = await second.survey({ message: "confirm", newSurvey: false });
  assert.match(reply.text, /Survey 1 was emailed/);
});

// A Flashpoint whose next "confirm" after arm() drops the connection once.
function flaky() {
  const fake = fakeFlashpoint();
  let armed = false;
  const calls = [];
  return {
    calls,
    arm: () => { armed = true; },
    survey: async (args) => {
      if (armed && /^confirm$/i.test(args.message)) { armed = false; throw new Error("network dropped"); }
      calls.push(args.message);
      return fake.survey(args);
    },
  };
}
const arm = { name: "wait_for_replies", input: { minutes: 1, why: "arm the failure" } };
const approvals = (asked) => asked.filter((a) => a.kind === "approve_send").length;

test("a send that failed cannot simply be tried again", async () => {
  const flashpoint = flaky();
  const { commander, asked } = desk({ reply: "no, nothing arrived" });
  const { llm, seen } = scripted([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), arm, ask("confirm", "send"), ask("confirm", "send"), ask("Where does the survey stand?", "other"), ask("confirm", "send"), finish]);
  await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint, commander, wait: async () => { flashpoint.arm(); } });
  assert.match(seen[6], /an earlier send was tried and nobody knows whether it went out/);
  assert.equal(flashpoint.calls.filter((m) => m === "confirm").length, 2, "one publish and one send reached Flashpoint, not a blind retry");
  assert.match(asked.find((a) => a.kind === "ask").message, /Did the survey go out\?/);
  assert.match(seen[7], /counts as not sent/);
  assert.equal(approvals(asked), 2, "the send after the status check is approved afresh");
});

test("when the commander says an unsure send went out, it is not sent again and the round goes on", async () => {
  const flashpoint = flaky();
  const { commander, asked } = desk({ reply: "yes" });
  const out = await run([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), arm, ask("confirm", "send"), ask("Where does the survey stand?", "other"), ask("Show the results", "results"), open(), debrief(), finish], { flashpoint, commander, wait: async () => { flashpoint.arm(); } });
  assert.equal(approvals(asked), 1);
  assert.equal(kinds(out, "opened").length, 1);
});

test("if nobody confirms an unsure send, the envelope stays shut", async () => {
  const flashpoint = flaky();
  const { commander } = desk({ reply: "no" });
  const { llm, seen } = scripted([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), arm, ask("confirm", "send"), ask("Where does the survey stand?", "other"), ask("Show the results", "results"), open(), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint, commander, wait: async () => { flashpoint.arm(); } });
  assert.equal(kinds(out, "opened").length, 0);
  assert.doesNotMatch(seen[8], /about half/, "the commander's guess is not revealed");
});

test("one approval covers one send: a reminder is asked for again", async () => {
  const { commander, asked } = desk();
  await run([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send"), ask("Send a reminder email to everyone who has not answered", "send"), finish], { commander });
  assert.equal(approvals(asked), 2);
});

test("asking to send and then confirming it is one send, approved once", async () => {
  const { commander, asked } = desk();
  const out = await run([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("Send the survey to the panel", "send"), ask("confirm", "send"), ask("Show the results", "results"), open(), debrief(), finish], { commander });
  assert.equal(approvals(asked), 1);
  assert.deepEqual(kinds(out, "flashpoint").map((s) => s.emailed), [false, false, false, true, false]);
});

test("a first name, a surname and another letter case are all removed, and everyday words are left", () => {
  const redact = makeRedactor([{ name: "Jane Okafor", email: "jane@example.com" }, { name: "Tester One", email: "t1@example.com" }]);
  assert.equal(redact("Jane and JANE OKAFOR answered. Okafor wrote more."), "[person 1] and [person 1] answered. [person 1] wrote more.");
  assert.equal(redact("One of 3 testers answered. Tester One did."), "One of 3 testers answered. [person 2] did.");
  assert.equal(redact("Janet answered"), "Janet answered", "only whole words");
});

// One full round: drafted, sealed, published, sent, read, opened.
const oneRound = (first = {}) => [ask("Write a survey", "design", first), seal(), ask("confirm", "publish"), ask("confirm", "send"), ask("Show the results", "results"), open()];

test("nobody gets a third email: after a survey and a follow-up, another send is refused and costs nothing", async () => {
  const { commander, asked } = desk();
  const { llm, seen } = scripted([...oneRound(), debrief("another_round"), ...oneRound({ new_survey: true }), ask("Send a reminder email to everyone who has not answered", "send"), debrief(), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 20, llm, flashpoint: fakeFlashpoint(), commander, wait: async () => {} });
  assert.equal(kinds(out, "flashpoint").filter((s) => s.emailed).length, 2);
  assert.equal(kinds(out, "email-limit").length, 1);
  assert.equal(approvals(asked), 2, "the commander is not asked about a send the limit refuses");
  assert.match(seen[14], /already had 2 emails[\s\S]*Nothing was charged/);
  assert.equal(out.spent, 4, "eight paid steps, and the refused send is not one of them");
});

test("a reminder counts as an email, so after one there is no follow-up round", async () => {
  const { commander } = desk();
  const { llm, seen } = scripted([...oneRound(), ask("Send a reminder email to everyone who has not answered", "send"), debrief("another_round"), debrief(), ask("Write a follow-up", "design", { new_survey: true }), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 20, llm, flashpoint: fakeFlashpoint(), commander, wait: async () => {} });
  assert.match(seen[8], /Another round is not possible/);
  assert.match(seen[10], /Not started[\s\S]*Nothing was charged/);
  assert.equal(kinds(out, "debrief")[0].nextMove, "finish");
  assert.equal(out.spent, 2.5, "the survey that could never be sent was not paid for");
});

test("with a limit of one email there is one survey and nothing after it", async () => {
  const { commander, asked } = desk();
  const { llm, seen } = scripted([...oneRound(), ask("Send a reminder email to everyone who has not answered", "send"), debrief(), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 20, emailLimit: 1, llm, flashpoint: fakeFlashpoint(), commander, wait: async () => {} });
  assert.equal(kinds(out, "flashpoint").filter((s) => s.emailed).length, 1);
  assert.equal(approvals(asked), 1);
  assert.match(seen[7], /already had their one email/);
});

test("the approval screen is told which email this is", async () => {
  const { commander, asked } = desk();
  await run([...oneRound(), debrief("another_round"), ...oneRound({ new_survey: true }), debrief(), finish], { commander, cap: 20 });
  assert.deepEqual(asked.filter((a) => a.kind === "approve_send").map((a) => [a.email, a.emailLimit]), [[1, 2], [2, 2]]);
});

test("the agent is told the email limit and to keep a follow-up short", () => {
  const two = systemPrompt({ people: 3, cap: 8 });
  assert.match(two, /more than 2 emails in this whole mission, and a reminder counts as one/);
  assert.match(two, /one short follow-up may come/);
  assert.match(two, /three questions at most/);
  const one = systemPrompt({ people: 3, cap: 8, emailLimit: 1 });
  assert.match(one, /more than one email/);
  assert.doesNotMatch(one, /follow-up may come/);
});

test("a resumed mission remembers how many emails went out", async () => {
  const saved = [];
  const { commander } = desk();
  await runAgent({ objective: "o", recipients, cap: 20, llm: scripted([...oneRound(), debrief("another_round"), ...oneRound({ new_survey: true }), debrief(), finish]).llm, flashpoint: fakeFlashpoint(), commander, wait: async () => {}, save: (s) => saved.push(JSON.parse(JSON.stringify(s))) });
  assert.equal(saved.at(-1).emails, 2);
});

// ---- What the real Flashpoint says, and how it is read ----

test("a reply that says the survey is live is not read as an email going out", () => {
  // These four are real replies, kept in replies/.
  assert.equal(readSendReply("The survey is live.\n\nPublic link: **flashpointopinions.com/0a4c06d5**"), "published");
  assert.equal(readSendReply("v2 is live. The survey is active at **flashpointopinions.com/0a4c06d5**. The next synthetic panel run should complete normally."), "published");
  assert.equal(readSendReply("Pushing v2 will replace the live survey immediately. Respondents will see the updated version. Please reply **confirm** once more."), "asks-confirm");
  assert.equal(readSendReply("Invitations were sent to 3 panel members."), "sent");
  assert.equal(readSendReply("I have emailed the survey to the panel."), "sent");
  assert.equal(readSendReply("The survey has not been sent yet. It is ready to be sent."), "unclear");
  assert.equal(readSendReply("Done."), "unclear");
});

// A Flashpoint that answers the way the real one did: a publish ends in "live", not "confirm".
function wordy(sendReply = "Invitations were sent to 2 panel members.") {
  const fake = fakeFlashpoint();
  let confirms = 0;
  return {
    survey: async (args) => {
      if (/^confirm$/i.test(args.message)) {
        confirms += 1;
        await fake.survey(args);
        return { text: confirms === 1 ? "The survey is live.\n\nPublic link: flashpointopinions.com/abc. You can email it to the panel when ready." : sendReply };
      }
      return fake.survey(args);
    },
  };
}

test("publishing with a confirm does not use up an email or close the envelope", async () => {
  const { commander, asked } = desk();
  const out = await run([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send"), ask("Show the results", "results"), open(), debrief(), finish], { flashpoint: wordy(), commander });
  assert.deepEqual(kinds(out, "flashpoint").map((s) => s.emailed), [false, false, true, false]);
  assert.equal(kinds(out, "opened").length, 1);
  assert.equal(asked.filter((a) => a.kind === "ask").length, 0, "nobody had to be asked what a clear reply meant");
});

test("a reply that does not say what happened is put to the commander, for free", async () => {
  const { commander, asked } = desk({ reply: "yes" });
  const out = await run([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send"), ask("Show the results", "results"), open(), debrief(), finish], { flashpoint: wordy("Done. Anything else?"), commander });
  assert.match(asked.find((a) => a.kind === "ask").message, /Did that reply say the survey was emailed/);
  assert.equal(kinds(out, "opened").length, 1);
  assert.equal(out.spent, 2, "asking the commander cost nothing");

  const no = desk({ reply: "no" });
  const stuck = await run([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send"), ask("Show the results", "results"), open(), finish], { flashpoint: wordy("Done. Anything else?"), commander: no.commander });
  assert.equal(kinds(stuck, "opened").length, 0, "not sent, so the envelope stays shut");
});

test("a survey is not sent if the answers could not be paid for, and a round is not started that cannot be finished", async () => {
  const { commander, asked } = desk();
  const { llm, seen } = scripted([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send"), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 1.5, llm, flashpoint: fakeFlashpoint(), commander, wait: async () => {} });
  assert.match(seen[4], /no money left to read the answers/);
  assert.equal(approvals(asked), 0);
  assert.equal(out.spent, 1);

  const second = scripted([...oneRound(), debrief("another_round"), ask("Write a follow-up", "design", { new_survey: true }), finish]);
  const two = await runAgent({ objective: "o", recipients, cap: 5, roundCost: 3.5, llm: second.llm, flashpoint: fakeFlashpoint(), commander: desk().commander, wait: async () => {} });
  assert.match(second.seen[8], /a round costs about \$3\.50/);
  assert.equal(two.spent, 2);
});

test("a results reply cannot take the place of the survey on the approval screen", async () => {
  const { commander, asked } = desk();
  const fake = fakeFlashpoint();
  const flashpoint = { survey: async (args) => (/how is it going/i.test(args.message) ? { text: `${"Status: 0 of 2 answered so far. ".repeat(8)} Shall I remind them? Shall I wait?` } : fake.survey(args)) };
  await run([ask("Write a survey", "design"), ask("How is it going?", "other"), seal(), ask("confirm", "publish"), ask("confirm", "send"), finish], { flashpoint, commander });
  assert.match(asked.find((a) => a.kind === "approve_send").survey, /Which of these would you pick\?/);
});

// ---- The plan ----

const plan = { name: "plan", input: { need_to_know: ["which event people want"], hunches: ["a social"], would_change_my_answer: "if most want a workshop", survey_idea: "five questions", budget_and_emails: "one round, hold $4 back" } };

test("with planFirst, nothing is paid for until the agent has written a plan", async () => {
  const { llm, seen } = scripted([ask("Write a survey", "design"), plan, ask("Write a survey", "design"), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, planFirst: true, llm, flashpoint: fakeFlashpoint(), wait: async () => {} });
  assert.match(seen[1], /write your plan first/);
  assert.equal(out.spent, 0.5);
  assert.deepEqual(kinds(out, "plan")[0].needToKnow, ["which event people want"]);
  assert.equal(kinds(out, "plan")[0].first, true);
});

// ---- Handed over ----

test("the send checks pass a short plain survey and name what is wrong with a bad one", () => {
  const good = `Drafted survey 1. ${"The questions, in full. ".repeat(8)} Q1 Which event would you come to? Q2 Why?`;
  assert.deepEqual(sendChecks({ draft: good }), []);
  assert.match(sendChecks({ draft: "Drafted." })[0], /has not shown the full list/);
  assert.match(sendChecks({ draft: good, changes: ["Changed Q2."] })[0], /changed after/);
  assert.match(sendChecks({ draft: `${good} Q3 What is your household income?` }).join(" "), /income/);
  assert.match(sendChecks({ draft: `${good} Q3 What is your full name?` }).join(" "), /a name/);
  assert.match(sendChecks({ draft: `${good} Do you get financial aid?` }).join(" "), /financial aid/);
  assert.match(sendChecks({ draft: `${good} ${"Another one? ".repeat(10)}` }).join(" "), /too long/);
  assert.match(sendChecks({ draft: `${good} ${"Another? ".repeat(4)}`, followUp: true }).join(" "), /a follow-up here should have 5/);
});

test("handed over, the agent sends without a person, and the code's checks are in the log", async () => {
  const out = await run([plan, ...oneRound(), debrief(), finish], { handsOff: true, orders: HANDS_OFF_ORDERS, planFirst: true });
  assert.equal(kinds(out, "flashpoint").filter((s) => s.emailed).length, 1);
  assert.equal(kinds(out, "send-preapproved").length, 1);
  assert.equal(kinds(out, "send-preapproved")[0].checks.length, 5);
  assert.equal(kinds(out, "send-approved").length, 0);
  assert.equal(kinds(out, "opened").length, 1);
});

test("handed over, a survey that asks for something personal is held back, and the agent can fix it", async () => {
  const fake = fakeFlashpoint();
  let fixed = false;
  const flashpoint = {
    survey: async (args) => {
      const reply = await fake.survey(args);
      if (/take the income question out/i.test(args.message)) fixed = true;
      return /Drafted survey|Changed survey/.test(reply.text) && !fixed ? { text: reply.text.replace("| Q2 |", "| Q0 | Number | What is your household income? | (number) |\n| Q2 |") } : reply;
    },
  };
  const { llm, seen } = scripted([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send"), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, handsOff: true, llm, flashpoint, wait: async () => {} });
  assert.equal(kinds(out, "send-held").length, 1);
  assert.match(seen[4], /did not pass the send checks[\s\S]*income/);
  assert.equal(kinds(out, "flashpoint").filter((s) => s.emailed).length, 0);
  assert.equal(out.spent, 1, "the held send cost nothing");
});

test("without --hands-off and with nobody at the desk, still nothing is sent", async () => {
  const out = await run([...oneRound(), finish]);
  assert.equal(kinds(out, "flashpoint").filter((s) => s.emailed).length, 0);
  assert.equal(kinds(out, "send-preapproved").length, 0);
});

test("the agent's prompt says who approves a send in each mode, and gives back what it remembered", () => {
  assert.match(systemPrompt({ people: 3, cap: 8 }), /the commander is shown the survey and must approve it/);
  const away = systemPrompt({ people: 3, cap: 8, handsOff: true, orders: HANDS_OFF_ORDERS, memory: ["On a small list, ask people to rank."] });
  assert.match(away, /handed this mission over and is away/);
  assert.doesNotMatch(away, /must approve it/);
  assert.match(away, /What you learned on earlier missions\n[\s\S]*- On a small list, ask people to rank\./);
  assert.match(systemPrompt({ people: 3, cap: 8, roundCost: 3.5 }), /costs about \$3\.50/);
});

test("the lessons the agent writes at the end are kept, three at most, with names taken out", async () => {
  const done = { name: "finish", input: { ...finish.input, lessons: ["Ana showed that ranking beats picking one.", "", "Two.", "Three.", "Four."] } };
  const out = await run([done]);
  assert.deepEqual(out.answer.lessons, ["[person 1] showed that ranking beats picking one.", "Two.", "Three."]);
});

test("a short follow-up with one question mark still counts as a shown survey", async () => {
  const { listsQuestions, sendChecks } = await import("../agent/loop.mjs");
  const pad = "This is the short follow-up, and it is worth a minute because your answers pointed to a few specific changes we could make this term. ";
  const table = `Drafted survey 2.\n\n| Label | Type | Text | Answer options |\n|---|---|---|---|\n| Intro | Statement | ${pad} | |\n| Q1 | Ranking | Rank these changes from most to least likely to bring you back. | Agenda; A task; Fewer events |\n| Q2 | Open | In a sentence, why did you put your first choice first? | |`;
  assert.equal(listsQuestions(table), true);
  assert.deepEqual(sendChecks({ draft: table, changes: [], followUp: true }), []);
  assert.equal(listsQuestions(`${pad}${pad}\n1. Rank these changes.\n2. Say why in a sentence.`), true);
  assert.equal(listsQuestions(`Survey 2 is published and has not been sent. Nothing was changed. ${pad}${pad}`), false);
  assert.equal(listsQuestions(`${pad}${pad} Shall I publish it?`), false);
});

// ---- Found by a read-through of the real-run path before the first real send ----

// A Flashpoint that answers with fixed replies, in order.
const SURVEY_TEXT = `Here is the survey.\n\n1. Which event would you come to?\n2. What would stop you coming?\n${"It is short and plain. ".repeat(12)}`;
const says = (...texts) => { let i = 0; return { survey: async () => ({ text: texts[Math.min(i++, texts.length - 1)] }) }; };

test("a reply that says sent and also says confirm is put to a person, not read as a question", async () => {
  assert.equal(readSendReply("Invitations were sent to 8 people. Reply confirm if you would like a reminder to go out too."), "unclear");
  assert.equal(readSendReply("I will send it to 8 people. Reply confirm to go ahead."), "asks-confirm");
  const { commander, asked } = desk({ reply: "yes" });
  const flashpoint = says(SURVEY_TEXT, "The survey is live.", "Invitations were sent to 2 people. Reply confirm if you want a reminder sent as well.", "A reminder was sent to 2 people.");
  const out = await run([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("Send it to the list", "send"), ask("confirm", "send"), finish], { flashpoint, commander });
  assert.deepEqual(kinds(out, "flashpoint").map((s) => s.emailed), [false, false, true, true]);
  assert.equal(approvals(asked), 3, "the publish, the send and the reminder were each approved by themselves");
});

test("only a plain yes approves a send", async () => {
  const { approves } = await import("../agent/loop.mjs");
  for (const text of ["yes", "Yes.", "y", "ok", "go ahead", "send it", "yes, send it", "Yes please"]) assert.ok(approves(text), text);
  for (const text of ["ok but change Q2 first", "go back", "send after fixing the typo", "yes if you drop question 3", "no", ""]) assert.ok(!approves(text), text);
  const { commander } = desk({ approve: ["ok but change question 2 first"] });
  const out = await run([ask("Write a survey", "design"), seal(), ask("confirm", "publish"), ask("confirm", "send"), finish], { commander });
  assert.equal(kinds(out, "send-refused").length, 1);
  assert.equal(kinds(out, "flashpoint").some((s) => s.emailed), false);
});

test("an edit made under another step name still shows on the approval screen and is approved again", async () => {
  const { commander, asked } = desk();
  const flashpoint = says(SURVEY_TEXT, "I will send it to 2 people. Reply confirm to go ahead.", "Done: a question about income was put in, and v2 is live.", "Invitations were sent to 2 people.");
  const out = await run([ask("Write a survey", "design"), seal(), ask("Send it to the list", "send"), ask("Fix question 2 and add one about income, then publish", "publish"), ask("confirm", "send"), finish], { flashpoint, commander });
  const screens = asked.filter((a) => a.kind === "approve_send");
  assert.equal(screens.length, 2, "the edit took the first approval away");
  assert.match(screens[1].changes.join(" "), /income/);
  assert.equal(kinds(out, "flashpoint").filter((s) => s.emailed).length, 1);
});

test("the approval screen is given the message that would go to Flashpoint", async () => {
  const { commander, asked } = desk();
  await run([ask("Write a survey", "design"), seal(), ask("Send it to Ana now, and remind everyone in a day", "send"), finish], { commander });
  assert.equal(asked.find((a) => a.kind === "approve_send").message, "Send it to [person 1] now, and remind everyone in a day");
});

test("a publish that says no invitations went out is not an email, and the send after it is approved by itself", async () => {
  assert.equal(readSendReply("The survey is live. No invitations have been sent yet."), "published");
  assert.equal(readSendReply("The survey is live. Nothing has been sent."), "published");
  const { commander, asked } = desk();
  const flashpoint = says(SURVEY_TEXT, "Shall I publish it, ready to share with the panel? Reply confirm.", "The survey is live. No invitations have been sent yet.", "Invitations were sent to 2 people.");
  const out = await run([ask("Write a survey", "design"), seal(), ask("Publish it", "publish"), ask("confirm", "publish"), ask("confirm", "send"), finish], { flashpoint, commander });
  assert.deepEqual(kinds(out, "flashpoint").map((s) => s.emailed), [false, false, false, true]);
  assert.equal(approvals(asked), 2);
});

test("other ways of telling Flashpoint to email people are gated too", () => {
  for (const text of ["Remind everyone who has not answered", "Nudge the non-responders", "Launch it to the panel", "Share the survey with everyone", "Notify the list", "Mail it to them", "Follow up with those who have not replied"]) assert.ok(asksToSend(text), text);
  for (const text of ["Add a question: what would remind you to come?", "Would they share a table at dinner?", "Launch date question: spring or autumn?", "What did people say about the mailing list?"]) assert.ok(!asksToSend(text), text);
});

test("a list of changes is not taken for the survey", async () => {
  const { listsQuestions } = await import("../agent/loop.mjs");
  const pad = "The survey was updated as asked and is ready for you to look at again. ".repeat(3);
  assert.equal(listsQuestions(`${pad}\n1. Reworded question 2 to be shorter.\n2. Removed the question about dinner.`), false);
  assert.equal(listsQuestions(`${pad}\n1. Rank these changes.\n2. Say why in a sentence.`), true);
});

test("a new survey cannot be started while a sent one is still unread", async () => {
  const { commander } = desk();
  const { llm, seen } = scripted([...oneRound().slice(0, 4), ask("Write another survey", "design", { new_survey: true }), ask("Show the results", "results"), open(), finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint: fakeFlashpoint(), commander, wait: async () => {} });
  assert.match(seen[5], /answers have not been read/);
  assert.equal(kinds(out, "opened").length, 1, "round 1 could still be read and opened");
  assert.equal(out.spent, 2, "the refused step cost nothing");
});

test("a two-letter name is taken out as well", () => {
  const redact = makeRedactor([{ name: "Li Wu", email: "li@example.com" }, { name: "An Do", email: "an@example.com" }]);
  assert.equal(redact("Li answered first, then Wu."), "[person 1] answered first, then [person 1].");
  assert.equal(redact("An answer came in. Do not send."), "An answer came in. Do not send.");
});

test("after a rehearsal the agent is told how to make it count", async () => {
  const { llm, seen } = scripted([ask("Write a survey", "design"), ask("confirm", "publish"), { name: "rehearse_on_personas", input: { audience: "club members", how_many: 8, why: "catch broken questions", could_change: "the wording" } }, finish]);
  const out = await runAgent({ objective: "o", recipients, cap: 8, llm, flashpoint: fakeFlashpoint(), commander: desk().commander, wait: async () => {} });
  assert.match(seen[3], /ask Flashpoint for the persona results/);
  assert.doesNotMatch(kinds(out, "rehearsal")[0].reply, /make the rehearsal count/, "the hint is the code's, so it is kept out of Flashpoint's logged reply");
});

// ---- Found by a second read, of the fixes above ----

test("words for the survey are not taken for an order to email people", () => {
  for (const text of ["Add a note that we may follow up with members", "Ask what would remind them to come", "Publish the survey. Do not notify the panel yet", "Publish it, but do not share it with the panel yet", "Show the results. Do not nudge the non-respondents.", "Reword Q3 to ask what would remind them to come, and add a question asking for your full name", "Update question 3", "Show the results and notify me of anything odd"]) assert.ok(!asksToSend(text), text);
  for (const text of ["Publish it, then remind everyone", "Please nudge the non-responders"]) assert.ok(asksToSend(text), text);
});

test("a reply that only promises to send after a confirm is a question, not a send", () => {
  assert.equal(readSendReply("Invitations are sent as soon as you confirm. Reply confirm to proceed."), "asks-confirm");
  assert.equal(readSendReply("3 invitations queued. Reply confirm"), "asks-confirm");
  assert.equal(readSendReply("This cannot be undone once sent. Reply confirm to go ahead."), "asks-confirm");
  assert.equal(readSendReply("I have sent it to 8 people. Reply confirm if you want a reminder too."), "unclear");
});

test("a plain yes may come with a polite word or two", async () => {
  const { approves } = await import("../agent/loop.mjs");
  for (const text of ["yes, looks good", "ok send it", "yes please send it", "sure", "Yes - go ahead", "ok, that's fine"]) assert.ok(approves(text), text);
  for (const text of ["yes but shorten it", "ok change Q2", "go back", "looks good", "please do not send it", "send it tomorrow"]) assert.ok(!approves(text), text);
});

test("an initial or a particle in a name is not taken out of every reply", () => {
  const redact = makeRedactor([{ name: "Mary A. Smith", email: "m@example.com" }, { name: "Luc De La Cruz", email: "l@example.com" }]);
  assert.equal(redact("Option A. is the picnic. De facto, la la."), "Option A. is the picnic. De facto, la la.");
  assert.equal(redact("Smith and Cruz answered."), "[person 1] and [person 2] answered.");
});

test("making a panel is not an edit to the survey", async () => {
  const { commander, asked } = desk();
  const flashpoint = says(SURVEY_TEXT, "Panel created with 2 members.", "Invitations were sent to 2 people.");
  await run([ask("Write a survey", "design"), ask("Add these people to a panel: {{recipients}}"), seal(), ask("Send it to the panel now", "send"), finish], { flashpoint, commander });
  assert.deepEqual(asked.find((a) => a.kind === "approve_send").changes, []);
});

test("handed over, a survey swapped in by a send-like message is checked before it goes", async () => {
  const bad = `${SURVEY_TEXT}\n3. What is your full name?`;
  const flashpoint = says(SURVEY_TEXT, bad, "never reached");
  const out = await run([ask("Write a survey", "design"), seal(), ask("Send it, in this new version", "send"), ask("confirm", "send"), finish], { flashpoint, handsOff: true });
  assert.equal(kinds(out, "send-held").length, 1, "the second ask is checked against the survey that came back");
  assert.match(kinds(out, "send-held")[0].problems.join(" "), /a name/);
  assert.equal(kinds(out, "flashpoint").some((s) => s.emailed), false);
});

test("a third read: more ways a send can be said, asked for or approved", async () => {
  const { approves } = await import("../agent/loop.mjs");
  assert.equal(readSendReply("Invitations went out to 8 panel members. Reply confirm if you also want a reminder scheduled."), "unclear");
  assert.equal(readSendReply("Sent! 8 invitations are on their way. Reply confirm for a reminder."), "unclear");
  for (const text of ["Can you remind everyone who has not answered?", "Fix the typo in Q2 and then remind everyone"]) assert.ok(asksToSend(text), text);
  for (const text of ["do it", "ok do it", "yes go ahead and send it", "yes send it now"]) assert.ok(approves(text), text);
  for (const text of ["ok, is that it?", "send it?", "ok \u043d\u043e \u0441\u043d\u0430\u0447\u0430\u043b\u0430", "do not send it"]) assert.ok(!approves(text), text);
  const { commander, asked } = desk();
  const flashpoint = says(SURVEY_TEXT, "I will send it to 2 people. Reply confirm to go ahead.", "Done. I replaced it.", "Invitations were sent to 2 people.");
  await run([ask("Write a survey", "design"), seal(), ask("Send it to the list", "send"), ask("Rewrite the first one so it asks about money at home"), ask("confirm", "send"), finish], { flashpoint, commander });
  assert.equal(approvals(asked), 2, "the rewrite took the approval away");
});
