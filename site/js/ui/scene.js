// The drawing on the title page: a strip of stick figures. Two club officers
// call out a price, the members say yes, and one of them says they can't
// make it. Then a note in the other pen says why. Every line is its own
// stroke with its own start time, so the page can draw it while it is
// watched. The words are in the page as text as well; this is the picture.
import { svg } from "./dom.js";
import * as sketch from "../lib/sketch.js";
import { bubble, figure } from "../lib/figure.js";

// Below this width the strip is drawn again for a narrow page: smaller
// figures, one member fewer, and the note underneath instead of beside.
export const NARROW = "(max-width: 44rem)";

// When each part starts, in milliseconds after the first stroke, and how
// long the whole drawing takes. Both layouts keep the same time.
const CUE = { ground: 0, officers: 150, call: 1150, members: 2050, decliner: 3450, sorry: 4150, truth: 5500 };
export const LASTS = 6400;

// What is said. The price is the one the page opens with.
const CALL = ["Come to our formal!", "$45 a ticket."];
const YES = ["I'm in!", "Me too!"];
const TRUTH = "(can't afford it)";

// How long each stroke of a figure takes: head, spine, two arms, two legs,
// two eyes, mouth, two eyebrows.
const STROKE = [210, 130, 130, 130, 140, 140, 50, 50, 80, 60, 60];

const OFFICER = { look: 0.9 };
const MEMBER = { look: -0.9 };
// The one who can't: a little smaller, head down, a hand on the back of the
// neck, feet together.
const DECLINER = { left: "pocket", right: "neck", lean: -0.035, slump: 0.045, look: -0.5, down: 0.14, mouth: "frown", brows: "worried", stance: 0.05 };

const WIDE = {
  width: 1130,
  height: 322,
  ground: 298,
  pen: 2.8,
  officers: [
    { ...OFFICER, x: 78, height: 150, left: "wave", right: "call", mouth: "open" },
    { ...OFFICER, x: 172, height: 142, left: "pocket", right: "hold" },
  ],
  call: { lines: CALL, size: 29, centre: 216, top: 12 },
  members: [
    { ...MEMBER, x: 442, height: 138, left: "up", right: "up", mouth: "open", says: { lines: [YES[0]], size: 23, centre: 424, top: 60 } },
    { ...MEMBER, x: 534, height: 148, left: "down", right: "wave" },
    { ...MEMBER, x: 622, height: 133, left: "up", right: "down", mouth: "open", says: { lines: [YES[1]], size: 23, centre: 642, top: 72 } },
  ],
  decliner: { ...DECLINER, x: 838, height: 134 },
  sorry: { lines: ["Sorry, can't make it."], size: 27, centre: 846, top: 84 },
  truth: { size: 33, x: 908, y: 228, anchor: "start", turn: -5, from: [942, 252], to: [870, 238], bend: -0.34 },
};

const TALL = {
  width: 360,
  height: 262,
  ground: 200,
  pen: 2,
  officers: [
    { ...OFFICER, x: 34, height: 86, left: "wave", right: "call", mouth: "open" },
    { ...OFFICER, x: 82, height: 81, left: "pocket", right: "hold" },
  ],
  call: { lines: CALL, size: 17, centre: 98, top: 8 },
  members: [
    { ...MEMBER, x: 170, height: 79, left: "up", right: "up", mouth: "open", says: { lines: [YES[0]], size: 14, centre: 186, top: 70 } },
    { ...MEMBER, x: 216, height: 85, left: "down", right: "wave" },
  ],
  decliner: { ...DECLINER, x: 304, height: 78 },
  sorry: { lines: ["Sorry,", "can't make it."], size: 17, centre: 290, top: 26 },
  truth: { size: 21, x: 352, y: 248, anchor: "end", turn: -3, from: [254, 230], to: [288, 172], bend: -0.32 },
};

// A pen that keeps the time. Each stroke it puts down starts as the one
// before it is finishing.
function makePen(stage) {
  let clock = 0;
  return {
    get now() {
      return clock;
    },
    set now(ms) {
      clock = ms;
    },
    stroke(d, className, lasts, overlap = 0.55) {
      const node = svg("path", { d, class: `draw ${className}`.trim(), pathLength: 1 });
      node.style.setProperty("--wait", `${Math.round(clock)}ms`);
      node.style.setProperty("--lasts", `${Math.round(lasts)}ms`);
      stage.append(node);
      clock += lasts * overlap;
      return node;
    },
  };
}

function person(pen, spec, ground, seed, pace = 1) {
  const drawn = figure({ ...spec, ground, seed });
  drawn.strokes.forEach((d, index) => pen.stroke(d, "figure-line", STROKE[index] * pace));
  return drawn;
}

// A line of lettering, a word at a time. A word that ends a phrase is
// followed by a short breath.
function letter(pen, line, attrs, pace = 85) {
  const words = line.split(" ");
  const text = svg("text", attrs);
  words.forEach((word, index) => {
    const span = svg("tspan", { text: index < words.length - 1 ? `${word} ` : word });
    span.style.setProperty("--wait", `${Math.round(pen.now)}ms`);
    text.append(span);
    pen.now += /[!,.?]$/.test(word) ? pace * 2.2 : pace;
  });
  return text;
}

// How wide a line of lettering came out. Somewhere that cannot measure it,
// a guess from the number of letters is close enough for a box.
function widthOf(text, size) {
  let width = 0;
  try {
    width = text.getComputedTextLength();
  } catch {
    width = 0;
  }
  return width > 0 ? width : text.textContent.length * size * 0.42;
}

// What someone says: the box first, its tail down to them, then the words.
function speech(words, pen, { lines, size, centre, top }, speaker, seed) {
  const lineHeight = size * 1.12;
  const padX = size * 0.62;
  const padY = size * 0.42;
  // The lettering goes in first, unseen, to find out how big a box it needs.
  const probe = makePen(words);
  const probes = lines.map((line) => letter(probe, line, { class: "said", "font-size": size }));
  words.append(...probes);
  const width = Math.max(...probes.map((text) => widthOf(text, size))) + padX * 2;
  const height = padY * 2 + size * 0.9 + (lines.length - 1) * lineHeight;
  for (const text of probes) text.remove();

  const tip = [speaker.head.x + (centre > speaker.head.x ? 0.5 : -0.5) * speaker.head.r, speaker.head.y - speaker.head.r * 1.5];
  const outline = bubble(centre - width / 2, top, width, height, { tip, seed, rough: size * 0.035, tail: size * 0.62 });
  for (const d of sketch.strokes(outline)) pen.stroke(d, "figure-line", 120, 0.5);
  pen.now -= 120;
  lines.forEach((line, index) => {
    words.append(letter(pen, line, {
      class: "said",
      x: centre,
      y: (top + padY + size * 0.79 + index * lineHeight).toFixed(1),
      "font-size": size,
      "text-anchor": "middle",
    }));
  });
}

// The ticket one officer is holding up.
function ticket(lines, pen, hand, size, seed) {
  const width = size * 1.5;
  const x = hand[0] - width * 0.35;
  const y = hand[1] - size * 1.05;
  const fill = svg("path", { d: sketch.blob(x, y, width, size, { seed, rough: size * 0.04, round: 0.2 }), class: "ticket-fill" });
  fill.style.setProperty("--wait", `${Math.round(pen.now + 150)}ms`);
  lines.append(fill);
  for (const d of sketch.strokes(sketch.rect(x, y, width, size, { seed: seed + 1, rough: size * 0.04, passes: 1, over: size * 0.1 }))) {
    pen.stroke(d, "figure-line", 70, 0.6);
  }
}

// Draws the scene into `root`, timed from `start` milliseconds, in place of
// any drawing of it that is already there. The lines and the lettering go in
// two groups, so that the lines can be made to wobble (cover.js) while the
// words hold still and stay easy to read.
export function draw(root, { start = 0, narrow = false } = {}) {
  const plan = narrow ? TALL : WIDE;
  const stage = svg("svg", {
    class: narrow ? "art scene-art tall" : "art scene-art",
    viewBox: `0 0 ${plan.width} ${plan.height}`,
    "aria-hidden": "true",
    focusable: "false",
  });
  const lines = svg("g", { class: "scene-lines" });
  const words = svg("g", { class: "scene-words" });
  stage.append(lines, words);
  stage.style.setProperty("--pen", plan.pen);
  root.querySelector(".scene-art")?.remove();
  root.prepend(stage);
  const pen = makePen(lines);
  const at = (cue) => {
    pen.now = start + cue;
  };

  // The floor they all stand on.
  at(CUE.ground);
  const edge = plan.width * 0.02;
  const floor = plan.ground + plan.pen * 0.8;
  pen.stroke(sketch.line(edge, floor, plan.decliner.x + plan.width * 0.07, floor, { seed: 41, rough: plan.pen * 0.8, passes: 1 }), "ground", 650);

  // Two officers, and what they call out.
  at(CUE.officers);
  const officers = plan.officers.map((spec, index) => {
    const drawn = person(pen, spec, plan.ground, 110 + index * 20);
    pen.now -= 80;
    return drawn;
  });
  ticket(lines, pen, officers[1].hands.right, plan.officers[1].height * 0.1, 160);
  at(CUE.call);
  speech(words, pen, plan.call, officers[0], 170);

  // The members who are coming, each a little after the one before.
  plan.members.forEach((spec, index) => {
    at(CUE.members + index * 430);
    const drawn = person(pen, spec, plan.ground, 210 + index * 20);
    if (spec.says) {
      pen.now -= 150;
      speech(words, pen, spec.says, drawn, 270 + index * 10);
    }
  });

  // The one who isn't, drawn a little more slowly.
  at(CUE.decliner);
  const decliner = person(pen, plan.decliner, plan.ground, 310, 1.25);
  at(CUE.sorry);
  speech(words, pen, plan.sorry, decliner, 330);

  // After a pause, the other pen: an arrow, and what was not said.
  at(CUE.truth);
  const { truth } = plan;
  const pointer = sketch.arrow(truth.from[0], truth.from[1], truth.to[0], truth.to[1], { seed: 350, head: truth.size * 0.42, rough: plan.pen * 0.4, bend: truth.bend });
  sketch.strokes(pointer).forEach((d, index) => pen.stroke(d, "truth-line", index === 0 ? 320 : 110, index === 0 ? 0.85 : 0.6));
  pen.now -= 60;
  words.append(letter(pen, TRUTH, {
    class: "said truth",
    x: truth.x,
    y: truth.y,
    "font-size": truth.size,
    "text-anchor": truth.anchor,
    transform: `rotate(${truth.turn} ${truth.x} ${truth.y})`,
  }, 120));
  return lines;
}
