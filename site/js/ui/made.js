// How the survey was made: what Flashpoint built, what it corrected, what
// went wrong with the simulated students and how that was found, and a slip
// with every paid call on it. This part reads the same whoever's answers are
// on the page: it is about the survey, which they all took.
import { el } from "./dom.js";
import { ink, path, perforation, seedOf } from "./ink.js";
import { bullet } from "./doodles.js";
import * as sketch from "../lib/sketch.js";
import { money } from "../lib/format.js";
import { SURVEY, folder, outside } from "./links.js";

// Every paid call to Flashpoint, in order, as numbered in briefs/ and
// replies/. Calls that did one job between them share a line.
export const CALLS = [
  { no: "02", what: "Design the survey from a written brief", cost: 0.5, calls: 1 },
  { no: "03", what: "Is an untouched slider stored as $0? Then get ready to publish", cost: 0.5, calls: 1 },
  { no: "05", what: "Generate 120 personas and run them through the survey", cost: 0.6, calls: 1 },
  { no: "06", what: "Every persona stopped after the first question. Why?", cost: 0.5, calls: 1 },
  { no: "07, 08", what: "Publish the survey", cost: 1, calls: 2 },
  { no: "09, 11", what: "Run the panel again", cost: 0.2, calls: 2 },
  { no: "13", what: "It still stops. Find the real cause in the responses and fix it", cost: 0.5, calls: 1 },
  { no: "14", what: "Confirm the corrected survey", cost: 0.5, calls: 1 },
  { no: "15, 16", what: "Run and export (the corrected survey was not live yet)", cost: 0.6, calls: 2 },
  { no: "17, 18", what: "Confirm until the corrected survey is live", cost: 1, calls: 2 },
  { no: "20", what: "Run the panel: 120 of 120 completed", cost: 0.1, calls: 1 },
  { no: "21", what: "Export that run, with the trade-off design and the answer codes", cost: 0.5, calls: 1 },
];

const cents = (amount) => `$${amount.toFixed(2)}`;

const POINTS = [
  ["It built the survey from one written brief.", "Two price questions for each of three items, in blocks that rotate. A trade-off question over the six fixes, in ten designs it worked out itself so that every fix is shown four times. Follow-up questions shown only when they apply, and a closing question asked by an AI moderator."],
  ["It corrected the design twice.", "The plan was to reuse its Van Westendorp pricing question with two price points. It answered that the type needs exactly four, with fixed meanings, and built two price questions for each item instead. Then it was asked whether a slider nobody touches is stored as $0, which would read as “would skip it even if it were free”. It is, so it replaced the sliders with number boxes that start empty."],
  ["Four runs came back empty.", "All 480 responses ended at the first question. Flashpoint's first explanation, that the survey was still a draft, was wrong. Asked to read the responses themselves, it found the cause: the runner for simulated students walks the survey's pages in order and does not apply skip rules first, so every one of them walked into the “this survey is for students” page that sat after the first question."],
  ["The fifth run completed 120 of 120.", "Flashpoint deleted that page, and the code that reads the export took over the screening. The follow-up questions with conditions were then answered only by the simulated students they applied to."],
  ["Changed, kept and ruled out.", "Changed: the price questions and the sliders. Kept: the six fixes and the trade-off question between them. Ruled out: showing what simulated students said when they skipped something, since an invented excuse is not evidence."],
];

function slip() {
  const rule = (name) => perforation(el("div", { class: "rule" }), `calls ${name}`);
  const total = CALLS.reduce((sum, call) => sum + call.cost, 0);
  const count = CALLS.reduce((sum, call) => sum + call.calls, 0);
  const sheet = el("div", { class: "receipt calls" },
    el("h3", { text: "Flashpoint" }),
    el("p", { class: "serial", text: `${count} paid calls` }),
    rule("top"),
    el("ol", { class: "call-list" }, CALLS.map((call) => el("li", { class: "call" },
      el("span", { class: "call-no", text: call.no }),
      el("span", { class: "call-what", text: call.what }),
      el("span", { class: "call-cost", text: cents(call.cost) }),
    ))),
    rule("middle"),
    el("div", { class: "total" }, el("span", { text: "The whole survey" }), el("span", { text: cents(total) })),
    el("p", { class: "receipt-note", text: "Paid by the call, in USDC, over MCP. The numbers are the ones the briefs and replies are filed under." }),
    rule("bottom"),
    el("p", { class: "sign-off", text: `Less than one ${money(45)} formal ticket.` }),
  );
  ink(sheet, (width, height) => path(
    sketch.slip(1, 1, width - 2, height - 2, { seed: seedOf("calls slip"), tooth: 13, depth: 7, rough: 0.8 }),
    "slip pink",
  ));
  return sheet;
}

export function mount(root) {
  root.append(
    el("div", { class: "receipt-layout made-layout" },
      el("div", {},
        el("p", { text: "Flashpoint did the research work. It designed, checked, hosted and published the survey, generated the simulated students, ran them and exported their answers." }),
        el("ul", { class: "method-list made-list" }, POINTS.map(([lead, rest], index) => el("li", {}, bullet(160 + index), el("strong", { text: `${lead} ` }), rest))),
        el("p", {},
          "Everything sent to Flashpoint and everything it sent back is in the repository: ",
          outside(folder("briefs"), "the briefs"), " and ", outside(folder("replies"), "the replies"),
          ", each paid reply with its payment receipt. ",
          outside(SURVEY, "The survey itself"), " is live.",
        ),
        el("p", { class: "aside", text: "This page never calls Flashpoint. It is a static page, so nothing costs money or can fail while someone is looking at it." }),
      ),
      slip(),
    ),
  );
}
