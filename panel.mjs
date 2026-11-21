// Run a Flashpoint synthetic panel (AI personas, not people) through the survey.
//   node panel.mjs start             builds the panel described in
//                                    briefs/05-panel.json and runs it through
//                                    the survey (costs $0.60)
//   node panel.mjs run <name> [id]   runs the saved panel (or the panel with
//                                    that id) through the survey again (costs
//                                    $0.10) and saves the reply to
//                                    replies/<name>.json
//   node panel.mjs status [job id]   asks how a run is going (free, never pays)
// The panel id and the latest run id are kept in replies/state.json. "start"
// and "run" end with an error when the run holds no answers, so a command
// chained after them with && does not go ahead.
import fs from "node:fs";
import { connect, callTool } from "./flashpoint.mjs";

const here = new URL("./", import.meta.url);
const command = process.argv[2];

const briefFile = new URL("briefs/05-panel.json", here);
const stateFile = new URL("replies/state.json", here);

function findKey(value, key) {
  if (value === null || typeof value !== "object") return undefined;
  if (typeof value[key] === "string" && value[key] !== "") return value[key];
  for (const child of Object.values(value)) {
    const found = findKey(child, key);
    if (found) return found;
  }
  return undefined;
}

// The first object anywhere in a value that has the given key.
function findWith(value, key) {
  if (value === null || typeof value !== "object") return null;
  if (key in value) return value;
  for (const child of Object.values(value)) {
    const found = findWith(child, key);
    if (found) return found;
  }
  return null;
}

// Asks about a job without ever paying: a plain fetch stands in for the
// paying one, so if Flashpoint asked for payment the call would fail instead.
async function askStatus(job_id) {
  const handle = await connect();
  return callTool({ ...handle, paidFetch: fetch }, "panel", { action: "status", job_id });
}

// Checks a running job every half minute, for up to an hour.
async function waitForJob(job_id) {
  for (let tries = 0; tries < 120; tries++) {
    await new Promise((resolve) => setTimeout(resolve, 30000));
    const result = await askStatus(job_id);
    const state = findKey(result, "status") ?? "unknown";
    console.log(`  ${new Date().toLocaleTimeString()} ${state}${result?.stage ? `, ${result.stage}` : ""}`);
    if (["completed", "failed", "interrupted"].includes(state)) return result;
  }
  return null;
}

function readState() {
  if (!fs.existsSync(stateFile)) return {};
  return JSON.parse(fs.readFileSync(stateFile, "utf8"));
}

// Sends one paid panel call and saves the reply. A reply counts as started
// when it carries a job id (still running) or a finished run.
async function paidCall(name, args) {
  const replyFile = new URL(`replies/${name}.json`, here);
  const errorFile = new URL(`replies/${name}.error.txt`, here);
  const lockFile = new URL(`replies/${name}.sending`, here);

  if (fs.existsSync(replyFile)) {
    console.log(`replies/${name}.json already exists, so this was already sent. Nothing was sent or paid.`);
    process.exit(1);
  }
  // The lock stops a second click from sending, and paying for, a second run.
  try {
    fs.writeFileSync(lockFile, new Date().toISOString(), { flag: "wx" });
  } catch {
    console.log(`This is already being sent (replies/${name}.sending exists). Nothing was sent or paid.`);
    process.exit(1);
  }
  const unlock = () => fs.rmSync(lockFile, { force: true });

  // flashpoint.mjs prints the payment receipt link with console.error; keep a copy.
  const receipts = [];
  const printError = console.error;
  console.error = (...parts) => {
    receipts.push(parts.join(" "));
    printError(...parts);
  };

  let result;
  try {
    result = await callTool(await connect(), "panel", args);
  } catch (err) {
    fs.writeFileSync(errorFile, `${receipts.join("\n")}\n${err?.stack ?? err}\n`);
    unlock();
    printError(`Failed: ${err?.message ?? err}`);
    process.exit(1);
  }

  const job_id = findKey(result, "job_id");
  let summary = findWith(result, "status_breakdown");
  if (!job_id && !summary) {
    // Nothing is running and nothing finished, so leave the way open to retry.
    fs.writeFileSync(errorFile, JSON.stringify({ sent: args, receipts, result }, null, 2));
    unlock();
    console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2).slice(0, 4000));
    console.log(`\nNo run came back. The reply is in replies/${name}.error.txt`);
    process.exit(1);
  }

  fs.writeFileSync(replyFile, JSON.stringify({ sent: args, receipts, result }, null, 2));
  unlock();
  console.log(`Saved to replies/${name}.json`);

  // A run either comes back finished or as a job to wait for.
  if (!summary) {
    console.log(`Started job ${job_id}. Waiting for it to finish (checking is free).`);
    const finished = await waitForJob(job_id);
    fs.writeFileSync(new URL(`replies/${name}-result.json`, here), JSON.stringify({ job_id, result: finished }, null, 2));
    console.log(`Saved to replies/${name}-result.json`);
    summary = findWith(finished, "status_breakdown");
  }

  const next = { ...readState() };
  // Flashpoint gives a panel more than one id. The one its own run used is the
  // one known to work for another run and for scoping the results.
  const scope = summary?.analytics_scope;
  const panel_id = scope?.panel_id ?? result?.panel_id ?? args.panel_id;
  if (panel_id) next.panel_id = panel_id;
  if (scope?.run_id) next.panel_run_id = scope.run_id;
  fs.writeFileSync(stateFile, JSON.stringify(next, null, 2));

  if (!summary) {
    console.log("The run did not finish, so there is nothing to read yet.");
    process.exit(2);
  }
  const cutOff = summary.status_breakdown.TERMINATED ?? 0;
  const usable = (summary.responses_submitted ?? 0) - cutOff;
  console.log(`Finished: ${summary.responses_submitted} of ${summary.total_personas} personas responded.`);
  console.log(`How their responses ended: ${JSON.stringify(summary.status_breakdown)}`);
  if (usable <= 0) {
    // Exit with an error so that a command chained after this one does not run.
    console.log("Every response was cut off, so this run holds no answers.");
    process.exit(2);
  }
}

async function status() {
  const job_id = process.argv[3] ?? readState().panel_job_id;
  if (!job_id) {
    console.log("No panel job is waiting. A run that finished straight away has no job to check.");
    process.exit(1);
  }
  const result = await askStatus(job_id);
  const state = findKey(result, "status") ?? "unknown";
  const parts = [`status: ${state}`];
  for (const key of ["stage", "progress", "message", "error"]) {
    if (result && result[key] !== undefined && result[key] !== null) parts.push(`${key}: ${JSON.stringify(result[key])}`);
  }
  console.log(parts.join(" | "));
  if (["completed", "failed", "interrupted"].includes(state)) {
    fs.writeFileSync(new URL(`replies/panel-job-${job_id}.json`, here), JSON.stringify({ job_id, result }, null, 2));
    console.log(`Saved to replies/panel-job-${job_id}.json`);
  }
}

if (command === "start") {
  const state = readState();
  if (!state.survey_id) {
    console.log("No survey id in replies/state.json. Nothing was sent or paid.");
    process.exit(1);
  }
  const brief = JSON.parse(fs.readFileSync(briefFile, "utf8"));
  await paidCall("05-panel", { action: "create_and_run", ...brief, survey_id: state.survey_id });
} else if (command === "run") {
  const name = process.argv[3];
  const state = readState();
  if (!name || !/^[\w-]+$/.test(name)) {
    console.log("usage: node panel.mjs run <name> [panel id]   (the reply is saved to replies/<name>.json)");
    process.exit(1);
  }
  const panel_id = process.argv[4] ?? state.panel_id;
  if (!panel_id || !state.survey_id) {
    console.log("No saved panel or survey id in replies/state.json. Nothing was sent or paid.");
    process.exit(1);
  }
  await paidCall(name, { action: "run", panel_id, survey_id: state.survey_id });
} else if (command === "status") {
  await status();
} else {
  console.log("usage: node panel.mjs start | run <name> | status [job id]");
  process.exit(1);
}
