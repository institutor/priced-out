import test from "node:test";
import assert from "node:assert/strict";
import { listProblems, whatCapBuys } from "../agent/check.mjs";

test("a good recipient list passes, with comments and blank lines ignored", () => {
  const { people, problems } = listProblems("# my testers\nAna, ana+1@example.com\n\nBen, ben@example.com\n");
  assert.equal(people, 2);
  assert.deepEqual(problems, []);
});

test("a bad line is named by its number, never by what is on it", () => {
  const { people, problems } = listProblems("Ana, ana@example.com\nben@example.com\nCy, not-an-address\nDi, di@example.com, extra\nAna again, ANA@example.com\n");
  assert.equal(people, 2);
  assert.deepEqual(problems, [
    'Line 2 is not "Name, email".',
    'Line 3 is not "Name, email".',
    'Line 4 is not "Name, email".',
    "Line 5 repeats an address from an earlier line.",
  ]);
  assert.doesNotMatch(problems.join(" "), /example\.com|Ana|Ben/);
});

test("an empty list is a problem", () => {
  assert.deepEqual(listProblems("# nobody yet\n\n").problems, ["The list is empty."]);
});

test("the cap is turned into rounds at about two dollars each", () => {
  assert.deepEqual(whatCapBuys(9), { rounds: 2, withRehearsal: 2 });
  assert.deepEqual(whatCapBuys(4), { rounds: 1, withRehearsal: 0 });
  assert.equal(whatCapBuys(3).rounds, 0);
});
