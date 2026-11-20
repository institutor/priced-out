// "I will if you will": would members' own pledges cover the empty seats?
import { el, clear, sentence } from "./dom.js";
import { sharesAt } from "../lib/curve.js";
import { cascade, seatsCovered } from "../lib/pledge.js";
import { money, people } from "../lib/format.js";

export function mount(root, dataset, state) {
  const { items, rows, rules } = dataset;
  const pledges = rows.map((row) => row.pledge).filter((pledge) => Array.isArray(pledge));
  const willing = pledges.filter((pledge) => pledge[0] > 0);
  const conditional = willing.filter((pledge) => pledge[1] !== 0);

  function render({ itemId, price, size }) {
    clear(root);
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
      "We asked: would you add a little to your own ticket so that a member who can't afford it could come? ",
      [`${willing.length} of ${pledges.length}`], " said yes. ",
      [conditional.length], " of them said only if enough other members did the same.",
    )));

    if (outcome.pledgers === 0) {
      root.append(el("p", { text: "In a club this size, nobody surveyed would go first, so the pledges never start." }));
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
      const segment = el("span", { class: `round-${Math.min(index + 1, 4)}` });
      segment.style.flexGrow = joined;
      const label = index === 0 ? `${joined} give no matter what` : `${joined} more join once ${outcome.steps[index - 1]} have`;
      segment.title = label;
      bar.append(segment);
      key.append(el("li", {}, el("span", { class: `swatch round-${Math.min(index + 1, 4)}` }), label));
    });
    const rest = payers - outcome.pledgers;
    if (rest > 0) {
      const segment = el("span", { class: "rest", title: `${rest} add nothing` });
      segment.style.flexGrow = rest;
      bar.append(segment);
      key.append(el("li", {}, el("span", { class: "swatch rest" }), `${rest} add nothing`));
    }
    bar.setAttribute("aria-label", `Of the ${payers} who would pay ${money(price)}, ${outcome.pledgers} would add to their ticket.`);
    root.append(
      el("p", {}, sentence(`Scaled to the ${payers} of your ${size} who would pay ${money(price)}, `, [outcome.pledgers], " would chip in:")),
      bar,
      key,
    );

    if (left === 0) {
      root.append(el("p", { text: `At ${money(price)} nobody surveyed is left out, so there is nothing to cover.` }));
    } else {
      const tickets = el("div", {
        class: "tickets",
        role: "img",
        "aria-label": `${covered} of the ${left} empty seats are covered by pledges.`,
      });
      for (let seat = 0; seat < left; seat++) tickets.append(el("span", { class: seat < covered ? "ticket covered" : "ticket" }));
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
      text: "A pledge in a survey is a promise, not a payment. Amounts are what students said they would add, and an answer of $10 or more is counted as $10.",
    }));
  }

  state.subscribe(render);
  render(state.get());
}
