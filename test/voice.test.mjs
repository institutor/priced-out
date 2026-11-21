import test from "node:test";
import assert from "node:assert/strict";
import { voice } from "../site/js/lib/voice.js";

const phrasesOf = (say) => [say.many, say.nobody, say.Nobody, say.surveyed, say.asked, say.shown, say.lead, say.range("22%", "47%")];

test("answers from real students are described as students", () => {
  const say = voice({ kind: "real" });
  assert.equal(say.simulated, false);
  assert.equal(say.many, "students");
  assert.equal(say.nobody, "nobody surveyed");
  assert.equal(say.lead, "");
  for (const phrase of phrasesOf(say)) assert.doesNotMatch(phrase, /simulated/i);
});

test("sample data uses the same words as real data, since the banner labels it", () => {
  assert.deepEqual(phrasesOf(voice({ kind: "sample" })), phrasesOf(voice({ kind: "real" })));
});

test("every phrase about a simulated panel says simulated", () => {
  const say = voice({ kind: "simulated" });
  assert.equal(say.simulated, true);
  for (const phrase of phrasesOf(say)) assert.match(phrase, /simulated/i);
});

test("the range for a simulated panel does not claim to bound what real students would do", () => {
  const range = voice({ kind: "simulated" }).range("22%", "47%");
  assert.doesNotMatch(range, /true figure/);
  assert.match(range, /22% to 47%/);
  assert.match(range, /real students/);
});

test("the range for real answers gives both ends", () => {
  assert.match(voice({ kind: "real" }).range("22%", "47%"), /22% to 47%/);
});

test("every phrase about the made-up club says it is made up", () => {
  const say = voice({ kind: "sample", loaded: { name: "example-club.csv", example: true } });
  assert.equal(say.simulated, true);
  for (const phrase of phrasesOf(say)) assert.match(phrase, /made-up/i);
  assert.doesNotMatch(say.range("22%", "47%"), /true figure/);
});

test("a club's own answers are described as its members", () => {
  const say = voice({ kind: "real", loaded: { name: "our-club.csv", example: false } });
  assert.equal(say.simulated, false);
  assert.equal(say.many, "members");
  assert.equal(say.Nobody, "None of the members who answered");
  assert.match(say.range("22%", "47%"), /22% to 47%/);
});

test("a panel file someone loads is still called simulated", () => {
  const say = voice({ kind: "simulated", loaded: { name: "panel.csv", example: false } });
  for (const phrase of phrasesOf(say)) assert.match(phrase, /simulated/i);
});

test("capitalised phrases start a sentence", () => {
  assert.equal(voice({ kind: "real" }).Nobody, "Nobody surveyed");
  assert.equal(voice({ kind: "simulated" }).Nobody, "None of the simulated students");
});
