// The small drawings beside each heading, and the three-seat mark. Each is
// put together from pen strokes in a 48 by 48 box, and draws itself in when
// its section is first seen.
import { art, drawnIn, path, seedOf, seat } from "./ink.js";
import { svg } from "./dom.js";
import * as sketch from "../lib/sketch.js";

const STROKES = {
  // A price tag with a dollar sign.
  tag: (seed) => [
    sketch.polygon([[17, 9], [43, 9], [43, 39], [17, 39], [5, 24]], { seed, rough: 0.9 }),
    sketch.ellipse(15.5, 24, 2.8, 2.8, { seed: seed + 1, rough: 0.3, steps: 8 }),
    sketch.polyline([[35.5, 18], [30.5, 16], [26.5, 19.5], [30.5, 24], [35, 28.5], [31, 32.5], [25.5, 30.5]], { seed: seed + 2, rough: 0.4, passes: 1 }),
    sketch.line(30.6, 12.5, 30.6, 36, { seed: seed + 3, rough: 0.5, passes: 1 }),
  ],
  // A key: what it would take to get in.
  key: (seed) => [
    sketch.ellipse(14, 24, 8.5, 8.5, { seed, rough: 0.6, steps: 12 }),
    sketch.line(22.5, 24, 44, 24, { seed: seed + 1, rough: 0.7, passes: 2 }),
    sketch.line(36, 24.5, 36, 32, { seed: seed + 2, rough: 0.5, passes: 1 }),
    sketch.line(41.5, 24.5, 41.5, 30.5, { seed: seed + 3, rough: 0.5, passes: 1 }),
  ],
  // A ticket with a tick on it: the fix people would use.
  ticket: (seed) => [
    sketch.polygon([[5, 12], [43, 12], [43, 36], [5, 36]], { seed, rough: 1 }),
    sketch.dashes(31, 13.5, 31, 35, { seed: seed + 1, dash: 3.5, gap: 3, rough: 0.3 }),
    sketch.check(9.5, 16, 15, { seed: seed + 2, rough: 0.5 }),
  ],
  // A jar with coins going in: members covering it themselves.
  jar: (seed) => [
    sketch.polygon([[13, 19], [35, 19], [37.5, 43], [10.5, 43]], { seed, rough: 0.9 }),
    sketch.polygon([[11.5, 13], [36.5, 13], [36.5, 19], [11.5, 19]], { seed: seed + 1, rough: 0.7 }),
    sketch.ellipse(20, 36, 4.2, 4.2, { seed: seed + 2, rough: 0.4, steps: 9 }),
    sketch.ellipse(28.5, 33, 4.2, 4.2, { seed: seed + 3, rough: 0.4, steps: 9 }),
    sketch.ellipse(24, 5.5, 3.6, 3.6, { seed: seed + 4, rough: 0.4, steps: 9 }),
  ],
  // A till receipt, torn off at the bottom.
  receipt: (seed) => [
    sketch.polygon([[12, 40], [12, 6], [36, 6], [36, 40]], { seed, rough: 0.8, close: false }),
    sketch.zigzag(36, 40, 12, { seed: seed + 1, tooth: 8, depth: -4.5, rough: 0.4 }),
    sketch.line(17, 14, 31, 14, { seed: seed + 2, rough: 0.5, passes: 1 }),
    sketch.line(17, 20.5, 31, 20.5, { seed: seed + 3, rough: 0.5, passes: 1 }),
    sketch.line(17, 27, 26, 27, { seed: seed + 4, rough: 0.5, passes: 1 }),
  ],
  // A paper plane: the note that gets sent on.
  plane: (seed) => [
    sketch.polygon([[44, 7], [4, 21], [20, 28.5], [29, 43]], { seed, rough: 0.8 }),
    sketch.line(43, 8, 20.5, 28.5, { seed: seed + 1, rough: 0.5, passes: 1 }),
    sketch.polyline([[20.5, 29], [21, 39.5], [25.5, 35.5]], { seed: seed + 2, rough: 0.4, passes: 1 }),
  ],
  // A speech bubble: what they said instead.
  bubble: (seed) => [
    sketch.polygon([[6, 9], [42, 9], [42, 32], [22, 32], [13, 41], [14.5, 32], [6, 32]], { seed, rough: 0.9 }),
    sketch.line(13, 17, 35, 17, { seed: seed + 1, rough: 0.5, passes: 1 }),
    sketch.line(13, 24, 29, 24, { seed: seed + 2, rough: 0.5, passes: 1 }),
  ],
  // A sheet with a corner folded down: a club's own file of answers.
  sheet: (seed) => [
    sketch.polygon([[11, 5], [29, 5], [38, 14], [38, 43], [11, 43]], { seed, rough: 0.9 }),
    sketch.polyline([[29, 5.5], [29, 14], [37.5, 14]], { seed: seed + 1, rough: 0.4, passes: 1 }),
    sketch.line(16, 22, 33, 22, { seed: seed + 2, rough: 0.5, passes: 1 }),
    sketch.line(16, 28.5, 33, 28.5, { seed: seed + 3, rough: 0.5, passes: 1 }),
    sketch.line(16, 35, 27, 35, { seed: seed + 4, rough: 0.5, passes: 1 }),
  ],
  // An empty chair: the member who is not there.
  chair: (seed) => [
    sketch.line(14, 6, 14, 43, { seed, rough: 0.7, passes: 2 }),
    sketch.polyline([[14, 27], [35, 27], [35, 43]], { seed: seed + 1, rough: 0.7, passes: 1 }),
    sketch.line(14, 12, 24, 12, { seed: seed + 2, rough: 0.5, passes: 1 }),
    sketch.line(14, 18.5, 24, 18.5, { seed: seed + 3, rough: 0.5, passes: 1 }),
    sketch.line(24, 9.5, 24, 21, { seed: seed + 4, rough: 0.5, passes: 1 }),
  ],
  // A pencil: how the survey was made.
  pencil: (seed) => [
    sketch.polygon([[7.5, 41], [11, 30], [32, 9], [39, 16], [18, 37]], { seed, rough: 0.8 }),
    sketch.line(11.5, 30.5, 17.5, 36.5, { seed: seed + 1, rough: 0.4, passes: 1 }),
    sketch.line(28, 13, 35, 20, { seed: seed + 2, rough: 0.4, passes: 1 }),
  ],
  // An envelope with a wax seal.
  envelope: (seed) => [
    sketch.polygon([[5, 12], [43, 12], [43, 38], [5, 38]], { seed, rough: 0.9 }),
    sketch.polyline([[5.5, 12.5], [24, 27], [42.5, 12.5]], { seed: seed + 1, rough: 0.5, passes: 1 }),
    sketch.ellipse(24, 27.5, 4.4, 4.4, { seed: seed + 2, rough: 0.4, steps: 9 }),
  ],
  // An envelope with its flap up and a slip standing in it.
  opened: (seed) => [
    sketch.polygon([[5, 20], [43, 20], [43, 43], [5, 43]], { seed, rough: 0.9 }),
    sketch.polyline([[5.5, 20], [24, 5], [42.5, 20]], { seed: seed + 1, rough: 0.5, passes: 1 }),
    sketch.polygon([[14, 20], [14, 11], [34, 11], [34, 20]], { seed: seed + 2, rough: 0.5, close: false }),
    sketch.line(18, 15.5, 30, 15.5, { seed: seed + 3, rough: 0.4, passes: 1 }),
    sketch.polyline([[5.5, 42.5], [24, 30], [42.5, 42.5]], { seed: seed + 4, rough: 0.5, passes: 1 }),
  ],
  // A flag on a pole: the objective.
  flag: (seed) => [
    sketch.line(11, 5, 11, 44, { seed, rough: 0.7, passes: 2 }),
    sketch.polygon([[11.5, 7], [40, 12], [30, 19], [40, 27], [11.5, 27]], { seed: seed + 1, rough: 0.8 }),
  ],
  // A head with an aerial: the agent.
  agent: (seed) => [
    sketch.polygon([[10, 17], [38, 17], [38, 41], [10, 41]], { seed, rough: 0.9 }),
    sketch.line(24, 16.5, 24, 8.5, { seed: seed + 1, rough: 0.4, passes: 1 }),
    sketch.ellipse(24, 6, 2.6, 2.6, { seed: seed + 2, rough: 0.3, steps: 8 }),
    sketch.line(18.5, 25, 18.5, 29, { seed: seed + 3, rough: 0.3, passes: 1 }),
    sketch.line(29.5, 25, 29.5, 29, { seed: seed + 4, rough: 0.3, passes: 1 }),
    sketch.polyline([[18, 34], [24, 36.5], [30, 34]], { seed: seed + 5, rough: 0.3, passes: 1 }),
  ],
  // A padlock: what the code holds.
  lock: (seed) => [
    sketch.polygon([[10, 22], [38, 22], [38, 43], [10, 43]], { seed, rough: 0.9 }),
    sketch.polyline([[16, 22], [16, 13], [20, 7.5], [28, 7.5], [32, 13], [32, 22]], { seed: seed + 1, rough: 0.5, passes: 1 }),
    sketch.line(24, 30, 24, 36, { seed: seed + 2, rough: 0.4, passes: 2 }),
  ],
  // A window with a prompt in it: run it yourself.
  prompt: (seed) => [
    sketch.polygon([[5, 9], [43, 9], [43, 39], [5, 39]], { seed, rough: 0.9 }),
    sketch.polyline([[11, 19], [17, 24], [11, 29]], { seed: seed + 1, rough: 0.4, passes: 1 }),
    sketch.line(21, 29.5, 31, 29.5, { seed: seed + 2, rough: 0.4, passes: 1 }),
  ],
  // A star: the answer.
  star: (seed) => [
    sketch.polygon([[24, 4], [29.5, 17], [44, 18.5], [33, 28], [36.5, 42.5], [24, 34.5], [11.5, 42.5], [15, 28], [4, 18.5], [18.5, 17]], { seed, rough: 0.8 }),
  ],
  // A list with boxes ticked: the plan.
  plan: (seed) => [
    sketch.polygon([[9, 5], [39, 5], [39, 43], [9, 43]], { seed, rough: 0.9 }),
    sketch.check(13, 9, 9, { seed: seed + 1, rough: 0.4 }),
    sketch.line(25, 15, 34, 15, { seed: seed + 2, rough: 0.4, passes: 1 }),
    sketch.check(13, 20, 9, { seed: seed + 3, rough: 0.4 }),
    sketch.line(25, 26, 34, 26, { seed: seed + 4, rough: 0.4, passes: 1 }),
    sketch.line(15, 36, 34, 36, { seed: seed + 5, rough: 0.4, passes: 1 }),
  ],
  // A notebook: what it learned.
  book: (seed) => [
    sketch.polygon([[8, 8], [24, 12], [40, 8], [40, 38], [24, 42], [8, 38]], { seed, rough: 0.9 }),
    sketch.line(24, 12.5, 24, 41.5, { seed: seed + 1, rough: 0.4, passes: 1 }),
    sketch.line(12.5, 17.5, 20, 19.5, { seed: seed + 2, rough: 0.4, passes: 1 }),
    sketch.line(12.5, 24, 20, 26, { seed: seed + 3, rough: 0.4, passes: 1 }),
    sketch.line(28, 19.5, 35.5, 17.5, { seed: seed + 4, rough: 0.4, passes: 1 }),
  ],
  // A magnifying glass: how we know.
  glass: (seed) => [
    sketch.ellipse(20, 20, 12, 12, { seed, rough: 0.7, steps: 14 }),
    sketch.line(29, 29, 43, 43, { seed: seed + 1, rough: 0.7, passes: 2 }),
    sketch.polyline([[14.5, 16.5], [17, 13.5], [21, 12.5]], { seed: seed + 2, rough: 0.3, passes: 1 }),
  ],
};

export function doodle(name) {
  const seed = seedOf(`doodle ${name}`);
  const strokes = (STROKES[name] ?? STROKES.tag)(seed);
  let from = 0;
  const parts = strokes.map((d) => {
    const drawn = drawnIn(d, "", { from });
    from += drawn.length;
    return drawn;
  });
  return art(`doodle doodle-${name}`, 48, 48, parts);
}

// The mark: three seats in a row, the last one empty.
export function mark(className = "") {
  const kinds = ["go", "go", "out"];
  const seats = kinds.map((kind, index) => {
    const glyph = seat(kind, 40 + index);
    glyph.setAttribute("x", index * 23);
    glyph.setAttribute("width", 24);
    glyph.setAttribute("height", 24);
    glyph.style.setProperty("--i", index);
    return glyph;
  });
  return svg("svg", { class: `art mark ${className}`.trim(), viewBox: "0 0 70 24", "aria-hidden": "true", focusable: "false" }, seats);
}

// A scribbled dot, for the start of a list item.
export function bullet(seed) {
  return art("bullet", 14, 14, path(sketch.hatch(1.5, 1.5, 11, 11, { seed, gap: 2.6, rough: 0.5 })));
}

// A box to tick. The tick shows while the checkbox before it is checked.
export function tickBox(seed) {
  return art("tick", 24, 24,
    path(sketch.rect(4, 5, 15, 15, { seed, rough: 0.8, passes: 1, over: 1.5 })),
    path(sketch.check(4, 0, 21, { seed: seed + 1, rough: 0.7 }), "tick-mark"),
  );
}
