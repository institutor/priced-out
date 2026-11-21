// The layout Flashpoint's CSV export really has, read with the mapping the
// build really uses (data/mapping.json). The fixture is hand-written: two
// header rows, one column per Q6 option, a MaxDiff design number in place of
// the options shown.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseCsv, toObjects } from "../scripts/lib/csv.mjs";
import { normalizeExport } from "../scripts/lib/flashpoint-export.mjs";

const root = new URL("..", import.meta.url);
const mapping = JSON.parse(fs.readFileSync(new URL("data/mapping.json", root), "utf8"));
const rows = parseCsv(fs.readFileSync(new URL("test/fixtures/export-flashpoint.csv", root), "utf8"));
const objects = toObjects(rows, mapping.headerRow);

const personasReport = {};
const personas = normalizeExport(objects, mapping, personasReport, { synthetic: true });
const [a, b, e] = personas;

test("the second header row names the columns, and the first is not read as an answer", () => {
  assert.equal(mapping.headerRow, 2);
  assert.equal(objects.length, 5);
  assert.equal(objects[0]["Q6/I said I was busy"], "");
  assert.equal(objects[0]["Q7/Design"], "1");
  assert.equal(objects[0].S1, "Sophomore");
});

test("a header row that is not there is refused", () => {
  assert.throws(() => toObjects(rows.slice(0, 1), 2), /header row 2/);
});

test("a panel run keeps the personas and sets the people aside", () => {
  assert.deepEqual(personas.map((r) => r.year), ["Sophomore", "Senior", "First-year"]);
  assert.equal(personasReport.rows, 5);
  assert.equal(personasReport.otherSource, 1);
  assert.equal(personasReport.screenedOut, 1);
});

test("a survey of people never takes in a persona", () => {
  const report = {};
  const people = normalizeExport(objects, mapping, report);
  assert.deepEqual(people.map((r) => r.year), ["Junior"]);
  assert.equal(report.otherSource, 4);
  assert.equal(report.screenedOut, 0);
  assert.deepEqual(people[0].prices.dues, [15, 25]);
  assert.deepEqual(people[0].said, ["silent"]);
  assert.deepEqual(people[0].pledge, [5, 0]);
});

test("prices written as 20.0 are read as 20, on or off the price grid", () => {
  assert.deepEqual(a.prices.dues, [20, 45]);
  assert.deepEqual(a.prices.trip, [120, 200]);
  assert.equal(a.guess, 30);
  assert.deepEqual(e.prices.dues, [8, 12]);
  assert.deepEqual(e.prices.trip, [200, 400]);
  assert.deepEqual(personasReport.aboveMax, { dues: 0, formal: 0, trip: 1 });
  assert.deepEqual(b.prices.dues, [null, null]);
});

test("each Q6 option has its own column", () => {
  assert.deepEqual(a.said, []);
  assert.deepEqual(b.said, ["busy", "exam"]);
  assert.deepEqual(e.said, ["other"]);
});

test("the options shown come from the design number", () => {
  assert.equal(a.maxdiff.length, 6);
  assert.deepEqual(a.maxdiff[0], { shown: ["open", "sliding", "request", "forward"], best: "open", worst: "request" });
  assert.deepEqual(a.maxdiff[5], { shown: ["draw", "pwyc", "sliding", "request"], best: "sliding", worst: "request" });
  assert.equal(b.maxdiff.length, 2);
  assert.deepEqual(b.maxdiff[1], { shown: ["open", "draw", "request", "forward"], best: "open", worst: "forward" });
  assert.deepEqual(e.maxdiff[0], { shown: ["open", "draw", "sliding", "pwyc"], best: "open", worst: "pwyc" });
});

test("every design shows each fix four times across its six sets", () => {
  const designs = mapping.columns.maxdiff.designs;
  assert.equal(Object.keys(designs).length, 10);
  for (const [number, sets] of Object.entries(designs)) {
    assert.equal(sets.length, 6, `design ${number}`);
    const times = {};
    for (const set of sets) {
      assert.equal(new Set(set).size, 4, `design ${number}`);
      for (const id of set) times[id] = (times[id] ?? 0) + 1;
    }
    assert.deepEqual(times, { sliding: 4, request: 4, open: 4, pwyc: 4, forward: 4, draw: 4 }, `design ${number}`);
  }
});

const draw = "Discount draw: every buyer gets a random discount, so nobody can tell who needed one";
const changed = (overrides) => [{ ...objects[0], ...overrides }];
const readPersonas = (list) => normalizeExport(list, mapping, {}, { synthetic: true });

test("a pick the design did not show is refused", () => {
  assert.throws(() => readPersonas(changed({ "Q7/Set_1_Most": draw })), /Q7\/Set_1_Most[\s\S]*design 1/);
});

test("the same option as most and least likely is refused", () => {
  const open = objects[0]["Q7/Set_1_Most"];
  assert.throws(() => readPersonas(changed({ "Q7/Set_1_Least": open })), /Q7\/Set_1_Least[\s\S]*most and least/);
});

test("a design number the mapping does not know is refused", () => {
  assert.throws(() => readPersonas(changed({ "Q7/Design": "11" })), /Q7\/Design.*11/);
  assert.throws(() => readPersonas(changed({ "Q7/Design": "" })), /Q7\/Design/);
});

test("no chat transcript or free text survives", () => {
  const text = JSON.stringify(personas);
  assert.ok(!text.includes("ski trip"));
  assert.ok(!text.includes("cat was sick"));
});

function build(extra) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "priced-out-layout-")), "dataset.json");
  const printed = execFileSync("node", ["scripts/build-data.mjs", "test/fixtures/export-flashpoint.csv", "--out", out, ...extra], { cwd: root, encoding: "utf8" });
  return { dataset: JSON.parse(fs.readFileSync(out, "utf8")), printed };
}

test("the build marks a panel run as simulated and counts only its personas", () => {
  const { dataset, printed } = build(["--panel", "test/fixtures/panel-reply-small.json", "--survey", "sv-test"]);
  assert.equal(dataset.meta.kind, "simulated");
  assert.equal(dataset.meta.n, 3);
  assert.deepEqual(dataset.meta.panel, { name: "Test personas", size: 5, model: "test-model", calibration: "uncalibrated", id: "panel-test", run: "run-test" });
  assert.match(printed, /1 from people, not the panel/);
  assert.ok(!JSON.stringify(dataset).includes("cat was sick"));
});

test("the build without --panel is a survey of people and leaves the personas out", () => {
  const { dataset, printed } = build([]);
  assert.equal(dataset.meta.kind, "real");
  assert.equal(dataset.meta.n, 1);
  assert.match(printed, /4 from a simulated panel/);
});
