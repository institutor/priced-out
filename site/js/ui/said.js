// What priced-out students said at the time, and how far everyone's guess was
// from the survey's own answer.
//
// These are totals among students who skipped something over cost. They say
// what such students told people; they say nothing about how likely any one
// person's "I'm busy" is to be about money.
import { el, svg, sentence } from "./dom.js";
import { sharesAt } from "../lib/curve.js";

function saidBars(said) {
  const ranked = [...said.options].sort((a, b) => b.count - a.count);
  const longest = Math.max(1, ranked[0].count);
  return el("ul", { class: "bar-list" }, ranked.map((option) => {
    const bar = el("span", { class: "simple-bar" });
    bar.style.width = `${(option.count / longest) * 100}%`;
    const detail = `${option.label}: ${option.count} of ${said.n}`;
    return el("li", { class: "bar-row" },
      el("span", { class: "bar-name", text: option.label }),
      el("span", { class: "track", title: detail, role: "img", "aria-label": detail }, bar),
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

  const answered = skipped.n - skipped.preferNot;
  const ever = skipped.once + skipped.several;
  if (answered >= rules.minCell) {
    root.append(el("p", {}, sentence(
      [`${ever} of the ${answered}`],
      " students who answered said they had skipped a club event, or decided not to join a club, mainly because of the cost.",
      skipped.several >= rules.minCell ? ` ${skipped.several} said it had happened several times.` : "",
    )));
  }

  if (said) {
    const truth = said.options.find((option) => option.id === "truth");
    root.append(
      el("p", {}, sentence(
        `${said.n} of them told us what they said at the time. `,
        [`${truth.count} said it was the cost.`],
        " They could pick more than one answer.",
      )),
      saidBars(said),
      el("p", {
        class: "aside",
        text: "This counts what students who were priced out said. It cannot tell you why any one person says they are busy.",
      }),
    );
  } else {
    root.append(el("p", { class: "empty", text: "Too few students told us what they said at the time for it to be shown." }));
  }

  const item = items.find((candidate) => candidate.id === guess.item);
  const actual = sharesAt(rows, item, guess.price);
  if (guess.all && actual.n >= rules.minCell) {
    const own = Math.round(actual.out * 100);
    const typical = Math.round(guess.all.median);
    const marks = [
      { shape: "dot", label: "Their own answers", value: own },
      { shape: "diamond", label: "Typical guess", value: typical },
    ];
    let split = "Too few students who have set prices answered for their guesses to be shown separately.";
    if (guess.officers && guess.others) {
      const officers = Math.round(guess.officers.median);
      marks.push({ shape: "hollow", label: "Guess from students who set prices", value: officers });
      split = `Students who have planned a paid event or set dues guessed ${officers}. Everyone else guessed ${Math.round(guess.others.median)}.`;
    }
    root.append(
      el("h3", { class: "subhead", text: "And what everyone guessed" }),
      el("p", {}, sentence(
        `We also asked: out of 100 Columbia students, how many would skip a $${guess.price} formal because of the price? The typical guess was `,
        [typical], ". Going by the same students' own answers, it is ", [own], ". ", split,
      )),
      numberLine(marks, { low: Math.round(actual.outLow * 100), high: Math.round(actual.outHigh * 100) }),
      el("p", { class: "aside", text: `${guess.all.n} students guessed. The pale band is the 95% interval around their own answers.` }),
    );
  }
}
