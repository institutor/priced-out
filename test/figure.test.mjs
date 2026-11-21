// The stick figures on the title page, and the boxes their words go in.
// A figure has to stand on the ground it was given, put its hands where its
// pose says, and come out the same each time it is redrawn.
import test from "node:test";
import assert from "node:assert/strict";
import { strokes } from "../site/js/lib/sketch.js";
import { POSES, bubble, figure } from "../site/js/lib/figure.js";

// Every coordinate pair in a path, in order.
function points(d) {
  const numbers = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const pairs = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) pairs.push([numbers[i], numbers[i + 1]]);
  return pairs;
}

const wellFormed = (d) => /^(\s*[MLCQZ]\s*(-?\d+(\.\d+)?[\s,]*)*)+$/.test(d);

const standing = (more = {}) => figure({ x: 200, ground: 300, height: 120, seed: 5, ...more });

test("the same seed gives the same figure, and another seed a different one", () => {
  assert.deepEqual(standing(), standing());
  assert.notDeepEqual(standing().strokes, standing({ seed: 6 }).strokes);
});

test("a figure is drawn head first: head, spine, arms, legs, then the face", () => {
  const drawn = standing();
  assert.equal(drawn.strokes.length, 9);
  // Worried eyebrows are two strokes more.
  assert.equal(standing({ brows: "worried" }).strokes.length, 11);
  // The head is the first thing down, and it is the highest.
  const top = (d) => Math.min(...points(d).map(([, y]) => y));
  const heights = drawn.strokes.slice(0, 6).map(top);
  assert.equal(Math.min(...heights), heights[0]);
});

test("every stroke is one well-formed pen stroke", () => {
  for (const seed of [1, 2, 3, 99]) {
    for (const pose of Object.keys(POSES)) {
      for (const mouth of ["smile", "open", "flat", "frown"]) {
        for (const d of standing({ seed, left: pose, right: pose, mouth, brows: "worried" }).strokes) {
          assert.ok(wellFormed(d), d.slice(0, 80));
          assert.ok(!/NaN|Infinity|undefined/.test(d), d);
          assert.equal(strokes(d).length, 1, d);
        }
      }
    }
  }
});

test("a figure stands on its ground and is as tall as it was asked to be", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const all = standing({ seed }).strokes.flatMap(points);
    const ys = all.map(([, y]) => y);
    assert.ok(Math.abs(Math.max(...ys) - 300) < 3, `feet at ${Math.max(...ys)}`);
    assert.ok(Math.abs(Math.min(...ys) - 180) < 5, `head top at ${Math.min(...ys)}`);
  }
});

test("a figure half the height is the same figure at half the size", () => {
  const big = standing({ height: 120 });
  const small = standing({ height: 60 });
  assert.ok(Math.abs(big.head.r - small.head.r * 2) < 0.01);
  const span = (drawn) => {
    const xs = drawn.strokes.flatMap(points).map(([x]) => x);
    return Math.max(...xs) - Math.min(...xs);
  };
  assert.ok(Math.abs(span(big) - span(small) * 2) < 4, `${span(big)} against ${span(small)}`);
});

test("the left arm is the mirror of the right", () => {
  for (const pose of Object.keys(POSES)) {
    const { hands } = standing({ left: pose, right: pose });
    assert.ok(Math.abs((hands.left[0] - 200) + (hands.right[0] - 200)) < 0.01, pose);
    assert.ok(Math.abs(hands.left[1] - hands.right[1]) < 0.01, pose);
  }
});

test("a raised hand is above the head, and a lowered one below the shoulder", () => {
  const drawn = standing({ left: "up", right: "down" });
  assert.ok(drawn.hands.left[1] < drawn.head.y, "raised");
  assert.ok(drawn.hands.right[1] > drawn.shoulder[1] + 20, "lowered");
  // Each arm's stroke ends at its hand.
  const end = (d) => points(d).at(-1);
  const [, , leftArm, rightArm] = drawn.strokes;
  assert.ok(Math.hypot(end(leftArm)[0] - drawn.hands.left[0], end(leftArm)[1] - drawn.hands.left[1]) < 3);
  assert.ok(Math.hypot(end(rightArm)[0] - drawn.hands.right[0], end(rightArm)[1] - drawn.hands.right[1]) < 3);
});

test("a pose nobody has heard of is drawn with the arm down", () => {
  assert.deepEqual(standing({ left: "cartwheel" }), standing({ left: "down" }));
});

test("a slumped figure is shorter and its head is forward of its feet", () => {
  const upright = standing();
  const slumped = standing({ lean: 0.08, slump: 0.05 });
  assert.ok(slumped.head.y > upright.head.y + 3);
  assert.ok(slumped.head.x > upright.head.x + 5);
});

test("a speech bubble is a box with a tail that reaches the speaker", () => {
  for (const seed of [1, 2, 3]) {
    const d = bubble(100, 20, 200, 60, { tip: [150, 110], seed });
    assert.ok(wellFormed(d), d.slice(0, 80));
    // Four sides, with the bottom one broken by the two sides of the tail.
    assert.equal(strokes(d).length, 7);
    const all = points(d);
    assert.ok(all.some(([x, y]) => Math.hypot(x - 150, y - 110) < 4), "tail reaches the tip");
    for (const [x, y] of all) {
      assert.ok(x > 100 - 6 && x < 300 + 6, `x ${x}`);
      assert.ok(y > 20 - 6 && y < 110 + 6, `y ${y}`);
    }
  }
  assert.equal(bubble(0, 0, 80, 30, { tip: [40, 50], seed: 4 }), bubble(0, 0, 80, 30, { tip: [40, 50], seed: 4 }));
});

test("the tail leaves the box from its bottom edge, wherever the speaker stands", () => {
  // Someone standing well to the left of the box still gets a tail that
  // starts inside the bottom edge.
  const all = points(bubble(100, 20, 200, 60, { tip: [20, 120], seed: 2, tail: 16 }));
  const onEdge = all.filter(([, y]) => Math.abs(y - 80) < 4).map(([x]) => x);
  assert.ok(Math.min(...onEdge) > 100 - 5);
});

test("a bubble with nobody to point at is a plain box", () => {
  assert.equal(strokes(bubble(0, 0, 80, 30, { seed: 3 })).length, 4);
});
