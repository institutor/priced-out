// The six ways to lower the cost, ranked by the survey's trade-off question.
import { el, sentence } from "./dom.js";
import { voice } from "../lib/voice.js";

const signed = (score) => `${score > 0 ? "+" : score < 0 ? "−" : ""}${Math.abs(score).toFixed(2)}`;

// Scores can run from -1 to 1 but rarely get near either end, so the bars are
// drawn against the widest interval, rounded up to the next quarter.
function scaleOf(fixes) {
  const widest = Math.max(...fixes.flatMap((fix) => [Math.abs(fix.low), Math.abs(fix.high), Math.abs(fix.score)]));
  return Math.max(0.25, Math.ceil(widest * 4) / 4);
}

function row(fix, scale) {
  // The track runs from 0% to 100% with zero in the middle.
  const position = (score) => 50 + Math.max(-1, Math.min(1, score / scale)) * 50;
  const bar = el("span", { class: fix.score >= 0 ? "bar up" : "bar down" });
  bar.style.width = `${Math.abs(position(fix.score) - 50)}%`;
  const whisker = el("span", { class: "whisker" });
  whisker.style.left = `${position(fix.low)}%`;
  whisker.style.width = `${position(fix.high) - position(fix.low)}%`;

  const detail = `${fix.label}: score ${signed(fix.score)}, interval ${signed(fix.low)} to ${signed(fix.high)}.`;
  return el("li", { class: "bar-row" },
    el("span", { class: "bar-name", text: fix.label }),
    el("span", { class: "diverge", title: detail, role: "img", "aria-label": detail }, bar, whisker),
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
    el("ul", { class: "bar-list" }, ranked.map((fix) => row(fix, scale))),
    el("p", {
      class: "aside",
      text: `Score: how often an option was picked as most likely to help, minus how often as least likely, out of the times it was shown. It can run from −1 to +1; the bars here are drawn from ${signed(-scale)} to ${signed(scale)}. ${fixesN} ${say.many} answered. The thin line is the 95% interval.`,
    }),
  );
}
