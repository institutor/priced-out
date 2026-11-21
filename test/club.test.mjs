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
  refuse("a,b\n", /no column named "Source"/);
  const lines = exampleFile.split("\n");
  refuse(lines.slice(0, 2).join("\n"), /no answers under them/);
  refuse([...lines.slice(0, 2), lines.at(-2)].join("\n"), /nobody in its 1 row answered/);
  const reworded = exampleFile.replace(/,Never,/, ",Not once,");
  refuse(reworded, /holds an answer this page does not know: "Not once"/);
});

test("a wrong answer is pointed to by its row, so it can be put right", () => {
  const lines = exampleFile.split("\n");
  // The fourth row of answers gets a price that is not a number.
  const cells = lines[5].split(",");
  cells[5] = "N/A";
  lines[5] = cells.join(",");
  assert.throws(() => datasetFromExport(lines.join("\n"), mapping), (error) => {
    assert.ok(error instanceof FileProblem);
    assert.match(error.message, /The column "DUES_B" holds an answer this page does not know: "N\/A"\. It is in the 4th row of answers\. Correct or empty that cell/);
    return true;
  });
});

test("a refusal never quotes a whole line of the file back", () => {
  const pipes = exampleFile.replace(/,/g, "|");
  assert.throws(() => datasetFromExport(pipes, mapping), (error) => {
    assert.ok(error instanceof FileProblem);
    assert.match(error.message, /not laid out as a table/);
    assert.ok(error.message.length < 200, error.message);
    return true;
  });
});

// What a spreadsheet can do to an export when it is opened and saved again.
const people = withSource(exampleFile, "link");
const semicolons = (csv) => csv.split("\n").map((line) => {
  // Cells are split on the commas outside quotes, then joined with semicolons.
  const cells = [];
  let cell = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells.join(";");
}).join("\n");
const sameAnswers = (text, name) => {
  const expected = datasetFromExport(people, mapping).dataset;
  const { dataset } = datasetFromExport(text, mapping);
  assert.equal(dataset.meta.kind, "real", name);
  assert.deepEqual(dataset.rows, expected.rows, name);
  assert.deepEqual(dataset.fixes, expected.fixes, name);
};

test("a file saved again by a spreadsheet reads the same as the export", () => {
  sameAnswers(semicolons(people), "semicolons between cells");
  sameAnswers(`sep=;\n${semicolons(people)}`, "a first line that names the separator");
  sameAnswers(`sep=,\n${people}`, "a first line that names the comma");
  sameAnswers(people.replace(/\n/g, "\r\n"), "CRLF line ends");
  sameAnswers(people.replace(/\n/g, "\r"), "CR line ends");
  sameAnswers(`\ufeff${people}`, "a byte-order mark");
  sameAnswers(people.split("\n").slice(1).join("\n"), "one heading row");
  const width = people.split("\n")[1].split(",").length;
  sameAnswers(`${people}${",".repeat(width - 1)}\n${",".repeat(width - 1)}\n`, "empty rows at the end");
});

test("empty rows a spreadsheet leaves behind are not counted as people", () => {
  const width = people.split("\n")[1].split(",").length;
  const { report } = datasetFromExport(`${people}${",".repeat(width - 1)}\n`, mapping);
  assert.deepEqual([report.rows, report.read, report.noAnswers], [38, 36, 1]);
});

test("a decimal comma is a decimal, not a bigger number", () => {
  const lines = people.split("\n");
  const cells = lines[2].split(",");
  // The first member's skip price for dues, written the way some spreadsheets write 27.5.
  const before = cells[5];
  cells[5] = '"27,5"';
  lines[2] = cells.join(",");
  const { dataset } = datasetFromExport(lines.join("\n"), mapping);
  const skips = dataset.rows.map((row) => row.dues?.[1]).filter((value) => value !== undefined);
  assert.ok(skips.includes(27.5), `skip prices: ${skips.join(" ")}`);
  assert.ok(!skips.includes(275));
  assert.notEqual(before, "27.5");
});

test("a panel is never read as people, however its rows are marked", () => {
  for (const word of ["synthetic", "Synthetic", "simulated", "synthetic panel", "AI personas"]) {
    const { dataset } = datasetFromExport(withSource(exampleFile, word), mapping);
    assert.equal(dataset.meta.kind, "simulated", word);
  }
  // The export also names the panel in a column of its own. With that filled
  // in, a row is a persona whatever its Source column has been changed to.
  const withPanel = people.split("\n").map((line, index) => {
    if (line === "") return line;
    if (index < 2) return `${line},Panel`;
    return `${line},synthetic:01a1fb81`;
  }).join("\n");
  assert.equal(datasetFromExport(withPanel, mapping).dataset.meta.kind, "simulated");
  const withEmptyPanel = people.split("\n").map((line, index) => (line === "" ? line : `${line},${index < 2 ? "Panel" : ""}`)).join("\n");
  assert.equal(datasetFromExport(withEmptyPanel, mapping).dataset.meta.kind, "real");
});

test("a very small club is read, and told it is too small to show", () => {
  const few = exampleFile.split("\n").slice(0, 5).join("\n");
  const { dataset, report } = datasetFromExport(few, mapping);
  assert.equal(dataset.meta.n, 3);
  assert.equal(report.tooFew, true);
  assert.match(describeReport(report), /too few to show anything/);
});
