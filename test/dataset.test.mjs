// Guards the one file the public site reads, whatever it was last built from.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dataset = JSON.parse(fs.readFileSync(new URL("../site/data/dataset.json", import.meta.url), "utf8"));

test("the published dataset says what kind of answers it holds", () => {
  assert.ok(["sample", "simulated", "real"].includes(dataset.meta.kind));
  if (dataset.meta.kind === "simulated") {
    // A simulated dataset names the panel and the model that answered for it.
    assert.equal(typeof dataset.meta.panel.model, "string");
    assert.ok(Number.isInteger(dataset.meta.panel.size));
  }
});

test("a published row holds prices and a pledge, and nothing else", () => {
  assert.equal(dataset.rows.length, dataset.meta.n);
  for (const row of dataset.rows) {
    assert.deepEqual(Object.keys(row).sort(), ["dues", "formal", "pledge", "trip"]);
    for (const value of Object.values(row)) {
      assert.ok(value === null || (Array.isArray(value) && value.length === 2));
    }
  }
});

test("no chat transcript, id or timestamp of a response is published", () => {
  const text = JSON.stringify({ ...dataset, meta: { ...dataset.meta, panel: null, survey: null, builtAt: null } });
  assert.ok(!/Respondent:|AI:|\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(text));
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(text));
});
