// "I will if you will": would members' own pledges cover the empty seats?
import { el, sentence } from "./dom.js";
import { circled, drawnIn, ink, path, seat, seedOf, wipe } from "./ink.js";
import * as sketch from "../lib/sketch.js";
import { sharesAt } from "../lib/curve.js";
import { cascade, seatsCovered } from "../lib/pledge.js";
import { money, people } from "../lib/format.js";
import { voice } from "../lib/voice.js";

// How close the shading lines are for each round of pledges: the first to
// give are shaded darkest, each later round a little lighter.
const SHADING = [3.2, 5, 7.5, 11];

// One round of the cascade: how many, what they said, and a bar. The longest
// bar is the biggest group and the rest are drawn against it. People who add
// nothing get an empty bar.
function round({ count, lead, label, share, gap, order }) {
  const seed = seedOf(`pledge ${order}`);
  const bar = el("span", { class: "round-bar", "aria-hidden": "true" });
  ink(bar, (width, height) => {
    const length = Math.max(6, share * width);
    const outline = sketch.blob(0, 3, length, height - 6, { seed, rough: 0.7, round: 0.15 });
    if (!gap) return [path(outline, "round-line rest")];
    const shading = sketch.hatch(1, 4, length - 2, height - 8, { seed: seed + 1, gap, rough: 0.7 });
    return [...drawnIn(shading, "round-fill", { from: order * 3 }), path(outline, "round-line")];
  });
  return el("li", { class: gap ? "round" : "round rest" },
    el("span", { class: "round-count", text: `${lead}${count}` }),
    el("span", { class: "round-label", text: label }),
    bar,
  );
}

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

    // Who chips in, a round at a time: those who give anyway, then everyone
    // who was waiting for that many, and so on, then those who add nothing.
    const rest = payers - outcome.pledgers;
    const joins = outcome.steps.map((total, index) => total - (outcome.steps[index - 1] ?? 0));
    const biggest = Math.max(rest, ...joins);
    const rounds = el("ol", { class: "rounds" });
    joins.forEach((joined, index) => {
      if (joined <= 0) return;
      rounds.append(round({
        count: joined,
        lead: index === 0 ? "" : "+",
        label: index === 0 ? "give no matter what" : `join once ${outcome.steps[index - 1]} have`,
        share: joined / biggest,
        gap: SHADING[Math.min(index, SHADING.length - 1)],
        order: index,
      }));
    });
    if (rest > 0) {
      rounds.append(round({ count: rest, lead: "", label: "add nothing", share: rest / biggest, gap: 0, order: joins.length }));
    }
    const who = el("div", {},
      // Nobody pays for something that is free, so there they are the ones who go.
      el("p", {}, sentence(`Among the ${payers} of your ${size} who would ${price > 0 ? `pay ${money(price)}` : "go"}, `, [outcome.pledgers], " would chip in:")),
      rounds,
    );

    // What that adds up to, and how many of the empty seats it fills.
    const pot = el("div", { class: "statement" }, circled(el("span", { class: "figure", text: money(outcome.pool) }), "pot"));
    if (left === 0) {
      pot.append(el("p", { text: `is what they would add between them. At ${money(price)} ${say.nobody} is left out, so there is nothing to cover.` }));
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
      const pays = covered === 0
        ? [`is what they would add between them. That is less than one ticket at ${money(price)}, so none of the ${left} seats that would otherwise sit empty is covered.`]
        : sentence(
          "is what they would add between them. It pays for ", [`${covered} of the ${left}`],
          ` seats that would otherwise sit empty at ${money(price)}.`,
        );
      pot.append(el("p", {}, pays), tickets);
    }

    root.append(
      el("div", { class: "pledge-layout" }, who, pot),
      el("p", {
        class: "aside",
        text: `A pledge in a survey is a promise, not a payment. Amounts are what ${say.many} said they would add, and an answer of $10 or more is counted as $10.`,
      }),
    );
  }

  state.subscribe(render);
  render(state.get());
}
