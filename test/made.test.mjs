import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CALLS } from "../site/js/ui/made.js";

const replies = fs.readdirSync(new URL("../replies/", import.meta.url));

test("the slip of paid calls adds up to what was paid", () => {
  const total = CALLS.reduce((sum, call) => sum + call.cost, 0);
  const count = CALLS.reduce((sum, call) => sum + call.calls, 0);
  assert.equal(Math.round(total * 100), 650);
  assert.equal(count, 16);
});

test("every call on the slip has its reply in the repository", () => {
  for (const call of CALLS) {
    const numbers = call.no.split(", ");
    assert.equal(numbers.length, call.calls, call.no);
    for (const number of numbers) {
      assert.ok(replies.some((name) => name.startsWith(`${number}-`) && name.endsWith(".json")), `reply ${number}`);
    }
  }
});
