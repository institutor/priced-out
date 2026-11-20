import test from "node:test";
import assert from "node:assert/strict";
import { makeSampleRespondents, SAMPLE_META } from "../scripts/make-sample.mjs";
import { buildDataset } from "../scripts/lib/aggregate.mjs";
import { ITEMS, FIXES, PLEDGE_AMOUNTS, PLEDGE_THRESHOLDS } from "../scripts/lib/vocab.mjs";

test("the same seed gives the same respondents", () => {
  assert.deepEqual(makeSampleRespondents(20, 5), makeSampleRespondents(20, 5));
  assert.notDeepEqual(makeSampleRespondents(20, 5), makeSampleRespondents(20, 6));
});

test("sample answers stay inside the survey's vocabulary", () => {
  const fixIds = FIXES.map((fix) => fix.id);
  for (const respondent of makeSampleRespondents(200, 9)) {
    for (const item of ITEMS) {
      const pair = respondent.prices[item.id];
      if (pair === null) continue;
      for (const price of pair) {
        assert.ok(price >= 0 && price <= item.max, `${item.id} ${price}`);
        assert.equal(price % item.step, 0);
      }
      assert.ok(pair[0] <= pair[1]);
    }
    if (respondent.pledge) {
      assert.ok(PLEDGE_AMOUNTS.includes(respondent.pledge[0]));
      assert.ok(PLEDGE_THRESHOLDS.includes(respondent.pledge[1]));
    }
    for (const task of respondent.maxdiff) {
      assert.equal(new Set(task.shown).size, 4);
      assert.ok(task.shown.every((id) => fixIds.includes(id)));
      assert.ok(task.shown.includes(task.best) && task.shown.includes(task.worst));
      assert.notEqual(task.best, task.worst);
    }
  }
});

test("the sample dataset is labelled as sample data", () => {
  const dataset = buildDataset(makeSampleRespondents(), SAMPLE_META);
  assert.equal(dataset.meta.kind, "sample");
  assert.match(dataset.meta.note, /not real responses/i);
  assert.equal(dataset.meta.n, 60);
});
