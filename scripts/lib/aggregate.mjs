// Turns normalised respondents into the one file the site reads.
//
// What leaves this function is public. Rows keep only the price pairs and the
// pledge answer, in shuffled order: no year, no officer flag, no free text.
// Anything based on fewer than MIN_CELL respondents is left out here, so it
// cannot leak through the page source either.
import { quantile } from "../../site/js/lib/stats.js";
import { ITEMS, FIXES, SAID, MIN_CELL, PILOT_N, GUESS } from "./vocab.mjs";
import { mulberry32, shuffle } from "./rng.mjs";
import { scoreMaxDiff, bootstrapMaxDiff } from "./maxdiff.mjs";

const isMissing = (value) => value === null || value === undefined;

function publicRow(respondent) {
  const row = {};
  for (const item of ITEMS) {
    const pair = respondent.prices?.[item.id];
    if (!Array.isArray(pair) || isMissing(pair[1])) {
      row[item.id] = null;
      continue;
    }
    row[item.id] = [isMissing(pair[0]) ? pair[1] : pair[0], pair[1]];
  }
  row.pledge = Array.isArray(respondent.pledge) ? [respondent.pledge[0], respondent.pledge[1]] : null;
  return row;
}

function summarise(values) {
  if (values.length < MIN_CELL) return null;
  return { n: values.length, median: quantile(values, 0.5), q1: quantile(values, 0.25), q3: quantile(values, 0.75) };
}

function guessSummary(respondents) {
  const guessed = respondents.filter((respondent) => !isMissing(respondent.guess));
  const guesses = (group) => group.map((respondent) => respondent.guess);
  return {
    item: GUESS.item,
    price: GUESS.price,
    all: summarise(guesses(guessed)),
    officers: summarise(guesses(guessed.filter((respondent) => respondent.officer === true))),
    others: summarise(guesses(guessed.filter((respondent) => respondent.officer === false))),
  };
}

function skippedSummary(respondents) {
  const counts = { n: 0, never: 0, once: 0, several: 0, preferNot: 0 };
  const answers = ["never", "once", "several", "preferNot"];
  for (const respondent of respondents) {
    if (!answers.includes(respondent.skipped)) continue;
    counts[respondent.skipped] += 1;
    counts.n += 1;
  }
  return counts;
}

function saidSummary(respondents) {
  const answered = respondents.filter(
    (respondent) => (respondent.skipped === "once" || respondent.skipped === "several") && (respondent.said ?? []).length > 0,
  );
  if (answered.length < MIN_CELL) return null;
  const options = SAID.map((option) => ({
    ...option,
    count: answered.filter((respondent) => respondent.said.includes(option.id)).length,
  }));
  return { n: answered.length, options };
}

function fixesSummary(respondents, seed) {
  const answered = respondents.filter((respondent) => (respondent.maxdiff ?? []).length > 0);
  if (answered.length < MIN_CELL) return { fixes: null, fixesN: answered.length };
  const ids = FIXES.map((fix) => fix.id);
  const intervals = bootstrapMaxDiff(answered, ids, { reps: 1000, seed });
  const fixes = scoreMaxDiff(answered, ids).map((row) => {
    const fix = FIXES.find((candidate) => candidate.id === row.id);
    return {
      ...fix,
      ...row,
      low: Math.min(intervals[row.id].low, row.score),
      high: Math.max(intervals[row.id].high, row.score),
    };
  });
  return { fixes, fixesN: answered.length };
}

export function buildDataset(respondents, meta, options = {}) {
  const seed = options.seed ?? 1;
  const random = mulberry32(seed);
  const { fixes, fixesN } = fixesSummary(respondents, seed);

  let synthetic = null;
  if (options.synthetic) {
    synthetic = {
      label: options.synthetic.label,
      n: options.synthetic.respondents.length,
      rows: shuffle(options.synthetic.respondents.map(publicRow), random),
    };
  }

  return {
    meta: { ...meta, n: respondents.length },
    rules: { minCell: MIN_CELL, pilotN: PILOT_N },
    items: ITEMS,
    rows: shuffle(respondents.map(publicRow), random),
    fixes,
    fixesN,
    skipped: skippedSummary(respondents),
    said: saidSummary(respondents),
    guess: guessSummary(respondents),
    synthetic,
  };
}
