// What to take to the board: the page's answer in a few lines, on a card,
// with a button that copies it as plain text. The card follows the price and
// the club size set at the top of the page, and always says whose answers it
// rests on. Under it is the same decision as a message for the members.
import { el } from "./dom.js";
import { button, ink, path, seedOf, wipe } from "./ink.js";
import * as sketch from "../lib/sketch.js";
import { bubble } from "../lib/figure.js";
import { plan, planText } from "../lib/plan.js";
import { announcement, messageText, standIn } from "../lib/announce.js";
import { money } from "../lib/format.js";

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

// Copies text, or selects `node` where the browser will not copy for us, so
// it can be copied by hand. `said` is where the outcome is reported.
async function copyOr(text, node, said, { copied, selected }) {
  try {
    await navigator.clipboard.writeText(text);
    said.textContent = copied;
  } catch {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    said.textContent = selected;
  }
}

// Whose answers the message rests on, said beside it. The message in the
// bubble is only a price and an offer. A copy of it starts with a line that
// says whose answers it came from.
function restsOn(meta, told) {
  const whose = standIn(meta);
  if (!whose) return "";
  if (!told.shows.lower) return ` It is built on ${whose}, so the way it offers a lower price shows the form and is not a finding.`;
  const price = told.lower === 0 ? "free place" : money(told.lower);
  return ` It is built on ${whose}, so the ${price} in it shows the form and is not a finding.`;
}

// What to say once the message is copied.
function copiedSaid(meta, told) {
  const said = ["Copied."];
  if (standIn(meta)) said.push("Its first line says it is an example.");
  if (told.shows.code) said.push("Put your own code in before you send it.");
  return said.join(" ");
}

// The decision as a message for the members: the price, and the lower price
// offered the way that came out on top. It follows the same price and size.
function forMembers(dataset, state) {
  const lead = el("p", { class: "message-lead" });
  const words = el("p", { class: "message-text" });
  const message = el("div", { class: "message" }, words);
  ink(message, (width, height) => path(
    bubble(3, 3, width - 6, height - 21, { tip: [30, height - 3], seed: seedOf("message"), rough: 1.5, tail: 22 }),
    "message-edge",
  ));
  const said = el("span", { class: "share-said", role: "status" });
  let told = null;
  const copy = button({
    onclick: () => copyOr(messageText(told, dataset.meta), words, said, {
      copied: copiedSaid(dataset.meta, told),
      selected: "Your browser would not copy it, so the message is selected. Copy it from there.",
    }),
  }, "Copy the message");
  const actions = el("p", { class: "share note-actions" }, copy, said);
  const block = el("div", { class: "for-members" },
    el("h3", { class: "sub", text: "Then, what to tell your members" }),
    lead, message, actions,
  );

  // Why there is only the price to announce, where no lower price is offered.
  const onlyThePrice = (why, { price, size }) => {
    if (why === "never") return "Even free, more than 1 in 20 said they would skip it, so a lower price is not what would bring them back, and there is only the price to announce.";
    if (why === "inside") return `At ${money(price)} no more than 1 in 20 are left out, so the page works out no second price, and there is only the price to announce.`;
    return `In a club of ${size} a lower price comes to less than one more person, so there is only the price to announce.`;
  };

  function render(view) {
    told = announcement(dataset, view);
    said.textContent = "";
    // With too few answers or no ranking there is nothing to build on, and
    // the parts above already say so.
    block.hidden = told.why === "few" || told.why === "none";
    message.hidden = told.text === null;
    actions.hidden = told.text === null;
    if (told.why === "tie") {
      lead.textContent = `The board's decision still has to reach the members. ${told.tied.join(" and ")} tied at the top, so the page does not pick one of them for you.`;
      return;
    }
    if (told.why === "never" || told.why === "inside" || told.why === "nobody") {
      lead.textContent = `The board's decision still has to reach the members. ${onlyThePrice(told.why, view)}`;
      return;
    }
    if (told.text === null) return;
    words.textContent = told.text;
    lead.replaceChildren(
      "The board's decision still has to reach the members. This is the price as a message, with the lower price offered the way that came out on top: ",
      el("strong", { text: told.fix.label }),
      `.${restsOn(dataset.meta, told)}`,
    );
  }
  state.subscribe(render);
  render(state.get());
  return block;
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

  let note = null;
  const said = el("span", { class: "share-said", role: "status" });
  const copy = button({
    onclick: () => {
      const view = state.get();
      const text = planText(note, { address: linkFor ? linkFor({ ...view, revealed: true }) : "" });
      return copyOr(text, body, said, {
        copied: "Copied. Paste it into a message or a document.",
        selected: "Your browser would not copy it, so the note is selected. Copy it from there.",
      });
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
    forMembers(dataset, state),
  );
  state.subscribe(render);
  render(state.get());
}
