// After the event: three counts from the treasurer, and what they come to
// beside what the answers said would happen. It follows the price and the
// club size set at the top of the page. What is typed here stays in these
// boxes: it is not kept, sent or put in the page's address.
import { el } from "./dom.js";
import { blank, wipe } from "./ink.js";
import { afterEvent } from "../lib/after.js";
import { standIn } from "../lib/announce.js";
import { money, pct } from "../lib/format.js";

const box = (label) => el("input", {
  class: "blank wide",
  type: "number",
  inputMode: "numeric",
  min: 0,
  step: 1,
  value: "",
  placeholder: "?",
  "aria-label": label,
});

// A whole number of people, or null for an empty or unusable box.
function countIn(input) {
  const text = input.value.trim();
  if (text === "") return null;
  const value = Number(text);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function afterBlock(dataset, state) {
  const lead = el("p", { class: "after-lead" });
  const full = box("How many paid the full price");
  const low = box("How many took the lower price");
  const before = box("How many paid before, when there was one price");
  const inputs = [full, low, before];

  // The sentence the boxes sit in. Its words change with the prices.
  const words = Array.from({ length: 3 }, () => document.createTextNode(""));
  const now = el("p", { class: "after-fill" }, "This time ", blank(full, "after full"), words[0], blank(low, "after low"), words[1]);
  const then = el("p", { class: "after-fill" }, words[2], blank(before, "after before"), " paid.");
  const hint = el("p", { class: "after-hint", text: "Leave that one empty if there was no before." });
  const form = el("div", { class: "after-form" }, now, then, hint);
  const out = el("div", { class: "after-out", role: "status" });
  const foot = el("p", {
    class: "aside",
    text: "One event is a first check, not proof. The date, the weather and the place move turnout too. What you type here is not kept or sent anywhere.",
  });
  const block = el("div", { class: "after" },
    el("h3", { class: "sub", text: "After the event, check it" }),
    lead, form, out, foot,
  );

  let showing = "";
  function render(view = state.get()) {
    const base = afterEvent(dataset, view);
    form.hidden = !base.offered;
    out.hidden = !base.offered;
    foot.hidden = !base.offered;
    if (!base.offered) {
      lead.textContent = `A survey is what people say. Who turns up is what they do. At ${money(view.price)} the page works out no second price, so there is nothing here to check yet.`;
      return;
    }

    // Counts typed for one price mean nothing at another.
    const key = `${view.itemId} ${base.price} ${base.lower}`;
    if (key !== showing) {
      showing = key;
      for (const input of inputs) input.value = "";
    }

    const lowerPaid = base.lower === 0 ? " came for free." : ` paid ${money(base.lower)}.`;
    words[0].textContent = ` paid ${money(base.price)} and `;
    words[1].textContent = lowerPaid;
    words[2].textContent = `Before, at ${money(base.price)} for everyone, `;

    const lowerName = base.lower === 0 ? "the free place" : `the ${money(base.lower)} price`;
    const standsIn = standIn(dataset.meta);
    lead.textContent = [
      "A survey is what people say. Who turns up is what they do, and it is the only check on these numbers.",
      `${base.whose} said about ${base.said.low} of every ${base.said.there} who come would take ${lowerName}, which is ${pct(base.said.share)}.`,
      "Once the event has happened, put in what you counted.",
      standsIn ? `Built on ${standsIn}, this shows how the check works.` : "",
    ].filter(Boolean).join(" ");

    const result = afterEvent(dataset, view, { full: countIn(full), low: countIn(low), before: countIn(before) });
    wipe(out);
    out.append(...result.lines.map((line) => el("p", { class: `after-line after-${line.key}`, text: line.text })));
  }

  for (const input of inputs) input.addEventListener("input", () => render());
  state.subscribe(render);
  render();
  return block;
}
