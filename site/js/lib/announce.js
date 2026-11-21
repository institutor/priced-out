// What a treasurer could send the members once a price is decided: the
// price, and the lower price offered the way the answers ranked first. It
// uses figures the page has already worked out: the access price from the
// sum with two prices, and the fix at the top of the ranking. It makes no
// claim of its own, so the message can be sent as it stands.
import { maxPriceFor, sharesAt, waysToPrice } from "./curve.js";
import { money } from "./format.js";

const GENTLE = 0.1;

// How each thing is announced: as a sentence with one price, and as the
// start of a sentence that offers several.
const OPENINGS = {
  dues: { one: (price) => `Dues this semester are ${price}.`, several: "Dues this semester" },
  formal: { one: (price) => `Formal tickets are ${price}.`, several: "Formal tickets" },
  trip: { one: (price) => `The weekend trip is ${price}.`, several: "The weekend trip" },
};

const openingOf = (item) => OPENINGS[item.id] ?? {
  one: (price) => `${item.label} costs ${price}.`,
  several: item.label,
};

// The message for each way of offering a lower price, by the fix's id.
// `low` is the lower price in words, and `levels` the prices to pick from.
const MESSAGES = {
  open: ({ opening, low }) => `${opening} If that is a stretch, use the code [your code] and it is ${low}. Everyone is getting this code, and nobody will ask who used it.`,
  sliding: ({ several, levels }) => `${several}: pick the price that fits you, ${levels}. Every price gets you the same as everyone else, and nobody sees which one you picked.`,
  forward: ({ opening }) => `${opening} You can add a few dollars to cover someone else. If the price is a stretch, claim a covered place when you sign up. Nobody is asked why.`,
  pwyc: ({ opening }) => `${opening} If that is a stretch, pay what you can. Any amount gets you the same as everyone else.`,
  draw: ({ opening }) => `${opening} Every buyer gets a discount picked at random when they pay, so nobody can tell who needed one.`,
  request: ({ opening, low }) => `${opening} If that is a stretch, message the treasurer for a code that makes it ${low}.`,
};

const worded = (price) => (price === 0 ? "free" : money(price));

function listed(words) {
  if (words.length < 2) return words.join("");
  return `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`;
}

// `view` is what the page is set to: {itemId, price, size}. Returns
// {text, fix, lower} when there is a message to send. Otherwise `text` is
// null and `why` says what is missing:
//   "few"    too few answers for this item
//   "none"   no ranking of fixes to go by
//   "tie"    the top of the ranking is shared, so no one way is picked
//   "nobody" no lower price would bring anyone back at this price
export function announcement(dataset, { itemId, price, size }) {
  const { items, rows, rules, fixes } = dataset;
  const item = items.find((candidate) => candidate.id === itemId);
  const none = (why, more = {}) => ({ text: null, why, fix: null, lower: null, ...more });
  if (sharesAt(rows, item, price).n < rules.minCell) return none("few");
  if (!fixes || fixes.length < 2) return none("none");

  const ranked = [...fixes].sort((a, b) => b.score - a.score);
  const top = ranked.filter((fix) => fix.score === ranked[0].score);
  if (top.length > 1) return none("tie", { tied: top.map((fix) => fix.label) });
  const [fix] = top;
  const message = MESSAGES[fix.id];
  if (!message) return none("none");

  const two = (waysToPrice(rows, item, price, size) ?? []).find((way) => way.kind === "two");
  if (!two) return none("nobody");
  const lower = two.accessPrice;

  // A sliding scale has a middle step when the price that keeps nine in ten
  // falls between the full price and the lower one.
  const middle = maxPriceFor(rows, item, GENTLE);
  const levels = [price, middle !== null && middle > lower && middle < price ? middle : null, lower]
    .filter((level) => level !== null)
    .map(worded);

  const { one, several } = openingOf(item);
  const text = message({ opening: one(money(price)), several, low: worded(lower), levels: listed(levels) });
  return { text, why: null, fix: { id: fix.id, label: fix.label }, lower };
}
