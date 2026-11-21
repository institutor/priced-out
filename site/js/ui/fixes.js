// The six ways to lower the cost, ranked by the survey's trade-off question.
import { el, sentence } from "./dom.js";
import { art, drawnIn, ink, marked, path, seedOf } from "./ink.js";
import * as sketch from "../lib/sketch.js";
import { voice } from "../lib/voice.js";
import { asksFor } from "../lib/asks.js";

const signed = (score) => `${score > 0 ? "+" : score < 0 ? "−" : ""}${Math.abs(score).toFixed(2)}`;

// Scores can run from -1 to 1 but rarely get near either end, so the bars are
// drawn against the widest interval, rounded up to the next quarter.
function scaleOf(fixes) {
  const widest = Math.max(...fixes.flatMap((fix) => [Math.abs(fix.low), Math.abs(fix.high), Math.abs(fix.score)]));
  return Math.max(0.25, Math.ceil(widest * 4) / 4);
}

// Which way the scale runs, said once above the bars: a small arrow and a
// few words at each end.
function ends() {
  const pointer = (seed, flip) => art("end-arrow", 30, 14, path(
    flip
      ? sketch.arrow(27, 7, 3, 7, { seed, head: 6, rough: 0.5, bend: 0.06 })
      : sketch.arrow(3, 7, 27, 7, { seed, head: 6, rough: 0.5, bend: 0.06 }),
  ));
  return el("li", { class: "bar-row fix bar-ends", "aria-hidden": "true" },
    el("span", { class: "scale-ends" },
      el("span", {}, pointer(51, true), "least likely to go"),
      el("span", {}, "most likely to go", pointer(52, false)),
    ),
  );
}

function row(fix, scale, order, best) {
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
    ];
  });

  // The option that came out on top is gone over with the highlighter.
  const name = el("span", { class: "bar-name", text: fix.label });
  return el("li", { class: "bar-row fix" },
    el("div", { class: "bar-what" },
      best ? marked(name, `fix ${fix.label}`) : name,
      el("p", { class: "bar-detail", text: fix.detail }),
    ),
    track,
    el("span", { class: "bar-value", text: signed(fix.score) }),
  );
}

// The other half of the choice: what each way takes to run, and its catch.
// These lines are written by hand, not worked out from answers, and the
// block says so.
function asksBlock(ranked) {
  const asks = asksFor(ranked);
  if (asks.length === 0) return null;
  const part = (kind, text) => el("p", {}, el("span", { class: "ask-kind", text: `${kind} ` }), text);
  return el("div", { class: "asks" },
    el("h3", { class: "sub", text: "What each one asks of you" }),
    el("p", { text: "The ranking is the members' side of it. This is the treasurer's: what each way takes to run, and its catch. These lines describe how each one works. They are not answers from the survey." }),
    el("dl", { class: "asks-list" }, asks.map((ask) => el("div", { class: "ask" },
      el("dt", { text: ask.label }),
      el("dd", {}, part("To run it.", ask.run), part("The catch.", ask.snag)),
    ))),
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

  // A single winner is marked. A tie at the top is not.
  const best = top.length === 1 ? top[0] : null;
  const list = el("ul", { class: "bar-list fixes" }, ends(), ranked.map((fix, order) => row(fix, scale, order, fix === best)));
  // Zero is one pen line down the whole chart, through the middle of the
  // bars' column. On a narrow screen each bar sits under its own name, and
  // a line down the chart would run through the words, so there each bar
  // gets a short stroke of its own.
  ink(list, (width, height) => {
    const tracks = [...list.querySelectorAll(".diverge")];
    const head = list.querySelector(".bar-ends");
    if (tracks.length === 0 || !head) return [];
    const seed = seedOf("fixes zero");
    const zero = tracks[0].offsetLeft + tracks[0].offsetWidth / 2;
    const what = tracks[0].previousElementSibling;
    const stacked = tracks[0].offsetLeft < what.offsetLeft + what.offsetWidth - 1;
    if (!stacked) {
      const from = head.offsetTop + head.offsetHeight - 2;
      return path(sketch.line(zero, from, zero, height + 6, { seed, rough: 1.2, passes: 2 }), "zero-line");
    }
    return tracks.map((track, index) => path(
      sketch.line(zero, track.offsetTop - 5, zero, track.offsetTop + track.offsetHeight + 5, { seed: seed + index, rough: 0.6, passes: 1 }),
      "zero-line",
    ));
  });

  root.append(
    el("p", {},
      `A lower price only helps if people will take it. ${say.shown} six ways a club could offer one and asked which would make them most and least likely to still go. `,
      outcome,
    ),
    list,
    el("p", {
      class: "aside",
      text: `Score: how often an option was picked as most likely to help, minus how often as least likely, out of the times it was shown. It can run from −1 to +1; the bars here are drawn from ${signed(-scale)} to ${signed(scale)}. ${fixesN} ${say.many} answered. The thin line across each bar is the 95% interval.`,
    }),
  );
  const asks = asksBlock(ranked);
  if (asks) root.append(asks);
}
