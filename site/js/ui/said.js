// What priced-out students said at the time, and how far everyone's guess was
// from the survey's own answer.
//
// These are totals among students who skipped something over cost. They say
// what such students told people; they say nothing about how likely any one
// person's "I'm busy" is to be about money.
import { el, svg, sentence } from "./dom.js";
import { drawnIn, ink, path, seedOf } from "./ink.js";
import * as sketch from "../lib/sketch.js";
import { sharesAt } from "../lib/curve.js";
import { voice } from "../lib/voice.js";

function saidBars(said) {
  const ranked = [...said.options].sort((a, b) => b.count - a.count);
  const longest = Math.max(1, ranked[0].count);
  return el("ul", { class: "bar-list" }, ranked.map((option, order) => {
    const detail = `${option.label}: ${option.count} of ${said.n}`;
    const seed = seedOf(`said ${option.id}`);
    const track = el("span", { class: "track", title: detail, role: "img", "aria-label": detail });
    ink(track, (width, height) => {
      const length = Math.max(2, (option.count / longest) * width);
      return [
        drawnIn(sketch.hatch(0, 3, length, height - 6, { seed, gap: 4.5, rough: 0.8 }), "bar-hatch", { from: order * 2 }),
        path(sketch.blob(0, 3, length, height - 6, { seed: seed + 1, rough: 0.7, round: 0.15 }), "bar-line"),
        path(sketch.line(0, -5, 0, height + 5, { seed: seed + 2, rough: 0.6, passes: 1 }), "zero-line"),
      ];
    });
    return el("li", { class: "bar-row" },
      el("span", { class: "bar-name", text: option.label }),
      track,
      el("span", { class: "bar-value", text: `${option.count}` }),
    );
  }));
}

// One mark of the number line, drawn at (cx, cy): a dot for the survey's own
// answer, a diamond for a guess (hollow for the price-setters' guess).
function markShape(shape, cx, cy) {
  if (shape === "dot") {
    return svg("circle", { cx, cy, r: 6, fill: "var(--series)", stroke: "var(--paper)", "stroke-width": 2 });
  }
  const hollow = shape === "hollow";
  return svg("rect", {
    x: cx - 5, y: cy - 5, width: 10, height: 10, transform: `rotate(45 ${cx} ${cy})`,
    fill: hollow ? "var(--paper)" : "var(--mark-2)",
    stroke: hollow ? "var(--mark-2)" : "var(--paper)",
    "stroke-width": 2,
  });
}

// A line from 0 to 100 students. Each mark carries its number; the names are
// in the key underneath, so nothing has to fit beside a mark on a phone.
function numberLine(marks, interval) {
  const WIDTH = window.matchMedia("(max-width: 40rem)").matches ? 360 : 720;
  const LEFT = 16;
  const RIGHT = WIDTH - 16;
  const AXIS = 40;
  const x = (value) => LEFT + (value / 100) * (RIGHT - LEFT);
  const chart = svg("svg", {
    viewBox: `0 0 ${WIDTH} 96`,
    role: "img",
    "aria-label": marks.map((mark) => `${mark.label}: ${mark.value} out of 100`).join(". "),
  });
  chart.append(svg("line", { x1: x(0), x2: x(100), y1: AXIS, y2: AXIS, stroke: "var(--rule)", "stroke-width": 1 }));
  for (const tick of [0, 25, 50, 75, 100]) {
    chart.append(svg("text", { x: x(tick), y: AXIS + 44, "text-anchor": "middle", text: tick }));
  }
  chart.append(svg("line", {
    x1: x(interval.low), x2: x(interval.high), y1: AXIS, y2: AXIS,
    stroke: "var(--series)", "stroke-opacity": 0.3, "stroke-width": 8, "stroke-linecap": "round",
  }));
  for (const mark of marks) {
    // The survey's own answer is labelled above the line, guesses below it.
    const labelY = mark.shape === "dot" ? AXIS - 14 : AXIS + 24;
    chart.append(
      markShape(mark.shape, x(mark.value), AXIS),
      svg("text", { class: "label", x: x(mark.value), y: labelY, "text-anchor": "middle", text: mark.value }),
    );
  }

  const key = el("ul", { class: "key" }, marks.map((mark) => {
    const swatch = svg("svg", { viewBox: "0 0 16 16", width: 16, height: 16, "aria-hidden": "true" }, markShape(mark.shape, 8, 8));
    return el("li", {}, swatch, `${mark.label}: ${mark.value}`);
  }));
  return el("div", { class: "number-line" }, chart, key);
}

export function mount(root, dataset) {
  const { said, skipped, guess, rows, items, rules } = dataset;
  // Who the answers came from: students, a club's own members, or the
  // invented members of the made-up club.
  const who = voice(dataset.meta).many;

  // Under the minimum the counts are not in the dataset at all.
  const counted = skipped.n >= rules.minCell;
  const answered = counted ? skipped.n - skipped.preferNot : 0;
  const ever = counted ? skipped.once + skipped.several : 0;
  if (answered >= rules.minCell) {
    root.append(el("p", {}, sentence(
      [`${ever} of the ${answered}`],
      ` ${who} who answered said they had skipped a club event, or decided not to join a club, mainly because of the cost.`,
      skipped.several >= rules.minCell ? ` ${skipped.several} said it had happened several times.` : "",
    )));
  }

  if (said) {
    const truth = said.options.find((option) => option.id === "truth");
    root.append(
      el("p", {}, sentence(
        `${said.n} of them gave what they said at the time. `,
        [`${truth.count} said it was the cost.`],
        " They could pick more than one answer.",
      )),
      saidBars(said),
      el("p", {
        class: "aside",
        text: `This counts what ${who} who were priced out said. It cannot tell you why any one person says they are busy.`,
      }),
    );
  } else {
    root.append(el("p", { class: "empty", text: `Too few ${who} gave what they said at the time for it to be shown.` }));
  }

  const item = items.find((candidate) => candidate.id === guess.item);
  const actual = sharesAt(rows, item, guess.price);
  if (guess.all && actual.n >= rules.minCell) {
    const own = Math.round(actual.out * 100);
    const typical = Math.round(guess.all.median);
    const marks = [
      { shape: "dot", label: `From the ${who}' own prices`, value: own },
      { shape: "diamond", label: "Typical guess", value: typical },
    ];
    let split = `Too few ${who} who have set prices answered for their guesses to be shown separately.`;
    if (guess.officers && guess.others) {
      const officers = Math.round(guess.officers.median);
      marks.push({ shape: "hollow", label: "Guess from those who set prices", value: officers });
      split = `Those who have planned a paid event or set dues guessed ${officers}. Everyone else guessed ${Math.round(guess.others.median)}.`;
    }
    root.append(
      el("h3", { class: "subhead", text: "And what everyone guessed" }),
      el("p", {}, sentence(
        `The survey also asks: out of 100 Columbia students, how many would skip a $${guess.price} formal because of the price? The typical guess was `,
        [typical], `. Going by the prices these ${who} gave for themselves, it is `, [own], ". ", split,
      )),
      numberLine(marks, { low: Math.round(actual.outLow * 100), high: Math.round(actual.outHigh * 100) }),
      el("p", {
        class: "aside",
        text: `${guess.all.n} ${who} guessed. ${actual.n} gave their own price for a formal, and the pale band is the 95% interval around that figure.`,
      }),
    );
  }
}
