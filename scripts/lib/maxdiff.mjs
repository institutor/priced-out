// MaxDiff scoring by counts: for each option, how often it was picked as best
// minus how often as worst, over how often it was shown. Ranges from -1 to 1.
import { quantile } from "../../site/js/lib/stats.js";
import { mulberry32 } from "./rng.mjs";

export function scoreMaxDiff(respondents, fixIds) {
  const tallies = new Map(fixIds.map((id) => [id, { id, best: 0, worst: 0, shown: 0 }]));
  for (const respondent of respondents) {
    for (const task of respondent.maxdiff ?? []) {
      for (const id of task.shown) {
        if (tallies.has(id)) tallies.get(id).shown += 1;
      }
      if (tallies.has(task.best)) tallies.get(task.best).best += 1;
      if (tallies.has(task.worst)) tallies.get(task.worst).worst += 1;
    }
  }
  return fixIds.map((id) => {
    const tally = tallies.get(id);
    const score = tally.shown === 0 ? 0 : (tally.best - tally.worst) / tally.shown;
    return { ...tally, score };
  });
}

// 95% percentile bootstrap, resampling whole respondents so that one person's
// several screens stay together.
export function bootstrapMaxDiff(respondents, fixIds, { reps = 1000, seed = 1 } = {}) {
  const answered = respondents.filter((respondent) => (respondent.maxdiff ?? []).length > 0);
  if (answered.length === 0) return Object.fromEntries(fixIds.map((id) => [id, { low: 0, high: 0 }]));

  const random = mulberry32(seed);
  const draws = new Map(fixIds.map((id) => [id, []]));
  for (let rep = 0; rep < reps; rep++) {
    const sample = Array.from({ length: answered.length }, () => answered[Math.floor(random() * answered.length)]);
    for (const row of scoreMaxDiff(sample, fixIds)) draws.get(row.id).push(row.score);
  }
  return Object.fromEntries(
    fixIds.map((id) => [id, { low: quantile(draws.get(id), 0.025), high: quantile(draws.get(id), 0.975) }]),
  );
}
