// The real Flashpoint code has to work the first time it is paid for. These
// tests feed it replies the real service gave earlier (saved in replies/) and
// the ways a call can go wrong.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { realFlashpoint } from "../agent/real-flashpoint.mjs";

const saved = (name) => JSON.parse(fs.readFileSync(new URL(`../replies/${name}.json`, import.meta.url), "utf8")).result;

// A stand-in MCP client. Each entry of `replies` answers one call; a function is
// called with the tool's arguments. A paying call prints a receipt the way
// flashpoint.mjs does.
function client(replies) {
  const calls = [];
  const connect = async () => ({ paidFetch: "pays" });
  const callTool = async (handle, name, args) => {
    calls.push({ name, args, paying: handle.paidFetch === "pays" });
    const next = replies.shift();
    const reply = typeof next === "function" ? next(args) : next;
    if (handle.paidFetch === "pays" && !(reply instanceof Error && reply.unpaid)) console.error("paid: https://basescan.org/tx/0xabc");
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return { connect, callTool, calls };
}
const fast = { sleep: async () => {}, pollEveryMs: 30000 };
const text = (final_text, extra = {}) => ({ conversation_id: "conv-1", status: "completed", result: { conversation_id: "conv-1", survey_id: "survey-1", final_text, ...extra }, error: null });

test("a real draft reply is read, and its ids are sent with the next message", async () => {
  const draft = saved("02-draft");
  const c = client([draft, saved("03-publish"), saved("08-confirm")]);
  const fp = realFlashpoint({ ...c, ...fast });
  const first = await fp.survey({ message: "Write a survey", newSurvey: false });
  assert.match(first.text, /Survey ID/);
  assert.deepEqual(first.receipts, ["paid: https://basescan.org/tx/0xabc"]);
  assert.deepEqual(c.calls[0].args, { brief: "Write a survey" });

  const second = await fp.survey({ message: "publish", newSurvey: false });
  assert.match(second.text, /please reply \*\*confirm\*\*/);
  assert.equal(c.calls[1].args.conversation_id, draft.result.conversation_id ?? draft.conversation_id);
  assert.equal(c.calls[1].args.survey_id, draft.result.survey_id);

  await fp.survey({ message: "confirm", newSurvey: false });
  assert.ok(c.calls[2].args.conversation_id && c.calls[2].args.survey_id);
});

test("a new survey starts a fresh conversation, and a reply without ids keeps the old ones", async () => {
  const c = client([text("draft"), { status: "completed", result: { final_text: "ok" }, error: null }, text("again"), text("round two")]);
  const fp = realFlashpoint({ ...c, ...fast });
  await fp.survey({ message: "one" });
  await fp.survey({ message: "two" });
  await fp.survey({ message: "three" });
  assert.deepEqual(c.calls[2].args, { brief: "three", conversation_id: "conv-1", survey_id: "survey-1" });
  await fp.survey({ message: "four", newSurvey: true });
  assert.deepEqual(c.calls[3].args, { brief: "four" });
});

test("replies that are not a survey step are failures, and say whether they were paid for", async () => {
  const cases = [
    [{ error: "survey not found", result: null }, /survey not found/, true],
    ["Rate limited, try again", /had no text: Rate limited/, true],
    [text("   "), /had no text/, true],
    [Object.assign(new Error("fetch failed"), { unpaid: true }), /fetch failed/, false],
    [new Error("socket hang up after payment"), /socket hang up/, true],
  ];
  for (const [reply, message, charged] of cases) {
    const fp = realFlashpoint({ ...client([reply]), ...fast });
    await assert.rejects(fp.survey({ message: "x" }), (err) => { assert.match(err.message, message); assert.equal(err.charged, charged, err.message); return true; });
  }
});

test("console.error is put back after a call, whether it worked or not", async () => {
  const before = console.error;
  const fp = realFlashpoint({ ...client([text("ok"), new Error("boom")]), ...fast });
  await fp.survey({ message: "x" });
  await assert.rejects(fp.survey({ message: "y" }));
  assert.equal(console.error, before);
});

test("a real create-and-run panel reply becomes a rehearsal the agent can read", async () => {
  const c = client([text("draft"), saved("05-panel")]);
  const fp = realFlashpoint({ ...c, ...fast, label: "tonight" });
  await fp.survey({ message: "Write a survey" });
  const out = await fp.rehearse({ audience: "club members", howMany: 8, objective: "pick a price" });
  assert.deepEqual(c.calls[1].args, { action: "create_and_run", name: "Rehearsal tonight", num_respondents: 8, research_objective: c.calls[1].args.research_objective, context: "club members", survey_id: "survey-1" });
  assert.match(c.calls[1].args.research_objective, /pick a price/);
  // That real run was the one a skip rule cut short, which is exactly what a rehearsal is for.
  assert.match(out.text, /^SYNTHETIC rehearsal: 120 of 120 AI personas responded\. These are AI personas, not people\./);
  assert.match(out.text, /120 were cut off before the end/);
  assert.match(out.text, /scoped to panel_id=01a1fb81-fae0-7bb2-bf49-2431da9b8cad and run_id=01a1fb81-fafb-7a01-9f31-efc24db16151/);
  assert.equal(out.receipts.length, 1);
});

test("a rehearsal passes on Flashpoint's warning that personas took the published version", async () => {
  const c = client([text("draft"), saved("15-panel-run")]);
  const fp = realFlashpoint({ ...c, ...fast });
  await fp.survey({ message: "Write a survey" });
  const out = await fp.rehearse({ audience: "a", howMany: 5, objective: "o" });
  assert.match(out.text, /Flashpoint warns: This survey has unpublished edits: the personas answered the LIVE published version/);
});

test("a rehearsal that comes back as a job is waited for without paying again", async () => {
  const finished = saved("20-panel-run");
  const c = client([text("draft"), { job_id: "job-9", status: "running" }, { status: "running", stage: "answering" }, finished]);
  const waits = [];
  const fp = realFlashpoint({ ...c, sleep: async (ms) => { waits.push(ms); }, pollEveryMs: 30000 });
  await fp.survey({ message: "Write a survey" });
  const out = await fp.rehearse({ audience: "a", howMany: 5, objective: "o" });
  assert.match(out.text, /None was cut off/);
  assert.deepEqual(waits, [30000, 30000]);
  assert.deepEqual(c.calls.slice(2).map((call) => [call.name, call.args, call.paying]), [["panel", { action: "status", job_id: "job-9" }, false], ["panel", { action: "status", job_id: "job-9" }, false]]);
});

test("rehearsal failures say whether the run was paid for", async () => {
  const run = async (replies, options = {}) => {
    const fp = realFlashpoint({ ...client([text("draft"), ...replies]), ...fast, ...options });
    await fp.survey({ message: "Write a survey" });
    return fp.rehearse({ audience: "a", howMany: 5, objective: "o" });
  };
  const fails = (promise, message, charged) => assert.rejects(promise, (err) => { assert.match(err.message, message); assert.equal(err.charged, charged, err.message); return true; });
  await fails(run([{ error: "survey is not published" }]), /not published/, true);
  await fails(run([{ status: "completed" }]), /started no persona run/, true);
  await fails(run([{ job_id: "j" }, { status: "failed" }]), /persona run failed/, true);
  await fails(run([{ job_id: "j" }, Object.assign(new Error("network down"), { unpaid: true })]), /Could not check on the persona run: network down/, true);
  await fails(run([{ job_id: "j" }, { status: "running" }, { status: "running" }], { maxPolls: 2 }), /did not finish in 1 minutes/, true);

  const noSurvey = realFlashpoint({ ...client([]), ...fast });
  await fails(noSurvey.rehearse({ audience: "a", howMany: 5, objective: "o" }), /nothing to rehearse/, false);
});

test("a deck comes back as a link or as a saved file", async () => {
  const link = realFlashpoint({ ...client([{ download_url: "https://files.example/deck.pptx" }]), ...fast });
  assert.match((await link.deck({ title: "t", findings: "f" })).text, /https:\/\/files\.example\/deck\.pptx/);

  const files = [];
  const c = client([{ result: { pptx_base64: Buffer.from("slides").toString("base64") } }, { status: "completed" }]);
  const file = realFlashpoint({ ...c, ...fast, saveFile: (name, bytes) => files.push([name, bytes.toString()]) });
  const out = await file.deck({ title: "t", findings: "f" });
  assert.equal(out.file, "deck.pptx");
  assert.deepEqual(files, [["deck.pptx", "slides"]]);
  assert.deepEqual(c.calls[0].args, { title: "t", data_context: "f", max_slides: 6 });
  await assert.rejects(file.deck({ title: "t", findings: "f" }), (err) => err.charged === true && /returned no deck/.test(err.message));
});

test("every raw reply is handed to keepRaw", async () => {
  const kept = [];
  const fp = realFlashpoint({ ...client([text("draft"), { job_id: "j" }, saved("20-panel-run")]), ...fast, keepRaw: (tool, reply) => kept.push(tool) });
  await fp.survey({ message: "Write a survey" });
  await fp.rehearse({ audience: "a", howMany: 5, objective: "o" });
  assert.deepEqual(kept, ["tool_survey", "panel", "panel-status"]);
});
