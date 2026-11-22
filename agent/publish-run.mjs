// Puts one mission on the site's replay page (site/agent/), so anyone can watch
// what the agent did, step by step.
//
//   node agent/publish-run.mjs agent/runs/<folder>     writes site/data/agent-run.json
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const folder = process.argv[2];
  if (!folder || !fs.existsSync(`${folder}/steps.json`)) {
    console.log("Usage: node agent/publish-run.mjs agent/runs/<folder>");
    process.exit(1);
  }
  const run = JSON.parse(fs.readFileSync(`${folder}/steps.json`, "utf8"));
  const target = new URL("../site/data/agent-run.json", import.meta.url);
  fs.writeFileSync(target, `${JSON.stringify(forSite(run), null, 1)}\n`);
  console.log(`Published ${run.steps.length} steps of a ${run.mode === "real" ? "real" : "practice"} run to site/data/agent-run.json.`);
  if (run.mode !== "real") console.log("The page will say, above everything else, that this is a practice run with invented answers.");
}
