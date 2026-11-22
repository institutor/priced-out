import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { lessonsIn, lessonEntry, readLessons, writeLessons } from "../agent/memory.mjs";
import { summarize, autonomy } from "../agent/summary.mjs";
import { logHeader, logEntry } from "../agent/log.mjs";

test("the notebook gives back the newest lessons and nothing else", () => {
  const text = "# Title\n\nSome words.\n\n## a\n\nMission: x\n\n- one\n- two\n\n## b\n\n- three\n";
  assert.deepEqual(lessonsIn(text), ["one", "two", "three"]);
  assert.deepEqual(lessonsIn(text, 2), ["two", "three"]);
  assert.match(lessonEntry({ stamp: "s", objective: "o", lessons: ["a\nb"] }), /## s\n\nMission: o\n\n- a b\n/);
});

test("real and practice missions keep separate notebooks", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "notebook-"));
  const real = pathToFileURL(path.join(dir, "lessons.md"));
  const practice = pathToFileURL(path.join(dir, "practice-lessons.md"));
  assert.deepEqual(readLessons("real", real), []);
  writeLessons("real", { stamp: "s1", objective: "o", lessons: ["from real people"] }, real);
  writeLessons("practice", { stamp: "s2", objective: "o", lessons: ["from invented answers"] }, practice);
  assert.deepEqual(readLessons("real", real), ["from real people"]);
  assert.deepEqual(readLessons("practice", practice), ["from invented answers"]);
  assert.match(fs.readFileSync(practice, "utf8"), /every answer was invented/);
});

const head = { objective: "Pick an event", model: "m", cap: 8, emailLimit: 2, orders: ["I am away."], people: 3, stamp: "s", mode: "fake" };
const steps = [
  { n: 1, kind: "plan", first: true, needToKnow: ["which event"], hunches: ["a social"], wouldChange: "a workshop winning", surveyIdea: "five questions", budget: "one round" },
  { n: 2, kind: "flashpoint", round: 1, action: "design", price: 0.5, spent: 0.5, emailed: false },
  { n: 3, kind: "sealed", round: 1, envelope: { predictions: [{ question: "Which event?", commander: null }] } },
  { n: 4, kind: "send-held", round: 1, problems: ["It seems to ask for income."] },
  { n: 5, kind: "send-preapproved", round: 1, email: 1, emailLimit: 2, checks: ["It is short"] },
  { n: 6, kind: "flashpoint", round: 1, action: "send", price: 0.5, spent: 1, emailed: true },
  { n: 7, kind: "finish", recommendation: "r", evidence: "e", scoreboard: [], learned_between_rounds: "l", limits: "x", lessons: ["Rank, do not pick."], spent: 1 },
];

test("the summary counts what the agent did alone, and shows its plan, the checks and its lessons", () => {
  assert.deepEqual(autonomy(steps), { alone: 5, approvals: 0, ordered: 0, asked: 0, questions: 0, person: 0, codeStops: 1, nudges: 0 });
  const text = summarize({ ...head, handsOff: true, memory: ["An older lesson."], steps });
  assert.match(text, /took \*\*5 steps on its own\*\*\. It did not stop for a person once\. The code stopped it 1 time\./);
  assert.match(text, /What it remembered from earlier missions:\*\*\n\n- An older lesson\./);
  assert.match(text, /It needed to find out: which event/);
  assert.match(text, /The code held the send back 1 time/);
  assert.match(text, /The code checked the survey in the commander's place, and it was emailed/);
  assert.match(text, /What it wrote down for its next mission\.\*\*\n\n- Rank, do not pick\./);
  assert.match(text, /handed the mission over and was away/);

  const attended = summarize({ ...head, steps: [...steps.slice(0, 3), { n: 4, kind: "send-approved", round: 1, reply: "yes" }, { n: 5, kind: "commander", message: "m", reply: "ok" }, steps[6]] });
  assert.match(attended, /A person was needed 2 times: 1 send approval, 0 reports a standing order asked for, and 1 question of its own\./);
});

test("the log says when the mission was handed over and when a stand-in played the commander", () => {
  assert.match(logHeader({ ...head, handsOff: true }), /handed this mission over and was away/);
  assert.match(logHeader({ ...head, mode: "practice", standInCommander: true }), /an AI stand-in played the commander as well[\s\S]*invented/);
  assert.match(logHeader({ ...head, memory: ["An older lesson."] }), /remembered from earlier missions:\*\*\n\n- An older lesson\./);
  assert.match(logEntry(steps[0]), /the agent's plan[\s\S]*- which event[\s\S]*What would change its answer:\* a workshop winning/);
  assert.match(logEntry(steps[4]), /email 1 of the 2[\s\S]*- It is short/);
  assert.match(logEntry(steps[3]), /held back[\s\S]*income/);
});
