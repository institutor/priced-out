// What it would take: the price that keeps nearly everyone in, and what an
// access price would bring back.
import { el, clear, sentence } from "./dom.js";
import { sharesAt, maxPriceFor, accessTier } from "../lib/curve.js";
import { money, people } from "../lib/format.js";
import { phrase } from "./priceCheck.js";

const ACCESS_TARGET = 0.05;

export function mount(root, dataset, state) {
  const { items, rows, rules } = dataset;

  const statement = (figure, ...text) =>
    el("div", { class: "statement" }, el("span", { class: "figure", text: figure }), el("p", {}, text));

  // The access price is the highest price that loses no more than 1 in 20.
  // There are four different things to say about it, and only one of them is
  // good news, so each case gets its own sentence.
  function accessStatement(item, price, size) {
    const accessPrice = maxPriceFor(rows, item, ACCESS_TARGET);
    if (accessPrice === null) {
      return statement("No price", `gets everyone in. Even free, more than 1 in 20 said they would skip a ${phrase(item)}, so for them the price is not the only thing in the way.`);
    }
    if (accessPrice >= price) {
      return statement("No gap", `to close here. At ${money(price)} no more than 1 in 20 surveyed are left out.`);
    }
    const tier = accessTier(rows, item, price, ACCESS_TARGET);
    const back = tier ? people(tier.regained, size) : 0;
    if (back === 0) {
      return statement(money(accessPrice), `is the access price, but in a club of ${size} the difference from ${money(price)} comes to less than one person.`);
    }
    if (accessPrice === 0) {
      return statement("Free", sentence(
        `is the only price at which no more than 1 in 20 skip it. Waiving the ${money(price)} for those who need it brings back about `,
        [back], ` of your ${size}, and costs the club nothing it was getting.`,
      ));
    }
    return statement(money(accessPrice), sentence(
      "as an access price brings back about ", [back], ` of your ${size}. At ${money(price)} they were paying nothing, so that is about `,
      [money(back * accessPrice)], " more for the club, not less.",
    ));
  }

  function render({ itemId, price, size }) {
    clear(root);
    const item = items.find((candidate) => candidate.id === itemId);
    const shares = sharesAt(rows, item, price);
    if (shares.n < rules.minCell) {
      root.append(el("p", { class: "empty", text: "Not enough answers for this item yet." }));
      return;
    }

    const gentle = maxPriceFor(rows, item, 0.1);
    let gentleStatement = statement("No price", `keeps 9 in 10. Even free, more than 1 in 10 said they would skip a ${phrase(item)}.`);
    if (gentle !== null) {
      const where = gentle >= price ? `At ${money(price)} you are inside that.` : `You are at ${money(price)}.`;
      gentleStatement = statement(money(gentle), `is the most a ${phrase(item)} can cost and still lose no more than 1 in 10. ${where}`);
    }

    root.append(
      el("div", { class: "statements" }, gentleStatement, accessStatement(item, price, size)),
      el("p", {
        class: "aside",
        text: "The access price is the highest price that loses no more than 1 in 20. The sum assumes people who can pay the full price still do. Whether they would depends on how the lower price is offered, which is the next question.",
      }),
    );
  }

  state.subscribe(render);
  render(state.get());
}
