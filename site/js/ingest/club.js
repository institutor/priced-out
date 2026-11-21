// Reads one export of the survey into the dataset the page draws, in the
// browser. This is how a club loads its own members' answers: the file is
// read where it is opened and nothing is sent anywhere.
//
// What a file holds decides how the page labels it, and the caller cannot
// overrule it:
// - any row marked as an example: a made-up club, labelled as sample data
// - otherwise, rows from people: real answers (persona rows are set aside)
// - otherwise, rows from a Flashpoint synthetic panel: simulated
import { parseCsv, toObjects } from "./csv.js";
import { findColumn, normalizeExport } from "./flashpoint-export.js";
import { buildDataset } from "./aggregate.js";
import { ITEMS, MIN_CELL } from "./vocab.js";

// An error whose message can be shown to the person who chose the file.
export class FileProblem extends Error {
  constructor(message) {
    super(message);
    this.name = "FileProblem";
  }
}

const sameText = (a, b) => String(a ?? "").trim().toLowerCase() === String(b).trim().toLowerCase();

// The reader names the column and the answer when it refuses something. That
// is right for a build log and too much for a page, so the same facts are
// said again in a sentence.
function plain(error) {
  const text = String(error?.message ?? error);
  const column = text.match(/^Column "(.+?)" \(for (.+?)\) (was not found|matched more than one column)/);
  if (column) {
    return column[3] === "was not found"
      ? `This does not look like an export of the Priced Out survey: it has no column named "${column[1]}".`
      : `This file has more than one column that could be "${column[1]}", so it cannot be read safely.`;
  }
  const answer = text.match(/^Unknown answer in column "(.+?)": "(.*)"$/s);
  if (answer) {
    const value = answer[2].length > 60 ? `${answer[2].slice(0, 60)}…` : answer[2];
    return `The column "${answer[1]}" holds an answer this page does not know: "${value}". The file may come from a different survey, or the survey's wording has changed.`;
  }
  return text;
}

function attempt(work) {
  try {
    return work();
  } catch (error) {
    if (error instanceof FileProblem) throw error;
    throw new FileProblem(plain(error));
  }
}

export function datasetFromExport(text, mapping, { name = "" } = {}) {
  if (typeof text !== "string" || text.trim() === "") throw new FileProblem("That file is empty.");
  if (text.includes("\u0000")) {
    throw new FileProblem("That is not a CSV file. In Flashpoint, export the survey's responses as CSV and choose that file.");
  }

  const objects = attempt(() => toObjects(parseCsv(text), mapping.headerRow ?? 1));
  if (objects.length === 0) throw new FileProblem("That file has its headings but no answers under them.");

  const sourceColumn = attempt(() => findColumn(Object.keys(objects[0]), mapping.source.column, "source"));
  const example = objects.some((row) => sameText(row[sourceColumn], mapping.source.example));

  let simulated = false;
  let report = {};
  let respondents = attempt(() => normalizeExport(objects, mapping, report, { synthetic: false }));
  if (respondents.length === 0 && report.otherSource > 0) {
    simulated = true;
    report = {};
    respondents = attempt(() => normalizeExport(objects, mapping, report, { synthetic: true }));
  }
  if (respondents.length === 0) {
    const rows = objects.length === 1 ? "its 1 row" : `any of its ${objects.length} rows`;
    throw new FileProblem(`The file was read, but nobody in ${rows} answered a question after the first.`);
  }

  const loaded = { name: String(name), example };
  let meta = {
    kind: "real",
    title: "A club's own members, anonymous link",
    source: "Flashpoint survey CSV export, read in the browser",
    loaded,
  };
  if (simulated) {
    meta = {
      kind: "simulated",
      title: "AI-simulated students (Flashpoint synthetic panel)",
      source: "Flashpoint CSV export of a synthetic panel run, read in the browser",
      loaded,
    };
  }
  if (example) {
    meta = {
      kind: "sample",
      title: "A made-up club",
      note: "Invented answers that show how a club's own file loads. These are not real responses and must not be reported as findings.",
      source: "site/data/example-club.csv, written by scripts/make-example.mjs",
      loaded,
    };
  }

  const dataset = buildDataset(respondents, meta);
  const answered = Object.fromEntries(ITEMS.map((item) => [item.id, dataset.rows.filter((row) => row[item.id] !== null).length]));
  return {
    dataset,
    report: {
      name: loaded.name,
      kind: meta.kind,
      example,
      rows: report.rows,
      read: respondents.length,
      otherSource: report.otherSource,
      excluded: report.excluded,
      screenedOut: report.screenedOut,
      noAnswers: report.noAnswers,
      answered,
      tooFew: Object.values(answered).every((count) => count < MIN_CELL),
    },
  };
}

// What was read and what was set aside, in a sentence or two for the page.
export function describeReport(report) {
  const people = report.kind === "simulated" ? "simulated students" : report.example ? "made-up members" : "members";
  const one = report.kind === "simulated" ? "simulated student" : report.example ? "made-up member" : "member";
  const parts = [`Read ${report.read} ${report.read === 1 ? one : people}${report.name ? ` from ${report.name}` : ""}.`];
  const aside = [];
  if (report.screenedOut > 0) aside.push(`${report.screenedOut} who said they were not a student`);
  if (report.noAnswers > 0) aside.push(`${report.noAnswers} who answered nothing after the first question`);
  if (report.excluded > 0) aside.push(`${report.excluded} excluded by the survey's own checks`);
  if (report.otherSource > 0) aside.push(`${report.otherSource} from ${report.kind === "simulated" ? "people" : "a simulated panel"}`);
  if (aside.length > 0) {
    const list = aside.length === 1 ? aside[0] : `${aside.slice(0, -1).join(", ")} and ${aside.at(-1)}`;
    parts.push(`Set aside: ${list}.`);
  }
  if (report.tooFew) parts.push(`That is too few to show anything: no figure is shown for fewer than ${MIN_CELL} answers.`);
  return parts.join(" ");
}
