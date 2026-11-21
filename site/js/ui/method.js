// How the numbers were made, and what they can't tell you.
import { el } from "./dom.js";
import { bullet } from "./doodles.js";
import { voice } from "../lib/voice.js";

const SMALL_NUMBERS = ["Small numbers.", "Every share comes with a 95% interval, and nothing is shown for fewer than 5 answers."];
const ENDS = ["The ends of the scale.", "An answer at the top of a price range means that much or more. It never counts as priced out here, and prices on this page stop one step below the top. A skip price of $0 is read as no answer: skipping something that is free is not about the price."];
const SITE = ["What this site did.", "Turned the exported answers into the curve, the intervals, the pledge cascade and the receipt. The page holds no names, emails, written answers or year in school."];
const NOT_FOR = ["What it is not for.", "Finding the highest price people will put up with, or deciding why one particular member said they were busy."];

const POINTS = [
  ["Who answered.", "Students who were sent a link and chose to open it. That is not a random sample of the campus, so read every number as what these students said."],
  ["Saying is not doing.", "People were asked at what price they would skip something. What they actually do can differ, in either direction."],
  SMALL_NUMBERS,
  ENDS,
  ["What Flashpoint did.", "The survey itself: the questions, the trade-off question behind the ranking of fixes, the checks before publishing, the public link and the export of answers."],
  SITE,
  NOT_FOR,
];

// For a club reading its own members' answers, and for the made-up club that
// shows what that looks like.
const CLUB_POINTS = [
  ["Who answered.", "Members who were sent the link and chose to open it. That may not be every member, and the ones a price keeps away may be the ones who did not open it. Read every number as what these members said."],
  ["Saying is not doing.", "People were asked at what price they would skip something. What they actually do can differ, in either direction."],
  SMALL_NUMBERS,
  ENDS,
  ["What Flashpoint did.", "The survey itself: the questions, the trade-off question behind the ranking of fixes, the checks before publishing, the public link and the export of answers."],
  ["What this page did.", "Read the exported file on this device and turned it into the curve, the intervals, the pledge cascade and the receipt. It keeps no names, emails, written answers or year in school, and it sends nothing anywhere."],
  NOT_FOR,
];

const SIMULATED_POINTS = [
  ["Why a stand-in.", "This page is built for one club at a time. The price that matters is the one where your own members drop out, and no campus-wide average can tell you that. Until a club has answered, the simulated students stand in for one."],
  ["Who answered.", "Nobody. Flashpoint generated AI personas meant to resemble Columbia and Barnard undergraduates, and a language model answered the survey as each one of them."],
  ["What was made up.", "Each persona's background, spending money and feelings about prices were invented by the generator. Flashpoint matched the panel's split by gender to the US adult population and invented age, race, education and income. It marks the panel uncalibrated: it has not been checked against real answers."],
  ["What that makes these numbers.", "A demonstration of the calculator, and a guess at the shape real answers might take. They are not evidence about what real students would do, and no price should be set from them."],
  ["How to get real numbers.", () => ["The same survey is ready to send. A club that puts it in front of its own members can load their answers into this page in place of the simulated ones. ", el("a", { href: "#yours", text: "The next part shows how" }), "."]],
  ["What was left out.", "The survey also asks whether someone has skipped a club event over cost and what they said at the time. An invented person's excuse is not evidence, so those answers are not shown."],
  SMALL_NUMBERS,
  ENDS,
  ["What Flashpoint did.", "The survey, the trade-off question behind the ranking of fixes, the panel of simulated students, their answers and the export."],
  SITE,
  NOT_FOR,
];

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function openingFor(meta) {
  if (meta.loaded) {
    const from = meta.loaded.name ? ` from the file ${meta.loaded.name}` : " from a file";
    if (meta.loaded.example) {
      return `The numbers on this page right now belong to a made-up club: ${meta.n} invented members, read${from}. They show what a club sees once it has loaded its own answers, and they are not findings. What follows is how a club should read its own.`;
    }
    if (meta.kind === "simulated") {
      return `The numbers on this page come from ${meta.n} AI personas in a Flashpoint synthetic panel, read${from} on this device. No real student took the survey for these numbers.`;
    }
    return `The numbers on this page come from ${meta.n} members of your club, read${from} on this device. The file was not uploaded anywhere, and the page forgets it when it is closed or reloaded. The survey they answered was built, checked and published with Flashpoint, and collects no names or emails.`;
  }
  if (meta.kind === "real") {
    const when = meta.collectedFrom && meta.collectedTo
      ? ` between ${formatDate(meta.collectedFrom)} and ${formatDate(meta.collectedTo)}`
      : "";
    return `${meta.n} Columbia and Barnard students answered an anonymous survey${when}. It was built, checked, published and exported with Flashpoint, and shared as a public link with no names or emails collected.`;
  }
  if (meta.kind === "simulated") {
    const panel = meta.panel ?? {};
    const size = panel.size ? `a Flashpoint synthetic panel of ${panel.size} AI personas` : "a Flashpoint synthetic panel of AI personas";
    const model = panel.model ? `, answered by the model ${panel.model}` : "";
    const when = meta.collectedFrom ? ` on ${formatDate(meta.collectedFrom)}` : "";
    return `The numbers on this page come from ${size}${model}${when}. ${meta.n} of them gave answers that could be used. No real student took the survey for these numbers.`;
  }
  return "The numbers on this page right now are generated sample data, used to build the site before any answers were in. What follows describes how the survey works.";
}

export function mount(root, dataset) {
  const { meta, rows, items } = dataset;
  const say = voice(meta);
  let points = POINTS;
  if (meta.loaded) points = CLUB_POINTS;
  if (meta.kind === "simulated") points = SIMULATED_POINTS;

  const counts = items
    .map((item) => `${item.short}: ${rows.filter((row) => row[item.id] !== null).length}`)
    .join(". ");

  root.append(
    el("p", { text: openingFor(meta) }),
    el("ul", { class: "method-list" }, points.map(([lead, rest], index) => el("li", {}, bullet(80 + index), el("strong", { text: `${lead} ` }), typeof rest === "function" ? rest() : rest))),
    el("p", { class: "aside", text: `Number of ${say.many} who gave a price for each item. ${counts}.` }),
  );
  if (meta.kind !== "sample" && meta.survey) {
    root.append(el("p", { class: "aside", text: `Flashpoint survey ${meta.survey}.` }));
  }
}
