// Checks the page's arithmetic against clubs whose true answer is known.
//
// The made-up club in the site is written by a script, so the population it
// is drawn from is known too: draw enough made-up members and the share who
// would skip at any price settles on one figure. Each trial here draws a
// club of a given size from that population, writes it out as a Flashpoint
// export, reads it back through the code the page uses, and compares what
// the page would say with that figure.
//
// This checks the reading of a file, the counting rule and the intervals,
// end to end. It cannot check whether what people answer in a survey is what
// they later do, or whether simulated students resemble real ones.
//
//   node scripts/evaluate.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { makeClubCsv } from "./make-example.mjs";
import { parseCsv, toObjects } from "../site/js/ingest/csv.js";
import { normalizeExport } from "../site/js/ingest/flashpoint-export.js";
import { publicRows } from "../site/js/ingest/aggregate.js";
import { ITEMS } from "../site/js/ingest/vocab.js";
import { sharesAt, maxPriceFor } from "../site/js/lib/curve.js";
import { quantile } from "../site/js/lib/stats.js";

// The prices the page opens each item at.
export const PRICES = { dues: 30, formal: 45, trip: 180 };
export const SETTINGS = { sizes: [10, 20, 40, 80, 160], trials: 400, population: 20000, seed: 4000, gentle: 0.1 };

// From a made-up export to the rows the page counts, by the page's own code.
function rowsOf(mapping, members, seed) {
  const objects = toObjects(parseCsv(makeClubCsv(mapping, { members, seed })), mapping.headerRow ?? 1);
  return publicRows(normalizeExport(objects, mapping, {}, { synthetic: false }));
}

const round = (value, places) => Number(value.toFixed(places));

export function evaluate(mapping, settings = SETTINGS) {
  const { sizes, trials, population, seed, gentle } = settings;
  const everyone = rowsOf(mapping, population, seed);
  const truth = Object.fromEntries(ITEMS.map((item) => [item.id, {
    share: sharesAt(everyone, item, PRICES[item.id]).out,
    gentle: maxPriceFor(everyone, item, gentle),
  }]));

  const bySize = sizes.map((size, sizeIndex) => {
    let checks = 0;
    let held = 0;
    let priced = 0;
    let withinOneStep = 0;
    const misses = [];
    for (let trial = 0; trial < trials; trial++) {
      const rows = rowsOf(mapping, size, seed + 1 + sizeIndex * trials + trial);
      for (const item of ITEMS) {
        const said = sharesAt(rows, item, PRICES[item.id]);
        if (said.n === 0) continue;
        const real = truth[item.id];
        checks += 1;
        if (real.share >= said.outLow && real.share <= said.outHigh) held += 1;
        misses.push(Math.abs(said.out - real.share));

        // The price the page says keeps nine in ten, against the one that does.
        const price = maxPriceFor(rows, item, gentle);
        if (price === null || real.gentle === null) continue;
        priced += 1;
        if (Math.abs(price - real.gentle) <= item.step) withinOneStep += 1;
      }
    }
    return {
      size,
      checks,
      held: round(held / checks, 3),
      typicalMiss: round(quantile(misses, 0.5), 3),
      badMiss: round(quantile(misses, 0.9), 3),
      priceWithinOneStep: round(withinOneStep / priced, 3),
    };
  });

  return {
    what: "The page's figures against made-up clubs whose true answer is known. Written by scripts/evaluate.mjs.",
    settings: { sizes, trials, population, seed, gentle, prices: PRICES },
    truth: Object.fromEntries(ITEMS.map((item) => [item.id, { share: round(truth[item.id].share, 3), gentle: truth[item.id].gentle }])),
    clubs: sizes.length * trials,
    bySize,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mapping = JSON.parse(fs.readFileSync(new URL("../site/data/mapping.json", import.meta.url), "utf8"));
  const started = Date.now();
  const result = evaluate(mapping);
  fs.writeFileSync(new URL("../site/data/evaluation.json", import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Checked ${result.clubs} made-up clubs in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.table(result.bySize);
  console.log(result.truth);
}
