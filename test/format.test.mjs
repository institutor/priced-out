import test from "node:test";
import assert from "node:assert/strict";
import { money, pct, people } from "../site/js/lib/format.js";

test("pct rounds to a whole percent and shows a dash for nothing", () => {
  assert.equal(pct(0.314), "31%");
  assert.equal(pct(0), "0%");
  assert.equal(pct(1), "100%");
  assert.equal(pct(null), "–");
  assert.equal(pct(undefined), "–");
});

test("money and people round to whole numbers", () => {
  assert.equal(money(45), "$45");
  assert.equal(money(1234.4), "$1,234");
  assert.equal(people(0.31, 60), 19);
  assert.equal(people(null, 60), 0);
});
