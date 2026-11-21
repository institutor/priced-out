import test from "node:test";
import assert from "node:assert/strict";
import { readLink, writeLink } from "../site/js/lib/link.js";

const items = [
  { id: "dues", max: 100, step: 5 },
  { id: "formal", max: 150, step: 5 },
  { id: "trip", max: 400, step: 10 },
];
const start = { itemId: "formal", price: 45, size: 60, revealed: false };

test("an address with nothing in it gives the page's own starting point", () => {
  assert.deepEqual(readLink("", items, start), start);
  assert.deepEqual(readLink("?", items, start), start);
});

test("an address carries the item, the price, the size of the club and whether the answer is showing", () => {
  assert.deepEqual(readLink("?item=trip&price=180&club=25&answer=1", items, start), { itemId: "trip", price: 180, size: 25, revealed: true });
});

test("a price in an address is moved onto the item's steps and kept inside its range", () => {
  assert.equal(readLink("?item=formal&price=47", items, start).price, 45);
  assert.equal(readLink("?item=formal&price=9999", items, start).price, 145);
  assert.equal(readLink("?item=trip&price=-20", items, start).price, 0);
});

test("a club in an address is kept between 5 and 300 people", () => {
  assert.equal(readLink("?club=2", items, start).size, 5);
  assert.equal(readLink("?club=100000", items, start).size, 300);
  assert.equal(readLink("?club=41.6", items, start).size, 42);
});

test("anything in an address that makes no sense is ignored", () => {
  assert.deepEqual(readLink("?item=yacht&price=lots&club=&answer=maybe", items, start), start);
  // A different item with no price starts at that item's own price, not at the formal's.
  assert.equal(readLink("?item=dues", items, start, { dues: 30 }).price, 30);
});

test("the starting point writes no address at all", () => {
  assert.equal(writeLink(start, start), "");
});

test("anything else writes an address that reads back as the same view", () => {
  const view = { itemId: "trip", price: 180, size: 25, revealed: true };
  const address = writeLink(view, start);
  assert.equal(address, "?item=trip&price=180&club=25&answer=1");
  assert.deepEqual(readLink(address, items, start), view);
  assert.equal(writeLink({ ...start, price: 30 }, start), "?item=formal&price=30&club=60");
});
