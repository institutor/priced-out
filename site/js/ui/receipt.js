// The receipt for a year in the club: every line with the share of students
// lost at it, the total, and the share priced out of at least one line.
//
// Every figure on the slip is worked out over the same students: those who
// gave a price for every line that is ticked. Otherwise one line could show a
// bigger share than "at least one line" does.
import { el } from "./dom.js";
import { button, ink, path, perforation, seedOf, underlined } from "./ink.js";
import { tickBox } from "./doodles.js";
import * as sketch from "../lib/sketch.js";
import { sharesAt, outOfAny, answeredAll } from "../lib/curve.js";
import { money, pct } from "../lib/format.js";
import { maxPriceOf } from "./priceCheck.js";
import { voice } from "../lib/voice.js";

const START_PRICE = { dues: 30, formal: 45, trip: 180 };

export function mount(root, dataset, state) {
  const { items, rows, rules, meta } = dataset;
  const say = voice(meta);

  // The slip says where its numbers come from, because a printed copy or a
  // screenshot leaves the banner at the top of the page behind.
  let source = "Sample data: these numbers are generated, not real responses.";
  if (meta.kind === "real") {
    source = `From an anonymous survey of ${meta.n} Columbia and Barnard students.`;
  }
  if (meta.kind === "simulated") {
    source = `Simulated: these numbers come from ${meta.n} AI personas, not real students.`;
  }
  if (meta.loaded && meta.kind === "real") {
    source = `From an anonymous survey of ${meta.n} members of this club.`;
  }
  if (meta.loaded?.example) {
    source = `A made-up club: these ${meta.n} members were invented, and the numbers are not real responses.`;
  }

  // The slip is built once and then updated in place, so the box being typed
  // in keeps the cursor.
  const lines = items.map((item) => {
    const line = { item, on: true, price: START_PRICE[item.id] ?? item.step * 4 };
    line.toggle = el("input", {
      type: "checkbox",
      checked: true,
      onchange: (event) => {
        line.on = event.target.checked;
        update();
      },
    });
    line.input = el("input", {
      type: "number",
      inputMode: "numeric",
      min: 0,
      max: maxPriceOf(item),
      step: item.step,
      value: line.price,
      "aria-label": `Price of ${item.short.toLowerCase()} in dollars`,
      onchange: (event) => {
        const stepped = Math.round((Number(event.target.value) || 0) / item.step) * item.step;
        line.price = Math.min(maxPriceOf(item), Math.max(0, stepped));
        update();
      },
    });
    line.lost = el("span");
    line.node = el("div", { class: "receipt-line" },
      el("div", { class: "top" },
        el("label", {}, line.toggle, tickBox(seedOf(`tick ${item.id}`)), item.short),
        el("span", { class: "price" }, "$", underlined(line.input, `receipt ${item.id}`)),
      ),
      el("div", { class: "lost" }, el("span", { text: "lost at this line" }), line.lost),
    );
    return line;
  });

  const total = el("span");
  const anyLine = el("span");
  const note = el("p", { class: "receipt-note" });

  function update() {
    const active = lines.filter((line) => line.on);
    const base = answeredAll(rows, active.map((line) => line.item));
    const enough = active.length > 0 && base.length >= rules.minCell;

    for (const line of lines) {
      line.node.classList.toggle("off", !line.on);
      if (Number(line.input.value) !== line.price) line.input.value = line.price;
      line.lost.textContent = line.on && enough ? pct(sharesAt(base, line.item, line.price).out) : "–";
    }

    total.textContent = money(active.reduce((sum, line) => sum + line.price, 0));
    const any = outOfAny(base, active);
    anyLine.textContent = enough ? pct(any.share) : "–";
    if (enough) {
      // The slip is short on room, and for a simulated panel the line under
      // this one already says what the numbers are.
      const range = say.simulated ? "" : ` The true figure could be ${pct(any.low)} to ${pct(any.high)}.`;
      note.textContent = `Worked out from the ${base.length} ${say.many} who gave a price for every line.${range}`;
    } else if (active.length === 0) {
      note.textContent = "Tick a line to add it up.";
    } else {
      note.textContent = `Only ${base.length} ${say.many} gave a price for every line, and nothing is shown under ${rules.minCell}.`;
    }
  }

  // The line for whatever is being priced at the top of the page follows that
  // price, but only when it changes there. A price typed on the receipt stays
  // put while the club size or anything else changes.
  let seen = state.get();
  lines.find((line) => line.item.id === seen.itemId).price = seen.price;
  state.subscribe((next) => {
    const changed = next.itemId !== seen.itemId || next.price !== seen.price;
    seen = next;
    if (!changed) return;
    lines.find((line) => line.item.id === next.itemId).price = next.price;
    update();
  });
  update();

  // The slip is a sheet torn off at both ends, with a pen line round it and
  // torn lines across it.
  const rule = (name) => perforation(el("div", { class: "rule" }), `receipt ${name}`);
  const sheet = el("div", { class: "receipt" },
    el("h3", { text: "Your club" }),
    el("p", { class: "serial", text: "Member's copy" }),
    rule("top"),
    lines.map((line) => line.node),
    rule("middle"),
    el("div", { class: "total" }, el("span", { text: "A year in this club" }), total),
    el("div", { class: "total" }, el("span", { text: "Priced out of at least one line" }), anyLine),
    note,
    el("p", { class: "receipt-note", text: source }),
    rule("bottom"),
    el("p", { class: "sign-off", text: "The copy the treasurer never gets." }),
  );
  ink(sheet, (width, height) => path(
    sketch.slip(1, 1, width - 2, height - 2, { seed: seedOf("slip"), tooth: 13, depth: 7, rough: 0.8 }),
    "slip",
  ));

  root.append(
    el("div", { class: "receipt-layout" },
      el("div", { class: "receipt-copy" },
        el("p", { text: "Dues are rarely the whole price. Add up what a year in your club costs, and see who is gone by the end of it." }),
        el("p", { class: "aside", text: "Change a price, or untick a line to take it off. A person counts once, however many lines they are priced out of." }),
        button({ onclick: () => window.print() }, "Print this receipt"),
      ),
      sheet,
    ),
  );
}
