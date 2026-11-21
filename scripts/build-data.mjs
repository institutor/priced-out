// Build the site's dataset from a Flashpoint CSV export.
//
//   node scripts/build-data.mjs data/raw/export.csv --survey <id> --from 2026-11-20 --to 2026-11-21
//
// Options:
//   --mapping <file>          column and answer mapping (default site/data/mapping.json)
//   --out <file>              where to write (default site/data/dataset.json)
//   --survey <id>             Flashpoint survey id, recorded in the dataset
//   --from <date> --to <date> when answers were collected
//   --panel <reply.json>      the export is a Flashpoint synthetic panel run, not people. The file is
//                             the reply saved when the panel ran (replies/…-panel-run.json). The
//                             dataset is marked "simulated" and the site labels it on every screen.
//                             Only the export's synthetic rows are read. Without this option only
//                             the rows from people are read, so the two are never mixed.
//   --synthetic <csv>         export of a Flashpoint synthetic-respondent run to draw beside real
//                             answers, kept apart and labelled
//   --fixes <json>            use MaxDiff scores computed by Flashpoint instead of scoring the export.
//                             The file is {"n": 41, "scores": [{"id": "open", "score": 0.3, "low": 0.1, "high": 0.5}, ...]}
//                             with one entry per fix id, and n the number of students who answered.
//
// The raw export stays in data/raw/, which is not committed.
import fs from "node:fs";
import { parseCsv, toObjects } from "../site/js/ingest/csv.js";
import { normalizeExport } from "../site/js/ingest/flashpoint-export.js";
import { buildDataset } from "../site/js/ingest/aggregate.js";
import { FIXES, ITEMS, MIN_CELL } from "../site/js/ingest/vocab.js";

const [input, ...rest] = process.argv.slice(2);
if (!input || input.startsWith("--")) {
  console.log("usage: node scripts/build-data.mjs <export.csv> [--survey id] [--from date] [--to date] [--mapping file] [--out file] [--panel reply.json] [--synthetic csv] [--fixes json]");
  process.exit(1);
}
const options = {};
for (let i = 0; i < rest.length; i += 2) options[rest[i].replace(/^--/, "")] = rest[i + 1];

const mapping = JSON.parse(fs.readFileSync(options.mapping ?? "site/data/mapping.json", "utf8"));
// One export can hold people and personas. Each reading takes one kind only.
const read = (file, report, synthetic) => normalizeExport(
  toObjects(parseCsv(fs.readFileSync(file, "utf8")), mapping.headerRow ?? 1),
  mapping,
  report,
  { synthetic },
);
const simulated = Boolean(options.panel);
const report = {};
const respondents = read(input, report, simulated);

const meta = {
  kind: "real",
  title: "Columbia and Barnard students, anonymous public link",
  source: "Flashpoint survey CSV export",
  survey: options.survey ?? null,
  collectedFrom: options.from ?? null,
  collectedTo: options.to ?? null,
  builtAt: new Date().toISOString(),
};

// The first object anywhere in a value that has the given key.
function findWith(value, key) {
  if (value === null || typeof value !== "object") return null;
  if (key in value) return value;
  for (const child of Object.values(value)) {
    const found = findWith(child, key);
    if (found) return found;
  }
  return null;
}

if (options.panel) {
  // Answers from AI personas are a different kind of thing from answers from
  // students, and the dataset says so in its first field.
  const made = findWith(JSON.parse(fs.readFileSync(options.panel, "utf8")), "inference_model");
  if (!made) throw new Error(`${options.panel} does not look like a saved panel run: no inference_model in it.`);
  meta.kind = "simulated";
  meta.title = "AI-simulated students (Flashpoint synthetic panel)";
  meta.source = "Flashpoint CSV export of a synthetic panel run";
  meta.panel = {
    name: made.panel_name ?? null,
    size: made.panel_size ?? null,
    model: made.inference_model,
    calibration: made.calibration_version ?? null,
    id: made.panel_id ?? null,
    run: made.last_run_id ?? null,
  };
}

const extras = {};
if (options.synthetic) {
  extras.synthetic = {
    label: "AI-simulated students (Flashpoint synthetic panel). Not real people.",
    respondents: read(options.synthetic, {}, true),
  };
}

const dataset = buildDataset(respondents, meta, extras);

if (options.fixes) {
  const file = JSON.parse(fs.readFileSync(options.fixes, "utf8"));
  if (!Number.isInteger(file.n) || !Array.isArray(file.scores)) {
    throw new Error('--fixes file must look like {"n": 41, "scores": [{"id": "open", "score": 0.3, "low": 0.1, "high": 0.5}, ...]}');
  }
  const fixes = FIXES.map((fix) => {
    const row = file.scores.find((candidate) => candidate.id === fix.id);
    if (!row || typeof row.score !== "number") throw new Error(`--fixes file has no score for "${fix.id}"`);
    return { ...fix, score: row.score, low: row.low ?? row.score, high: row.high ?? row.score };
  });
  // The same floor as everything else: no ranking from fewer than MIN_CELL students.
  dataset.fixes = file.n < MIN_CELL ? null : fixes;
  dataset.fixesN = file.n;
  dataset.meta.fixesSource = "MaxDiff scores computed by Flashpoint";
}

const out = options.out ?? "site/data/dataset.json";
fs.writeFileSync(out, `${JSON.stringify(dataset)}\n`);

console.log(`Wrote ${out}`);
console.log(`  rows in the export: ${report.rows}`);
if (report.otherSource > 0) {
  const what = simulated ? "from people, not the panel" : "from a simulated panel, not people";
  console.log(`  set aside: ${report.otherSource} ${what}`);
}
console.log(`  left out: ${report.excluded} excluded by the mapping, ${report.screenedOut} screened out, ${report.noAnswers} answered nothing after the first question`);
for (const item of ITEMS) {
  if (report.zeroSkip[item.id] > 0) console.log(`  ${item.id}: ${report.zeroSkip[item.id]} skip price(s) of 0 read as no answer`);
  if (report.aboveMax[item.id] > 0) console.log(`  ${item.id}: ${report.aboveMax[item.id]} answer(s) above ${item.max} read as ${item.max}`);
}
console.log(`  respondents: ${dataset.meta.n}`);
for (const item of ITEMS) {
  console.log(`  answered ${item.id}: ${dataset.rows.filter((row) => row[item.id] !== null).length}`);
}
console.log(`  answered MaxDiff: ${dataset.fixesN}${dataset.fixes ? "" : " (too few to show)"}`);
console.log(`  answered 'ever skipped': ${dataset.skipped.n}`);
console.log(`  said something when skipping: ${dataset.said ? dataset.said.n : "too few to show"}`);
console.log(`  guesses: ${dataset.guess.all ? dataset.guess.all.n : "too few to show"}`);
