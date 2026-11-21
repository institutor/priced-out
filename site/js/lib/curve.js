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

// The same thing priced three ways, for a club of `size`: the price as it
// is, one lower price for everyone (the highest that loses no more than
// `gentle`), and the price as it is with a second, lower price for those who
// need it (the highest that loses no more than `access`). Each way says how
// many would be there and what the club would take in. People are counted
// whole, as they are everywhere on the page, and a way that would not bring
// one more whole person is left out. The two-price line assumes that those
// who can pay the full price still do.
export function waysToPrice(rows, item, price, size, { gentle = 0.1, access = 0.05 } = {}) {
  const now = sharesAt(rows, item, price);
  if (now.n === 0) return null;
  const whole = (share) => Math.round(share * size);
  const paying = size - whole(now.out);
  const ways = [{ kind: "now", price, there: paying, taken: paying * price }];

  const lower = maxPriceFor(rows, item, gentle);
  if (lower !== null && lower < price) {
    const there = size - whole(sharesAt(rows, item, lower).out);
    if (there > paying) ways.push({ kind: "lower", price: lower, there, taken: there * lower });
  }

  const tier = accessTier(rows, item, price, access);
  if (tier) {
    const back = whole(tier.regained);
    if (back > 0) {
      ways.push({ kind: "two", price, accessPrice: tier.accessPrice, there: paying + back, taken: paying * price + back * tier.accessPrice });
    }
  }
  return ways;
}

// Two prices only pay for themselves if those who can pay the full price
// still do. This is how many of them could take the lower price instead
// before the club takes in less than it does at the one price now. Each one
// who does gives up the difference between the two prices.
export function roomForTwo(ways) {
  const two = ways?.find((way) => way.kind === "two");
  if (!two) return null;
  const [now] = ways;
  const each = two.price - two.accessPrice;
  const room = Math.min(now.there, Math.floor((two.taken - now.taken) / each));
  return { room, payers: now.there, each, accessPrice: two.accessPrice };
}
