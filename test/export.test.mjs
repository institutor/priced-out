import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseCsv, toObjects } from "../site/js/ingest/csv.js";
import { normalizeExport } from "../site/js/ingest/flashpoint-export.js";

const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url);
const mapping = JSON.parse(fs.readFileSync(fixture("mapping-small.json"), "utf8"));
const objects = toObjects(parseCsv(fs.readFileSync(fixture("export-small.csv"), "utf8")));
const respondents = normalizeExport(objects, mapping);
const [r1, r2, r4, r5, r7] = respondents;

test("screen-outs and excluded statuses are dropped", () => {
  assert.equal(respondents.length, 5);
  assert.deepEqual(respondents.map((r) => r.year), ["Sophomore", "Senior", "First-year", "Junior", "Senior"]);
});

test("prices read with or without a dollar sign", () => {
  assert.deepEqual(r1.prices.dues, [20, 45]);
  assert.deepEqual(r1.prices.formal, [40, 70]);
  assert.deepEqual(r4.prices.formal, [30, 150]);
});

test("a blank price is missing, never zero", () => {
  assert.deepEqual(r2.prices.dues, [null, null]);
  assert.deepEqual(r7.prices.formal, [null, 80]);
  assert.deepEqual(r5.prices.trip, [null, null]);
  assert.equal(r5.guess, null);
  assert.equal(r5.skipped, null);
  assert.equal(r5.pledge, null);
});

test("coded answers map to ids", () => {
  assert.equal(r1.officer, false);
  assert.equal(r2.officer, true);
  assert.equal(r2.skipped, "once");
  assert.equal(r7.skipped, "preferNot");
  assert.equal(r1.guess, 30);
  assert.deepEqual(r2.said, ["busy", "exam"]);
  assert.deepEqual(r4.said, ["silent"]);
  assert.deepEqual(r1.said, []);
});

test("pledges read as amount and threshold", () => {
  assert.deepEqual(r1.pledge, [3, 10]);
  assert.deepEqual(r4.pledge, [10, 0]);
  assert.deepEqual(r2.pledge, [0, 0]);
  assert.equal(r7.pledge, null);
});

test("MaxDiff columns become tasks, matching options by their opening words", () => {
  assert.equal(r1.maxdiff.length, 2);
  assert.deepEqual(r1.maxdiff[0], { shown: ["sliding", "request", "open", "pwyc"], best: "open", worst: "request" });
  assert.deepEqual(r1.maxdiff[1], { shown: ["forward", "draw", "sliding", "open"], best: "draw", worst: "forward" });
  assert.deepEqual(r2.maxdiff, []);
});

test("no free text survives normalisation", () => {
  assert.ok(!JSON.stringify(respondents).includes("ski trip"));
});

test("an unknown answer names the column and the value", () => {
  const broken = objects.map((row) => ({ ...row }));
  broken[0].Skipped = "Maybe";
  assert.throws(() => normalizeExport(broken, mapping), /Skipped.*Maybe/);
});

test("a missing column says which one and lists what is there", () => {
  const renamed = objects.map(({ Guess, ...rest }) => rest);
  assert.throws(() => normalizeExport(renamed, mapping), /Guess[\s\S]*Respondent ID/);
});

test("the build script writes a real dataset from an export", () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "priced-out-")), "dataset.json");
  execFileSync("node", [
    "scripts/build-data.mjs", "test/fixtures/export-small.csv",
    "--mapping", "test/fixtures/mapping-small.json", "--survey", "sv-test", "--out", out,
  ], { cwd: new URL("..", import.meta.url), stdio: "pipe" });
  const dataset = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(dataset.meta.kind, "real");
  assert.equal(dataset.meta.n, 5);
  assert.equal(dataset.meta.survey, "sv-test");
  assert.equal(dataset.rows.length, 5);
  assert.ok(!JSON.stringify(dataset).includes("ski trip"));
});

// One export row with every mapped column, blank unless overridden.
const blankRow = Object.fromEntries(Object.keys(objects[0]).map((header) => [header, ""]));
const row = (overrides) => ({ ...blankRow, Status: "Complete", Year: "Junior", ...overrides });

test("a skip price of 0 is no answer, and is counted", () => {
  const report = {};
  const [person] = normalizeExport([row({ "Dues stretch": "0", "Dues skip": "0", "Formal stretch": "0", "Formal skip": "$40" })], mapping, report);
  assert.deepEqual(person.prices.dues, [0, null]);
  assert.deepEqual(person.prices.formal, [0, 40]);
  assert.deepEqual(report.zeroSkip, { dues: 1, formal: 0, trip: 0 });
});

test("a price above the top of the scale reads as the top, and is counted", () => {
  const report = {};
  const [person] = normalizeExport([row({ "Dues stretch": "20", "Dues skip": "500", "Trip skip": "150+" })], mapping, report);
  assert.deepEqual(person.prices.dues, [20, 100]);
  assert.deepEqual(person.prices.trip, [null, 150]);
  assert.deepEqual(report.aboveMax, { dues: 1, formal: 0, trip: 0 });
});

test("numbers that are not plain amounts are refused", () => {
  assert.throws(() => normalizeExport([row({ "Dues skip": "-5" })], mapping), /Dues skip.*-5/);
  assert.throws(() => normalizeExport([row({ "Formal skip": "30-40" })], mapping), /Formal skip.*30-40/);
  assert.throws(() => normalizeExport([row({ Guess: "about ten" })], mapping), /Guess.*about ten/);
  const [person] = normalizeExport([row({ "Trip skip": "$1,200.00", Guess: "45.0" })], mapping);
  assert.deepEqual(person.prices.trip, [null, 400]);
  assert.equal(person.guess, 45);
});

test("someone who answered nothing after the first question is not a respondent", () => {
  const report = {};
  const people = normalizeExport([row({}), row({ Year: "" }), row({ Year: "Not a student (typo)" }), row({ Officer: "No" })], mapping, report);
  assert.equal(people.length, 1);
  assert.equal(report.noAnswers, 3);
});

test("answers joined with the wrong separator are refused, not read as one", () => {
  const joined = row({ Skipped: "Once or twice", Said: "I said I was busy, I said it cost too much" });
  assert.throws(() => normalizeExport([joined], mapping), /Said[\s\S]*separator/);
  const shown = row({ "MD1 shown": "Sliding scale, Waiver on request, Open waiver code, Pay what you can", "MD1 best": "Open waiver code", "MD1 worst": "Waiver on request" });
  assert.throws(() => normalizeExport([shown], mapping), /MD1 shown[\s\S]*separator/);
});

test("--fixes takes Flashpoint's own scores and still hides them under the minimum", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "priced-out-fixes-"));
  const scores = ["sliding", "request", "open", "pwyc", "forward", "draw"].map((id, index) => ({ id, score: index / 10, low: index / 10 - 0.1, high: index / 10 + 0.1 }));
  const build = (n) => {
    const fixesFile = path.join(dir, `fixes-${n}.json`);
    const out = path.join(dir, `dataset-${n}.json`);
    fs.writeFileSync(fixesFile, JSON.stringify({ n, scores }));
    execFileSync("node", [
      "scripts/build-data.mjs", "test/fixtures/export-small.csv",
      "--mapping", "test/fixtures/mapping-small.json", "--fixes", fixesFile, "--out", out,
    ], { cwd: new URL("..", import.meta.url), stdio: "pipe" });
    return JSON.parse(fs.readFileSync(out, "utf8"));
  };
  const enough = build(40);
  assert.equal(enough.fixesN, 40);
  assert.equal(enough.fixes.length, 6);
  assert.equal(enough.fixes.find((fix) => fix.id === "draw").score, 0.5);
  const tooFew = build(3);
  assert.equal(tooFew.fixesN, 3);
  assert.equal(tooFew.fixes, null);
});
