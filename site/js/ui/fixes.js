// The six ways to lower the cost, ranked by the survey's trade-off question.
import { el, sentence } from "./dom.js";
import { drawnIn, ink, path, seedOf } from "./ink.js";
import * as sketch from "../lib/sketch.js";
import { voice } from "../lib/voice.js";

const signed = (score) => `${score > 0 ? "+" : score < 0 ? "−" : ""}${Math.abs(score).toFixed(2)}`;

// Scores can run from -1 to 1 but rarely get near either end, so the bars are
// drawn against the widest interval, rounded up to the next quarter.
function scaleOf(fixes) {
  const widest = Math.max(...fixes.flatMap((fix) => [Math.abs(fix.low), Math.abs(fix.high), Math.abs(fix.score)]));
  return Math.max(0.25, Math.ceil(widest * 4) / 4);
}

function row(fix, scale, order) {
  // The track runs from 0 to 1 with zero in the middle.
  const position = (score) => 0.5 + Math.max(-1, Math.min(1, score / scale)) * 0.5;
  const side = fix.score >= 0 ? "up" : "down";
  const seed = seedOf(`fix ${fix.id ?? fix.label}`);

  const detail = `${fix.label}: score ${signed(fix.score)}, interval ${signed(fix.low)} to ${signed(fix.high)}.`;
  const track = el("span", { class: "diverge", title: detail, role: "img", "aria-label": detail });
  ink(track, (width, height) => {
    const zero = width / 2;
    const end = position(fix.score) * width;
    const left = Math.min(zero, end);
    const length = Math.max(2, Math.abs(end - zero));
    const low = position(fix.low) * width;
    const high = position(fix.high) * width;
    const middle = height / 2;
    return [
      drawnIn(sketch.hatch(left, 3, length, height - 6, { seed, gap: 4.5, rough: 0.8 }), `bar-hatch ${side}`, { from: order * 2 }),
      path(sketch.blob(left, 3, length, height - 6, { seed: seed + 1, rough: 0.7, round: 0.15 }), `bar-line ${side}`),
      // The interval: a line with a short stroke across each end.
      path(
        sketch.line(low, middle, high, middle, { seed: seed + 2, rough: 0.5, passes: 1 })
          + sketch.line(low, middle - 5, low, middle + 5, { seed: seed + 3, rough: 0.4, passes: 1 })
          + sketch.line(high, middle - 5, high, middle + 5, { seed: seed + 4, rough: 0.4, passes: 1 }),
        "whisker-line",
      ),
      path(sketch.line(zero, -5, zero, height + 5, { seed: seed + 5, rough: 0.6, passes: 1 }), "zero-line"),
    ];
  });

  return el("li", { class: "bar-row" },
    el("span", { class: "bar-name", text: fix.label }),
    track,
    el("span", { class: "bar-value", text: signed(fix.score) }),
    el("p", { class: "bar-detail", text: fix.detail }),
  );
}

export function mount(root, dataset) {
  const { fixes, fixesN, rules } = dataset;
  const say = voice(dataset.meta);
  if (!fixes) {
    root.append(el("p", {
      class: "empty",
      text: `Not enough answers to rank the fixes yet: ${fixesN} so far, and nothing is shown under ${rules.minCell}.`,
    }));
    return;
  }
  const ranked = [...fixes].sort((a, b) => b.score - a.score);
  const scale = scaleOf(fixes);

  // Name every option that shares the top score, or the bottom one, so a tie
  // is never reported as a winner.
  const names = (list) => list.map((fix) => fix.label).join(" and ");
  const top = ranked.filter((fix) => fix.score === ranked[0].score);
  const bottom = ranked.filter((fix) => fix.score === ranked.at(-1).score);
  let outcome = ["No option stood out: all six scored the same."];
  if (top.length < ranked.length) {
    outcome = sentence(
      [names(top)], top.length > 1 ? " tied at the top. " : " came out on top. ",
      [names(bottom)], bottom.length > 1 ? " tied at the bottom." : " came last.",
    );
  }

  root.append(
    el("p", {},
      `A lower price only helps if people will take it. ${say.shown} six ways a club could offer one and asked which would make them most and least likely to still go. `,
      outcome,
    ),
    el("ul", { class: "bar-list" }, ranked.map((fix, order) => row(fix, scale, order))),
    el("p", {
      class: "aside",
      text: `Score: how often an option was picked as most likely to help, minus how often as least likely, out of the times it was shown. It can run from −1 to +1; the bars here are drawn from ${signed(-scale)} to ${signed(scale)}. ${fixesN} ${say.many} answered. The thin line is the 95% interval.`,
    }),
  );
}
