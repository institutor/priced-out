// Running the page on a club's own answers: the three steps it takes, and
// the control that reads the file. The file is read by the page itself
// (js/ingest/club.js). It is not sent anywhere, and the page keeps only the
// totals it draws, for as long as it stays open.
import { el } from "./dom.js";
import { button, ink, path, seedOf } from "./ink.js";
import * as sketch from "../lib/sketch.js";

export const SURVEY = "https://flashpointopinions.com/0a4c06d5-1ea1-43dd-89d7-2458c955b58a";
export const REPO = "https://github.com/institutor/priced-out";
const EXAMPLE = "data/example-club.csv";
// An export of this survey is a few hundred bytes a row. Anything this big is
// some other file, and reading it would only freeze the page.
const TOO_BIG = 4 * 1024 * 1024;

const outside = (href, text) => el("a", { href, target: "_blank", rel: "noopener", text });

// A step's number, with a loop of pen round it.
function numeral(n) {
  const node = el("span", { class: "step-n", "aria-hidden": "true", text: String(n) });
  const seed = seedOf(`step ${n}`);
  ink(node, (width, height) => path(
    sketch.ellipse(width / 2, height / 2, width / 2 + 1, height / 2 + 1, { seed, rough: 1.3, steps: 14 }),
    "step-ring",
  ));
  return node;
}

function step(n, title, ...body) {
  return el("li", { class: "step" }, numeral(n), el("div", { class: "step-body" }, el("h3", { class: "sub", text: title }), body));
}

// `read(text, name)` shows the page on the answers in a file's text, and
// throws an error with a message for the page if it cannot. `reset()` puts
// back the answers the page opened with. `said` is what the last reading
// reported, shown again because the page is laid out afresh after each one.
export function mount(root, dataset, { read, reset, said = "" } = {}) {
  const { meta } = dataset;
  const loaded = meta.loaded ?? null;

  const status = el("p", { class: "load-status", role: "status" });
  const problem = el("p", { class: "load-problem", role: "alert" });
  const say = (text) => {
    problem.textContent = "";
    status.textContent = text;
  };
  const refuse = (error) => {
    status.textContent = "";
    problem.textContent = error?.name === "FileProblem"
      ? error.message
      : "That file could not be read. Nothing on the page has changed.";
  };

  let busy = false;
  const run = async (work) => {
    if (busy) return;
    busy = true;
    say("Reading…");
    try {
      await work();
    } catch (error) {
      refuse(error);
    } finally {
      busy = false;
    }
  };

  const picker = el("input", {
    class: "visually-hidden",
    type: "file",
    accept: ".csv,text/csv",
    tabIndex: -1,
    "aria-hidden": "true",
    onchange: (event) => {
      const file = event.target.files?.[0];
      // The same file can be chosen twice in a row, for instance after it
      // has been corrected, and should be read again.
      event.target.value = "";
      if (!file) return;
      run(async () => {
        if (file.size > TOO_BIG) throw Object.assign(new Error("That file is far bigger than an export of this survey. Choose the CSV file Flashpoint exported."), { name: "FileProblem" });
        await read(await file.text(), file.name);
      });
    },
  });
  const choose = button({ onclick: () => picker.click() }, loaded ? "Choose another file" : "Choose your file");
  const tryExample = el("button", {
    class: "text-button",
    type: "button",
    text: "Load a made-up club",
    onclick: () => run(async () => {
      const response = await fetch(EXAMPLE);
      if (!response.ok) throw Object.assign(new Error("The made-up club did not load. Check your connection and try again."), { name: "FileProblem" });
      await read(await response.text(), "example-club.csv");
    }),
  });

  // What the last reading found and set aside. It sits at the top of this
  // part, where the reader is brought after a file is read.
  let now = null;
  if (said) {
    now = el("div", { class: "now-showing", role: "status", tabIndex: -1 },
      el("p", { text: said }),
      loaded ? el("p", { class: "now-actions" },
        el("a", { class: "text-link", href: "#price-check", text: "See the numbers" }),
        el("button", { class: "text-button", type: "button", text: "Put the simulated students back", onclick: () => reset() }),
      ) : null,
    );
  }

  root.append(...[
    el("p", {
      text: loaded
        ? "The page reads one file of answers at a time. This is how a club gets its own."
        : "Every number above comes from simulated students. The same page runs on your own members' answers. It takes three steps.",
    }),
    now,
    el("ol", { class: "steps" },
      step(1, "Send your members the survey",
        el("p", { text: "It asks at what price dues, a formal and a weekend trip become too much, which way of offering a lower price a member would use, and whether they would chip in for someone else. It asks for no name, no email, and nothing about income or financial aid." }),
        el("p", {}, outside(SURVEY, "Open the survey")),
      ),
      step(2, "Export the answers",
        el("p", { text: "Flashpoint exports every response as one CSV file. Under 20 answers the page marks every number as a pilot, and it shows no figure for fewer than 5." }),
        el("p", { class: "aside" },
          "Today the live survey sits in one Flashpoint account, so only its owner can run that export. A copy of the survey for each club is the next thing to build. ",
          outside(`${REPO}/blob/main/briefs/02-draft.txt`, "The brief that built it"),
          " is in the repository.",
        ),
      ),
      step(3, "Load the file here",
        el("p", { text: "The page reads the file on this device. It is not uploaded anywhere. Only the totals the page draws are kept, and they are gone when you close or reload it." }),
        el("p", { class: "load-actions" }, choose, picker),
        el("p", { class: "load-try" },
          "No file yet? ", tryExample, " to see what happens, or ",
          el("a", { href: EXAMPLE, download: "example-club.csv", text: "download its file" }),
          " to see how an export is laid out.",
        ),
        status,
        problem,
      ),
    ),
  ].filter(Boolean));
}
