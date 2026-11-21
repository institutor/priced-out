// "I will if you will": would members' own pledges cover the empty seats?
import { el, sentence } from "./dom.js";
import { drawnIn, ink, path, seat, seedOf, wipe } from "./ink.js";
import { swatch } from "./doodles.js";
import * as sketch from "../lib/sketch.js";

// How close the shading lines are for each round of pledges: the first to
// give are shaded darkest, each later round a little lighter.
const SHADING = [3.2, 5, 7.5, 11];
import { sharesAt } from "../lib/curve.js";
import { cascade, seatsCovered } from "../lib/pledge.js";
import { money, people } from "../lib/format.js";
import { voice } from "../lib/voice.js";

export function mount(root, dataset, state) {
  const { items, rows, rules } = dataset;
  const say = voice(dataset.meta);
  const pledges = rows.map((row) => row.pledge).filter((pledge) => Array.isArray(pledge));
  const willing = pledges.filter((pledge) => pledge[0] > 0);
  const conditional = willing.filter((pledge) => pledge[1] !== 0);

  function render({ itemId, price, size }) {
    wipe(root);
    const item = items.find((candidate) => candidate.id === itemId);
    const shares = sharesAt(rows, item, price);
    if (pledges.length < rules.minCell || shares.n < rules.minCell) {
      root.append(el("p", { class: "empty", text: "Not enough answers about pledges yet." }));
      return;
    }

    const left = people(shares.out, size);
    const payers = size - left;
    const outcome = cascade(pledges, payers);
    const covered = Math.min(left, seatsCovered(outcome.pool, price));

    root.append(el("p", {}, sentence(
      `${say.asked}: would you add a little to your own ticket so that a member who can't afford it could come? `,
      [`${willing.length} of ${pledges.length}`], " said yes. ",
      [conditional.length], " of them said only if enough other members did the same.",
    )));

    // Three different reasons the pledges can come to nothing.
    if (payers === 0) {
      root.append(el("p", { text: `At ${money(price)} nobody in a club of ${size} would be paying, so there is nobody to pledge.` }));
      return;
    }
    if (outcome.pledgers === 0) {
      const goFirst = willing.length - conditional.length;
      const why = goFirst === 0
        ? `${say.Nobody} said they would go first, so the pledges never start.`
        : `${goFirst} of ${pledges.length} said they would give no matter what, but among the ${payers} of your ${size} who would pay ${money(price)} that comes to less than one person, so the pledges never start.`;
      root.append(el("p", { text: why }));
      return;
    }

    // One bar for everyone who pays: each round of the cascade, then the rest.
    const bar = el("div", { class: "cascade", role: "img" });
    const key = el("ul", { class: "key" });
    let previous = 0;
    outcome.steps.forEach((total, index) => {
      const joined = total - previous;
      previous = total;
      if (joined <= 0) return;
      const gap = SHADING[Math.min(index, SHADING.length - 1)];
      const segment = el("span", {});
      segment.dataset.gap = gap;
      segment.style.flexGrow = joined;
      const label = index === 0 ? `${joined} give no matter what` : `${joined} more join once ${outcome.steps[index - 1]} have`;
      segment.title = label;
      bar.append(segment);
      key.append(el("li", {}, swatch(gap, 60 + index), label));
    });
    const rest = payers - outcome.pledgers;
    if (rest > 0) {
      const segment = el("span", { title: `${rest} add nothing` });
      segment.style.flexGrow = rest;
      bar.append(segment);
      key.append(el("li", {}, swatch(0, 70, "rest"), `${rest} add nothing`));
    }
    // The spans above set how wide each part is and carry its label. The
    // drawing follows them: an outline for each, shaded where people give.
    const parts = [...bar.children];
    ink(bar, (width, height) => parts.flatMap((part, index) => {
      const seed = seedOf(`pledge ${index}`);
      const outline = sketch.blob(part.offsetLeft, 2, part.offsetWidth, height - 4, { seed, rough: 0.7, round: 0.15 });
      if (!part.dataset.gap) return [path(outline, "round-line rest")];
      const shading = sketch.hatch(part.offsetLeft + 1, 3, part.offsetWidth - 2, height - 6, { seed: seed + 1, gap: Number(part.dataset.gap), rough: 0.7 });
      return [...drawnIn(shading, "round-fill", { from: index * 3 }), path(outline, "round-line")];
    }));
    bar.setAttribute("aria-label", `Of the ${payers} who would pay ${money(price)}, ${outcome.pledgers} would add to their ticket.`);
    root.append(
      el("p", {}, sentence(`Scaled to the ${payers} of your ${size} who would pay ${money(price)}, `, [outcome.pledgers], " would chip in:")),
      bar,
      key,
    );

    if (left === 0) {
      root.append(el("p", { text: `At ${money(price)} ${say.nobody} is left out, so there is nothing to cover.` }));
    } else {
      const tickets = el("div", {
        class: "tickets",
        role: "img",
        "aria-label": `${covered} of the ${left} empty seats are covered by pledges.`,
      });
      for (let index = 0; index < left; index++) {
        const kind = index < covered ? "stretched" : "out";
        tickets.append(el("span", { class: `seat ${kind}` }, seat(kind, 900 + index)));
      }
      root.append(
        tickets,
        el("p", {}, sentence(
          "Together that is about ", [money(outcome.pool)], ", which pays for ",
          [`${covered} of the ${left}`], ` seats that would otherwise sit empty at ${money(price)}.`,
        )),
      );
    }

    root.append(el("p", {
      class: "aside",
      text: `A pledge in a survey is a promise, not a payment. Amounts are what ${say.many} said they would add, and an answer of $10 or more is counted as $10.`,
    }));
  }

  state.subscribe(render);
  render(state.get());
}
