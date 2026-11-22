// The drawings on the agent's page: the envelope, the pink slip a paid step
// prints, the stamp, the marks on the scoreboard and the line that shows the
// money going. All of it is drawn with js/lib/sketch.js, in the same hand as
// the rest of the site.
import { el, svg } from "../js/ui/dom.js";
import { art, drawnIn, ink, path, redrawAll, seedOf } from "../js/ui/ink.js";
import * as sketch from "../js/lib/sketch.js";

// The envelope. Sealed, it has a wax seal on its flap. Open, the flap is up
// and one slip stands in it for each guess that was sealed.
export function envelope({ open = false, slips = [], seed = 7 } = {}) {
  const parts = [];
  let from = 0;
  const pen = (d, className) => {
    const drawn = drawnIn(d, className, { from });
    from += drawn.length;
    parts.push(...drawn);
  };
  if (open) {
    pen(sketch.line(12, 74, 120, 10, { seed: seed + 5, rough: 1.2, passes: 1 }), "m-env-flap");
    pen(sketch.line(120, 10, 228, 74, { seed: seed + 6, rough: 1.2, passes: 1 }), "m-env-flap");
    const width = 66;
    const gap = 8;
    const left = 120 - (slips.length * width + (slips.length - 1) * gap) / 2;
    slips.forEach((name, index) => {
      const x = left + index * (width + gap);
      const y = 26 + (index % 2) * 7;
      parts.push(path(sketch.blob(x, y, width, 70, { seed: seed + 20 + index, rough: 0.8, round: 0.06 }), "m-env-slip"));
      pen(sketch.rect(x, y, width, 70, { seed: seed + 30 + index, rough: 0.9, passes: 1, over: 1 }), "m-env-line thin");
      parts.push(svg("text", { class: "m-env-name", x: x + width / 2, y: y + 22, "text-anchor": "middle", text: name }));
    });
  }
  parts.push(path(sketch.blob(10, 72, 220, 96, { seed, rough: 1.4, round: 0.05 }), "m-env-fill"));
  pen(sketch.rect(10, 72, 220, 96, { seed: seed + 1, rough: 1.6, passes: 2, over: 3 }), "m-env-line");
  if (open) {
    pen(sketch.line(12, 166, 120, 114, { seed: seed + 2, rough: 1, passes: 1 }), "m-env-line");
    pen(sketch.line(120, 114, 228, 166, { seed: seed + 8, rough: 1, passes: 1 }), "m-env-line");
  } else {
    pen(sketch.line(12, 74, 120, 132, { seed: seed + 2, rough: 1, passes: 1 }), "m-env-line");
    pen(sketch.line(120, 132, 228, 74, { seed: seed + 8, rough: 1, passes: 1 }), "m-env-line");
    parts.push(path(sketch.blob(104, 114, 32, 32, { seed: seed + 3, rough: 1.2, round: 0.5 }), "m-env-seal"));
    pen(sketch.ellipse(120, 130, 9, 9, { seed: seed + 4, rough: 0.7, steps: 10 }), "m-env-line thin");
  }
  return art(open ? "m-envelope open" : "m-envelope", 240, 176, parts);
}

// A slip torn off a roll, pink: what a paid step prints before it pays.
export function slip(node, name) {
  const seed = seedOf(`slip ${name}`);
  node.classList.add("m-slip");
  ink(node, (width, height) => path(sketch.slip(1.5, 4, width - 3, height - 8, { seed, tooth: 11, depth: 5, rough: 0.7 }), "slip pink"));
  return node;
}

// A rubber stamp: a word in a box, pressed on a little crooked.
export function stamp(text, name = text) {
  const seed = seedOf(`stamp ${name}`);
  const node = el("span", { class: "m-stamp", text });
  ink(node, (width, height) => [
    ...drawnIn(sketch.rect(2, 2, width - 4, height - 4, { seed, rough: 1.5, passes: 2, over: 2 }), "m-stamp-line"),
  ], { over: true });
  return node;
}

// A mark for one guess on the scoreboard, with the word beside it.
const MARKS = {
  right: (seed) => [sketch.check(1, 1, 20, { seed, rough: 0.7 })],
  wrong: (seed) => [
    sketch.line(4, 4, 18, 18, { seed, rough: 0.8, passes: 1 }),
    sketch.line(18, 4, 4, 18, { seed: seed + 1, rough: 0.8, passes: 1 }),
  ],
  partly: (seed) => [sketch.polyline([[3, 13], [8, 8], [14, 14], [19, 9]], { seed, rough: 0.5, passes: 1 })],
};

export function verdict(text, seed = 1) {
  const kind = MARKS[text] ? text : "none";
  const drawing = MARKS[text]
    ? art("m-verdict-art", 22, 22, MARKS[text](seed).map((d) => path(d)))
    : art("m-verdict-art", 22, 22, path(sketch.line(6, 11, 16, 11, { seed, rough: 0.5, passes: 1 })));
  return el("span", { class: `m-verdict ${kind}` }, drawing, el("span", { text: text ?? "no guess" }));
}

// A number with a loop of pen round it.
export function numbered(n, name = `m-step ${n}`) {
  const node = el("span", { class: "step-n", "aria-hidden": "true", text: String(n) });
  const seed = seedOf(name);
  ink(node, (width, height) => path(
    sketch.ellipse(width / 2, height / 2, width / 2 + 1, height / 2 + 1, { seed, rough: 1.3, steps: 14 }),
    "step-ring",
  ));
  return node;
}

// A long box that is scribbled in as the money goes. `set(part)` takes how
// much of the budget is spent, from 0 to 1.
export function meter(name = "meter") {
  const seed = seedOf(name);
  const node = el("span", { class: "m-meter", "aria-hidden": "true" });
  let part = 0;
  ink(node, (width, height) => {
    const filled = Math.max(0, Math.min(1, part)) * (width - 8);
    return [
      filled > 3 ? path(sketch.hatch(4, 4, filled, height - 8, { seed: seed + 1, gap: 4, rough: 0.6 }), "m-meter-fill") : null,
      path(sketch.rect(2, 2, width - 4, height - 4, { seed, rough: 1, passes: 1, over: 2 }), "m-meter-line"),
    ];
  });
  node.set = (next) => {
    part = next;
    redrawAll(node.parentNode ?? document);
  };
  return node;
}

// An arrow from one card to the next. It points right; the stylesheet turns
// it to point down where the cards are stacked.
export function arrowTo(name) {
  const seed = seedOf(`arrow ${name}`);
  return art("m-arrow", 56, 40, drawnIn(sketch.arrow(4, 22, 50, 20, { seed, head: 11, rough: 1.1, bend: 0.2 }), "m-arrow-line"));
}

// A card with a pen outline and shading down one side, like a note pinned
// to the page.
export function card(node, name) {
  const seed = seedOf(`card ${name}`);
  node.classList.add("m-card");
  ink(node, (width, height) => [
    path(sketch.hatch(width - 8, 12, 6, height - 14, { seed: seed + 1, gap: 3.4, rough: 0.5 }), "note-shade"),
    path(sketch.hatch(12, height - 8, width - 14, 6, { seed: seed + 2, gap: 3.4, rough: 0.5 }), "note-shade"),
    path(sketch.rect(2, 2, width - 11, height - 11, { seed, rough: 1.3, passes: 2, over: 3 }), "note-edge"),
  ]);
  return node;
}

// The loop the agent runs, as a ring of five labels with arrows between
// them. One objective comes in at the top. The arrow that closes the ring,
// from "decides" back to "writes a survey", is the follow-up round, and is
// drawn in the other pen. The way out, to the answer, leaves at the bottom.
export function loop(seed = 3) {
  const WIDTH = 520;
  const HEIGHT = 380;
  const centre = [290, 244];
  // Where each label sits, going round.
  const spots = [[300, 88], [425, 178], [408, 340], [182, 340], [135, 190]];
  const names = ["writes a survey", "seals its guess", "sends it out", "opens the envelope", "decides"];
  const parts = [];
  let from = 0;
  const pen = (d, className) => {
    const drawn = drawnIn(d, className, { from });
    from += drawn.length;
    parts.push(...drawn);
  };
  const word = (text, x, y, className = "m-loop-word") => parts.push(svg("text", { class: className, x, y, "text-anchor": "middle", text }));
  const boxes = names.map((name, index) => {
    const [x, y] = spots[index];
    const width = name.length * 9.6 + 28;
    return { x, y, width, height: 38 };
  });

  // The objective comes in.
  word("one objective", boxes[0].x, 24, "m-loop-word soft");
  pen(sketch.arrow(boxes[0].x, 32, boxes[0].x, boxes[0].y - 24, { seed: seed + 40, head: 9, rough: 0.8, bend: 0.06 }), "m-loop-line");

  // The arrows round the ring. Each starts and ends a little way off the
  // labels it joins.
  boxes.forEach((box, index) => {
    const next = boxes[(index + 1) % boxes.length];
    const dx = next.x - box.x;
    const dy = next.y - box.y;
    const length = Math.hypot(dx, dy);
    const gap = (side) => Math.min(0.42, (Math.abs(dx) > Math.abs(dy) ? side.width / 2 + 10 : side.height / 2 + 12) / length);
    const a = gap(box);
    const b = gap(next);
    const again = index === boxes.length - 1;
    pen(sketch.arrow(box.x + dx * a, box.y + dy * a, next.x - dx * b, next.y - dy * b, { seed: seed + index, head: 10, rough: 1, bend: -0.16 }), again ? "m-loop-line round" : "m-loop-line");
  });

  // The labels, each on its own scrap of paper.
  boxes.forEach((box, index) => {
    parts.push(path(sketch.blob(box.x - box.width / 2, box.y - box.height / 2, box.width, box.height, { seed: seed + 10 + index, rough: 0.9, round: 0.12 }), "m-loop-paper"));
    pen(sketch.rect(box.x - box.width / 2, box.y - box.height / 2, box.width, box.height, { seed: seed + 20 + index, rough: 1.2, passes: 1, over: 2 }), "m-loop-line thin");
    word(names[index], box.x, box.y + 7);
  });

  // What the ring is for, in the middle.
  word("what it guessed wrong", centre[0], centre[1] - 6, "m-loop-word big");
  word("is what it asks next", centre[0], centre[1] + 22, "m-loop-word big");
  word("another round", 112, 120, "m-loop-word round");

  // The way out.
  const last = boxes[4];
  pen(sketch.arrow(last.x - last.width / 2 - 8, last.y + 6, 62, 256, { seed: seed + 50, head: 10, rough: 0.9, bend: -0.22 }), "m-loop-line");
  parts.push(...drawnIn(sketch.underline(12, 294, 112, { seed: seed + 51, rough: 1 }), "m-loop-line round", { from }));
  word("the answer", 62, 284, "m-loop-word big");
  return art("m-loop", WIDTH, HEIGHT, parts);
}
