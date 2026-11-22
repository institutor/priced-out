// Puts one run on the agent's page (site/agent/), so anyone can watch what the
// agent did, part by part.
//
//   node agent/publish-run.mjs agent/runs/<folder>             the run the page opens with
//   node agent/publish-run.mjs agent/runs/<folder> --as name   one more run, picked on the page
//   ... --own-addresses   a real run whose whole list was the author's own test addresses
//   ... --miscounted 21   step 21 was counted as an email by mistake: the page says so
//
// The first writes site/data/agent-run.json, the second
// site/data/agent-run-<name>.json. Both are listed in site/data/agent-runs.json.
//
// The steps were already stripped of names and addresses when they were saved.
// This checks once more and refuses to publish a run that still holds an address.

import fs from "node:fs";
import { pathToFileURL } from "node:url";

const ADDRESS = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

// The run as the page needs it. A sealed envelope keeps only its questions here:
// the guesses appear where the run opened it.
export function forSite(run) {
  const steps = run.steps.map((step) => {
    if (step.kind !== "sealed") return step;
    const { envelope, ...rest } = step;
    return { ...rest, questions: envelope.predictions.map((p) => p.question), commanderGuessed: envelope.predictions.filter((p) => p.commander !== null).length };
  });
  const out = {
    objective: run.objective, mode: run.mode, model: run.model, cap: run.cap, emailLimit: run.emailLimit ?? null, orders: run.orders,
    people: run.people, stamp: run.stamp, practiceCommander: run.practiceCommander === true, standInCommander: run.standInCommander === true, handsOff: run.handsOff === true, memory: run.memory ?? [], steps,
  };
  const found = JSON.stringify(out).match(ADDRESS);
  if (found) throw new Error("This run still holds an email address, so it was not published.");
  return out;
}

// The file a run is published to. A name may only hold small letters, digits
// and dashes, so it is safe in an address.
export function fileFor(name) {
  if (name === undefined || name === null) return "agent-run.json";
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(name)) throw new Error("A run's name may hold only small letters, digits and dashes.");
  return `agent-run-${name}.json`;
}

// One line of the list of published runs: enough for the page to offer it.
export function listed(run, name) {
  const spent = run.steps.reduce((most, step) => Math.max(most, step.spent ?? 0), 0);
  return {
    name: name ?? "",
    file: fileFor(name),
    objective: run.objective,
    mode: run.mode,
    handsOff: run.handsOff === true,
    standInCommander: run.standInCommander === true,
    people: run.people,
    rounds: new Set(run.steps.filter((step) => step.round !== undefined).map((step) => step.round)).size,
    remembered: (run.memory ?? []).length,
    spent,
    stamp: run.stamp,
  };
}

// The list with one run put in. The run the page opens with stays first, and
// a run published again under the same name takes the place it had.
export function withRun(list, entry) {
  const others = list.filter((other) => other.file !== entry.file);
  const at = list.findIndex((other) => other.file === entry.file);
  if (entry.name === "") return [entry, ...others];
  if (at === -1) return [...others, entry];
  return [...list.slice(0, at), entry, ...list.slice(at + 1)];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const as = args.includes("--as") ? args[args.indexOf("--as") + 1] : undefined;
  const folder = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--as" && args[index - 1] !== "--miscounted");
  if (!folder || !fs.existsSync(`${folder}/steps.json`) || (args.includes("--as") && !as)) {
    console.log("Usage: node agent/publish-run.mjs agent/runs/<folder> [--as name]");
    process.exit(1);
  }
  const run = JSON.parse(fs.readFileSync(`${folder}/steps.json`, "utf8"));
  const out = forSite(run);
  // A real run sent only to the author's own test addresses is a test of the
  // pipeline. The page says so above everything else.
  if (args.includes("--own-addresses")) out.ownAddresses = true;
  // A correction made by hand after the run: the code read a reply as a send when
  // nothing had been emailed. The record keeps what the code counted, and says so.
  const wrong = args.includes("--miscounted") ? Number(args[args.indexOf("--miscounted") + 1]) : null;
  if (wrong !== null) {
    const step = out.steps[wrong - 1];
    if (!step || step.kind !== "flashpoint" || !step.emailed) throw new Error(`Step ${wrong} was not counted as an email.`);
    step.miscounted = true;
  }
  const file = fileFor(as);
  const target = new URL(`../site/data/${file}`, import.meta.url);
  fs.writeFileSync(target, `${JSON.stringify(out, null, 1)}\n`);
  const index = new URL("../site/data/agent-runs.json", import.meta.url);
  const list = fs.existsSync(index) ? JSON.parse(fs.readFileSync(index, "utf8")) : [];
  fs.writeFileSync(index, `${JSON.stringify(withRun(list, { ...listed(out, as), ...(out.ownAddresses ? { ownAddresses: true } : {}) }), null, 1)}\n`);
  console.log(`Published ${run.steps.length} steps of a ${run.mode === "real" ? "real" : "practice"} run to site/data/${file}.`);
  if (run.mode !== "real") console.log("The page will say, above everything else, that this is a practice run with invented answers.");
}
