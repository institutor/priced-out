// What to take to the board: the page's answer in a few lines, on a card,
// with a button that copies it as plain text. The card follows the price and
// the club size set at the top of the page, and always says whose answers it
// rests on.
import { el } from "./dom.js";
import { button, ink, path, seedOf, wipe } from "./ink.js";
import * as sketch from "../lib/sketch.js";
import { plan, planText } from "../lib/plan.js";

function opening(meta) {
  const follows = " It follows the price and the club size set at the top of the page.";
  if (meta.loaded?.example) {
    return [`Everything above in a few lines, set out the way you would send it. This one is built on the made-up club, and it says so.${follows}`];
  }
  if (meta.kind === "simulated") {
    return [
      "Everything above in a few lines, set out the way you would send it. Built on simulated students it is a demonstration, and it says so. Built on ",
      el("a", { href: "#yours", text: "your own members' answers" }),
      ` it is the note for the people who set the price.${follows}`,
    ];
  }
  return [`Everything above in a few lines, for the people who set the price.${follows}`];
}

// `linkFor(view)` gives the address that opens the page on a view. With it,
// the copied note ends with a link back to the figures it came from.
export function mount(root, dataset, state, { linkFor = null } = {}) {
  // The card: a pen outline, with shading down its right side and along its
  // foot so it sits on the page like a card on a desk.
  const body = el("div", { class: "note-body" });
  const card = el("div", { class: "note" }, body);
  ink(card, (width, height) => {
    const seed = seedOf("note card");
    return [
      path(sketch.hatch(width - 9, 12, 7, height - 14, { seed: seed + 1, gap: 3.4, rough: 0.5 }), "note-shade"),
      path(sketch.hatch(12, height - 9, width - 14, 7, { seed: seed + 2, gap: 3.4, rough: 0.5 }), "note-shade"),
      path(sketch.rect(2, 2, width - 12, height - 12, { seed, rough: 1.5, passes: 2, over: 3 }), "note-edge"),
    ];
  });

  // Where the browser will not copy for us, the note is selected instead, so
  // it can be copied by hand.
  let note = null;
  const said = el("span", { class: "share-said", role: "status" });
  const copy = button({
    onclick: async () => {
      const view = state.get();
      const text = planText(note, { address: linkFor ? linkFor({ ...view, revealed: true }) : "" });
      try {
        await navigator.clipboard.writeText(text);
        said.textContent = "Copied. Paste it into a message or a document.";
      } catch {
        const range = document.createRange();
        range.selectNodeContents(body);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        said.textContent = "Your browser would not copy it, so the note is selected. Copy it from there.";
      }
    },
  }, "Copy the note");

  function render(view) {
    note = plan(dataset, view);
    wipe(body);
    said.textContent = "";

    // A pen line under the title, the way an index card has one.
    const head = el("div", { class: "note-head" },
      el("h3", { class: "note-title", text: note.title }),
      note.label ? el("p", { class: "note-label", text: note.label }) : null,
    );
    ink(head, (width, height) => path(
      sketch.line(0, height - 2, width, height - 2, { seed: seedOf("note rule"), rough: 1.1, passes: 1 }),
      "note-rule",
    ));

    body.append(
      head,
      note.enough
        ? el("dl", { class: "note-lines" }, note.lines.map((line) => el("div", { class: "note-line" },
          el("dt", { text: line.lead }),
          el("dd", { text: line.text }),
        )))
        : el("p", { class: "empty", text: "Not enough answers for this item yet." }),
      el("p", { class: "note-source", text: note.source }),
    );
  }

  root.append(
    el("p", {}, opening(dataset.meta)),
    card,
    el("p", { class: "share note-actions" }, copy, said),
  );
  state.subscribe(render);
  render(state.get());
}
