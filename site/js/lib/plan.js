// The page's answer in a few lines: what a treasurer would take to the
// people who set the price. Each line repeats a figure the page works out
// above it, by the same rules. The note says whose answers it rests on twice,
// under its title and in its last line, so a copy of it cannot pass for a
// finding about real students when it is not one.
import { sharesAt, maxPriceFor, waysToPrice, roomForTwo } from "./curve.js";
import { cascade, seatsCovered } from "./pledge.js";
import { money, pct, people, phrase } from "./format.js";
import { voice } from "./voice.js";

const GENTLE = 0.1;
const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];

// Whose answers these are: a few words to go under the title, and a sentence
// to close the note.
function provenance(meta, n, rules) {
  if (meta.loaded?.example) {
    return {
      label: "a made-up club, not real answers",
      source: `Where this comes from: a made-up club of ${n} invented members. It shows what this page gives a club, and no price should be set from it.`,
    };
  }
  if (meta.kind === "simulated") {
    return {
      label: "simulated students, not real answers",
      source: `Where this comes from: ${n} simulated students, AI personas made with Flashpoint. No real student was asked. It shows what this page gives a club, and no price should be set from it.`,
    };
  }
  if (meta.kind === "sample") {
    return {
      label: "sample data, not real answers",
      source: `Where this comes from: ${n} rows of sample data made for testing. No price should be set from it.`,
    };
  }
  const early = n < rules.pilotN;
  const who = meta.loaded ? `the ${n} members of this club who answered the survey` : `the ${n} students who answered the survey`;
  return {
    label: early ? "early results" : "",
    source: `Where this comes from: ${who}.${early ? ` That is under ${rules.pilotN}, so read it as an early result.` : ""} A survey says what people expect to do, which is not always what they do.`,
  };
}

function leftOut(shares, price, size, out) {
  if (shares.outCount === 0) return `Nobody who answered would skip it at ${money(price)}.`;
  const range = `That is ${pct(shares.out)} of those who answered, and it could be anywhere from ${pct(shares.outLow)} to ${pct(shares.outHigh)}.`;
  if (out === 0) return `At ${money(price)} it comes to less than one person in a club of ${size}. ${range}`;
  return `About ${out} of ${size} would skip it and tell you something else. ${range}`;
}

function nineInTen(rows, item, price) {
  const gentle = maxPriceFor(rows, item, GENTLE);
  if (gentle === null) return "There is none. Even free, more than 1 in 10 said they would skip it.";
  if (gentle >= price) return `${money(gentle)} or less. At ${money(price)} you are inside it.`;
  return `${money(gentle)} or less. At ${money(price)} you are ${money(price - gentle)} over it.`;
}

// How much the two-price sums can be wrong by, in one sentence. `spare` is
// what roomForTwo gives.
export function roomSaid(spare, price) {
  if (!spare || spare.payers === 0) return null;
  const { room, payers, each, accessPrice } = spare;
  if (accessPrice === 0) return `Each one who takes the free place instead costs the club ${money(each)}.`;
  const full = payers === 1 ? `the one member who would pay ${money(price)}` : `the ${payers} who would pay ${money(price)}`;
  const low = `the ${money(accessPrice)} price`;
  if (room === 0) {
    const one = payers === 1 ? `If ${full}` : `If one of ${full}`;
    return `There is nothing to spare. ${one} took ${low} instead, the club would take in less than it does now.`;
  }
  if (room >= payers) {
    const all = payers === 1 ? full : `all of ${full}`;
    return `Even if ${all} took ${low} instead, the club would take in no less than it does now.`;
  }
  const some = room === 1 ? "Only one" : `Up to ${room}`;
  return `${some} of ${full} could take ${low} instead before the club takes in less than it does now.`;
}

function twoPricesOrOne(rows, item, price, size) {
  const ways = waysToPrice(rows, item, price, size);
  if (!ways) return null;
  const [now] = ways;
  const two = ways.find((way) => way.kind === "two");
  const lower = ways.find((way) => way.kind === "lower");
  const said = [];
  if (two) {
    const change = two.taken - now.taken;
    const second = two.accessPrice === 0 ? "a free place" : `a ${money(two.accessPrice)} price`;
    const takes = change > 0 ? `takes in about ${money(change)} more` : "costs the club nothing it was getting";
    said.push(`Keeping ${money(price)} and adding ${second} for those who need it brings about ${two.there - now.there} more and ${takes}, as long as those who can pay the full price still do.`);
    const spare = roomSaid(roomForTwo(ways), price);
    if (spare) said.push(spare);
  }
  if (lower) {
    const change = lower.taken - now.taken;
    let takes = "takes in the same money";
    if (change < 0) takes = `takes in ${money(-change)} less`;
    if (change > 0) takes = `takes in ${money(change)} more`;
    said.push(`One price of ${money(lower.price)} for everyone brings ${lower.there - now.there} more and ${takes}.`);
  }
  return said.length > 0 ? said.join(" ") : null;
}

// A tie is never reported as a winner: every option that shares the top
// score is named, and when they all share it there is nothing to say.
function howToOffer(fixes) {
  if (!fixes || fixes.length < 2) return null;
  const ranked = [...fixes].sort((a, b) => b.score - a.score);
  const top = ranked.filter((fix) => fix.score === ranked[0].score);
  const bottom = ranked.filter((fix) => fix.score === ranked.at(-1).score);
  if (top.length === ranked.length) return null;
  const names = (list) => list.map((fix) => fix.label).join(" and ");
  const shown = `the ${NUMBER_WORDS[ranked.length] ?? ranked.length} ways shown`;
  const last = `${names(bottom)} came last.`;
  if (top.length > 1) return `${names(top)} tied at the top of ${shown}. ${last}`;
  return `${top[0].label} came out on top of ${shown}. ${top[0].detail} ${last}`;
}

function coveredByMembers(rows, rules, price, size, out) {
  const pledges = rows.map((row) => row.pledge).filter((pledge) => Array.isArray(pledge));
  const payers = size - out;
  if (pledges.length < rules.minCell || out === 0 || payers === 0 || !(price > 0)) return null;
  const outcome = cascade(pledges, payers);
  if (outcome.pledgers === 0) return "Pledges would not get started: too few said they would give before others did.";
  const covered = Math.min(out, seatsCovered(outcome.pool, price));
  const pot = `${outcome.pledgers} of the ${payers} who pay would add about ${money(outcome.pool)} between them`;
  if (covered === 0) return `${pot}, which is less than one ticket. A pledge in a survey is a promise, not a payment.`;
  return `${pot}, enough for ${covered} of the ${out} empty seats. A pledge in a survey is a promise, not a payment.`;
}

// `view` is what the page is set to: {itemId, price, size}.
export function plan(dataset, { itemId, price, size }) {
  const { items, rows, rules, fixes, meta } = dataset;
  const item = items.find((candidate) => candidate.id === itemId);
  const shares = sharesAt(rows, item, price);
  const { label, source } = provenance(meta, shares.n, rules);
  const title = `A ${phrase(item)} at ${money(price)}, in a club of ${size}`;
  const simulated = voice(meta).simulated;
  if (shares.n < rules.minCell) return { title, label, source, n: shares.n, enough: false, lines: [], simulated };

  const out = people(shares.out, size);
  const lines = [
    { key: "out", lead: "Who it leaves out.", text: leftOut(shares, price, size, out) },
    { key: "gentle", lead: "The price that keeps nine in ten.", text: nineInTen(rows, item, price) },
    { key: "ways", lead: "Two prices or one.", text: twoPricesOrOne(rows, item, price, size) },
    { key: "fix", lead: "How to offer a lower price.", text: howToOffer(fixes) },
    { key: "pledges", lead: "What members would cover themselves.", text: coveredByMembers(rows, rules, price, size, out) },
  ].filter((line) => line.text !== null);
  return { title, label, source, n: shares.n, enough: true, lines, simulated };
}

// The note as plain text, for pasting into a message. Whose answers it rests
// on comes straight after the title, so cutting the note short cannot lose it.
export function planText(note, { address = "" } = {}) {
  const head = [`Priced Out: ${note.title.charAt(0).toLowerCase()}${note.title.slice(1)}`];
  if (note.label) head.push(`(${note.label})`);
  const body = note.enough
    ? note.lines.map((line) => `${line.lead} ${line.text}`)
    : ["Not enough answers for this item yet."];
  const foot = [note.source];
  if (address) foot.push(address);
  return [head.join("\n"), body.join("\n\n"), foot.join("\n")].join("\n\n");
}
