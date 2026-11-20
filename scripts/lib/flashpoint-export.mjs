// The only file that knows what Flashpoint's CSV export looks like.
//
// Every column name and every answer text comes from a mapping file
// (data/mapping.json), so adapting to the real export means editing that
// file, not this code. Anything unexpected throws with the column and value
// named, because a silently misread answer would end up on the site as a
// finding.
import { FIXES } from "./vocab.mjs";

const isBlank = (value) => value === undefined || value === null || String(value).trim() === "";
const sameText = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function findColumn(headers, wanted, field) {
  if (headers.includes(wanted)) return wanted;
  const loose = headers.filter((header) => header.toLowerCase().includes(wanted.toLowerCase()));
  if (loose.length === 1) return loose[0];
  const problem = loose.length > 1 ? "matched more than one column" : "was not found";
  throw new Error(`Column "${wanted}" (for ${field}) ${problem}. Columns in the export: ${headers.join(" | ")}`);
}

function unknown(column, value) {
  return new Error(`Unknown answer in column "${column}": "${value}"`);
}

function readNumber(row, column) {
  const value = row[column];
  if (isBlank(value)) return null;
  const match = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) throw unknown(column, value);
  return Number(match[0]);
}

function readCoded(row, column, answers) {
  const value = row[column];
  if (isBlank(value)) return null;
  const key = Object.keys(answers).find((candidate) => sameText(candidate, value));
  if (key === undefined) throw unknown(column, value);
  return answers[key];
}

// Options may be exported with their full description, so match on how the
// text starts.
function codeByPrefix(text, answers, column) {
  const lower = String(text).trim().toLowerCase();
  const key = Object.keys(answers).find((candidate) => lower.startsWith(candidate.toLowerCase()));
  if (key === undefined) throw unknown(column, text);
  return answers[key];
}

function splitList(value, separator) {
  if (isBlank(value)) return [];
  return String(value).split(separator).map((part) => part.trim()).filter((part) => part !== "");
}

function resolveColumns(headers, columns) {
  const resolved = {
    year: findColumn(headers, columns.year, "year"),
    officer: findColumn(headers, columns.officer, "officer"),
    guess: findColumn(headers, columns.guess, "guess"),
    skipped: findColumn(headers, columns.skipped, "skipped"),
    pledgeAmount: findColumn(headers, columns.pledgeAmount, "pledge amount"),
    pledgeThreshold: findColumn(headers, columns.pledgeThreshold, "pledge threshold"),
    prices: {},
    said: null,
    maxdiff: [],
  };
  for (const [itemId, pair] of Object.entries(columns.prices)) {
    resolved.prices[itemId] = {
      stretch: findColumn(headers, pair.stretch, `${itemId} stretch price`),
      skip: findColumn(headers, pair.skip, `${itemId} skip price`),
    };
  }
  if (typeof columns.said === "string") {
    resolved.said = findColumn(headers, columns.said, "what you said");
  } else if (columns.said) {
    resolved.said = Object.fromEntries(
      Object.entries(columns.said).map(([id, column]) => [id, findColumn(headers, column, `what you said: ${id}`)]),
    );
  }
  if (columns.maxdiff) {
    for (let n = 1; n <= columns.maxdiff.tasks; n++) {
      const name = (template) => template.replace("{n}", String(n));
      resolved.maxdiff.push({
        shown: columns.maxdiff.shown ? findColumn(headers, name(columns.maxdiff.shown), `MaxDiff ${n} shown`) : null,
        best: findColumn(headers, name(columns.maxdiff.best), `MaxDiff ${n} best`),
        worst: findColumn(headers, name(columns.maxdiff.worst), `MaxDiff ${n} worst`),
      });
    }
  }
  return resolved;
}

function readSaid(row, column, answers, separator) {
  if (column === null) return [];
  if (typeof column === "string") {
    return splitList(row[column], separator).map((part) => codeByPrefix(part, answers.said, column));
  }
  return Object.entries(column)
    .filter(([, name]) => !isBlank(row[name]) && !["0", "false", "no"].includes(String(row[name]).trim().toLowerCase()))
    .map(([id]) => id);
}

function readMaxDiff(row, tasks, answers, separator) {
  const allIds = FIXES.map((fix) => fix.id);
  const result = [];
  for (const task of tasks) {
    if (isBlank(row[task.best]) || isBlank(row[task.worst])) continue;
    const shown = task.shown
      ? splitList(row[task.shown], separator).map((part) => codeByPrefix(part, answers.fixes, task.shown))
      : allIds;
    result.push({
      shown,
      best: codeByPrefix(row[task.best], answers.fixes, task.best),
      worst: codeByPrefix(row[task.worst], answers.fixes, task.worst),
    });
  }
  return result;
}

function readPledge(row, columns, answers) {
  const amount = readCoded(row, columns.pledgeAmount, answers.pledgeAmount);
  if (amount === null) return null;
  if (amount === 0) return [0, 0];
  const threshold = readCoded(row, columns.pledgeThreshold, answers.pledgeThreshold);
  if (threshold === null) return null;
  return [amount, threshold];
}

export function normalizeExport(objects, mapping) {
  if (objects.length === 0) return [];
  const headers = Object.keys(objects[0]);
  const columns = resolveColumns(headers, mapping.columns);
  const answers = mapping.answers;
  const separator = answers.separator ?? ";";
  const excluded = (mapping.exclude ?? []).map((rule) => ({
    column: findColumn(headers, rule.column, "exclude rule"),
    values: rule.values,
  }));

  const respondents = [];
  for (const row of objects) {
    if (excluded.some((rule) => rule.values.some((value) => sameText(value, row[rule.column] ?? "")))) continue;
    if (!isBlank(row[columns.year]) && sameText(row[columns.year], answers.screenOut)) continue;

    const prices = {};
    for (const [itemId, pair] of Object.entries(columns.prices)) {
      prices[itemId] = [readNumber(row, pair.stretch), readNumber(row, pair.skip)];
    }
    const guess = readNumber(row, columns.guess);

    respondents.push({
      year: isBlank(row[columns.year]) ? null : String(row[columns.year]).trim(),
      officer: readCoded(row, columns.officer, answers.officer),
      prices,
      guess: guess !== null && guess >= 0 && guess <= 100 ? guess : null,
      skipped: readCoded(row, columns.skipped, answers.skipped),
      said: readSaid(row, columns.said, answers, separator),
      maxdiff: readMaxDiff(row, columns.maxdiff, answers, separator),
      pledge: readPledge(row, columns, answers),
    });
  }
  return respondents;
}
