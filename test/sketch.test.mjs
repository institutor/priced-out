// The hand-drawn geometry behind every shape on the page. A drawing has to
// come out the same each time it is redrawn, stay where it was asked to be,
// and never hand the browser a broken path.
import test from "node:test";
import assert from "node:assert/strict";
import * as sketch from "../site/js/lib/sketch.js";

// Every coordinate pair in a path, in order.
function points(d) {
  const numbers = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const pairs = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) pairs.push([numbers[i], numbers[i + 1]]);
  return pairs;
}

const wellFormed = (d) => /^(\s*[MLCQZ]\s*(-?\d+(\.\d+)?[\s,]*)*)+$/.test(d);

const shapes = {
  line: (seed) => sketch.line(10, 20, 210, 40, { seed }),
  dashes: (seed) => sketch.dashes(0, 5, 300, 5, { seed }),
  rect: (seed) => sketch.rect(10, 10, 120, 40, { seed }),
  blob: (seed) => sketch.blob(10, 10, 120, 40, { seed }),
  hatch: (seed) => sketch.hatch(10, 10, 120, 40, { seed }),
  ellipse: (seed) => sketch.ellipse(100, 60, 80, 30, { seed }),
  polyline: (seed) => sketch.polyline([[0, 100], [50, 80], [100, 85], [150, 30], [200, 10]], { seed }),
  zigzag: (seed) => sketch.zigzag(0, 20, 240, { seed }),
  arrow: (seed) => sketch.arrow(10, 10, 60, 90, { seed }),
  check: (seed) => sketch.check(2, 2, 20, { seed }),
  polygon: (seed) => sketch.polygon([[0, 0], [40, 0], [40, 30], [0, 30]], { seed }),
  slip: (seed) => sketch.slip(0, 0, 200, 300, { seed }),
  underline: (seed) => sketch.underline(0, 40, 300, { seed }),
};

test("the same seed gives the same drawing, and another seed a different one", () => {
  for (const [name, draw] of Object.entries(shapes)) {
    assert.equal(draw(7), draw(7), name);
    assert.notEqual(draw(7), draw(8), name);
  }
});

test("every drawing is a well-formed path with no missing numbers", () => {
  for (const [name, draw] of Object.entries(shapes)) {
    for (const seed of [1, 2, 3, 99]) {
      const d = draw(seed);
      assert.ok(wellFormed(d), `${name}: ${d.slice(0, 80)}`);
      assert.ok(!/NaN|Infinity|undefined/.test(d), name);
      assert.ok(d.startsWith("M"), name);
    }
  }
});

test("a shape with no size still gives a path, not a broken one", () => {
  for (const d of [sketch.line(5, 5, 5, 5), sketch.rect(0, 0, 0, 0), sketch.blob(0, 0, 0, 0), sketch.hatch(0, 0, 0, 12), sketch.ellipse(0, 0, 0, 0), sketch.polyline([[3, 3]]), sketch.dashes(0, 0, 0, 0)]) {
    assert.ok(!/NaN|Infinity|undefined/.test(d), d);
    assert.ok(d === "" || wellFormed(d), d);
  }
});

test("a line starts and ends near where it was asked to", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const [first] = sketch.strokes(sketch.line(10, 20, 210, 40, { seed, rough: 1.5 }));
    const all = points(first);
    const [sx, sy] = all[0];
    const [ex, ey] = all.at(-1);
    assert.ok(Math.hypot(sx - 10, sy - 20) < 4, `start ${sx},${sy}`);
    assert.ok(Math.hypot(ex - 210, ey - 40) < 4, `end ${ex},${ey}`);
  }
});

test("a line is drawn as many times as it has passes, each a stroke of its own", () => {
  assert.equal(sketch.strokes(sketch.line(0, 0, 100, 0, { passes: 1 })).length, 1);
  assert.equal(sketch.strokes(sketch.line(0, 0, 100, 0, { passes: 2 })).length, 2);
  assert.equal(sketch.strokes(sketch.rect(0, 0, 100, 50, { passes: 1 })).length, 4);
});

test("a polygon has one stroke a side, and an open one leaves the last side off", () => {
  const square = [[0, 0], [40, 0], [40, 30], [0, 30]];
  assert.equal(sketch.strokes(sketch.polygon(square)).length, 4);
  assert.equal(sketch.strokes(sketch.polygon(square, { close: false })).length, 3);
  assert.equal(sketch.strokes(sketch.polygon(square, { passes: 2 })).length, 8);
});

test("a slip of paper is one closed outline with torn ends", () => {
  const d = sketch.slip(0, 0, 200, 300, { tooth: 20, depth: 8 });
  assert.equal(sketch.strokes(d).length, 1);
  assert.ok(d.endsWith("Z"));
  const ys = points(d).map(([, y]) => y);
  assert.ok(Math.min(...ys) > -3 && Math.max(...ys) < 303);
  // The teeth reach into the sheet at both ends.
  assert.ok(ys.some((y) => y > 5 && y < 12) && ys.some((y) => y > 288 && y < 295));
});

test("hatching stays inside its box and gets denser as the gap shrinks", () => {
  for (const seed of [1, 2, 3]) {
    for (const [x, y] of points(sketch.hatch(10, 10, 120, 40, { seed, gap: 5, rough: 0.8 }))) {
      assert.ok(x >= 10 - 2 && x <= 130 + 2, `x ${x}`);
      assert.ok(y >= 10 - 2 && y <= 50 + 2, `y ${y}`);
    }
  }
  const wide = points(sketch.hatch(0, 0, 200, 40, { gap: 10 })).length;
  const tight = points(sketch.hatch(0, 0, 200, 40, { gap: 4 })).length;
  assert.ok(tight > wide * 1.8, `${tight} against ${wide}`);
});

test("hatching is one unbroken scribble, so it can be drawn in one go", () => {
  assert.equal(sketch.strokes(sketch.hatch(0, 0, 200, 40, { gap: 5 })).length, 1);
});

test("a closed shape stays close to its box", () => {
  for (const seed of [1, 2, 3, 4]) {
    const d = sketch.blob(20, 30, 100, 50, { seed, rough: 1.5 });
    assert.ok(d.trim().endsWith("Z"));
    for (const [x, y] of points(d)) {
      assert.ok(x >= 20 - 5 && x <= 120 + 5, `x ${x}`);
      assert.ok(y >= 30 - 5 && y <= 80 + 5, `y ${y}`);
    }
  }
});

test("an ellipse loops round its centre and a little past where it began", () => {
  const all = points(sketch.ellipse(100, 60, 80, 30, { seed: 3, rough: 1 }));
  for (const [x, y] of all) {
    const radius = Math.hypot((x - 100) / 80, (y - 60) / 30);
    assert.ok(radius > 0.5 && radius < 1.5, `radius ${radius}`);
  }
  // Open, like a number someone circled: the pen overshoots the start.
  assert.ok(!sketch.ellipse(100, 60, 80, 30).includes("Z"));
});

test("a dashed line is made of separate short strokes that cover its length", () => {
  const parts = sketch.strokes(sketch.dashes(0, 5, 300, 5, { dash: 10, gap: 8 }));
  assert.ok(parts.length >= 14 && parts.length <= 18, `${parts.length} dashes`);
  const xs = parts.flatMap((part) => points(part).map(([x]) => x));
  assert.ok(Math.min(...xs) < 6 && Math.max(...xs) > 290);
});

test("a wobbly line through points keeps their order and stays near them", () => {
  const given = [[0, 100], [50, 80], [100, 85], [150, 30], [200, 10]];
  const [first] = sketch.strokes(sketch.polyline(given, { seed: 2, rough: 1, passes: 1 }));
  const all = points(first);
  assert.ok(Math.hypot(all[0][0] - 0, all[0][1] - 100) < 3);
  assert.ok(Math.hypot(all.at(-1)[0] - 200, all.at(-1)[1] - 10) < 3);
  for (const [x, y] of all) {
    assert.ok(x >= -3 && x <= 203 && y >= 7 && y <= 103, `${x},${y}`);
  }
});

test("the random source repeats for a seed and stays between 0 and 1", () => {
  const a = sketch.makeRandom(42);
  const b = sketch.makeRandom(42);
  for (let i = 0; i < 50; i++) {
    const value = a();
    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1);
  }
});
