// The receipt for a year in the club: every line with the share of students
// lost at it, the total, and the share priced out of at least one line.
import { el, clear } from "./dom.js";
import { sharesAt, outOfAny } from "../lib/curve.js";
import { money, pct } from "../lib/format.js";
import { maxPriceOf } from "./priceCheck.js";

const START_PRICE = { dues: 30, formal: 45, trip: 180 };

export function mount(root, dataset, state) {
  const { items, rows, rules } = dataset;
  const lines = items.map((item) => ({ item, on: true, price: START_PRICE[item.id] ?? item.step * 4 }));
  const paper = el("div", { class: "receipt" });

  const shown = (share, n) => (n < rules.minCell ? "–" : pct(share));

  function render() {
    clear(paper);
    paper.append(
      el("h3", { text: "Your club" }),
      el("p", { class: "serial", text: "Member's copy" }),
      el("hr"),
    );
    for (const line of lines) {
      const shares = sharesAt(rows, line.item, line.price);
      const toggle = el("input", {
        type: "checkbox",
        checked: line.on,
        onchange: (event) => {
          line.on = event.target.checked;
          render();
        },
      });
      const price = el("input", {
        type: "number",
        inputMode: "numeric",
        min: 0,
        max: maxPriceOf(line.item),
        step: line.item.step,
        value: line.price,
        "aria-label": `Price of ${line.item.short.toLowerCase()} in dollars`,
        onchange: (event) => {
          const stepped = Math.round((Number(event.target.value) || 0) / line.item.step) * line.item.step;
          line.price = Math.min(maxPriceOf(line.item), Math.max(0, stepped));
          render();
        },
      });
      paper.append(
        el("div", { class: line.on ? "receipt-line" : "receipt-line off" },
          el("div", { class: "top" }, el("label", {}, toggle, line.item.short), el("span", { class: "price" }, "$", price)),
          el("div", { class: "lost" }, el("span", { text: "lost at this line" }), el("span", { text: shown(shares.out, shares.n) })),
        ),
      );
    }

    const active = lines.filter((line) => line.on);
    const any = outOfAny(rows, active);
    paper.append(
      el("hr"),
      el("div", { class: "total" },
        el("span", { text: "A year in this club" }),
        el("span", { text: money(active.reduce((sum, line) => sum + line.price, 0)) }),
      ),
      el("div", { class: "total" },
        el("span", { text: "Priced out of at least one line" }),
        el("span", { text: active.length === 0 ? "–" : shown(any.share, any.n) }),
      ),
    );
    if (active.length > 0 && any.n >= rules.minCell) {
      paper.append(el("p", {
        class: "receipt-note",
        text: `${any.n} students answered every line. The true figure could be ${pct(any.low)} to ${pct(any.high)}.`,
      }));
    }
    paper.append(el("hr"), el("p", { class: "sign-off", text: "The copy the treasurer never gets." }));
  }

  // The line for whatever is being priced above follows that price.
  state.subscribe(({ itemId, price }) => {
    const line = lines.find((candidate) => candidate.item.id === itemId);
    if (line.price === price) return;
    line.price = price;
    render();
  });
  const current = state.get();
  lines.find((candidate) => candidate.item.id === current.itemId).price = current.price;
  render();

  root.append(
    el("div", { class: "receipt-layout" },
      el("div", { class: "receipt-copy" },
        el("p", { text: "Dues are rarely the whole price. Add up what a year in your club costs, and see who is gone by the end of it." }),
        el("p", { class: "aside", text: "Change a price, or untick a line to take it off. A person counts once, however many lines they are priced out of." }),
        el("button", { class: "button", type: "button", text: "Print this receipt", onclick: () => window.print() }),
      ),
      paper,
    ),
  );
}
