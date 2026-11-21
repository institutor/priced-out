// Writes site/data/example-club.csv: the answers of a MADE-UP club, laid out
// the way Flashpoint exports the survey, so that anyone can try loading a
// file into the page without having a club's real answers.
//
// Nobody answered these. Every row says "example" in its Source column. The
// page reads that and labels everything it then shows as made up, and nothing
// in this file may be reported as a finding.
//
//   node scripts/make-example.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { mulberry32 } from "../site/js/ingest/rng.js";
import { FIXES, ITEMS } from "../site/js/ingest/vocab.js";

// Where this club's prices run from and to, tightest budget to loosest.
const PRICE_SPAN = { dues: [15, 95], formal: [25, 150], trip: [60, 400] };
// How much this club likes each way of offering a lower price. It is set so
// that a different fix wins here than among the simulated students: the
// answer is a club's own.
const FIX_APPEAL = { sliding: 1.0, open: 0.55, draw: 0.3, pwyc: 0.15, forward: -0.25, request: -0.9 };
const SAID_WEIGHTS = [["busy", 34], ["exam", 24], ["silent", 24], ["plans", 18], ["truth", 14], ["uninterested", 8], ["other", 3]];
const AMOUNT_WEIGHTS = [[0, 22], [1, 10], [2, 20], [3, 16], [5, 22], [10, 10]];
const THRESHOLD_WEIGHTS = [[0, 30], [5, 30], [10, 22], [20, 10], ["most", 8]];
const YEARS = ["First-year", "Sophomore", "Junior", "Senior"];

const keyFor = (answers, wanted) => Object.keys(answers).find((key) => answers[key] === wanted);
const cell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// The CSV text for a club of `members` invented people, plus one row that was
// screened out and one that answered nothing, as a real export would have.
export function makeClubCsv(mapping, { members = 36, seed = 20261121, source = mapping.source.example } = {}) {
  const random = mulberry32(seed);
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const pick = (weighted) => {
    let remaining = random() * weighted.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [value, weight] of weighted) {
      remaining -= weight;
      if (remaining < 0) return value;
    }
    return weighted.at(-1)[0];
  };
  // People answer in round numbers: mostly fives, sometimes a figure between.
  const round = (value) => (random() < 0.8 ? Math.round(value / 5) * 5 : Math.round(value));

  const { columns, answers } = mapping;
  const saidColumns = Object.entries(columns.said);
  const sets = Array.from({ length: columns.maxdiff.tasks }, (_, index) => index + 1);
  const name = (template, n) => template.replace("{n}", String(n));
  const header = [
    "#",
    mapping.source.column,
    columns.year,
    columns.officer,
    ...ITEMS.flatMap((item) => [columns.prices[item.id].stretch, columns.prices[item.id].skip]),
    columns.guess,
    columns.skipped,
    ...saidColumns.map(([, column]) => column),
    columns.maxdiff.design,
    ...sets.flatMap((n) => [name(columns.maxdiff.best, n), name(columns.maxdiff.worst, n)]),
    columns.pledgeAmount,
    columns.pledgeThreshold,
  ];
  const fixText = (id) => {
    const fix = FIXES.find((candidate) => candidate.id === id);
    const detail = fix.detail.charAt(0).toLowerCase() + fix.detail.slice(1).replace(/\.$/, "");
    return `${keyFor(answers.fixes, id)}: ${detail}`;
  };
  const designs = Object.keys(columns.maxdiff.designs);

  const rows = [];
  const blankRow = (number, year) => {
    const row = Object.fromEntries(header.map((column) => [column, ""]));
    row["#"] = number;
    row[mapping.source.column] = source;
    row[columns.year] = year;
    return row;
  };

  for (let i = 0; i < members; i++) {
    const row = blankRow(101 + i, YEARS[Math.floor(random() * YEARS.length)]);
    // 0 is the tightest budget, 1 the loosest.
    const ease = random();
    const officer = random() < 0.28;
    row[columns.officer] = keyFor(answers.officer, officer);

    for (const item of ITEMS) {
      if (random() < 0.05) continue;
      const [low, high] = PRICE_SPAN[item.id];
      const skip = clamp(round(low + (high - low) * clamp(ease ** 1.7 + (random() - 0.5) * 0.24, 0, 1)), 5, item.max);
      const stretch = Math.min(skip, Math.max(0, round(skip * (0.5 + random() * 0.35))));
      row[columns.prices[item.id].stretch] = stretch;
      row[columns.prices[item.id].skip] = skip;
    }

    if (random() >= 0.06) row[columns.guess] = Math.round(officer ? 8 + random() * 20 : 16 + random() * 40);

    let skipped = "never";
    const roll = random();
    if (roll < 0.05) skipped = "preferNot";
    else if (ease < 0.32) skipped = random() < 0.5 ? "several" : "once";
    else if (ease < 0.62) skipped = random() < 0.55 ? "once" : "never";
    else if (random() < 0.1) skipped = "once";
    row[columns.skipped] = keyFor(answers.skipped, skipped);

    if (skipped === "once" || skipped === "several") {
      const said = [pick(SAID_WEIGHTS)];
      const second = pick(SAID_WEIGHTS);
      if (random() < 0.4 && second !== said[0]) said.push(second);
      for (const [id, column] of saidColumns) {
        if (said.includes(id)) row[column] = column.slice(column.indexOf("/") + 1);
      }
    }

    if (random() >= 0.08) {
      const design = designs[Math.floor(random() * designs.length)];
      row[columns.maxdiff.design] = design;
      for (const n of sets) {
        const scored = columns.maxdiff.designs[design][n - 1]
          .map((id) => ({ id, value: FIX_APPEAL[id] - Math.log(-Math.log(random() || 1e-9)) * 0.85 }))
          .sort((a, b) => b.value - a.value);
        row[name(columns.maxdiff.best, n)] = fixText(scored[0].id);
        row[name(columns.maxdiff.worst, n)] = fixText(scored.at(-1).id);
      }
    }

    if (random() >= 0.05) {
      const amount = pick(AMOUNT_WEIGHTS);
      row[columns.pledgeAmount] = keyFor(answers.pledgeAmount, amount);
      if (amount !== 0) row[columns.pledgeThreshold] = keyFor(answers.pledgeThreshold, pick(THRESHOLD_WEIGHTS));
    }
    rows.push(row);
  }
  rows.push(blankRow(101 + members, answers.screenOut));
  rows.push(blankRow(102 + members, YEARS[2]));

  // Two heading rows, as Flashpoint writes them: the first names each
  // question and is blank under a question's further columns.
  let last = "";
  const questions = header.map((column) => {
    const question = column.includes("/") ? column.slice(0, column.indexOf("/")) : column;
    const shown = question === last ? "" : question;
    last = question;
    return shown;
  });
  const lines = [questions, header, ...rows.map((row) => header.map((column) => row[column]))];
  return `${lines.map((line) => line.map(cell).join(",")).join("\n")}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mapping = JSON.parse(fs.readFileSync(new URL("../site/data/mapping.json", import.meta.url), "utf8"));
  const out = new URL("../site/data/example-club.csv", import.meta.url);
  fs.writeFileSync(out, makeClubCsv(mapping));
  console.log("Wrote a MADE-UP club (36 invented members, not real responses) to site/data/example-club.csv");
}
