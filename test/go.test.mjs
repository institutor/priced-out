import test from "node:test";
import assert from "node:assert/strict";
import { asksToConfirm } from "../go.mjs";

test("a reply that stops to ask for a confirm is recognised", () => {
  assert.equal(asksToConfirm({ final_text: "Responses will be recorded from the moment it goes live. To proceed, please reply **confirm**." }), true);
  assert.equal(asksToConfirm({ final_text: "Please reply **confirm** one more time to complete the publish." }), true);
  assert.equal(asksToConfirm({ final_text: "Reply confirm and I will publish it." }), true);
  assert.equal(asksToConfirm({ final_text: "Pushing v2 will replace the live survey. Please reply **confirm** once more." }), true);
  assert.equal(asksToConfirm({ final_text: "If you say **confirm**, I will push v2 now." }), true);
});

test("a reply that reports the work done is not taken for a request to confirm", () => {
  assert.equal(asksToConfirm({ final_text: "The survey is live.\n\nPublic link: flashpointopinions.com/abc" }), false);
  assert.equal(asksToConfirm({ final_text: "No structural changes needed. To re-run: publish the survey first." }), false);
  assert.equal(asksToConfirm({ final_text: "I removed TERM1 and confirmed the path reaches END." }), false);
});
