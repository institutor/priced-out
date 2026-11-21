// The only file that knows what Flashpoint's CSV export looks like.
//
// Every column name and every answer text comes from a mapping file
// (site/data/mapping.json), so adapting to the real export means editing that
// file, not this code. Anything unexpected throws with the column and value
// named, because a silently misread answer would end up on the site as a
// finding.
//
// normalizeExport takes an optional `report` object and fills it with counts
// of the rows and answers it set aside, so the build can print them.
import { FIXES, ITEMS } from "./vocab.js";

const isBlank = (value) => value === undefined || value === null || String(value).trim() === "";
const sameText = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

export function findColumn(headers, wanted, field) {
  if (headers.includes(wanted)) return wanted;
  const loose = headers.filter((header) => header.toLowerCase().includes(wanted.toLowerCase()));
  if (loose.length === 1) return loose[0];
  const problem = loose.length > 1 ? "matched more than one column" : "was not found";
  throw new Error(`Column "${wanted}" (for ${field}) ${problem}. Columns in the export: ${headers.join(" | ")}`);
}

function unknown(column, value) {
  return new Error(`Unknown answer in column "${column}": "${value}"`);
}

// A plain amount: digits, with an optional leading $, thousands commas,
// decimals and a trailing + ("150+"). A comma before one or two last digits
// is a decimal comma, as a spreadsheet set to another language writes it:
// "12,5" is twelve and a half, not 125. Anything else ("-5", "30-40", words)
// is refused rather than guessed at.
function readNumber(row, column) {
  const value = row[column];
  if (isBlank(value)) return null;
  let text = String(value).trim().replace(/^\$/, "").replace(/\+$/, "").trim();
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(text)) text = text.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) throw unknown(column, value);
  return Number(text);
}

// The two prices for one item.
// - A skip price of 0 is read as no answer. Skipping something that is free
//   is not about price. (The survey first used sliders, and one nobody touched
//   was stored as 0. It now uses number inputs that start empty.)
// - A price above the top of the scale is read as the top, which already
//   means "this much or more".
function readPrices(row, pair, item, report) {
  let stretch = readNumber(row, pair.stretch);
  let skip = readNumber(row, pair.skip);
  if (skip === 0) {
    skip = null;
    report.zeroSkip[item.id] += 1;
  }
  let above = false;
  if (stretch !== null && stretch > item.max) {
    stretch = item.max;
    above = true;
  }
  if (skip !== null && skip > item.max) {
    skip = item.max;
    above = true;
  }
  if (above) report.aboveMax[item.id] += 1;
  return [stretch, skip];
}

function readCoded(row, column, answers) {
  const value = row[column];
  if (isBlank(value)) return null;
  const key = Object.keys(answers).find((candidate) => sameText(candidate, value));
  if (key === undefined) throw unknown(column, value);
  return answers[key];
}

// Options may be exported with their full description, so match on how the
// text starts. If a second option turns up later in the same text, the list
// was split on the wrong separator: refuse it, or several answers would be
// read as one.
function codeByPrefix(text, answers, column) {
  const lower = String(text).trim().toLowerCase();
  const keys = Object.keys(answers);
  const matches = keys.filter((candidate) => lower.startsWith(candidate.toLowerCase()));
  if (matches.length === 0) throw unknown(column, text);
  const key = matches.reduce((longest, candidate) => (candidate.length > longest.length ? candidate : longest));
  const rest = lower.slice(key.length);
  if (keys.some((candidate) => rest.includes(candidate.toLowerCase()))) {
    throw new Error(`Column "${column}" holds more than one answer in "${text}". Check answers.separator in the mapping.`);
  }
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
    // The options on each screen come either from a column that lists them
    // or from a design: a numbered plan, kept in the mapping, of which options
    // each screen shows. Flashpoint exports the design number.
    const design = columns.maxdiff.design ? findColumn(headers, columns.maxdiff.design, "MaxDiff design") : null;
    for (let n = 1; n <= columns.maxdiff.tasks; n++) {
      const name = (template) => template.replace("{n}", String(n));
      resolved.maxdiff.push({
        set: n,
        design,
        designs: columns.maxdiff.designs ?? null,
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

// The options one screen showed, looked up from the respondent's design number.
function shownByDesign(row, task) {
  const number = String(row[task.design] ?? "").trim();
  const sets = task.designs?.[number];
  if (!sets) throw unknown(task.design, row[task.design]);
  const shown = sets[task.set - 1];
  const known = FIXES.map((fix) => fix.id);
  if (!Array.isArray(shown) || shown.some((id) => !known.includes(id))) {
    throw new Error(`The mapping's design ${number} has no usable list of options for set ${task.set}.`);
  }
  return shown;
}

function readMaxDiff(row, tasks, answers, separator) {
  const allIds = FIXES.map((fix) => fix.id);
  const result = [];
  for (const task of tasks) {
    if (isBlank(row[task.best]) || isBlank(row[task.worst])) continue;
    let shown = allIds;
    if (task.design) shown = shownByDesign(row, task);
    else if (task.shown) shown = splitList(row[task.shown], separator).map((part) => codeByPrefix(part, answers.fixes, task.shown));
    const best = codeByPrefix(row[task.best], answers.fixes, task.best);
    const worst = codeByPrefix(row[task.worst], answers.fixes, task.worst);
    if (task.design) {
      // A pick from outside the screen means the design in the mapping is not
      // the one the survey used, and every score built on it would be wrong.
      const where = `design ${String(row[task.design]).trim()}, set ${task.set}`;
      if (!shown.includes(best)) throw new Error(`Column "${task.best}" holds "${row[task.best]}", which ${where} did not show.`);
      if (!shown.includes(worst)) throw new Error(`Column "${task.worst}" holds "${row[task.worst]}", which ${where} did not show.`);
      if (best === worst) throw new Error(`Column "${task.worst}" holds the same option as most and least likely in ${where}.`);
    }
    result.push({ shown, best, worst });
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

// Whether a row came from a synthetic panel and not from a person. The
// export's Source column says "synthetic" for one. A file that has been
// through other hands may word it differently, so any wording that names a
// synthetic or simulated panel counts, and so does the export's Panel column
// when it names one. Calling invented answers real is the worse mistake, so
// either sign is enough.
function fromPanel(row, source) {
  const said = String(row[source.column] ?? "").trim();
  if (sameText(said, source.synthetic) || /synth|simulat|persona(?!l)/i.test(said)) return true;
  return source.panel !== null && /^synth/i.test(String(row[source.panel] ?? "").trim());
}

// One export can hold answers from people and answers from a Flashpoint
// synthetic panel (AI personas). They are never read together: `synthetic`
// says which of the two this reading is of, and the other kind is set aside
// and counted. The default is people, so a persona can only reach a dataset
// when the caller asks for personas by name.
export function normalizeExport(objects, mapping, report = {}, { synthetic = false } = {}) {
  const perItem = () => Object.fromEntries(ITEMS.map((item) => [item.id, 0]));
  Object.assign(report, { rows: objects.length, otherSource: 0, excluded: 0, screenedOut: 0, noAnswers: 0, zeroSkip: perItem(), aboveMax: perItem() });
  if (objects.length === 0) return [];

  const headers = Object.keys(objects[0]);
  const columns = resolveColumns(headers, mapping.columns);
  const answers = mapping.answers;
  const separator = answers.separator ?? ";";
  const excluded = (mapping.exclude ?? []).map((rule) => ({
    column: findColumn(headers, rule.column, "exclude rule"),
    values: rule.values,
  }));
  const source = mapping.source
    ? {
      column: findColumn(headers, mapping.source.column, "source"),
      synthetic: mapping.source.synthetic,
      // The Panel column is looked for by its exact name, and may be absent.
      panel: headers.includes(mapping.source.panel) ? mapping.source.panel : null,
    }
    : null;
  if (synthetic && !source) {
    throw new Error("The mapping has no \"source\" entry, so the rows of a synthetic panel cannot be told from people.");
  }

  const respondents = [];
  const readRow = (row) => {
    if (source && fromPanel(row, source) !== synthetic) {
      report.otherSource += 1;
      return;
    }
    if (excluded.some((rule) => rule.values.some((value) => sameText(value, row[rule.column] ?? "")))) {
      report.excluded += 1;
      return;
    }
    if (!isBlank(row[columns.year]) && sameText(row[columns.year], answers.screenOut)) {
      report.screenedOut += 1;
      return;
    }

    const prices = {};
    for (const [itemId, pair] of Object.entries(columns.prices)) {
      const item = ITEMS.find((candidate) => candidate.id === itemId);
      if (!item) throw new Error(`The mapping has prices for "${itemId}", which is not one of the survey's items.`);
      prices[itemId] = readPrices(row, pair, item, report);
    }
    const guess = readNumber(row, columns.guess);
    const respondent = {
      year: isBlank(row[columns.year]) ? null : String(row[columns.year]).trim(),
      officer: readCoded(row, columns.officer, answers.officer),
      prices,
      guess: guess !== null && guess >= 0 && guess <= 100 ? guess : null,
      skipped: readCoded(row, columns.skipped, answers.skipped),
      said: readSaid(row, columns.said, answers, separator),
      maxdiff: readMaxDiff(row, columns.maxdiff, answers, separator),
      pledge: readPledge(row, columns, answers),
    };

    // Someone who opened the survey and answered nothing after the first
    // question is not counted as a respondent. A price pair only counts if it
    // has a skip price or a stretch price above 0.
    const gavePrice = Object.values(prices).some((pair) => pair[1] !== null || pair[0] > 0);
    const answeredSomething = gavePrice
      || respondent.officer !== null
      || respondent.guess !== null
      || respondent.skipped !== null
      || respondent.said.length > 0
      || respondent.maxdiff.length > 0
      || !isBlank(row[columns.pledgeAmount]);
    if (!answeredSomething) {
      report.noAnswers += 1;
      return;
    }
    respondents.push(respondent);
  };
  objects.forEach((row, index) => {
    try {
      readRow(row);
    } catch (error) {
      // Which row it was, counted from the first row of answers, so that
      // whoever shows the error can say where to look.
      if (error.row === undefined) error.row = index;
      throw error;
    }
  });
  return respondents;
}
