// How the numbers were made, and what they can't tell you.
import { el } from "./dom.js";

const POINTS = [
  ["Who answered.", "Students who saw a link in a group chat and chose to open it. That is not a random sample of the campus, so read every number as what these students said."],
  ["Saying is not doing.", "People were asked at what price they would skip something. What they actually do can differ, in either direction."],
  ["Small numbers.", "Every share comes with a 95% interval, and nothing is shown for fewer than 5 students."],
  ["The ends of the scale.", "An answer at the top of a price slider means that much or more. It never counts as priced out here, and prices on this page stop one step below the top. A skip price of $0 is read as no answer: skipping something that is free is not about the price."],
  ["What Flashpoint did.", "The survey itself: the questions, the trade-off question behind the ranking of fixes, the checks before publishing, the public link and the export of answers."],
  ["What this site did.", "Turned the exported answers into the curve, the intervals, the pledge cascade and the receipt. The page holds no names, emails, written answers or year in school."],
  ["What it is not for.", "Finding the highest price people will put up with, or deciding why one particular member said they were busy."],
];

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function mount(root, dataset) {
  const { meta, rows, items } = dataset;

  let opening = "The numbers on this page right now are generated sample data, used to build the site before the survey closed. What follows describes how the real survey works.";
  if (meta.kind === "real") {
    const when = meta.collectedFrom && meta.collectedTo
      ? ` between ${formatDate(meta.collectedFrom)} and ${formatDate(meta.collectedTo)}`
      : "";
    opening = `${meta.n} Columbia and Barnard students answered an anonymous survey${when}. It was built, checked, published and exported with Flashpoint, and shared as a public link with no names or emails collected.`;
  }

  const counts = items
    .map((item) => `${item.short}: ${rows.filter((row) => row[item.id] !== null).length}`)
    .join(". ");

  root.append(
    el("p", { text: opening }),
    el("ul", { class: "method-list" }, POINTS.map(([lead, rest]) => el("li", {}, el("strong", { text: `${lead} ` }), rest))),
    el("p", { class: "aside", text: `Students who gave a price for each item. ${counts}.` }),
  );
  if (meta.kind === "real" && meta.survey) {
    root.append(el("p", { class: "aside", text: `Flashpoint survey ${meta.survey}.` }));
  }
}
