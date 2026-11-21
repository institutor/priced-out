// How many answers are enough: what happened when the page was run on
// made-up clubs whose true answer is known. The figures are worked out by
// scripts/evaluate.mjs and kept in data/evaluation.json. Nothing here is
// about the answers on the page, so it reads the same whoever's they are.
import { el } from "./dom.js";
import { pct } from "../lib/format.js";
import { inRepo, outside } from "./links.js";

const points = (share) => `${Math.round(share * 100)} points`;
const thousands = (count) => count.toLocaleString("en-US");

// The lowest and highest share of clubs in which the interval held the truth.
export function heldRange(evaluation) {
  const held = evaluation.bySize.map((row) => row.held);
  return [Math.min(...held), Math.max(...held)];
}

export function enough(evaluation) {
  if (!evaluation?.bySize?.length) return null;
  const [low, high] = heldRange(evaluation);
  const at = (size) => evaluation.bySize.find((row) => row.size === size);
  const few = at(20);
  const many = at(80);

  const reading = [`At every size, the 95% interval the page draws held the true figure in ${pct(low)} to ${pct(high)} of clubs.`];
  if (few && many) {
    reading.push(`The price it gave for keeping nine in ten was within one step ($5 or $10) of the true price in ${pct(few.priceWithinOneStep)} of clubs with 20 answers, and in ${pct(many.priceWithinOneStep)} with 80.`);
    reading.push("So 20 answers give a rough picture, and 80 give a close one.");
  }

  return el("div", { class: "enough", id: "enough" },
    el("h3", { class: "sub", text: "How many answers are enough?" }),
    el("p", { text: `To find out, the page was run on ${thousands(evaluation.clubs)} made-up clubs whose true answer is known, because a script wrote them. Each club's file went through the same code that reads yours, and what the page said was set against the truth.` }),
    el("table", { class: "ways-table enough-table" },
      el("thead", {}, el("tr", {},
        el("th", { scope: "col", text: "Members who answer" }),
        el("th", { scope: "col", text: "Half the clubs were within" }),
        el("th", { scope: "col", text: "Nine in ten were within" }),
      )),
      el("tbody", {}, evaluation.bySize.map((row) => el("tr", {},
        el("th", { scope: "row", text: String(row.size) }),
        el("td", { text: points(row.typicalMiss) }),
        el("td", { text: points(row.badMiss) }),
      ))),
    ),
    el("p", { text: reading.join(" ") }),
    el("p", { class: "aside" },
      "The distances are between the share the page said would skip at a price and the true share, in percentage points. This checks the reading of a file, the counting and the intervals. It cannot check whether what people say in a survey is what they later do. ",
      outside(inRepo("scripts/evaluate.mjs"), "The script that ran it"),
      " is in the repository.",
    ),
  );
}
