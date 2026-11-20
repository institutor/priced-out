// What it would take: the price that keeps nearly everyone in, and what an
// access price would bring back.
import { el, clear, sentence } from "./dom.js";
import { sharesAt, maxPriceFor, accessTier } from "../lib/curve.js";
import { money, people } from "../lib/format.js";
import { phrase } from "./priceCheck.js";

export function mount(root, dataset, state) {
  const { items, rows, rules } = dataset;

  function render({ itemId, price, size }) {
    clear(root);
    const item = items.find((candidate) => candidate.id === itemId);
    const shares = sharesAt(rows, item, price);
    if (shares.n < rules.minCell) {
      root.append(el("p", { class: "empty", text: "Not enough answers for this item yet." }));
      return;
    }

    const statements = el("div", { class: "statements" });

    const gentle = maxPriceFor(rows, item, 0.1);
    if (gentle === null) {
      statements.append(
        el("div", { class: "statement" },
          el("span", { class: "figure", text: "$0" }),
          el("p", { text: `Even free, more than 1 in 10 said they would skip a ${phrase(item)}. Price is not the only thing in the way.` }),
        ),
      );
    } else {
      const where = gentle >= price ? `At ${money(price)} you are inside that.` : `You are at ${money(price)}.`;
      statements.append(
        el("div", { class: "statement" },
          el("span", { class: "figure", text: money(gentle) }),
          el("p", { text: `is the most a ${phrase(item)} can cost and still lose no more than 1 in 10. ${where}` }),
        ),
      );
    }

    const tier = accessTier(rows, item, price);
    if (tier) {
      const back = people(tier.regained, size);
      const added = back * tier.accessPrice;
      statements.append(
        el("div", { class: "statement" },
          el("span", { class: "figure", text: money(tier.accessPrice) }),
          el("p", {}, sentence(
            "as an access price brings back about ", [back], ` of your ${size}. At ${money(price)} they were paying nothing, so that is about `,
            [money(added)], " more for the club, not less.",
          )),
        ),
      );
    } else {
      statements.append(
        el("div", { class: "statement" },
          el("span", { class: "figure", text: "No gap" }),
          el("p", { text: `At ${money(price)} almost nobody surveyed is left out, so an access price has nothing to fix.` }),
        ),
      );
    }

    root.append(
      statements,
      el("p", {
        class: "aside",
        text: "The access price is the highest price that loses no more than 1 in 20. The sum assumes people who can pay the full price still do. Whether they would depends on how the lower price is offered, which is the next question.",
      }),
    );
  }

  state.subscribe(render);
  render(state.get());
}
