// Build the site's dataset from a Flashpoint CSV export.
//
//   node scripts/build-data.mjs data/raw/export.csv --survey <id> --from 2026-11-20 --to 2026-11-21
//
// Options:
//   --mapping <file>          column and answer mapping (default data/mapping.json)
//   --out <file>              where to write (default site/data/dataset.json)
//   --survey <id>             Flashpoint survey id, recorded in the dataset
//   --from <date> --to <date> when answers were collected
//   --synthetic <csv>         export of a Flashpoint synthetic-respondent run, kept apart and labelled
//   --fixes <json>            use MaxDiff scores computed by Flashpoint instead of scoring the export
//
// The raw export stays in data/raw/, which is not committed.
import fs from "node:fs";
import { parseCsv, toObjects } from "./lib/csv.mjs";
import { normalizeExport } from "./lib/flashpoint-export.mjs";
import { buildDataset } from "./lib/aggregate.mjs";
import { FIXES, ITEMS } from "./lib/vocab.mjs";

const [input, ...rest] = process.argv.slice(2);
if (!input || input.startsWith("--")) {
  console.log("usage: node scripts/build-data.mjs <export.csv> [--survey id] [--from date] [--to date] [--mapping file] [--out file] [--synthetic csv] [--fixes json]");
  process.exit(1);
}
const options = {};
for (let i = 0; i < rest.length; i += 2) options[rest[i].replace(/^--/, "")] = rest[i + 1];

const mapping = JSON.parse(fs.readFileSync(options.mapping ?? "data/mapping.json", "utf8"));
const read = (file) => normalizeExport(toObjects(parseCsv(fs.readFileSync(file, "utf8"))), mapping);
const respondents = read(input);

const meta = {
  kind: "real",
  title: "Columbia and Barnard students, anonymous public link",
  source: "Flashpoint survey CSV export",
  survey: options.survey ?? null,
  collectedFrom: options.from ?? null,
  collectedTo: options.to ?? null,
  builtAt: new Date().toISOString(),
};

const extras = {};
if (options.synthetic) {
  extras.synthetic = {
    label: "AI-simulated students (Flashpoint synthetic panel). Not real people.",
    respondents: read(options.synthetic),
  };
}

const dataset = buildDataset(respondents, meta, extras);

if (options.fixes) {
  const scores = JSON.parse(fs.readFileSync(options.fixes, "utf8"));
  dataset.fixes = FIXES.map((fix) => {
    const row = scores.find((candidate) => candidate.id === fix.id);
    if (!row) throw new Error(`--fixes file has no entry for "${fix.id}"`);
    return { ...fix, score: row.score, low: row.low ?? row.score, high: row.high ?? row.score };
  });
  dataset.fixesN = scores.n ?? dataset.meta.n;
  dataset.meta.fixesSource = "MaxDiff scores computed by Flashpoint";
}

const out = options.out ?? "site/data/dataset.json";
fs.writeFileSync(out, `${JSON.stringify(dataset)}\n`);

console.log(`Wrote ${out}`);
console.log(`  respondents: ${dataset.meta.n}`);
for (const item of ITEMS) {
  console.log(`  answered ${item.id}: ${dataset.rows.filter((row) => row[item.id] !== null).length}`);
}
console.log(`  answered MaxDiff: ${dataset.fixesN}${dataset.fixes ? "" : " (too few to show)"}`);
console.log(`  answered 'ever skipped': ${dataset.skipped.n}`);
console.log(`  said something when skipping: ${dataset.said ? dataset.said.n : "too few to show"}`);
console.log(`  guesses: ${dataset.guess.all ? dataset.guess.all.n : "too few to show"}`);
