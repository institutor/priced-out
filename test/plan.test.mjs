import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { plan, planText, roomSaid } from "../site/js/lib/plan.js";
import { priceGrid, roomForTwo, waysToPrice } from "../site/js/lib/curve.js";
import { datasetFromExport } from "../site/js/ingest/club.js";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const published = JSON.parse(read("../site/data/dataset.json"));
const mapping = JSON.parse(read("../site/data/mapping.json"));
const exampleFile = read("../site/data/example-club.csv");
const example = datasetFromExport(exampleFile, mapping, { name: "example-club.csv" }).dataset;
// The same rows, as if people had answered them.
const asPeople = exampleFile.split("\n").map((line, index) => (index < 2 ? line : line.replace(/^(\d+),example,/, "$1,link,"))).join("\n");
const club = datasetFromExport(asPeople, mapping, { name: "our-club.csv" }).dataset;

const view = { itemId: "formal", price: 45, size: 60 };
const textOf = (note, key) => note.lines.find((line) => line.key === key)?.text ?? null;

test("the note repeats the figures the page shows for the opening view", () => {
  const note = plan(published, view);
  assert.equal(note.title, "A formal ticket at $45, in a club of 60");
  assert.equal(note.enough, true);
  assert.deepEqual(note.lines.map((line) => line.key), ["out", "gentle", "ways", "fix", "pledges"]);
  assert.match(textOf(note, "out"), /^About 19 of 60 would skip it and tell you something else\. That is 31% of those who answered, and it could be anywhere from 24% to 40%\.$/);
  assert.equal(textOf(note, "gentle"), "$30 or less. At $45 you are $15 over it.");
  assert.match(textOf(note, "ways"), /adding a \$20 price for those who need it brings about 16 more and takes in about \$320 more/);
  assert.match(textOf(note, "ways"), /still do\. Up to 12 of the 41 who would pay \$45 could take the \$20 price instead before the club takes in less than it does now\. One price/);
  assert.match(textOf(note, "ways"), /One price of \$30 for everyone brings 13 more and takes in \$225 less\./);
  assert.match(textOf(note, "fix"), /^Open waiver code came out on top of the six ways shown\. .* Waiver on request came last\.$/);
  assert.match(textOf(note, "pledges"), /^33 of the 41 who pay would add about \$148 between them, enough for 3 of the 19 empty seats\./);
});

test("a note built on simulated students says so under its title and in its last line", () => {
  const note = plan(published, view);
  assert.equal(note.simulated, true);
  assert.equal(note.label, "simulated students, not real answers");
  assert.match(note.source, /118 simulated students, AI personas made with Flashpoint\. No real student was asked\./);
  assert.match(note.source, /no price should be set from it/);
  const lines = planText(note, { address: "https://example.org/?price=45" }).split("\n");
  assert.equal(lines[0], "Priced Out: a formal ticket at $45, in a club of 60");
  assert.equal(lines[1], "(simulated students, not real answers)");
  assert.equal(lines.at(-1), "https://example.org/?price=45");
  assert.match(lines.at(-2), /^Where this comes from: 118 simulated students/);
});

test("the made-up club is called made up, and a club's own answers are called its members'", () => {
  const made = plan(example, view);
  assert.equal(made.simulated, true);
  assert.equal(made.label, "a made-up club, not real answers");
  assert.match(made.source, /a made-up club of 35 invented members/);

  const own = plan(club, view);
  assert.equal(own.simulated, false);
  assert.equal(own.label, "");
  assert.match(own.source, /^Where this comes from: the 35 members of this club who answered the survey\. A survey says/);
  assert.doesNotMatch(planText(own), /simulated|made-up|invented|persona/i);
  // No label, so nothing in brackets under the title.
  assert.equal(planText(own).split("\n")[1], "");
});

test("a small club's note is marked as an early result", () => {
  const few = { ...club, rows: club.rows.slice(0, 12) };
  const note = plan(few, view);
  assert.equal(note.label, "early results");
  assert.match(note.source, /That is under 20, so read it as an early result\./);
});

test("with too few answers the note gives no figures", () => {
  const few = { ...club, rows: club.rows.slice(0, 3) };
  const note = plan(few, view);
  assert.equal(note.enough, false);
  assert.deepEqual(note.lines, []);
  assert.match(planText(note), /Not enough answers for this item yet\./);
});

test("a tie at the top is not reported as a winner, and an all-way tie says nothing", () => {
  const [first, second, ...rest] = published.fixes.map((fix) => ({ ...fix }));
  const tied = { ...published, fixes: [{ ...first, score: 0.4 }, { ...second, score: 0.4 }, ...rest.map((fix) => ({ ...fix, score: -0.1 }))] };
  assert.match(textOf(plan(tied, view), "fix"), /^Sliding scale and Waiver on request tied at the top of the six ways shown\./);
  const flat = { ...published, fixes: published.fixes.map((fix) => ({ ...fix, score: 0 })) };
  assert.equal(textOf(plan(flat, view), "fix"), null);
  assert.equal(textOf(plan({ ...published, fixes: null }, view), "fix"), null);
});

test("a price nobody skips at says so and drops the lines that have nothing to add", () => {
  const note = plan(published, { itemId: "formal", price: 0, size: 60 });
  assert.equal(textOf(note, "out"), "Nobody who answered would skip it at $0.");
  assert.equal(textOf(note, "pledges"), null);
  assert.equal(textOf(note, "ways"), null);
  assert.match(textOf(note, "gentle"), /At \$0 you are inside it\.$/);
});

test("every view of every set of answers reads as a finished sentence", () => {
  for (const dataset of [published, example, club]) {
    for (const item of dataset.items) {
      for (const price of priceGrid(item)) {
        for (const size of [5, 23, 60, 300]) {
          const note = plan(dataset, { itemId: item.id, price, size });
          const text = planText(note);
          assert.doesNotMatch(text, /NaN|undefined|null|Infinity|\$-|-\d/, `${item.id} ${price} ${size}`);
          for (const line of note.lines) assert.match(line.text, /\.$/, `${item.id} ${price} ${size} ${line.key}`);
        }
      }
    }
  }
});

test("the room for error is said in a way that fits each case", () => {
  const said = (room, payers, accessPrice = 20) => roomSaid({ room, payers, each: 45 - accessPrice, accessPrice }, 45);
  assert.equal(said(12, 41), "Up to 12 of the 41 who would pay $45 could take the $20 price instead before the club takes in less than it does now.");
  assert.equal(said(1, 41), "Only one of the 41 who would pay $45 could take the $20 price instead before the club takes in less than it does now.");
  assert.equal(said(0, 41), "There is nothing to spare. If one of the 41 who would pay $45 took the $20 price instead, the club would take in less than it does now.");
  assert.equal(said(0, 1), "There is nothing to spare. If the one member who would pay $45 took the $20 price instead, the club would take in less than it does now.");
  assert.equal(said(41, 41), "Even if all of the 41 who would pay $45 took the $20 price instead, the club would take in no less than it does now.");
  assert.equal(said(1, 1), "Even if the one member who would pay $45 took the $20 price instead, the club would take in no less than it does now.");
  assert.equal(said(0, 41, 0), "Each one who takes the free place instead costs the club $45.");
  assert.equal(said(0, 0), null);
  assert.equal(roomSaid(null, 45), null);
});

test("the room for error is true to the sums at every price", () => {
  for (const dataset of [published, example]) {
    for (const item of dataset.items) {
      for (const price of priceGrid(item)) {
        const ways = waysToPrice(dataset.rows, item, price, 60);
        const spare = roomForTwo(ways);
        if (!spare) continue;
        const [now] = ways;
        const two = ways.find((way) => way.kind === "two");
        assert.ok(spare.room >= 0 && spare.room <= spare.payers);
        assert.ok(two.taken - spare.room * spare.each >= now.taken, `${item.id} at ${price}`);
        if (spare.room < spare.payers) assert.ok(two.taken - (spare.room + 1) * spare.each < now.taken, `${item.id} at ${price}`);
      }
    }
  }
});
