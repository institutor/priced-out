import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { datasetFromExport, describeReport, FileProblem } from "../site/js/ingest/club.js";
import { makeClubCsv } from "../scripts/make-example.mjs";

const mapping = JSON.parse(fs.readFileSync(new URL("../site/data/mapping.json", import.meta.url), "utf8"));
const exampleFile = fs.readFileSync(new URL("../site/data/example-club.csv", import.meta.url), "utf8");

// Swaps what the Source column says in every row of a made-up export.
const withSource = (csv, source) => csv.split("\n").map((line, index) => (index < 2 ? line : line.replace(/^(\d+),example,/, `$1,${source},`))).join("\n");

test("the made-up club in the site is the one the script writes", () => {
  assert.equal(exampleFile, makeClubCsv(mapping));
});

test("the made-up club loads as sample data and says so", () => {
  const { dataset, report } = datasetFromExport(exampleFile, mapping, { name: "example-club.csv" });
  assert.equal(dataset.meta.kind, "sample");
  assert.equal(dataset.meta.loaded.example, true);
  assert.equal(dataset.meta.loaded.name, "example-club.csv");
  assert.match(dataset.meta.note, /not real responses/i);
  assert.equal(dataset.meta.n, 36);
  assert.deepEqual([report.rows, report.read, report.screenedOut, report.noAnswers], [38, 36, 1, 1]);
});

test("the made-up club has something to show in every section", () => {
  const { dataset } = datasetFromExport(exampleFile, mapping);
  for (const item of dataset.items) {
    assert.ok(dataset.rows.filter((row) => row[item.id] !== null).length >= 30, item.id);
  }
  assert.ok(dataset.fixes, "ranking of fixes");
  assert.ok(dataset.said, "what they said");
  assert.ok(dataset.skipped.once !== null, "ever skipped");
  assert.ok(dataset.guess.all && dataset.guess.officers && dataset.guess.others, "guesses");
  assert.ok(dataset.rows.filter((row) => row.pledge !== null).length >= 30, "pledges");
});

test("what the file holds decides the label, never the file's name", () => {
  const { dataset } = datasetFromExport(exampleFile, mapping, { name: "real-answers.csv" });
  assert.equal(dataset.meta.kind, "sample");
});

test("rows from people load as a club's real answers", () => {
  const { dataset, report } = datasetFromExport(withSource(exampleFile, "link"), mapping, { name: "our-club.csv" });
  assert.equal(dataset.meta.kind, "real");
  assert.equal(dataset.meta.loaded.example, false);
  assert.equal(dataset.meta.n, 36);
  assert.equal(report.kind, "real");
  assert.equal(describeReport(report), "Read 36 members from our-club.csv. Set aside: 1 who said they were not a student and 1 who answered nothing after the first question.");
});

test("a file of persona rows loads as simulated, and personas never join people", () => {
  const personas = withSource(exampleFile, "synthetic");
  const alone = datasetFromExport(personas, mapping);
  assert.equal(alone.dataset.meta.kind, "simulated");
  assert.equal(alone.dataset.meta.n, 36);

  const people = withSource(exampleFile, "link").trimEnd().split("\n");
  const mixed = datasetFromExport([...people, ...personas.trimEnd().split("\n").slice(2)].join("\n"), mapping);
  assert.equal(mixed.dataset.meta.kind, "real");
  assert.equal(mixed.dataset.meta.n, 36);
  assert.equal(mixed.report.otherSource, 38);
  assert.match(describeReport(mixed.report), /38 from a simulated panel/);
});

test("one example row makes the whole file an example", () => {
  const people = withSource(exampleFile, "link").trimEnd().split("\n");
  const one = exampleFile.trimEnd().split("\n")[2];
  const { dataset } = datasetFromExport([...people, one].join("\n"), mapping);
  assert.equal(dataset.meta.kind, "sample");
});

test("a file that is not this survey's export is refused in plain words", () => {
  const refuse = (text, pattern) => assert.throws(() => datasetFromExport(text, mapping), (error) => {
    assert.ok(error instanceof FileProblem);
    assert.match(error.message, pattern);
    return true;
  });
  refuse("", /empty/);
  refuse("   \n", /empty/);
  refuse("PK\u0003\u0004\u0000\u0000binary", /not a CSV file/);
  refuse("name,price\nname,price\nAda,5\n", /no column named "Source"/);
  refuse("a,b\n", /no header row|headings/);
  const lines = exampleFile.split("\n");
  refuse(lines.slice(0, 2).join("\n"), /no answers under them/);
  refuse([...lines.slice(0, 2), lines.at(-2)].join("\n"), /nobody in its 1 row answered/);
  const reworded = exampleFile.replace(/,Never,/, ",Not once,");
  refuse(reworded, /holds an answer this page does not know: "Not once"/);
});

test("a very small club is read, and told it is too small to show", () => {
  const few = exampleFile.split("\n").slice(0, 5).join("\n");
  const { dataset, report } = datasetFromExport(few, mapping);
  assert.equal(dataset.meta.n, 3);
  assert.equal(report.tooFew, true);
  assert.match(describeReport(report), /too few to show anything/);
});
