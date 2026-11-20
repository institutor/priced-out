import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseCsv, toObjects } from "../scripts/lib/csv.mjs";
import { normalizeExport } from "../scripts/lib/flashpoint-export.mjs";

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
