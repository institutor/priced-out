// The rules every price figure on the site follows.
//
// A row holds, for each item, a pair [stretch, skip]: the price at which the
// item starts to feel like a stretch, and the price at which the respondent
// would skip it and give a different reason. An item is {id, label, max, step}.
import { wilson } from "./stats.js";

// An answer at the top of the price range means "this much or more" (the
// survey tells respondents to enter the top for anything above it), so it can
// never be reached inside the range. A stretch price that is missing or above
// the skip price is treated as the skip price.
function thresholds(pair, item) {
  const skip = pair[1];
  let stretch = pair[0];
  if (stretch === null || stretch === undefined || stretch > skip) stretch = skip;
  return {
    stretch: stretch >= item.max ? Infinity : stretch,
    skip: skip >= item.max ? Infinity : skip,
  };
}

function answeredPair(row, item) {
  const pair = row[item.id];
  if (!Array.isArray(pair)) return null;
  if (pair[1] === null || pair[1] === undefined) return null;
  return pair;
}

// The rows that gave a skip price for every one of the items. Figures that
// sit side by side (the lines of the receipt) are worked out over these, so
// they all describe the same people.
export function answeredAll(rows, items) {
  return rows.filter((row) => items.every((item) => answeredPair(row, item) !== null));
}

export function stateAt(pair, item, price) {
  const { stretch, skip } = thresholds(pair, item);
  if (price >= skip) return "out";
  if (price >= stretch) return "stretched";
  return "fine";
}

export function sharesAt(rows, item, price) {
  let n = 0;
  let outCount = 0;
  let stretchedCount = 0;
  for (const row of rows) {
    const pair = answeredPair(row, item);
    if (!pair) continue;
    n += 1;
    const state = stateAt(pair, item, price);
    if (state === "out") outCount += 1;
    if (state === "stretched") stretchedCount += 1;
  }
  const fineCount = n - outCount - stretchedCount;
  if (n === 0) {
    return { n, outCount, stretchedCount, fineCount, out: null, stretched: null, fine: null, outLow: null, outHigh: null };
  }
  const interval = wilson(outCount, n);
  return {
    n,
    outCount,
    stretchedCount,
    fineCount,
    out: outCount / n,
    stretched: stretchedCount / n,
    fine: fineCount / n,
    outLow: interval.low,
    outHigh: interval.high,
  };
}

// Every price a visitor can pick: 0 up to one step below the top of the range.
export function priceGrid(item) {
  const grid = [];
  for (let price = 0; price < item.max; price += item.step) grid.push(price);
  return grid;
}

export function curve(rows, item) {
  return priceGrid(item).map((price) => {
    const shares = sharesAt(rows, item, price);
    return { price, out: shares.out, stretched: shares.stretched, outLow: shares.outLow, outHigh: shares.outHigh };
  });
}

// The highest price that loses no more than maxShareOut of respondents.
export function maxPriceFor(rows, item, maxShareOut) {
  let best = null;
  for (const price of priceGrid(item)) {
    const shares = sharesAt(rows, item, price);
    if (shares.n === 0) return null;
    if (shares.out > maxShareOut + 1e-12) break;
    best = price;
  }
  return best;
}

// A line of `count` people who stand for everyone that answered, in the
// order they would step out as the price goes up. Person k is the respondent
// a share (k + ½) / count of the way along that order, and what comes back
// is the price at which each of them skips: Infinity for the ones who stay to
// the top of the range. At any price the number who have stepped out is
// within half a person of the share sharesAt() gives, times `count`.
export function walkAway(rows, item, count = 20) {
  const skips = [];
  for (const row of rows) {
    const pair = answeredPair(row, item);
    if (pair) skips.push(thresholds(pair, item).skip);
  }
  if (skips.length === 0) return [];
  skips.sort((a, b) => a - b);
  const line = [];
  for (let k = 0; k < count; k++) {
    line.push(skips[Math.min(skips.length - 1, Math.floor(((k + 0.5) / count) * skips.length))]);
  }
  return line;
}

// Share of respondents priced out of at least one of several lines, among
// those who answered every item listed.
export function outOfAny(rows, lines) {
  if (lines.length === 0) return { n: 0, count: 0, share: null, low: null, high: null };
  let n = 0;
  let count = 0;
  for (const row of rows) {
    const pairs = lines.map((line) => answeredPair(row, line.item));
    if (pairs.some((pair) => pair === null)) continue;
    n += 1;
    if (lines.some((line, index) => stateAt(pairs[index], line.item, line.price) === "out")) count += 1;
  }
  if (n === 0) return { n, count, share: null, low: null, high: null };
  const interval = wilson(count, n);
  return { n, count, share: count / n, low: interval.low, high: interval.high };
}

// What a cheaper access tier would bring back. People priced out at the full
// price pay nothing, so anyone who returns at the access price adds revenue.
export function accessTier(rows, item, price, target = 0.05) {
  const now = sharesAt(rows, item, price);
  if (now.n === 0) return null;
  const accessPrice = maxPriceFor(rows, item, target);
  if (accessPrice === null || accessPrice >= price) return null;
  const regained = now.out - sharesAt(rows, item, accessPrice).out;
  if (regained <= 0) return null;
  return { accessPrice, regained, addedRevenuePer100: regained * 100 * accessPrice };
}
