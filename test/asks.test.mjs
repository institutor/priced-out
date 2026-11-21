import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { asksFor } from "../site/js/lib/asks.js";
import { datasetFromExport } from "../site/js/ingest/club.js";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const published = JSON.parse(read("../site/data/dataset.json"));
const mapping = JSON.parse(read("../site/data/mapping.json"));
const example = datasetFromExport(read("../site/data/example-club.csv"), mapping, { name: "example-club.csv" }).dataset;

test("every way of offering a lower price says what it takes to run and what can go wrong", () => {
  for (const dataset of [published, example]) {
    const asks = asksFor(dataset.fixes);
    assert.deepEqual(asks.map((ask) => ask.id), dataset.fixes.map((fix) => fix.id));
    for (const ask of asks) {
      assert.ok(ask.label.length > 0);
      assert.match(ask.run, /^[A-Z].*\.$/);
      assert.match(ask.snag, /^[A-Z].*\.$/);
    }
  }
});

test("the order follows the order the fixes are given in", () => {
  const ranked = [...published.fixes].sort((a, b) => b.score - a.score);
  assert.deepEqual(asksFor(ranked).map((ask) => ask.label), ranked.map((fix) => fix.label));
});

test("a fix nobody wrote a line for is left out, and no fixes gives no lines", () => {
  assert.deepEqual(asksFor([{ id: "raffle", label: "Raffle" }, { id: "open", label: "Open waiver code" }]).map((ask) => ask.id), ["open"]);
  assert.deepEqual(asksFor([{ id: "toString", label: "Not a fix" }]), []);
  assert.deepEqual(asksFor(null), []);
});
