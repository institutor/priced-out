import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partBeingRead } from "../site/js/lib/reading.js";

test("the part being read is the last one whose top has passed the line", () => {
  assert.equal(partBeingRead([900, 1800, 2700], 250), -1);
  assert.equal(partBeingRead([250, 1800, 2700], 250), 0);
  assert.equal(partBeingRead([-600, 100, 900], 250), 1);
  assert.equal(partBeingRead([-2600, -1700, -800], 250), 2);
  assert.equal(partBeingRead([], 250), -1);
});

test("every part of the page has a short name in the contents", async () => {
  const page = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
  const ids = [...page.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);
  const source = readFileSync(new URL("../site/js/ui/contents.js", import.meta.url), "utf8");
  assert.ok(ids.length >= 10);
  for (const id of ids) {
    assert.match(source, new RegExp(`(^|\\s)"?${id}"?: "`, "m"), `no short name for the part "${id}"`);
  }
  assert.match(page, /<nav id="contents"/);
});
