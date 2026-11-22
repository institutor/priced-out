// The drawing on the agent's title page, in the same hand as the one on the
// Priced Out title page. A club officer hands over a question. The agent
// writes down its guess and seals it in an envelope before it asks anyone.
// Then the members answer, and the note in the other pen says what the
// envelope is for. What the figures say is in the page as text as well.
import { svg } from "../js/ui/dom.js";
import * as sketch from "../js/lib/sketch.js";
import { letter, makePen, person, speech } from "../js/ui/scene.js";

export const NARROW = "(max-width: 44rem)";

// When each part starts, in milliseconds after the first stroke.
const CUE = { ground: 0, officer: 150, ask: 950, agent: 2000, envelope: 2900, guess: 3250, members: 4500, truth: 6350 };
export const LASTS = 7300;

const OFFICER = { look: 0.9, left: "pocket", right: "hold", mouth: "open" };
const AGENT = { look: 0.9, left: "down", right: "hold" };
const MEMBER = { look: -0.9 };
const TRUTH = "(nobody guessed that)";

const WIDE = {
  width: 1130,
  height: 322,
  ground: 298,
  pen: 2.8,
  officer: { ...OFFICER, x: 74, height: 150 },
  ask: { lines: ["What event should", "our club put on?"], size: 27, centre: 168, top: 10 },
  agent: { ...AGENT, x: 408, height: 142 },
  guess: { lines: ["I'll ask them. First,", "my guess goes in here."], size: 23, centre: 488, top: 34 },
  members: [
    { ...MEMBER, x: 712, height: 136, left: "up", right: "down", mouth: "open", says: { lines: ["Trivia night!"], size: 23, centre: 690, top: 76 } },
    { ...MEMBER, x: 796, height: 148, left: "down", right: "wave" },
    { ...MEMBER, x: 880, height: 132, left: "pocket", right: "neck", mouth: "open", says: { lines: ["Only if it's free."], size: 23, centre: 912, top: 60 } },
  ],
  end: 960,
  truth: { size: 28, x: 1126, y: 38, anchor: "end", turn: -3, from: [1096, 52], to: [1014, 86], bend: -0.25 },
};

const TALL = {
  width: 360,
  height: 270,
  ground: 206,
  pen: 2,
  officer: { ...OFFICER, x: 30, height: 86 },
  ask: { lines: ["What event should", "our club put on?"], size: 15, centre: 68, top: 62 },
  agent: { ...AGENT, x: 150, height: 82 },
  guess: { lines: ["First, my guess", "goes in here."], size: 14, centre: 178, top: 14 },
  members: [
    { ...MEMBER, x: 262, height: 80, left: "up", right: "down", mouth: "open" },
    { ...MEMBER, x: 316, height: 76, left: "pocket", right: "neck", mouth: "open", says: { lines: ["Only if", "it's free."], size: 14, centre: 306, top: 70 } },
  ],
  end: 350,
  truth: { size: 20, x: 352, y: 256, anchor: "end", turn: -3, from: [240, 238], to: [296, 214], bend: -0.3 },
};

// An aerial on the agent's head, so it is plainly not one of the members.
export function aerial(pen, head, height, seed) {
  const top = [head.x + height * 0.02, head.y - head.r - height * 0.1];
  pen.stroke(sketch.line(head.x, head.y - head.r * 0.96, top[0], top[1], { seed, rough: height * 0.006, passes: 1 }), "figure-line", 110);
  pen.stroke(sketch.ellipse(top[0], top[1] - height * 0.022, height * 0.022, height * 0.022, { seed: seed + 1, rough: height * 0.003, steps: 8, overlap: 0.1 }), "figure-line", 110);
}

// The envelope in the agent's hand: coloured in, a flap, and a wax seal.
function envelope(lines, pen, hand, size, seed) {
  const width = size * 1.55;
  const x = hand[0] - width * 0.28;
  const y = hand[1] - size * 1.02;
  const fill = svg("path", { d: sketch.blob(x, y, width, size, { seed, rough: size * 0.03, round: 0.12 }), class: "ticket-fill" });
  fill.style.setProperty("--wait", `${Math.round(pen.now + 150)}ms`);
  lines.append(fill);
  for (const d of sketch.strokes(sketch.rect(x, y, width, size, { seed: seed + 1, rough: size * 0.035, passes: 1, over: size * 0.08 }))) pen.stroke(d, "figure-line", 70, 0.6);
  pen.stroke(sketch.polyline([[x + 1, y + 1], [x + width / 2, y + size * 0.58], [x + width - 1, y + 1]], { seed: seed + 2, rough: size * 0.03, passes: 1 }), "figure-line", 140);
  const seal = svg("path", { d: sketch.blob(x + width / 2 - size * 0.16, y + size * 0.42, size * 0.32, size * 0.32, { seed: seed + 3, rough: size * 0.02, round: 0.5 }), class: "seal-fill" });
  seal.style.setProperty("--wait", `${Math.round(pen.now + 80)}ms`);
  lines.append(seal);
}

// Draws the scene into `root`, timed from `start` milliseconds, in place of
// any drawing of it that is already there. Returns the group of lines, which
// the title page sets shivering once the drawing is done.
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

  at(CUE.ground);
  const floor = plan.ground + plan.pen * 0.8;
  pen.stroke(sketch.line(plan.width * 0.02, floor, plan.end, floor, { seed: 43, rough: plan.pen * 0.8, passes: 1 }), "ground", 650);

  // The officer, and the question they hand over.
  at(CUE.officer);
  const officer = person(pen, plan.officer, plan.ground, 410);
  at(CUE.ask);
  speech(words, pen, plan.ask, officer, 430);

  // The agent, its envelope, and what it says it will do first.
  at(CUE.agent);
  const agent = person(pen, plan.agent, plan.ground, 450);
  aerial(pen, agent.head, plan.agent.height, 470);
  at(CUE.envelope);
  envelope(lines, pen, agent.hands.right, plan.agent.height * 0.17, 480);
  at(CUE.guess);
  speech(words, pen, plan.guess, agent, 490);

  // The members, and what two of them say.
  plan.members.forEach((spec, index) => {
    at(CUE.members + index * 430);
    const drawn = person(pen, spec, plan.ground, 510 + index * 20);
    if (spec.says) {
      pen.now -= 150;
      speech(words, pen, spec.says, drawn, 570 + index * 10);
    }
  });

  // The other pen: an arrow at the answer nobody saw coming.
  at(CUE.truth);
  const { truth } = plan;
  const pointer = sketch.arrow(truth.from[0], truth.from[1], truth.to[0], truth.to[1], { seed: 650, head: truth.size * 0.42, rough: plan.pen * 0.4, bend: truth.bend });
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
