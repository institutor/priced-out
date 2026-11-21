// Why this was built: the builder's own account, and what published work
// says about the same thing. Nothing in this part comes from the survey, and
// it reads the same whoever's answers are on the page.
import { el } from "./dom.js";
import { art, drawnIn, ink, path, seedOf } from "./ink.js";
import { bullet } from "./doodles.js";
import * as sketch from "../lib/sketch.js";
import { figure } from "../lib/figure.js";
import { SOURCES, outside } from "./links.js";

// In the builder's own words, as they are in the README.
const STORY = [
  "During my time in high school, I found myself often faced with times where I couldn't exactly afford to pay for certain club dues, and I wish I could have done something about it. For instance, my school's Science Olympiad competitions often cost hundreds of dollars for just travel and hotels alone, a cost that I could not afford to pay at all.",
  "Priced Out is the idea I dreamt up that I wish the people setting those costs had had. It could have shown them, before the price went out, how many of us it would leave behind and which way of offering a lower price we would have used, without anyone having to say they couldn't pay.",
];

// Each finding was read at its source. The full list, with what was checked
// and how far, is in the README.
const FINDINGS = [
  {
    lead: "Cost keeps students out.",
    text: "In a national poll of parents, 27% of households earning under $60,000 said cost had cut their child's participation in school activities, against 12% of households earning more.",
    source: "C.S. Mott Children's Hospital National Poll, 2016",
    href: "https://www.mottpoll.org/sites/default/files/documents/101716_paytoparticipate_0.pdf",
  },
  {
    lead: "They rarely say so.",
    text: "In interviews with 59 Princeton students, low-income students often turned down dinners and trips they couldn't afford, and some gave another reason, such as being tired or having work to do.",
    source: "Zelizer and Gaydosh, Princeton Alumni Weekly, 2019",
    href: "https://paw.princeton.edu/article/essay-class-campus",
  },
  {
    lead: "Asking for help is the hard part.",
    text: "29% of parents said school activities cost more than they expected, but only 7% had ever asked for a waiver or scholarship.",
    source: "C.S. Mott Children's Hospital National Poll, 2019",
    href: "https://www.mottpoll.org/sites/default/files/documents/031819_PayToParticipate.pdf",
  },
  {
    lead: "It happens at Columbia.",
    text: "In club sports, membership costs up to $925 a semester on one team, and the governing board can set aside only $2,000 of $19,000 for first-generation and low-income students.",
    source: "Daffey, The Blue and White, 2025",
    href: "https://www.theblueandwhite.org/post/the-room-where-it-happens",
  },
];

// The one from the title page who said they couldn't make it, standing
// beside the note.
function bystander() {
  const drawn = figure({
    x: 46, ground: 150, height: 128, seed: 310,
    left: "pocket", right: "neck", lean: -0.035, slump: 0.045, look: -0.5, down: 0.14,
    mouth: "frown", brows: "worried", stance: 0.05,
  });
  let from = 0;
  const parts = drawn.strokes.map((d) => {
    const strokes = drawnIn(d, "figure-line", { from });
    from += strokes.length;
    return strokes;
  });
  parts.push(path(sketch.line(8, 152, 88, 152, { seed: 41, rough: 1.6, passes: 1 }), "ground"));
  return art("bystander", 96, 160, parts);
}

export function mount(root) {
  // A note with a pen line down its margin, the way a page torn from a
  // notebook has one.
  const note = el("blockquote", { class: "story" },
    STORY.map((text) => el("p", { text })),
    el("footer", { text: "The student who built Priced Out" }),
  );
  ink(note, (width, height) => path(
    sketch.line(3, 2, 3, height - 2, { seed: seedOf("story margin"), rough: 1.4, passes: 2 }),
    "story-rule",
  ));

  root.append(
    el("div", { class: "why-layout" }, note, bystander()),
    el("h3", { class: "sub", text: "What published work says" }),
    el("p", { text: "These findings are about real students and families, from published work. They are the reason for the tool, not results from it." }),
    el("ul", { class: "method-list findings" }, FINDINGS.map((finding, index) => el("li", {},
      bullet(140 + index),
      el("strong", { text: `${finding.lead} ` }),
      `${finding.text} `,
      el("span", { class: "cite" }, outside(finding.href, finding.source)),
    ))),
    el("p", { class: "aside" }, "All sixteen sources behind this project, and how far each was checked, are ", outside(SOURCES, "listed in the repository"), "."),
  );
}
